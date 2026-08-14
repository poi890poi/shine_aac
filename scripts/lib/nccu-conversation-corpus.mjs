import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const NccuConversationCorpusVersion = "NCCU-TM001-TM050-2026-03";
export const NccuNormalizedCorpusSha256 = "a15e8dc5ad537ec827c52fbe7b78d4b9aab3de7da10729007cf434732e45ead2";

export async function loadNccuConversationCorpus(directory) {
  if (!directory) {
    throw new Error("Pass --corpus-dir with the directory containing the 50 archived NCCU transcript pages.");
  }

  const files = (await readdir(directory))
    .filter((file) => file.toLowerCase().endsWith(".html"))
    .sort();
  const conversations = [];

  for (const file of files) {
    const html = await readFile(join(directory, file), "utf8");
    const id = conversationId(html, file);
    const turns = transcriptTurns(html, id);
    if (turns.length === 0) throw new Error(`${file} does not contain a transcript table`);
    conversations.push(Object.freeze({ id, file, turns: Object.freeze(turns) }));
  }

  conversations.sort((left, right) => left.id.localeCompare(right.id));
  validateConversationSet(conversations);
  const normalizedSha256 = normalizedCorpusSha256(conversations);
  if (normalizedSha256 !== NccuNormalizedCorpusSha256) {
    throw new Error(
      `Unexpected normalized NCCU corpus checksum ${normalizedSha256}; expected ${NccuNormalizedCorpusSha256}`
    );
  }

  return Object.freeze({
    version: NccuConversationCorpusVersion,
    normalizedSha256,
    conversations: Object.freeze(conversations),
    turnCount: conversations.reduce((sum, conversation) => sum + conversation.turns.length, 0),
    hanCharacterCount: conversations.reduce(
      (sum, conversation) => sum + conversation.turns.reduce((turnSum, turn) => turnSum + turn.text.length, 0),
      0
    )
  });
}

function conversationId(html, file) {
  const match = html.match(/NCCU-TM\s*-?\s*0*(\d{1,3})/iu) ?? file.match(/tm-?0*(\d+)/iu);
  if (!match) throw new Error(`Cannot determine NCCU conversation ID for ${file}`);
  return `TM${String(Number(match[1])).padStart(3, "0")}`;
}

function transcriptTurns(html, id) {
  const turns = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)]
      .map((cell) => htmlText(cell[1]));
    if (!/^\d+$/u.test(cells[0] ?? "") || !cells[2]) continue;
    const text = normalizedMandarinHan(cells.slice(2).join(" "));
    if (!text) continue;
    turns.push(Object.freeze({ id: `${id}:${cells[0]}`, turn: Number(cells[0]), text }));
  }
  return turns;
}

function htmlText(value) {
  return value
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, "\"")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/giu, (_match, hexadecimal, decimal) =>
      String.fromCodePoint(Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10))
    )
    .trim();
}

function normalizedMandarinHan(value) {
  return (value
    .replace(/<L\d[\s\S]*?L\d>/giu, "")
    .replace(/\(\([\s\S]*?\)\)/gu, "")
    .match(/\p{Script=Han}/gu) ?? [])
    .join("");
}

function validateConversationSet(conversations) {
  const expected = Array.from({ length: 50 }, (_unused, index) => `TM${String(index + 1).padStart(3, "0")}`);
  const actual = conversations.map((conversation) => conversation.id);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected NCCU TM001-TM050 exactly; found ${actual.join(", ")}`);
  }
}

function normalizedCorpusSha256(conversations) {
  const hash = createHash("sha256");
  for (const conversation of conversations) {
    for (const turn of conversation.turns) hash.update(`${conversation.id}\t${turn.turn}\t${turn.text}\n`);
  }
  return hash.digest("hex");
}
