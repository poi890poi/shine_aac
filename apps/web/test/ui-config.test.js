import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ContrastThemes,
  currentUiConfigVersion,
  defaultUiConfig,
  IdleTimeoutMinutes,
  moeBopomofoVoiceName,
  normalizeUiConfig,
  normalizeSwitchInputProfile,
  SpeechAfterReadModes
} from "../src/ui-config.js";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("obsolete optional review-hold settings are discarded", () => {
  assert.equal(Object.hasOwn(defaultUiConfig, "holdAfterSuggestionChange"), false);
  assert.equal(Object.hasOwn(normalizeUiConfig({
    uiConfigVersion: currentUiConfigVersion,
    holdAfterSuggestionChange: false
  }), "holdAfterSuggestionChange"), false);
});

test("Ministry of Education Bopomofo is the default speech option", () => {
  assert.equal(defaultUiConfig.speechVoiceName, moeBopomofoVoiceName);
  assert.equal(normalizeUiConfig({}).speechVoiceName, moeBopomofoVoiceName);
});

test("an explicitly selected Android voice is preserved", () => {
  assert.equal(
    normalizeUiConfig({ speechVoiceName: "cmn-tw-x-ctc-local" }).speechVoiceName,
    "cmn-tw-x-ctc-local"
  );
});

test("the custom board follows system appearance by default without losing explicit presets", () => {
  assert.equal(defaultUiConfig.contrastTheme, "system");
  assert.deepEqual(ContrastThemes, [
    "system",
    "standard",
    "high-contrast",
    "high-contrast-dark"
  ]);
  assert.equal(normalizeUiConfig({}).contrastTheme, "system");
  assert.equal(normalizeUiConfig({ contrastTheme: "default" }).contrastTheme, "standard");
  assert.equal(normalizeUiConfig({ contrastTheme: "high-contrast-dark" }).contrastTheme, "high-contrast-dark");
  assert.match(appSource, /getSystemAppearance/);
  assert.match(appSource, /dataset\.systemAppearance\s*=\s*systemAppearance\(\)/);
  assert.match(styles, /\[data-contrast="system"\]\[data-system-appearance="dark"\]/);
});

test("system dark appearance adapts neutral surfaces but retains custom scan-state tokens", () => {
  const systemDark = styles.match(
    /\[data-contrast="system"\]\[data-system-appearance="dark"\]\s*\{([\s\S]*?)\n\}/
  )?.[1] ?? "";
  assert.match(systemDark, /--color-app-bg:\s*#121416/);
  assert.match(systemDark, /--color-tile-bg:\s*#1b1f22/);
  assert.match(systemDark, /--color-tile-active-block-bg:\s*#3d2e66/);
  assert.match(systemDark, /--color-tile-active-row-bg:\s*#16504a/);
  assert.match(systemDark, /--color-tile-active-cell-bg:\s*#5f4a00/);
  assert.match(styles, /\.tile\.active-cell[\s\S]*?outline:\s*3px solid var\(--color-tile-active-cell-border\)/);
});

test("the existing switch-input selector offers an explicit volume-key mode", () => {
  assert.equal(defaultUiConfig.switchInputProfile, "hardware-buttons");
  assert.equal(normalizeSwitchInputProfile("volume-buttons"), "volume-buttons");
  assert.equal(
    normalizeUiConfig({ switchInputProfile: "volume-buttons" }).hardwareButtons,
    true
  );
  assert.match(appSource, /\["volume-buttons",\s*uiText\("Buttons — volume activates"/);
  assert.doesNotMatch(appSource, /name="volumeButtons/);
});

test("after-read behavior is one normalized three-level option", () => {
  assert.deepEqual(SpeechAfterReadModes, ["off", "replay", "conversation"]);
  assert.equal(defaultUiConfig.speechAfterReadMode, "replay");
  assert.equal(normalizeUiConfig({ speechAfterReadMode: "off" }).speechAfterReadMode, "off");
  assert.equal(normalizeUiConfig({ speechAfterReadMode: "replay" }).speechAfterReadMode, "replay");
  assert.equal(normalizeUiConfig({ speechAfterReadMode: "conversation" }).speechAfterReadMode, "conversation");
  assert.equal(normalizeUiConfig({ speechAfterReadMode: "unknown" }).speechAfterReadMode, "replay");
  assert.match(appSource, /name="speechAfterReadMode"/);
  assert.match(appSource, /speechAfterReadModeOptionsHtml/);
  assert.match(appSource, /Lock layout", "鎖定版面"/);
  assert.match(appSource, /Keep entering \(not locked\)", "繼續輸入（不鎖定）"/);
});

test("camera hold-through is explicit, bounded, and disabled by default", () => {
  assert.equal(defaultUiConfig.holdToAdvance, false);
  assert.equal(normalizeUiConfig({ holdToAdvance: true }).holdToAdvance, true);
  assert.equal(normalizeUiConfig({ holdToAdvance: "true" }).holdToAdvance, false);
  assert.match(appSource, /HoldToAdvanceMaxExtraActivations\s*=\s*2/);
  assert.match(appSource, /stage === ScanStage\.Blocks[\s\S]*?ScanStage\.Rows, ScanStage\.FirstCell/);
  assert.match(appSource, /stage === ScanStage\.Rows[\s\S]*?ScanStage\.FirstCell/);
  assert.match(appSource, /selection \|\|[\s\S]*?!uiConfig\.holdToAdvance/);
  assert.match(appSource, /detail:\s*"holdToAdvance=1"/);
});

test("idle timeout defaults to five minutes but remains bounded and optional", () => {
  assert.deepEqual(IdleTimeoutMinutes, [0, 1, 5, 15, 30]);
  assert.equal(defaultUiConfig.idleTimeoutMinutes, 5);
  assert.equal(normalizeUiConfig({ idleTimeoutMinutes: 0 }).idleTimeoutMinutes, 0);
  assert.equal(normalizeUiConfig({ idleTimeoutMinutes: 5 }).idleTimeoutMinutes, 5);
  assert.equal(normalizeUiConfig({ idleTimeoutMinutes: "15" }).idleTimeoutMinutes, 15);
  assert.equal(normalizeUiConfig({ idleTimeoutMinutes: 2 }).idleTimeoutMinutes, 5);
  assert.match(appSource, /name="idleTimeoutMinutes"/);
  assert.match(appSource, /session\.scannerState\.stage === ScanStage\.Stopped/);
  assert.match(appSource, /setCommunicationPaused\?\.\(paused\)/);
});

test("replay and conversation display share the same locked subset", () => {
  assert.match(appSource, /speechLockMessage:\s*session\.message/);
  assert.match(appSource, /uiConfig\.speechAfterReadMode === "conversation"/);
  assert.match(styles, /\.shell\.speech-lock-enhanced[\s\S]*?grid-template-rows/);
  assert.match(styles, /\.shell\.speech-lock-enhanced \.message\.locked-message[\s\S]*?white-space:\s*normal/);
  assert.doesNotMatch(styles, /\.shell\.speech-lock\s*\{[\s\S]*?clamp\(96px, 18vh, 160px\)/);
  assert.match(appSource, /訊息已鎖定 · 選擇操作/);
});

test("replay lock keeps the ordinary message layout while conversation mode enlarges it", () => {
  assert.doesNotMatch(styles, /\.shell\.speech-lock (?:\.board|\.row|\.tile|\.tile-label)\s*\{/);
  assert.match(styles, /\.shell\.speech-lock-enhanced \.board\s*\{[\s\S]*?gap:\s*0/);
  assert.doesNotMatch(styles, /\.shell\.speech-lock \.message\.locked-message/);
  assert.match(styles, /\.shell\.speech-lock-enhanced \.message\.locked-message/);
});

test("conversation display shows only a bounded passive history of spoken messages", () => {
  assert.match(appSource, /ConversationContextMessageLimit\s*=\s*2/);
  assert.match(appSource, /entry\.closed\s*&&\s*entry\.spoken/);
  assert.match(appSource, /markCurrentTextHistoryLineSpoken/);
  assert.match(appSource, /data-testid",\s*"conversation-context"/);
  assert.match(styles, /\.conversation-context-message[\s\S]*?-webkit-line-clamp:\s*2/);
});

test("camera input labels cover every configured optical gesture", () => {
  assert.match(appSource, /\["camera-long-blink",\s*uiText\("Camera gesture", "相機動作"\)\]/);
  assert.match(appSource, /\["hardware-and-camera",\s*uiText\("Buttons \+ camera gesture", "按鍵＋相機動作"\)\]/);
});

test("the Web UI does not reserve native Android system insets a second time", () => {
  assert.doesNotMatch(styles, /safe-area-inset-/);
  assert.match(styles, /\.shell\s*\{[\s\S]*?height:\s*var\(--app-viewport-height\)/);
});

test("compact phone status text remains grouped instead of wrapping per character", () => {
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?"phase config"[\s\S]*?"secondary config"/);
  assert.match(styles, /\.config-button\s*\{[\s\S]*?white-space:\s*nowrap/);
});

test("review pause freezes one group target without repainting its child tiles", () => {
  assert.match(styles, /\.board\.group-review-hold \.progress-fill\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(appSource, /renderedBoardElement\?\.classList\.toggle\("group-review-hold", reviewHoldActive\)/);
  assert.doesNotMatch(styles, /\.row\.review-hold-row \.tile\s*\{/);
  assert.doesNotMatch(appSource, /classList\.toggle\(\s*"review-hold-row"/);
});

test("the message field grows with Android font scaling without wrapping", () => {
  assert.match(styles, /\.message\s*\{[\s\S]*?min-height:\s*calc\(1\.35em \+ 24px\)/);
  assert.match(styles, /\.message\s*\{[\s\S]*?line-height:\s*1\.35/);
  assert.match(styles, /\.message\s*\{[\s\S]*?white-space:\s*nowrap/);
});

test("stopped scanning reuses the first-row review hold instead of a separate badge", () => {
  assert.doesNotMatch(styles, /\.phase\[data-scan-phase="Stopped"\]/);
  assert.doesNotMatch(styles, /\.scan-stopped \.board/);
});

test("block and row scanning use group elements while only a cell may style a tile as active", () => {
  assert.match(appSource, /name="scanMode"/);
  assert.match(appSource, /ScanMode\.BlockRowColumn/);
  assert.match(appSource, /scanMode:\s*config\.scanMode/);
  assert.match(appSource, /scanContext\.className\s*=\s*"scan-context-highlight"/);
  assert.match(appSource, /scanTarget\.className\s*=\s*"scan-target-highlight"/);
  assert.match(appSource, /positionScanHighlight\(renderedScanContext, contextKind, contextRows\)/);
  assert.match(appSource, /positionScanHighlight\(renderedScanTarget, targetKind, targetRows\)/);
  assert.match(appSource, /tileClass\(candidate, false, activeCell, reviewHold, cameraHold, false\)/);
  assert.match(appSource, /const nextProgressFills = nextActiveTiles\.map\(\(rendered\) => rendered\.progressFill\)/);
  assert.match(appSource, /return activeBlockRows\(scanner, board\)\.flatMap\(\(rowIndex\) => renderedTileGrid\[rowIndex\] \?\? \[\]\)/);
  assert.match(appSource, /if \(scanner\.stage === ScanStage\.Rows \|\| scanner\.stage === ScanStage\.RowSelected\) return row/);
  assert.doesNotMatch(appSource, /scanTarget\.append\(scanTargetProgressFill\)/);
  assert.match(styles, /\.scan-context-highlight,\s*\.scan-target-highlight\s*\{[\s\S]*?z-index:\s*2/);
  assert.match(styles, /\.scan-target-highlight\s*\{[\s\S]*?z-index:\s*3/);
  assert.match(styles, /\.scan-target-highlight\[data-highlight-kind="block"\]\s*\{[\s\S]*?var\(--color-tile-active-block-border\)/);
  assert.match(styles, /\.scan-context-highlight\[data-highlight-kind="row"\]\s*\{[\s\S]*?var\(--color-tile-active-row-border\)/);
  assert.doesNotMatch(styles, /\.tile\.active-(?:block|row)\s*\{/);
});

test("vertical block and row progress is optional while cell progress remains horizontal", () => {
  assert.equal(defaultUiConfig.verticalGroupProgress, false);
  assert.match(appSource, /name="verticalGroupProgress"/);
  assert.match(appSource, /progressFill\.dataset\.progressDirection === "down"[\s\S]*?scaleY/);
  assert.match(appSource, /uiConfig\.verticalGroupProgress && \[[\s\S]*?ScanStage\.Blocks[\s\S]*?ScanStage\.Rows[\s\S]*?\? "down" : "right"/);
  assert.match(styles, /\.progress-fill\[data-progress-direction="down"\]\s*\{[\s\S]*?transform-origin:\s*center top/);
});

test("progress hints retain a high-contrast moving edge over every scan-state fill", () => {
  assert.match(styles, /--color-progress-edge:\s*#111111/);
  assert.match(styles, /\[data-contrast="system"\]\[data-system-appearance="dark"\][\s\S]*?--color-progress-edge:\s*#f4f7f8/);
  assert.match(styles, /\[data-contrast="high-contrast"\][\s\S]*?--color-progress-edge:\s*#000000/);
  assert.match(styles, /\[data-contrast="high-contrast-dark"\][\s\S]*?--color-progress-edge:\s*#ffffff/);
  assert.match(styles, /\.progress-fill\s*\{[\s\S]*?border-right:\s*6px solid var\(--color-progress-edge\)/);
  assert.match(styles, /\.progress-fill\[data-progress-direction="down"\][\s\S]*?border-bottom:\s*6px solid var\(--color-progress-edge\)/);
});

test("automatic suggestion-page progress remains horizontal", () => {
  const directionStages = appSource.match(/const progressDirection = \[([\s\S]*?)\]\.includes\(scanner\.stage\) \? "down" : "right";/)?.[1] ?? "";

  assert.doesNotMatch(directionStages, /ScanStage\.SuggestionPages/);
});

test("automatic More-page scanning is an explicit persisted option", () => {
  assert.match(appSource, /name="autoScanSuggestionPages"/);
  assert.match(appSource, /autoScanSuggestionPages:\s*config\.autoScanSuggestionPages/);
  assert.match(appSource, /stored\.autoScanSuggestionPages === true/);
  assert.match(appSource, /ScanStage\.SuggestionPages/);
});

test("unsupported Zhuyin deferral defaults by profile, persists overrides, and stays visibly temporary", () => {
  assert.match(appSource, /name="deferUnsupportedZhuyinOnFirstPass"/);
  assert.match(appSource, /deferUnsupportedZhuyinOnFirstPass:\s*config\.deferUnsupportedZhuyinOnFirstPass/);
  assert.match(appSource, /booleanOrDefault\([\s\S]*?stored\.deferUnsupportedZhuyinOnFirstPass/);
  assert.match(appSource, /candidate\.scanDeferred === true/);
  assert.match(styles, /\.tile\.scan-deferred\s*\{[\s\S]*?border-style:\s*dashed/);
  assert.match(styles, /\.tile\.scan-deferred \.progress-fill\s*\{[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(appSource, /aria-disabled[^\n]*scanDeferred/);
});

test("reduced first-pass blocks reuse compact core grouping in the rendered highlight", () => {
  assert.match(appSource, /function scanBlocksForPresentation[\s\S]*?scanRowBlocksForPass/);
  assert.match(appSource, /Array\.isArray\(scanner\.selectedBlockRows\)[\s\S]*?scanner\.selectedBlockRows/);
});

test("tone fallback controls use a distinct secondary treatment", () => {
  assert.match(appSource, /candidate\.toneFallback === true/);
  assert.match(styles, /--color-tone-border:\s*#8064a2/);
  assert.match(styles, /\.tile\.tone-fallback\s*\{[\s\S]*?border-color:\s*var\(--color-tone-border\)/);
});

test("high-contrast presets cover board and secondary app surfaces", () => {
  assert.match(styles, /\[data-contrast="high-contrast-dark"\]\s*\{[\s\S]*?--color-review-bg:\s*#102d2a[\s\S]*?--color-clear-bg:\s*#541c14[\s\S]*?--color-export-file-bg:\s*#1f2529/);
  assert.match(styles, /\.settings-row\s*\{[\s\S]*?background:\s*var\(--color-panel-bg\)[\s\S]*?color:\s*var\(--color-text\)/);
  assert.match(styles, /\.speech-voice-row\.selected\s*\{[\s\S]*?background:\s*var\(--color-surface-selected\)/);
  assert.match(styles, /\.calibration-intro\s*\{[\s\S]*?background:\s*var\(--color-accent-soft\)[\s\S]*?color:\s*var\(--color-text\)/);
});

test("configuration form controls retain 48px targets on short screens", () => {
  assert.match(styles, /\.field input,[\s\S]*?\.field textarea\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(styles, /\.check-field\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(styles, /\.config-panel \.secondary-button,[\s\S]*?\.config-panel \.primary-button\s*\{[\s\S]*?min-height:\s*48px/);
});

test("consecutive phone checkbox rows do not inherit the form block gap", () => {
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.config-grid > \.check-field \+ \.check-field\s*\{[\s\S]*?margin-block-start:\s*-12px/);
});

test("phone configuration actions do not cover form controls", () => {
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.config-panel:not\(\.calibration-panel\) \.config-actions\s*\{[\s\S]*?position:\s*static/);
  assert.match(styles, /\.config-actions\s*\{[\s\S]*?position:\s*sticky/);
});

test("configuration reset requires an explicit, scoped confirmation", () => {
  assert.match(appSource, /role="alertdialog"[\s\S]*?Text history is kept\. This action cannot be undone\./);
  assert.match(appSource, /if \(action === "reset"\) \{[\s\S]*?showResetConfirmation\(event\.target/);
  assert.match(appSource, /data-reset-action="confirm"/);
});

test("English suggestion sizing runs at the top level of both scanning modes", () => {
  assert.match(
    appSource,
    /\[ScanStage\.Blocks, ScanStage\.Rows\]\.includes\(session\.scannerState\.stage\)/
  );
});

test("pause and stopped phase labels stay compact", () => {
  assert.match(appSource, /"Block pause"/);
  assert.match(appSource, /"Row pause"/);
  assert.match(appSource, /"Stopped · Press switch"/);
  assert.doesNotMatch(appSource, /Press again to cancel block/);
});
