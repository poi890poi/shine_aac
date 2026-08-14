import {
  TileAction,
  ZhTwFrequencyDictionary,
  boardRows,
  createBoardConfig
} from "../packages/aac-core/src/index.js";
import { loadNccuConversationCorpus } from "./lib/nccu-conversation-corpus.mjs";

const MaxPromotions = 2;
const FirstPageCandidateLimit = 14;
const ReachableCandidateLimit = 42;
const MinTokenCount = 20;
const MinConversationCount = 5;
const MinUtilityRatio = 4;
const corpusDirectory = argumentValue("--corpus-dir") ?? process.env.SHINE_NCCU_CORPUS_DIR;
const corpus = await loadNccuConversationCorpus(corpusDirectory);
const conversations = balancedConversationFolds(corpus.conversations);
const canonicalGlyphEntries = canonicalGlyphEntryMap();
const sourceCandidates = sourceFirstSymbolCandidateMap();
const evidenceTargets = sourceReachableFirstSymbolTargets();
const evidenceLabels = new Set(evidenceTargets.keys());
const evidenceLengths = [...new Set([...evidenceLabels].map((label) => label.length))];
const heldOutCandidates = Array.from({ length: 5 }, (_unused, fold) =>
  rerankedCandidateMap(spokenEvidenceExcludingFold(fold))
);
const visibleCommitCache = new Map();

const source = evaluate(false);
const candidate = evaluate(true);
const report = {
  corpus: {
    version: corpus.version,
    normalizedSha256: corpus.normalizedSha256,
    conversations: corpus.conversations.length,
    turns: corpus.turnCount,
    hanCharacters: corpus.hanCharacterCount
  },
  policy: {
    firstPageOnly: true,
    moreSelections: 0,
    targetAwareHiddenKeys: false,
    pronunciationPolicy: "highest-source-frequency-single-glyph-reading",
    maxFirstSymbolPromotions: MaxPromotions,
    minTokenCount: MinTokenCount,
    minConversationCount: MinConversationCount,
    minUtilityRatio: MinUtilityRatio,
    lastChanceGlyphsProtected: true,
    maxCoverageRegressionPercentagePoints: 0.25,
    maxCompleteTurnRegressionPercentagePoints: 1.5
  },
  source,
  heldOutConservativeRerank: candidate,
  delta: {
    coveragePercentagePoints: (candidate.coverage - source.coverage) * 100,
    completeTurnPercentagePoints: (candidate.completeTurnRate - source.completeTurnRate) * 100,
    selectionsPerCoveredCharacterPercent:
      ((candidate.selectionsPerCoveredCharacter - source.selectionsPerCoveredCharacter) /
        source.selectionsPerCoveredCharacter) * 100
  }
};

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--check")) {
  const failures = [];
  if (candidate.coverage < source.coverage - 0.0025) failures.push("character coverage exceeded regression budget");
  if (candidate.completeTurnRate < source.completeTurnRate - 0.015) {
    failures.push("complete-turn reachability exceeded regression budget");
  }
  if (candidate.selectionsPerCoveredCharacter > source.selectionsPerCoveredCharacter * 0.95) {
    failures.push("selection efficiency did not improve by at least 5%");
  }
  if (candidate.folds.some((fold, index) =>
    fold.coverage < source.folds[index].coverage - 0.0035 ||
    fold.selectionsPerCoveredCharacter > source.folds[index].selectionsPerCoveredCharacter * 0.95
  )) {
    failures.push("at least one held-out fold exceeded its stability or efficiency budget");
  }
  if (failures.length > 0) {
    console.error(`Benchmark gate failed: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
}

function evaluate(useReranking) {
  const totals = blankMetrics();
  const folds = Array.from({ length: 5 }, (_unused, fold) => ({ fold, ...blankMetrics() }));
  for (const conversation of conversations) {
    const foldMetrics = folds[conversation.fold];
    for (const turn of conversation.turns) {
      const metrics = composeObservablePrefixText(turn.text, conversation.fold, useReranking);
      addMetrics(totals, metrics);
      addMetrics(foldMetrics, metrics);
    }
  }
  return summarize(totals, folds.map((fold) => summarize(fold)));
}

function composeObservablePrefixText(text, fold, useReranking) {
  const metrics = blankMetrics();
  for (let offset = 0; offset < text.length;) {
    const entry = canonicalGlyphEntries.get(text[offset]);
    if (!entry) {
      metrics.failedCharacters += 1;
      offset += 1;
      continue;
    }

    let buffer = "";
    let prefixSelections = 0;
    let match = null;
    for (const symbol of entry.key) {
      buffer += symbol;
      prefixSelections += 1;
      const candidates = buffer.length === 1
        ? (useReranking ? heldOutCandidates[fold] : sourceCandidates).get(buffer).slice(0, FirstPageCandidateLimit)
        : visibleCommitCandidates(buffer);
      match = candidates
        .filter((candidate) => text.startsWith(candidate.output, offset))
        .sort((left, right) => right.output.length - left.output.length)[0] ?? null;
      if (match) break;
    }

    if (!match && entry.key.length > 1) {
      match = visibleCommitCandidates(entry.key).find((candidate) => candidate.output === text[offset]) ?? null;
    }
    if (!match) {
      metrics.failedCharacters += 1;
      offset += 1;
      continue;
    }

    metrics.selections += prefixSelections + 1;
    metrics.coveredCharacters += match.output.length;
    offset += match.output.length;
  }
  metrics.characters = text.length;
  metrics.turns = 1;
  metrics.completeTurns = metrics.failedCharacters === 0 ? 1 : 0;
  return metrics;
}

function visibleCommitCandidates(buffer) {
  if (!visibleCommitCache.has(buffer)) {
    const config = createBoardConfig({ profileId: "zh-TW" });
    visibleCommitCache.set(
      buffer,
      boardRows(config, buffer, true, {}).slice(0, 4).flat()
        .filter((candidate) => candidate.action === TileAction.CommitCandidate)
    );
  }
  return visibleCommitCache.get(buffer);
}

function sourceFirstSymbolCandidateMap() {
  const symbols = new Set([...canonicalGlyphEntries.values()].map((entry) => entry.key.at(0)));
  return new Map([...symbols].map((symbol) => [symbol, sourceFirstSymbolCandidates(symbol)]));
}

function sourceFirstSymbolCandidates(symbol) {
  const seen = new Set();
  const ranked = [];
  for (const entry of ZhTwFrequencyDictionary) {
    const matchingKey = (entry.keys ?? [entry.key])
      .filter((key) => key.startsWith(symbol))
      .sort((left, right) => left.length - right.length)[0];
    const identity = `${entry.label}\u0000${entry.output}`;
    if (!matchingKey || seen.has(identity) || ["是不是", "要不要"].includes(entry.label)) continue;
    seen.add(identity);
    ranked.push({ ...entry, zhuyinKey: matchingKey });
  }
  ranked.sort((left, right) => left.frequencyRank - right.frequencyRank);
  const immediate = ranked.slice(0, 8);
  const remaining = ranked.slice(8);
  return [
    ...immediate,
    ...remaining.filter((candidate) => candidate.zhuyinKey.length === 1),
    ...remaining.filter((candidate) => candidate.zhuyinKey.length !== 1)
  ];
}

function spokenEvidenceExcludingFold(testFold) {
  const tokenCounts = new Map();
  const conversationCounts = new Map();
  for (const conversation of conversations) {
    if (conversation.fold === testFold) continue;
    const seen = new Set();
    for (const { text } of conversation.turns) {
      for (let offset = 0; offset < text.length; offset += 1) {
        for (const length of evidenceLengths) {
          if (offset + length > text.length) continue;
          const label = text.slice(offset, offset + length);
          if (!evidenceLabels.has(label)) continue;
          tokenCounts.set(label, (tokenCounts.get(label) ?? 0) + 1);
          seen.add(label);
        }
      }
    }
    for (const label of seen) conversationCounts.set(label, (conversationCounts.get(label) ?? 0) + 1);
  }
  return new Map([...tokenCounts].map(([label, tokenCount]) => [`${label}\u0000${evidenceTargets.get(label)}`, {
    tokenCount,
    conversationCount: conversationCounts.get(label) ?? 0,
    utility: tokenCount * selectionSavings(label)
  }]));
}

function rerankedCandidateMap(evidence) {
  return new Map([...sourceCandidates].map(([symbol, candidates]) => [
    symbol,
    conservativeFirstSymbolPromotion(candidates, evidence, symbol)
  ]));
}

function conservativeFirstSymbolPromotion(candidates, evidence, symbol) {
  const result = candidates.slice();
  const protectedWindow = result.slice(0, FirstPageCandidateLimit);
  const promotions = result.slice(FirstPageCandidateLimit, ReachableCandidateLimit)
    .filter((candidate) => {
      const entry = evidenceForCandidate(evidence, candidate);
      return entry?.tokenCount >= MinTokenCount && entry?.conversationCount >= MinConversationCount;
    })
    .sort((left, right) =>
      evidenceForCandidate(evidence, right).utility - evidenceForCandidate(evidence, left).utility ||
      evidenceForCandidate(evidence, right).conversationCount - evidenceForCandidate(evidence, left).conversationCount ||
      left.frequencyRank - right.frequencyRank
    );
  let promoted = 0;

  for (const promotion of promotions) {
    if (promoted >= MaxPromotions) break;
    const promotionUtility = evidenceForCandidate(evidence, promotion).utility;
    const victim = protectedWindow
      .map((candidate, index) => ({
        candidate,
        index,
        utility: evidenceForCandidate(evidence, candidate)?.utility ?? 0
      }))
      .filter(({ candidate }) => !(Array.from(candidate.output).length === 1 && candidate.zhuyinKey === symbol))
      .filter(({ utility }) => promotionUtility >= Math.max(1, utility) * MinUtilityRatio)
      .sort((left, right) => left.utility - right.utility || right.index - left.index)[0];
    if (!victim) continue;
    const promotionIndex = result.indexOf(promotion);
    const victimIndex = result.indexOf(victim.candidate);
    result[victimIndex] = promotion;
    result[promotionIndex] = victim.candidate;
    protectedWindow[victim.index] = promotion;
    promoted += 1;
  }
  return result;
}

function evidenceForCandidate(evidence, candidate) {
  return evidence.get(`${candidate.label}\u0000${candidate.zhuyinKey.at(0)}`);
}

function sourceReachableFirstSymbolTargets() {
  const targets = new Map();
  for (const entry of ZhTwFrequencyDictionary) {
    if (targets.has(entry.label)) continue;
    const firstSymbol = entry.key.at(0);
    if (sourceCandidates.get(firstSymbol)?.slice(0, ReachableCandidateLimit)
      .some((candidate) => candidate.label === entry.label)) {
      targets.set(entry.label, firstSymbol);
    }
  }
  return targets;
}

function canonicalGlyphEntryMap() {
  const map = new Map();
  for (const entry of ZhTwFrequencyDictionary) {
    if (entry.label.length !== 1) continue;
    const existing = map.get(entry.label);
    if (!existing || entry.frequencyRank < existing.frequencyRank) map.set(entry.label, entry);
  }
  return map;
}

function selectionSavings(label) {
  const baseline = Array.from(label).reduce((sum, character) => {
    const entry = canonicalGlyphEntries.get(character);
    return sum + (entry ? entry.key.length + 1 : 5);
  }, 0);
  return Math.max(1, baseline - 2);
}

function balancedConversationFolds(input) {
  const folds = Array.from({ length: 5 }, () => ({ characters: 0, conversations: [] }));
  const sorted = input
    .map((conversation) => ({
      ...conversation,
      characters: conversation.turns.reduce((sum, turn) => sum + turn.text.length, 0)
    }))
    .sort((left, right) => right.characters - left.characters || left.id.localeCompare(right.id));
  for (const conversation of sorted) {
    const fold = folds
      .filter((candidate) => candidate.conversations.length < 10)
      .sort((left, right) => left.characters - right.characters)[0];
    fold.conversations.push(conversation);
    fold.characters += conversation.characters;
  }
  return folds.flatMap((fold, foldIndex) =>
    fold.conversations.map((conversation) => ({ ...conversation, fold: foldIndex }))
  );
}

function blankMetrics() {
  return { characters: 0, coveredCharacters: 0, failedCharacters: 0, selections: 0, turns: 0, completeTurns: 0 };
}

function addMetrics(target, source) {
  for (const key of Object.keys(blankMetrics())) target[key] += source[key];
}

function summarize(metrics, folds) {
  return {
    ...metrics,
    coverage: metrics.coveredCharacters / metrics.characters,
    completeTurnRate: metrics.completeTurns / metrics.turns,
    selectionsPerCoveredCharacter: metrics.selections / metrics.coveredCharacters,
    ...(folds ? { folds } : {})
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
