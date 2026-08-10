import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { analyzeZhTwDictionaryInventory } from "./lib/zhtw-dictionary-inventory.mjs";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const reportPath = join(repoRoot, "docs", "ZHTW_DICTIONARY_INVENTORY_REPORT.md");
const previousInventoryBaseline = Object.freeze({
  label: "Previous pre-efficiency baseline",
  sourceEntryCount: 60000,
  uniqueLabelCount: 33523,
  pathReachableEntryRatio: 0.9846,
  weightedPathReachabilityRatio: 0.9887,
  sourceGlyphDirectRatio: 0.8530,
  sourceWordDirectRatio: 0.9822,
  sourceWordDirectOrComposableRatio: 0.9841,
  sourceLabelDirectOrComposableRatio: 0.9604,
  top500GlyphDirectRatio: 0.9860,
  top500WordDirectRatio: 0.9920,
  glyphMedianActivations: 8,
  directWordMedianActivations: 8,
  bestAllLabelMedianActivations: 8,
  glyphP90Activations: 10,
  directWordP90Activations: 12,
  bestAllLabelP90Activations: 10
});
const startedAt = performance.now();
const analysis = analyzeZhTwDictionaryInventory();
const elapsedMs = performance.now() - startedAt;
const top500GlyphBucket = analysis.topEntityBuckets.find((bucket) => bucket.label === "Top 500 glyphs");
const top500WordBucket = analysis.topEntityBuckets.find((bucket) => bucket.label === "Top 500 words/phrases");

const lines = [
  "# zh-TW Dictionary Inventory Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This is the fast inventory report. It estimates broad source-dictionary reachability and efficiency from the phonetic access graph instead of running real-time scanning or full virtual utterance benchmarks.",
  "",
  "## Inventory",
  "",
  "| Metric | Value | Meaning |",
  "| --- | ---: | --- |",
  `| Source dictionary entries | ${analysis.sourceEntryCount} | Generated New Chewing entries after SHINE length/key limits |`,
  `| Unique source labels | ${analysis.uniqueLabelCount} | Unique glyph, word, and phrase labels |`,
  `| Available Zhuyin symbols | ${analysis.zhuyinSymbolCount} | Full zh-TW phonetic symbol inventory |`,
  `| Static first-level Zhuyin symbols | ${analysis.staticZhuyinSymbolCount} | All symbols visible without paging |`,
  `| Dynamic continuation Zhuyin symbols | ${analysis.dynamicZhuyinSymbolCount} | Hidden symbols required for phonetic input |`,
  `| Source glyph labels | ${analysis.sourceGlyphCount} | Unique single-Han-character labels in the dictionary |`,
  `| Source multi-glyph word/phrase labels | ${analysis.sourceWordCount} | Unique labels longer than one Han character |`,
  `| Unique Han characters appearing anywhere | ${analysis.uniqueHanCharacterCount} | Character inventory across all labels |`,
  "",
  "## Fast Reachability Estimates",
  "",
  "| Metric | Value | Target / Use |",
  "| --- | ---: | --- |",
  `| Entry phonetic-path reachability | ${analysis.pathReachableEntryCount} / ${analysis.sourceEntryCount} (${percent(analysis.pathReachableEntryRatio)}) | Broad graph reachability before candidate rank/page limits |`,
  `| Weighted phonetic-path reachability | ${percent(analysis.weightedPathReachabilityRatio)} | Frequency-weighted view of source entries |`,
  `| Direct glyph candidate reachability | ${analysis.sourceGlyphsReachableDirect} / ${analysis.sourceGlyphCount} (${percent(analysis.sourceGlyphDirectRatio)}) | Single glyph can be committed directly within ${analysis.maxSuggestionPages} pages |`,
  `| Direct word/phrase candidate reachability | ${analysis.sourceWordsReachableDirect} / ${analysis.sourceWordCount} (${percent(analysis.sourceWordDirectRatio)}) | Multi-glyph label can be committed directly within ${analysis.maxSuggestionPages} pages |`,
  `| Word/phrase composability from glyphs | ${analysis.sourceWordsComposableFromGlyphs} / ${analysis.sourceWordCount} (${percent(analysis.sourceWordComposableRatio)}) | Multi-glyph label can be built from direct glyph candidates |`,
  `| Word/phrase direct-or-composable reachability | ${analysis.sourceWordsReachableDirectOrComposable} / ${analysis.sourceWordCount} (${percent(analysis.sourceWordDirectOrComposableRatio)}) | Core coverage view for multi-glyph expressions |`,
  `| All-label direct-or-composable reachability | ${analysis.sourceLabelsReachableDirectOrComposable} / ${analysis.uniqueLabelCount} (${percent(analysis.sourceLabelDirectOrComposableRatio)}) | Core coverage view for all labels |`,
  `| Composition-only word/phrase labels | ${analysis.sourceWordsCompositionOnly} | Reachable through glyph composition but not direct candidate pages |`,
  "",
  "## Top Entity Buckets",
  "",
  "These rows are the main efficiency guardrail. They emphasize high-source-rank glyphs and words/phrases before broad long-tail coverage.",
  "",
  "| Entity Set | Count | Direct Reachable | Direct % | Direct/Composable Reachable | Direct/Composable % | Median Activations | P90 Activations |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...analysis.topEntityBuckets.map(topEntityRow),
  "",
  "## Fast Efficiency Estimates",
  "",
  "| Label Set | Count | Median Activations | P90 Activations | Average Activations | Median Selections | P90 Selections |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  efficiencyRow("Direct glyph candidates", analysis.glyphEfficiency),
  efficiencyRow("Direct word/phrase candidates", analysis.directWordEfficiency),
  efficiencyRow("Best word/phrase direct-or-composed", analysis.bestWordEfficiency),
  efficiencyRow("Best all-label direct-or-composed", analysis.allLabelEfficiency),
  "",
  "## Previous-Version Comparison",
  "",
  `Baseline: ${previousInventoryBaseline.label}. Use this section to review systemic dictionary, coverage, and efficiency movement before accepting ranking/data changes.`,
  "",
  "| Metric | Previous | Current | Difference | Change |",
  "| --- | ---: | ---: | ---: | ---: |",
  comparisonRow("Source dictionary entries", previousInventoryBaseline.sourceEntryCount, analysis.sourceEntryCount),
  comparisonRow("Unique source labels", previousInventoryBaseline.uniqueLabelCount, analysis.uniqueLabelCount),
  comparisonPercentRow("Entry phonetic-path reachability", previousInventoryBaseline.pathReachableEntryRatio, analysis.pathReachableEntryRatio),
  comparisonPercentRow("Weighted phonetic-path reachability", previousInventoryBaseline.weightedPathReachabilityRatio, analysis.weightedPathReachabilityRatio),
  comparisonPercentRow("Direct glyph candidate reachability", previousInventoryBaseline.sourceGlyphDirectRatio, analysis.sourceGlyphDirectRatio),
  comparisonPercentRow("Direct word/phrase candidate reachability", previousInventoryBaseline.sourceWordDirectRatio, analysis.sourceWordDirectRatio),
  comparisonPercentRow("Word/phrase direct-or-composable reachability", previousInventoryBaseline.sourceWordDirectOrComposableRatio, analysis.sourceWordDirectOrComposableRatio),
  comparisonPercentRow("All-label direct-or-composable reachability", previousInventoryBaseline.sourceLabelDirectOrComposableRatio, analysis.sourceLabelDirectOrComposableRatio),
  comparisonPercentRow("Top 500 glyph direct reachability", previousInventoryBaseline.top500GlyphDirectRatio, top500GlyphBucket?.directReachabilityRatio ?? 0),
  comparisonPercentRow("Top 500 word/phrase direct reachability", previousInventoryBaseline.top500WordDirectRatio, top500WordBucket?.directReachabilityRatio ?? 0),
  comparisonRow("Direct glyph median activations", previousInventoryBaseline.glyphMedianActivations, analysis.glyphEfficiency.medianActivations),
  comparisonRow("Direct word/phrase median activations", previousInventoryBaseline.directWordMedianActivations, analysis.directWordEfficiency.medianActivations),
  comparisonRow("Best all-label median activations", previousInventoryBaseline.bestAllLabelMedianActivations, analysis.allLabelEfficiency.medianActivations),
  comparisonRow("Direct glyph P90 activations", previousInventoryBaseline.glyphP90Activations, analysis.glyphEfficiency.p90Activations),
  comparisonRow("Direct word/phrase P90 activations", previousInventoryBaseline.directWordP90Activations, analysis.directWordEfficiency.p90Activations),
  comparisonRow("Best all-label P90 activations", previousInventoryBaseline.bestAllLabelP90Activations, analysis.allLabelEfficiency.p90Activations),
  "",
  "## Sample Gaps",
  "",
  "These samples are diagnostic, not hand-tuning instructions.",
  "",
  "### Glyphs Not Directly Reachable",
  "",
  analysis.sampleUnreachableGlyphs.length === 0
    ? "No sampled direct glyph gaps."
    : analysis.sampleUnreachableGlyphs.join(" "),
  "",
  "### Words/Phrases Not Directly Reachable",
  "",
  analysis.sampleDirectWordGaps.length === 0
    ? "No sampled direct word/phrase gaps."
    : analysis.sampleDirectWordGaps.join(" "),
  "",
  "### Words/Phrases Not Composable From Direct Glyphs",
  "",
  analysis.sampleNotComposableWords.length === 0
    ? "No sampled word/phrase composability gaps."
    : analysis.sampleNotComposableWords.join(" "),
  "",
  "## Method",
  "",
  `- Direct candidate estimate assumes ${analysis.columns} columns, ${analysis.suggestionRows} suggestion rows, and ${analysis.maxSuggestionPages} suggestion pages.`,
  `- One page can expose up to ${analysis.pageCandidateCapacity} direct candidates because one slot is reserved for more-suggestions when paging is needed.`,
  "- Phonetic-path reachability checks that every key symbol is available in the complete static first-layer inventory.",
  "- Direct candidate reachability estimates whether a label appears within the first reachable suggestion pages after composing its key.",
  "- Composable reachability treats long labels as possible when every component glyph has a direct candidate path.",
  "- Efficiency is estimated as two switch activations per selected tile. It intentionally excludes real-time row/cell waits; virtual communication benchmarks cover realistic scan path cost.",
  `- Runtime for this report: ${elapsedMs.toFixed(0)} ms on this machine.`,
  ""
];

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, lines.join("\n"), "utf8");
console.log(`Wrote ${reportPath} in ${elapsedMs.toFixed(0)} ms`);

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function efficiencyRow(label, stats) {
  return `| ${label} | ${stats.count} | ${stats.medianActivations.toFixed(0)} | ${stats.p90Activations.toFixed(0)} | ${stats.averageActivations.toFixed(2)} | ${stats.medianSelections.toFixed(0)} | ${stats.p90Selections.toFixed(0)} |`;
}

function topEntityRow(bucket) {
  return `| ${bucket.label} | ${bucket.count} | ${bucket.directReachable} | ${percent(bucket.directReachabilityRatio)} | ${bucket.directOrComposableReachable} | ${percent(bucket.directOrComposableReachabilityRatio)} | ${bucket.bestEfficiency.medianActivations.toFixed(0)} | ${bucket.bestEfficiency.p90Activations.toFixed(0)} |`;
}

function comparisonRow(label, previous, current) {
  return `| ${label} | ${formatNumber(previous)} | ${formatNumber(current)} | ${signed(current - previous)} | ${percentChange(current, previous)} |`;
}

function comparisonPercentRow(label, previous, current) {
  return `| ${label} | ${percent(previous)} | ${percent(current)} | ${signed((current - previous) * 100)} pp | ${percentChange(current, previous)} |`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function signed(value) {
  const rounded = Number.isInteger(value) ? value : Number(value).toFixed(2);
  return value > 0 ? `+${rounded}` : String(rounded);
}

function percentChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return "n/a";
  return `${(((current - previous) / previous) * 100).toFixed(2)}%`;
}
