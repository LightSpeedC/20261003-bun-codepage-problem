// 観測役（node 専用）。コードページを記録し、必要なら窓の画面の文字を読み取って書き出す
// --dir <ログの置き場> --tag <名前> --screen <画面の書き出し先>
// 読むだけで、コードページも画面も変えない
import { writeFileSync } from 'node:fs';
import { makeLogger, parseArgs, runtime } from './console.ts';

if (runtime !== 'node') throw new Error('probe.ts は node で動かす');

const args = parseArgs();
makeLogger(args.dir, args.tag ?? 'probe')('probe');

if (args.screen) writeFileSync(args.screen, JSON.stringify(await readScreen(), null, '\t') + '\n');

// 画面バッファの先頭からカーソルの行までを、1 行ずつの文字列で返す
async function readScreen(): Promise<string[]> {
	const koffi: any = (await import('koffi')).default;
	const k32 = koffi.load('kernel32.dll');
	const COORD = koffi.struct('COORD', { X: 'int16', Y: 'int16' });
	const SMALL_RECT = koffi.struct('SMALL_RECT', { Left: 'int16', Top: 'int16', Right: 'int16', Bottom: 'int16' });
	const CSBI = koffi.struct('CONSOLE_SCREEN_BUFFER_INFO', {
		dwSize: COORD, dwCursorPosition: COORD, wAttributes: 'uint16', srWindow: SMALL_RECT, dwMaximumWindowSize: COORD,
	});
	const CreateFileW = k32.func('void* __stdcall CreateFileW(str16, uint32, uint32, void*, uint32, uint32, void*)');
	const GetInfo = k32.func('bool __stdcall GetConsoleScreenBufferInfo(void*, _Out_ CONSOLE_SCREEN_BUFFER_INFO*)');
	const ReadChars = k32.func('bool __stdcall ReadConsoleOutputCharacterW(void*, _Out_ uint16*, uint32, COORD, _Out_ uint32*)');
	const CloseHandle = k32.func('bool __stdcall CloseHandle(void*)');

	// 標準出力がリダイレクトされていても窓の画面を読めるよう、CONOUT$ を開く
	const h = CreateFileW('CONOUT$', 0x80000000 | 0x40000000, 1 | 2, null, 3, 0, null);
	try {
		const info: any = {};
		if (!GetInfo(h, info)) throw new Error('GetConsoleScreenBufferInfo が失敗した');
		const width = info.dwSize.X;
		const rows = info.dwCursorPosition.Y + 1;
		const lines: string[] = [];
		for (let y = 0; y < rows; y++) {
			const buf = new Uint16Array(width);
			const read = [0];
			if (!ReadChars(h, buf, width, { X: 0, Y: y }, read)) throw new Error('ReadConsoleOutputCharacterW が失敗した');
			lines.push(String.fromCharCode(...buf.subarray(0, read[0])).trimEnd());
		}
		return lines;
	} finally {
		CloseHandle(h);
	}
}
