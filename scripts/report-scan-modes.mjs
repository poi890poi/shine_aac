import {
  ScanMode,
  boardRows,
  createBoardConfig,
  scanAccessCost,
  scanRecognitionLoad,
  selectableCount
} from "../packages/aac-core/src/index.js";
import { CommunicationBenchmarks } from "../packages/aac-core/test/communication-benchmarks.fixture.js";
import { evaluateBenchmark } from "../packages/aac-core/test/communication-benchmark-runner.js";

const modes = [ScanMode.RowColumn, ScanMode.BlockRowColumn];
const profiles = ["en-US", "zh-TW"];
const englishBenchmarks = CommunicationBenchmarks.filter(
  (benchmark) => (benchmark.profileId ?? "en-US") === "en-US"
);

const report = profiles.map((profileId) => {
  const config = createBoardConfig({ profileId });
  const rows = boardRows(config);
  const count = (rowIndex) => selectableCount(rows[rowIndex]);
  const results = Object.fromEntries(modes.map((mode) => [
    mode,
    measureMode(rows, count, mode, config.scanBlockCount)
  ]));
  const baseline = results[ScanMode.RowColumn];
  const candidate = results[ScanMode.BlockRowColumn];
  return {
    profileId,
    rowCount: rows.length,
    selectableItemCount: rows.reduce((total, row) => total + selectableCount(row), 0),
    modes: results,
    comparison: {
      averageAdvanceReductionPercent: percentReduction(
        baseline.averageScannerAdvances,
        candidate.averageScannerAdvances
      ),
      additionalSwitchActivationsPerSelection:
        candidate.averageSwitchActivations - baseline.averageSwitchActivations,
      topLevelChoiceReductionPercent: percentReduction(
        baseline.recognitionLoad.topLevelChoices,
        candidate.recognitionLoad.topLevelChoices
      )
    }
  };
});

console.log(JSON.stringify({
  schemaVersion: 1,
  description: "Uniform-visible-target scan-mode benchmark; recognition metrics are visual-load proxies, not human performance measurements.",
  report,
  englishCommunicationOptimization: {
    taskCount: englishBenchmarks.length,
    description: "Source-backed English communication tasks evaluated independently across board widths and block counts.",
    candidates: [4, 6].flatMap((columns) =>
      [2, 3, 4, 5, 6].map((scanBlockCount) =>
        measureEnglishCommunication(columns, scanBlockCount)
      )
    )
  }
}, null, 2));

function measureEnglishCommunication(columns, scanBlockCount) {
  const results = englishBenchmarks.map((benchmark) => evaluateBenchmark({
    ...benchmark,
    columns,
    scanBlockCount,
    scanMode: ScanMode.BlockRowColumn
  }));
  return results.reduce((totals, result) => {
    if (result.error) {
      totals.unreachable += 1;
      return totals;
    }
    totals.switchActivations += result.metrics.switches;
    totals.scannerAdvances += result.metrics.advances;
    totals.estimatedScanTimeMs += result.metrics.estimatedTimeMs;
    return totals;
  }, {
    columns,
    scanBlockCount,
    unreachable: 0,
    switchActivations: 0,
    scannerAdvances: 0,
    estimatedScanTimeMs: 0
  });
}

function measureMode(rows, columnCountForRow, mode, scanBlockCount) {
  const costs = [];
  rows.forEach((row, rowIndex) => {
    for (let cellIndex = 0; cellIndex < selectableCount(row); cellIndex += 1) {
      costs.push(scanAccessCost(
        rows.length,
        columnCountForRow,
        rowIndex,
        cellIndex,
        mode,
        scanBlockCount
      ));
    }
  });
  return {
    averageScannerAdvances: average(costs.map((cost) => cost.scannerAdvances)),
    maximumScannerAdvances: Math.max(...costs.map((cost) => cost.scannerAdvances)),
    averageSwitchActivations: average(costs.map((cost) => cost.switchActivations)),
    recognitionLoad: scanRecognitionLoad(rows.length, columnCountForRow, mode, scanBlockCount)
  };
}

function average(values) {
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3));
}

function percentReduction(baseline, candidate) {
  if (baseline <= 0) return 0;
  return Number((((baseline - candidate) / baseline) * 100).toFixed(1));
}
