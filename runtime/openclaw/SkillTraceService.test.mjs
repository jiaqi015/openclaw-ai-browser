import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildSkillFinalTraceStep,
  extractSkillTraceFromSession,
} from "./SkillTraceService.mjs";

test("buildSkillFinalTraceStep keeps optimistic skill success non-error", () => {
  const step = buildSkillFinalTraceStep({
    skillName: "summarize",
    requestId: "req-123",
    status: "used",
    responseText: "这是页面总结。",
    hasSuccessfulToolTrace: true,
  });

  assert.equal(step.title, "已确认技能执行成功");
  assert.equal(step.detail, "这是页面总结。");
  assert.equal(step.isError, false);
});

test("buildSkillFinalTraceStep preserves explicit skill receipt success", () => {
  const step = buildSkillFinalTraceStep({
    skillName: "summarize",
    requestId: "req-123",
    status: "used",
    responseText: "[SKILL_USED:summarize:req-123]\n这是页面总结。",
    hasSuccessfulToolTrace: true,
  });

  assert.equal(step.title, "已收到技能成功回执");
  assert.equal(step.detail, "这是页面总结。");
  assert.equal(step.isError, false);
});

test("buildSkillFinalTraceStep does not report used when receipt and tool success are both missing", () => {
  const step = buildSkillFinalTraceStep({
    skillName: "summarize",
    requestId: "req-123",
    status: "used",
    responseText: "这是页面总结。",
    hasSuccessfulToolTrace: false,
  });

  assert.equal(step.title, "技能执行未成功");
  assert.match(step.detail, /OpenClaw 未返回技能回执/);
  assert.equal(step.isError, true);
});

test("buildSkillFinalTraceStep treats explicit receipt as failure when tool trace failed", () => {
  const step = buildSkillFinalTraceStep({
    skillName: "summarize",
    requestId: "req-123",
    status: "failed",
    responseText: "[SKILL_USED:summarize:req-123]\n这是页面总结。",
    hasSuccessfulToolTrace: false,
    hasFailedToolTrace: true,
    toolResultDetail: "Failed to fetch HTML document (status 404)",
    failureReason: "OpenClaw skill summarize 返回了成功回执，但底层 tool 执行失败。",
  });

  assert.equal(step.title, "技能执行未成功");
  assert.match(step.detail, /tool 执行失败|404/);
  assert.equal(step.isError, true);
});

test("buildSkillFinalTraceStep preserves explicit skill failure even with successful tool trace", () => {
  const step = buildSkillFinalTraceStep({
    skillName: "summarize",
    requestId: "req-123",
    status: "used",
    responseText: "[SKILL_FAILED:summarize:req-123] tool rejected input",
    hasSuccessfulToolTrace: true,
    hasFailedToolTrace: false,
    toolResultDetail: "tool succeeded but result was unusable",
  });

  assert.equal(step.title, "技能执行未成功");
  assert.match(step.detail, /tool rejected input/);
  assert.equal(step.isError, true);
});

test("extractSkillTraceFromSession does not reuse older tool traces from the same session", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-skill-trace-"));
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  process.env.OPENCLAW_STATE_DIR = tempRoot;

  try {
    const sessionPath = path.join(
      tempRoot,
      "agents",
      "saburina-browser",
      "sessions",
      "shared-session.jsonl",
    );
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.writeFile(
      sessionPath,
      [
        JSON.stringify({
          message: {
            role: "user",
            content: [{ type: "text", text: "本轮请求编号：req-old\n请执行 /summarize" }],
          },
        }),
        JSON.stringify({
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                name: "exec",
                arguments: { command: 'summarize "https://example.com"' },
              },
            ],
          },
        }),
        JSON.stringify({
          message: {
            role: "toolResult",
            toolName: "exec",
            details: {
              exitCode: 0,
              durationMs: 321,
              aggregated: "Old tool output",
            },
          },
        }),
        JSON.stringify({
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "[SKILL_USED:summarize:req-old]\n旧请求完成",
              },
            ],
          },
        }),
        JSON.stringify({
          message: {
            role: "user",
            content: [
              {
                type: "text",
                text: "本轮请求编号：req-new\n请执行 /summarize\n当前页面无法直接提供 URL。",
              },
            ],
          },
        }),
        JSON.stringify({
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "[SKILL_FAILED:summarize:req-new] 缺少可用输入",
              },
            ],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const trace = await extractSkillTraceFromSession({
      agentId: "saburina-browser",
      sessionId: "shared-session",
      skillName: "summarize",
      requestId: "req-new",
      status: "failed",
      failureReason: "OpenClaw skill summarize 执行失败：缺少可用输入",
      responseText: "[SKILL_FAILED:summarize:req-new] 缺少可用输入",
      requestAt: "2026-04-02T00:00:00.000Z",
    });

    assert.deepEqual(
      trace.steps.map((step) => step.type),
      ["request", "final"],
    );
    assert.equal(trace.steps[1].title, "技能执行未成功");
    assert.match(trace.steps[1].detail, /缺少可用输入/);
  } finally {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
