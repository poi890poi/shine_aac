# v0.4.1 regression-recovery audit

Date: 2026-08-25
Candidate: `codex/release-v0.4.1`

## Scope

The audit compared the candidate with every local and remote branch, all reflogs and
stashes, unreachable commit subjects, live and locked worktrees, and untracked review
artifacts. It focused on historical fixes whose behavior could have been weakened or
lost during later rewrites, rebases, fork reconciliation, or release preparation.

The locked Claude worktree contained `*_feat` snapshots and `full_review.diff`. Every
individual source snapshot hashes to an existing Git object already in the candidate's
ancestry. The aggregate diff contains those same historical snapshots; it is not a
second implementation that should be copied over current code.

## Root causes

1. Product intent was stored in commit prose and conversation, not as a release
   invariant. The archived `cb079fb` change made cheek calibration self-paced and
   optional, but that branch is not an ancestor of the release line. A later camera
   setup rewrite restored a six-movement counter.
2. The clustering test boundary was too narrow. Commit `4b6e799` clustered frames only
   after the runtime detector had admitted a candidate movement. It therefore improved
   sample selection without removing the prerequisite activation gate.
3. The physical gate encoded the wrong contract. It allowed a private imported cheek
   capture and replayed six trials, so a six-registration workflow could pass.
4. Public-data and framing requirements were conventions, not constraints. The runner
   used public downloads for runtime cases but retained a private calibration switch;
   the app had a minimum face-size check but no maximum-size check.
5. Release tagging was a manual checklist item. Nothing failed when packaging and
   pushing completed without a remote annotated tag.
6. The optical host guard combined the Windows input-desktop check with a one-pixel
   GDI capture probe. On an unlocked `Default` desktop, the compositor can reject that
   probe, causing the runner to incorrectly report lost console access.
7. The extended physical board oracle repeatedly downloaded the entire growing Android
   E2E log while aiming a gesture. Late in a long session that snapshot took several
   seconds, so the scanner could advance from the intended cell before the gesture was
   presented. Fresh bounded log reads are now required for target observation; the full
   log remains evidence only.
8. Two follow-up GUI retries were launched in a sandboxed process desktop. The presenter
   could create and acknowledge its own window there, while the unlocked physical monitor
   still showed the ordinary desktop. This was not a Windows lock. Optical runs now have
   an explicit interactive-GUI execution rule, and atlas decode remains the physical
   visibility oracle.

## Reconciliation matrix

| Historical intent | Candidate before audit | Audit result / durable gate |
|---|---|---|
| Cheek switch works without calibration (`63bc3dc`) | Present in Camera2 and UVC runtime fallbacks | Existing detector tests retained; physical public-data runtime remains required |
| Cheek calibration is optional and self-paced (`cb079fb`) | Optional survived; self-paced was weakened to six accepted movements | Recovered with unlabeled neutral-relative clustering; unit test succeeds from one clear movement; rig fails if all six legacy sequences are needed |
| Calibration progress remains visible (`02562b7`, `dab4d65`) | Present | Invalid framing now reports why capture is paused instead of remaining silently at `0 / 36` |
| Preview shows analyzed frame and score (`3ac0c2e`, `fc68a4e`) | Present in current setup and board status | Retained; physical optical evidence required |
| Preview pacing and activation routing are shared (`0458fd5`) | Present in later implementation | Retained; device and optical normal-use sessions required |
| Blink re-arms after activation (`6b35f26`) | Present as later equivalent `c88d252` | Existing asymmetric-open and ambiguous-frame classifier tests retained |
| Scanning pauses outside foreground (`0325cd3`) | Present | Existing lifecycle pause/resume session tests retained |
| Built-in/external camera selection (`c39eec2`) | Present and superseded by UVC support | Camera-selection and UVC unit tests retained; device camera-cycle gate required |
| Calibration/runtime test media is public (`7803d79`) | Partial: runtime public, calibration could use private import | Runner now resolves only the verified public media cache; manifest license/checksum tests and a source-level no-private-switch test added |
| Face should occupy about 70%, not fill view | Missing from code and tests | App rejects width/height above 82% with 70% guidance; unit boundary tests and scaled public rig stimulus added |
| Release must have pushed annotated tag | Documented but not enforced | `scripts/verify-release-tag.py` verifies local type/target and remote peeled target |
| Unlocked Windows must not be called locked from capture failure | GDI capture failure blocked an otherwise interactive `Default` desktop | Input-desktop identity is the safety gate; real presenter creation/focus is the automation proof; secure-desktop and GDI-failure tests added |
| Long physical sessions must keep selecting the observed target | Full log reads grew to several seconds and eventually selected the next cell | Target waits now use a bounded recent log; a regression test forbids using the full evidence log to aim gestures |
| Acknowledged presenter state must reach the physical monitor | A sandboxed GUI process rendered off the visible monitor even though its own window/state checks succeeded | Optical commands require interactive-GUI permission; only successful camera atlas decode proves physical display visibility |

The separate APK-only blink diagnostics branch is an investigation tool, not a released
product fix. Its behavioral blink re-arm change is already present and tested; the
diagnostic recorder itself is intentionally not merged into the production variant.

## Prevention rule

A user-requested behavior is not considered durable until it has all applicable layers:

1. repository policy in `AGENTS.md` for privacy, release, or physical-test constraints;
2. a unit or integration test that fails when the behavior is weakened;
3. a physical device/optical gate when camera behavior is involved; and
4. a branch/reflog/worktree reconciliation audit before a release merge.

The required optical runner no longer discovers `testdata/optical-rig/local/`, has no
private-replay command-line option, and the old private-ZIP import helper has been
removed. Existing untracked private files are not deleted by this change; they are user
data and are simply outside automated and release workflows.

## Verification evidence

- Host rig/release tests: 56 passed.
- Core one-switch quick suite: 198 passed, including embedded-English Clear semantics.
- Android input unit tests, app unit tests, debug assembly, and Web UI unit tests passed.
- Physical device acceptance: 48 checks with no automated findings; native Settings:
  19 checks with no findings.
- Full interactive optical gate: `test-results/optical-20260826-000440`, no release-
  blocking findings. Blink and cheek each completed four speech turns plus correction,
  clear, and language round-trip; all positive/negative stress counts matched.
- Native cheek calibration saved a quality-good model from one unlabeled licensed-
  public sequence in 8.5 seconds, with 100% practice detection and zero neutral false
  positives. The measured public face occupied 64.9% of preview height and 70.8% of
  width, inside the enforced 55-82% whole-face range.
- `v0.4.0` was verified as an annotated local and remote tag peeled to
  `b5b6aa22c8df139a1666065294135f4671ff00e4`.
