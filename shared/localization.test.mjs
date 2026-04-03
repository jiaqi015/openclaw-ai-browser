import test from "node:test";
import assert from "node:assert/strict";
import {
  getAssistantLanguageInstruction,
  translate,
} from "./localization.mjs";

test("translate resolves split domain dictionaries across locales", () => {
  assert.equal(translate("zh-CN", "language.title"), "语言");
  assert.equal(translate("en-US", "language.title"), "Language");
  assert.equal(
    translate("zh-CN", "skills.translateChineseOnlyNote"),
    "该功能固定输出中文摘要，方便快速理解 skill 说明。",
  );
  assert.equal(
    translate("en-US", "openclaw.presentation.scope.remoteControlLabel"),
    "Remote Control",
  );
});

test("assistant language instructions still follow the requested locale", () => {
  assert.equal(
    getAssistantLanguageInstruction("en-US"),
    "Please always answer in English and keep the response concise and reliable.",
  );
  assert.equal(
    getAssistantLanguageInstruction("zh-CN"),
    "请始终使用中文回答，并保持简洁、可靠。",
  );
});
