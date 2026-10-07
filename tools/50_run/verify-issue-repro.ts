// Run the reproduction command in the issue text, as is, in new consoles and print the screen.
// Issue の本文に載せる再現コマンドを、そのまま新しい窓で流して画面を出す。
// It checks that the output matches "Actual" and "Expected" in the issue text.
// 本文の「実際」「期待」と同じ表示になるかを確かめる。
// Usage: node tools/50_run/verify-issue-repro.ts [times] [starting code page]
// 使い方: node tools/50_run/verify-issue-repro.ts [回数] [開始コードページ]
// The runtimes are taken from _bin/ (run tools/10_setup/setup-runtimes.cmd first). Bun and canary are run with PATH switched.
// ランタイムは _bin/ のものを使う（先に tools/10_setup/setup-runtimes.cmd を流す）。bun と canary は PATH を入れ替えて流す。
import path from 'node:path';
import { ROOT, runInNewConsole } from '../../tests/harness/new-console.ts';

const times = Number(process.argv[2] ?? 3);
const startCp = Number(process.argv[3] ?? 932);
const bin = path.join(ROOT, '_bin');
const basePath = process.env.PATH ?? '';
const w = "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz'); setTimeout(() => {}, 2000)";
const r = "let d = ''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => setTimeout(() => process.stdout.write(d), 800))";
// label, folder put first on PATH, how to run an expression
// 表示名、PATH の先頭に置くフォルダ、式の流し方
const cases = [
	['bun', 'bun', 'bun -e'],
	['canary', 'bun-canary', 'bun -e'],
	['node', 'node', 'node -e'],
	['deno', 'deno', 'deno eval'],
] as const;
for (const [label, folder, evalCmd] of cases) {
	process.env.PATH = [folder, 'node'].map((f) => path.join(bin, f)).join(';') + ';' + basePath;
	for (let i = 1; i <= times; i++) {
		const res = runInNewConsole(`verify-${label}-${i}`, [
			`${evalCmd} "${w}" | (ping -n 2 127.0.0.1 >nul & ${evalCmd} "${r}")`,
			'chcp',
			'node "{fix}/probe.ts" --dir "{dir}" --tag after --screen "{dir}/screen.json"',
		], { startCp });
		console.log(`=== ${label} ${i}`);
		console.log(res.screen.filter(Boolean).join('\n'));
	}
}
