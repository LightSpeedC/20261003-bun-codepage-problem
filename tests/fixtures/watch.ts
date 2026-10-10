// Watcher (Node.js only): polls every process attached to this console and the console code pages, and logs each change with a UTC time.
// 見張り役（node 専用）。この窓につながる全プロセスと窓のコードページを繰り返し読み、変わるたびに UTC の時刻で記録する。
// --out <log file> --ready <file written once watching has started> --stop <file whose appearance ends the watch> --done <file written at the end>
// --out <ログの書き先> --ready <見張りを始めたら書くファイル> --stop <現れたら見張りを終えるファイル> --done <終えたら書くファイル>
// It only reads; it changes neither the code page nor the screen. Node.js itself never changes the code page.
// 読むだけで、コードページも画面も変えない。node 自身もコードページを変えない。
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { getCodePages, parseArgs, runtime } from './console.ts';

if (runtime !== 'node') throw new Error('watch.ts は node で動かす');

const args = parseArgs();
const koffi: any = (await import('koffi')).default;
const k32 = koffi.load('kernel32.dll');
const ntdll = koffi.load('ntdll.dll');
const GetConsoleProcessList = k32.func('uint32 __stdcall GetConsoleProcessList(_Out_ uint32*, uint32)');
const OpenProcess = k32.func('void* __stdcall OpenProcess(uint32, bool, uint32)');
const CloseHandle = k32.func('bool __stdcall CloseHandle(void*)');
const NtQueryInformationProcess = ntdll.func('int32 __stdcall NtQueryInformationProcess(void*, int32, _Out_ uint8*, uint32, _Out_ uint32*)');

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const ProcessCommandLineInformation = 60;

// The project root is removed from command lines so no local path is kept.
// コマンド行からプロジェクトの root を取り除き、ローカルのパスを残さない。
const ROOT = path.resolve(import.meta.dirname, '../..');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rootPatterns = [ROOT, ROOT.replaceAll('\\', '/')].map((r) => new RegExp(escape(r), 'gi'));

// The command line, read once when a process first appears.
// コマンド行。プロセスが初めて見えたときに 1 回だけ読む。
function commandLine(pid: number): string | null {
	const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
	if (!h) return null;
	try {
		const buf = new Uint8Array(65536);
		const len = [0];
		if (NtQueryInformationProcess(h, ProcessCommandLineInformation, buf, buf.length, len) !== 0) return null;
		// The buffer starts with a UNICODE_STRING (Length, MaximumLength, padding, Buffer pointer); the text follows it.
		// 先頭は UNICODE_STRING（Length ・ MaximumLength ・ 詰め物 ・ Buffer のポインタ）。文字列はその後ろに続く。
		const bytes = buf[0] | (buf[1] << 8);
		let text = Buffer.from(buf.buffer, 16, bytes).toString('utf16le');
		for (const p of rootPatterns) text = text.replace(p, '.');
		return text;
	} finally {
		CloseHandle(h);
	}
}

const log = (event: string, extra: Record<string, unknown>) =>
	appendFileSync(args.out, JSON.stringify({ utc: new Date().toISOString(), event, ...extra }) + '\n');

const list = new Uint32Array(64);
let known = new Set<number>();
let cp = getCodePages();
log('watch-start', { in: cp.in, out: cp.out });
writeFileSync(args.ready, '');

// Poll as fast as possible. The watcher's own pid is left out.
// できるだけ速く読み続ける。見張り役自身の pid は除く。
for (;;) {
	const n = GetConsoleProcessList(list, list.length);
	const now = new Set(Array.from(list.subarray(0, Math.min(n, list.length))).filter((p) => p !== process.pid));
	for (const pid of now) if (!known.has(pid)) log('attach', { pid, cmd: commandLine(pid) });
	for (const pid of known) if (!now.has(pid)) log('detach', { pid });
	known = now;
	const c = getCodePages();
	if (c.in !== cp.in || c.out !== cp.out) log('codepage', { in: c.in, out: c.out });
	cp = c;
	if (existsSync(args.stop)) break;
}
log('watch-end', { in: cp.in, out: cp.out });
writeFileSync(args.done, '');
