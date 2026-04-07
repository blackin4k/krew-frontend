# Mobile Testing Setup Script for Windows
# This script helps you find your IP address and set up mobile testing

Write-Host "`n=== KREW Mobile Testing Setup ===" -ForegroundColor Cyan
Write-Host ""

# Find local IP address
Write-Host "Finding your local IP address..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -notlike "127.*"
}).IPAddress | Select-Object -First 1

if ($ipAddress) {
    Write-Host "✓ Found IP Address: $ipAddress" -ForegroundColor Green
} else {
    Write-Host "✗ Could not find IP address. Please check your network connection." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create a .env file in the frontend directory with:" -ForegroundColor White
Write-Host "   VITE_API_URL=http://$ipAddress`:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Start the backend server:" -ForegroundColor White
Write-Host "   cd c:\krewv1\spov1" -ForegroundColor Gray
Write-Host "   python app.py" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the frontend server:" -ForegroundColor White
Write-Host "   cd c:\krewv1\frontend-friend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Access from your phone:" -ForegroundColor White
Write-Host "   http://$ipAddress`:8080" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to create .env file automatically
$createEnv = Read-Host "Would you like to create the .env file automatically? (y/n)"
if ($createEnv -eq "y" -or $createEnv -eq "Y") {
    $envContent = "VITE_API_URL=http://$ipAddress`:5000"
    $envPath = Join-Path $PSScriptRoot ".env"
    
    if (Test-Path $envPath) {
        $overwrite = Read-Host ".env file exists. Overwrite? (y/n)"
        if ($overwrite -ne "y" -and $overwrite -ne "Y") {
            Write-Host "Skipping .env file creation." -ForegroundColor Yellow
            exit 0
        }
    }
    
    Set-Content -Path $envPath -Value $envContent
    Write-Host "✓ Created .env file at: $envPath" -ForegroundColor Green
    Write-Host "  Content: $envContent" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Setup complete! Make sure both servers are running and your phone is on the same WiFi network." -ForegroundColor Green
Write-Host ""
