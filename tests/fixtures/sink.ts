// 受け手。標準入力を受け取り、画面（標準出力）かファイルへそのまま書く
// --dir <ログの置き場> --tag <名前>
// --mode console|file  書き先。file のときは --out <ファイル> にバイト列をそのまま書く
// --when first|eof     最初のかたまりが届いたら書くか、送り手が閉じてから書くか
// --delay <ms>         書く前に待つ
// --post <ms>          書いた後に待ってから終わる
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { makeLogger, parseArgs, sleep } from './console.ts';

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
	else await new Promise<void>((resolve) => process.stdout.write(data, () => resolve()));
	await sleep(Number(args.post ?? 0));
	log('before-exit');
	process.exit(0);
}

process.stdin.on('data', (chunk: Uint8Array) => {
	chunks.push(chunk);
	if (when === 'first') void flush();
});
process.stdin.on('end', () => void flush());
