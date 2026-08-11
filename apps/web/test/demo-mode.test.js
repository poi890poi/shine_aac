import test from "node:test";
import assert from "node:assert/strict";

import { TileAction } from "../../../packages/aac-core/src/index.js";
import {
  DemoMaximumScanIntervalMs,
  demoTimingConfig,
  longestVisibleContinuation
} from "../src/demo-mode.js";

const candidate = (label, output, action = TileAction.CommitCandidate) => ({ label, output, action });

test("demo chooses the longest continuation from every visible row", () => {
  const rows = [
    [candidate("資", "資"), candidate("資料", "資料")],
    [candidate("資料夾", "資料夾"), candidate("不相干", "其他")]
  ];

  assert.equal(longestVisibleContinuation(rows, "資料夾裡").label, "資料夾");
});

test("demo continuation matching is a prefix match rather than a substring match", () => {
  const rows = [[candidate("料夾", "料夾"), candidate("資料", "資料")]];

  assert.equal(longestVisibleContinuation(rows, "資料夾").label, "資料");
  assert.equal(longestVisibleContinuation(rows, "新資料夾"), null);
});

test("English demo matching completes beyond the already entered partial token", () => {
  const rows = [[candidate("LEFT", "left")], [candidate("LEFT LEG", "left leg")]];

  const match = longestVisibleContinuation(rows, "LEFT LEG PAIN", {
    caseInsensitive: true,
    minimumLengthExclusive: 1
  });
  assert.equal(match.label, "LEFT LEG");
});

test("demo timing caps slow settings without slowing an already faster configuration", () => {
  assert.deepEqual(
    demoTimingConfig({
      scanIntervalMs: 1800,
      transitionPauseMs: 900,
      firstCellPauseMs: 3000,
      inputLatencyCompensationMs: 250,
      marker: "preserved"
    }),
    {
      scanIntervalMs: DemoMaximumScanIntervalMs,
      transitionPauseMs: 0,
      firstCellPauseMs: DemoMaximumScanIntervalMs,
      inputLatencyCompensationMs: 0,
      marker: "preserved"
    }
  );
  assert.equal(demoTimingConfig({ scanIntervalMs: 300, firstCellPauseMs: 450 }).scanIntervalMs, 300);
});
