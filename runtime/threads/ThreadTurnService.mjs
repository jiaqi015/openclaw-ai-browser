import {
  appendMessageToThread,
  serializeThreadStoreState,
} from "./ThreadStore.mjs";
import {
  executeAiTurn,
  executeOpenClawTaskTurn,
} from "../turns/TurnEngine.mjs";
import { normalizeUiLocale, translate } from "../../shared/localization.mjs";
import { buildTurnJournalEntry } from "../turns/TurnJournalService.mjs";
import { recordTurnJournalEntry } from "../turns/TurnJournalStore.mjs";

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

async function appendTurnJournal(threadId, userText, turnResult) {
  return recordTurnJournalEntry(
    buildTurnJournalEntry({
      threadId,
      userText,
      plan: turnResult?.executionPlan,
      receipt: turnResult?.receipt,
      contextPackage: turnResult?.contextPackage,
      response: turnResult?.response,
      error: turnResult?.error,
    }),
  );
}

export async function runThreadAiTurn(payload = {}, dependencies = {}) {
  const threadId = normalizeNonEmptyString(payload?.threadId);
  const userText = normalizeNonEmptyString(payload?.userText);
  const runAiAction = dependencies?.runAiAction;
  const actionPayload = payload?.actionPayload ?? {};
  const uiLocale = normalizeUiLocale(actionPayload?.uiLocale);
  const tabId = normalizeNonEmptyString(actionPayload?.tabId);

  ensureThreadExists(threadId);

  if (!userText) {
    throw new Error(translate(uiLocale, "error.enterMessage"));
  }
  if (typeof runAiAction !== "function") {
    throw new Error(translate(uiLocale, "error.aiTurnUnavailable"));
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
    const journalEntry = await appendTurnJournal(threadId, userText, turnResult);
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
        journalEntryId: journalEntry.journalId,
      };
    }

    return {
      ok: false,
      errorMessage: turnResult.receipt.userVisibleMessage,
      runtimeState,
      journalEntryId: journalEntry.journalId,
    };
  } catch (error) {
    const journalEntry = await recordTurnJournalEntry(
      buildTurnJournalEntry({
        threadId,
        userText,
        error,
      }),
    );
    const runtimeState = await appendThreadMessage(threadId, {
      role: "error",
      text: getErrorMessage(error),
    });

    return {
      ok: false,
      errorMessage: getErrorMessage(error),
      runtimeState,
      journalEntryId: journalEntry.journalId,
    };
  }
}

export async function runThreadOpenClawTaskTurn(payload = {}, dependencies = {}) {
  const threadId = normalizeNonEmptyString(payload?.threadId);
  const userText = normalizeNonEmptyString(payload?.userText);
  const runLocalAgentTask = dependencies?.runLocalAgentTask;
  const taskPayload = payload?.taskPayload ?? {};
  const uiLocale = normalizeUiLocale(taskPayload?.uiLocale);
  const tabId = normalizeNonEmptyString(taskPayload?.tabId);

  ensureThreadExists(threadId);

  if (!userText) {
    throw new Error(translate(uiLocale, "error.enterOpenClawTask"));
  }
  if (typeof runLocalAgentTask !== "function") {
    throw new Error(translate(uiLocale, "error.openClawTurnUnavailable"));
  }
  if (!tabId) {
    throw new Error(translate(uiLocale, "error.noUsableTab"));
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
    const journalEntry = await appendTurnJournal(threadId, userText, turnResult);
    const runtimeState = await appendThreadMessage(threadId, {
      role: turnResult.ok ? "assistant" : "error",
      text: turnResult.receipt.userVisibleMessage,
    });

    if (turnResult.ok) {
      return {
        ok: true,
        runtimeState,
        journalEntryId: journalEntry.journalId,
      };
    }

    return {
      ok: false,
      errorMessage: turnResult.receipt.userVisibleMessage,
      runtimeState,
      journalEntryId: journalEntry.journalId,
    };
  } catch (error) {
    const journalEntry = await recordTurnJournalEntry(
      buildTurnJournalEntry({
        threadId,
        userText,
        error,
      }),
    );
    const runtimeState = await appendThreadMessage(threadId, {
      role: "error",
      text: getErrorMessage(error),
    });

    return {
      ok: false,
      errorMessage: getErrorMessage(error),
      runtimeState,
      journalEntryId: journalEntry.journalId,
    };
  }
}
