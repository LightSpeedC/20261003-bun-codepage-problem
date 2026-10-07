// Read the results of one code page from an evidence folder and print the material for the result tables.
// 証拠のフォルダから 1 つのコードページの結果を読み、結果表の材料を画面に出す。
// Usage: node tools/50_run/summarize-results.ts [code page] [evidence folder]
// 使い方: node tools/50_run/summarize-results.ts [コードページ] [証拠のフォルダ]
// The default folder is research/evidence_last/. Rows from the canary pass are shown as "canary".
// 既定のフォルダは research/evidence_last/。canary の回の行は "canary" として出す。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const cpArg = Number(process.argv[2] ?? 932);
const evidence = path.resolve(process.argv[3] ?? path.join(root, 'research/evidence_last'));

function read(rel: string, asCanary: boolean): any[] {
	const file = path.join(evidence, `cp${cpArg}`, rel, 'results.jsonl');
	if (!existsSync(file)) return [];
	const rename = (v: unknown) => (asCanary && v === 'bun' ? 'canary' : v);
	return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
		const r = JSON.parse(l);
		return { ...r, rt: rename(r.rt), w: rename(r.w), r: rename(r.r) };
	});
}

const rows = [...read('bun/node-test', false), ...read('bun-canary/node-test', true)];
const rts = ['bun', 'canary', 'node', 'deno'];
const cp = (a: { in: number; out: number }) => (a.in === cpArg && a.out === cpArg ? `✅${cpArg}` : `❌${a.in}/${a.out}`);
const scr = (s: string) => ({ ok: '✅', garbled: '❌化け', missing: '❓無し' } as Record<string, string>)[s] ?? s;
const ok = (b: boolean) => (b ? '✅' : '❌');

console.log(`# コードページ ${cpArg}`);
for (const rel of ['bun/node-test', 'bun-canary/node-test', 'bun/bun-test']) {
	const env = path.join(evidence, `cp${cpArg}`, rel, 'environment.json');
	if (existsSync(env)) {
		const e = JSON.parse(readFileSync(env, 'utf8'));
		console.log(`${rel}: ${e.runAt} ${e.tools.map((t: any) => `${t.name}=${t.version}`).join(' ')}`);
	}
}

console.log('\n## T1 実行中 / 終了後 / 画面');
for (const r of rows.filter((r) => r.test === 'T1')) {
	console.log(`${r.rt}: 実行中=${r.during.map((d: any) => `${d.in}/${d.out}`).join(',')} 終了後=${cp(r.after)} 画面=${scr(r.screen)} 隣=${ok(r.neighbor)} chcp=${r.chcp}`);
}

console.log('\n## T2 バイト列 / 終了後（行: 送り手→受け手、列: cmd pwsh powershell）');
for (const w of rts) for (const rr of rts) {
	if ((w === 'canary' && rr === 'bun') || (w === 'bun' && rr === 'canary')) continue;
	const cells = ['cmd', 'pwsh', 'powershell'].map((l) => {
		const r = rows.find((x) => x.test === 'T2' && x.launcher === l && x.w === w && x.r === rr);
		if (!r) return '⬜';
		const bytes = l === 'powershell' ? (r.bytes === r.baseline51 ? '✅=基準' : '❌≠基準') : ok(r.bytesOk);
		return `${bytes} ${cp(r.after)}`;
	});
	if (cells.some((c) => c !== '⬜')) console.log(`${w} → ${rr}: ${cells.join(' | ')}`);
}

console.log('\n## T3 強制終了');
for (const r of rows.filter((r) => r.test === 'T3')) console.log(`${r.rt}: killed=${r.killed} 終了後=${cp(r.after)} 隣=${ok(r.neighbor)} chcp=${r.chcp}`);

console.log('\n## T4 隣のプロセス');
for (const r of rows.filter((r) => r.test === 'T4')) console.log(`${r.rt}: 画面=${scr(r.screen)} 終了後=${cp(r.after)} 隣=${ok(r.neighbor)} chcp=${r.chcp}`);

console.log('\n## T5（各セル: 回の順）');
const keys = [...new Set(rows.filter((r) => r.test === 'T5').map((r) => `${r.order}/${r.mode}`))];
for (const key of keys) {
	const [order, mode] = key.split('/');
	for (const rt of rts) {
		const runs = rows.filter((r) => r.test === 'T5' && r.order === order && r.mode === mode && r.rt === rt).sort((a, b) => a.rep - b.rep);
		if (!runs.length) continue;
		const out = runs.map((r) => (mode === 'console' ? scr(r.screen).slice(0, 1) : ok(r.bytesOk))).join('');
		const aft = runs.map((r) => ok(r.after.in === cpArg && r.after.out === cpArg)).join('');
		const nb = runs.map((r) => ok(r.neighbor)).join('');
		console.log(`${key} ${rt}: 出力=${out} 終了後=${aft} 隣=${nb}`);
	}
}
