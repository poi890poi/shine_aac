@echo off
setlocal
node --experimental-websocket "%~dp0scripts\device-config-audit.mjs" %*
exit /b %ERRORLEVEL%
