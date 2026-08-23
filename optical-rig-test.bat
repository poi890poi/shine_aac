@echo off
setlocal
set "PYTHONUTF8=1"
if not exist "%~dp0.optical-rig-python\cv2\__init__.py" (
    echo Installing rig-only OpenCV dependency...
    python -m pip install --target "%~dp0.optical-rig-python" opencv-python==4.8.1.78
    if errorlevel 1 exit /b %ERRORLEVEL%
)
python "%~dp0scripts\optical-rig-test.py" %*
exit /b %ERRORLEVEL%
