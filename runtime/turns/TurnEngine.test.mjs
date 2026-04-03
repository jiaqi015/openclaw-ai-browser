import test from "node:test";
import assert from "node:assert/strict";
import {
  executeAiTurn,
  executeGenTabTurn,
  executeOpenClawTaskTurn,
} from "./TurnEngine.mjs";

test("executeAiTurn plans strict skill execution from Browser Context Package facts", async () => {
  const snapshots = {
    active: {
      title: "Docs",
      url: "http://localhost:3000/docs",
      selectedText: "",
      contentText: "Documentation body",
      leadText: "Documentation lead",
    },
    refA: {
      title: "Reference",
      url: "https://example.com/reference",
      selectedText: "",
      contentText: "Reference body",
      leadText: "Reference lead",
    },
  };
  let capturedContextPackage = null;

  const result = await executeAiTurn(
    {
      actionPayload: {
        tabId: "active",
        prompt: "帮我总结",
        skillName: "summarize",
        skillMode: "strict",
      },
      referenceTabIds: ["refA"],
    },
    {
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }

        return snapshots[tabId];
      },
      getLocalSkillDetail: async () => ({
        name: "summarize",
        ready: true,
        browserCapability: {
          inputMode: "source-url",
          sourceKinds: ["public-url", "private-url", "local-file"],
          useHint: "Skill descriptor for URL-native browser input.",
          source: "skill-metadata",
          overlay: false,
        },
      }),
      runAiAction: async (payload) => {
        capturedContextPackage = payload.contextPackage;
        return {
          message: "总结完成",
          skillName: "summarize",
          model: "gpt-5.4",
          skillTrace: {
            steps: [{ type: "final", title: "完成", detail: "summarize" }],
          },
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionPlan.turnType, "skill");
  assert.equal(result.executionPlan.strategy, "strict_skill_execution");
  assert.equal(result.executionPlan.policyDecision, "allow-with-honesty-constraints");
  assert.equal(result.executionPlan.browserContext.primarySourceKind, "private-http");
  assert.equal(result.executionPlan.inputPolicy.kind, "browser-skill");
  assert.equal(result.executionPlan.inputPolicy.inputMode, "source-url");
  assert.equal(result.executionPlan.inputPolicy.sourceRoute, "private-http");
  assert.equal(result.executionPlan.inputPolicy.canExecute, true);
  assert.equal(result.executionPlan.skillPolicy.compatibilitySource, "skill-metadata");
  assert.equal(result.executionPlan.executionContract.resultContract, "skill-result");
  assert.equal(
    result.executionPlan.executionContract.honestyMode,
    "explicit-failure-required",
  );
  assert.deepEqual(result.executionPlan.executionContract.requiredEvidence, [
    "skill-receipt",
    "skill-trace",
  ]);
  assert.equal(result.executionPlan.skillPolicy.browserCapability?.inputMode, "source-url");
  assert.deepEqual(result.executionPlan.skillPolicy.browserCapability?.sourceKinds, [
    "public-url",
    "private-url",
    "local-file",
  ]);
  assert.equal(result.receipt.status, "completed");
  assert.equal(result.receipt.trace.skillName, "summarize");
  assert.equal(result.receipt.evidence.honestyConstraintsApplied, true);
  assert.equal(capturedContextPackage.execution.primarySourceKind, "private-http");
  assert.equal(capturedContextPackage.references[0].tabId, "refA");
  assert.match(result.receipt.userVisibleMessage, /总结完成/);
});

test("executeAiTurn normalizes failed receipts", async () => {
  const result = await executeAiTurn(
    {
      actionPayload: {
        tabId: "active",
        prompt: "帮我解释",
      },
    },
    {
      getContextSnapshotForTab: async () => ({
        title: "History",
        url: "sabrina://history",
        selectedText: "",
        contentText: "history content",
      }),
      runAiAction: async () => {
        throw new Error("当前页面不支持该执行路径。");
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.executionPlan.turnType, "ask");
  assert.equal(result.executionPlan.strategy, "chat_response");
  assert.equal(result.receipt.status, "failed");
  assert.equal(result.receipt.userVisibleMessage, "当前页面不支持该执行路径。");
  assert.equal(result.receipt.evidence.executionAttempted, true);
  assert.equal(result.receipt.evidence.routeKind, "internal-surface");
});

test("executeAiTurn blocks strict skill execution before runtime when route is incompatible", async () => {
  let called = false;

  const result = await executeAiTurn(
    {
      actionPayload: {
        tabId: "active",
        prompt: "帮我总结",
        skillName: "summarize",
        skillMode: "strict",
      },
    },
    {
      getContextSnapshotForTab: async () => ({
        title: "History",
        url: "sabrina://history",
        selectedText: "",
        contentText: "history content",
      }),
      getLocalSkillDetail: async () => ({
        name: "summarize",
        ready: true,
        browserCapability: {
          inputMode: "source-url",
          sourceKinds: ["public-url", "private-url"],
          useHint: "Only URLs, not internal surfaces.",
          source: "skill-metadata",
          overlay: false,
        },
      }),
      runAiAction: async () => {
        called = true;
        return {
          message: "不应该执行到这里",
        };
      },
    },
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  assert.equal(result.executionPlan.turnType, "skill");
  assert.equal(result.executionPlan.policyDecision, "reject");
  assert.equal(result.executionPlan.inputPolicy.canExecute, false);
  assert.equal(
    result.executionPlan.executionContract.blockingMode,
    "reject-before-execution",
  );
  assert.equal(result.receipt.status, "blocked");
  assert.equal(result.receipt.evidence.executionAttempted, false);
  assert.match(result.receipt.userVisibleMessage, /当前页面路由为/);
});

test("executeOpenClawTaskTurn builds background task receipts and prompts", async () => {
  const snapshots = {
    active: {
      title: "Spec",
      url: "https://example.com/spec",
      selectedText: "关键需求",
      contentText: "Spec body",
      leadText: "Spec lead",
      contentPreview: "Spec preview",
    },
    refA: {
      title: "Reference",
      url: "https://example.com/reference",
      selectedText: "",
      contentText: "Reference body",
      leadText: "Reference lead",
      contentPreview: "Reference preview",
    },
  };
  let capturedTask = null;

  const result = await executeOpenClawTaskTurn(
    {
      threadId: "thread-1",
      userText: "请继续处理",
      taskPayload: {
        tabId: "active",
        prompt: "整理这份规格说明",
        agentId: "sabrina-browser",
      },
      referenceTabIds: ["refA"],
    },
    {
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }

        return snapshots[tabId];
      },
      runLocalAgentTask: async (payload) => {
        capturedTask = payload;
        return {
          text: "已创建后台任务",
          taskId: "task-1",
          model: "gpt-5.4",
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionPlan.turnType, "handoff");
  assert.equal(result.executionPlan.strategy, "background_task");
  assert.equal(result.executionPlan.inputPolicy.kind, "browser-handoff");
  assert.equal(result.executionPlan.browserContext.primarySourceKind, "public-http");
  assert.equal(result.executionPlan.executionContract.resultContract, "task-record");
  assert.deepEqual(result.executionPlan.executionContract.requiredEvidence, ["task-record"]);
  assert.equal(result.receipt.status, "completed");
  assert.equal(result.receipt.trace.taskId, "task-1");
  assert.equal(capturedTask.task.title, "Spec");
  assert.equal(capturedTask.task.threadId, "thread-1");
  assert.equal(capturedTask.task.sourceUrl, "https://example.com/spec");
  assert.match(capturedTask.message, /当前页面：Spec/);
  assert.match(capturedTask.message, /引用页面 1：Reference/);
  assert.match(result.receipt.userVisibleMessage, /已交给龙虾异步处理/);
});

test("executeGenTabTurn plans artifact generation and returns normalized gentab", async () => {
  const snapshots = {
    "tab-a": {
      title: "A 产品",
      url: "https://a.example.com",
      hostname: "a.example.com",
      leadText: "A 的导语",
      contentPreview: "A 摘要",
      contentText: "A 正文",
      selectedText: "",
      headings: ["价格"],
      sections: [{ title: "价格", summary: "A 价格摘要" }],
    },
    "tab-b": {
      title: "B 产品",
      url: "https://b.example.com",
      hostname: "b.example.com",
      leadText: "B 的导语",
      contentPreview: "B 摘要",
      contentText: "B 正文",
      selectedText: "",
      headings: ["功能"],
      sections: [{ title: "功能", summary: "B 功能摘要" }],
    },
  };
  let capturedPrompt = "";

  const result = await executeGenTabTurn(
    {
      referenceTabIds: ["tab-a", "missing-tab", "tab-b"],
      userIntent: "整理竞品对比",
      preferredType: "comparison",
    },
    {
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }
        return snapshots[tabId];
      },
      runLocalAgentTurn: async ({ message }) => {
        capturedPrompt = message;
        return {
          text: JSON.stringify({
            success: true,
            gentab: {
              schemaVersion: "2",
              type: "comparison",
              title: "竞品对比台",
              items: [
                {
                  id: "a",
                  title: "A 产品",
                  sourceUrl: "https://a.example.com",
                  sourceTitle: "A 产品",
                },
              ],
            },
          }),
          model: "gpt-5.4",
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionPlan.turnType, "gentab");
  assert.equal(result.executionPlan.strategy, "artifact_generation");
  assert.equal(result.executionPlan.inputPolicy.kind, "artifact-generation");
  assert.equal(result.executionPlan.browserContext.totalSourceCount, 2);
  assert.equal(result.executionPlan.executionContract.resultContract, "artifact");
  assert.deepEqual(result.executionPlan.executionContract.requiredEvidence, ["artifact"]);
  assert.equal(result.receipt.status, "completed");
  assert.equal(result.gentab.title, "竞品对比台");
  assert.deepEqual(result.gentab.metadata.missingReferenceTabIds, ["missing-tab"]);
  assert.match(capturedPrompt, /Browser Context Package execution/);
  assert.match(result.receipt.userVisibleMessage, /GenTab 已生成/);
});
