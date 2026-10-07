@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 932 >nul
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
node "%~dp0..\..\..\..\..\..\tests\fixtures/emit.ts" --dir "%~dp0." --tag x --pre 300 --post 300
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-932.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
