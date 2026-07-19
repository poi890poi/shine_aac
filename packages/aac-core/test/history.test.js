import test from "node:test";
import assert from "node:assert/strict";
import { compactTextHistorySnapshots } from "../src/index.js";

const reportedUpgradeExport = `ㄊ
ㄊㄧ
ㄊㄧㄥ
聽
聽\u0020
聽 p
聽 po
聽 pod
聽 podc
聽 podca
聽 podcas
聽 podcast
聽 podcast\u0020
聽 podcast ㄒ
聽 podcast ㄒㄧ
聽 podcast ㄒㄧㄣ
聽 podcast 新
聽 podcast 新ㄗ
聽 podcast 新ㄗㄌ
聽 podcast 新ㄗㄌㄧ
聽 podcast 新ㄗㄌㄧㄠ
聽 podcast 新資料
聽 podcast 新資料ㄐ
聽 podcast 新資料ㄐㄧ
聽 podcast 新資料ㄐㄧㄚ
聽 podcast 新資料夾
ㄅ
ㄅㄧ
ㄅㄧㄥ
冰
冰ㄏ
冰ㄏㄨ
冰ㄏㄨㄥ
冰ㄏㄨㄥㄔ
冰ㄏㄨㄥㄔㄚ
冰紅茶
冰紅茶ㄕ
冰紅茶ㄕㄠ
冰紅茶少
冰紅茶少ㄅ
冰紅茶少ㄅㄧ
冰紅茶少ㄅㄧㄥ
冰紅茶少冰
冰紅茶少冰ㄅ
聽 podcast 新資料夾
冰紅茶少冰不要太甜`;

test("upgrade migration compacts reported per-input snapshots into text-area sessions", () => {
  const texts = reportedUpgradeExport.split("\n");
  const entries = texts.map((text, index) => ({
    id: `legacy-${index}`,
    profileId: "zh-TW",
    effect: index === texts.length - 2 ? "undo" : "message",
    text,
    closed: true
  }));

  const compacted = compactTextHistorySnapshots(entries, {
    currentText: texts.at(-1),
    currentProfileId: "zh-TW"
  });

  assert.deepEqual(compacted.map((entry) => entry.text), [
    "聽 podcast 新資料夾",
    "冰紅茶少冰不要太甜"
  ]);
  assert.deepEqual(compacted.map((entry) => entry.closed), [true, false]);
});

test("explicit reset remains a boundary even when the next line extends the previous text", () => {
  const compacted = compactTextHistorySnapshots([
    { profileId: "en-US", effect: "reset", text: "help", closed: true },
    { profileId: "en-US", effect: "message", text: "help me", closed: false }
  ], {
    currentText: "help me",
    currentProfileId: "en-US"
  });

  assert.deepEqual(compacted.map((entry) => entry.text), ["help", "help me"]);
  assert.deepEqual(compacted.map((entry) => entry.closed), [true, false]);
});

test("candidate commits, deletion, and undo branches remain in one session", () => {
  const compacted = compactTextHistorySnapshots([
    { profileId: "zh-TW", effect: "message", text: "ㄊ", closed: true },
    { profileId: "zh-TW", effect: "message", text: "ㄊㄧㄥ", closed: true },
    { profileId: "zh-TW", effect: "message", text: "聽", closed: true },
    { profileId: "zh-TW", effect: "message", text: "聽 podcast ", closed: true },
    { profileId: "zh-TW", effect: "undo", text: "聽 ", closed: true },
    { profileId: "zh-TW", effect: "message", text: "聽音樂", closed: true }
  ], {
    currentText: "聽音樂",
    currentProfileId: "zh-TW"
  });

  assert.equal(compacted.length, 1);
  assert.equal(compacted[0].text, "聽音樂");
  assert.equal(compacted[0].closed, false);
});
