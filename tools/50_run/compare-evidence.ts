// Compare research/evidence_last/ (the latest run) with research/evidence/ (the committed baseline).
// research/evidence_last/（最新の実行）と research/evidence/（commit した基準）を比べる。
// Only verdicts are compared (screen, code page after, neighbor, bytes, chcp output, killed). Timings are ignored.
// 比べるのは判定だけ（画面 ・ 終了後のコードページ ・ 隣のプロセス ・ バイト列 ・ chcp の表示 ・ 強制終了）。時刻は比べない。
// Usage: node tools/50_run/compare-evidence.ts [latest folder] [baseline folder]
// 使い方: node tools/50_run/compare-evidence.ts [最新のフォルダ] [基準のフォルダ]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const latest = path.resolve(process.argv[2] ?? path.join(root, 'research/evidence_last'));
const baseline = path.resolve(process.argv[3] ?? path.join(root, 'research/evidence'));

// Every results.jsonl under a folder, keyed by its path relative to that folder.
// フォルダの下の results.jsonl を、そのフォルダからの相対パスで集める。
function findResults(dir: string, rel = ''): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		const r = rel ? `${rel}/${name}` : name;
		if (statSync(full).isDirectory()) return findResults(full, r);
		return name === 'results.jsonl' ? [r] : [];
	});
}

type Row = Record<string, any>;
const keyOf = (r: Row) => ['test', 'launcher', 'rt', 'w', 'r', 'order', 'mode', 'rep'].map((k) => r[k] ?? '').join('|');
const verdictOf = (r: Row) =>
	JSON.stringify({ screen: r.screen, after: r.after, neighbor: r.neighbor, bytesOk: r.bytesOk, bytes: r.bytes, chcp: r.chcp, killed: r.killed, during: r.during });

function load(file: string): Map<string, Row> {
	const rows = new Map<string, Row>();
	for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
		const r = JSON.parse(line);
		rows.set(keyOf(r), r);
	}
	return rows;
}

const files = [...new Set([...findResults(latest), ...findResults(baseline)])].sort();
let differences = 0;
for (const rel of files) {
	const a = path.join(latest, rel);
	const b = path.join(baseline, rel);
	if (!existsSync(a) || !existsSync(b)) {
		console.log(`${existsSync(a) ? '基準に無い' : '最新に無い'}: ${rel}`);
		differences++;
		continue;
	}
	const ra = load(a);
	const rb = load(b);
	for (const key of [...new Set([...ra.keys(), ...rb.keys()])].sort()) {
		const va = ra.has(key) ? verdictOf(ra.get(key)!) : '(なし)';
		const vb = rb.has(key) ? verdictOf(rb.get(key)!) : '(なし)';
		if (va !== vb) {
			console.log(`違い: ${rel} ${key}\n  最新: ${va}\n  基準: ${vb}`);
			differences++;
		}
	}
}
console.log(differences === 0 ? `✅ 違いなし（${files.length} ファイル）` : `❌ 違い ${differences} 件`);
process.exit(differences === 0 ? 0 : 1);
