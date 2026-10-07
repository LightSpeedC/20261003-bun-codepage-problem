@echo off
rem Run every test with the runtimes in _bin/. Run tools\10_setup\setup-runtimes.cmd once beforehand.
rem _bin/ のランタイムで全件を流す。先に tools\10_setup\setup-runtimes.cmd を 1 回流しておく。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1" %*
