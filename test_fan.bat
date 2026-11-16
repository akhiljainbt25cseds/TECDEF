@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges to access fan hardware...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)
cd /d "%~dp0\HSM - VENTURE\bin"
echo [1/3] Disabling automatic BIOS fan control...
DellFanCmd.exe ec-disable
echo [2/3] Setting Fan 1 to 100%% Max Speed...
DellFanCmd.exe fan1-level2
echo [3/3] Setting Fan 2 to 100%% Max Speed...
DellFanCmd.exe fan2-level2
echo.
echo ========================================================
echo Done! If you hear the fan spinning, hardware control is ACTIVE!
echo To return to automatic BIOS control, run test_fan_auto.bat
echo ========================================================
pause

