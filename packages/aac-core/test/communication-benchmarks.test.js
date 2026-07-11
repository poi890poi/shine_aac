import test from "node:test";
import assert from "node:assert/strict";
import {
  CommunicationBenchmarks,
  CommunicationBenchmarkSources
} from "./communication-benchmarks.fixture.js";
import {
  evaluateBenchmark,
  normalizeText,
  optimizeZhTwText
} from "./communication-benchmark-runner.js";
import {
  createBoardConfig,
  createSession
} from "../src/index.js";

test("communication benchmark fixtures have source provenance and no duplicate ids", () => {
  const ids = new Set();
  for (const benchmark of CommunicationBenchmarks) {
    assert.ok(!ids.has(benchmark.id), `duplicate benchmark id ${benchmark.id}`);
    ids.add(benchmark.id);
    assert.ok(CommunicationBenchmarkSources[benchmark.source], `${benchmark.id} has an unknown source`);
    assert.ok(benchmark.sourceExample.length > 0, `${benchmark.id} needs a source example`);
    assert.ok(benchmark.acceptableTokenSequences.length > 0, `${benchmark.id} needs target sequences`);
  }
});

for (const benchmark of CommunicationBenchmarks) {
  test(`communication benchmark: ${benchmark.id}`, () => {
    const result = evaluateBenchmark(benchmark);
    assert.ifError(result.error);
    assert.ok(Number.isFinite(result.metrics.zhTwDirectPhraseCommits));
    assert.ok(Number.isFinite(result.metrics.zhTwDecomposedPhraseFallbacks));
    assert.ok(
      result.metrics.selections <= benchmark.maxSelections,
      `${benchmark.id} used ${result.metrics.selections} selections for ${result.sequence.join(" ")}`
    );
    if (benchmark.expectedFinalMessages) {
      assert.ok(
        benchmark.expectedFinalMessages.map(normalizeText).includes(normalizeText(result.session.message)),
        `${benchmark.id} ended with ${JSON.stringify(result.session.message)}`
      );
    }
  });
}

test("zh-TW least-cost optimizer does not exceed scripted expected-final paths", () => {
  const benchmarks = CommunicationBenchmarks.filter((benchmark) =>
    benchmark.profileId === "zh-TW" &&
    (benchmark.expectedFinalMessages?.length ?? 0) > 0
  );

  for (const benchmark of benchmarks) {
    const scripted = evaluateBenchmark(benchmark);
    assert.ifError(scripted.error);
    const startSession = createSession({
      config: createBoardConfig({ profileId: "zh-TW" })
    });
    const optimized = optimizeZhTwText(startSession, benchmark.expectedFinalMessages[0]);
    assert.ok(
      optimized.metrics.switches <= scripted.metrics.switches,
      `${benchmark.id} optimized path used ${optimized.metrics.switches} activations vs scripted ${scripted.metrics.switches}`
    );
  }
});
