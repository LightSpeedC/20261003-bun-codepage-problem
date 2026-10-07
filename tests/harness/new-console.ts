// Create a new console with conhost.exe, run a batch file in it, and wait until it ends.
// conhost.exe で新しいコンソールを起こし、その中でバッチを流して、終わるまで待つ。
// Each case gets its own console, so changing its code page with chcp affects nothing else.
// ケースごとに専用の窓を起こすので、その窓で chcp してもほかには影響しない。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..').replaceAll('\\', '/');
export const FIX = `${ROOT}/tests/fixtures`;

// Settings given by tools/40_test/run-tests.ps1. Without them, a case runs at 932 and its files go to tmp/run.
// tools/40_test/run-tests.ps1 から渡す設定。無ければ 932 で流し、ケースのファイルは tmp/run に置く。
export const EVIDENCE_DIR = (process.env.CODEPAGE_EVIDENCE_DIR ?? `${ROOT}/tmp/run`).replaceAll('\\', '/');
export const START_CP = Number(process.env.CODEPAGE_START_CP ?? 932);
export const ONLY_BUN = process.env.CODEPAGE_ONLY_BUN === '1';

// Runtimes are called by name and resolved through PATH, which run-tests.ps1 points at _bin/.
// ランタイムは名前だけで呼び、PATH で探させる。PATH は run-tests.ps1 が _bin/ に向ける。
// cmd: how to call it from a batch file / ps: how to call it inside PowerShell -Command
// cmd: バッチから呼ぶときの書き方 / ps: PowerShell の -Command の中から呼ぶときの書き方
export type RuntimeName = 'bun' | 'node' | 'deno';
export const RUNTIMES: Record<RuntimeName, { cmd: string; ps: string; evalCmd: string }> = {
	bun: { cmd: 'bun', ps: '& bun', evalCmd: 'bun -e' },
	node: { cmd: 'node', ps: '& node', evalCmd: 'node -e' },
	deno: { cmd: 'deno run -A --quiet', ps: '& deno run -A --quiet', evalCmd: 'deno eval' },
};
export const RUNTIME_NAMES = Object.keys(RUNTIMES) as RuntimeName[];

// Shells used as launchers in T2. Also resolved through PATH.
// T2 で起動元にするシェル。これも PATH で探させる。
export const SHELLS = { pwsh: 'pwsh', powershell: 'powershell' } as const;

// Paths given to cmd built-in commands use backslashes.
// cmd の内部コマンドに渡すパスは \ にする。
export const win = (p: string) => p.replaceAll('/', '\\');

// One log line. t is milliseconds from the first line of the case; no date and no pid, so two runs can be diffed.
// ログの 1 行。t はケースの最初の行からの ms。日時と pid は持たないので、2 回の結果を diff で比べられる。
export type LogLine = { t: number; tag: string; rt: string; event: string; in: number; out: number; [k: string]: unknown };

export type CaseResult = {
	dir: string;
	logs: Record<string, LogLine[]>;
	screen: string[];
	file?: Uint8Array;
};

// Write lines as a batch file and run it in a new console.
// lines をバッチにして新しい窓で流す。
// Placeholders: {dir} the case folder, {fix} tests/fixtures. Both become paths relative to %~dp0, so the batch file holds no absolute path.
// 置き換え: {dir} ケースの置き場、{fix} tests/fixtures。どちらも %~dp0 からの相対になり、バッチに絶対パスは入らない。
export function runInNewConsole(name: string, lines: string[], opts: { startCp?: number; timeoutMs?: number } = {}): CaseResult {
	const startCp = opts.startCp ?? START_CP;
	const dir = `${EVIDENCE_DIR}/${name}`;
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const relFix = win(path.relative(dir, FIX));
	const body = [
		'@echo off',
		'rem Dedicated console for this case only: set its starting code page.',
		`chcp ${startCp} >nul`,
		...lines,
	].join('\r\n')
		// "%~dp0." rather than "%~dp0": a trailing backslash before a closing quote would escape the quote.
		// "%~dp0" ではなく "%~dp0." にする。閉じる引用符の直前の \ は引用符をエスケープしてしまう。
		.replaceAll('{dir}', '%~dp0.').replaceAll('{fix}', `%~dp0${relFix}`) + '\r\n';
	// The batch file must be ASCII only. Non-ASCII text would be misread by cmd once Bun changes the code page, mixing that into what is measured.
	// バッチは ASCII だけにする。日本語を入れると、bun が変えたコードページで cmd が読み違え、測りたいものと混ざる。
	if (/[^\x00-\x7f]/.test(body)) throw new Error(`バッチに ASCII 以外が入っている: ${name}`);
	const bat = `${dir}/run.cmd`;
	writeFileSync(bat, body);
	const ps = `Start-Process -FilePath conhost.exe -ArgumentList 'cmd /c "${win(bat)}"' -Wait -WindowStyle Minimized`;
	const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { timeout: opts.timeoutMs ?? 60000, encoding: 'utf8' });
	if (r.error) throw r.error;
	if (r.status !== 0) throw new Error(`新しい窓の起動に失敗した: ${r.stderr}`);
	return collect(dir);
}

// Merge the per-process logs into one log.jsonl with relative times, then read the screen and the received bytes.
// プロセスごとのログを、相対時刻の log.jsonl 1 本にまとめ、画面の読み取りと受け取ったバイト列を読む。
function collect(dir: string): CaseResult {
	const raw: (LogLine & { pid?: number })[] = [];
	for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl') && n !== 'log.jsonl')) {
		for (const l of readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean)) raw.push(JSON.parse(l));
		rmSync(`${dir}/${f}`);
	}
	// pid.txt (T3) holds a pid that changes on every run, so it is not kept.
	// pid.txt（T3）は毎回変わる pid を持つので残さない。
	rmSync(`${dir}/pid.txt`, { force: true });
	raw.sort((a, b) => a.t - b.t);
	const t0 = raw[0]?.t ?? 0;
	const merged: LogLine[] = raw.map(({ pid: _pid, ...l }) => ({ ...l, t: l.t - t0 }));
	writeFileSync(`${dir}/log.jsonl`, merged.map((l) => JSON.stringify(l)).join('\n') + (merged.length ? '\n' : ''));
	const logs: Record<string, LogLine[]> = {};
	for (const l of merged) (logs[l.tag] ??= []).push(l);
	const screenFile = `${dir}/screen.json`;
	const screen: string[] = existsSync(screenFile) ? JSON.parse(readFileSync(screenFile, 'utf8')) : [];
	const outFile = `${dir}/out.bin`;
	const file = existsSync(outFile) ? new Uint8Array(readFileSync(outFile)) : undefined;
	return { dir, logs, screen, file };
}

// Common tail of every case: leave chcp output and the neighbor process output on the screen, then read the screen.
// 各ケースの最後に流す共通の後始末。chcp の表示と、隣のプロセス役の表示を画面に残し、画面を読み取る。
export function tail(startCp = START_CP): string[] {
	return [
		'echo --- tail ---',
		'chcp',
		`call "{fix}\\neighbor-${startCp}.cmd"`,
		'node "{fix}/probe.ts" --dir "{dir}" --tag after --screen "{dir}/screen.json"',
	];
}
