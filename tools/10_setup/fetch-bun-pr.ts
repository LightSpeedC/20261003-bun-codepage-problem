// Download the Windows x64 build of a Bun pull request from Bun's CI (Buildkite), the same way the bun-pr package does.
// bun の PR の Windows x64 のビルドを、bun の CI（Buildkite）から取る。bun-pr パッケージと同じ手順。
// Usage: node tools/10_setup/fetch-bun-pr.ts <PR number> <zip to write>
// 使い方: node tools/10_setup/fetch-bun-pr.ts <PR の番号> <書き出す zip>
// Steps: PR head commit (GitHub) -> "buildkite/bun" status -> build jobs -> windows-x64-build-bun -> bun-windows-x64.zip
// 手順: PR の先頭コミット（GitHub） → "buildkite/bun" の状態 → ビルドのジョブ → windows-x64-build-bun → bun-windows-x64.zip
// Buildkite answers these requests from Node.js fetch, but sends a login page to PowerShell, so this part is in Node.js.
// Buildkite は Node.js の fetch には答えるが、PowerShell にはログイン画面を返すため、この部分は Node.js で書く。
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [pr, out] = process.argv.slice(2);
if (!pr || !out) throw new Error('使い方: node tools/10_setup/fetch-bun-pr.ts <PR の番号> <書き出す zip>');

async function json(url: string): Promise<any> {
	const r = await fetch(url, { headers: { 'User-Agent': '20261003-bun-codepage-problem' } });
	if (!r.ok) throw new Error(`${r.status} ${url}`);
	return r.json();
}

const pull = await json(`https://api.github.com/repos/oven-sh/bun/pulls/${pr}`);
const head: string = pull.head.sha;
const statuses: any[] = await json(`https://api.github.com/repos/oven-sh/bun/commits/${head}/statuses?per_page=100`);
const target = statuses.find((s) => s.context === 'buildkite/bun')?.target_url as string | undefined;
if (!target) throw new Error(`PR #${pr} の先頭コミット ${head} に Buildkite のビルドが無い`);
const buildId = target.split('/').at(-1)!.split('#')[0];
const jobs: any[] = (await json(`https://buildkite.com/bun/bun/builds/${buildId}/data/jobs`)).records ?? [];
const job = jobs.find((j) => j.step_key === 'windows-x64-build-bun');
if (!job?.base_path) throw new Error(`ビルド ${buildId} に windows-x64-build-bun のジョブが無い`);
const artifacts: any[] = await json(`https://buildkite.com${job.base_path}/artifacts`);
const zip = artifacts.find((a) => a.file_name === 'bun-windows-x64.zip');
if (!zip?.url) throw new Error(`ビルド ${buildId} に bun-windows-x64.zip が無い`);

const r = await fetch(new URL(zip.url, 'https://buildkite.com'), { headers: { 'User-Agent': '20261003-bun-codepage-problem' } });
if (!r.ok) throw new Error(`${r.status} ${zip.url}`);
const bytes = Buffer.from(await r.arrayBuffer());
// Check the download against the SHA-1 that Buildkite lists for the artifact.
// 取ったものを、Buildkite が成果物に付けている SHA-1 と照らし合わせる。
const sha1 = createHash('sha1').update(bytes).digest('hex');
if (sha1 !== zip.sha1sum) throw new Error(`SHA-1 が合わない: ${sha1} / ${zip.sha1sum}`);
writeFileSync(out, bytes);
console.log(`PR #${pr} 先頭コミット ${head.slice(0, 9)} / Buildkite ${buildId} / ${zip.file_name} ${bytes.length} バイト / SHA-1 一致`);
