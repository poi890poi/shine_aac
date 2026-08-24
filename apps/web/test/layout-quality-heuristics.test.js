import test from "node:test";
import assert from "node:assert/strict";
import {
  cameraPreviewFraction,
  cameraPreviewIsTooSmall,
  findBrightDarkThemeSurfaces,
  findControlOverlaps,
  findExcessiveCellPadding,
  findExcessiveRelatedGaps,
  findGeometryDrift,
  findLooseLineHeights,
  findRegionAllocationViolations,
  findRepeatedRowAlignmentDrift,
  findRepeatedRowGaps,
} from "../../../scripts/layout-quality-heuristics.mjs";

test("captured 12px gaps between otherwise contiguous checkbox rows are review findings", () => {
  const findings = findRepeatedRowGaps([{
    role: "checkbox",
    items: [
      { name: "row voice", top: 0, bottom: 48 },
      { name: "cell voice", top: 60, bottom: 108 },
      { name: "activation voice", top: 120, bottom: 168 },
    ],
  }]);
  assert.deepEqual(findings.map((item) => item.gapPx), [12, 12]);

  assert.deepEqual(findRepeatedRowGaps([{
    role: "checkbox",
    items: [
      { name: "row voice", top: 0, bottom: 48 },
      { name: "cell voice", top: 48, bottom: 96 },
    ],
  }]), []);
});

test("line-height audit distinguishes loose text rhythm from normal readable leading", () => {
  assert.equal(findLooseLineHeights([
    { text: "normal", fontSizePx: 16, lineHeightPx: 21.6 },
    { text: "too loose", fontSizePx: 16, lineHeightPx: 32 },
  ]).length, 1);
});

test("cell-padding audit reports disproportionate padding without penalizing normal touch controls", () => {
  const findings = findExcessiveCellPadding([
    { selector: "button.normal", text: "Save", fontSizePx: 16, paddingTopPx: 10, paddingBottomPx: 10, paddingLeftPx: 14, paddingRightPx: 14 },
    { selector: ".bloated-cell", text: "Choice", fontSizePx: 16, paddingTopPx: 24, paddingBottomPx: 24, paddingLeftPx: 14, paddingRightPx: 14 },
  ]);
  assert.deepEqual(findings.map((item) => item.selector), [".bloated-cell"]);
});

test("repeated-row audit finds alignment drift independently of spacing", () => {
  const findings = findRepeatedRowAlignmentDrift([{
    role: "checkbox",
    items: [
      { name: "first", left: 20, right: 340 },
      { name: "drifted", left: 28, right: 340 },
    ],
  }]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].leftDriftPx, 8);
});

test("dark-theme audit finds a large white patch but ignores small bright controls", () => {
  const findings = findBrightDarkThemeSurfaces([
    { selector: ".broken-tray", color: "rgb(255, 255, 255)", red: 255, green: 255, blue: 255, alpha: 1, area: 18000 },
    { selector: ".small-checkbox", color: "rgb(255, 255, 255)", red: 255, green: 255, blue: 255, alpha: 1, area: 200 },
    { selector: ".dark-panel", color: "rgb(18, 22, 24)", red: 18, green: 22, blue: 24, alpha: 1, area: 100000 },
  ], 200000);
  assert.deepEqual(findings.map((item) => item.selector), [".broken-tray"]);
});

test("overlap audit reports intersecting controls", () => {
  assert.equal(findControlOverlaps([
    { name: "field", left: 0, top: 0, right: 100, bottom: 48 },
    { name: "sticky action", left: 0, top: 40, right: 100, bottom: 88 },
  ]).length, 1);
  assert.deepEqual(findControlOverlaps([
    { name: "upper right", left: 100, top: 0, right: 200, bottom: 48 },
    { name: "lower left", left: 0, top: 60, right: 90, bottom: 108 },
  ]), []);
});

test("camera-preview audit is calibrated by the captured before and after geometry", () => {
  assert.equal(cameraPreviewIsTooSmall(205, 2168), true);
  assert.equal(cameraPreviewIsTooSmall(850, 2168), true);
  assert.equal(cameraPreviewIsTooSmall(1070, 2400), true);
  assert.equal(cameraPreviewIsTooSmall(1316, 2400), false);
  assert.ok(Math.abs(cameraPreviewFraction(205, 2168) - 0.0946) < 0.001);
  assert.ok(Math.abs(cameraPreviewFraction(850, 2168) - 0.3921) < 0.001);
});

test("layout graph rules detect semantic gaps, region under-allocation, and state drift", () => {
  assert.deepEqual(findExcessiveRelatedGaps([
    { source: "label", target: "control", sourceEndPx: 50, targetStartPx: 58 },
    { source: "waste", target: "control", sourceEndPx: 50, targetStartPx: 100 },
  ]).map((item) => item.source), ["waste"]);

  assert.deepEqual(findRegionAllocationViolations([
    { name: "preview", role: "primary-visual", fraction: 0.45, minimumFraction: 0.4 },
    { name: "tiny", role: "primary-visual", fraction: 0.2, minimumFraction: 0.4 },
  ]).map((item) => item.name), ["tiny"]);

  assert.equal(findGeometryDrift([
    { name: "preview", state: "idle", bounds: [0, 100, 300, 500] },
    { name: "preview", state: "active", bounds: [0, 100, 300, 500] },
    { name: "preview", state: "error", bounds: [0, 130, 300, 500] },
  ]).length, 1);
});
