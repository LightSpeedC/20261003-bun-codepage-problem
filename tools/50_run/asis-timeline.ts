// Run the asis case of T5 (bun | bun, no fixed order, the same shape as bun#43660) many times with the PR #43662 build,
// while tests/fixtures/watch.ts logs, with UTC times, every process attached to the console and every code page change.
// T5 の asis（bun | bun、順番を決めない、bun#43660 と同じ形）を PR #43662 の版で何回も流す。
// その間 tests/fixtures/watch.ts が、窓につながる全プロセスの出入りと、コードページの変化を UTC の時刻で記録する。
// Usage / 使い方: node tools/50_run/asis-timeline.ts [--reps 30] [--bun bun-pr-43662] [--cp 932]
// Results go to research/evidence/cp<cp>/<bun>/asis-timeline/. Each run folder holds run.cmd, log.jsonl, screen.json and watch.ndjson.
// 結果は research/evidence/cp<cp>/<bun>/asis-timeline/ に置く。回ごとのフォルダに run.cmd ・ log.jsonl ・ screen.json ・ watch.ndjson。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from '../../tests/fixtures/console.ts';

const args = parseArgs();
const reps = Number(args.reps ?? 30);
const bunDir = args.bun ?? 'bun-pr-43662';
const cp = Number(args.cp ?? 932);
const root = path.resolve(import.meta.dirname, '../..');
const bin = path.join(root, '_bin');
const outDir = path.join(root, 'research', 'evidence', `cp${cp}`, bunDir, 'asis-timeline');

// Same runtimes as tools/40_test/run-tests.ps1: _bin/ first on PATH. The harness reads its settings when it is loaded.
// tools/40_test/run-tests.ps1 と同じく _bin/ を PATH の先頭に置く。ハーネスは読み込まれたときに設定を読む。
process.env.PATH = [bunDir, 'node'].map((d) => path.join(bin, d)).join(';') + ';' + process.env.PATH;
process.env.CODEPAGE_EVIDENCE_DIR = outDir;
process.env.CODEPAGE_START_CP = String(cp);
const { runInNewConsole, tail } = await import('../../tests/harness/new-console.ts');
const { after, neighborOk, screenVerdict } = await import('../../tests/harness/judge.ts');

const version = (exe: string, a: string) => execFileSync(path.join(bin, exe), [a], { encoding: 'utf8' }).trim();
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'environment.json'), JSON.stringify({
	runAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
	codePage: cp,
	runner: 'tools/50_run/asis-timeline.ts',
	tools: [
		{ name: 'bun', folder: `_bin/${bunDir}`, version: version(`${bunDir}/bun.exe`, '--revision') },
		{ name: 'node', folder: '_bin/node', version: version('node/node.exe', '-v') },
	],
}, null, '\t') + '\n');

// The watcher starts first and the batch waits until it is watching; at the end the batch stops it and waits until it has finished.
// 見張り役を先に起こし、見張りが始まるまで待つ。最後に止めて、終わるまで待つ。
const lines = [
	'start "" /b node "{fix}/watch.ts" --out "{dir}/watch.ndjson" --ready "{dir}/ready.flag" --stop "{dir}/stop.flag" --done "{dir}/done.flag"',
	':ready',
	'if not exist "{dir}\\ready.flag" goto ready',
	'node "{fix}/probe.ts" --dir "{dir}" --tag before',
	`bun -e "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz')" | bun -e "process.stdin.pipe(process.stdout)"`,
	...tail(cp),
	'type nul > "{dir}\\stop.flag"',
	':done',
	'if not exist "{dir}\\done.flag" goto done',
	'del "{dir}\\ready.flag" "{dir}\\stop.flag" "{dir}\\done.flag"',
];

const results = [];
for (let i = 1; i <= reps; i++) {
	const r = runInNewConsole(`asis-${i}`, lines);
	const watch = readFileSync(path.join(r.dir, 'watch.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
	const item = { rep: i, after: after(r), screen: screenVerdict(r), neighbor: neighborOk(r), watchEnd: watch.at(-1) };
	results.push(item);
	console.log(`${i} 回目: 終了後 ${item.after.in}/${item.after.out} 画面 ${item.screen} 隣 ${item.neighbor ? '正しい' : '化けた'}`);
}
writeFileSync(path.join(outDir, 'results.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n');
const left = results.filter((r) => r.after.out !== cp || r.after.in !== cp).map((r) => r.rep);
console.log(`${reps} 回中 ${left.length} 回で、開始のコードページに戻らなかった: ${left.join(', ') || 'なし'}`);
