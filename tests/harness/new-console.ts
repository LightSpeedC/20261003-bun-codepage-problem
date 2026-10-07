// 新しいコンソール（conhost.exe）を起こし、その中でバッチを流して、終わるまで待つ
// 新しい窓は開いた直後の cmd と同じくコードページ 932 で始まる。この仕組み自身はコードページに触らない
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..').replaceAll('\\', '/');
export const FIX = `${ROOT}/tests/fixtures`;
export const RUN_DIR = `${ROOT}/tmp/run`;

function where(name: string): string | undefined {
	const r = spawnSync('where.exe', [name], { encoding: 'utf8', timeout: 10000 });
	return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim().replaceAll('\\', '/') : undefined;
}

function must(p: string | undefined, name: string): string {
	if (!p || !existsSync(p)) throw new Error(`${name} が見つからない`);
	return p;
}

const denoPath = where('deno') ?? `${(process.env.USERPROFILE ?? '').replaceAll('\\', '/')}/.deno/bin/deno.exe`;

// 調べるランタイム。cmd はバッチに書くときの呼び出し方
export type RuntimeName = 'bun' | 'canary' | 'node' | 'deno';
// cmd はバッチ（cmd）から呼ぶときの書き方、ps は PowerShell の -Command の中から呼ぶときの書き方
export const RUNTIMES: Record<RuntimeName, { exe: string; cmd: string; ps: string; versionArgs: string[] }> = {
	bun: { exe: must(where('bun'), 'bun'), cmd: '', ps: '', versionArgs: ['--revision'] },
	canary: { exe: must(`${ROOT}/_bin/bun-canary/bun-windows-x64/bun.exe`, 'bun canary'), cmd: '', ps: '', versionArgs: ['--revision'] },
	node: { exe: must(where('node'), 'node'), cmd: '', ps: '', versionArgs: ['--version'] },
	deno: { exe: must(denoPath, 'deno'), cmd: '', ps: '', versionArgs: ['--version'] },
};
for (const [name, rt] of Object.entries(RUNTIMES)) {
	const extra = name === 'deno' ? ' run -A --quiet' : '';
	rt.cmd = `"${rt.exe}"${extra}`;
	rt.ps = `& '${rt.exe}'${extra}`;
}
export const RUNTIME_NAMES = Object.keys(RUNTIMES) as RuntimeName[];
export const NODE = RUNTIMES.node.cmd;

// T2 で使う起動元のシェル
export const SHELLS = {
	pwsh: must(where('pwsh'), 'pwsh'),
	powershell: must(where('powershell'), 'powershell'),
};

export function version(name: RuntimeName): string {
	const r = spawnSync(RUNTIMES[name].exe, RUNTIMES[name].versionArgs, { encoding: 'utf8', timeout: 10000 });
	return r.stdout.split(/\r?\n/)[0].trim();
}

// cmd の内部コマンドに渡すパスは \ にする
export const win = (p: string) => p.replaceAll('/', '\\');

export type LogLine = { t: number; tag: string; rt: string; pid: number; event: string; in: number; out: number; [k: string]: unknown };

export type CaseResult = {
	dir: string;
	logs: Record<string, LogLine[]>;
	screen: string[];
	file?: Uint8Array;
};

// lines をバッチにして新しい窓で流す
// lines の中で使える置き換え: {dir} ケースの置き場、{dirwin} 同じく \ 区切り、{fix} fixtures、{node} node
export function runInNewConsole(name: string, lines: string[], timeoutMs = 60000): CaseResult {
	const dir = `${RUN_DIR}/${name}`;
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const body = ['@echo off', ...lines].join('\r\n')
		.replaceAll('{dirwin}', win(dir)).replaceAll('{dir}', dir).replaceAll('{fix}', FIX).replaceAll('{node}', NODE) + '\r\n';
	// バッチは ASCII だけにする。日本語を入れると、bun が変えたコードページで cmd が読み違え、測りたいものと混ざる
	if (/[^\x00-\x7f]/.test(body)) throw new Error(`バッチに ASCII 以外が入っている: ${name}`);
	const bat = `${dir}/run.cmd`;
	writeFileSync(bat, body);
	const ps = `Start-Process -FilePath conhost.exe -ArgumentList 'cmd /c "${win(bat)}"' -Wait -WindowStyle Minimized`;
	const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { timeout: timeoutMs, encoding: 'utf8' });
	if (r.error) throw r.error;
	if (r.status !== 0) throw new Error(`新しい窓の起動に失敗した: ${r.stderr}`);
	return collect(dir);
}

function collect(dir: string): CaseResult {
	const logs: Record<string, LogLine[]> = {};
	for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
		logs[f.replace(/\.jsonl$/, '')] = readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
	}
	const screenFile = `${dir}/screen.json`;
	const screen: string[] = existsSync(screenFile) ? JSON.parse(readFileSync(screenFile, 'utf8')) : [];
	const outFile = `${dir}/out.bin`;
	const file = existsSync(outFile) ? new Uint8Array(readFileSync(outFile)) : undefined;
	return { dir, logs, screen, file };
}

// 窓の最後に流す共通の後始末。chcp の表示と、SJIS の cmd の表示を画面に残し、画面を読み取る
export const TAIL = [
	'echo --- tail ---',
	'chcp',
	'call "{fixwin}\\sjis-echo.cmd"',
	'{node} "{fix}/probe.ts" --dir "{dir}" --tag after --screen "{dir}/screen.json"',
].map((l) => l.replaceAll('{fixwin}', win(FIX)));
