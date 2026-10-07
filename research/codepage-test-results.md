# Code page test results

Results of T1 to T6 in the plan, run with Bun 1.4.2, Bun canary, Node.js and Deno. Each harm caused by Bun changing the console code page is shown by measurement

> 📅 Created: 2026-10-04 / Updated: 2026-10-06

[⌂](../README.md)

[日本語](codepage-test-results-JP.md)

**Summary:** at startup Bun saves the console's input and output code pages and sets both to 65001, and at exit it restores the saved values. The code page belongs to the console and is shared by every process attached to it, so concurrent Bun processes overwrite each other's saved value. Output gets garbled, 65001 is left on the console, and other programs in the same console break. Node.js and Deno never change the code page and were correct in every case. It also reproduces at code page 437 (English Windows). Details are in [Conclusion](#2-conclusion).

1. [Conditions](#1-conditions)
2. [Conclusion](#2-conclusion)
3. [T1. Code page over time](#3-t1-code-page-over-time)
4. [T2. Pipe combinations](#4-t2-pipe-combinations)
5. [T3, T4. Forced kill and neighboring processes](#5-t3-t4-forced-kill-and-neighboring-processes)
6. [T5. Reproduction with fixed ordering](#6-t5-reproduction-with-fixed-ordering)
7. [T5. Same shape as bun#43660](#7-t5-same-shape-as-bun43660)

## 1. Conditions

| Item | Value |
|---|---|
| OS | Windows 11 Home 10.0.26300 (Japanese) |
| Console | A new console is created with `conhost.exe` for every case. It starts at 932. The tests never touch the code page |
| Bun | 1.4.2+744846f84 |
| Bun canary | 1.4.3-canary.1+bb35d1b81 |
| Node.js | v26.10.0 |
| Deno | 2.9.7 |
| Text sent | `abc 東京大阪 xyz` ("Tokyo Osaka"; garbled it becomes `abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz`) |
| Tests | `tests/codepage.test.ts`, run with both node --test and bun test via `tools/40_test/run-tests.cmd` |

### How results are judged

- **Code page:** each process reads `GetConsoleCP` / `GetConsoleOutputCP` right after start, right before writing and right before exit, and records them with a timestamp. Before and after each case, an observer Node.js process reads them (T1 shows that Node.js does not change the code page)
- **Screen:** the observer reads the characters on the console with `ReadConsoleOutputCharacterW`. Nobody has to look at the screen
- **Neighboring processes:** at the end of each case, `chcp` and a cmd script saved in Shift_JIS (`echo sjis: 東京大阪`) run in the same console, and what they print is checked
- **Bytes:** the reader writes the received bytes unchanged to a file, which is checked for correct UTF-8

✅ as expected (same as the expected behavior) / ❌ not as expected. When a combination runs several times, the results are listed in run order.

`現在のコード ページ` is the Japanese form of `Active code page`. Windows prints the English form when the output code page is 65001.

## 2. Conclusion

Bun switches the console input and output code pages to 65001 the moment it starts (before any script code runs), and on exit restores "the value it saved at start". This alone causes every harm H1 to H7 in the plan. Node.js and Deno never changed the code page and behaved correctly in every case.

| Harm | Description | Bun, canary | Node.js, Deno | Evidence |
|---|---|---|---|---|
| H1 | The output of a piped peer is garbled | ❌ happens | ✅ never | T5 ww and relay, T4 |
| H2 | The result is decided by the start and exit order, so it changes from run to run | ❌ happens | ✅ never | The four orders in T5 give different results. Same shape as bun#43660 |
| H3 | 65001 is left on the console after exit | ❌ happens | ✅ never | T2 (cmd), T5 ww, rr and relay |
| H4 | Other processes in the same console are affected | ❌ happens | ✅ never | T3, T4, T5 (the Shift_JIS cmd script is garbled, and the chcp message switches to English) |
| H5 | After the code page is put back to 932, Bun writes raw UTF-8 bytes and they are garbled | ❌ happens | ✅ never | T5 ww: the code page is 932 right before the reader writes |
| H6 | A forced kill leaves the code page changed | ❌ happens | ✅ never | T3 |
| H7 | It happens even when the two Bun processes are not directly connected | ❌ happens | ✅ never | T5 relay (`bun \| node \| bun`) |

The data flowing through the pipe itself was never corrupted, in any combination (T2). Every harm comes from rewriting shared state: the code page of the console. The stable and canary builds gave the same results in every case (T6).

### Where in Bun's source

- `init()` ([output.rs lines 561 to 567](https://github.com/oven-sh/bun/blob/3f1765a6de030d00a98c33ff0c776c7a7e4b23e9/src/bun_core/output.rs#L561-L567)) saves `GetConsoleOutputCP` / `GetConsoleCP` and calls `SetConsoleOutputCP(65001)` / `SetConsoleCP(65001)`
- `restore()` ([output.rs lines 517 to 524](https://github.com/oven-sh/bun/blob/3f1765a6de030d00a98c33ff0c776c7a7e4b23e9/src/bun_core/output.rs#L517-L524)) puts the saved values back at exit
- The [source comment](https://github.com/oven-sh/bun/blob/3f1765a6de030d00a98c33ff0c776c7a7e4b23e9/src/bun_core/output.rs#L482-L484) already says restoration "may not be applied if the process is killed abruptly" (H6)

The links point to the current `main`. The timeline in T5 matches this code exactly: each process saves the value it sees at start, so the second process saves 65001.

### Also at code page 437

The deterministic reproduction in the issue was also run in consoles started at code page 437 (the English Windows default), three times per build. Bun 1.4.2 and canary printed `abc µ¥▒Σ║¼σñºΘÿ¬ xyz` and left `Active code page: 65001` every time; Node.js printed `abc 東京大阪 xyz` and kept 437. The tests above use 932, the Japanese default.

## 3. T1. Code page over time

A single process runs in the console and prints `abc 東京大阪 xyz`. Values are input/output.

| Runtime | Right after start | Right before writing | Right before exit | After exit | Screen |
|---|---|---|---|---|---|
| Bun 1.4.2 | ❌ 65001/65001 | ❌ 65001/65001 | ❌ 65001/65001 | ✅ 932/932 | ✅ |
| Bun canary | ❌ 65001/65001 | ❌ 65001/65001 | ❌ 65001/65001 | ✅ 932/932 | ✅ |
| Node.js | ✅ 932/932 | ✅ 932/932 | ✅ 932/932 | ✅ 932/932 | ✅ |
| Deno | ✅ 932/932 | ✅ 932/932 | ✅ 932/932 | ✅ 932/932 | ✅ |

- Bun has already switched to 65001 when the first line of the script runs. It does so even if nothing is written to the screen
- Node.js and Deno stayed at 932 and printed Japanese correctly. This shows correct output does not require changing the code page
- With a single process, Bun puts 932 back on exit, so the problem stays hidden

## 4. T2. Pipe combinations

The writer and the reader start together, and the reader writes the received bytes to a file. Each cell is "bytes / code page after exit".

| Writer → reader | From cmd | From pwsh 7 | From Windows PowerShell 5.1 |
|---|---|---|---|
| bun → bun | ✅ / ❌ 65001 | ✅ / ❌ 65001 | ✅ / ✅ 932 |
| bun → canary, canary → bun, canary → canary | ✅ / ❌ 65001 | ✅ / ❌ 65001 | ✅ / ✅ 932 |
| bun, canary → node, deno | ✅ / ✅ 932 | ✅ / ✅ 932 | ✅ / ✅ 932 |
| node, deno → bun, canary | ✅ / ✅ 932 | ✅ / ✅ 932 | ✅ / ✅ 932 |
| node, deno → node, deno | ✅ / ✅ 932 | ✅ / ✅ 932 | ✅ / ✅ 932 |

- The bytes flowing through the pipe were never corrupted, in any combination
- Connecting two Bun processes directly from cmd or pwsh 7 left 65001 behind (H3). If either side is Node.js or Deno, it is not left. This matches "it does not happen if either side is Node.js" in bun#43660
- Windows PowerShell 5.1 replaces the Japanese with `?` in every combination (also for node | node; it is 5.1's own behavior). In the 5.1 column, the same bytes as node | node count as ✅. With 5.1 in between, 65001 was not left, perhaps because the lifetimes of the two Bun processes no longer overlap the same way (cause not confirmed)

## 5. T3, T4. Forced kill and neighboring processes

### T3. Forced kill

A single process that has written to the screen and is waiting is stopped with `taskkill /F`.

| Runtime | Code page after | chcp output | Shift_JIS cmd script |
|---|---|---|---|
| Bun, canary | ❌ 65001/65001 | ❌ `Active code page: 65001` | ❌ `sjis: �������` |
| Node.js, Deno | ✅ 932/932 | ✅ `現在のコード ページ: 932` | ✅ `sjis: 東京大阪` |

Because Bun restores the code page on exit, a forced kill leaves 65001 behind (H6). A cmd script that runs in the same console afterwards misreads its own Shift_JIS source as 65001 and is garbled (H4).

### T4. After a normal exit

The console after `bun | bun` exits normally (the lifetimes overlap and the writer exits first):

```text
abc 譚ｱ莠ｬ螟ｧ髦ｪ xyz
--- tail ---
Active code page: 65001
sjis: �������
```

The same with Node.js or Deno:

```text
abc 東京大阪 xyz
--- tail ---
現在のコード ページ: 932
sjis: 東京大阪
```

With both Bun builds, even without a forced kill, the cmd script and the `chcp` message in the same console were affected (H4).

## 6. T5. Reproduction with fixed ordering

The second process starts about one second later, and the exit order is decided by delays. The two lifetimes always overlap. Each combination runs three times. Cells are "screen or bytes / 932 after exit".

| Shape and order | Reader writes to | Predicted by the hypothesis | Bun 1.4.2 | Bun canary | Node.js, Deno |
|---|---|---|---|---|---|
| Writer starts first and exits first (ww) | Screen | Garbled / 65001 left | ❌❌❌ / ❌❌❌ | ❌❌❌ / ❌❌❌ | ✅✅✅ / ✅✅✅ |
| Same | File | 65001 left | ✅✅✅ / ❌❌❌ | ✅✅✅ / ❌❌❌ | ✅✅✅ / ✅✅✅ |
| Writer starts first, reader exits first (wr) | Screen, file | Correct / back to 932 | ✅✅✅ / ✅✅✅ | ✅✅✅ / ✅✅✅ | ✅✅✅ / ✅✅✅ |
| Reader starts first, writer exits first (rw) | Screen, file | Correct / back to 932 | ✅✅✅ / ✅✅✅ | ✅✅✅ / ✅✅✅ | ✅✅✅ / ✅✅✅ |
| Reader starts first and exits first (rr) | Screen, file | Correct / 65001 left | ✅✅✅ / ❌❌❌ | ✅✅✅ / ❌❌❌ | ✅✅✅ / ✅✅✅ |
| Node.js in the middle; writer starts first and exits first (relay) | Screen | Garbled / 65001 left | ❌❌❌ / ❌❌❌ | ❌❌❌ / ❌❌❌ | ✅✅✅ / ✅✅✅ |

For both Bun builds, every combination matched the prediction, and all three runs were identical. Once the order is fixed, the result is fixed.

### Timeline of the garbling order (Bun 1.4.2, ww, screen)

Values are input/output. w is the writer, r the reader, probe the observer Node.js process.

```text
   0ms probe  before          932/932
  54ms w      after start     65001/65001   ← the writer saves 932 and sets 65001
  59ms w      before writing  65001/65001
1115ms r      after start     65001/65001   ← the reader saves 65001 as the "original" value
2061ms w      before exit     65001/65001   → the writer exits and restores the saved 932
2867ms r      before writing  932/932       ← the reader writes UTF-8 bytes to a 932 console (garbled)
2896ms r      before exit     932/932       → the reader exits and restores the saved 65001
3076ms probe  after           65001/65001   ← 65001 is left behind
```

- The reader wrote raw UTF-8 bytes while the console was at 932. Had it passed the text to `WriteConsoleW`, it would have printed correctly whatever the code page (Node.js and Deno print correctly at 932)
- In relay, the Node.js process in the middle changes nothing. Overlapping lifetimes of the two Bun processes are enough for the same thing to happen (H7)

## 7. T5. Same shape as bun#43660

The same shape as bun#43660: both processes start together, with no fixed order, ten times. The text is `abc 東京大阪 xyz`, passed with `\u` escapes.

```batch
bun -e "console.log('abc 東京大阪 xyz')" | bun -e "process.stdin.pipe(process.stdout)"
```

| Runtime | Screen (run order) | 932 after exit (run order) |
|---|---|---|
| Bun 1.4.2 | ❌✅✅❌❌❌❌❌❌❌ | ❌✅✅❌❌❌❌❌❌❌ |
| Bun canary | ✅✅✅❌✅✅❌✅❌❌ | ✅✅✅❌✅✅❌❌❌❌ |
| Node.js | ✅✅✅✅✅✅✅✅✅✅ | ✅✅✅✅✅✅✅✅✅✅ |
| Deno | ✅✅✅✅✅✅✅✅✅✅ | ✅✅✅✅✅✅✅✅✅✅ |

- With the same command, Bun's result changed from run to run (H2). It is decided by which of the two processes starts and exits first, and that order varies with OS scheduling
- In run 8 of canary, the screen was correct but 65001 was left behind, which looks like the same order as rr in T5
- The garbling reported in bun#43660 was the garbled side of this variation

[⌂](../README.md)

[日本語](codepage-test-results-JP.md)
