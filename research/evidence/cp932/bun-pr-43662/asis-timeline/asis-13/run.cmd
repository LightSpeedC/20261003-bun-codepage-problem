@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 932 >nul
start "" /b node "%~dp0..\..\..\..\..\..\tests\fixtures/watch.ts" --out "%~dp0./watch.ndjson" --ready "%~dp0./ready.flag" --stop "%~dp0./stop.flag" --done "%~dp0./done.flag"
:ready
if not exist "%~dp0.\ready.flag" goto ready
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
bun -e "console.log('abc \u6771\u4eac\u5927\u962a xyz')" | bun -e "process.stdin.pipe(process.stdout)"
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-932.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
type nul > "%~dp0.\stop.flag"
:done
if not exist "%~dp0.\done.flag" goto done
del "%~dp0.\ready.flag" "%~dp0.\stop.flag" "%~dp0.\done.flag"
