// Group the runs of an asis-timeline.ts --trace series by the order of their code page calls.
// asis-timeline.ts --trace の回を、コードページの呼び出しの並びごとにまとめる。
// Usage / 使い方: node tools/50_run/summarize-trace.ts <series folder> [--show N]
// Each line: count, runs, and the calls of writer (W) and reader (R) in time order, as Get/Set + Out/In = value.
// 1 行ごとに: 回数・該当する回・送り手（W）と受け手（R）の呼び出しを時刻順に（Get/Set ＋ Out/In ＝ 値）。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dir = process.argv[2];
if (!dir) throw new Error('系列のフォルダを渡してください');
type Call = { utc: string; call: string; value: number; role: string };
const read = (f: string, role: string): Call[] =>
	existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), role })) : [];
const short = (c: Call) => `${c.role}:${c.call.replace('Console', '').replace('OutputCP', 'Out').replace('CP', 'In')}=${c.value}`;

const groups = new Map<string, number[]>();
const runs = readdirSync(dir).filter((d) => /^asis-\d+$/.test(d)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
for (const run of runs) {
	const calls = [...read(path.join(dir, run, 'trace-writer.ndjson'), 'W'), ...read(path.join(dir, run, 'trace-reader.ndjson'), 'R')]
		.sort((a, b) => a.utc.localeCompare(b.utc));
	const result = JSON.parse(readFileSync(path.join(dir, 'results.jsonl'), 'utf8').split('\n').filter(Boolean)[Number(run.slice(5)) - 1]);
	const key = `${result.after.in}/${result.after.out}  ${calls.map(short).join(' ')}`;
	groups.set(key, [...(groups.get(key) ?? []), Number(run.slice(5))]);
}
for (const [key, reps] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`${reps.length} 回 [${reps.join(',')}] 終了後 ${key}`);
}
