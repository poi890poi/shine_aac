import {
  DefaultColumns,
  ZhTwFrequencyDictionary,
  ZhuyinInputSymbols,
  ZhuyinStaticInputSymbols,
  zhTwVisibleNextSymbolsForPrefix
} from "../../packages/aac-core/src/index.js";

const ZhTwSuggestionRowCount = 4;
const MaxZhTwSuggestionPages = 3;
const ZhuyinInitialSymbolSet = new Set(ZhuyinInputSymbols.slice(0, 21));

export function analyzeZhTwDictionaryInventory(options = {}) {
  const dictionary = options.dictionary ?? ZhTwFrequencyDictionary;
  const columns = options.columns ?? DefaultColumns;
  const staticSymbols = options.staticSymbols ?? ZhuyinStaticInputSymbols;
  const pageCandidateCapacity = Math.max(1, columns * ZhTwSuggestionRowCount - 1);
  const maxDirectCandidateRank = pageCandidateCapacity * MaxZhTwSuggestionPages;
  const staticSet = new Set(staticSymbols);
  const labels = [...new Set(dictionary.map((entry) => entry.label))];
  const labelRank = buildBestRankByLabel(dictionary);
  const sourceGlyphLabels = labels.filter((label) => textLength(label) === 1);
  const sourceWordLabels = labels.filter((label) => textLength(label) > 1);
  const sourceGlyphSet = new Set(sourceGlyphLabels);
  const charactersInLabels = new Set(labels.flatMap((label) => Array.from(label).filter(isHanCharacter)));
  const visibleContinuationCache = new Map();
  const pathReachableEntries = dictionary.filter((entry) => entryKeys(entry)
    .some((key) => isKeyPathReachable(key, staticSet, columns, visibleContinuationCache)));
  const weightedTotal = dictionary.reduce((sum, entry) => sum + dictionaryWeight(entry), 0);
  const weightedReachable = pathReachableEntries.reduce((sum, entry) => sum + dictionaryWeight(entry), 0);
  const prefixGroups = buildPrefixGroups(dictionary);
  const candidateLabelCache = new Map();
  const directEstimateByLabel = new Map();
  const directEstimateByEntryKey = new Map();

  for (const entry of dictionary) {
    for (const key of entryKeys(entry)) {
      if (!isKeyPathReachable(key, staticSet, columns, visibleContinuationCache)) continue;
      const visibleItemsForBuffer = visibleSuggestionItemsForBuffer(key, prefixGroups, candidateLabelCache, columns);
      const candidateRank = visibleItemsForBuffer.findIndex((item) =>
        item.type === "candidate" && item.label === entry.label
      );
      if (candidateRank < 0 || candidateRank >= maxDirectCandidateRank) continue;
      const pageIndex = Math.floor(candidateRank / pageCandidateCapacity);
      const estimate = Object.freeze({
        label: entry.label,
        key,
        candidateRank: candidateRank + 1,
        pageIndex,
        selections: textLength(key) + 1 + pageIndex,
        activations: (textLength(key) + 1 + pageIndex) * 2
      });
      directEstimateByEntryKey.set(`${entry.label}\u0000${key}`, estimate);
      setBetterEstimate(directEstimateByLabel, entry.label, estimate);
    }
  }

  const glyphDirectEstimates = sourceGlyphLabels
    .map((label) => directEstimateByLabel.get(label))
    .filter(Boolean);
  const wordDirectEstimates = sourceWordLabels
    .map((label) => directEstimateByLabel.get(label))
    .filter(Boolean);
  const wordCompositionEstimates = sourceWordLabels
    .map((label) => composeFromGlyphEstimates(label, directEstimateByLabel))
    .filter(Boolean);
  const bestEstimateByLabel = new Map(directEstimateByLabel);
  for (const estimate of wordCompositionEstimates) {
    setBetterEstimate(bestEstimateByLabel, estimate.label, estimate);
  }

  const bestGlyphEstimates = sourceGlyphLabels
    .map((label) => bestEstimateByLabel.get(label))
    .filter(Boolean);
  const bestWordEstimates = sourceWordLabels
    .map((label) => bestEstimateByLabel.get(label))
    .filter(Boolean);
  const bestAllEstimates = labels
    .map((label) => bestEstimateByLabel.get(label))
    .filter(Boolean);
  const wordCompositionOnlyCount = sourceWordLabels
    .filter((label) => !directEstimateByLabel.has(label) && Boolean(composeFromGlyphEstimates(label, directEstimateByLabel)))
    .length;

  return Object.freeze({
    columns,
    suggestionRows: ZhTwSuggestionRowCount,
    maxSuggestionPages: MaxZhTwSuggestionPages,
    pageCandidateCapacity,
    maxDirectCandidateRank,
    sourceEntryCount: dictionary.length,
    uniqueLabelCount: labels.length,
    zhuyinSymbolCount: ZhuyinInputSymbols.length,
    staticZhuyinSymbolCount: staticSymbols.length,
    dynamicZhuyinSymbolCount: ZhuyinInputSymbols.length - staticSymbols.length,
    sourceGlyphCount: sourceGlyphLabels.length,
    sourceWordCount: sourceWordLabels.length,
    uniqueHanCharacterCount: charactersInLabels.size,
    sourceGlyphsReachableDirect: glyphDirectEstimates.length,
    sourceWordsReachableDirect: wordDirectEstimates.length,
    sourceWordsComposableFromGlyphs: wordCompositionEstimates.length,
    sourceWordsReachableDirectOrComposable: bestWordEstimates.length,
    sourceLabelsReachableDirectOrComposable: bestAllEstimates.length,
    sourceWordsCompositionOnly: wordCompositionOnlyCount,
    pathReachableEntryCount: pathReachableEntries.length,
    pathReachableEntryRatio: ratio(pathReachableEntries.length, dictionary.length),
    weightedPathReachabilityRatio: ratio(weightedReachable, weightedTotal),
    sourceGlyphDirectRatio: ratio(glyphDirectEstimates.length, sourceGlyphLabels.length),
    sourceWordDirectRatio: ratio(wordDirectEstimates.length, sourceWordLabels.length),
    sourceWordComposableRatio: ratio(wordCompositionEstimates.length, sourceWordLabels.length),
    sourceWordDirectOrComposableRatio: ratio(bestWordEstimates.length, sourceWordLabels.length),
    sourceLabelDirectOrComposableRatio: ratio(bestAllEstimates.length, labels.length),
    glyphEfficiency: efficiencyStats(glyphDirectEstimates),
    directWordEfficiency: efficiencyStats(wordDirectEstimates),
    bestWordEfficiency: efficiencyStats(bestWordEstimates),
    allLabelEfficiency: efficiencyStats(bestAllEstimates),
    directEstimateByLabel,
    topEntityBuckets: Object.freeze([
      topEntityBucket("Top 100 glyphs", topRankedLabels(sourceGlyphLabels, labelRank, 100), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 500 glyphs", topRankedLabels(sourceGlyphLabels, labelRank, 500), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 1000 glyphs", topRankedLabels(sourceGlyphLabels, labelRank, 1000), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 100 words/phrases", topRankedLabels(sourceWordLabels, labelRank, 100), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 500 words/phrases", topRankedLabels(sourceWordLabels, labelRank, 500), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 1000 words/phrases", topRankedLabels(sourceWordLabels, labelRank, 1000), directEstimateByLabel, bestEstimateByLabel),
      topEntityBucket("Top 5000 words/phrases", topRankedLabels(sourceWordLabels, labelRank, 5000), directEstimateByLabel, bestEstimateByLabel)
    ]),
    sampleUnreachableGlyphs: sourceGlyphLabels.filter((label) => !directEstimateByLabel.has(label)).slice(0, 40),
    sampleDirectWordGaps: sourceWordLabels.filter((label) => !directEstimateByLabel.has(label)).slice(0, 40),
    sampleNotComposableWords: sourceWordLabels
      .filter((label) => !composeFromGlyphEstimates(label, directEstimateByLabel))
      .slice(0, 40),
    sourceGlyphSet
  });
}

function buildBestRankByLabel(dictionary) {
  const ranks = new Map();
  for (const entry of dictionary) {
    const rank = entry.frequencyRank ?? entry.sourceRank ?? Number.MAX_SAFE_INTEGER;
    ranks.set(entry.label, Math.min(ranks.get(entry.label) ?? Number.MAX_SAFE_INTEGER, rank));
  }
  return ranks;
}

function topRankedLabels(labels, labelRank, limit) {
  return labels
    .slice()
    .sort((left, right) =>
      (labelRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (labelRank.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right, "zh-Hant")
    )
    .slice(0, limit);
}

function topEntityBucket(label, labels, directEstimateByLabel, bestEstimateByLabel) {
  const directEstimates = labels
    .map((entryLabel) => directEstimateByLabel.get(entryLabel))
    .filter(Boolean);
  const bestEstimates = labels
    .map((entryLabel) => bestEstimateByLabel.get(entryLabel))
    .filter(Boolean);
  return Object.freeze({
    label,
    count: labels.length,
    directReachable: directEstimates.length,
    directOrComposableReachable: bestEstimates.length,
    directReachabilityRatio: ratio(directEstimates.length, labels.length),
    directOrComposableReachabilityRatio: ratio(bestEstimates.length, labels.length),
    directEfficiency: efficiencyStats(directEstimates),
    bestEfficiency: efficiencyStats(bestEstimates)
  });
}

function buildPrefixGroups(dictionary) {
  const groups = new Map();
  for (const entry of dictionary) {
    for (const key of entryKeys(entry)) {
      for (let length = 1; length <= textLength(key); length += 1) {
        const prefix = Array.from(key).slice(0, length).join("");
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix).push(entry);
      }
    }
  }
  return groups;
}

function visibleSuggestionItemsForBuffer(buffer, prefixGroups, candidateLabelCache, columns) {
  if (candidateLabelCache.has(buffer)) return candidateLabelCache.get(buffer);
  const ranked = (prefixGroups.get(buffer) ?? [])
    .map((entry) => ({
      entry,
      matchingKey: entryKeys(entry)
        .filter((key) => key.startsWith(buffer))
        .sort((left, right) => textLength(left) - textLength(right))[0]
    }))
    .filter((candidate) => candidate.matchingKey)
    .sort((left, right) => compareCandidateForBuffer(left, right, buffer))
    .filter((candidate, index, candidates) =>
      candidates.findIndex((other) => other.entry.label === candidate.entry.label) === index
    );
  const nextSymbols = zhTwVisibleNextSymbolsForPrefix(buffer, columns);
  const immediateCandidateCount = immediateCandidateCountForBuffer(buffer, columns, nextSymbols.length);
  const firstPageNextSymbolCount = firstPageNextSymbolCountForBuffer(buffer, columns, nextSymbols.length, immediateCandidateCount);
  const firstPageNextSymbols = nextSymbols.slice(0, firstPageNextSymbolCount);
  const overflowNextSymbols = nextSymbols.slice(firstPageNextSymbolCount);
  const overflowPhoneticNextSymbols = overflowNextSymbols.filter((symbol) => !ZhuyinInitialSymbolSet.has(symbol));
  const overflowInitialNextSymbols = overflowNextSymbols.filter((symbol) => ZhuyinInitialSymbolSet.has(symbol));
  const remainingCandidates = ranked.slice(immediateCandidateCount);
  const laterCandidates = textLength(buffer) <= 1
    ? [
      ...remainingCandidates.filter((candidate) => textLength(candidate.matchingKey) === textLength(buffer)),
      ...remainingCandidates.filter((candidate) => textLength(candidate.matchingKey) !== textLength(buffer))
    ]
    : remainingCandidates;
  const visibleItems = [
    ...ranked.slice(0, immediateCandidateCount).map((candidate) => candidateItem(candidate.entry.label)),
    ...firstPageNextSymbols.map(symbolItem),
    ...overflowPhoneticNextSymbols.map(symbolItem),
    ...laterCandidates.map((candidate) => candidateItem(candidate.entry.label)),
    ...overflowInitialNextSymbols.map(symbolItem)
  ];
  candidateLabelCache.set(buffer, visibleItems);
  return visibleItems;
}

function compareCandidateForBuffer(left, right, buffer) {
  if (textLength(buffer) > 1) {
    const leftExact = textLength(left.matchingKey) === textLength(buffer);
    const rightExact = textLength(right.matchingKey) === textLength(buffer);
    if (leftExact !== rightExact) return leftExact ? -1 : 1;
  }
  return (left.entry.frequencyRank ?? left.entry.sourceRank ?? Number.MAX_SAFE_INTEGER) -
    (right.entry.frequencyRank ?? right.entry.sourceRank ?? Number.MAX_SAFE_INTEGER);
}

function immediateCandidateCountForBuffer(buffer, columns, nextSymbolCount) {
  const preferredCount = columns * 2;
  if (!needsPhoneticContinuationSpace(buffer)) return preferredCount;
  const firstPageUsableCount = columns * ZhTwSuggestionRowCount - 1;
  const minimumCandidateCount = columns;
  const firstPageNextSymbolBudget = Math.max(0, firstPageUsableCount - preferredCount);
  return clampInt(
    firstPageUsableCount - Math.min(nextSymbolCount, firstPageNextSymbolBudget),
    minimumCandidateCount,
    preferredCount
  );
}

function firstPageNextSymbolCountForBuffer(buffer, columns, nextSymbolCount, candidateCount) {
  if (!needsPhoneticContinuationSpace(buffer)) return 0;
  const firstPageUsableCount = columns * ZhTwSuggestionRowCount - 1;
  return clampInt(firstPageUsableCount - candidateCount, 0, nextSymbolCount);
}

function needsPhoneticContinuationSpace(buffer) {
  return textLength(buffer) <= 1 || ["ㄧ", "ㄨ", "ㄩ"].includes(Array.from(buffer).at(-1));
}

function candidateItem(label) {
  return Object.freeze({ type: "candidate", label });
}

function symbolItem(label) {
  return Object.freeze({ type: "symbol", label });
}

function clampInt(value, min, max) {
  const integer = Math.trunc(value);
  return Math.min(max, Math.max(min, integer));
}

function isKeyPathReachable(key, staticSet, columns, visibleContinuationCache) {
  const symbols = Array.from(key);
  if (symbols.length === 0 || !staticSet.has(symbols[0])) return false;
  for (let index = 1; index < symbols.length; index += 1) {
    const symbol = symbols[index];
    if (staticSet.has(symbol)) continue;
    const prefix = symbols.slice(0, index).join("");
    const cacheKey = `${prefix}\u0000${columns}`;
    if (!visibleContinuationCache.has(cacheKey)) {
      visibleContinuationCache.set(cacheKey, new Set(zhTwVisibleNextSymbolsForPrefix(prefix, columns)));
    }
    if (!visibleContinuationCache.get(cacheKey).has(symbol)) return false;
  }
  return true;
}

function composeFromGlyphEstimates(label, directEstimateByLabel) {
  const parts = Array.from(label);
  if (parts.length <= 1) return null;
  const estimates = parts.map((character) => directEstimateByLabel.get(character));
  if (estimates.some((estimate) => !estimate)) return null;
  return Object.freeze({
    label,
    key: estimates.map((estimate) => estimate.key).join(" "),
    candidateRank: null,
    pageIndex: null,
    selections: sum(estimates.map((estimate) => estimate.selections)),
    activations: sum(estimates.map((estimate) => estimate.activations)),
    composition: "glyphs"
  });
}

function setBetterEstimate(map, label, estimate) {
  const existing = map.get(label);
  if (!existing || estimate.activations < existing.activations) {
    map.set(label, estimate);
  }
}

function efficiencyStats(estimates) {
  const activations = estimates.map((estimate) => estimate.activations);
  const selections = estimates.map((estimate) => estimate.selections);
  return Object.freeze({
    count: estimates.length,
    medianActivations: percentile(activations, 0.5),
    p90Activations: percentile(activations, 0.9),
    averageActivations: average(activations),
    medianSelections: percentile(selections, 0.5),
    p90Selections: percentile(selections, 0.9),
    averageSelections: average(selections)
  });
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index];
}

function average(values) {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator, denominator) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function entryKeys(entry) {
  return entry.keys ?? [entry.key];
}

function textLength(value) {
  return Array.from(String(value)).length;
}

function dictionaryWeight(entry) {
  const frequency = Number(entry.frequency ?? 0);
  if (Number.isFinite(frequency) && frequency > 0) return frequency;
  const rank = Math.max(1, Number(entry.frequencyRank ?? entry.sourceRank ?? 1));
  return 1 / rank;
}

function isHanCharacter(value) {
  return /^\p{Script=Han}$/u.test(value);
}
