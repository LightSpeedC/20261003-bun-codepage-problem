@echo off
rem Neighbor process for consoles that start at code page 932. This file is Shift_JIS.
rem 開始のコードページが 932 の窓で使う隣のプロセス役。このファイルは SJIS。
rem If the console is still at 932, the line below prints correctly. If Bun left 65001 behind, cmd misreads this line and it is garbled.
rem 窓が 932 のままなら下の行は正しく出る。bun が 65001 を残していると、cmd がこの行を読み違えて化ける。
echo neighbor: 東京大阪
