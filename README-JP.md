# bun のコンソール・コードページ問題

bun が Windows のコンソールのコードページを書き換える証拠を、node ・ deno と比べて集める

> 📅 作成: 2026-10-03 / 更新: 2026-10-07

[⌂](../)

[English](README.md)

Windows のコンソールのコードページは、同じ窓につながる全プロセスで共有される。日本語版 Windows では、開いた直後の `cmd` の窓は 932 である。

bun#43660 で報告した bun 同士のパイプの文字化けは、氷山の一角である。根本の問題は、bun が実行中にコンソールのコードページを変えること。このプロジェクトは、その変更がもたらす害の証拠を再現できる形で集め、コードページを変えないよう求める Issue を bun へ出す。そうすれば bun#43660 も同時に直る。node と deno も同じ方法で測り、比べる。

bun の開発者向けの入口は [コードページ試験の結果](research/codepage-test-results-JP.md)。

clone したあと、どの Windows の PC でも同じ試験を流せる（PC に入っているものは使わない）。

1. 準備: bun ・ bun canary ・ node ・ deno ・ pwsh を `_bin\` に取り、`npm ci` を流す。`tools\10_setup\setup-runtimes.cmd`
2. 試験: コードページ 932 と 437 で全件を流し、結果を `research\evidence_last\` に置く。`tools\40_test\run-tests.cmd`
3. 比較: `research\evidence_last\` と、commit してある `research\evidence\` を比べる。`_bin\node\node tools\50_run\compare-evidence.ts`

1. [計画](#1-計画)
2. [調査](#2-調査)
3. [プロジェクトのルール](#3-プロジェクトのルール)
4. [関連する Issue](#4-関連する-issue)

## 1. 計画

- [bun のコードページ問題を解決したい](plan/solve-bun-codepage-problem-JP.md)
- [新しい Issue の下書き](issue/new-issue-draft-JP.md)

## 2. 調査

- [コードページ試験の結果](research/codepage-test-results-JP.md)
- [bun#43660 の再現](research/reproduce-issue-43660-JP.md)

## 3. プロジェクトのルール

- [ローカルルール](rules/local-rules-JP.md)

## 4. 関連する Issue

- [oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) — bun 同士のパイプで文字化けする

[⌂](../)

[English](README.md)
