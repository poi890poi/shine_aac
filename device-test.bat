@echo off
setlocal
python "%~dp0scripts\device-acceptance-test.py" %*
exit /b %ERRORLEVEL%
