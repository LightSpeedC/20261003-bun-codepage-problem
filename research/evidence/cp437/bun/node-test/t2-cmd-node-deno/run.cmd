@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 437 >nul
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
node "%~dp0..\..\..\..\..\..\tests\fixtures/emit.ts" --dir "%~dp0." --tag w | deno run -A --quiet "%~dp0..\..\..\..\..\..\tests\fixtures/sink.ts" --dir "%~dp0." --tag r --mode file --when eof --out "%~dp0./out.bin"
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-437.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
