# Project Constitution

## Disability And Physiology

- The user's body sets the interface budget. Optimize for limited strength, range, precision, endurance, attention, and recovery time.
- Speed is not neutral. A faster scan can increase fatigue, missed targets, and abandonment.
- Prefer fewer modes and fewer timing states. Add a mechanism only when it clearly reduces effort or errors for the target user.
- Make the first target in a scan sequence reachable. Timing should account for reaction latency and the common tendency to overshoot column 1.
- Audio, visual, and motor access needs vary. Defaults must be conservative; helpers can tune for a specific person.

## AAC

- Communication success is functional, not grammatical. Approximate words, short phrases, and wrong-but-understandable choices are acceptable.
- High-information targets are more valuable than polite or syntactically complete sentences.
- Keep repair cheap: undo, delete, clear, and speak must be predictable and reachable.
- Keep positions stable. Dynamic suggestions may change; the static board and scanner mechanics should not surprise the user.
- Predictions must be relevant to the user's current input. Do not fill space with unrelated words just to avoid empty cells.
- Language profiles are not translations. Each profile needs its own writing system, speech locale, vocabulary source, composition rules, and tests.

## Software Development

- Put AAC rules in the shared core first, with deterministic tests before platform work.
- Preserve working English behavior when adding another language or access feature.
- Prefer data pipelines over hand tuning. Do not promote, demote, add, or remove individual suggestions for one observed example when a source/ranking rule is needed.
- Verify rendered user experience, not hidden debug state. For UI claims, use visible browser/app checks or screenshots.
- Keep mechanisms consistent across profiles. Reuse suggestion rows, scanner states, input adapters, and repair actions unless there is a documented reason not to.
- Every accessibility change must state what effort, error, or confusion it reduces.
