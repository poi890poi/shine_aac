import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeScanContrastMatrix,
  compositeColors,
  contrastRatio,
  parseCssColor,
} from "./contrast-metrics.mjs";

test("CSS rgba progress fills are composited before contrast is measured", () => {
  const composite = compositeColors("rgba(255, 255, 255, 0.5)", "rgb(0, 0, 0)");
  assert.equal(Math.round(composite.red), 128);
  assert.equal(Math.round(composite.green), 128);
  assert.equal(Math.round(composite.blue), 128);
  assert.equal(composite.alpha, 1);
  assert.ok(contrastRatio("#fff", composite) < contrastRatio("#fff", "#000"));
});

test("scan contrast matrix covers every state at 0, 50, and 100 percent progress", () => {
  const state = (name, background, border = "#ffffff") => ({
    name,
    text: "#ffffff",
    background,
    border,
    progressFill: "rgba(255, 255, 255, 0.1)",
  });
  const result = analyzeScanContrastMatrix([{
    name: "fixture-dark",
    states: [
      state("neutral", "#000000"),
      state("active-block", "#111111"),
      state("active-row", "#222222"),
      state("active-cell", "#333333"),
    ],
  }]);

  assert.deepEqual(result.themes[0].states.map((sample) => sample.name), [
    "neutral", "active-block", "active-row", "active-cell",
  ]);
  assert.deepEqual(result.themes[0].states[0].progress.map((sample) => sample.percent), [0, 50, 100]);
  assert.equal(result.failures.progress.length, 4);
  assert.ok(result.themes[0].states.every((sample) => Number.isFinite(sample.minimumTextContrast)));
});

test("hex alpha colors and modern percentage rgb syntax are parsed", () => {
  assert.equal(parseCssColor("#ffffff80").alpha, 128 / 255);
  const red = parseCssColor("rgb(100% 0% 0% / 25%)");
  assert.ok(Math.abs(red.red - 255) < 0.000001);
  assert.equal(red.green, 0);
  assert.equal(red.blue, 0);
  assert.equal(red.alpha, 0.25);
});
