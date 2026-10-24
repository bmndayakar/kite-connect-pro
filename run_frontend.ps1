# Run React Vite Frontend
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location -Path "$PSScriptRoot\frontend"
cmd.exe /c "npm.cmd run dev"

