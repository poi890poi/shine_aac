@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-play-aab.ps1" %*
exit /b %ERRORLEVEL%
