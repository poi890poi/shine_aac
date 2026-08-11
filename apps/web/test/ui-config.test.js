import test from "node:test";
import assert from "node:assert/strict";
import {
  currentUiConfigVersion,
  defaultUiConfig,
  moeBopomofoVoiceName,
  normalizeUiConfig
} from "../src/ui-config.js";

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
