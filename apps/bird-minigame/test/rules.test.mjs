import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt } from "../scripts/build-prompt.mjs";
import { validateRules } from "../scripts/validate-rules.mjs";

test("all character and flight rules are internally consistent", async () => {
  assert.deepEqual(await validateRules(), []);
});

test("anchor prompt locks diagnostic dimensions", async () => {
  const prompt = await buildPrompt("mikado_pheasant", "anchor");
  assert.match(prompt, /tail length: 230/);
  assert.match(prompt, /bill, wing and tail length x 1\.00/);
  assert.match(prompt, /preserve the numeric component ratios within 6 percent/);
});

test("pose prompt forbids resizing components", async () => {
  const prompt = await buildPrompt("yellow_tit", "pose", "power_downstroke");
  const compactPrompt = prompt.replace(/\s+/g, " ");
  assert.match(compactPrompt, /near-wing angle: -48 degrees/);
  assert.match(compactPrompt, /may not grow, shrink, detach, duplicate/);
  assert.match(compactPrompt, /body may rotate but may not stretch/);
});

test("long-tail pose prompt declares flexible centerline geometry", async () => {
  const prompt = await buildPrompt("mikado_pheasant", "pose", "power_downstroke");
  const compactPrompt = prompt.replace(/\s+/g, " ");
  assert.match(compactPrompt, /visible downward bend begins at 0\.24/);
  assert.match(compactPrompt, /tail-tip downward displacement: 0\.22/);
  assert.match(compactPrompt, /tail-tip tangent: 27 degrees downward/);
  assert.match(compactPrompt, /Measure tail length along the curved centerline/);
  assert.match(compactPrompt, /must not be rigid rods/);
});
