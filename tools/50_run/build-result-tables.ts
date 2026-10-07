// Build the result tables of research/codepage-test-results(-JP).html from research/evidence/.
// research/evidence/ から、research/codepage-test-results(-JP).html の結果の表を作る。
// Every ✅ / ❌ in a table links to the evidence file of that case, and each test links to its code lines.
// 表の ✅ ／ ❌ の 1 つ 1 つから、そのケースの証拠ファイルへリンクし、試験ごとに試験コードの行へリンクする。
// The tables are written between <!-- AUTO:name --> and <!-- /AUTO:name --> in both files.
// 表は両方のファイルの <!-- AUTO:名前 --> と <!-- /AUTO:名前 --> の間に書く。
// Usage: node tools/50_run/build-result-tables.ts
// 使い方: node tools/50_run/build-result-tables.ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const evidence = path.join(root, 'research/evidence');
const testFile = path.join(root, 'tests/codepage.test.ts');
const repo = 'https://github.com/LightSpeedC/20261003-bun-codepage-problem';
// Link the test code at the last commit that changed tests/, so the line numbers never move.
// tests/ を最後に変えたコミットに固定してリンクし、行番号がずれないようにする。
const sha = execFileSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', 'tests'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'tests'], { encoding: 'utf8' }).trim()) {
	throw new Error('tests/ に commit していない変更がある。行番号がずれるので先に commit する');
}

type Lang = 'en' | 'ja';
const CPS = [932, 437] as const;
const RTS = ['bun', 'canary', 'pr43662', 'node', 'deno'] as const;
type Rt = (typeof RTS)[number];
const LABEL: Record<Rt, string> = { bun: 'bun 1.4.2', canary: 'bun canary', pr43662: 'bun PR #43662', node: 'node', deno: 'deno' };
// Bun builds other than the stable one, and the evidence folder of their pass. Their cases are named with "bun".
// 安定版以外の bun と、その回の証拠のフォルダ。ケース名には "bun" を使っている。
const FLAVORS: Partial<Record<Rt, string>> = { canary: 'bun-canary', pr43662: 'bun-pr-43662' };
const isBunFlavor = (rt: Rt) => rt === 'bun' || rt in FLAVORS;

// ---- evidence ----
type Row = Record<string, any>;
function load(cp: number, folder: string, alias: Rt): Row[] {
	const file = path.join(evidence, `cp${cp}`, folder, 'node-test', 'results.jsonl');
	if (!existsSync(file)) throw new Error(`証拠が無い: ${file}`);
	const rename = (v: unknown) => (v === 'bun' ? alias : v);
	return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
		const r = JSON.parse(l);
		return { ...r, cp, rt: rename(r.rt), w: rename(r.w), r: rename(r.r) };
	});
}
const rows: Row[] = CPS.flatMap((cp) => [
	...load(cp, 'bun', 'bun'),
	...Object.entries(FLAVORS).flatMap(([rt, folder]) => load(cp, folder!, rt as Rt)),
]);

// Path of one evidence file, relative to research/. Passes of other Bun builds name their cases with "bun".
// 証拠ファイル 1 つの、research/ からの相対パス。安定版以外の bun の回は、ケース名に "bun" を使っている。
function ev(cp: number, rts: Rt[], caseName: string, file: string): string {
	const flavor = rts.find((rt) => rt in FLAVORS);
	const folder = flavor ? FLAVORS[flavor]! : 'bun';
	return `evidence/cp${cp}/${folder}/node-test/${flavor ? caseName.replaceAll(flavor, 'bun') : caseName}/${file}`;
}
const a = (href: string, text: string, title = '') => `<a href="${href}"${title ? ` title="${title}"` : ''}>${text}</a>`;
const mark = (ok: boolean) => (ok ? '✅' : '❌');
const cpOk = (r: Row) => r.after.in === r.cp && r.after.out === r.cp;
const find = (pred: (r: Row) => boolean) => {
	const r = rows.find(pred);
	if (!r) throw new Error('行が無い');
	return r;
};

// ---- test code lines ----
const lines = readFileSync(testFile, 'utf8').split('\n');
const lineOf = (re: RegExp, from = 0) => {
	const i = lines.findIndex((l, n) => n >= from && re.test(l));
	if (i < 0) throw new Error(`行が無い: ${re}`);
	return i + 1;
};
const describeRange = (name: string) => {
	const start = lineOf(new RegExp(`^describe\\('${name}`));
	return [start, lineOf(/^\}\);/, start)] as const;
};
const code = (from: number, to: number, text: string) => a(`${repo}/blob/${sha}/tests/codepage.test.ts#L${from}-L${to}`, text);
const T: Record<string, readonly [number, number]> = {
	T1: describeRange('T1'), T2: describeRange('T2'), T3: describeRange('T3'), T4: describeRange('T4'), T5: describeRange('T5'),
};
const orderLine = (id: string) => { const l = lineOf(new RegExp(`id: '${id}'`)); return [l, l + 1] as const; };
const asisFrom = lineOf(/The same shape as bun#43660/);
const fixedFrom = lineOf(/for \(const rt of RUNTIME_NAMES/, lineOf(/const asisLine/) + 3);
const asisRange = [asisFrom, fixedFrom - 1] as const;
const t2Line = lineOf(/const line = \(launcher/);

// ---- tables ----
const t = (lang: Lang, en: string, ja: string) => (lang === 'en' ? en : ja);
const table = (head: string[], body: string[][]) =>
	`<div class="tablewrap"><table>\n<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>\n<tbody>\n${body.map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="nowrap"' : ''}>${c}</td>`).join('')}</tr>`).join('\n')}\n</tbody></table></div>`;
const codeNote = (lang: Lang, range: readonly [number, number], name: string) =>
	`<p>${t(lang, 'Test code: ', '試験コード: ')}${code(range[0], range[1], t(lang, `${name} (codepage.test.ts lines ${range[0]} to ${range[1]})`, `${name}（codepage.test.ts の ${range[0]}〜${range[1]} 行）`))}</p>`;

function t1(lang: Lang): string {
	const body = RTS.flatMap((rt) => CPS.map((cp) => {
		const r = find((x) => x.test === 'T1' && x.rt === rt && x.cp === cp);
		const log = ev(cp, [rt], `t1-${rt}`, 'log.jsonl');
		const cells = r.during.map((d: Row) => a(log, `${mark(d.in === cp && d.out === cp)} ${d.in}/${d.out}`));
		return [`${LABEL[rt]} (${cp})`, ...cells, a(log, `${mark(cpOk(r))} ${r.after.in}/${r.after.out}`), a(ev(cp, [rt], `t1-${rt}`, 'screen.json'), mark(r.screen === 'ok'))];
	}));
	return codeNote(lang, T.T1, 'T1') + '\n' + table(
		[t(lang, 'Runtime (start)', 'ランタイム（開始）'), t(lang, 'Right after start', '起動直後'), t(lang, 'Right before writing', '書く直前'), t(lang, 'Right before exit', '終了直前'), t(lang, 'After exit', '終了後'), t(lang, 'Screen', '画面')],
		body);
}

function t2(lang: Lang): string {
	const pairs: [Rt, Rt][] = [];
	for (const w of RTS) for (const r of RTS) {
		// Two different Bun builds never run in the same pass.
		// 別々の bun の版は、同じ回では流さない。
		if (w !== r && isBunFlavor(w) && isBunFlavor(r)) continue;
		pairs.push([w, r]);
	}
	const body = pairs.map(([w, rr]) => [`${w} → ${rr}`, ...['cmd', 'pwsh', 'powershell'].map((l) => CPS.map((cp) => {
		const r = find((x) => x.test === 'T2' && x.cp === cp && x.launcher === l && x.w === w && x.r === rr);
		const name = `t2-${l}-${w}-${rr}`;
		const bytes = l === 'powershell' ? r.bytes === r.baseline51 : r.bytesOk;
		return `${cp}: ${a(ev(cp, [w, rr], name, 'out.bin'), mark(bytes))} ${a(ev(cp, [w, rr], name, 'log.jsonl'), mark(cpOk(r)))}`;
	}).join('<br>'))]);
	return codeNote(lang, T.T2, 'T2') + '\n' +
		`<p>${t(lang, 'The command for each launcher is built here: ', '起動元ごとのコマンドの組み立て: ')}${code(t2Line, t2Line + 3, t(lang, `lines ${t2Line} to ${t2Line + 3}`, `${t2Line}〜${t2Line + 3} 行`))}</p>\n` +
		table([t(lang, 'Writer → reader', '送り手 → 受け手'), 'cmd', 'pwsh 7', 'Windows PowerShell 5.1'], body);
}

function t34(lang: Lang, test: 'T3' | 'T4'): string {
	const body = RTS.flatMap((rt) => CPS.map((cp) => {
		const r = find((x) => x.test === test && x.rt === rt && x.cp === cp);
		const name = `${test.toLowerCase()}-${rt}`;
		const screen = ev(cp, [rt], name, 'screen.json');
		return [`${LABEL[rt]} (${cp})`, a(ev(cp, [rt], name, 'log.jsonl'), `${mark(cpOk(r))} ${r.after.in}/${r.after.out}`), a(screen, `${mark(cpOk(r))} <code>${r.chcp}</code>`), a(screen, mark(r.neighbor))];
	}));
	return codeNote(lang, T[test], test) + '\n' + table(
		[t(lang, 'Runtime (start)', 'ランタイム（開始）'), t(lang, 'Code page after', '終了後のコードページ'), t(lang, 'chcp output', 'chcp の表示'), t(lang, 'Neighbor process', '隣のプロセス役')],
		body);
}

function t5(lang: Lang): string {
	const orders: [string, string, string, string[]][] = [
		['ww', 'Writer starts first and exits first', '送り手が先に起動し、先に終わる', ['console', 'file']],
		['wr', 'Writer starts first, reader exits first', '送り手が先に起動し、受け手が先に終わる', ['console', 'file']],
		['rw', 'Reader starts first, writer exits first', '受け手が先に起動し、送り手が先に終わる', ['console', 'file']],
		['rr', 'Reader starts first and exits first', '受け手が先に起動し、受け手が先に終わる', ['console', 'file']],
		['relay', 'Node.js in the middle; writer starts first and exits first', '間に node を挟み、送り手が先に起動して先に終わる', ['console']],
		['ww-fswritesync', 'ww, reader writes with fs.writeSync(1)', 'ww で、受け手は fs.writeSync(1) で書く', ['console']],
		['ww-fswrite', 'ww, reader writes with fs.write(1)', 'ww で、受け手は fs.write(1) で書く', ['console']],
		['ww-bunwrite', 'ww, reader writes with Bun.write(Bun.stdout)', 'ww で、受け手は Bun.write(Bun.stdout) で書く', ['console']],
	];
	const viaRange = [lineOf(/const vias = /), T.T5[1] - 1] as const;
	const body = orders.flatMap(([id, en, ja, modes]) => modes.map((mode) => {
		const range = id.startsWith('ww-') ? viaRange : orderLine(id);
		const label = `${code(range[0], range[1], `${t(lang, en, ja)} (${id})`)}<br>${t(lang, mode === 'console' ? 'reader writes to the screen' : 'reader writes to a file', mode === 'console' ? '受け手は画面に書く' : '受け手はファイルに書く')}`;
		return [label, ...RTS.map((rt) => CPS.map((cp) => {
			const runs = rows.filter((x) => x.test === 'T5' && x.cp === cp && x.rt === rt && x.order === id && x.mode === mode).sort((p, q) => p.rep - q.rep);
			// Rows run only with Bun builds have no runs for Node.js and Deno.
			// bun の版だけで流す行は、node と deno の回が無い。
			if (!runs.length) return `${cp}: —`;
			const out = runs.map((r) => {
				const name = `t5-${rt}-${id}-${mode}-${r.rep}`;
				return mode === 'console' ? a(ev(cp, [rt], name, 'screen.json'), mark(r.screen === 'ok')) : a(ev(cp, [rt], name, 'out.bin'), mark(r.bytesOk));
			}).join('');
			const aft = runs.map((r) => a(ev(cp, [rt], `t5-${rt}-${id}-${mode}-${r.rep}`, 'log.jsonl'), mark(cpOk(r)))).join('');
			return `${cp}: ${out} ／ ${aft}`;
		}).join('<br>'))];
	}));
	return codeNote(lang, T.T5, 'T5') + '\n' + table([t(lang, 'Shape and order', '形と順番'), ...RTS.map((rt) => LABEL[rt])], body);
}

function asis(lang: Lang): string {
	const body = RTS.map((rt) => [LABEL[rt], ...CPS.map((cp) => {
		const runs = rows.filter((x) => x.test === 'T5' && x.cp === cp && x.rt === rt && x.order === 'asis').sort((p, q) => p.rep - q.rep);
		const out = runs.map((r) => a(ev(cp, [rt], `t5-${rt}-asis-${r.rep}`, 'screen.json'), mark(r.screen === 'ok'))).join('');
		const aft = runs.map((r) => a(ev(cp, [rt], `t5-${rt}-asis-${r.rep}`, 'log.jsonl'), mark(cpOk(r)))).join('');
		const garbled = runs.filter((r) => r.screen !== 'ok').length;
		return `${out} ／ ${aft}<br>${t(lang, `garbled ${garbled} of ${runs.length}`, `化けた回数 ${garbled} / ${runs.length}`)}`;
	})]);
	return codeNote(lang, asisRange, t(lang, 'same shape as bun#43660', 'bun#43660 と同じ形')) + '\n' +
		table([t(lang, 'Runtime', 'ランタイム'), t(lang, 'Start 932: screen / after', '開始 932: 画面 ／ 終了後'), t(lang, 'Start 437: screen / after', '開始 437: 画面 ／ 終了後')], body);
}

// ---- write ----
const builders: Record<string, (lang: Lang) => string> = {
	t1, t2, t3: (l) => t34(l, 'T3'), t4: (l) => t34(l, 'T4'), t5, asis,
};
for (const [file, lang] of [['research/codepage-test-results.html', 'en'], ['research/codepage-test-results-JP.html', 'ja']] as const) {
	const full = path.join(root, file);
	let html = readFileSync(full, 'utf8');
	for (const [name, build] of Object.entries(builders)) {
		const re = new RegExp(`(<!-- AUTO:${name} -->)[\\s\\S]*?(<!-- /AUTO:${name} -->)`);
		if (!re.test(html)) throw new Error(`${file} に AUTO:${name} が無い`);
		html = html.replace(re, (_m, open: string, close: string) => `${open}\n${build(lang)}\n${close}`);
	}
	writeFileSync(full, html);
	console.log(`書き込み: ${file}`);
}
console.log(`試験コードのリンク先: ${sha.slice(0, 7)}`);
