@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 437 >nul
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
deno eval "console.log('abc \u6771\u4eac\u5927\u962a xyz')" | deno eval "process.stdin.pipe(process.stdout)"
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-437.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
