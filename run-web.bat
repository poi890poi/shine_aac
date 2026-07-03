@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\serve-web.ps1" %*
