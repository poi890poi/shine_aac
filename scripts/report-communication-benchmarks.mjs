import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  CommunicationBenchmarks,
  CommunicationBenchmarkSources
} from "../packages/aac-core/test/communication-benchmarks.fixture.js";
import { evaluateBenchmark } from "../packages/aac-core/test/communication-benchmark-runner.js";
import {
  ZhTwFrequencyDictionary,
  analyzeZhTwPhoneticAccess
} from "../packages/aac-core/src/index.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const reportPath = join(repoRoot, "docs", "COMMUNICATION_BENCHMARK_REPORT.md");
const projectCoreWordTarget = 36;
const communicationAreaCount = 10;
const phraseTargetPerArea = 8;
const utteranceTargetPerArea = 12;
const zhTwFunctionalSurfaceTarget = 80;
const estimatedUtteranceTarget = communicationAreaCount * utteranceTargetPerArea;
const externalSentenceAuditReference = 400;
const targetAverageTimeSec = 15;
const targetMedianUrgentTimeSec = 10;
const targetAverageActivations = 6;
const targetMedianActivations = 4;
const expectedProfiles = Object.freeze(["en-US", "zh-TW"]);
const criticalFunctionGroups = Object.freeze({
  "universal-core": ["universal-core-word"],
  "daily-needs": ["need", "wants-needs", "request-or-transition", "comfort-object"],
  "body-comfort": ["body-comfort", "feelings"],
  "refusal-control": ["refusal", "refusal-control", "permission-refusal", "preference-refusal"],
  "care-health": ["care-help", "care-health", "care-people"],
  "positioning": ["positioning"],
  "people-social": ["people", "identity"],
  "preference": ["preference"],
  "conversation-repair": ["conversation", "repair-repeat", "repair-close", "repair-wait", "operational-repair"],
  "regression": ["app-regression"]
});
const previousRunMetrics = Object.freeze({
  "project-core-refuse-drink": Object.freeze({ selections: 4, advances: 15 }),
  "asha-feelings-sick": Object.freeze({ selections: 4, advances: 33 })
});

const results = CommunicationBenchmarks.map((benchmark) => {
  const result = evaluateBenchmark(benchmark);
  return {
    benchmark,
    result,
    status: !result.error && result.metrics.selections <= benchmark.maxSelections ? "PASS" : "FAIL"
  };
});

const zhTwAccess = analyzeZhTwPhoneticAccess({ topEntryLimit: 500 });
const passedResults = results.filter(({ status }) => status === "PASS");
const totalSelections = sum(passedResults.map(({ result }) => result.metrics.selections));
const totalAdvances = sum(passedResults.map(({ result }) => result.metrics.advances));
const totalActivations = sum(passedResults.map(({ result }) => result.metrics.switches));
const totalEstimatedTimeMs = sum(passedResults.map(({ result }) => result.metrics.estimatedTimeMs));
const averageTimeSec = totalEstimatedTimeMs / Math.max(1, passedResults.length) / 1000;
const medianTimeSec = median(passedResults.map(({ result }) => result.metrics.estimatedTimeMs / 1000));
const averageActivations = totalActivations / Math.max(1, passedResults.length);
const medianActivations = median(passedResults.map(({ result }) => result.metrics.switches));
const actionCounts = aggregateActionCounts(passedResults.map(({ result }) => result.metrics.tileActions));
const benchmarkProfiles = new Set(results.map(({ benchmark }) => benchmark.profileId ?? "en-US"));
const purposeCounts = countBy(results, ({ benchmark }) => benchmark.purpose);
const sourceCounts = countBy(results, ({ benchmark }) => benchmark.source);
const profileCounts = countBy(results, ({ benchmark }) => benchmark.profileId ?? "en-US");
const coveredGroups = Object.entries(criticalFunctionGroups)
  .filter(([, purposes]) => purposes.some((purpose) => purposeCounts.get(purpose) > 0))
  .map(([group]) => group);
const missingGroups = Object.keys(criticalFunctionGroups)
  .filter((group) => !coveredGroups.includes(group));
const projectCoreWordCount = results.filter(({ benchmark }) =>
  benchmark.source === "projectCoreUniversalCore" &&
  benchmark.purpose === "universal-core-word"
).length;
const zhTwFunctionalCount = results.filter(({ benchmark }) =>
  benchmark.source === "shineZhTwFunctionalVocabulary"
).length;
const sequenceLevelCount = results.filter(({ benchmark }) =>
  (benchmark.targetConcepts?.length ?? 0) > 1 ||
  (benchmark.setupTokenSequence?.length ?? 0) > 0
).length;
const taskTypeCounts = countBy(results, ({ benchmark }) => benchmarkTaskType(benchmark));
const zhTwTopRankedEntries = ZhTwFrequencyDictionary
  .slice()
  .sort((left, right) => left.frequencyRank - right.frequencyRank)
  .slice(0, zhTwAccess.topEntryLimit);
const zhTwTopGlyphLabels = uniqueLabels(zhTwTopRankedEntries.filter((entry) => textLength(entry.label) === 1));
const zhTwTopPhraseLabels = uniqueLabels(zhTwTopRankedEntries.filter((entry) => textLength(entry.label) > 1));
const zhTwUnreachableTopGlyphLabels = uniqueLabels(zhTwAccess.unreachableTopEntries.filter((entry) => textLength(entry.label) === 1));
const zhTwUnreachableTopPhraseLabels = uniqueLabels(zhTwAccess.unreachableTopEntries.filter((entry) => textLength(entry.label) > 1));
const zhTwReachableTopGlyphCount = zhTwTopGlyphLabels.size - zhTwUnreachableTopGlyphLabels.size;
const zhTwReachableTopPhraseCount = zhTwTopPhraseLabels.size - zhTwUnreachableTopPhraseLabels.size;
const hiddenContinuationSymbolsWithPrefixes = zhTwAccess.hiddenSymbolStats.filter((stat) => stat.prefixCount > 0).length;
const topGlyphCoverageRatio = ratio(zhTwReachableTopGlyphCount, zhTwTopGlyphLabels.size);
const topPhraseCoverageRatio = ratio(zhTwReachableTopPhraseCount, zhTwTopPhraseLabels.size);

const generated = new Date().toISOString();
const lines = [
  "# Communication Benchmark Report",
  "",
  `Generated: ${generated}`,
  "",
  "These benchmarks are evaluation-only. They must not be used as special-case app logic.",
  "",
  "## Real-World Metrics",
  "",
  "| Metric | Unit | Current | Denominator / Target | Meaning |",
  "| --- | --- | ---: | ---: | --- |",
  `| Direct zh-TW phonetic symbols | weighted coverage | ${percent(zhTwAccess.staticCoverageRatio)} | >= 98% | Static symbols available without copying a full keyboard |`,
  `| Dynamic zh-TW continuation symbols | Zhuyin symbols | ${hiddenContinuationSymbolsWithPrefixes} | ${zhTwAccess.inputSymbolCount - zhTwAccess.staticSymbolCount} | Hidden symbols that can appear as valid continuations |`,
  `| Dead-end continuation symbols | Zhuyin symbols | ${zhTwAccess.visibleDeadEndContinuations.length} | 0 | Visible continuations that lead to no glyph/phrase candidate |`,
  `| Top zh-TW glyph reachability | unique Han glyphs | ${zhTwReachableTopGlyphCount} / ${zhTwTopGlyphLabels.size} (${percent(topGlyphCoverageRatio)}) | >= 99% | Single-character entries reachable in the top ${zhTwAccess.topEntryLimit} source-ranked dictionary slice |`,
  `| Top zh-TW phrase reachability | unique phrases | ${zhTwReachableTopPhraseCount} / ${zhTwTopPhraseLabels.size} (${percent(topPhraseCoverageRatio)}) | >= 95% | Multi-character entries reachable in the top ${zhTwAccess.topEntryLimit} source-ranked dictionary slice |`,
  `| zh-TW functional phrase surface | phrases | ${zhTwFunctionalCount} | ${communicationAreaCount} areas x ${phraseTargetPerArea}-12 phrases = ${zhTwFunctionalSurfaceTarget}-120 | Built-in functional phrases for needs, comfort, care, positioning, people, preference, and repair |`,
  `| Multi-concept utterance coverage | utterances / sentences | ${sequenceLevelCount} | ${communicationAreaCount} areas x ${utteranceTargetPerArea} utterances = ${estimatedUtteranceTarget} | Real communication sequences; this remains the main benchmark gap |`,
  `| Corpus-style zh-TW sentence audit | source sentences | 0 | external reference: ${externalSentenceAuditReference} | BASPRO/TMNews scale reference only; generated filler is not counted |`,
  `| Benchmark pass rate | tasks | ${passedResults.length} | ${results.length} | Evaluation tasks passing current limits |`,
  "",
  "## Effort Metrics",
  "",
  "| Metric | Unit | Total | Average Per Passing Task |",
  "| --- | --- | ---: | ---: |",
  `| Estimated scan time | seconds | ${seconds(totalEstimatedTimeMs)} | ${averageTimeSec.toFixed(2)} avg / ${medianTimeSec.toFixed(2)} median |`,
  `| Output selections | selected tiles | ${totalSelections} | ${average(totalSelections, passedResults.length)} |`,
  `| Switch activations | activations | ${totalActivations} | ${averageActivations.toFixed(2)} avg / ${medianActivations.toFixed(2)} median |`,
  `| Scanner advances | row/cell advances | ${totalAdvances} | ${average(totalAdvances, passedResults.length)} |`,
  "",
  "## Effort Targets",
  "",
  "| Metric | Current | Target | Status |",
  "| --- | ---: | ---: | --- |",
  `| Average benchmark time | ${averageTimeSec.toFixed(2)} sec | <= ${targetAverageTimeSec} sec | ${averageTimeSec <= targetAverageTimeSec ? "meets" : "gap"} |`,
  `| Median benchmark time | ${medianTimeSec.toFixed(2)} sec | <= ${targetMedianUrgentTimeSec} sec urgent phrase target | ${medianTimeSec <= targetMedianUrgentTimeSec ? "meets" : "gap"} |`,
  `| Average switch activations | ${averageActivations.toFixed(2)} | <= ${targetAverageActivations} | ${averageActivations <= targetAverageActivations ? "meets" : "gap"} |`,
  `| Median switch activations | ${medianActivations.toFixed(2)} | <= ${targetMedianActivations} | ${medianActivations <= targetMedianActivations ? "meets" : "gap"} |`,
  "",
  "## Selected Action Counts",
  "",
  "| Tile Action | Count |",
  "| --- | ---: |",
  ...[...Object.entries(actionCounts)].sort(byKey).map(([action, count]) => `| ${escapeCell(action)} | ${count} |`),
  "",
  "## Read This Correctly",
  "",
  `- Word-list reachability is still tracked: ${projectCoreWordCount} / ${projectCoreWordTarget} Project Core words, but this is not a sentence metric.`,
  `- Current zh-TW phrase-surface coverage is ${zhTwFunctionalCount} phrases against an initial target of ${zhTwFunctionalSurfaceTarget}-120.`,
  `- Real multi-concept utterance coverage is ${sequenceLevelCount} / ${estimatedUtteranceTarget}; that denominator means ${communicationAreaCount} communication areas x ${utteranceTargetPerArea} utterance probes each.`,
  `- Source-licensed natural sentence audit coverage is 0. The ${externalSentenceAuditReference}-sentence number is an external Chinese phonetic-balanced script reference, not a SHINE release target.`,
  `- zh-TW glyph and phrase reachability above comes from source-ranked dictionary entries, not generated sentences.`,
  `- Estimated time uses configured scanner timings along the actual selected path; it is not test runtime.`,
  `- Switch activations are physical input activations. Output selections are selected tiles. Scanner advances are passive highlights before a selection.`,
  "",
  "## Sentence Target Rationale",
  "",
  `The estimated target is ${estimatedUtteranceTarget} multi-concept utterance tasks, not ${estimatedUtteranceTarget} generated sentences.`,
  `A useful target should cover repeated examples across ${communicationAreaCount} stable communication areas without optimizing for any one example:`,
  "",
  "| Communication Area | Utterance Target |",
  "| --- | ---: |",
  `| Basic needs | ${utteranceTargetPerArea} |`,
  `| Body comfort and status | ${utteranceTargetPerArea} |`,
  `| Care and medical support | ${utteranceTargetPerArea} |`,
  `| Positioning and environment | ${utteranceTargetPerArea} |`,
  `| Refusal, consent, and control | ${utteranceTargetPerArea} |`,
  `| People and relationship | ${utteranceTargetPerArea} |`,
  `| Preference and choice | ${utteranceTargetPerArea} |`,
  `| Conversation repair and pacing | ${utteranceTargetPerArea} |`,
  `| Social closeness and etiquette | ${utteranceTargetPerArea} |`,
  `| Operational app control | ${utteranceTargetPerArea} |`,
  "",
  "The current report now treats that as a gap, not as solved by word or tile reachability.",
  "",
  `For source-sentence audits, ${externalSentenceAuditReference} sentences is only a reference scale from Chinese phonetic-balanced script work. SHINE should count only licensed corpus lines or clinician/caregiver-reviewed materials toward that metric.`,
  "",
  "## Target Formulas",
  "",
  "| Number | Formula | Meaning |",
  "| ---: | --- | --- |",
  `| ${zhTwFunctionalSurfaceTarget}-120 | ${communicationAreaCount} communication areas x ${phraseTargetPerArea}-12 phrases | Minimum functional phrase inventory range. |`,
  `| ${estimatedUtteranceTarget} | ${communicationAreaCount} communication areas x ${utteranceTargetPerArea} utterances | SHINE benchmark target for composable AAC utterance paths. |`,
  `| ${externalSentenceAuditReference} | BASPRO/TMNews external reference: 20 sets x 20 Chinese sentences | Reference scale for future licensed source-sentence audits, not a current product target. |`,
  "",
  "## Evidence Tiers",
  "",
  "- Tier A: source-backed vocabulary or language data, including Project Core words and Chewing-backed zh-TW phonetic access analysis",
  "- Tier B: current zh-TW product-surface functional vocabulary, measured for reachability and scanning cost",
  "- Tier C: app regression and workflow checks",
  "",
  "More high-quality data should be added as new Tier A or clinician/caregiver-reviewed Tier B material, not as generated filler sentences.",
  "",
  "## Result Stats",
  "",
  `- Total estimated scan time across passing tasks: ${seconds(totalEstimatedTimeMs)} seconds`,
  `- Average estimated scan time per passing task: ${seconds(totalEstimatedTimeMs / Math.max(1, passedResults.length))} seconds`,
  `- Total selections across passing tasks: ${totalSelections}`,
  `- Average selections per passing task: ${average(totalSelections, passedResults.length)}`,
  `- Total switch activations across passing tasks: ${totalActivations}`,
  `- Average switch activations per passing task: ${average(totalActivations, passedResults.length)}`,
  `- Total scan advances across passing tasks: ${totalAdvances}`,
  `- Average scan advances per passing task: ${average(totalAdvances, passedResults.length)}`,
  "",
  "## Task Type Counts",
  "",
  "| Task Type | Tasks |",
  "| --- | ---: |",
  ...[...taskTypeCounts.entries()].sort(byKey).map(([type, count]) => `| ${escapeCell(type)} | ${count} |`),
  "",
  "## Profile Counts",
  "",
  "| Profile | Tasks |",
  "| --- | ---: |",
  ...[...profileCounts.entries()].sort(byKey).map(([profile, count]) => `| ${profile} | ${count} |`),
  "",
  "## Purpose Counts",
  "",
  "| Purpose | Tasks |",
  "| --- | ---: |",
  ...[...purposeCounts.entries()].sort(byKey).map(([purpose, count]) => `| ${escapeCell(purpose)} | ${count} |`),
  "",
  "## Source Counts",
  "",
  "| Source | Tasks |",
  "| --- | ---: |",
  ...[...sourceCounts.entries()].sort(byKey).map(([sourceId, count]) => {
    const source = CommunicationBenchmarkSources[sourceId]?.title ?? sourceId;
    return `| ${escapeCell(source)} | ${count} |`;
  }),
  "",
  "| Task | Source | Best Output | Time Sec | Selections | Activations | Scan Advances | Actions | Limit | Status |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |",
  ...results.map(({ benchmark, result, status }) => {
    const source = CommunicationBenchmarkSources[benchmark.source]?.title ?? benchmark.source;
    const output = result.error ? `ERROR: ${result.error.message}` : result.sequence.join(" ");
    const timeSec = result.error ? "-" : seconds(result.metrics.estimatedTimeMs);
    const selections = result.error ? "-" : result.metrics.selections;
    const activations = result.error ? "-" : result.metrics.switches;
    const advances = result.error ? "-" : result.metrics.advances;
    const actions = result.error ? "-" : actionCountsText(result.metrics.tileActions);
    return `| ${escapeCell(benchmark.id)} | ${escapeCell(source)} | ${escapeCell(output)} | ${timeSec} | ${selections} | ${activations} | ${advances} | ${escapeCell(actions)} | ${benchmark.maxSelections} | ${status} |`;
  }),
  "",
  "## Latest Improvement Summary",
  "",
  "| Task | Previous Selections | Current Selections | Previous Scan Advances | Current Scan Advances |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...results
    .filter(({ benchmark }) => previousRunMetrics[benchmark.id])
    .map(({ benchmark, result }) => {
      const previous = previousRunMetrics[benchmark.id];
      return `| ${escapeCell(benchmark.id)} | ${previous.selections} | ${result.metrics.selections} | ${previous.advances} | ${result.metrics.advances} |`;
    }),
  "",
  "## Sources",
  "",
  ...Object.entries(CommunicationBenchmarkSources).flatMap(([id, source]) => [
    `- ${source.title}: ${source.url}`,
    ...source.notes.map((note) => `  - ${note}`)
  ]),
  ""
];

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, lines.join("\n"), "utf8");
console.log(`Wrote ${reportPath}`);

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(total, count) {
  if (count === 0) return "0.00";
  return (total / count).toFixed(2);
}

function ratio(numerator, denominator) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values) {
    const key = keyFn(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function aggregateActionCounts(actionMaps) {
  const counts = {};
  for (const actions of actionMaps) {
    for (const [action, count] of Object.entries(actions ?? {})) {
      counts[action] = (counts[action] ?? 0) + count;
    }
  }
  return counts;
}

function byKey([left], [right]) {
  return String(left).localeCompare(String(right));
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function seconds(valueMs) {
  return (valueMs / 1000).toFixed(2);
}

function textLength(value) {
  return Array.from(String(value)).length;
}

function uniqueLabels(entries) {
  return new Set(entries.map((entry) => entry.label));
}

function actionCountsText(actions = {}) {
  return Object.entries(actions)
    .sort(byKey)
    .map(([action, count]) => `${action}:${count}`)
    .join(", ");
}

function benchmarkTaskType(benchmark) {
  if (benchmark.purpose === "universal-core-word") return "word reachability";
  if (benchmark.source === "shineZhTwFunctionalVocabulary") return "zh-TW functional surface";
  if (
    (benchmark.targetConcepts?.length ?? 0) > 1 ||
    (benchmark.setupTokenSequence?.length ?? 0) > 0
  ) {
    return "multi-concept / operational utterance";
  }
  return "single-concept workflow";
}
