import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  currentUiConfigVersion,
  defaultUiConfig,
  moeBopomofoVoiceName,
  normalizeUiConfig,
  normalizeSwitchInputProfile
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

test("APK-only blink diagnostics stay gated and expose non-green signal states", () => {
  assert.match(appSource, /isBlinkDiagnosticsEnabled/);
  assert.match(appSource, /data-action="copy-blink-diagnostics"/);
  assert.match(appSource, /data-action="export-blink-diagnostics"/);
  assert.match(appSource, /case "waitingOpen"/);
  assert.match(appSource, /case "signalAmbiguous"/);
  assert.match(appSource, /case "signalMissing"/);
  assert.match(styles, /\.camera-status-waitingOpen/);
  assert.match(styles, /\.camera-status-signalMissing/);
});

test("the Web UI does not reserve native Android system insets a second time", () => {
  assert.doesNotMatch(styles, /safe-area-inset-/);
  assert.match(styles, /\.shell\s*\{[\s\S]*?height:\s*var\(--app-viewport-height\)/);
});

test("compact phone status text remains grouped instead of wrapping per character", () => {
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?"phase config"[\s\S]*?"voice config"/);
  assert.match(styles, /\.config-button\s*\{[\s\S]*?white-space:\s*nowrap/);
});

test("review pause uses a calm grouped treatment without a progress fill", () => {
  assert.match(styles, /\.row\.review-hold-row::after\s*\{[\s\S]*?border:\s*3px solid #226f77/);
  assert.match(styles, /\.row\.review-hold-row \.tile\s*\{[\s\S]*?outline:\s*none;[\s\S]*?background:\s*#eef4f3/);
  assert.match(styles, /\.tile\.review-hold \.progress-fill\s*\{[\s\S]*?background:\s*transparent/);
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

test("profile-optimized block scanning is an explicit optional mode with its own highlight", () => {
  assert.match(appSource, /name="scanMode"/);
  assert.match(appSource, /ScanMode\.BlockRowColumn/);
  assert.match(appSource, /scanMode:\s*config\.scanMode/);
  assert.match(styles, /\.tile\.active-block\s*\{[\s\S]*?border-color:\s*#6750a4/);
  assert.match(appSource, /selected-block-row/);
  assert.match(styles, /\.row\.selected-block-row::before\s*\{[\s\S]*?border:\s*2px solid rgba\(103, 80, 164, 0\.72\)/);
});

test("vertical block and row progress is optional while cell progress remains horizontal", () => {
  assert.equal(defaultUiConfig.verticalGroupProgress, false);
  assert.match(appSource, /name="verticalGroupProgress"/);
  assert.match(appSource, /progressFill\.dataset\.progressDirection === "down"[\s\S]*?scaleY/);
  assert.match(appSource, /uiConfig\.verticalGroupProgress && \[[\s\S]*?ScanStage\.Blocks[\s\S]*?ScanStage\.Rows[\s\S]*?\? "down" : "right"/);
  assert.match(styles, /\.progress-fill\[data-progress-direction="down"\]\s*\{[\s\S]*?transform-origin:\s*center top/);
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
  assert.match(styles, /\.tile\.tone-fallback\s*\{[\s\S]*?border-color:\s*#8064a2/);
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
