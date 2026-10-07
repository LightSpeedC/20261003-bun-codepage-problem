# Reproducing bun#43660

Results of running the bun#43660 commands with Bun 1.4.2 and the canary build in a freshly opened cp932 console

> 📅 Created: 2026-10-04 / Updated: 2026-10-04

[⌂](../README.md)

[日本語](reproduce-issue-43660-JP.md)

1. [Conditions](#1-conditions)
2. [Results](#2-results)
3. [What we first misread](#3-what-we-first-misread)
4. [Hypothesis](#4-hypothesis)
5. [Findings and next check](#5-findings-and-next-check)

## 1. Conditions

| Item | Value |
|---|---|
| Console | A new `cmd` opened with `conhost.exe` (starts at 932). `chcp 932` is not run |
| Bun | 1.4.2+744846f84 / 1.4.3-canary.1+bb35d1b81 |
| OS | Windows 11 Home 10.0.26300 |
| Script | `tests/manual/issue-43660-repro.cmd <bun> <log>` |

The script runs the following two lines in order. The two consoles (stable and canary) were opened at the same time.

```batch
bun -e "console.log('bun 2 bun   日本語')" | bun -e "process.stdin.pipe(process.stdout)"
bun -e "console.log('bun 2 bun   日本語')" | bun -e "process.stdin.pipe(process.stdout)" > log.bytes
```

Runs 1 and 2 wrote the `chcp` value to the log only. Run 3 wrote it to both the screen and the log, with ASCII labels.

After these three runs, the text in the script was changed to `abc 東京大阪 xyz` (so that no broken byte is left and the newline survives when garbled; see T5 in the plan). The results in this document were taken with the earlier `bun 2 bun   日本語`.

## 2. Results

Results are listed in run order (run 1, 2, 3). ✅ as expected / ❌ not as expected / ⚠️ only the input side was back at 932 (`chcp` shows 932 but the message is in English) / ⬜ not checked (the screen of run 2 was not looked at).

| Check | 1.4.2 | 1.4.3-canary.1 |
|---|---|---|
| Text on screen | ❌⬜❌ | ❌⬜✅ |
| Code page after the console run | ❌❌✅ | ⚠️❌✅ |
| Code page after the file run | ❌❌✅ | ❌❌❌ |
| Bytes written to the file | ❌❌✅ | ❌❌✅ |

### Screen of run 3 (1.4.2)

```text
1.4.2+744846f84
[1] before
現在のコード ページ: 932
--- bun to bun, output to console ---
bun 2 bun   譌･譛ｬ隱・[2] after console run
現在のコード ページ: 932
--- bun to bun, output to file ---
[3] after file run
現在のコード ページ: 932
--- end ---
続行するには何かキーを押してください . . .
```

### Screen of run 3 (1.4.3-canary.1)

```text
1.4.3-canary.1+bb35d1b81
[1] before
現在のコード ページ: 932
--- bun to bun, output to console ---
bun 2 bun   日本語
[2] after console run
現在のコード ページ: 932
--- bun to bun, output to file ---
[3] after file run
Active code page: 65001
--- end ---
Press any key to continue . . .
```

`現在のコード ページ` is the Japanese form of `Active code page`, and `続行するには何かキーを押してください` is the Japanese form of `Press any key to continue`. Windows prints the English form when the output code page is 65001.

### Bytes written to the file

| Run | The Japanese part |
|---|---|
| Runs 1 and 2 (both builds) | `ef bf bd ef bf bd ef bf bd 7b ef bf bd ef bf bd` (U+FFFD and `{`) |
| Run 3 (both builds) | `e6 97 a5 e6 9c ac e8 aa 9e` (correct UTF-8) |

## 3. What we first misread

We first read the broken bytes of runs 1 and 2 as "the data flowing through the Bun pipe is corrupted". That was wrong.

1. After the first pipeline, 65001 was left on the console
2. cmd re-reads a batch file line by line, so it read the second line as 65001. The Shift_JIS `日本語` is not valid UTF-8, so Bun received U+FFFD
3. In run 3 the console was back at 932 before the second line, so the correct bytes arrived

The broken bytes are evidence that **cmd in the same console misread its own script** because of the code page Bun left behind. The garbled Japanese labels in runs 1 and 2 have the same cause.

## 4. Hypothesis

Not yet verified. If each Bun process "saves the current value and sets 65001 at start, and restores the saved value at exit", every observation is explained.

1. Writer A starts, saves 932 and sets 65001
2. Reader B starts and saves 65001 as the "original" value
3. A exits first and restores 932; UTF-8 written by B after that is garbled (1.4.2 run 3: garbled although the code page stayed 932)
4. B exits and restores the saved 65001, which is left on the console (canary run 3, file run)

`譌･譛ｬ隱・` in 1.4.2 run 3 is the UTF-8 `e6 97 a5 e6 9c ac e8 aa 9e` read as CP932. The final `9e` is taken as the lead byte of a double-byte character and swallows the following newline as `・`, so the newline also disappears. This suggests the reader writes raw UTF-8 bytes to the console instead of using `WriteConsoleW`.

## 5. Findings and next check

- It happens with both the stable and the canary build, and the result changes from run to run
- The screen can be garbled even while the code page still shows 932
- 65001 is left on the console and affects cmd in the same console (reading its own script, the `pause` message)
- A single run is not enough to conclude anything. The hypothesis is checked by the fixed-order reproduction (T5 in the plan): [Solving the Bun code page problem](../plan/solve-bun-codepage-problem.md)
- The later tests confirmed the hypothesis: [Code page test results](codepage-test-results.md)

[⌂](../README.md)

[日本語](reproduce-issue-43660-JP.md)
