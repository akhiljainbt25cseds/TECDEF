@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges to access fan hardware...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)
cd /d "%~dp0\HSM - VENTURE\bin"
echo Restoring automatic BIOS fan control...
DellFanCmd.exe ec-enable
echo Done! Fans returned to default automatic BIOS mode.
pause
