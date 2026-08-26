import assert from "node:assert/strict";
import test from "node:test";
import {
  createCalibrationState,
  duplicateCalibrationEvents,
  medianCalibrationInterval
} from "../src/calibration-model.js";

test("calibration state starts isolated and ready for helper input", () => {
  const first = createCalibrationState("unreliable");
  const second = createCalibrationState("unreliable");

  first.events.push({ deltaMs: 100 });
  assert.equal(second.events.length, 0);
  assert.equal(first.trials.total, 5);
  assert.equal(first.inputClass, "unreliable");
});

test("calibration statistics separate duplicate events from deliberate intervals", () => {
  const events = [
    { deltaMs: null },
    { deltaMs: 120 },
    { deltaMs: 800 },
    { deltaMs: 600 },
    { deltaMs: 1000 }
  ];

  assert.equal(duplicateCalibrationEvents(events).length, 1);
  assert.equal(medianCalibrationInterval(events), 800);
});
