import json
import threading
from datetime import datetime
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DUMMY_GTTS_FILE = DATA_DIR / "dummy_gtts.json"

def round_to_tick(price: Optional[float], tick_size: float = 0.05) -> float:
    """
    Rounds price to exact multiple of instrument tick size using Decimal arithmetic.
    """
    if price is None or price <= 0:
        return 0.0
    try:
        p = Decimal(str(price))
        t = Decimal(str(tick_size))
        ticks = (p / t).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        res = (ticks * t).quantize(Decimal(str(tick_size)), rounding=ROUND_HALF_UP)
        return float(res)
    except Exception:
        return round(round(price / tick_size) * tick_size, 2)


class GttService:
    def __init__(self):
        self.lock = threading.Lock()
        self.counter = 0
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load_dummy_gtts()

    def _load_dummy_gtts(self) -> List[Dict[str, Any]]:
        """Loads dummy GTT records from persistent local storage."""
        if not DUMMY_GTTS_FILE.exists():
            return []
        try:
            with open(DUMMY_GTTS_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
                if isinstance(records, list):
                    # update internal counter to prevent collision
                    for r in records:
                        tid = r.get("trigger_id", "")
                        if tid.startswith("DUMMY-"):
                            parts = tid.split("-")
                            if len(parts) >= 3 and parts[-1].isdigit():
                                self.counter = max(self.counter, int(parts[-1]))
                    return records
        except Exception as e:
            print(f"[GttService] Error loading dummy GTTs: {e}")
        return []

    def _save_dummy_gtts(self, records: List[Dict[str, Any]]):
        """Atomically saves dummy GTT records to disk."""
        tmp_file = DATA_DIR / "dummy_gtts.tmp"
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            tmp_file.replace(DUMMY_GTTS_FILE)
        except Exception as e:
            print(f"[GttService] Error saving dummy GTTs: {e}")

    def _get_kite_account_state(self, kite_client) -> Dict[str, Any]:
        """
        Safely fetches read-only Kite account state (GTTs, orders, positions, holdings).
        NEVER calls any modifying or order-placement method.
        """
        state = {
            "gtts": [],
            "orders": [],
            "positions": {"net": []},
            "holdings": []
        }
        if not kite_client:
            return state

        # 1. GTTs
        try:
            gtts = kite_client.get_gtts()
            if isinstance(gtts, list):
                state["gtts"] = gtts
        except Exception as e:
            print(f"[GttService] Warning: kite.get_gtts() failed: {e}")

        # 2. Orders
        try:
            orders = kite_client.orders()
            if isinstance(orders, list):
                state["orders"] = orders
        except Exception as e:
            print(f"[GttService] Warning: kite.orders() failed: {e}")

        # 3. Positions
        try:
            positions = kite_client.positions()
            if isinstance(positions, dict):
                state["positions"] = positions
        except Exception as e:
            print(f"[GttService] Warning: kite.positions() failed: {e}")

        # 4. Holdings
        try:
            holdings = kite_client.holdings()
            if isinstance(holdings, list):
                state["holdings"] = holdings
        except Exception as e:
            print(f"[GttService] Warning: kite.holdings() failed: {e}")

        return state

    def check_candidate_state(
        self,
        order: Dict[str, Any],
        kite_state: Dict[str, Any],
        dummy_records: List[Dict[str, Any]],
        tick_size: float = 0.05,
        mode: str = "simulation"
    ) -> Dict[str, Any]:
        """
        Evaluates a single candidate order against Kite state and dummy store.
        Returns full response specification with supported status and exact message.
        """
        sym = order.get("symbol", "").strip()
        raw_buy = order.get("buy_price")
        raw_stoploss = order.get("stoploss")
        last_price = order.get("last_price")
        qty = int(order.get("quantity") or 1)

        # Base structure
        res = {
            "symbol": sym,
            "quantity": qty,
            "buy_price": None,
            "stoploss": None,
            "tick_size": tick_size,
            "last_price": last_price,
            "account_state": "checking",
            "position_quantity": 0,
            "active_buy_trigger_id": None,
            "active_stoploss_trigger_id": None,
            "day_buy_order_id": None,
            "day_buy_order_status": None,
            "buy_status": "checking",
            "buy_trigger_id": None,
            "stoploss_status": "planned_after_buy",
            "stoploss_trigger_id": None,
            "is_real": False,
            "message": ""
        }

        # 1. Price availability check
        if raw_buy is None or raw_buy <= 0:
            res["buy_status"] = "not_available"
            res["stoploss_status"] = "not_available"
            res["account_state"] = "invalid"
            res["message"] = "Buy price is not available for this row."
            return res

        # Round buy price and stoploss to tick size
        rounded_buy = round_to_tick(raw_buy, tick_size)
        res["buy_price"] = rounded_buy

        if raw_stoploss is not None and raw_stoploss > 0:
            res["stoploss"] = round_to_tick(raw_stoploss, tick_size)
        else:
            # 5% below buy price
            res["stoploss"] = round_to_tick(rounded_buy * 0.95, tick_size)

        # 2. Check existing holding quantity
        holding_qty = 0
        for h in kite_state.get("holdings", []):
            if h.get("tradingsymbol") == sym:
                holding_qty += int(h.get("quantity", 0)) + int(h.get("t1_quantity", 0))

        if holding_qty > 0:
            res["position_quantity"] = holding_qty
            res["account_state"] = "blocked"
            res["buy_status"] = "blocked"
            res["message"] = f"Skipped: existing position/holding quantity is {holding_qty}."
            return res

        # 3. Check existing net position quantity
        net_pos_qty = 0
        for p in kite_state.get("positions", {}).get("net", []):
            if p.get("tradingsymbol") == sym:
                net_pos_qty += int(p.get("quantity", 0))

        if net_pos_qty > 0:
            res["position_quantity"] = net_pos_qty
            res["account_state"] = "blocked"
            res["buy_status"] = "blocked"
            res["message"] = f"Skipped: existing position/holding quantity is {net_pos_qty}."
            return res

        # 4. Check day BUY order (NSE, CNC/delivery, neither CANCELLED nor REJECTED)
        for o in kite_state.get("orders", []):
            if (
                o.get("tradingsymbol") == sym
                and o.get("exchange") == "NSE"
                and o.get("transaction_type") == "BUY"
                and o.get("product") in ["CNC", "NRML"]
            ):
                st = o.get("status", "").upper()
                if st not in ["CANCELLED", "REJECTED"]:
                    res["day_buy_order_id"] = str(o.get("order_id", ""))
                    res["day_buy_order_status"] = st
                    res["account_state"] = "blocked"
                    res["buy_status"] = "blocked"
                    res["message"] = "Skipped: day BUY order already exists."
                    return res

        # 5. Check active real GTT in Kite
        for g in kite_state.get("gtts", []):
            if g.get("status") == "active":
                cond = g.get("condition", {})
                g_sym = cond.get("tradingsymbol")
                if g_sym == sym:
                    for g_ord in g.get("orders", []):
                        if g_ord.get("transaction_type") == "BUY":
                            gid = str(g.get("id"))
                            res["active_buy_trigger_id"] = gid
                            res["buy_trigger_id"] = gid
                            res["is_real"] = True
                            res["account_state"] = "already_active"
                            res["buy_status"] = "already_active"
                            res["message"] = "Skipped: real buy GTT already active on broker."
                            return res
                        elif g_ord.get("transaction_type") == "SELL":
                            res["active_stoploss_trigger_id"] = str(g.get("id"))

        # 6. Check active dummy/real buy GTT in local storage
        for d in dummy_records:
            if d.get("symbol") == sym and d.get("status") == "active":
                did = d.get("trigger_id", "")
                is_real_rec = d.get("is_real", False)
                # In LIVE mode, ONLY block if there is an active REAL broker GTT
                # Simulation dummy records must NEVER block real live orders!
                if mode == "live" and not is_real_rec:
                    continue

                res["buy_trigger_id"] = did
                res["is_real"] = is_real_rec
                res["account_state"] = "already_active"
                res["buy_status"] = "already_active"
                res["message"] = "Skipped: real buy GTT already active." if is_real_rec else "Skipped: dummy buy GTT already active."
                return res

        # 7. Check last price availability
        if last_price is None or last_price <= 0:
            res["account_state"] = "waiting"
            res["buy_status"] = "waiting_for_ltp"
            res["message"] = "Waiting for LTP."
            return res

        # 8. All checks passed -> Ready
        res["account_state"] = "clear"
        res["buy_status"] = "ready"
        res["message"] = "Ready for buy GTT placement."
        return res

    def get_gtt_states(self, orders: List[Dict[str, Any]], mode: str = "simulation", kite_client=None) -> List[Dict[str, Any]]:
        """
        Read-only state check endpoint implementation for POST /api/algo-orders/gtt-state.
        Never calls any broker order methods.
        """
        with self.lock:
            dummy_records = self._load_dummy_gtts()
            kite_state = self._get_kite_account_state(kite_client)

            results = []
            for ord_data in orders:
                st = self.check_candidate_state(ord_data, kite_state, dummy_records, mode=mode)
                results.append(st)
            return results

    def clear_dummy_records(self) -> int:
        """Clears all paper-trading simulated dummy records, keeping real broker records."""
        with self.lock:
            records = self._load_dummy_gtts()
            kept = [r for r in records if r.get("is_real") is True]
            cleared = len(records) - len(kept)
            self._save_dummy_gtts(kept)
            return cleared

    def execute_gtts(
        self,
        orders: List[Dict[str, Any]],
        confirm_live: bool,
        mode: str = "simulation",
        kite_client=None
    ) -> List[Dict[str, Any]]:
        """
        Executes GTT placement.
        - If mode == "simulation" (default): Creates simulated dummy records (DUMMY- prefix). Zero broker calls.
        - If mode == "live": Places REAL Buy GTT orders directly on Zerodha Kite via kite.place_gtt().
        """
        if not confirm_live:
            raise ValueError("confirm_live must be explicitly true to authorize order placement.")

        is_live_mode = (mode == "live")

        if is_live_mode:
            if not kite_client:
                raise ValueError("Active Zerodha Kite session is required for Live Trading mode. Please log in first on the User Profile tab.")
            # Verify session is valid and active for today's market session
            try:
                kite_client.profile()
            except Exception as e:
                raise ValueError(f"Zerodha session is expired or invalid: {str(e)}. Tokens reset daily at 6:00 AM IST. Please re-login with today's request token on the User Profile tab.")

        with self.lock:
            dummy_records = self._load_dummy_gtts()
            kite_state = self._get_kite_account_state(kite_client)

            results = []
            records_modified = False

            for ord_data in orders:
                # Re-verify state under lock for the active mode
                state = self.check_candidate_state(ord_data, kite_state, dummy_records, mode=mode)

                # If ready, proceed based on mode
                if state["buy_status"] == "ready":
                    sym = state["symbol"]
                    qty = state["quantity"]
                    buy_price = float(state["buy_price"])
                    last_price = float(state.get("last_price") or buy_price)
                    tick_size = float(state.get("tick_size") or 0.05)

                    if is_live_mode:
                        # REAL BROKER ORDER PLACEMENT VIA KITE CONNECT
                        try:
                            # Kite OMS rejects GTT if trigger_price == last_price
                            clean_last_price = last_price
                            if clean_last_price == buy_price:
                                clean_last_price = round(buy_price + tick_size, 2)

                            gtt_res = kite_client.place_gtt(
                                trigger_type=kite_client.GTT_TYPE_SINGLE,
                                tradingsymbol=sym,
                                exchange="NSE",
                                trigger_values=[buy_price],
                                last_price=clean_last_price,
                                orders=[{
                                    "transaction_type": kite_client.TRANSACTION_TYPE_BUY,
                                    "quantity": qty,
                                    "order_type": kite_client.ORDER_TYPE_LIMIT,
                                    "product": kite_client.PRODUCT_CNC,
                                    "price": buy_price
                                }]
                            )
                            real_trigger_id = str(gtt_res.get("trigger_id", ""))
                            state["buy_status"] = "success"
                            state["buy_trigger_id"] = real_trigger_id
                            state["stoploss_status"] = "planned_after_buy"
                            state["stoploss_trigger_id"] = None
                            state["is_real"] = True
                            state["message"] = f"Real buy GTT placed on Zerodha Kite (ID: {real_trigger_id}). Stoploss planned after buy execution."
                            state["account_state"] = "clear"

                            new_record = {
                                "trigger_id": real_trigger_id,
                                "symbol": sym,
                                "quantity": qty,
                                "trigger_price": buy_price,
                                "order_price": buy_price,
                                "product": "CNC",
                                "exchange": "NSE",
                                "transaction_type": "BUY",
                                "order_type": "LIMIT",
                                "status": "active",
                                "is_real": True,
                                "created_at": datetime.now().isoformat()
                            }
                            # Remove any prior simulated dummy for this symbol and add the real one
                            dummy_records = [d for d in dummy_records if d.get("symbol") != sym]
                            dummy_records.append(new_record)
                            records_modified = True
                        except Exception as e:
                            state["buy_status"] = "failed"
                            state["is_real"] = True
                            state["message"] = f"Failed to place real GTT on Kite: {str(e)}"
                    else:
                        # SIMULATION (DUMMY) MODE
                        self.counter += 1
                        trigger_id = f"DUMMY-{sym}-{self.counter:06d}"

                        new_record = {
                            "trigger_id": trigger_id,
                            "symbol": sym,
                            "quantity": qty,
                            "trigger_price": buy_price,
                            "order_price": buy_price,
                            "product": "CNC",
                            "exchange": "NSE",
                            "transaction_type": "BUY",
                            "order_type": "LIMIT",
                            "status": "active",
                            "is_real": False,
                            "created_at": datetime.now().isoformat()
                        }
                        dummy_records.append(new_record)
                        records_modified = True

                        state["buy_status"] = "success"
                        state["buy_trigger_id"] = trigger_id
                        state["stoploss_status"] = "planned_after_buy"
                        state["stoploss_trigger_id"] = None
                        state["is_real"] = False
                        state["message"] = "Dummy buy GTT created. No order sent to Kite. Stoploss planned after buy execution."
                        state["account_state"] = "clear"

                results.append(state)

            if records_modified:
                self._save_dummy_gtts(dummy_records)

            return results

    def place_dummy_live_gtts(
        self,
        orders: List[Dict[str, Any]],
        confirm_live: bool,
        kite_client=None
    ) -> List[Dict[str, Any]]:
        return self.execute_gtts(orders, confirm_live=confirm_live, mode="simulation", kite_client=kite_client)


gtt_service = GttService()

