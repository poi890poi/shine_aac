import test from "node:test";
import assert from "node:assert/strict";
import {
  CommunicationBenchmarks,
  CommunicationBenchmarkSources
} from "./communication-benchmarks.fixture.js";
import {
  evaluateBenchmark,
  normalizeText
} from "./communication-benchmark-runner.js";

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
