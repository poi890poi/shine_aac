@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-android-sdk.ps1" %*
exit /b %ERRORLEVEL%
