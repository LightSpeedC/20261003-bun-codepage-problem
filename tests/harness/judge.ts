// Judge the result of a case, and record it in results.jsonl as material for the result tables.
// 窓の結果を判定し、結果表の材料として results.jsonl に 1 行ずつ残す。
import { appendFileSync, mkdirSync } from 'node:fs';
import { TEXT } from '../fixtures/console.ts';
import { EVIDENCE_DIR, START_CP, type CaseResult } from './new-console.ts';

// What TEXT looks like when its UTF-8 bytes are read in the starting code page.
// TEXT の UTF-8 のバイト列を、開始のコードページで読んだときの形。
const GARBLED: Record<number, string> = {
	932: 'abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz',
	437: 'abc µ¥▒Σ║¼σñºΘÿ¬ xyz',
};

// What the neighbor process prints when the console is still at its starting code page.
// 窓が開始のコードページのままなら、隣のプロセス役が出す行。
const NEIGHBOR: Record<number, string> = {
	932: 'neighbor: 東京大阪',
	437: 'neighbor: café',
};

export type ScreenVerdict = 'ok' | 'garbled' | 'missing';

// Whether TEXT appeared correctly on the screen. The garbled form is fixed for each code page.
// 画面に TEXT が正しく出たか。化けた形はコードページごとに決まっている。
export function screenVerdict(r: CaseResult, startCp = START_CP): ScreenVerdict {
	const end = r.screen.indexOf('--- tail ---');
	const body = end < 0 ? r.screen : r.screen.slice(0, end);
	if (body.includes(TEXT)) return 'ok';
	if (body.some((l) => l.includes(GARBLED[startCp]))) return 'garbled';
	return 'missing';
}

// Whether the neighbor process in the same console printed its text correctly.
// 同じ窓の隣のプロセス役が、正しく表示したか。
export function neighborOk(r: CaseResult, startCp = START_CP): boolean {
	return r.screen.includes(NEIGHBOR[startCp]);
}

// The chcp output left on the screen. The message switches to English when the output code page is 65001.
// 窓に残った chcp の表示。出力側が 65001 になると、メッセージが英語になる。
export function chcpLine(r: CaseResult): string {
	const tail = r.screen.slice(r.screen.indexOf('--- tail ---') + 1);
	return tail.find((l) => /code page|コード ページ/.test(l)) ?? '';
}

// The code page after the case, as read by the observer Node.js process.
// 終わったあとのコードページ（観測役の node が読んだ値）。
export function after(r: CaseResult): { in: number; out: number } {
	const l = r.logs.after?.[0];
	if (!l) throw new Error(`観測役のログが無い: ${r.dir}`);
	return { in: l.in, out: l.out };
}

// Whether the bytes written to the file are TEXT in valid UTF-8.
// ファイルに届いたバイト列が、正しい UTF-8 の TEXT か。
export function bytesOk(r: CaseResult): boolean {
	if (!r.file) return false;
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(r.file).replace(/\r?\n$/, '') === TEXT;
	} catch {
		return false;
	}
}

export function hex(b: Uint8Array | undefined): string {
	return b ? Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ') : '';
}

// The code pages each process logged, as a short string in time order.
// 各プロセスがログに残したコードページを、時刻順の短い文字列にする。
export function timeline(r: CaseResult): string {
	return Object.values(r.logs).flat().sort((a, b) => a.t - b.t).map((l) => `${l.t}ms ${l.tag}:${l.event}=${l.in}/${l.out}`).join(', ');
}

// One line per case, with no date, so two runs can be diffed.
// ケースごとに 1 行。日時は書かないので、2 回の結果を diff で比べられる。
export function record(item: Record<string, unknown>): void {
	mkdirSync(EVIDENCE_DIR, { recursive: true });
	appendFileSync(`${EVIDENCE_DIR}/results.jsonl`, JSON.stringify(item) + '\n');
}
