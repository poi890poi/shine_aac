import assert from "node:assert/strict";
import test from "node:test";
import { mountBirdGame } from "../src/embed.js";
import { registerBirdGameTools } from "../src/webmcp.js";

test("standalone integration exports the reusable mount function", () => {
  assert.equal(typeof mountBirdGame, "function");
});

test("browser tools call the same game controller and reject invalid input", async () => {
  const tools = [];
  const context = {
    registerTool(tool, options) {
      tools.push({ tool, options });
    }
  };
  let phase = "ready";
  let score = 0;
  const game = {
    activate() { phase = "running"; },
    start() { phase = "running"; score = 0; },
    getState() { return { phase, score, pass: 1, flowers: [{ height: 0.2 }, { height: 0.3 }] }; }
  };
  const unregister = registerBirdGameTools(game, context);
  assert.deepEqual(tools.map(({ tool }) => tool.name), [
    "activate_bird_game",
    "restart_bird_game"
  ]);
  assert.equal(tools.every(({ tool }) => tool.annotations.readOnlyHint === false), true);
  assert.deepEqual(await tools[0].tool.execute({}), {
    phase: "running",
    score: 0,
    flowersRemaining: 2,
    pass: 1
  });
  assert.throws(() => tools[0].tool.execute({ extra: true }), /empty object/);
  unregister();
  assert.equal(tools[0].options.signal.aborted, true);
});
