@echo off
rem Download the pinned runtimes into _bin/ and run npm ci. Run this once before tools\40_test\run-tests.cmd.
rem 版を決めたランタイムを _bin/ に取り、npm ci を流す。tools\40_test\run-tests.cmd の前に 1 回流す。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-runtimes.ps1" %*
