// Relay: reads until the writer closes the pipe, holds the data for a set time, then passes it on (node wait in T5).
// 中継役。送り手が閉じるまで受け取り、決めた時間だけ持ってから流す（T5 の node wait）。
// --ms <time to hold> --dir <log folder> --tag <name>
// --ms <持つ時間> --dir <ログの置き場> --tag <名前>
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { makeLogger, parseArgs, sleep } from './console.ts';

const args = parseArgs();
const log = makeLogger(args.dir, args.tag ?? 'hold');
log('start');
const chunks: Uint8Array[] = [];
process.stdin.on('data', (chunk: Uint8Array) => chunks.push(chunk));
process.stdin.on('end', async () => {
	await sleep(Number(args.ms ?? 0));
	log('before-write');
	process.stdout.write(Buffer.concat(chunks), () => {
		log('before-exit');
		process.exit(0);
	});
});
