import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  EnUsFrequencyEntries,
  EnUsFrequencySource
} from "../packages/aac-core/src/data/en-us-frequency.generated.js";

const outputPath = resolve("docs/EN_US_DICTIONARY_REPORT.md");
const previousEntryCount = 280;
const words = EnUsFrequencyEntries.map(([word, frequency]) => ({
  word,
  normalized: word.toLowerCase(),
  frequency
}));
const normalizedWords = new Set(words.map(({ normalized }) => normalized));
const duplicates = words.length - normalizedWords.size;
const invalid = words.filter(({ word }) => !/^(?:[a-z]+(?:'[a-z]+)*|I|OK|TV)$/u.test(word));
const prefixes = buildPrefixIndex(words);
const prefixRows = [1, 2, 3, 4, 5].map((length) => prefixStats(prefixes, length));
const reachability = completionReachability(words, prefixes);

const report = `# en-US Dictionary Report

Generated: ${new Date().toISOString()}

## Scope

This report audits the active English dictionary foundation and its source-frequency order. Candidate-strip commands, layout, typo correction, autocorrection, and personal learning are outside this report.

## Replacement

| Metric | Previous built-in dictionary | Replacement |
|---|---:|---:|
| Unique entries | ${previousEntryCount.toLocaleString()} | ${words.length.toLocaleString()} |
| Increase | — | ${formatPercent((words.length - previousEntryCount) / previousEntryCount)} |
| Duplicate normalized entries | — | ${duplicates.toLocaleString()} |
| Invalid retained forms | — | ${invalid.length.toLocaleString()} |

The replacement is a neutral frequency-ranked slice of the official Android Open Source Project LatinIME en-US dictionary. No word is promoted because it is AAC, medical, part of a demo, or mentioned in a complaint.

## Source policy

| Property | Value |
|---|---:|
| Source | ${EnUsFrequencySource.name} |
| Source model version | ${EnUsFrequencySource.version} |
| Pinned source revision | \`${EnUsFrequencySource.sourceRevision}\` |
| Decompressed source SHA-256 | \`${EnUsFrequencySource.sourceSha256}\` |
| Raw source entries | ${EnUsFrequencySource.sourceEntryCount.toLocaleString()} |
| Entries matching the supported word form | ${EnUsFrequencySource.supportedEntryCount.toLocaleString()} |
| Supported entries suppressed at frequency 0 | ${EnUsFrequencySource.frequencyZeroEntryCount.toLocaleString()} |
| Minimum retained frequency | ${EnUsFrequencySource.minimumFrequency} |
| Retained entries | ${EnUsFrequencySource.retainedEntryCount.toLocaleString()} |

Supported forms are ordinary lowercase alphabetic words with optional internal apostrophes, plus the source forms \`I\`, \`OK\`, and \`TV\`. Proper names, arbitrary abbreviations, punctuation-only tokens, and every source entry with frequency 0 are excluded by rule.

Source: [AOSP LatinIME en_US_wordlist.combined.gz](${EnUsFrequencySource.sourceUrl.replace("?format=TEXT", "")}). AOSP documents dictionary frequency as a logarithmic 0–255 value in its [combined dictionary format](${EnUsFrequencySource.sourceUrl.replace("en_US_wordlist.combined.gz?format=TEXT", "sample.combined")}).

## Frequency distribution

| Frequency band | Entries |
|---|---:|
${frequencyBands(words).map(({ label, count }) => `| ${label} | ${count.toLocaleString()} |`).join("\n")}

## Word-length distribution

| Length | Entries |
|---|---:|
${lengthBands(words).map(({ label, count }) => `| ${label} | ${count.toLocaleString()} |`).join("\n")}

Contractions retained: ${words.filter(({ word }) => word.includes("'")).length.toLocaleString()}.

## Prefix capacity

This is a property of the repaired dictionary in source-frequency order. It does not include current UI command keys or static-board exclusions.

| Typed characters | Distinct valid prefixes | Mean matching words | Prefixes with ≥4 matches | Mean unused slots in a 4-candidate strip |
|---:|---:|---:|---:|---:|
${prefixRows.map((row) => `| ${row.length} | ${row.prefixCount.toLocaleString()} | ${row.meanMatches.toFixed(2)} | ${formatPercent(row.fullRate)} | ${row.meanUnused.toFixed(2)} |`).join("\n")}

## Frequency top-four reachability

For each retained word, this asks when that word first enters the four highest-frequency matches for its typed prefix. It intentionally does not apply any app-specific priority rule.

| Visible by | Words | Coverage |
|---|---:|---:|
${[1, 2, 3, 4, 5].map((length) => {
  const count = reachability.filter((entry) => entry.firstVisibleLength !== null && entry.firstVisibleLength <= length).length;
  return `| ${length} character${length === 1 ? "" : "s"} | ${count.toLocaleString()} | ${formatPercent(count / words.length)} |`;
}).join("\n")}
| Full spelling or earlier | ${(words.length - reachability.filter((entry) => entry.firstVisibleLength === null).length).toLocaleString()} | ${formatPercent((words.length - reachability.filter((entry) => entry.firstVisibleLength === null).length) / words.length)} |

Words that never enter the frequency top four for any exact prefix: ${reachability.filter((entry) => entry.firstVisibleLength === null).length.toLocaleString()}.

${reachability.some((entry) => entry.firstVisibleLength === null)
    ? `First examples: ${reachability.filter((entry) => entry.firstVisibleLength === null).slice(0, 40).map((entry) => `\`${entry.word}\``).join(", ")}.`
    : "No unreachable words were found under this dictionary-only test."}

## Active ranking contract

The app preserves this source order for prefix completion and at word boundaries. It applies no handcrafted AAC tiers or word-to-word transition lists. Custom dictionaries preserve the order entered by the user.
`;

await writeFile(outputPath, report, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify({
  previousEntries: previousEntryCount,
  replacementEntries: words.length,
  duplicates,
  invalid: invalid.length,
  unreachable: reachability.filter((entry) => entry.firstVisibleLength === null).length,
  prefixRows
}, null, 2));

function buildPrefixIndex(entries) {
  const index = new Map();
  for (const entry of entries) {
    for (let length = 1; length <= entry.normalized.length; length += 1) {
      const prefix = entry.normalized.slice(0, length);
      const matches = index.get(prefix);
      if (matches) matches.push(entry);
      else index.set(prefix, [entry]);
    }
  }
  return index;
}

function prefixStats(index, length) {
  const rows = [...index.entries()].filter(([prefix]) => prefix.length === length);
  const totalMatches = rows.reduce((sum, [, matches]) => sum + matches.length, 0);
  const full = rows.filter(([, matches]) => matches.length >= 4).length;
  const unused = rows.reduce((sum, [, matches]) => sum + Math.max(0, 4 - matches.length), 0);
  return {
    length,
    prefixCount: rows.length,
    meanMatches: rows.length > 0 ? totalMatches / rows.length : 0,
    fullRate: rows.length > 0 ? full / rows.length : 0,
    meanUnused: rows.length > 0 ? unused / rows.length : 0
  };
}

function completionReachability(entries, index) {
  return entries.map((entry) => {
    for (let length = 1; length <= entry.normalized.length; length += 1) {
      const matches = index.get(entry.normalized.slice(0, length)) ?? [];
      if (matches.slice(0, 4).some((candidate) => candidate.normalized === entry.normalized)) {
        return { word: entry.word, firstVisibleLength: length };
      }
    }
    return { word: entry.word, firstVisibleLength: null };
  });
}

function frequencyBands(entries) {
  const bands = [
    ["180–255", 180, 255],
    ["160–179", 160, 179],
    ["140–159", 140, 159],
    ["120–139", 120, 139],
    ["100–119", 100, 119],
    ["80–99", 80, 99],
    ["70–79", 70, 79]
  ];
  return bands.map(([label, minimum, maximum]) => ({
    label,
    count: entries.filter(({ frequency }) => frequency >= minimum && frequency <= maximum).length
  }));
}

function lengthBands(entries) {
  const bands = [
    ["1", 1, 1],
    ["2", 2, 2],
    ["3–5", 3, 5],
    ["6–8", 6, 8],
    ["9–12", 9, 12],
    ["13+", 13, Number.POSITIVE_INFINITY]
  ];
  return bands.map(([label, minimum, maximum]) => ({
    label,
    count: entries.filter(({ normalized }) => normalized.length >= minimum && normalized.length <= maximum).length
  }));
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
