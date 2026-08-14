import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  currentUiConfigVersion,
  defaultUiConfig,
  moeBopomofoVoiceName,
  normalizeUiConfig
} from "../src/ui-config.js";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

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

test("stopped scanning is visually distinct from active scanning", () => {
  assert.match(styles, /\.phase\[data-scan-phase="Stopped"\]\s*\{[\s\S]*?border:\s*2px solid/);
  assert.match(styles, /\.scan-stopped \.board\s*\{[\s\S]*?opacity:/);
});
