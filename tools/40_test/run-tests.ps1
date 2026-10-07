# コードページ問題のテストを node --test と bun test の両方で全件流す
# テストごとに新しい窓（conhost）が最小化で開いては閉じる。全件で 20 分ほどかかる
# 引数 nopause を付けると最後に止まらない
$ErrorActionPreference = 'Stop'
$test = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../tests/codepage.test.ts'))
if (-not (Test-Path -LiteralPath $test)) { throw "テストが見つかりません: $test" }

Write-Host '=== node --test ==='
node --test $test
$nodeExit = $LASTEXITCODE

# bun test は 1 件あたり既定 5 秒で打ち切るため、長くする。bun のケースは todo のため bun test では実行されない
Write-Host '=== bun test ==='
bun test --timeout 600000 $test
$bunExit = $LASTEXITCODE

Write-Host "終了コード: node=$nodeExit bun=$bunExit"
if ($args -notcontains 'nopause') { Read-Host '終わりました。Enter で閉じます' | Out-Null }
if ($nodeExit -ne 0 -or $bunExit -ne 0) { exit 1 }
