// コンソールのコードページを変える害を実測するテスト（計画の T1〜T5。T6 は bun と canary の列を比べる）
// 期待値は「あるべき姿」（コードページを変えない実装）。bun はコードページを変えるため、直るまで失敗しうる
// bun の失敗は Issue の証拠なので todo 扱いにし、記録しながら全体は止めない。node と deno は厳密に判定する
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { RUNTIMES, RUNTIME_NAMES, SHELLS, TAIL, runInNewConsole, version, type CaseResult, type RuntimeName } from './harness/new-console.ts';
import { after, bytesOk, chcpLine, hex, record, screenVerdict, sjisOk, timeline } from './harness/judge.ts';

// T5 は回ごとに結果が変わりうるため、同じ組を何回も流す
const REPEAT = Number(process.env.CODEPAGE_REPEAT ?? 3);

const BEFORE = '{node} "{fix}/probe.ts" --dir "{dir}" --tag before';
const WAIT1 = 'ping -n 2 127.0.0.1 >nul';
const CP932 = { in: 932, out: 932 };

const emit = (rt: RuntimeName, extra = '') => `${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag w ${extra}`.trimEnd();
const sink = (rt: RuntimeName, extra: string) => `${RUNTIMES[rt].cmd} "{fix}/sink.ts" --dir "{dir}" --tag r ${extra}`;

const isBun = (...rts: RuntimeName[]) => rts.some((rt) => rt === 'bun' || rt === 'canary');
const opts = (...rts: RuntimeName[]) => (isBun(...rts) ? { todo: 'bun はコードページを変える（Issue の証拠）' } : {});

function summary(r: CaseResult) {
	return { after: after(r), screen: screenVerdict(r), sjis: sjisOk(r), chcp: chcpLine(r), timeline: timeline(r) };
}

test('使うランタイムの版を記録する', () => {
	for (const rt of RUNTIME_NAMES) record({ test: 'version', rt, version: version(rt) });
});

describe('T1. コードページの推移', () => {
	for (const rt of RUNTIME_NAMES) {
		test(`${rt} を 932 の窓で動かしても、実行中も終了後も入力・出力とも 932 のまま`, opts(rt), () => {
			const r = runInNewConsole(`t1-${rt}`, [
				BEFORE,
				`${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag x --pre 300 --post 300`,
				...TAIL,
			]);
			const during = (r.logs.x ?? []).map((l) => ({ event: l.event, in: l.in, out: l.out }));
			record({ test: 'T1', rt, during, ...summary(r) });
			assert.equal(during.length, 3, '実行中のログが 3 行ない');
			for (const d of during) assert.deepEqual({ in: d.in, out: d.out }, CP932, `${d.event} の時点で 932 でない`);
			assert.deepEqual(after(r), CP932);
			assert.equal(screenVerdict(r), 'ok');
		});
	}
});

describe('T2. パイプの組み合わせ', () => {
	const launchers = ['cmd', 'pwsh', 'powershell'] as const;
	// Windows PowerShell 5.1 はネイティブコマンド同士のパイプで非 ASCII を ? にする。node | node の結果を基準にする
	let baseline51: string | undefined;
	for (const launcher of launchers) {
		// 5.1 の基準を先に取るため、node | node を先頭にする
		const pairs = RUNTIME_NAMES.flatMap((w) => RUNTIME_NAMES.map((rr) => [w, rr] as const))
			.sort((a, b) => Number(b[0] === 'node' && b[1] === 'node') - Number(a[0] === 'node' && a[1] === 'node'));
		for (const [w, rr] of pairs) {
			test(`${launcher} から ${w} | ${rr} で流すと、受け手に UTF-8 のバイト列がそのまま届き、終了後も 932 のまま`, opts(w, rr), () => {
				const emitArgs = '--dir "{dir}" --tag w';
				const sinkArgs = '--dir "{dir}" --tag r --mode file --when eof --out "{dir}/out.bin"';
				const sq = (s: string) => s.replaceAll('"', "'");
				const line = launcher === 'cmd'
					? `${RUNTIMES[w].cmd} "{fix}/emit.ts" ${emitArgs} | ${RUNTIMES[rr].cmd} "{fix}/sink.ts" ${sinkArgs}`
					: `"${SHELLS[launcher]}" -NoProfile -Command "${RUNTIMES[w].ps} '{fix}/emit.ts' ${sq(emitArgs)} | ${RUNTIMES[rr].ps} '{fix}/sink.ts' ${sq(sinkArgs)}"`;
				const r = runInNewConsole(`t2-${launcher}-${w}-${rr}`, [BEFORE, line, ...TAIL]);
				const ok = bytesOk(r);
				if (launcher === 'powershell' && w === 'node' && rr === 'node') baseline51 = hex(r.file);
				record({ test: 'T2', launcher, w, r: rr, bytesOk: ok, bytes: hex(r.file), baseline51, ...summary(r) });
				if (launcher === 'powershell') assert.equal(hex(r.file), baseline51, 'node | node と違うバイト列になった');
				else assert.ok(ok, `届いたバイト列: ${hex(r.file)}`);
				assert.deepEqual(after(r), CP932);
			});
		}
	}
});

describe('T3. 強制終了後の残留', () => {
	for (const rt of RUNTIME_NAMES) {
		test(`${rt} を強制終了しても、窓は 932 に戻り、同じ窓の SJIS の cmd が日本語を正しく出す`, opts(rt), () => {
			const r = runInNewConsole(`t3-${rt}`, [
				BEFORE,
				`start "" /b ${RUNTIMES[rt].cmd} "{fix}/emit.ts" --dir "{dir}" --tag w --pidfile "{dir}/pid.txt" --post 20000`,
				'ping -n 3 127.0.0.1 >nul',
				'set /p KPID=<"{dirwin}\\pid.txt"',
				'taskkill /F /PID %KPID% >nul',
				WAIT1,
				...TAIL,
			]);
			const killed = !(r.logs.w ?? []).some((l) => l.event === 'before-exit');
			record({ test: 'T3', rt, killed, ...summary(r) });
			assert.ok(killed, '強制終了できていない');
			assert.deepEqual(after(r), CP932);
			assert.ok(sjisOk(r), 'SJIS の cmd が化けた');
		});
	}
});

describe('T4. 同じ窓の隣のプロセスへの影響', () => {
	for (const rt of RUNTIME_NAMES) {
		test(`${rt} | ${rt} が終わった後も、同じ窓の SJIS の cmd が日本語を正しく出し、chcp のメッセージも日本語のまま`, opts(rt), () => {
			// 2 本の寿命が重なり、送り手が先に終わる順。T5 の ww と同じ形
			const r = runInNewConsole(`t4-${rt}`, [
				BEFORE,
				`${emit(rt, '--post 2000')} | (${WAIT1} & ${sink(rt, '--mode console --when eof --delay 800')})`,
				...TAIL,
			]);
			record({ test: 'T4', rt, ...summary(r) });
			assert.ok(sjisOk(r), 'SJIS の cmd が化けた');
			assert.match(chcpLine(r), /コード ページ: 932/);
		});
	}
});

describe('T5. 順番を固定した再現', () => {
	type Mode = 'console' | 'file';
	const out = (mode: Mode) => (mode === 'console' ? '--mode console' : '--mode file --out "{dir}/out.bin"');
	// 2 本目は ping で約 1 秒遅らせて起動する。終了の順は送り手の --post と受け手の --when で決める
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
			line: (rt, m) => `${emit(rt, '--post 2000')} | {node} "{fix}/hold.ts" --dir "{dir}" --tag h --ms 500 | (${WAIT1} & ${sink(rt, `${out(m)} --when eof --delay 300`)})` },
	];
	// bun#43660 と同じ形。順番を決めずに何回も流し、結果が回ごとに変わるか（H2）を見る
	// 日本語はバッチに書けないため、JavaScript の \u エスケープで渡す（中身は TEXT と同じ）
	const ASIS_REPEAT = Number(process.env.CODEPAGE_ASIS_REPEAT ?? 10);
	const evalCmd = (rt: RuntimeName, js: string) => `${RUNTIMES[rt].cmd.replace(' run -A --quiet', '')} ${rt === 'deno' ? 'eval' : '-e'} "${js}"`;
	const asisLine = (rt: RuntimeName) =>
		`${evalCmd(rt, "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz')")} | ${evalCmd(rt, 'process.stdin.pipe(process.stdout)')}`;
	for (const rt of RUNTIME_NAMES) {
		test(`${rt} | ${rt} を bun#43660 と同じ形（-e、順番を決めない）で ${ASIS_REPEAT} 回流しても、毎回画面に正しく出て、終了後も 932 のまま`, opts(rt), () => {
			const runs = [];
			for (let i = 1; i <= ASIS_REPEAT; i++) {
				const r = runInNewConsole(`t5-${rt}-asis-${i}`, [BEFORE, asisLine(rt), ...TAIL]);
				const item = { test: 'T5', rt, order: 'asis', mode: 'console', rep: i, ...summary(r) };
				record(item);
				runs.push(item);
			}
			for (const run of runs) {
				assert.equal(run.screen, 'ok', `${run.rep} 回目の画面: ${run.screen}`);
				assert.deepEqual(run.after, CP932, `${run.rep} 回目の終了後`);
			}
		});
	}
	for (const rt of RUNTIME_NAMES) {
		for (const o of orders) {
			for (const mode of o.modes) {
				const shape = o.id === 'relay' ? `${rt} | node | ${rt}` : `${rt} | ${rt}`;
				const what = mode === 'console' ? '画面に正しく出て' : '受け手に UTF-8 のバイト列がそのまま届き';
				test(`${shape}（${o.label}、受け手は${mode === 'console' ? '画面' : 'ファイル'}に書く）でも、${what}、終了後も 932 のまま（${REPEAT} 回）`, opts(rt), () => {
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
						assert.deepEqual(run.after, CP932, `${run.rep} 回目の終了後`);
					}
				});
			}
		}
	}
});
