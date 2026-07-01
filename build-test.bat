@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-test.ps1" %*
exit /b %ERRORLEVEL%
