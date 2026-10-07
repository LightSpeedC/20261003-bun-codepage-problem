# Bun console code page problem

Evidence that Bun changes the Windows console code page, compared with Node.js and Deno

> 📅 Created: 2026-10-03 / Updated: 2026-10-07

[⌂](../)

[日本語](README-JP.md)

On Windows, the console code page is shared by every process attached to the same console window. On Japanese Windows, a freshly opened `cmd` window starts at code page 932.

The garbled output of Bun piped to Bun, reported in bun#43660, is the tip of the iceberg. The root problem is that Bun changes the console code page while it runs. This project collects reproducible evidence of the harm that change causes, and files a Bun issue asking Bun not to change the code page, which also fixes bun#43660. Node.js and Deno are measured the same way for comparison.

Bun maintainers: start with [Code page test results](research/codepage-test-results.md).

To run the same tests on any Windows PC after cloning (nothing installed on the PC is used):

```batch
tools\10_setup\setup-runtimes.cmd   &rem download Bun, Bun canary, Node.js, Deno and pwsh into _bin\, then npm ci
tools\40_test\run-tests.cmd         &rem run every test at code pages 932 and 437 into research\evidence_last\
_bin\node\node tools\50_run\compare-evidence.ts   &rem compare research\evidence_last\ with research\evidence\
```

1. [Plan](#1-plan)
2. [Research](#2-research)
3. [Project rules](#3-project-rules)
4. [Related issues](#4-related-issues)

## 1. Plan

- [Solving the Bun code page problem](plan/solve-bun-codepage-problem.md)
- [Draft of the new issue](issue/new-issue-draft.md)

## 2. Research

- [Code page test results](research/codepage-test-results.md)
- [Reproducing bun#43660](research/reproduce-issue-43660.md)

## 3. Project rules

- [Local rules](rules/local-rules.md)

## 4. Related issues

- [oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) — garbled output when piping Bun to Bun

[⌂](../)

[日本語](README-JP.md)
