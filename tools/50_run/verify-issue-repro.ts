// Issue の本文に載せる再現コマンドを、そのまま新しい窓で流して画面を出す
// 本文の「実際」「期待」と同じ表示になるかを確かめる
// 使い方: node tools/50_run/verify-issue-repro.ts [回数] [開始コードページ]
// 開始コードページを渡すと、この確認のためだけに起こした窓の中で chcp してから流す
// （英語版 Windows の既定 437 で開発者が再現できるかを見るため。窓はこの確認専用で、ほかのプロセスと共有しない）
import { RUNTIMES, runInNewConsole } from '../../tests/harness/new-console.ts';

const times = Number(process.argv[2] ?? 3);
const startCp = process.argv[3];
const w = "console.log('abc \\u6771\\u4eac\\u5927\\u962a xyz'); setTimeout(() => {}, 2000)";
const r = "let d = ''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => setTimeout(() => process.stdout.write(d), 800))";
for (const name of ['bun', 'canary', 'node'] as const) {
	for (let i = 1; i <= times; i++) {
		const x = RUNTIMES[name].cmd;
		const res = runInNewConsole(`verify-${name}-${i}`, [
			...(startCp ? [`chcp ${startCp} >nul`] : []),
			`${x} -e "${w}" | (ping -n 2 127.0.0.1 >nul & ${x} -e "${r}")`,
			'chcp',
			'{node} "{fix}/probe.ts" --dir "{dir}" --tag after --screen "{dir}/screen.json"',
		]);
		console.log(`=== ${name} ${i}`);
		console.log(res.screen.filter(Boolean).join('\n'));
	}
}
