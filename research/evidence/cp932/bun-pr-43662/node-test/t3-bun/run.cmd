@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 932 >nul
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
start "" /b bun "%~dp0..\..\..\..\..\..\tests\fixtures/emit.ts" --dir "%~dp0." --tag w --pidfile "%~dp0./pid.txt" --post 20000
ping -n 3 127.0.0.1 >nul
set /p KPID=<"%~dp0.\pid.txt"
taskkill /F /PID %KPID% >nul
ping -n 2 127.0.0.1 >nul
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-932.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
