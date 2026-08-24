@echo off
setlocal
set "PYTHONUTF8=1"
set "rig_python=%~dp0.optical-rig-python"
if not exist "%rig_python%\cv2\__init__.py" if exist "%~dp0..\..\.optical-rig-python\cv2\__init__.py" set "rig_python=%~dp0..\..\.optical-rig-python"
if not exist "%rig_python%\cv2\__init__.py" (
    echo Installing rig-only OpenCV dependency...
    set "rig_python=%~dp0.optical-rig-python"
    python -m pip install --target "%rig_python%" opencv-python==4.8.1.78
    if errorlevel 1 exit /b %ERRORLEVEL%
)
set "PYTHONPATH=%rig_python%;%PYTHONPATH%"
python "%~dp0scripts\optical-rig-test.py" %*
exit /b %ERRORLEVEL%
