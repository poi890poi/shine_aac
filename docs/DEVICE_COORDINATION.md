# Shared device coordination

Type: test tooling and workflow correction. Two active tasks used the same phone:
MinIME's capture cleanup sent KEYCODE_SLEEP while SHINE used it as an optical
presenter. The phone sleep log at 22:17:08 on 2026-09-10 agrees with MinIME's
reported cleanup timestamp. Missing presenter acknowledgements after that point
are interrupted stimuli, not evidence of detector misses.

Reserve a device window with the other task and wait for acknowledgement. An idle
task does not release its reservation. Explicitly release after cleanup, even if
testing fails. Communicate extensions before another task starts device work.

Wrap every device operation, including readbacks and cleanup, in
`Invoke-AndroidDeviceLease -Serials <serials> -Action { ... }` after dot-sourcing
`scripts/with-android-device-lease.ps1`. Acquire all serials before running ADB.
The helper sorts unique serials, refuses contention immediately, and releases in
reverse order after the action finishes or throws. Put settings restoration and
display-OFF verification inside the action's `finally`, so cleanup retains
ownership. Windows releases ownership on process death, but that is not proof
that device cleanup ran; inspect and recover before the next test.

SHINE and MinIME share `Local\Codex.Android.<serial>` in the same Windows session.
The lock is advisory: manual ADB and tools that omit it remain outside protection.
No production app, stored user data, optical geometry, or detector behavior changes.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-device-lease.ps1` for a
synthetic, device-free cross-process contention test, nested same-thread ownership,
and release after an action failure. This validates coordination tooling only;
physical acceptance and optical gates retain their separate requirements.
