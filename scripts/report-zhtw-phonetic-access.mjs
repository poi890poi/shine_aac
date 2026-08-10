import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  LanguageProfiles,
  ZhuyinStaticInputSymbols,
  analyzeZhTwPhoneticAccess
} from "../packages/aac-core/src/index.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const reportPath = join(repoRoot, "docs", "ZHTW_PHONETIC_ACCESS_REPORT.md");
const analysis = analyzeZhTwPhoneticAccess({ topEntryLimit: 500 });
const hiddenWithPrefixes = analysis.hiddenSymbolStats.filter((stat) => stat.prefixCount > 0);
const blockedHidden = hiddenWithPrefixes.filter((stat) => !stat.allPrefixesVisible);
const visibleDeadEnds = analysis.visibleDeadEndContinuations;
const staticSymbols = ZhuyinStaticInputSymbols.join(" ");

const lines = [
  "# zh-TW Phonetic Access Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This report treats Zhuyin input as an AAC access graph with a complete, stable first-layer symbol inventory.",
  "It measures whether all phonetic paths and dictionary-backed candidates remain reachable without hidden symbols or hand-crafted phrase shortcuts.",
  "",
  "## Summary",
  "",
  `- Recommendation columns: ${analysis.columns}`,
  `- First-layer Zhuyin columns: ${LanguageProfiles["zh-TW"].columns}`,
  `- Static Zhuyin symbols: ${analysis.staticSymbolCount} / ${analysis.inputSymbolCount}`,
  `- Static symbol set: ${staticSymbols}`,
  `- Dictionary entries analyzed: ${analysis.dictionaryEntryCount}`,
  `- Weighted first-symbol coverage: ${percent(analysis.staticCoverageRatio)}`,
  `- Hidden continuation symbols with dictionary prefixes: ${hiddenWithPrefixes.length}`,
  `- Hidden continuation symbols with at least one blocked prefix: ${blockedHidden.length}`,
  `- Visible dead-end continuations: ${visibleDeadEnds.length}`,
  `- Unreachable entries among top ${analysis.topEntryLimit} source-ranked entries: ${analysis.unreachableTopEntries.length}`,
  "",
  "## Top First Symbols By Weighted Coverage",
  "",
  "| Symbol | Static | Entries | Weight |",
  "| --- | --- | ---: | ---: |",
  ...analysis.topFirstSymbolsByWeight.slice(0, 16).map((stat) =>
    `| ${stat.symbol} | ${stat.static ? "yes" : "no"} | ${stat.entryCount} | ${round(stat.weight)} |`
  ),
  "",
  "## Hidden Continuation Symbols",
  "",
  "| Symbol | Entries | Prefixes | Visible Prefixes | All Visible |",
  "| --- | ---: | ---: | ---: | --- |",
  ...hiddenWithPrefixes.map((stat) =>
    `| ${stat.symbol} | ${stat.entryCount} | ${stat.prefixCount} | ${stat.visiblePrefixCount} | ${stat.allPrefixesVisible ? "yes" : "no"} |`
  ),
  "",
  "## Visible Dead-End Continuations",
  "",
  visibleDeadEnds.length === 0
    ? "No visible continuation symbols lead to a source-empty prefix."
    : "| Prefix | Suggested Symbol | Resulting Prefix | Reason |",
  ...(visibleDeadEnds.length === 0
    ? []
    : [
      "| --- | --- | --- | --- |",
      ...visibleDeadEnds.slice(0, 50).map((item) =>
        `| ${escapeCell(item.prefix)} | ${escapeCell(item.symbol)} | ${escapeCell(item.nextPrefix)} | ${escapeCell(item.reason)} |`
      )
    ]),
  "",
  "## Blocked High-Rank Entries",
  "",
  analysis.unreachableTopEntries.length === 0
    ? `No blocked phonetic paths found among the top ${analysis.topEntryLimit} source-ranked entries.`
    : "| Label | Key | Blocked Prefix | Blocked Symbol | Reason |",
  ...(analysis.unreachableTopEntries.length === 0
    ? []
    : [
      "| --- | --- | --- | --- | --- |",
      ...analysis.unreachableTopEntries.slice(0, 30).map((entry) =>
        `| ${escapeCell(entry.label)} | ${escapeCell(entry.key)} | ${escapeCell(entry.prefix ?? "")} | ${escapeCell(entry.blockedSymbol)} | ${escapeCell(entry.reason)} |`
      )
    ]),
  "",
  "## Design Meaning",
  "",
  "- All 37 Zhuyin symbols remain visible in stable phonetic order on the first layer.",
  "- Recommendation rows should contain output candidates and repairs, not duplicate first-layer Zhuyin symbols.",
  "- `更多` pages output candidates only; no phonetic symbol depends on paging for discovery.",
  "- Benchmark failures should change general weights, symbol coverage rules, or continuation ordering, not add phrase-specific shortcuts.",
  "- The zh-TW profile remains grounded in Traditional Chinese/Zhuyin data and AAC target-size constraints.",
  ""
];

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, lines.join("\n"), "utf8");
console.log(`Wrote ${reportPath}`);

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function round(value) {
  return Number(value).toFixed(2);
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
