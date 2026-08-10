import test from "node:test";
import assert from "node:assert/strict";
import {
  currentUiConfigVersion,
  defaultUiConfig,
  moeBopomofoVoiceName,
  normalizeUiConfig
} from "../src/ui-config.js";

test("review hold is opt-in and legacy default-on configs migrate off", () => {
  assert.equal(defaultUiConfig.holdAfterSuggestionChange, false);
  assert.equal(normalizeUiConfig({ holdAfterSuggestionChange: true }).holdAfterSuggestionChange, false);
  assert.equal(normalizeUiConfig({
    uiConfigVersion: currentUiConfigVersion,
    holdAfterSuggestionChange: true
  }).holdAfterSuggestionChange, true);
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
