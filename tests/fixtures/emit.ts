// 送り手。TEXT を console.log で 1 行出す（bun#43660 と同じ出し方）
// --dir <ログの置き場> --tag <名前> --pre <書く前に待つ ms> --post <書いた後に待つ ms> --pidfile <pid の書き出し先>
import { TEXT, makeLogger, parseArgs, sleep, writePid } from './console.ts';

const args = parseArgs();
const log = makeLogger(args.dir, args.tag ?? 'emit');
writePid(args.pidfile);
log('start');
await sleep(Number(args.pre ?? 0));
log('before-write');
console.log(TEXT);
await sleep(Number(args.post ?? 0));
log('before-exit');
