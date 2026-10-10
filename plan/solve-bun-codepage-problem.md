# Solving the Bun code page problem

bun#43660 is the tip of the iceberg. The root problem is that Bun changes the console code page. Measure the harm it causes, and file an issue asking Bun not to change it

> 📅 Created: 2026-10-03 / Updated: 2026-10-10

[⌂](../README.md)

[日本語](solve-bun-codepage-problem-JP.md)

1. [Goal](#1-goal)
2. [Outline of the issue](#2-outline-of-the-issue)
3. [Baseline and expected behavior](#3-baseline-and-expected-behavior)
4. [Test cases](#4-test-cases)
5. [Test layout](#5-test-layout)
6. [The same tests on any PC](#6-the-same-tests-on-any-pc)
7. [Steps](#7-steps)

## 1. Goal

1. **The earlier [oven-sh/bun#43660](https://github.com/oven-sh/bun/issues/43660) is the tip of the iceberg**. "Bun piped to Bun is garbled" is only one visible symptom
2. **The root problem is that Bun changes the console code page**. The code page belongs to the console window and is shared by every process attached to it
3. **Changing it causes a lot of harm**. Each harm is shown by measurement (the list of harms in "Outline of the issue")
4. **So Bun should not change the code page**. A new issue is filed about changing the code page itself
5. **That also fixes bun#43660**. The new issue and bun#43660 are cross-referenced in both directions

## 2. Outline of the issue

### 1. Background

bun#43660 reported that in a cp932 console, the output of Bun | Bun is garbled and 65001 is left behind after exit. That was one symptom.

### 2. Root problem

Bun rewrites the console input and output code pages while it runs. Because the code page is shared by every process in the same console, the effect reaches beyond Bun itself.

### 3. Harms and evidence

✅ observed / ⬜ not yet measured.

| Harm | Evidence | Status |
|---|---|---|
| H1 | The output of a piped peer is garbled (the bun#43660 symptom). Research with 1.4.2 and canary, T2, T5 | ✅ observed |
| H2 | The result changes from run to run, decided by the start and exit order. The three research runs, T5 | ✅ observed |
| H3 | 65001 is left on the console after exit. Research, T1, T5 | ✅ observed |
| H4 | Other processes in the same console are affected: cmd misreads its Shift_JIS script, and messages such as `pause` switch to English. Research, T4 | ✅ observed |
| H5 | After another Bun process has put the console back to 932, Bun writes raw UTF-8 bytes and they are garbled (it does not use `WriteConsoleW`). Research, 1.4.2 run 3, T5 | ✅ observed |
| H6 | A forced kill leaves the code page changed. T3 | ✅ observed |
| H7 | It happens even when the two Bun processes are not directly connected (`bun \| node \| bun`). T5 | ✅ observed |

The observed results are in [Code page test results](../research/codepage-test-results.md) and [Reproducing bun#43660](../research/reproduce-issue-43660.md). The cause of H2 (decided by the start and exit order) was confirmed in T5.

### 4. Request

Do not change the console code page. Writing to the console with `WriteConsoleW` in UTF-16, and writing bytes unchanged to pipes and files, does not depend on the code page ("Expected behavior"). Node.js and Deno working correctly without changing it shows this is feasible (T1, T2).

### 5. bun#43660 is fixed too

If the code page is not changed, none of H1 to H7 happens. The bun#43660 symptom (H1) is among them.

## 3. Baseline and expected behavior

### Baseline console

A freshly opened `cmd` window on Japanese Windows (code page 932). The tests never change the code page themselves.

> [!NOTE]
> **IMPORTANT:** The AI agent's own console runs under ConPTY and already starts at 65001, so it is not the baseline. Each test creates a new console with `conhost.exe` and runs inside it. Results are written to files and read back. `conhost.exe` is named explicitly because, when Windows Terminal is the default terminal, a new console may also end up under ConPTY (not yet verified). bun#43660 was also reported with cmd.exe used directly, not Windows Terminal.

### Expected behavior

| Target | How to write / read |
|---|---|
| Output to a console | Pass UTF-16 to `WriteConsoleW` |
| Output to a pipe or file | Write the UTF-8 bytes as they are |
| Input from a console | Read UTF-16 with `ReadConsoleW` |
| Input from a pipe | Take the bytes as they arrive |

None of these depends on the code page, so there is no reason to change it. T1 confirmed that Node.js and Deno print Japanese correctly to a 932 console without ever changing the code page (whether they use `WriteConsoleW` internally was not examined).

### Reported in bun#43660, and reproduction here

| Reported | Here |
|---|---|
| When the starting code page is not 65001, Bun piped to Bun produces garbled output | Reproduced (both stable and canary) |
| It does not happen if either side is Node.js | Confirmed (T2: if either side is Node.js or Deno, 65001 is not left) |
| 65001 is left on the console after exit | Reproduced, though in some runs it was not left |

### Runtimes

| Runtime | Version | Role |
|---|---|---|
| Bun | 1.4.2+744846f84 | Under test (stable) |
| Bun canary | latest at setup time (1.4.3-canary.1+bbdc5a519 in the full run) | Under test. Placed in `_bin/bun-canary/` and called with PATH switched |
| Bun PR #43662 | 1.4.3-canary.1+576eb251a | The build of the PR that fixes bun#43660, to see what it fixes and what remains. Placed in `_bin/bun-pr-43662/` and called with PATH switched |
| Node.js | v26.10.0 | Reference |
| Deno | 2.9.7 | Reference |

## 4. Test cases

### Expected results

An implementation that follows the expected behavior gives the following for every case.

| Case | Harm shown | Expected |
|---|---|---|
| T1 | H3 | Both input and output stay at 932 before, during and after the run |
| T2 | H1 | In all 27 cases the reader receives the UTF-8 bytes unchanged (cases via Windows PowerShell 5.1 match Node.js \| Node.js) |
| T3 | H6 | Still 932 after a forced kill |
| T4 | H4 | The Shift_JIS cmd script prints Japanese correctly |
| T5 | H1, H2, H3, H7 | Whatever the start and exit order, the screen shows `abc 東京大阪 xyz` correctly and the console stays at 932 afterwards |
| T6 | All | Both the stable and the canary build meet the expectations of T1 to T5 |

- **Any deviation by Bun from these results is evidence for the issue**
- **Node.js and Deno meeting them shows the code page need not be touched**
- If Node.js or Deno deviates, reconsider whether it can serve as a reference

### T1. Code page over time

In the baseline console, record `GetConsoleCP` / `GetConsoleOutputCP` before, during and after the run. Each runtime reads the values during the run through its own FFI (read only): `bun:ffi` for Bun, `koffi` for Node.js, `Deno.dlopen` for Deno. Expected: 932 at every point.

### T2. Pipe combinations

| Axis | Values |
|---|---|
| Writer | Bun / Node.js / Deno |
| Reader | Bun / Node.js / Deno |
| Launched from | cmd / pwsh 7 / Windows PowerShell 5.1 (all inside the baseline console) |

3 × 3 × 3 = 27 cases. The reader writes the received bytes to a file unchanged, and they are compared with the expected UTF-8 bytes. Nothing is judged by how the screen looks.

> [!NOTE]
> **NOTE:** Windows PowerShell 5.1 turns non-ASCII characters into `?` when piping between native commands, even without Bun. For 5.1, Node.js | Node.js is the baseline and only differences specific to Bun are counted.

### T3. Leftover after a forced kill

Kill a waiting Bun process with `taskkill /F` and check that the console is back at 932.

### T4. Effect on neighboring processes in the same console

Right after Bun | Bun (normal exit and forced kill), check that a cmd script saved in Shift_JIS still prints Japanese correctly.

### T5. Reproduction with fixed ordering

Fix the order in which two or more processes start and exit by inserting delays, so the result does not depend on chance. Each process writes `GetConsoleCP` / `GetConsoleOutputCP` with a timestamp to a log right after start, right before writing, and right before exit (read only). The text sent is `abc 東京大阪 xyz` ("Tokyo Osaka"). It has an even number of characters (4 characters, 12 bytes), so when read as CP932 every 2 bytes become another character and no broken byte is left over. Garbled, it becomes `abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz`: the surrounding ASCII and the newline survive, and the correct and garbled forms can be told apart mechanically (computed with Node.js `TextDecoder('shift_jis')`; not yet checked against the console display).

| Shape | How the order is fixed | What it shows |
|---|---|---|
| `bun \| bun` | Start order: `ping -n 2 127.0.0.1 >nul` before one side starts. Exit order: `setTimeout` in the script | Start order × exit order × writing to the console or not |
| `bun \| node wait \| bun` | The Node.js process in the middle holds the data for a set time before passing it on | Whether it happens even when the two Bun processes are not directly connected (H7) |
| `node \| node wait \| node` | Same | Reference |
| `deno \| node wait \| deno` | Same | Reference |
| Same shape as bun#43660 | No fixed order (both started together with `-e`). Run 10 times | Whether the result changes from run to run (H2) |
| ww with other write APIs | The ww order, with the reader writing to the screen with `fs.writeSync(1)`, `fs.write(1)` or `Bun.write(Bun.stdout)`. Bun builds only | Whether the write APIs PR #43662 does not route through `WriteConsoleW` are garbled |

Expected results for `bun | bun` under the hypothesis (each Bun process saves the current value and sets 65001 at start, and restores the saved value at exit):

| Starts first | Exits first | Screen | After exit |
|---|---|---|---|
| Writer | Writer | Garbled | 65001 left behind |
| Writer | Reader | Correct | Back to 932 |
| Reader | Writer | Correct | Back to 932 |
| Reader | Reader | Correct | 65001 left behind |

Each combination runs three times, and the results are listed in run order. For the background, see [Reproducing bun#43660](../research/reproduce-issue-43660.md).

### T6. Version comparison

Run T1 to T5 with both the stable and the canary build of Bun. Node.js and Deno stay at one recorded version as the reference.

## 5. Test layout

```text
tests/
  codepage.test.ts      T1 to T5 (node:test, also run with bun test). Bun and canary are columns of the same table, which is T6
  fixtures/
    console.ts          shared read-only code page helpers (bun:ffi / koffi / Deno.dlopen)
    emit.ts             writer that prints abc 東京大阪 xyz with console.log
    sink.ts             reader that writes the received bytes unchanged to the screen or a file
    hold.ts             relay that holds the data for a set time before passing it on (node wait in T5)
    probe.ts            observer (Node.js): records the code page and reads the characters on the console screen
    neighbor-932.cmd    neighbor process for 932 (Shift_JIS + CRLF)
    neighbor-437.cmd    neighbor process for 437 (CP437 + CRLF)
  harness/
    new-console.ts      creates a new console with conhost.exe, runs a case inside it and waits for it to end
    judge.ts            judges the screen, bytes and code page, and records them in results.jsonl in the evidence folder
  manual/
    issue-43660-repro.cmd   runs the same shape of command as bun#43660 by hand (screen checked by eye)
tools/10_setup/
  setup-runtimes.ps1 / .cmd   setup phase: downloads the runtimes into _bin/ and runs npm ci
  fetch-bun-pr.ts       downloads the Windows x64 build of a Bun PR from Bun's CI (Buildkite)
tools/40_test/
  run-tests.ps1 / run-tests.cmd   test phase: runs node --test and bun test at 932 and 437
tools/50_run/
  summarize-results.ts  prints the material for the result tables from the evidence folder
  compare-evidence.ts   compares the verdicts in research/evidence_last/ and research/evidence/
  build-result-tables.ts builds the result tables from research/evidence/, linking to the evidence files and the test code
  verify-issue-repro.ts runs the reproduction command in the issue text in new consoles and prints the screen
```

- Each fixture is a single `.ts` file that runs on Bun, Node.js and Deno
- Results are judged by the bytes in the output files, written under `tmp/`
- Every synchronous wait for a child process has a `timeout`
- Test names state the reproduction condition
- The expectations are the expected behavior. Bun cases fail until Bun is fixed, so they are marked todo: the failures are recorded as evidence without stopping the suite. bun test does not run todo cases, so the evidence for Bun comes from node --test
- The screen is judged by the observer reading the console characters with `ReadConsoleOutputCharacterW`. No one needs to look at it

## 6. The same tests on any PC

Anyone who clones the repository on Windows can run the same tests. Nothing depends on the Bun, Node.js or Deno installed on that PC.

### Setup phase

`tools/10_setup/setup-runtimes.cmd` (backed by the ps1 of the same name) downloads pinned versions from the official sources and places them under `_bin/`, which is not tracked by Git. Anything already in place is not downloaded again.

| Runtime | Version | Location |
|---|---|---|
| Bun | 1.4.2 | `_bin/bun/` |
| Bun canary | latest at setup time (it cannot be pinned, so the version is recorded) | `_bin/bun-canary/` |
| Node.js | v26.10.0 | `_bin/node/` |
| Deno | 2.9.7 | `_bin/deno/` |
| pwsh | 7.6.6 | `_bin/pwsh/` |
| Bun PR #43662 | build of the PR head commit | `_bin/bun-pr-43662/`. The artifact from Bun's CI (Buildkite), fetched by `tools/10_setup/fetch-bun-pr.ts` and checked against its SHA-1 |

Then `npm ci` runs with the npm in `_bin/node/` (for koffi and type checking).

### Test phase

1. `tools/40_test/run-tests.cmd` puts the downloaded runtimes on PATH with `set PATH=…\_bin\…;%PATH%`
2. `where` confirms that bun, node, deno and pwsh resolve to the ones under `_bin/`. Otherwise it stops
3. The version of each runtime (`bun --revision`, `node -v`, `deno --version`, pwsh) is written to `versions.txt`
4. All tests run. The per-case batch file (`run.cmd`) calls the runtimes by name only, and every path is relative to `%~dp0`. No path containing a user name appears anywhere

### Decisions

- **PATH:** the downloaded runtimes always go first on PATH. Whatever is installed on the PC is not used
- **Bun and canary:** both are named `bun`, so they run in separate passes with PATH switched. The canary pass runs only the cases that involve Bun
- **Starting code page:** both 932 and 437. Each dedicated test console runs `chcp` first (the console is not shared with anything else). Verdicts are relative to the starting value
- **Neighbor process:** one for 932 (`neighbor: 東京大阪` in Shift_JIS) and one for 437 (`neighbor: café` in CP437)
- **pwsh:** downloaded and used
- **Passes:** four per code page: node --test (Bun stable, Node.js, Deno), node --test (canary and the build of PR #43662; only cases involving Bun), bun test (the Node.js and Deno cases)
- **Logs:** no date or pid. Only the elapsed time (ms) from the start of each case, so two runs can be compared with diff
- **Environment file:** each pass writes `environment.json` with the starting code page, tool names, tool versions and the run time in UTC Z format (for example `2026-10-07T03:45:12Z`). This is the only file with a date

### Where the evidence goes

| Location | Handling |
|---|---|
| `research/evidence_last/` | Overwritten on every run. Not excluded by Git, but not committed |
| `research/evidence/` | Committed as the baseline. Copied from `evidence_last` after it is checked, when the user says so |

- Contents: `versions.txt`, the result records (for node --test and bun test), and per case the `run.cmd`, logs, the screen read back, and the bytes the reader received
- `tools/50_run/compare-evidence.ts` compares the two and shows only differences in the verdicts (✅ / ❌), not in timings
- Before saving, the evidence is checked for paths that contain a user name

### Done together with this

- Source comments in English first, followed by Japanese (local rule)
- Links from the cells of the result tables to the relevant test code lines and to the evidence files in `research/evidence/`
- Separate commits for the mechanism, the evidence, and the document links

## 7. Steps

1. Install Deno (done: 2.9.7)
2. Build the fixtures and the harness, and confirm with T1 that the new-console mechanism works (done)
3. Add T1, T2, T3, T4 and T5 one at a time, running the full suite each time (done)
4. Publish the result tables in English and Japanese, and update the status of the harms (H1 to H7) (done: [Code page test results](../research/codepage-test-results.md))
5. Compare versions with T6 (done: stable and canary side by side in the same tables)
6. Draft the issue following "Outline of the issue", and file it only after the conditions in the local rule "Issue and publishing" are met (done: posted as [bun#44693](https://github.com/oven-sh/bun/issues/44693); text in [Issue bun#44693](../issue/bun-44693.md))
7. Add a cross-reference to the new issue on bun#43660 (done: [comment](https://github.com/oven-sh/bun/issues/43660#issuecomment-6036544127))
8. Measure the build of PR #43662, the fix for bun#43660, with the test suite, and comment on #44693 with what it fixes and what remains (done: the Conclusion of the results has a column for the PR; posted as [a comment on #44693](https://github.com/oven-sh/bun/issues/44693#issuecomment-6040994500) and [a comment on PR #43662](https://github.com/oven-sh/bun/pull/43662#issuecomment-6040869802), text in [Issue bun#44693](../issue/bun-44693.md#4-follow-up-comment-on-bun44693httpsgithubcomoven-shbunissues44693-pr-43662httpsgithubcomoven-shbunpull43662); #44693 was filed without noticing the PR)
9. Answer robobun's question on PR #43662 (the start and exit order of every process in the run that left 65001) by measuring the timeline again (done: ran it 60 times, added it to [the results](../research/codepage-test-results.md#timeline-of-every-process-on-the-console-pr-43662-932-60-runs), and posted [a reply on PR #43662](https://github.com/oven-sh/bun/pull/43662#issuecomment-6098318890); the text is in [Issue bun#44693](../issue/bun-44693.md#6-reply-on-pr-43662httpsgithubcomoven-shbunpull43662-timeline))
10. Make the same tests runnable on any PC, and keep the evidence in `research/evidence/` (done: every test ran at 932 and 437, the results were copied to `research/evidence/`, and every ✅ / ❌ in the result tables links to its evidence file)

### Watching for replies

- **Targets: oven-sh/bun #44693, #43660 and PR #43662**: comments, reviews, line comments, commits, labels, closing, references from elsewhere, and reactions on the bodies and comments (including our own comments)
- **The "[Cron job that watches for replies](../rules/local-rules.md#3-issue-and-publishing)" in the local rules does the checking**. Its expression and the rule for recreating it live there. A recurring cron job fires up to 30 minutes after its scheduled time; the delay is derived from the task ID and is the same every time ([official documentation](https://code.claude.com/docs/en/scheduled-tasks#jitter)). On 2026-10-08, three jobs with different IDs were all exactly 30 minutes late, in all 6 runs
- **Run `node tools/80_ops/check-replies.ts`**. It prints only what is new since the last check and leaves out the posting account. The time of the last check is kept in `etc/check-replies.json` (not in Git)
- **When something is new, read it in full at its link, and report a summary and a proposal for what to do**. A reply is posted only after the user has reviewed the draft and said to send it (local rule "Issue and publishing")
- **When something is new, also notify the phone with PushNotification**, in one line saying which issue, who and what. It may not arrive (an open bug on the Claude Code side: [anthropics/claude-code#87003](https://github.com/anthropics/claude-code/issues/87003) and others)
- **When nothing is new, answer in one line** (`✅mm/dd hh:mm reply check: nothing new`)

[⌂](../README.md)

[日本語](solve-bun-codepage-problem-JP.md)
