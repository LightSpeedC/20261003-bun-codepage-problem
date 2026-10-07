# Local rules

Rules that apply only to this project. Where they differ from the common rules, these take precedence

> 📅 Created: 2026-10-03 / Updated: 2026-10-04

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
- Agent responses, comments and script messages stay in Japanese, as in the common rules

Reason: these are evidence documents meant to be read by the Bun developers.

## 2. Folder layout and file names

### Overrides the common rules on folder layout, file names and local rules

```text
README.html / README-JP.html
plan/solve-bun-codepage-problem.html / -JP.html
research/reproduce-issue-43660.html / -JP.html
rules/local-rules.html / local-rules-JP.html
AGENTS.md
```

- **Do not use `notes/`**. The plan lives in `plan/`, research results in `research/`, local rules in `rules/`
- **File names are English, without a number prefix**
- **`AGENTS.md` includes the Japanese `rules/local-rules-JP.md`**
- **Pass every target to html2md**: `html2md --dir plan --dir rules --dir research --extra README-JP.html`

Reason: there is only one plan, and short English names keep the published URLs readable. Agents read their instructions in the same language as the user.

## 3. Issue and publishing

- **Open a new issue asking for an implementation that never touches the console code page**, and add cross-references between it and [oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) in both directions
- **Before posting, all of the following must hold**
    - The measured result tables are complete, and a third party can follow the reproduction steps
    - Neither the text nor any pasted log contains a local full path
    - The user has reviewed the draft and explicitly said to send or publish it
- **GitHub Pages is published from a public repository**

[⌂](../README.md)

[日本語](local-rules-JP.md)
