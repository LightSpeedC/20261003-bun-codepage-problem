// Reader: receives stdin and writes it unchanged to the screen (stdout) or to a file.
// 受け手。標準入力を受け取り、画面（標準出力）かファイルへそのまま書く。
// --dir <log folder> --tag <name>
// --dir <ログの置き場> --tag <名前>
// --mode console|file  where to write; with file, the bytes go unchanged to --out <file>
// --mode console|file  書き先。file のときは --out <ファイル> にバイト列をそのまま書く
// --when first|eof     write when the first chunk arrives, or after the writer closes the pipe
// --when first|eof     最初のかたまりが届いたら書くか、送り手が閉じてから書くか
// --delay <ms>         wait before writing / 書く前に待つ
// --post <ms>          wait after writing, then exit / 書いた後に待ってから終わる
// --via stdout|fswritesync|fswrite|bunwrite
//                      how to write to the screen: process.stdout.write (default), fs.writeSync(1), fs.write(1), Bun.write(Bun.stdout)
//                      画面への書き方: process.stdout.write（既定）、fs.writeSync(1)、fs.write(1)、Bun.write(Bun.stdout)
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { write, writeFileSync, writeSync } from 'node:fs';
import { makeLogger, parseArgs, sleep } from './console.ts';

declare const Bun: any;

const args = parseArgs();
const log = makeLogger(args.dir, args.tag ?? 'sink');
const mode = args.mode ?? 'console';
const when = args.when ?? 'eof';
log('start');

const chunks: Uint8Array[] = [];
let done = false;

async function flush(): Promise<void> {
	if (done) return;
	done = true;
	await sleep(Number(args.delay ?? 0));
	const data = Buffer.concat(chunks);
	log('before-write', { bytes: data.length });
	if (mode === 'file') writeFileSync(args.out, data);
	else await writeToScreen(data, args.via ?? 'stdout');
	await sleep(Number(args.post ?? 0));
	log('before-exit');
	process.exit(0);
}

// The write APIs differ in how they reach the console (bun#43662 hooks only some of them), so each one can be chosen.
// 書き込みの API ごとに、画面への届き方が違う（bun#43662 が手当てしたのは一部だけ）。そのため 1 つずつ選べるようにする。
async function writeToScreen(data: Buffer, via: string): Promise<void> {
	if (via === 'stdout') return new Promise<void>((resolve) => process.stdout.write(data, () => resolve()));
	if (via === 'fswritesync') { writeSync(1, data); return; }
	if (via === 'fswrite') return new Promise<void>((resolve, reject) => write(1, data, (e) => (e ? reject(e) : resolve())));
	if (via === 'bunwrite') { await Bun.write(Bun.stdout, data); return; }
	throw new Error(`--via が分からない: ${via}`);
}

process.stdin.on('data', (chunk: Uint8Array) => {
	chunks.push(chunk);
	if (when === 'first') void flush();
});
process.stdin.on('end', () => void flush());
