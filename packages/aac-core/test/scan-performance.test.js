import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  advanceSession,
  boardRows,
  createBoardConfig,
  createSession,
  visibleBoard
} from "../src/index.js";

const CorpusSize = 1_000_000;
const ScanTransitionsAfterPreparation = 10_000;
const MaximumColdPrefixPreparationMs = Number(process.env.SHINE_AAC_LARGE_CORPUS_MAX_MS ?? 5_000);

test("million-entry English prefix preparation is bounded to one content change", () => {
  const corpus = virtualDictionary(CorpusSize, (index) => index === CorpusSize - 1
    ? candidate("ZZZZTARGET", "zzzztarget")
    : candidate(`WORD${index}`, `word${index}`));
  let session = createSession({
    message: "zzzz",
    config: createBoardConfig({ suggestionDictionary: corpus.dictionary })
  });

  const preparationStartedAt = performance.now();
  const preparedBoard = visibleBoard(session);
  const preparationElapsedMs = performance.now() - preparationStartedAt;
  const readsAfterPreparation = corpus.reads;

  assert.equal(readsAfterPreparation, CorpusSize, "cold prefix lookup should make one linear pass over the adversarial corpus");
  assert.ok(preparationElapsedMs <= MaximumColdPrefixPreparationMs,
    `million-entry cold prefix preparation took ${preparationElapsedMs.toFixed(1)} ms`);

  for (let index = 0; index < ScanTransitionsAfterPreparation; index += 1) {
    session = advanceSession(session);
  }
  assert.equal(corpus.reads, readsAfterPreparation, "scanning must not revisit the million-entry corpus");
  assert.equal(visibleBoard(session), preparedBoard, "scanning must retain the prepared board identity");

  console.log(JSON.stringify({
    corpusSize: CorpusSize,
    coldPrefixPreparationMs: Number(preparationElapsedMs.toFixed(3)),
    corpusReadsDuringPreparation: readsAfterPreparation,
    scanTransitionsAfterPreparation: ScanTransitionsAfterPreparation,
    corpusReadsDuringScanning: corpus.reads - readsAfterPreparation
  }));
});

test("million-entry empty English input reads only visible capacity", () => {
  const corpus = virtualDictionary(CorpusSize, (index) => candidate(`WORD${index}`, `word${index}`));
  const startedAt = performance.now();
  const rows = boardRows(createBoardConfig({ suggestionDictionary: corpus.dictionary }));
  const elapsedMs = performance.now() - startedAt;

  assert.equal(rows.slice(0, 2).flat().filter((item) => item.action !== "noop").length, 8);
  assert.ok(corpus.reads <= 8, `empty input read ${corpus.reads} entries from a million-entry corpus`);
  console.log(JSON.stringify({
    corpusSize: CorpusSize,
    emptyInputPreparationMs: Number(elapsedMs.toFixed(3)),
    corpusReads: corpus.reads
  }));
});

test("million-entry configured zh-TW suggestions stop at reachable capacity", () => {
  const corpus = virtualDictionary(CorpusSize, (index) => candidate(`建議${index}`, `建議${index}`));
  const startedAt = performance.now();
  boardRows(createBoardConfig({ profileId: "zh-TW", suggestionDictionary: corpus.dictionary }));
  const elapsedMs = performance.now() - startedAt;

  assert.ok(corpus.reads < 100, `empty zh-TW input read ${corpus.reads} configured suggestions`);
  console.log(JSON.stringify({
    corpusSize: CorpusSize,
    zhTwEmptyPreparationMs: Number(elapsedMs.toFixed(3)),
    corpusReads: corpus.reads
  }));
});

function candidate(label, output) {
  return { label, output, action: "append" };
}

function virtualDictionary(size, entryAt) {
  const target = [];
  target.length = size;
  let reads = 0;
  const dictionary = new Proxy(target, {
    has(_target, property) {
      if (isArrayIndex(property, size)) return true;
      return Reflect.has(target, property);
    },
    get(_target, property, receiver) {
      if (isArrayIndex(property, size)) {
        reads += 1;
        return entryAt(Number(property));
      }
      return Reflect.get(target, property, receiver);
    }
  });
  return {
    dictionary,
    get reads() {
      return reads;
    }
  };
}

function isArrayIndex(property, size) {
  if (typeof property !== "string" || !/^\d+$/u.test(property)) return false;
  const index = Number(property);
  return Number.isSafeInteger(index) && index >= 0 && index < size;
}
