@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\optical-rig-window-control.ps1" %*
exit /b %errorlevel%
