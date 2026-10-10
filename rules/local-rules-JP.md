# ローカルルール

このプロジェクトでだけ通る決めごと。共通ルールと食い違う箇所は、ここに書いたものが優先する

> 📅 作成: 2026-10-03 / 更新: 2026-10-09

[⌂](../README-JP.md)

[English](local-rules.md)

1. [言語とリンク](#1-言語とリンク)
2. [フォルダ構成とファイル名](#2-フォルダ構成とファイル名)
3. [Issue と公開](#3-issue-と公開)

## 1. 言語とリンク

### 上書きする共通ルール: 「生成する文言の言語」

- **資料は英語版を主にし、日本語版を `-JP` を付けた名前で並べる**（`README.html` と `README-JP.html`）
- **英語版は英語版に、日本語版は日本語版にリンクする**
- **同じ資料の英語版と日本語版を相互にリンクする**。本文の先頭とフッタの両方に置く
- **片方を直したら、もう片方も同じ回に直す**
- **ソースのコメントは英語を先に書き、日本語を併記する**
- 応答とスクリプトの表示は共通ルールどおり日本語

理由: bun の開発者に読んでもらう証拠資料のため。試験コードも開発者が読む。

## 2. フォルダ構成とファイル名

### 上書きする共通ルール: 「プロジェクトフォルダ構成」「ファイル名」「ローカルルール（プロジェクトルール）」

```text
README.html / README-JP.html
plan/solve-bun-codepage-problem.html / -JP.html
research/codepage-test-results.html / -JP.html
research/reproduce-issue-43660.html / -JP.html
research/evidence/
issue/bun-44693.html / -JP.html
rules/local-rules.html / local-rules-JP.html
AGENTS.md
```

- **`notes/` を使わない**。計画は `plan/`、調査結果は `research/`（試験の証拠は `research/evidence/`）、Issue の下書きは `issue/`、ローカルルールは `rules/` に置く
- **ファイル名は英語にし、番号（`p yymmdd-nn`）を付けない**
- **`AGENTS.md` は日本語版の `rules/local-rules-JP.md` を取り込む**
- **html2md は全対象を渡す**: `html2md --dir plan --dir rules --dir research --dir issue --extra README-JP.html`

理由: 計画は 1 本だけで、公開の URL を読みやすくするため。エージェントへの指示は利用者と同じ言語で読ませるため。

## 3. Issue と公開

- **新しい Issue で「コンソールのコードページに触らない実装」を依頼する**。[oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) とは、双方に相互の関連を書き足す
- **投稿の前に次をすべて満たす**
    - 実測した結果の表がそろい、第三者が再現手順を追える
    - 本文と貼るログに、ローカルのフルパスが入っていない
    - 関連する Issue のコメントと、そこから参照されている PR を読み、本文がそれらを踏まえている
    - 本文の案を利用者が確認し、「送って」「公開して」の指示を受けている
- **GitHub Pages は public リポジトリで公開する**

### 上書きする共通ルール: 「gitブランチ」「develop→release→masterのマージ」

- **ブランチは develop だけを使う。GitHub Pages も develop から公開し、release と master は作らない**

理由: 資料を GitHub Pages で公開するだけのプロジェクトで、配布する版を分ける必要がないため。

### 上書きする共通ルール: 「修正は1点ずつ、確認を重視」「重大な操作の確認方法」

- **作業が一区切りついたら、指示を待たずに commit して push する**。「commitして」「pushして」の語は要らない
- **一区切りは、利用者の 1 回の指示に応えた作業**。検査（html2md ・ check-markdown ・ check-contrast。試験のコードを変えたら全件の試験）を通してから commit する
- **載せるのは、その作業で自分が変えたファイルだけ**。`git add <path>` で名指しし、`git diff --cached --name-only` で確かめる
- **push のあと、GitHub Pages の作り直しが終わって公開ページに反映されたことを確かめてから報告する**
- **取り消しにくい操作は、これまでどおり確認を取る**。bun への投稿（Issue ・ コメント。上の条件に従う）、`git reset` ・ `--amend` ・ force push、指示に無いファイルの削除
- `research/evidence_last/` は commit しない

理由: 資料を GitHub Pages で公開し、bun の開発者に読んでもらうプロジェクトで、push するまで公開ページに反映されないため。

### 返事を見張る cron

- **式は `0 5-23/3 * * *`**（5:00 ・ 8:00 ・ 11:00 ・ 14:00 ・ 17:00 ・ 20:00 ・ 23:00 JST）。指示文は「定期確認: plan/solve-bun-codepage-problem-JP.html の「返事を見張る」の節を読み、その手順で oven-sh/bun の返事を確かめる。」
- **セッションを開き直したとき・7 日で切れたときは、指示を待たずに作り直す**。手順は計画の「[返事を見張る](../plan/solve-bun-codepage-problem-JP.md#7-進め方)」の節に置き、ここには書かない

理由: cron はセッションの中だけで生き、7 日で切れる。共通ルールでは、作り直すのはローカルルールに定義があるものだけ。

[⌂](../README-JP.md)

[English](local-rules.md)
