// Tests that measure the harm of changing the console code page (T1 to T5 in the plan; T6 compares the Bun and canary passes).
// コンソールのコードページを変える害を実測するテスト（計画の T1〜T5。T6 は bun と canary の回を比べる）。
// The expectations are the expected behavior: an implementation that never changes the code page. Bun changes it, so its cases fail until it is fixed.
// 期待値は「あるべき姿」（コードページを変えない実装）。bun はコードページを変えるため、直るまで失敗しうる。
// Bun failures are evidence for the issue, so they are marked todo: recorded, without stopping the suite. Node.js and Deno are judged strictly.
// bun の失敗は Issue の証拠なので todo 扱いにし、記録しながら全体は止めない。node と deno は厳密に判定する。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { ONLY_BUN, RUNTIMES, RUNTIME_NAMES, SHELLS, START_CP, runInNewConsole, tail, type CaseResult, type RuntimeName } from './harness/new-console.ts';
import { after, bytesOk, chcpLine, hex, neighborOk, record, screenVerdict, timeline } from './harness/judge.ts';

// T5 can change from run to run, so the same combination runs several times.
// T5 は回ごとに結果が変わりうるため、同じ組を何回も流す。
const REPEAT = Number(process.env.CODEPAGE_REPEAT ?? 3);

const BEFORE = 'node "{fix}/probe.ts" --dir "{dir}" --tag before';
const WAIT1 = 'ping -n 2 127.0.0.1 >nul';
const START = { in: START_CP, out: START_CP };
const TAIL = tail();

const emit = (rt: RuntimeName, extra = '') => `${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag w ${extra}`.trimEnd();
const sink = (rt: RuntimeName, extra: string) => `${RUNTIMES[rt].cmd} "{fix}/sink.ts" --dir "{dir}" --tag r ${extra}`;

const isBun = (...rts: RuntimeName[]) => rts.includes('bun');
const opts = (...rts: RuntimeName[]) => (isBun(...rts) ? { todo: 'bun はコードページを変える（Issue の証拠）' } : {});
// In the canary pass only the cases that involve Bun run; the others were already run in the Bun stable pass.
// canary の回は bun を含むケースだけを流す。ほかは bun 安定版の回で流している。
const wanted = (...rts: RuntimeName[]) => !ONLY_BUN || isBun(...rts);

function summary(r: CaseResult) {
	return { after: after(r), screen: screenVerdict(r), neighbor: neighborOk(r), chcp: chcpLine(r), timeline: timeline(r) };
}

describe('T1. コードページの推移', () => {
	for (const rt of RUNTIME_NAMES.filter((rt) => wanted(rt))) {
		test(`${rt} を動かしても、実行中も終了後も入力・出力とも開始のコードページのまま`, opts(rt), () => {
			const r = runInNewConsole(`t1-${rt}`, [
				BEFORE,
				`${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag x --pre 300 --post 300`,
				...TAIL,
			]);
			const during = (r.logs.x ?? []).map((l) => ({ event: l.event, in: l.in, out: l.out }));
			record({ test: 'T1', rt, during, ...summary(r) });
			assert.equal(during.length, 3, '実行中のログが 3 行ない');
			for (const d of during) assert.deepEqual({ in: d.in, out: d.out }, START, `${d.event} の時点で開始のコードページでない`);
			assert.deepEqual(after(r), START);
			assert.equal(screenVerdict(r), 'ok');
		});
	}
});

describe('T2. パイプの組み合わせ', () => {
	const launchers = ['cmd', 'pwsh', 'powershell'] as const;
	const emitArgs = '--dir "{dir}" --tag w';
	const sinkArgs = '--dir "{dir}" --tag r --mode file --when eof --out "{dir}/out.bin"';
	const sq = (s: string) => s.replaceAll('"', "'");
	const line = (launcher: (typeof launchers)[number], w: RuntimeName, rr: RuntimeName) =>
		launcher === 'cmd'
			? `${RUNTIMES[w].cmd} "{fix}/emit.ts" ${emitArgs} | ${RUNTIMES[rr].cmd} "{fix}/sink.ts" ${sinkArgs}`
			: `${SHELLS[launcher]} -NoProfile -Command "${RUNTIMES[w].ps} '{fix}/emit.ts' ${sq(emitArgs)} | ${RUNTIMES[rr].ps} '{fix}/sink.ts' ${sq(sinkArgs)}"`;
	// Windows PowerShell 5.1 turns non-ASCII into ? between native commands, so its baseline is node | node run the same way.
	// Windows PowerShell 5.1 はネイティブコマンド同士のパイプで非 ASCII を ? にする。node | node の結果を基準にする。
	let baseline51: string | undefined;
	const getBaseline51 = () => (baseline51 ??= hex(runInNewConsole('t2-powershell-baseline', [BEFORE, line('powershell', 'node', 'node'), ...TAIL]).file));
	for (const launcher of launchers) {
		for (const w of RUNTIME_NAMES) {
			for (const rr of RUNTIME_NAMES) {
				if (!wanted(w, rr)) continue;
				test(`${launcher} から ${w} | ${rr} で流すと、受け手に UTF-8 のバイト列がそのまま届き、終了後も開始のコードページのまま`, opts(w, rr), () => {
					const r = runInNewConsole(`t2-${launcher}-${w}-${rr}`, [BEFORE, line(launcher, w, rr), ...TAIL]);
					const base = launcher === 'powershell' ? getBaseline51() : undefined;
					record({ test: 'T2', launcher, w, r: rr, bytesOk: bytesOk(r), bytes: hex(r.file), baseline51: base, ...summary(r) });
					if (launcher === 'powershell') assert.equal(hex(r.file), base, 'node | node と違うバイト列になった');
					else assert.ok(bytesOk(r), `届いたバイト列: ${hex(r.file)}`);
					assert.deepEqual(after(r), START);
				});
			}
		}
	}
});

describe('T3. 強制終了後の残留', () => {
	for (const rt of RUNTIME_NAMES.filter((rt) => wanted(rt))) {
		test(`${rt} を強制終了しても、窓は開始のコードページに戻り、同じ窓の隣のプロセスが正しく表示する`, opts(rt), () => {
			const r = runInNewConsole(`t3-${rt}`, [
				BEFORE,
				`start "" /b ${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag w --pidfile "{dir}/pid.txt" --post 20000`,
				'ping -n 3 127.0.0.1 >nul',
				'set /p KPID=<"{dir}\\pid.txt"',
				'taskkill /F /PID %KPID% >nul',
				WAIT1,
				...TAIL,
			]);
			const killed = !(r.logs.w ?? []).some((l) => l.event === 'before-exit');
			record({ test: 'T3', rt, killed, ...summary(r) });
			assert.ok(killed, '強制終了できていない');
			assert.deepEqual(after(r), START);
			assert.ok(neighborOk(r), '隣のプロセス役の表示が化けた');
		});
	}
});

describe('T4. 同じ窓の隣のプロセスへの影響', () => {
	for (const rt of RUNTIME_NAMES.filter((rt) => wanted(rt))) {
		test(`${rt} | ${rt} が終わった後も、同じ窓の隣のプロセスが正しく表示し、窓は開始のコードページのまま`, opts(rt), () => {
			// Lifetimes overlap and the writer exits first: the same shape as ww in T5.
			// 2 本の寿命が重なり、送り手が先に終わる順。T5 の ww と同じ形。
			const r = runInNewConsole(`t4-${rt}`, [
				BEFORE,
				`${emit(rt, '--post 2000')} | (${WAIT1} & ${sink(rt, '--mode console --when eof --delay 800')})`,
				...TAIL,
			]);
			record({ test: 'T4', rt, ...summary(r) });
			assert.ok(neighborOk(r), '隣のプロセス役の表示が化けた');
			// The chcp message language depends on the Windows display language, so the code page itself is checked instead.
			// chcp のメッセージの言語は Windows の表示言語でも変わるため、コードページそのものを確かめる。
			assert.deepEqual(after(r), START);
		});
	}
});

describe('T5. 順番を固定した再現', () => {
	type Mode = 'console' | 'file';
	const out = (mode: Mode) => (mode === 'console' ? '--mode console' : '--mode file --out "{dir}/out.bin"');
	// The second process starts about 1 s later via ping. The exit order is set by the writer's --post and the reader's --when.
	// 2 本目は ping で約 1 秒遅らせて起動する。終了の順は送り手の --post と受け手の --when で決める。
	const orders: { id: string; label: string; modes: Mode[]; line: (rt: RuntimeName, mode: Mode) => string }[] = [
		{ id: 'ww', label: '送り手が先に起動し、先に終わる', modes: ['console', 'file'],
			line: (rt, m) => `${emit(rt, '--post 2000')} | (${WAIT1} & ${sink(rt, `${out(m)} --when eof --delay 800`)})` },
		{ id: 'wr', label: '送り手が先に起動し、受け手が先に終わる', modes: ['console', 'file'],
			line: (rt, m) => `${emit(rt, '--post 4000')} | (${WAIT1} & ${sink(rt, `${out(m)} --when first --delay 300`)})` },
		{ id: 'rw', label: '受け手が先に起動し、送り手が先に終わる', modes: ['console', 'file'],
			line: (rt, m) => `(${WAIT1} & ${emit(rt)}) | ${sink(rt, `${out(m)} --when eof --delay 800`)}` },
		{ id: 'rr', label: '受け手が先に起動し、受け手が先に終わる', modes: ['console', 'file'],
			line: (rt, m) => `(${WAIT1} & ${emit(rt, '--post 3000')}) | ${sink(rt, `${out(m)} --when first --delay 300`)}` },
		{ id: 'relay', label: '間に node を挟み、送り手が先に起動して先に終わる', modes: ['console'],
			line: (rt, m) => `${emit(rt, '--post 2000')} | node "{fix}/hold.ts" --dir "{dir}" --tag h --ms 500 | (${WAIT1} & ${sink(rt, `${out(m)} --when eof --delay 300`)})` },
	];
	// The same shape as bun#43660, with no fixed order, run many times to see whether the result changes from run to run (H2).
	// bun#43660 と同じ形。順番を決めずに何回も流し、結果が回ごとに変わるか（H2）を見る。
	// Japanese cannot go into the batch file, so it is passed with JavaScript \u escapes (the same text as TEXT).
	// 日本語はバッチに書けないため、JavaScript の \u エスケープで渡す（中身は TEXT と同じ）。
	const ASIS_REPEAT = Number(process.env.CODEPAGE_ASIS_REPEAT ?? 10);
	const asisLine = (rt: RuntimeName) =>
		`${RUNTIMES[rt].evalCmd} "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz')" | ${RUNTIMES[rt].evalCmd} "process.stdin.pipe(process.stdout)"`;
	for (const rt of RUNTIME_NAMES.filter((rt) => wanted(rt))) {
		test(`${rt} | ${rt} を bun#43660 と同じ形（順番を決めない）で ${ASIS_REPEAT} 回流しても、毎回画面に正しく出て、終了後も開始のコードページのまま`, opts(rt), () => {
			const runs = [];
			for (let i = 1; i <= ASIS_REPEAT; i++) {
				const r = runInNewConsole(`t5-${rt}-asis-${i}`, [BEFORE, asisLine(rt), ...TAIL]);
				const item = { test: 'T5', rt, order: 'asis', mode: 'console', rep: i, ...summary(r) };
				record(item);
				runs.push(item);
			}
			for (const run of runs) {
				assert.equal(run.screen, 'ok', `${run.rep} 回目の画面: ${run.screen}`);
				assert.deepEqual(run.after, START, `${run.rep} 回目の終了後`);
			}
		});
	}
	for (const rt of RUNTIME_NAMES.filter((rt) => wanted(rt))) {
		for (const o of orders) {
			for (const mode of o.modes) {
				const shape = o.id === 'relay' ? `${rt} | node | ${rt}` : `${rt} | ${rt}`;
				const what = mode === 'console' ? '画面に正しく出て' : '受け手に UTF-8 のバイト列がそのまま届き';
				test(`${shape}（${o.label}、受け手は${mode === 'console' ? '画面' : 'ファイル'}に書く）でも、${what}、終了後も開始のコードページのまま（${REPEAT} 回）`, opts(rt), () => {
					const runs = [];
					for (let i = 1; i <= REPEAT; i++) {
						const r = runInNewConsole(`t5-${rt}-${o.id}-${mode}-${i}`, [BEFORE, o.line(rt, mode), ...TAIL]);
						const item = { test: 'T5', rt, order: o.id, mode, rep: i, bytesOk: mode === 'file' ? bytesOk(r) : undefined, ...summary(r) };
						record(item);
						runs.push(item);
					}
					for (const run of runs) {
						if (mode === 'console') assert.equal(run.screen, 'ok', `${run.rep} 回目の画面: ${run.screen}`);
						else assert.ok(run.bytesOk, `${run.rep} 回目のバイト列が違う`);
						assert.deepEqual(run.after, START, `${run.rep} 回目の終了後`);
					}
				});
			}
		}
	}
	// The ww order again, with the reader writing to the screen through other APIs. PR #43662 routes console.log and
	// process.stdout through WriteConsoleW, but says fs.writeSync(1), fs.write and Bun.write(Bun.stdout) keep WriteFile.
	// Bun only: Bun.write exists only in Bun, and Node.js writes fs.writeSync(1) with WriteFile too.
	// ww の順番を、受け手がほかの API で画面に書く形でもう一度流す。PR #43662 は console.log と process.stdout を
	// WriteConsoleW にしたが、fs.writeSync(1) ・ fs.write ・ Bun.write(Bun.stdout) は WriteFile のままとしている。
	// bun だけで流す。Bun.write は bun にしか無く、node も fs.writeSync(1) は WriteFile で書くため。
	const vias = ['fswritesync', 'fswrite', 'bunwrite'] as const;
	for (const via of vias) {
		test(`bun | bun（送り手が先に起動し、先に終わる、受け手は ${via} で画面に書く）でも、画面に正しく出て、終了後も開始のコードページのまま（${REPEAT} 回）`, opts('bun'), () => {
			const runs = [];
			for (let i = 1; i <= REPEAT; i++) {
				const r = runInNewConsole(`t5-bun-ww-${via}-${i}`, [
					BEFORE,
					`${emit('bun', '--post 2000')} | (${WAIT1} & ${sink('bun', `--mode console --via ${via} --when eof --delay 800`)})`,
					...TAIL,
				]);
				const item = { test: 'T5', rt: 'bun', order: `ww-${via}`, mode: 'console', rep: i, ...summary(r) };
				record(item);
				runs.push(item);
			}
			for (const run of runs) {
				assert.equal(run.screen, 'ok', `${run.rep} 回目の画面: ${run.screen}`);
				assert.deepEqual(run.after, START, `${run.rep} 回目の終了後`);
			}
		});
	}
});
