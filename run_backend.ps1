# Run FastAPI Backend
$env:PATH = "C:\Users\dayam\AppData\Local\Python\pythoncore-3.15-64;C:\Users\dayam\AppData\Local\Python\pythoncore-3.15-64\Scripts;" + $env:PATH
Set-Location -Path "$PSScriptRoot\backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

