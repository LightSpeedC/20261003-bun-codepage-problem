# Test phase: put the runtimes in _bin/ first on PATH, confirm them, then run every test at code pages 932 and 437.
# 試験実施フェーズ: _bin/ のランタイムを PATH の先頭に置いて確かめ、コードページ 932 と 437 で全件を流す。
# Run tools/10_setup/setup-runtimes.cmd once beforehand.
# 先に tools/10_setup/setup-runtimes.cmd を 1 回流しておく。
# Results go to research/evidence_last/, which is overwritten on every run and not committed.
# 結果は research/evidence_last/ に置く。毎回上書きし、commit しない。
# Each pass also writes environment.json: code page, tool names, versions and the run time (UTC, Z format). No other file holds a date.
# 回ごとに environment.json も書く（コードページ ・ ツール名 ・ 版 ・ 実行日時（UTC の Z 形式））。日時を書くのはこのファイルだけ。
# A new console opens and closes, minimized, for every case. All passes take about 55 minutes.
# ケースごとに新しい窓が最小化で開いては閉じる。全部で 55 分ほどかかる。
# Pass "nopause" to skip the final pause.
# 引数 nopause を付けると最後に止まらない。
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$bin = Join-Path $root '_bin'
$test = Join-Path $root 'tests\codepage.test.ts'
$evidence = Join-Path $root 'research\evidence_last'
if (-not (Test-Path -LiteralPath $test)) { throw "テストが見つかりません: $test" }
if (-not (Test-Path -LiteralPath (Join-Path $bin 'node\node.exe'))) { throw '_bin にランタイムがありません。先に tools/10_setup/setup-runtimes.cmd を流してください' }
$basePath = $env:PATH

# Put the downloaded runtimes first on PATH, and confirm each name resolves to the one under _bin/.
# 取ったランタイムを PATH の先頭に置き、それぞれの名前が _bin/ の下のものに解決されることを確かめる。
function Use-Runtimes([string]$bunDir) {
	$env:PATH = ((@($bunDir, 'node', 'deno', 'pwsh') | ForEach-Object { Join-Path $bin $_ }) -join ';') + ';' + $basePath
	foreach ($pair in @(@('bun', $bunDir), @('node', 'node'), @('deno', 'deno'), @('pwsh', 'pwsh'))) {
		$found = & where.exe $pair[0] 2>$null | Select-Object -First 1
		$expected = Join-Path (Join-Path $bin $pair[1]) "$($pair[0]).exe"
		if ($found -ne $expected) { throw "$($pair[0]) が _bin/$($pair[1]) に解決されません: $("$found".Replace($env:USERPROFILE, '~'))" }
	}
}

# Write environment.json for one pass. Versions come from the runtimes now on PATH.
# 1 回分の environment.json を書く。版は、いま PATH にあるランタイムから取る。
function Write-Environment([string]$dir, [int]$cp, [string]$runner, [string]$bunDir) {
	New-Item -ItemType Directory -Force -Path $dir | Out-Null
	$info = [ordered]@{
		runAt = [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
		codePage = $cp
		runner = $runner
		tools = @(
			[ordered]@{ name = 'bun'; folder = "_bin/$bunDir"; version = "$(& bun --revision)" },
			[ordered]@{ name = 'node'; folder = '_bin/node'; version = "$(& node -v)" },
			[ordered]@{ name = 'deno'; folder = '_bin/deno'; version = "$(& deno --version | Select-Object -First 1)" },
			[ordered]@{ name = 'pwsh'; folder = '_bin/pwsh'; version = "$(& pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()')" },
			[ordered]@{ name = 'powershell'; folder = '(Windows)'; version = $PSVersionTable.PSVersion.ToString() }
		)
	}
	$json = $info | ConvertTo-Json -Depth 5
	[System.IO.File]::WriteAllText((Join-Path $dir 'environment.json'), $json + "`n", (New-Object System.Text.UTF8Encoding $false))
}

if (Test-Path -LiteralPath $evidence) { Remove-Item -LiteralPath $evidence -Recurse -Force }
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

# Four passes per code page: node --test with Bun stable, node --test with canary and with the build of PR #43662 (only cases involving Bun), and bun test.
# コードページごとに 4 回: bun 安定版での node --test、canary と PR #43662 の版での node --test（bun を含むケースだけ）、bun test。
$passes = @(
	@{ bun = 'bun'; runner = 'node-test'; onlyBun = '' },
	@{ bun = 'bun-canary'; runner = 'node-test'; onlyBun = '1' },
	@{ bun = 'bun-pr-43662'; runner = 'node-test'; onlyBun = '1' },
	@{ bun = 'bun'; runner = 'bun-test'; onlyBun = '' }
)
$summary = @()
$failed = $false
foreach ($cp in 932, 437) {
	foreach ($p in $passes) {
		Use-Runtimes $p.bun
		$dir = Join-Path $evidence "cp$cp\$($p.bun)\$($p.runner)"
		Write-Environment $dir $cp $p.runner $p.bun
		$env:CODEPAGE_START_CP = "$cp"
		$env:CODEPAGE_EVIDENCE_DIR = $dir
		$env:CODEPAGE_ONLY_BUN = $p.onlyBun
		Write-Host "=== コードページ $cp / $($p.bun) / $($p.runner) ==="
		# bun test stops a test after 5 s by default, so the limit is raised. Bun cases are todo, so bun test skips them.
		# bun test は 1 件あたり既定 5 秒で打ち切るため、長くする。bun のケースは todo なので bun test では実行されない。
		if ($p.runner -eq 'node-test') { & node --test $test } else { & bun test --timeout 600000 $test }
		$code = $LASTEXITCODE
		$summary += "コードページ $cp / $($p.bun) / $($p.runner): 終了コード $code"
		if ($code -ne 0) { $failed = $true }
	}
}

Write-Host ''
$summary | ForEach-Object { Write-Host $_ }
Write-Host '結果は research/evidence_last/ にあります'
if ($args -notcontains 'nopause') { Read-Host '終わりました。Enter で閉じます' | Out-Null }
if ($failed) { exit 1 }
