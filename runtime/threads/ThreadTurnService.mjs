import {
  appendMessageToThread,
  serializeThreadStoreState,
} from "./ThreadStore.mjs";
import {
  executeAiTurn,
  executeOpenClawTaskTurn,
} from "../turns/TurnEngine.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function ensureThreadExists(threadId) {
  if (!threadId) {
    throw new Error("当前对话线程还没准备好，请稍后再试。");
  }

  const snapshot = serializeThreadStoreState();
  if (!snapshot.threadsById[threadId]) {
    throw new Error("当前对话线程不存在，暂时无法继续。");
  }
}

async function appendThreadMessage(threadId, message) {
  return appendMessageToThread({
    threadId,
    message,
  });
}

export async function runThreadAiTurn(payload = {}, dependencies = {}) {
  const threadId = normalizeNonEmptyString(payload?.threadId);
  const userText = normalizeNonEmptyString(payload?.userText);
  const runAiAction = dependencies?.runAiAction;
  const actionPayload = payload?.actionPayload ?? {};
  const tabId = normalizeNonEmptyString(actionPayload?.tabId);

  ensureThreadExists(threadId);

  if (!userText) {
    throw new Error("请输入要发送的消息。");
  }
  if (typeof runAiAction !== "function") {
    throw new Error("AI turn 执行器暂未就绪。");
  }

  await appendThreadMessage(threadId, {
    role: "user",
    text: userText,
  });

  try {
    const turnResult = await executeAiTurn(
      {
        ...payload,
        actionPayload: {
          ...actionPayload,
          tabId,
        },
      },
      {
        ...dependencies,
        runAiAction,
      },
    );
    const runtimeState = await appendThreadMessage(threadId, {
      role: turnResult.ok ? "assistant" : "error",
      text: turnResult.receipt.userVisibleMessage,
      ...(turnResult.response?.skillTrace && typeof turnResult.response.skillTrace === "object"
        ? { skillTrace: turnResult.response.skillTrace }
        : {}),
    });

    if (turnResult.ok) {
      return {
        ok: true,
        runtimeState,
      };
    }

    return {
      ok: false,
      errorMessage: turnResult.receipt.userVisibleMessage,
      runtimeState,
    };
  } catch (error) {
    const runtimeState = await appendThreadMessage(threadId, {
      role: "error",
      text: getErrorMessage(error),
    });

    return {
      ok: false,
      errorMessage: getErrorMessage(error),
      runtimeState,
    };
  }
}

export async function runThreadOpenClawTaskTurn(payload = {}, dependencies = {}) {
  const threadId = normalizeNonEmptyString(payload?.threadId);
  const userText = normalizeNonEmptyString(payload?.userText);
  const runLocalAgentTask = dependencies?.runLocalAgentTask;
  const taskPayload = payload?.taskPayload ?? {};
  const tabId = normalizeNonEmptyString(taskPayload?.tabId);

  ensureThreadExists(threadId);

  if (!userText) {
    throw new Error("请输入要交给龙虾处理的内容。");
  }
  if (typeof runLocalAgentTask !== "function") {
    throw new Error("OpenClaw turn 执行器暂未就绪。");
  }
  if (!tabId) {
    throw new Error("当前没有可用标签页，暂时无法交给龙虾处理。");
  }
  await appendThreadMessage(threadId, {
    role: "user",
    text: userText,
  });

  try {
    const turnResult = await executeOpenClawTaskTurn(
      {
        ...payload,
        userText,
        taskPayload: {
          ...taskPayload,
          tabId,
        },
      },
      {
        ...dependencies,
        runLocalAgentTask,
      },
    );
    const runtimeState = await appendThreadMessage(threadId, {
      role: turnResult.ok ? "assistant" : "error",
      text: turnResult.receipt.userVisibleMessage,
    });

    if (turnResult.ok) {
      return {
        ok: true,
        runtimeState,
      };
    }

    return {
      ok: false,
      errorMessage: turnResult.receipt.userVisibleMessage,
      runtimeState,
    };
  } catch (error) {
    const runtimeState = await appendThreadMessage(threadId, {
      role: "error",
      text: getErrorMessage(error),
    });

    return {
      ok: false,
      errorMessage: getErrorMessage(error),
      runtimeState,
    };
  }
}
