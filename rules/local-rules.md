# Local rules

Rules that apply only to this project. Where they differ from the common rules, these take precedence

> 📅 Created: 2026-10-03 / Updated: 2026-10-09

[⌂](../README.md)

[日本語](local-rules-JP.md)

1. [Language and links](#1-language-and-links)
2. [Folder layout and file names](#2-folder-layout-and-file-names)
3. [Issue and publishing](#3-issue-and-publishing)

## 1. Language and links

### Overrides the common rule on the language of generated text

- **English is the primary version of each document; the Japanese version sits beside it with a `-JP` suffix** (`README.html` and `README-JP.html`)
- **English documents link to English documents, Japanese to Japanese**
- **The English and Japanese versions of a document link to each other**, at the top of the body and in the footer
- **When one version changes, update the other in the same pass**
- **Source code comments are written in English first, followed by Japanese**
- Agent responses and script messages stay in Japanese, as in the common rules

Reason: these are evidence documents meant to be read by the Bun developers, and they read the test code too.

## 2. Folder layout and file names

### Overrides the common rules on folder layout, file names and local rules

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

- **Do not use `notes/`**. The plan lives in `plan/`, research results in `research/` (test evidence in `research/evidence/`), issue drafts in `issue/`, local rules in `rules/`
- **File names are English, without a number prefix**
- **`AGENTS.md` includes the Japanese `rules/local-rules-JP.md`**
- **Pass every target to html2md**: `html2md --dir plan --dir rules --dir research --dir issue --extra README-JP.html`

Reason: there is only one plan, and short English names keep the published URLs readable. Agents read their instructions in the same language as the user.

## 3. Issue and publishing

- **Open a new issue asking for an implementation that never touches the console code page**, and add cross-references between it and [oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) in both directions
- **Before posting, all of the following must hold**
    - The measured result tables are complete, and a third party can follow the reproduction steps
    - Neither the text nor any pasted log contains a local full path
    - The comments on related issues and the PRs they reference have been read, and the text takes them into account
    - The user has reviewed the draft and explicitly said to send or publish it
- **GitHub Pages is published from a public repository**

### Overrides the common rules on git branches and on merging develop → release → master

- **Use only the develop branch. GitHub Pages is published from develop, and release and master are not created**

Reason: this project only publishes documents with GitHub Pages, so there are no separate released versions to keep apart.

### Overrides the common rules on making one fix at a time with confirmation, and on confirming serious operations

- **When a piece of work is finished, commit and push it without waiting to be told**. The words "commit" and "push" are not needed
- **A piece of work is what answers one instruction from the user**. Commit only after the checks pass (html2md, check-markdown, check-contrast; the full test run when the test code changed)
- **Commit only the files changed by that work**. Name them in `git add <path>` and check with `git diff --cached --name-only`
- **After pushing, wait until GitHub Pages has rebuilt and the published page shows the change, then report**
- **Operations that are hard to undo still need confirmation**: posting to Bun (issues and comments, under the conditions above), `git reset`, `--amend`, force push, and deleting files not named in the instruction
- Do not commit `research/evidence_last/`

Reason: this project publishes documents with GitHub Pages for the Bun developers to read, and nothing reaches the published pages until it is pushed.

### Cron job that watches for replies

- **The expression is `0 5-23/3 * * *`** (5:00, 8:00, 11:00, 14:00, 17:00, 20:00 and 23:00 JST). The prompt is in Japanese, the language agents read their instructions in: 「定期確認: plan/solve-bun-codepage-problem-JP.html の「返事を見張る」の節を読み、その手順で oven-sh/bun の返事を確かめる。」
- **When the session is reopened, or the job expires after 7 days, recreate it without waiting to be told**. The procedure lives in the "[Watching for replies](../plan/solve-bun-codepage-problem.md#7-steps)" section of the plan, not here

Reason: cron jobs live only inside the session and expire after 7 days, and the common rules recreate only the jobs defined in the local rules.

[⌂](../README.md)

[日本語](local-rules-JP.md)
