@echo off
setlocal
if /I "%~1"=="--bird-poc" goto bird_poc
python "%~dp0scripts\device-acceptance-test.py" %*
set "acceptance_exit=%ERRORLEVEL%"

rem A setup/install abort (2+) cannot establish which APK is running, so do not
rem attach a misleading WebView audit to it. Ordinary findings (exit 1) still
rem receive the full configuration audit.
if %acceptance_exit% GEQ 2 exit /b %acceptance_exit%

python "%~dp0scripts\device-native-settings-audit.py"
set "config_exit=%ERRORLEVEL%"
if not %acceptance_exit% EQU 0 exit /b %acceptance_exit%
exit /b %config_exit%

:bird_poc
if not defined BIRD_NODE set "BIRD_NODE=node"
"%BIRD_NODE%" "%~dp0scripts\device-bird-poc.mjs" "%~2"
exit /b %ERRORLEVEL%
