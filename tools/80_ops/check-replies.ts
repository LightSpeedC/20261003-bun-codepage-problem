// Check oven-sh/bun #44693, #43660 and PR #43662 for activity (comments, reviews, commits, events, reactions) since the last check, and print only what is new.
// oven-sh/bun の #44693 ・ #43660 ・ PR #43662 で、前回の確認から増えたもの（コメント ・ レビュー ・ コミット ・ 出来事 ・ リアクション）だけを表示する。
// Activity by the account running gh (the one that posted) is left out. The time of the last check is kept in etc/check-replies.json (not in Git).
// gh を動かすアカウント（投稿した本人）の分は除く。前回の確認の時刻は etc/check-replies.json に残す（Git 管理外）。
// Usage: node tools/80_ops/check-replies.ts [--since <ISO 8601 time>]
// 使い方: node tools/80_ops/check-replies.ts [--since <ISO 8601 の時刻>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const stateFile = path.join(root, 'etc/check-replies.json');
const REPO = 'oven-sh/bun';
const TARGETS = [44693, 43660, 43662];

// Call the GitHub API through gh. Synchronous, so it always has a timeout.
// gh 経由で GitHub の API を呼ぶ。同期なので必ず timeout を付ける。
function gh(args: string[]): any {
	const out = execFileSync('gh', ['api', ...args], { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
	return JSON.parse(out);
}
// Every page of a list API, as one array.
// 一覧の API の全ページを 1 つの配列にする。
function pages(apiPath: string): any[] {
	return (gh(['--paginate', '--slurp', apiPath]) as any[][]).flat();
}

// yyyy/mm/dd hh:mm in JST.
// JST の yyyy/mm/dd hh:mm。
function jst(iso: string): string {
	const d = new Date(Date.parse(iso) + 9 * 3600_000).toISOString();
	return `${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)} ${d.slice(11, 16)}`;
}
const oneLine = (s: string | null | undefined, max = 300) => {
	const t = (s ?? '').replace(/\s+/g, ' ').trim();
	return t.length > max ? `${t.slice(0, max)}…` : t;
};

const sinceAt = process.argv.indexOf('--since');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
const since: string | undefined = sinceAt >= 0 ? process.argv[sinceAt + 1] : state?.lastCheck;
const now = new Date().toISOString();
function save() {
	mkdirSync(path.dirname(stateFile), { recursive: true });
	writeFileSync(stateFile, JSON.stringify({ lastCheck: now }, null, '\t') + '\n');
}
if (!since || Number.isNaN(Date.parse(since))) {
	if (sinceAt >= 0) throw new Error(`--since の時刻が読めない: ${since}`);
	save();
	console.log('前回の確認の記録が無いため、いまの時刻を基準として残した。次の回から新着を出す');
	process.exit(0);
}

const me: string = gh(['user']).login;

// Timeline events that are not activity worth reporting, or that are read from another API below.
// The timeline lists only some of a PR's reviews (23 of 53 on #43662), so reviews come from the reviews API.
// 報告に値しないタイムラインの出来事と、下で別の API から読むもの。
// タイムラインには PR のレビューの一部しか出ない（#43662 で 53 件中 23 件）ので、レビューはレビューの API から読む。
const IGNORED = new Set(['subscribed', 'unsubscribed', 'mentioned', 'line-commented', 'reviewed']);
const KIND: Record<string, string> = {
	commented: 'コメント', committed: 'コミット', 'cross-referenced': '参照された',
	labeled: 'ラベル追加', unlabeled: 'ラベル削除', closed: 'close', reopened: 'reopen', merged: 'マージ',
	renamed: 'タイトル変更', assigned: '担当者の割り当て', review_requested: 'レビューの依頼',
	head_ref_force_pushed: 'force push', ready_for_review: 'レビュー待ちへ', convert_to_draft: '下書きへ',
};

const EMOJI: Record<string, string> = {
	'+1': '👍', '-1': '👎', laugh: '😄', hooray: '🎉', confused: '😕', heart: '❤️', rocket: '🚀', eyes: '👀',
};

type Item = { n: number; at: string; who: string; kind: string; text: string; url: string };
const items: Item[] = [];
const titles: string[] = [];
for (const n of TARGETS) {
	const issue = gh([`repos/${REPO}/issues/${n}`]);
	const isPr = Boolean(issue.pull_request);
	titles.push(`${isPr ? 'PR ' : ''}#${n}（${issue.state}・コメント ${issue.comments} 件）${issue.title}`);
	const page = `https://github.com/${REPO}/${isPr ? 'pull' : 'issues'}/${n}`;
	for (const e of pages(`repos/${REPO}/issues/${n}/timeline?per_page=100`)) {
		if (IGNORED.has(e.event)) continue;
		const at: string | undefined = e.created_at ?? e.submitted_at ?? e.committer?.date;
		const who: string = e.actor?.login ?? e.user?.login ?? e.author?.name ?? '?';
		if (!at || Date.parse(at) <= Date.parse(since) || who === me) continue;
		let text = '';
		if (e.event === 'commented') text = oneLine(e.body);
		else if (e.event === 'committed') text = oneLine(e.message?.split('\n')[0]);
		else if (e.event === 'cross-referenced') text = `${e.source?.issue?.repository?.full_name ?? ''}#${e.source?.issue?.number ?? '?'} ${oneLine(e.source?.issue?.title)}`;
		else if (e.event === 'labeled' || e.event === 'unlabeled') text = e.label?.name ?? '';
		else if (e.event === 'renamed') text = `${e.rename?.from} → ${e.rename?.to}`;
		const url: string = e.html_url ?? e.source?.issue?.html_url ?? page;
		items.push({ n, at, who, kind: KIND[e.event] ?? e.event, text, url });
	}
	// Reactions on the issue body and on its comments, including our own comments (a reaction to them is a reply too).
	// Reactions are not in the timeline. The reactions API is called only where the rollup count says there are some.
	// Reactions on PR line comments are left out: many calls for little to learn.
	// 本文とコメントに付いたリアクション。こちらのコメントも含む（そこへの反応も返事の 1 つ）。
	// リアクションはタイムラインに出ない。リアクションの API は、件数の集計が 0 でないところだけ呼ぶ。
	// PR の行へのコメントに付いたものは除く。呼び出しが増えるわりに得るものが少ない。
	const reacted: { api: string; where: string; url: string }[] = [];
	if (issue.reactions?.total_count) reacted.push({ api: `repos/${REPO}/issues/${n}/reactions?per_page=100`, where: '本文', url: page });
	for (const c of pages(`repos/${REPO}/issues/${n}/comments?per_page=100`)) {
		if (c.reactions?.total_count) {
			reacted.push({ api: `repos/${REPO}/issues/comments/${c.id}/reactions?per_page=100`, where: `${c.user?.login} のコメント「${oneLine(c.body, 60)}」`, url: c.html_url });
		}
	}
	for (const t of reacted) {
		for (const r of pages(t.api)) {
			if (Date.parse(r.created_at) <= Date.parse(since) || r.user?.login === me) continue;
			items.push({ n, at: r.created_at, who: r.user?.login ?? '?', kind: `リアクション ${EMOJI[r.content] ?? r.content}`, text: `${t.where}に`, url: t.url });
		}
	}
	// Reviews and line comments on a PR are read here.
	// A review with an empty body only holds line comments, which are listed one by one below, so it is left out.
	// PR のレビューと行へのコメントは、ここで読む。
	// 本文が空のレビューは行へのコメントを束ねるだけの器で、行へのコメントは下で 1 件ずつ出すので除く。
	if (isPr) {
		for (const r of pages(`repos/${REPO}/pulls/${n}/reviews?per_page=100`)) {
			if (!r.submitted_at || Date.parse(r.submitted_at) <= Date.parse(since) || r.user?.login === me) continue;
			if (r.state === 'COMMENTED' && !oneLine(r.body)) continue;
			items.push({ n, at: r.submitted_at, who: r.user?.login ?? '?', kind: `レビュー（${r.state}）`, text: oneLine(r.body), url: r.html_url });
		}
		for (const c of pages(`repos/${REPO}/pulls/${n}/comments?per_page=100`)) {
			if (Date.parse(c.created_at) <= Date.parse(since) || c.user?.login === me) continue;
			items.push({ n, at: c.created_at, who: c.user?.login ?? '?', kind: `行へのコメント（${c.path}）`, text: oneLine(c.body), url: c.html_url });
		}
	}
}

items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
console.log(`確認した時刻: ${jst(now)} JST ／ 前回の確認: ${jst(since)} JST`);
for (const t of titles) console.log(`  ${t}`);
if (items.length === 0) {
	console.log('新着なし');
} else {
	console.log(`新着 ${items.length} 件`);
	for (const i of items) {
		console.log(`[#${i.n}] ${jst(i.at)} JST ${i.kind} ${i.who}`);
		if (i.text) console.log(`  ${i.text}`);
		console.log(`  ${i.url}`);
	}
}
save();
