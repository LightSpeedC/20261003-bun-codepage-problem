// tmp/results/<runner>.jsonl を読み、結果表の材料を画面に出す
// 使い方: node tools/50_run/summarize-results.ts [node|bun]
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const runner = process.argv[2] ?? 'node';
const rows: any[] = readFileSync(path.join(root, 'tmp/results', `${runner}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rts = ['bun', 'canary', 'node', 'deno'];
const cp = (a: { in: number; out: number }) => (a.in === 932 && a.out === 932 ? '✅932' : `❌${a.in}/${a.out}`);
const scr = (s: string) => ({ ok: '✅', garbled: '❌化け', missing: '❓無し' } as Record<string, string>)[s] ?? s;

console.log('## 版');
for (const r of rows.filter((r) => r.test === 'version')) console.log(`${r.rt}: ${r.version}`);

console.log('\n## T1 実行中 / 終了後 / 画面');
for (const r of rows.filter((r) => r.test === 'T1')) {
	console.log(`${r.rt}: 実行中=${r.during.map((d: any) => `${d.in}/${d.out}`).join(',')} 終了後=${cp(r.after)} 画面=${scr(r.screen)} sjis=${r.sjis ? '✅' : '❌'} chcp=${r.chcp}`);
}

console.log('\n## T2 バイト列 / 終了後（行: 送り手→受け手、列: cmd pwsh powershell）');
for (const w of rts) for (const rr of rts) {
	const cells = ['cmd', 'pwsh', 'powershell'].map((l) => {
		const r = rows.find((x) => x.test === 'T2' && x.launcher === l && x.w === w && x.r === rr);
		if (!r) return '⬜';
		const bytes = l === 'powershell' ? (r.bytes === r.baseline51 ? '✅=基準' : '❌≠基準') : r.bytesOk ? '✅' : '❌';
		return `${bytes} ${cp(r.after)}`;
	});
	console.log(`${w} → ${rr}: ${cells.join(' | ')}`);
}
console.log('5.1 の基準（node | node）:', rows.find((x) => x.test === 'T2' && x.launcher === 'powershell' && x.w === 'node' && x.r === 'node')?.bytes);

console.log('\n## T3 強制終了');
for (const r of rows.filter((r) => r.test === 'T3')) console.log(`${r.rt}: killed=${r.killed} 終了後=${cp(r.after)} sjis=${r.sjis ? '✅' : '❌'} chcp=${r.chcp}`);

console.log('\n## T4 隣のプロセス');
for (const r of rows.filter((r) => r.test === 'T4')) console.log(`${r.rt}: 画面=${scr(r.screen)} 終了後=${cp(r.after)} sjis=${r.sjis ? '✅' : '❌'} chcp=${r.chcp}`);

console.log('\n## T5（各セル: 回の順）');
const orders = [...new Set(rows.filter((r) => r.test === 'T5').map((r) => `${r.order}/${r.mode}`))];
for (const key of orders) {
	const [order, mode] = key.split('/');
	for (const rt of rts) {
		const runs = rows.filter((r) => r.test === 'T5' && r.order === order && r.mode === mode && r.rt === rt).sort((a, b) => a.rep - b.rep);
		if (!runs.length) continue;
		const out = runs.map((r) => (mode === 'console' ? scr(r.screen).slice(0, 1) : r.bytesOk ? '✅' : '❌')).join('');
		const aft = runs.map((r) => (r.after.in === 932 && r.after.out === 932 ? '✅' : '❌')).join('');
		const sj = runs.map((r) => (r.sjis ? '✅' : '❌')).join('');
		console.log(`${key} ${rt}: 出力=${out} 終了後932=${aft} sjis=${sj}`);
	}
}

console.log('\n## T5 bun の時系列（各組の 1 回目）');
for (const r of rows.filter((r) => r.test === 'T5' && r.rt === 'bun' && r.rep === 1)) console.log(`${r.order}/${r.mode}: ${r.timeline}`);
