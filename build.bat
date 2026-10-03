@echo off
set "ELECTRON_RUN_AS_NODE=1"
set "EXE=%~dp0node_modules\electron\dist\electron.exe"
set "CLI=%~dp0node_modules\electron-builder\cli.js"
cd /d "%~dp0"
"%EXE%" --experimental-require-module "%CLI%" --win nsis
echo EXIT_CODE=%ERRORLEVEL%