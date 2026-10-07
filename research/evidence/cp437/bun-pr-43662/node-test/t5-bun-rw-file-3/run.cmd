@echo off
rem Dedicated console for this case only: set its starting code page.
chcp 437 >nul
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag before
(ping -n 2 127.0.0.1 >nul & bun "%~dp0..\..\..\..\..\..\tests\fixtures/emit.ts" --dir "%~dp0." --tag w) | bun "%~dp0..\..\..\..\..\..\tests\fixtures/sink.ts" --dir "%~dp0." --tag r --mode file --out "%~dp0./out.bin" --when eof --delay 800
echo --- tail ---
chcp
call "%~dp0..\..\..\..\..\..\tests\fixtures\neighbor-437.cmd"
node "%~dp0..\..\..\..\..\..\tests\fixtures/probe.ts" --dir "%~dp0." --tag after --screen "%~dp0./screen.json"
