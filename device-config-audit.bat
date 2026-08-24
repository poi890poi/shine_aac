@echo off
setlocal
python "%~dp0scripts\device-native-settings-audit.py" %*
exit /b %ERRORLEVEL%
