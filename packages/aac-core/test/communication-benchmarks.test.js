import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CommunicationBenchmarks,
  CommunicationBenchmarkFunctionGroups,
  CommunicationBenchmarkSources
} from "./communication-benchmarks.fixture.js";
import {
  benchmarkLimitFailures,
  compareBenchmarkSnapshots,
  createBenchmarkSnapshot,
  evaluateBenchmark,
  normalizeText,
  optimizeZhTwText
} from "./communication-benchmark-runner.js";
import {
  ScanMode,
  createBoardConfig,
  createSession
} from "../src/index.js";

const benchmarkBaseline = JSON.parse(readFileSync(new URL("./communication-benchmark-baseline.json", import.meta.url), "utf8"));
const benchmarkResultCache = new Map();

function benchmarkResult(benchmark) {
  if (!benchmarkResultCache.has(benchmark.id)) {
    benchmarkResultCache.set(benchmark.id, evaluateBenchmark(benchmark));
  }
  return benchmarkResultCache.get(benchmark.id);
}

test("communication benchmark fixtures have source provenance and no duplicate ids", () => {
  const ids = new Set();
  for (const benchmark of CommunicationBenchmarks) {
    assert.ok(!ids.has(benchmark.id), `duplicate benchmark id ${benchmark.id}`);
    ids.add(benchmark.id);
    assert.ok(CommunicationBenchmarkSources[benchmark.source], `${benchmark.id} has an unknown source`);
    assert.ok(benchmark.sourceExample.length > 0, `${benchmark.id} needs a source example`);
    assert.ok(benchmark.acceptableTokenSequences.length > 0, `${benchmark.id} needs target sequences`);
    for (const field of ["maxSelections", "maxSwitchActivations", "maxScannerAdvances", "maxEstimatedScanTimeSeconds"]) {
      if (benchmark[field] === undefined) continue;
      assert.ok(Number.isFinite(benchmark[field]) && benchmark[field] >= 0, `${benchmark.id} has invalid ${field}`);
    }
  }
});

for (const benchmark of CommunicationBenchmarks) {
  test(`communication benchmark: ${benchmark.id}`, () => {
    const result = benchmarkResult(benchmark);
    assert.ifError(result.error);
    assert.ok(Number.isFinite(result.metrics.zhTwDirectPhraseCommits));
    assert.ok(Number.isFinite(result.metrics.zhTwDecomposedPhraseFallbacks));
    assert.deepEqual(benchmarkLimitFailures(benchmark, result), [], `${benchmark.id} exceeded its configured limits`);
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
    const scripted = benchmarkResult(benchmark);
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

test("benchmark limits enforce every optional bound from the testing plan", () => {
  const benchmark = {
    maxSelections: 2,
    maxSwitchActivations: 4,
    maxScannerAdvances: 5,
    maxEstimatedScanTimeSeconds: 6
  };
  const result = {
    metrics: {
      selections: 3,
      switches: 6,
      advances: 7,
      estimatedTimeMs: 8000
    }
  };
  assert.deepEqual(benchmarkLimitFailures(benchmark, result), [
    "selections 3 selections exceeds 2",
    "switch activations 6 activations exceeds 4",
    "scanner advances 7 advances exceeds 5",
    "estimated scan time 8 seconds exceeds 6"
  ]);
});

test("communication benchmark runner can evaluate block mode independently", () => {
  const fixture = CommunicationBenchmarks.find((benchmark) => benchmark.id === "zhtw-first-page-pain");
  const result = evaluateBenchmark({
    ...fixture,
    scanMode: ScanMode.BlockRowColumn
  });

  assert.ifError(result.error);
  assert.equal(result.session.message, "痛");
  assert.equal(result.metrics.switches, 3);
});

test("English keeps its independently optimized four-column, four-block configuration", () => {
  const englishBenchmarks = CommunicationBenchmarks.filter(
    (benchmark) => (benchmark.profileId ?? "en-US") === "en-US"
  );
  const measure = (columns, scanBlockCount) => englishBenchmarks.reduce((totals, benchmark) => {
    const result = evaluateBenchmark({
      ...benchmark,
      columns,
      scanBlockCount,
      scanMode: ScanMode.BlockRowColumn
    });
    assert.ifError(result.error);
    totals.advances += result.metrics.advances;
    totals.switches += result.metrics.switches;
    totals.estimatedTimeMs += result.metrics.estimatedTimeMs;
    return totals;
  }, { advances: 0, switches: 0, estimatedTimeMs: 0 });

  const fourColumnCandidates = [2, 3, 4, 5, 6].map((blockCount) => ({
    blockCount,
    ...measure(4, blockCount)
  }));
  const fourColumnFourBlock = fourColumnCandidates.find((candidate) => candidate.blockCount === 4);
  const sixColumnFourBlock = measure(6, 4);

  assert.deepEqual(fourColumnFourBlock, {
    blockCount: 4,
    advances: 309,
    switches: 273,
    estimatedTimeMs: 556200
  });
  assert.equal(
    fourColumnCandidates.every((candidate) =>
      fourColumnFourBlock.estimatedTimeMs <= candidate.estimatedTimeMs
    ),
    true
  );
  assert.deepEqual(sixColumnFourBlock, {
    advances: 391,
    switches: 294,
    estimatedTimeMs: 703800
  });
});

test("current communication suite satisfies the frozen paired baseline gates", () => {
  const currentSnapshot = {
    schemaVersion: 1,
    label: "current",
    tasks: CommunicationBenchmarks.map((benchmark) => createBenchmarkSnapshot(benchmark, benchmarkResult(benchmark)))
  };
  const comparison = compareBenchmarkSnapshots(benchmarkBaseline, currentSnapshot, {
    functionGroups: CommunicationBenchmarkFunctionGroups
  });
  assert.deepEqual(comparison.missingTaskIds, []);
  assert.deepEqual(comparison.unexpectedTaskIds, []);
  assert.deepEqual(comparison.unreachableTaskIds, []);
  assert.deepEqual(
    comparison.gates.filter((gate) => !gate.passed),
    [],
    "current communication metrics regressed from the accepted baseline"
  );
});

test("paired comparison rejects fewer More selections when scan cost regresses", () => {
  const baseline = syntheticSnapshot({ switches: 8, estimatedTimeMs: 10000, moreSuggestions: 2 });
  const candidate = syntheticSnapshot({ switches: 8, estimatedTimeMs: 12000, moreSuggestions: 1 });
  const comparison = compareBenchmarkSnapshots(baseline, candidate, {
    functionGroups: { needs: ["need"] }
  });
  assert.equal(comparison.candidate.totals.moreSuggestions < comparison.baseline.totals.moreSuggestions, true);
  assert.equal(comparison.passed, false);
  assert.equal(comparison.gates.find((gate) => gate.id === "total-scan-time")?.passed, false);
  assert.equal(comparison.gates.find((gate) => gate.id === "group-needs-scan-time")?.passed, false);
});

test("paired comparison isolates matched costs when a reviewed fixture set grows", () => {
  const baseline = syntheticSnapshot({ switches: 8, estimatedTimeMs: 10000, moreSuggestions: 2 });
  const candidate = syntheticSnapshot({ switches: 8, estimatedTimeMs: 10000, moreSuggestions: 2 });
  candidate.tasks.push({
    ...candidate.tasks[0],
    id: "new-coverage",
    metrics: { ...candidate.tasks[0].metrics, switches: 40, estimatedTimeMs: 60000 }
  });

  const strict = compareBenchmarkSnapshots(baseline, candidate);
  const reviewed = compareBenchmarkSnapshots(baseline, candidate, { allowTaskSetChanges: true });
  assert.equal(strict.gates.find((gate) => gate.id === "task-set")?.passed, false);
  assert.equal(reviewed.passed, true);
  assert.equal(reviewed.baseline.totals.switches, 8);
  assert.equal(reviewed.candidate.totals.switches, 8);
});

function syntheticSnapshot(metrics) {
  return {
    schemaVersion: 1,
    label: "synthetic",
    tasks: [{
      id: "need",
      profileId: "zh-TW",
      source: "synthetic",
      purpose: "need",
      timingTarget: "urgent-phrase",
      reachable: true,
      error: null,
      sequence: ["need"],
      finalMessage: "need",
      metrics: {
        selections: metrics.switches / 2,
        switches: metrics.switches,
        advances: 5,
        estimatedTimeMs: metrics.estimatedTimeMs,
        moreSuggestions: metrics.moreSuggestions,
        tileActions: {}
      }
    }]
  };
}
