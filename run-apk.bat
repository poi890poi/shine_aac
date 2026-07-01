@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-apk.ps1" %*
exit /b %ERRORLEVEL%
