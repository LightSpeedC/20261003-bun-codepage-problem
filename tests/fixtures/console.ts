// bun ・ node ・ deno のどれで動いても、コンソールのコードページを「読むだけ」の共通部品
// コードページを変える API（SetConsoleCP 等）はここに書かない
import process from 'node:process';
import { appendFileSync, writeFileSync } from 'node:fs';

declare const Bun: unknown;
declare const Deno: any;

export type Runtime = 'bun' | 'deno' | 'node';

export const runtime: Runtime =
	typeof Bun !== 'undefined' ? 'bun' : typeof Deno !== 'undefined' ? 'deno' : 'node';

export type CodePages = { in: number; out: number };

type CpReader = () => CodePages;

// ランタイムごとに FFI の書き方が違うため、使う側だけを読み込む
async function loadCpReader(): Promise<CpReader> {
	if (runtime === 'bun') {
		// 'bun:ffi' を直に書くと node の型検査が止まるため、文字列を組み立てて読み込む
		const ffi: any = await import('bun' + ':ffi');
		const lib = ffi.dlopen('kernel32.dll', {
			GetConsoleCP: { args: [], returns: 'u32' },
			GetConsoleOutputCP: { args: [], returns: 'u32' },
		});
		return () => ({ in: lib.symbols.GetConsoleCP(), out: lib.symbols.GetConsoleOutputCP() });
	}
	if (runtime === 'deno') {
		const lib = Deno.dlopen('kernel32.dll', {
			GetConsoleCP: { parameters: [], result: 'u32' },
			GetConsoleOutputCP: { parameters: [], result: 'u32' },
		});
		return () => ({ in: lib.symbols.GetConsoleCP(), out: lib.symbols.GetConsoleOutputCP() });
	}
	const koffi: any = (await import('koffi')).default;
	const lib = koffi.load('kernel32.dll');
	const getIn = lib.func('uint32 __stdcall GetConsoleCP()');
	const getOut = lib.func('uint32 __stdcall GetConsoleOutputCP()');
	return () => ({ in: getIn(), out: getOut() });
}

export const getCodePages: CpReader = await loadCpReader();

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// --name value 形式の引数を読む
export function parseArgs(argv: string[] = process.argv.slice(2)): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const key = argv[i];
		if (key.startsWith('--')) {
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) out[key.slice(2)] = 'true';
			else { out[key.slice(2)] = next; i++; }
		}
	}
	return out;
}

// 1 プロセス 1 ファイルに、時刻とコードページを 1 行ずつ追記する
export function makeLogger(dir: string | undefined, tag: string) {
	return (event: string, extra: Record<string, unknown> = {}) => {
		if (!dir) return;
		const cp = getCodePages();
		const line = JSON.stringify({ t: Date.now(), tag, rt: runtime, pid: process.pid, event, in: cp.in, out: cp.out, ...extra });
		appendFileSync(`${dir}/${tag}.jsonl`, line + '\n');
	};
}

export function writePid(file: string | undefined): void {
	if (file) writeFileSync(file, String(process.pid));
}

// 送る文字列。偶数文字の日本語を ASCII で挟み、CP932 で読み違えても改行が残るようにする
export const TEXT = 'abc 東京大阪 xyz';
export const TEXT_GARBLED = 'abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz';
