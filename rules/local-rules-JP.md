# ローカルルール

このプロジェクトでだけ通る決めごと。共通ルールと食い違う箇所は、ここに書いたものが優先する

> 📅 作成: 2026-10-03 / 更新: 2026-10-07

[⌂](../README-JP.md)

[English](local-rules.md)

1. [言語とリンク](#1-言語とリンク)
2. [フォルダ構成とファイル名](#2-フォルダ構成とファイル名)
3. [Issue と公開](#3-issue-と公開)

## 1. 言語とリンク

### 上書きする共通ルール: 「生成する文言の言語」

- **資料は英語版を主にし、日本語版を `-JP` を付けた名前で並べる**（`README.html` と `README-JP.html`）
- **英語版は英語版に、日本語版は日本語版にリンクする**
- **同じ資料の英語版と日本語版を相互にリンクする**。本文の先頭とフッターの両方に置く
- **片方を直したら、もう片方も同じ回に直す**
- 応答・コメント・スクリプトの表示は共通ルールどおり日本語

理由: bun の開発者に読んでもらう証拠資料のため。

## 2. フォルダ構成とファイル名

### 上書きする共通ルール: 「プロジェクトフォルダ構成」「ファイル名」「ローカルルール（プロジェクトルール）」

```text
README.html / README-JP.html
plan/solve-bun-codepage-problem.html / -JP.html
research/reproduce-issue-43660.html / -JP.html
rules/local-rules.html / local-rules-JP.html
AGENTS.md
```

- **`notes/` を使わない**。計画は `plan/`、調査結果は `research/`、ローカルルールは `rules/` に置く
- **ファイル名は英語にし、番号（`p yymmdd-nn`）を付けない**
- **`AGENTS.md` は日本語版の `rules/local-rules-JP.md` を取り込む**
- **html2md は全対象を渡す**: `html2md --dir plan --dir rules --dir research --extra README-JP.html`

理由: 計画は 1 本だけで、公開の URL を読みやすくするため。エージェントへの指示は利用者と同じ言語で読ませるため。

## 3. Issue と公開

- **新しい Issue で「コンソールのコードページに触らない実装」を依頼する**。[oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) とは、双方に相互の関連を書き足す
- **投稿の前に次をすべて満たす**
    - 実測した結果の表がそろい、第三者が再現手順を追える
    - 本文と貼るログに、ローカルのフルパスが入っていない
    - 本文の案を利用者が確認し、「送って」「公開して」の指示を受けている
- **GitHub Pages は public リポジトリで公開する**

### 上書きする共通ルール: 「gitブランチ」「develop→release→masterのマージ」

- **ブランチは develop だけを使う。GitHub Pages も develop から公開し、release と master は作らない**

理由: 資料を GitHub Pages で公開するだけのプロジェクトで、配布する版を分ける必要がないため。

[⌂](../README-JP.md)

[English](local-rules.md)
