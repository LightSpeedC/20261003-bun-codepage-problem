// Run the asis case of T5 (bun | bun, no fixed order, the same shape as bun#43660) many times with the PR #43662 build,
// while tests/fixtures/watch.ts logs, with UTC times, every process attached to the console and every code page change.
// T5 の asis（bun | bun、順番を決めない、bun#43660 と同じ形）を PR #43662 の版で何回も流す。
// その間 tests/fixtures/watch.ts が、窓につながる全プロセスの出入りと、コードページの変化を UTC の時刻で記録する。
// Usage / 使い方: node tools/50_run/asis-timeline.ts [--reps 30] [--bun bun-pr-43662] [--cp 932] [--name asis-timeline] [--via cmd]
// Results go to research/evidence/cp<cp>/<bun>/<name>/. Each run folder holds run.cmd, log.jsonl, screen.json and watch.ndjson.
// 結果は research/evidence/cp<cp>/<bun>/<name>/ に置く。回ごとのフォルダに run.cmd ・ log.jsonl ・ screen.json ・ watch.ndjson。
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
// --name picks the folder, so a new series does not overwrite the one the documents already cite.
// --name でフォルダを選ぶ。新しい回が、資料が引いている回を上書きしないようにする。
const outDir = path.join(root, 'research', 'evidence', `cp${cp}`, bunDir, args.name ?? 'asis-timeline');

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
	via: args.via ?? 'cmd',
	tools: [
		{ name: 'bun', folder: `_bin/${bunDir}`, version: version(`${bunDir}/bun.exe`, '--revision') },
		{ name: 'node', folder: '_bin/node', version: version('node/node.exe', '-v') },
	],
}, null, '\t') + '\n');

// --trace runs each bun under cdb (WinDbg) and records every SetConsoleCP / SetConsoleOutputCP call and every
// GetConsoleCP / GetConsoleOutputCP return value, with the call site, into trace-writer.ndjson and trace-reader.ndjson.
// The watcher only sees the code page change; this shows which call made it and what value was saved beforehand.
// The debugger slows bun down, so how often the race is lost differs from a run without it.
// The debugger prints its banner before the script hides its output, so in the writer's case that banner goes into the pipe.
// --trace は bun を 1 本ずつ cdb（WinDbg）の下で動かし、SetConsoleCP / SetConsoleOutputCP の呼び出しと、
// GetConsoleCP / GetConsoleOutputCP の戻り値を、呼び出し元の番地とともに trace-writer.ndjson ・ trace-reader.ndjson に残す。
// 見張り役に見えるのはコードページの変化だけ。これで、どの呼び出しが変えたか、その前に何を控えたかが分かる。
// デバッガで bun が遅くなるので、競合に負ける割合は、デバッガなしの回とは変わる。
// デバッガはスクリプトが出力を隠す前に名乗りを出すので、送り手の分はその名乗りがパイプに入る。
const trace = args.trace !== undefined;
let rep = 0;
const cdbDir = trace ? findCdb() : '';
if (trace) process.env.PATH = cdbDir + ';' + process.env.PATH;

function findCdb(): string {
	const loc = execFileSync('powershell', ['-NoProfile', '-Command', '(Get-AppxPackage Microsoft.WinDbg).InstallLocation'], { encoding: 'utf8' }).trim();
	if (!loc) throw new Error('cdb がありません。winget install --id Microsoft.WinDbg -e で入れてください');
	return path.join(loc, 'amd64');
}

// One debugger script per run and side, in tmp/ (not committed): cdb needs absolute paths inside it, and the script
// is fully described by this function. run.cmd refers to it relative to the project root, where the console starts.
// 回と側ごとにデバッガスクリプトを 1 つ、tmp/（commit しない）に書く。cdb は中のパスを絶対パスでしか読めず、
// 中身はこの関数がすべて決めるため。run.cmd からは、窓が始まるプロジェクトの root からの相対で指す。
function cdbScript(role: 'writer' | 'reader'): string {
	const rel = (p: string) => path.relative(root, p).replaceAll('\\', '/');
	const abs = (p: string) => p.replaceAll('\\', '/');
	const script = path.join(root, 'tmp', 'cdb', `asis-${rep}-${role}.txt`);
	const log = (call: string, value: string, caller: string) => `dx @$scriptContents.log("${call}", ${value}, (${caller} >> 32), (${caller} & 0xffffffff))`;
	const esc = (s: string) => s.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
	mkdirSync(path.dirname(script), { recursive: true });
	writeFileSync(script, [
		'.outmask- 0xffffffff',
		`.scriptload ${path.join(root, 'tools', '50_run', 'cdb-trace.js')}`,
		`dx @$scriptContents.open("${abs(path.join(outDir, `asis-${rep}`, `trace-${role}.ndjson`))}")`,
		...['SetConsoleOutputCP', 'SetConsoleCP'].map((f) => `bp kernelbase!${f} "${esc(log(f, '@ecx', '@$ra'))}; gc"`),
		// A Get call is logged on return: a one-shot breakpoint at the return address reads eax there.
		// Get の呼び出しは戻ったところで記録する。戻り先に 1 回きりのブレークポイントを置き、そこで eax を読む。
		...['GetConsoleOutputCP', 'GetConsoleCP'].map((f) => `bp kernelbase!${f} "${esc(`bp /1 @$ra "${esc(log(f, '@eax', '@$ip'))}; gc"`)}; gc"`),
		'g',
	].join('\n') + '\n');
	return rel(script);
}

// --via picks the shell that builds the pipe: cmd (default), powershell (Windows PowerShell 5.1) or pwsh (7).
// The results document says 65001 was not left when 5.1 sits in between; this shows why on the same timeline.
// --via でパイプを組むシェルを選ぶ: cmd（既定）・powershell（Windows PowerShell 5.1）・pwsh（7）。
// 結果資料には、5.1 が間に入ると 65001 が残らなかったとある。その理由を同じ時系列で見る。
function pipeLine(): string {
	const pipe = trace
		? `cdb -G -cf "${cdbScript('writer')}" bun.exe -e "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz')" | cdb -G -cf "${cdbScript('reader')}" bun.exe -e "process.stdin.pipe(process.stdout)"`
		: `bun -e "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz')" | bun -e "process.stdin.pipe(process.stdout)"`;
	const via = args.via ?? 'cmd';
	if (via === 'cmd') return pipe;
	if (trace) throw new Error('--trace は --via cmd とだけ組み合わせる');
	if (via !== 'powershell' && via !== 'pwsh') throw new Error(`--via は cmd ・ powershell ・ pwsh のどれか: ${via}`);
	// Inside PowerShell the JS strings need ' kept, so the command goes in single quotes with '' for each '.
	// PowerShell の中では JS の ' を残すため、コマンド全体を ' で囲み、中の ' は '' にする。
	const psPipe = `bun -e 'console.log(''abc \\u6771\\u4eac\\u5927\\u962a xyz'')' | bun -e 'process.stdin.pipe(process.stdout)'`;
	return `${via} -NoProfile -Command "${psPipe}"`;
}

// The watcher starts first and the batch waits until it is watching; at the end the batch stops it and waits until it has finished.
// 見張り役を先に起こし、見張りが始まるまで待つ。最後に止めて、終わるまで待つ。
const lines = () => [
	'start "" /b node "{fix}/watch.ts" --out "{dir}/watch.ndjson" --ready "{dir}/ready.flag" --stop "{dir}/stop.flag" --done "{dir}/done.flag"',
	':ready',
	'if not exist "{dir}\\ready.flag" goto ready',
	'node "{fix}/probe.ts" --dir "{dir}" --tag before',
	pipeLine(),
	...tail(cp),
	'type nul > "{dir}\\stop.flag"',
	':done',
	'if not exist "{dir}\\done.flag" goto done',
	'del "{dir}\\ready.flag" "{dir}\\stop.flag" "{dir}\\done.flag"',
];

const results = [];
for (let i = 1; i <= reps; i++) {
	rep = i;
	const r = runInNewConsole(`asis-${i}`, lines());
	const watch = readFileSync(path.join(r.dir, 'watch.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
	const item = { rep: i, after: after(r), screen: screenVerdict(r), neighbor: neighborOk(r), watchEnd: watch.at(-1) };
	results.push(item);
	console.log(`${i} 回目: 終了後 ${item.after.in}/${item.after.out} 画面 ${item.screen} 隣 ${item.neighbor ? '正しい' : '化けた'}`);
}
writeFileSync(path.join(outDir, 'results.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n');
const left = results.filter((r) => r.after.out !== cp || r.after.in !== cp).map((r) => r.rep);
console.log(`${reps} 回中 ${left.length} 回で、開始のコードページに戻らなかった: ${left.join(', ') || 'なし'}`);
