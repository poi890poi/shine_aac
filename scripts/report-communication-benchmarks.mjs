import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  CommunicationBenchmarks,
  CommunicationBenchmarkFunctionGroups,
  CommunicationBenchmarkSources
} from "../packages/aac-core/test/communication-benchmarks.fixture.js";
import {
  benchmarkLimitFailures,
  compareBenchmarkSnapshots,
  composeSequence,
  createBenchmarkSnapshot,
  evaluateBenchmark,
  optimizeZhTwText
} from "../packages/aac-core/test/communication-benchmark-runner.js";
import {
  createBoardConfig,
  createSession,
  ZhTwFrequencyDictionary,
  analyzeZhTwPhoneticAccess
} from "../packages/aac-core/src/index.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const reportPath = join(repoRoot, "docs", "COMMUNICATION_BENCHMARK_REPORT.md");
const baselinePath = join(repoRoot, "packages", "aac-core", "test", "communication-benchmark-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");
const generated = new Date().toISOString();
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

const results = CommunicationBenchmarks.map((benchmark) => {
  const result = evaluateBenchmark(benchmark);
  const limitFailures = benchmarkLimitFailures(benchmark, result);
  return {
    benchmark,
    result,
    limitFailures,
    status: limitFailures.length === 0 ? "PASS" : "FAIL"
  };
});
const currentSnapshot = {
  schemaVersion: 1,
  label: "Current communication benchmark candidate",
  generatedAt: generated,
  tasks: results.map(({ benchmark, result }) => createBenchmarkSnapshot(benchmark, result))
};
const benchmarkBaseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineComparison = compareBenchmarkSnapshots(benchmarkBaseline, currentSnapshot, {
  functionGroups: CommunicationBenchmarkFunctionGroups,
  allowTaskSetChanges: updateBaseline
});
const baselineUpdateAllowed = results.every(({ status }) => status === "PASS") &&
  baselineComparison.missingTaskIds.length === 0 &&
  baselineComparison.unexpectedTaskIds.length === 0 &&
  baselineComparison.unreachableTaskIds.length === 0;
if (updateBaseline && baselineUpdateAllowed) {
  writeFileSync(baselinePath, `${JSON.stringify({
    ...currentSnapshot,
    label: benchmarkBaseline.label ?? "Accepted communication benchmark baseline"
  }, null, 2)}\n`, "utf8");
} else if (updateBaseline) {
  console.error("Baseline was not updated because the candidate failed benchmark limits or paired regression gates.");
}
const optimizedZhTwResults = results
  .filter(({ benchmark, result }) =>
    !result.error &&
    (benchmark.profileId ?? "en-US") === "zh-TW" &&
    (benchmark.expectedFinalMessages?.length ?? 0) > 0
  )
  .map(({ benchmark, result }) => ({
    benchmark,
    current: result,
    optimized: optimizeBenchmarkFinalMessage(benchmark)
  }))
  .filter(({ optimized }) => !optimized.error);

const zhTwAccess = analyzeZhTwPhoneticAccess({ topEntryLimit: 500 });
const passedResults = results.filter(({ status }) => status === "PASS");
const totalSelections = sum(passedResults.map(({ result }) => result.metrics.selections));
const totalAdvances = sum(passedResults.map(({ result }) => result.metrics.advances));
const totalActivations = sum(passedResults.map(({ result }) => result.metrics.switches));
const totalEstimatedTimeMs = sum(passedResults.map(({ result }) => result.metrics.estimatedTimeMs));
const totalTargetConcepts = sum(passedResults.map(({ benchmark }) => benchmark.targetConcepts?.length ?? 0));
const totalOutputCharacters = sum(passedResults.map(({ result }) => textLength(result.session?.message ?? result.sequence.join(""))));
const zhTwDirectPhraseCommits = sum(passedResults.map(({ result }) => result.metrics.zhTwDirectPhraseCommits ?? 0));
const zhTwDecomposedPhraseFallbacks = sum(passedResults.map(({ result }) => result.metrics.zhTwDecomposedPhraseFallbacks ?? 0));
const averageTimeSec = totalEstimatedTimeMs / Math.max(1, passedResults.length) / 1000;
const medianTimeSec = median(passedResults.map(({ result }) => result.metrics.estimatedTimeMs / 1000));
const p90TimeSec = percentile(passedResults.map(({ result }) => result.metrics.estimatedTimeMs / 1000), 0.9);
const medianSelections = median(passedResults.map(({ result }) => result.metrics.selections));
const p90Selections = percentile(passedResults.map(({ result }) => result.metrics.selections), 0.9);
const averageActivations = totalActivations / Math.max(1, passedResults.length);
const medianActivations = median(passedResults.map(({ result }) => result.metrics.switches));
const p90Activations = percentile(passedResults.map(({ result }) => result.metrics.switches), 0.9);
const urgentPhraseResults = passedResults.filter(({ benchmark }) => benchmark.timingTarget === "urgent-phrase");
const medianUrgentPhraseTimeSec = median(urgentPhraseResults.map(({ result }) => result.metrics.estimatedTimeMs / 1000));
const activationsPerConcept = totalActivations / Math.max(1, totalTargetConcepts);
const selectionsPerConcept = totalSelections / Math.max(1, totalTargetConcepts);
const activationsPerOutputCharacter = totalActivations / Math.max(1, totalOutputCharacters);
const secondsPerOutputCharacter = totalEstimatedTimeMs / Math.max(1, totalOutputCharacters) / 1000;
const actionCounts = aggregateActionCounts(passedResults.map(({ result }) => result.metrics.tileActions));
const optimizedCurrentTotals = metricTotals(optimizedZhTwResults.map(({ current }) => current.metrics));
const optimizedLeastCostTotals = metricTotals(optimizedZhTwResults.map(({ optimized }) => optimized.metrics));
const benchmarkProfiles = new Set(results.map(({ benchmark }) => benchmark.profileId ?? "en-US"));
const purposeCounts = countBy(results, ({ benchmark }) => benchmark.purpose);
const sourceCounts = countBy(results, ({ benchmark }) => benchmark.source);
const profileCounts = countBy(results, ({ benchmark }) => benchmark.profileId ?? "en-US");
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
const zhTwSourceGlyphLabels = uniqueLabels(ZhTwFrequencyDictionary.filter((entry) => textLength(entry.label) === 1));
const zhTwReachableTopGlyphCount = zhTwTopGlyphLabels.size - zhTwUnreachableTopGlyphLabels.size;
const zhTwReachableTopPhraseCount = zhTwTopPhraseLabels.size - zhTwUnreachableTopPhraseLabels.size;
const zhTwComposableTopPhraseLabels = [...zhTwTopPhraseLabels].filter((label) => isPhraseComposableFromGlyphs(label));
const zhTwExactOrComposableTopPhraseLabels = new Set([
  ...[...zhTwTopPhraseLabels].filter((label) => !zhTwUnreachableTopPhraseLabels.has(label)),
  ...zhTwComposableTopPhraseLabels
]);
const zhTwCompressionOnlyGapCount = [...zhTwTopPhraseLabels]
  .filter((label) => zhTwUnreachableTopPhraseLabels.has(label) && isPhraseComposableFromGlyphs(label))
  .length;
const hiddenContinuationSymbolsWithPrefixes = zhTwAccess.hiddenSymbolStats.filter((stat) => stat.prefixCount > 0).length;
const topGlyphCoverageRatio = ratio(zhTwReachableTopGlyphCount, zhTwTopGlyphLabels.size);
const topPhraseCoverageRatio = ratio(zhTwReachableTopPhraseCount, zhTwTopPhraseLabels.size);
const topPhraseComposableCoverageRatio = ratio(zhTwComposableTopPhraseLabels.length, zhTwTopPhraseLabels.size);
const topPhraseExactOrComposableRatio = ratio(zhTwExactOrComposableTopPhraseLabels.size, zhTwTopPhraseLabels.size);

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
  `| Direct zh-TW phonetic symbols | weighted coverage | ${percent(zhTwAccess.staticCoverageRatio)} | 100% | All 37 symbols directly visible on the first layer |`,
  `| Dynamic zh-TW continuation symbols | Zhuyin symbols | ${hiddenContinuationSymbolsWithPrefixes} | ${zhTwAccess.inputSymbolCount - zhTwAccess.staticSymbolCount} | Hidden symbols required for phonetic input |`,
  `| Dead-end continuation symbols | Zhuyin symbols | ${zhTwAccess.visibleDeadEndContinuations.length} | 0 | Visible continuations that lead to no glyph/phrase candidate |`,
  `| Top zh-TW glyph reachability | unique Han glyphs | ${zhTwReachableTopGlyphCount} / ${zhTwTopGlyphLabels.size} (${percent(topGlyphCoverageRatio)}) | >= 99% | Single-character entries reachable in the top ${zhTwAccess.topEntryLimit} source-ranked dictionary slice |`,
  `| Top zh-TW direct phrase reachability | unique phrases | ${zhTwReachableTopPhraseCount} / ${zhTwTopPhraseLabels.size} (${percent(topPhraseCoverageRatio)}) | >= 95% | Multi-character entries directly reachable as phrase candidates; this is compression, not the only coverage path |`,
  `| Top zh-TW phrase composability | unique phrases | ${zhTwComposableTopPhraseLabels.length} / ${zhTwTopPhraseLabels.size} (${percent(topPhraseComposableCoverageRatio)}) | >= 99% | Phrases whose component glyphs exist in the source dictionary and can be composed character by character |`,
  `| Top zh-TW exact-or-composable phrase coverage | unique phrases | ${zhTwExactOrComposableTopPhraseLabels.size} / ${zhTwTopPhraseLabels.size} (${percent(topPhraseExactOrComposableRatio)}) | >= 99% | Phrase is either directly suggested or constructible from reachable component glyphs |`,
  `| Direct phrase compression gaps | unique phrases | ${zhTwCompressionOnlyGapCount} | review downward | Top phrases not directly reachable but still composable from glyphs |`,
  `| zh-TW functional phrase surface | phrases | ${zhTwFunctionalCount} | ${communicationAreaCount} areas x ${phraseTargetPerArea}-12 phrases = ${zhTwFunctionalSurfaceTarget}-120 | Built-in functional phrases for needs, comfort, care, positioning, people, preference, and repair |`,
  `| Multi-concept utterance coverage | utterances / sentences | ${sequenceLevelCount} | ${communicationAreaCount} areas x ${utteranceTargetPerArea} utterances = ${estimatedUtteranceTarget} | Real communication sequences; this remains the main benchmark gap |`,
  `| Corpus-style zh-TW sentence audit | source sentences | 0 | external reference: ${externalSentenceAuditReference} | BASPRO/TMNews scale reference only; generated filler is not counted |`,
  `| Benchmark pass rate | tasks | ${passedResults.length} | ${results.length} | Evaluation tasks passing current limits |`,
  "",
  "## Effort Metrics",
  "",
  "| Metric | Unit | Total | Average | Median | P90 |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  `| Estimated scan time | seconds | ${seconds(totalEstimatedTimeMs)} | ${averageTimeSec.toFixed(2)} | ${medianTimeSec.toFixed(2)} | ${p90TimeSec.toFixed(2)} |`,
  `| Output selections | selected tiles | ${totalSelections} | ${average(totalSelections, passedResults.length)} | ${medianSelections.toFixed(2)} | ${p90Selections.toFixed(2)} |`,
  `| Switch activations | activations | ${totalActivations} | ${averageActivations.toFixed(2)} | ${medianActivations.toFixed(2)} | ${p90Activations.toFixed(2)} |`,
  `| Scanner advances | row/cell advances | ${totalAdvances} | ${average(totalAdvances, passedResults.length)} | ${median(passedResults.map(({ result }) => result.metrics.advances)).toFixed(2)} | ${percentile(passedResults.map(({ result }) => result.metrics.advances), 0.9).toFixed(2)} |`,
  `| Activations per target concept | activations/concept | ${totalActivations} / ${totalTargetConcepts} | ${activationsPerConcept.toFixed(2)} |`,
  `| Selections per target concept | selections/concept | ${totalSelections} / ${totalTargetConcepts} | ${selectionsPerConcept.toFixed(2)} |`,
  `| Activations per output character | activations/character | ${totalActivations} / ${totalOutputCharacters} | ${activationsPerOutputCharacter.toFixed(2)} |`,
  `| Estimated time per output character | seconds/character | ${seconds(totalEstimatedTimeMs)} / ${totalOutputCharacters} | ${secondsPerOutputCharacter.toFixed(2)} |`,
  `| Direct zh-TW phrase commits | phrase commits | ${zhTwDirectPhraseCommits} | compression wins during benchmark composition |`,
  `| Decomposed zh-TW phrase fallbacks | phrase fallbacks | ${zhTwDecomposedPhraseFallbacks} | phrases completed by composing component glyphs |`,
  `| Least-cost optimized zh-TW tasks | tasks | ${optimizedZhTwResults.length} | expected-final-message tasks with generic path optimization |`,
  "",
  "## Effort Targets",
  "",
  "| Metric | Current | Target | Status |",
  "| --- | ---: | ---: | --- |",
  `| Average benchmark time | ${averageTimeSec.toFixed(2)} sec | <= ${targetAverageTimeSec} sec | ${averageTimeSec <= targetAverageTimeSec ? "meets" : "gap"} |`,
  `| Median urgent phrase time | ${medianUrgentPhraseTimeSec.toFixed(2)} sec across ${urgentPhraseResults.length} marked tasks | <= ${targetMedianUrgentTimeSec} sec | ${medianUrgentPhraseTimeSec <= targetMedianUrgentTimeSec ? "meets" : "gap"} |`,
  `| Average switch activations | ${averageActivations.toFixed(2)} | <= ${targetAverageActivations} | ${averageActivations <= targetAverageActivations ? "meets" : "gap"} |`,
  `| Median switch activations | ${medianActivations.toFixed(2)} | <= ${targetMedianActivations} | ${medianActivations <= targetMedianActivations ? "meets" : "gap"} |`,
  "",
  "## Selected Action Counts",
  "",
  "| Tile Action | Count |",
  "| --- | ---: |",
  ...[...Object.entries(actionCounts)].sort(byKey).map(([action, count]) => `| ${escapeCell(action)} | ${count} |`),
  "",
  "## Least-Cost zh-TW Path Comparison",
  "",
  "This comparison is evaluation-only. It searches dictionary-backed segmentations and visible UI paths for `zh-TW` benchmarks with expected final messages. It does not add app shortcuts.",
  "",
  "| Metric | Current Fixture Path | Least-Cost Estimate | Difference | Change |",
  "| --- | ---: | ---: | ---: | ---: |",
  comparisonRow("Selections", optimizedCurrentTotals.selections, optimizedLeastCostTotals.selections),
  comparisonRow("Switch activations", optimizedCurrentTotals.switches, optimizedLeastCostTotals.switches),
  comparisonRow("Scanner advances", optimizedCurrentTotals.advances, optimizedLeastCostTotals.advances),
  comparisonRow("Estimated scan time sec", optimizedCurrentTotals.estimatedTimeMs / 1000, optimizedLeastCostTotals.estimatedTimeMs / 1000),
  "",
  "| Task | Current Tokens | Optimized Tokens | Current Activations | Optimized Activations | Difference | Change |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: |",
  ...optimizedZhTwResults.map(({ benchmark, current, optimized }) =>
    `| ${escapeCell(benchmark.id)} | ${escapeCell(current.sequence.join(" "))} | ${escapeCell(optimized.sequence.join(" "))} | ${current.metrics.switches} | ${optimized.metrics.switches} | ${signed(optimized.metrics.switches - current.metrics.switches)} | ${percentChange(optimized.metrics.switches, current.metrics.switches)} |`
  ),
  "",
  "## Paired Baseline Regression",
  "",
  `Frozen baseline: ${benchmarkBaseline.label} (${benchmarkBaseline.generatedAt ?? "unknown date"}).`,
  "",
  `Regression gates: ${baselineComparison.passed ? "PASS" : "FAIL"}. Measured improvement over baseline: ${baselineComparison.hasMeasuredImprovement ? "YES" : "NO"}.`,
  "",
  "The gates require aggregate motor effort and scan time, P90 effort and time, and every established communication-function group to remain stable or improve. One task may use at most one additional `更多` selection. This prevents a lower raw paging count from hiding slower or less equitable communication paths.",
  "",
  "| Metric | Baseline | Current | Difference | Change |",
  "| --- | ---: | ---: | ---: | ---: |",
  baselineMetricRow("Selections", "selections"),
  baselineMetricRow("Switch activations", "switches"),
  baselineMetricRow("Scanner advances", "advances"),
  baselineMetricRow("Estimated scan time sec", "estimatedTimeMs", 1000),
  baselineMetricRow("更多 selections", "moreSuggestions"),
  baselineP90Row("P90 switch activations", "switches"),
  baselineP90Row("P90 scan time sec", "estimatedTimeMs", 1000),
  "",
  "| Gate | Status | Detail |",
  "| --- | --- | --- |",
  ...baselineComparison.gates.map((gate) =>
    `| ${escapeCell(gate.id)} | ${gate.passed ? "PASS" : "FAIL"} | ${escapeCell(gate.detail)} |`
  ),
  "",
  "| Communication Function | Baseline Activations | Current Activations | Baseline Time Sec | Current Time Sec | Status |",
  "| --- | ---: | ---: | ---: | ---: | --- |",
  ...baselineComparison.functionGroups.map((group) => {
    const switchesPass = group.candidate.totals.switches <= group.baseline.totals.switches;
    const timePass = group.candidate.totals.estimatedTimeMs <= group.baseline.totals.estimatedTimeMs;
    return `| ${escapeCell(group.id)} | ${group.baseline.totals.switches} | ${group.candidate.totals.switches} | ${seconds(group.baseline.totals.estimatedTimeMs)} | ${seconds(group.candidate.totals.estimatedTimeMs)} | ${switchesPass && timePass ? "PASS" : "FAIL"} |`;
  }),
  "",
  "| Changed Task | Classification | Activation Difference | Time Difference Sec | 更多 Difference |",
  "| --- | --- | ---: | ---: | ---: |",
  ...changedTaskRows(baselineComparison.taskDeltas),
  "",
  "## Read This Correctly",
  "",
  `- Word-list reachability is still tracked: ${projectCoreWordCount} / ${projectCoreWordTarget} Project Core words, but this is not a sentence metric.`,
  `- Current zh-TW phrase-surface coverage is ${zhTwFunctionalCount} phrases against an initial target of ${zhTwFunctionalSurfaceTarget}-120.`,
  `- Real multi-concept utterance coverage is ${sequenceLevelCount} / ${estimatedUtteranceTarget}; that denominator means ${communicationAreaCount} communication areas x ${utteranceTargetPerArea} utterance probes each.`,
  `- Source-licensed natural sentence audit coverage is 0. The ${externalSentenceAuditReference}-sentence number is an external Chinese phonetic-balanced script reference, not a SHINE release target.`,
  `- zh-TW glyph and phrase reachability above comes from source-ranked dictionary entries, not generated sentences.`,
  "- A long phrase does not need to be an early candidate if its component words or glyphs are reachable. Direct phrase candidates are measured as efficiency/compression, while exact-or-composable coverage is the core reachability metric.",
  `- Estimated time uses configured scanner timings along the actual selected path; it is not test runtime.`,
  `- Switch activations are physical input activations. Output selections are selected tiles. Scanner advances are passive highlights before a selection.`,
  "- Least-cost estimates search known dictionary labels and visible UI paths. They are better than scripted demos, but they are still test estimates, not proof of user comfort.",
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
  `- Total target concepts across passing tasks: ${totalTargetConcepts}`,
  `- Total output characters across passing tasks: ${totalOutputCharacters}`,
  `- Activations per target concept: ${activationsPerConcept.toFixed(2)}`,
  `- Activations per output character: ${activationsPerOutputCharacter.toFixed(2)}`,
  `- Direct zh-TW phrase commits during benchmark composition: ${zhTwDirectPhraseCommits}`,
  `- Decomposed zh-TW phrase fallbacks during benchmark composition: ${zhTwDecomposedPhraseFallbacks}`,
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
  "| Task | Source | Best Output | Time Sec | Selections | Activations | Scan Advances | Actions | Limits | Status |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ...results.map(({ benchmark, result, limitFailures, status }) => {
    const source = CommunicationBenchmarkSources[benchmark.source]?.title ?? benchmark.source;
    const output = result.error ? `ERROR: ${result.error.message}` : result.sequence.join(" ");
    const timeSec = result.error ? "-" : seconds(result.metrics.estimatedTimeMs);
    const selections = result.error ? "-" : result.metrics.selections;
    const activations = result.error ? "-" : result.metrics.switches;
    const advances = result.error ? "-" : result.metrics.advances;
    const actions = result.error ? "-" : actionCountsText(result.metrics.tileActions);
    const statusText = limitFailures.length === 0 ? status : `${status}: ${limitFailures.join("; ")}`;
    return `| ${escapeCell(benchmark.id)} | ${escapeCell(source)} | ${escapeCell(output)} | ${timeSec} | ${selections} | ${activations} | ${advances} | ${escapeCell(actions)} | ${escapeCell(benchmarkLimitsText(benchmark))} | ${escapeCell(statusText)} |`;
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
if (results.some(({ status }) => status === "FAIL") || !baselineComparison.passed) {
  process.exitCode = 1;
}

function optimizeBenchmarkFinalMessage(benchmark) {
  const startSession = createSession({
    config: createBoardConfig({ profileId: benchmark.profileId ?? "en-US" })
  });
  const setup = composeSequence(startSession, benchmark.setupTokenSequence ?? []);
  const results = benchmark.expectedFinalMessages.map((message) => {
    const setupMessage = setup.session.message;
    const suffix = String(message).startsWith(setupMessage)
      ? String(message).slice(setupMessage.length)
      : String(message);
    try {
      return optimizeZhTwText(setup.session, suffix);
    } catch (error) {
      return { error };
    }
  });
  return results
    .filter((result) => !result.error)
    .sort((left, right) => compareMetrics(left.metrics, right.metrics))[0] ?? results[0];
}

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

function percentile(values, probability) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * probability) - 1)];
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

function metricTotals(metrics) {
  return metrics.reduce((totals, metric) => ({
    selections: totals.selections + metric.selections,
    switches: totals.switches + metric.switches,
    advances: totals.advances + metric.advances,
    estimatedTimeMs: totals.estimatedTimeMs + metric.estimatedTimeMs
  }), { selections: 0, switches: 0, advances: 0, estimatedTimeMs: 0 });
}

function compareMetrics(left, right) {
  return left.switches - right.switches ||
    left.advances - right.advances ||
    left.estimatedTimeMs - right.estimatedTimeMs ||
    left.selections - right.selections;
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

function signed(value) {
  const rounded = Number.isInteger(value) ? value : Number(value).toFixed(2);
  return value > 0 ? `+${rounded}` : String(rounded);
}

function percentChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return "n/a";
  return `${(((current - previous) / previous) * 100).toFixed(2)}%`;
}

function comparisonRow(label, current, optimized) {
  return `| ${label} | ${formatNumber(current)} | ${formatNumber(optimized)} | ${signed(optimized - current)} | ${percentChange(optimized, current)} |`;
}

function baselineMetricRow(label, key, scale = 1) {
  const baseline = baselineComparison.baseline.totals[key] / scale;
  const current = baselineComparison.candidate.totals[key] / scale;
  return `| ${label} | ${formatNumber(baseline)} | ${formatNumber(current)} | ${signed(current - baseline)} | ${percentChange(current, baseline)} |`;
}

function baselineP90Row(label, key, scale = 1) {
  const baseline = baselineComparison.baseline.p90[key] / scale;
  const current = baselineComparison.candidate.p90[key] / scale;
  return `| ${label} | ${formatNumber(baseline)} | ${formatNumber(current)} | ${signed(current - baseline)} | ${percentChange(current, baseline)} |`;
}

function changedTaskRows(taskDeltas) {
  const changed = taskDeltas.filter((task) => task.classification !== "unchanged");
  if (changed.length === 0) return ["| None | unchanged | 0 | 0 | 0 |"];
  return changed.map((task) => {
    if (!task.metrics) return `| ${escapeCell(task.id)} | unreachable | n/a | n/a | n/a |`;
    return `| ${escapeCell(task.id)} | ${task.classification} | ${signed(task.metrics.switches)} | ${signed(task.metrics.estimatedTimeMs / 1000)} | ${signed(task.metrics.moreSuggestions)} |`;
  });
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function textLength(value) {
  return Array.from(String(value)).length;
}

function uniqueLabels(entries) {
  return new Set(entries.map((entry) => entry.label));
}

function isPhraseComposableFromGlyphs(label) {
  const characters = Array.from(String(label));
  return characters.length > 1 && characters.every((character) => zhTwSourceGlyphLabels.has(character));
}

function actionCountsText(actions = {}) {
  return Object.entries(actions)
    .sort(byKey)
    .map(([action, count]) => `${action}:${count}`)
    .join(", ");
}

function benchmarkLimitsText(benchmark) {
  return [
    `selections<=${benchmark.maxSelections}`,
    Number.isFinite(benchmark.maxSwitchActivations) ? `activations<=${benchmark.maxSwitchActivations}` : null,
    Number.isFinite(benchmark.maxScannerAdvances) ? `advances<=${benchmark.maxScannerAdvances}` : null,
    Number.isFinite(benchmark.maxEstimatedScanTimeSeconds) ? `seconds<=${benchmark.maxEstimatedScanTimeSeconds}` : null
  ].filter(Boolean).join(", ");
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
