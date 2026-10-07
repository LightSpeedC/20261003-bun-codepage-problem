// 窓の結果を判定し、結果表の材料として tmp/results/ に 1 行ずつ残す
import { appendFileSync, mkdirSync } from 'node:fs';
import { TEXT, TEXT_GARBLED } from '../fixtures/console.ts';
import { ROOT, type CaseResult } from './new-console.ts';

export type ScreenVerdict = 'ok' | 'garbled' | 'missing';

// 画面に TEXT が正しく出たか。化けた形は CP932 として読んだときの決まった形になる
export function screenVerdict(r: CaseResult): ScreenVerdict {
	const body = r.screen.slice(0, r.screen.indexOf('--- tail ---') >>> 0);
	if (body.includes(TEXT)) return 'ok';
	if (body.some((l) => l.includes(TEXT_GARBLED))) return 'garbled';
	return 'missing';
}

// 隣の SJIS の cmd が日本語を正しく出したか
export function sjisOk(r: CaseResult): boolean {
	return r.screen.includes('sjis: 東京大阪');
}

// 窓に残った chcp の表示。日本語のメッセージなら出力側が 932、英語なら 65001
export function chcpLine(r: CaseResult): string {
	const tail = r.screen.slice(r.screen.indexOf('--- tail ---') + 1);
	return tail.find((l) => /code page|コード ページ/.test(l)) ?? '';
}

// 終わったあとのコードページ（観測役の node が読んだ値）
export function after(r: CaseResult): { in: number; out: number } {
	const l = r.logs.after?.[0];
	if (!l) throw new Error(`観測役のログが無い: ${r.dir}`);
	return { in: l.in, out: l.out };
}

// ファイルに届いたバイト列が、正しい UTF-8 の TEXT か
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

// 各プロセスがログに残したコードページを、時刻順の短い文字列にする
export function timeline(r: CaseResult): string {
	const all = Object.values(r.logs).flat().sort((a, b) => a.t - b.t);
	const t0 = all[0]?.t ?? 0;
	return all.map((l) => `${l.t - t0}ms ${l.tag}:${l.event}=${l.in}/${l.out}`).join(', ');
}

const runner = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined' ? 'bun' : 'node';
const RESULTS = `${ROOT}/tmp/results`;

export function record(item: Record<string, unknown>): void {
	mkdirSync(RESULTS, { recursive: true });
	appendFileSync(`${RESULTS}/${runner}.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...item }) + '\n');
}
