# Setup phase: download pinned runtimes from their official sources into _bin/, then run npm ci.
# 準備フェーズ: 版を決めたランタイムを公式の配布元から _bin/ に取り、npm ci を流す。
# Anything already in place is kept. Pass "force" to download everything again.
# すでに置いてあるものは取り直さない。引数 force を付けると取り直す。
# Pass "nopause" to skip the final pause.
# 引数 nopause を付けると最後に止まらない。
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Windows PowerShell 5.1 needs TLS 1.2 enabled explicitly to reach GitHub.
# Windows PowerShell 5.1 は、GitHub に繋ぐために TLS 1.2 を明示する。
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$bin = Join-Path $root '_bin'
$force = $args -contains 'force'

# name: folder under _bin / exe: file that marks the runtime as installed / url: official zip / inner: folder inside the zip ('' = root)
# name: _bin の下のフォルダ / exe: 置き済みの目印 / url: 公式の zip / inner: zip の中のフォルダ（'' は直下）
$runtimes = @(
	@{ name = 'bun';        exe = 'bun.exe';  url = 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-windows-x64.zip'; inner = 'bun-windows-x64' },
	@{ name = 'bun-canary'; exe = 'bun.exe';  url = 'https://github.com/oven-sh/bun/releases/download/canary/bun-windows-x64.zip';      inner = 'bun-windows-x64' },
	@{ name = 'node';       exe = 'node.exe'; url = 'https://nodejs.org/dist/v26.10.0/node-v26.10.0-win-x64.zip';                      inner = 'node-v26.10.0-win-x64' },
	@{ name = 'deno';       exe = 'deno.exe'; url = 'https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-pc-windows-msvc.zip'; inner = '' },
	@{ name = 'pwsh';       exe = 'pwsh.exe'; url = 'https://github.com/PowerShell/PowerShell/releases/download/v7.6.6/PowerShell-7.6.6-win-x64.zip'; inner = '' }
)

New-Item -ItemType Directory -Force -Path $bin | Out-Null
foreach ($rt in $runtimes) {
	$dest = Join-Path $bin $rt.name
	if ((Test-Path -LiteralPath (Join-Path $dest $rt.exe)) -and -not $force) {
		Write-Host "置き済み: _bin/$($rt.name)"
		continue
	}
	Write-Host "取得中: _bin/$($rt.name)"
	$zip = Join-Path $bin "$($rt.name).zip"
	$tmp = Join-Path $bin "$($rt.name).tmp"
	Invoke-WebRequest -Uri $rt.url -OutFile $zip -UseBasicParsing
	if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
	Expand-Archive -LiteralPath $zip -DestinationPath $tmp
	if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
	$src = if ($rt.inner) { Join-Path $tmp $rt.inner } else { $tmp }
	Move-Item -LiteralPath $src -Destination $dest
	if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
	Remove-Item -LiteralPath $zip -Force
	if (-not (Test-Path -LiteralPath (Join-Path $dest $rt.exe))) { throw "_bin/$($rt.name)/$($rt.exe) がありません" }
}

# Install koffi and the type checker with the downloaded Node.js, not the one on this PC.
# koffi と型チェックの道具を、この PC の node ではなく、取った node で入れる。
$env:PATH = (Join-Path $bin 'node') + ';' + $env:PATH
Push-Location -LiteralPath $root
try {
	& (Join-Path $bin 'node/npm.cmd') ci --no-audit --no-fund
	if ($LASTEXITCODE -ne 0) { throw "npm ci が失敗しました（終了コード $LASTEXITCODE）" }
} finally {
	Pop-Location
}

# Bun pull requests to compare with: the Windows x64 build from Bun's CI, through Node.js (see fetch-bun-pr.ts).
# 比べる bun の PR: bun の CI の Windows x64 のビルドを、Node.js を通して取る（fetch-bun-pr.ts を参照）。
# PR #43662 writes to the console with WriteConsoleW and restores only a code page it changed.
# PR #43662 は、画面への出力を WriteConsoleW にし、自分が変えたコードページだけを戻す。
foreach ($pr in @('43662')) {
	$dest = Join-Path $bin "bun-pr-$pr"
	if ((Test-Path -LiteralPath (Join-Path $dest 'bun.exe')) -and -not $force) {
		Write-Host "置き済み: _bin/bun-pr-$pr"
		continue
	}
	Write-Host "取得中: _bin/bun-pr-$pr"
	$zip = Join-Path $bin "bun-pr-$pr.zip"
	$tmp = Join-Path $bin "bun-pr-$pr.tmp"
	& (Join-Path $bin 'node/node.exe') (Join-Path $root 'tools/10_setup/fetch-bun-pr.ts') $pr $zip
	if ($LASTEXITCODE -ne 0) { throw "PR #$pr のビルドを取れませんでした（終了コード $LASTEXITCODE）" }
	if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
	Expand-Archive -LiteralPath $zip -DestinationPath $tmp
	if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
	Move-Item -LiteralPath (Join-Path $tmp 'bun-windows-x64') -Destination $dest
	Remove-Item -LiteralPath $tmp -Recurse -Force
	Remove-Item -LiteralPath $zip -Force
	if (-not (Test-Path -LiteralPath (Join-Path $dest 'bun.exe'))) { throw "_bin/bun-pr-$pr/bun.exe がありません" }
}

Write-Host '準備が終わりました'
if ($args -notcontains 'nopause') { Read-Host '終わりました。Enter で閉じます' | Out-Null }
