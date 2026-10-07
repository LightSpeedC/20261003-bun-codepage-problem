@echo off
rem Neighbor process for consoles that start at code page 437. This file is CP437, so its comments are English only.
rem If the console is still at 437, the line below prints correctly. If Bun left 65001 behind, cmd misreads this line and it is garbled.
echo neighbor: caf‚
