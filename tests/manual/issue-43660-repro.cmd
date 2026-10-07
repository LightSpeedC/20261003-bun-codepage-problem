@echo off
rem bun#43660 と同じ形のコマンドを、開いた直後の窓（cp932）で流す
rem 文字列は abc 東京大阪 xyz。化けると abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz になり、壊れたバイトが残らず改行も消えない
rem 使い方: issue-43660-repro.cmd <bun の実行ファイル> <ログの出力先>
rem chcp は引数なしで現在値を表示するだけ。コードページは変えない
rem 実行中に表示する見出しは ASCII にする。日本語だと、bun が変えたコードページで cmd が読み違えて見出しごと化けるため
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

rem 見出しとコードページを、画面とログの両方に出す
:cp
echo %~1
chcp
echo %~1 >> "%LOG%"
chcp >> "%LOG%"
exit /b 0

:usage
echo 使い方: issue-43660-repro.cmd ^<bun の実行ファイル^> ^<ログの出力先^>
exit /b 2
