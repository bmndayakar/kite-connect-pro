import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { checkAuthStatus, logoutUser } from './api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Re-use saved access token on initial load / code change (HMR)
  useEffect(() => {
    async function verifyExistingSession() {
      try {
        const res = await checkAuthStatus();
        if (res && res.authenticated) {
          setIsAuthenticated(true);
          setUser({
            user_id: res.user_id,
            user_name: res.user_name,
            email: res.email,
            broker: res.broker,
          });
          console.log('[Auth] Restored active session from backend cache for user:', res.user_id);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] No existing active session detected:', err);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingSession(false);
      }
    }

    verifyExistingSession();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Immediately clear authentication state for instant UI responsiveness
    setIsAuthenticated(false);
    setUser(null);
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Backend logout call error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <main className="main-content">
        {isAuthenticated ? (
          <Dashboard user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        ) : (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            isCheckingExistingSession={isCheckingSession}
          />
        )}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '1.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-dim)',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
        }}
      >
        <p>Zerodha Kite Connect Hub • React + Vite + FastAPI • Light Theme</p>
      </footer>
    </div>
  );
}
