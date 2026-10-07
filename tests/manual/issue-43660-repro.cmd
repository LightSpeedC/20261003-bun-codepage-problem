@echo off
rem Run the same shape of command as bun#43660 in a freshly opened console (code page 932). This file is Shift_JIS.
rem bun#43660 と同じ形のコマンドを、開いた直後の窓（cp932）で流す。このファイルは SJIS。
rem The text is abc 東京大阪 xyz. Garbled at 932 it becomes abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz: no broken byte is left and the newline survives.
rem 文字列は abc 東京大阪 xyz。化けると abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz になり、壊れたバイトが残らず改行も消えない。
rem Usage: issue-43660-repro.cmd <bun executable> <log file>
rem 使い方: issue-43660-repro.cmd <bun の実行ファイル> <ログの出力先>
rem chcp without arguments only shows the current value; it does not change the code page.
rem chcp は引数なしで現在値を表示するだけ。コードページは変えない。
rem Labels printed during the run are ASCII: Japanese labels would be misread by cmd once Bun changes the code page.
rem 実行中に表示する見出しは ASCII にする。日本語だと、bun が変えたコードページで cmd が読み違えて見出しごと化けるため。
setlocal
set "BUN=%~1"
set "LOG=%~2"
if "%BUN%"=="" goto usage
if "%LOG%"=="" goto usage

"%BUN%" --revision > "%LOG%"
"%BUN%" --revision

call :cp "[1] before"

echo --- bun to bun, output to console ---
"%BUN%" -e "console.log('abc 東京大阪 xyz')" | "%BUN%" -e "process.stdin.pipe(process.stdout)"

call :cp "[2] after console run"

echo --- bun to bun, output to file ---
"%BUN%" -e "console.log('abc 東京大阪 xyz')" | "%BUN%" -e "process.stdin.pipe(process.stdout)" > "%LOG%.bytes"

call :cp "[3] after file run"

echo --- end ---
pause
exit /b 0

rem Print the label and the code page to both the screen and the log.
rem 見出しとコードページを、画面とログの両方に出す。
:cp
echo %~1
chcp
echo %~1 >> "%LOG%"
chcp >> "%LOG%"
exit /b 0

:usage
echo 使い方: issue-43660-repro.cmd ^<bun の実行ファイル^> ^<ログの出力先^>
exit /b 2
