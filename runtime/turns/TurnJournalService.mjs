function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeStringArray(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeNonEmptyString(value))
        .filter(Boolean),
    ),
  );
}

function createJournalId() {
  return `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneContract(contract) {
  if (!contract || typeof contract !== "object") {
    return null;
  }

  return {
    contractVersion: Number.isFinite(contract.contractVersion)
      ? Number(contract.contractVersion)
      : 1,
    browserContextContract: normalizeNonEmptyString(contract.browserContextContract),
    resultContract: normalizeNonEmptyString(contract.resultContract),
    capabilitySource: normalizeNonEmptyString(contract.capabilitySource),
    capabilityDeclared: Boolean(contract.capabilityDeclared),
    overlayUsed: Boolean(contract.overlayUsed),
    honestyMode: normalizeNonEmptyString(contract.honestyMode),
    blockingMode: normalizeNonEmptyString(contract.blockingMode),
    requiredEvidence: normalizeStringArray(contract.requiredEvidence),
    sourceRoute: normalizeNonEmptyString(contract.sourceRoute),
    outsideBrowserExecutable: Boolean(contract.outsideBrowserExecutable),
    requiresBrowserSession: Boolean(contract.requiresBrowserSession),
    requiresFilesystemAccess: Boolean(contract.requiresFilesystemAccess),
    reproducibilityGuarantee: normalizeNonEmptyString(contract.reproducibilityGuarantee),
    executionReliability: normalizeNonEmptyString(contract.executionReliability),
  };
}

export function buildTurnJournalEntry({
  threadId = "",
  userText = "",
  plan,
  receipt,
  contextPackage,
  response,
  error,
} = {}) {
  const browserContext = plan?.browserContext ?? {};

  return {
    journalId: createJournalId(),
    turnId: normalizeNonEmptyString(plan?.turnId),
    createdAt: normalizeNonEmptyString(plan?.createdAt) || new Date().toISOString(),
    threadId: normalizeNonEmptyString(threadId),
    userText: normalizeNonEmptyString(userText),
    turnType: normalizeNonEmptyString(plan?.turnType),
    strategy: normalizeNonEmptyString(plan?.strategy),
    policyDecision: normalizeNonEmptyString(plan?.policyDecision),
    summary: normalizeNonEmptyString(receipt?.summary),
    browserContext: {
      primarySourceKind: normalizeNonEmptyString(browserContext?.primarySourceKind),
      primarySourceLabel: normalizeNonEmptyString(browserContext?.primarySourceLabel),
      authBoundary: normalizeNonEmptyString(browserContext?.authBoundary),
      trustLevel: normalizeNonEmptyString(browserContext?.trustLevel),
      reproducibility: normalizeNonEmptyString(browserContext?.reproducibility),
      totalSourceCount: Number(browserContext?.totalSourceCount) || 0,
      browserOnlySourceCount: Number(browserContext?.browserOnlySourceCount) || 0,
      lossinessFlags: normalizeStringArray(browserContext?.lossinessFlags),
    },
    skill: plan?.skillPolicy
      ? {
          name: normalizeNonEmptyString(plan.skillPolicy.name),
          mode: normalizeNonEmptyString(plan.skillPolicy.mode),
          compatibilitySource: normalizeNonEmptyString(
            plan.skillPolicy.compatibilitySource,
          ),
          capabilityDeclared: Boolean(plan.skillPolicy.browserCapabilityDeclared),
          overlayUsed: Boolean(plan.skillPolicy.browserCapability?.overlay),
        }
      : null,
    inputPolicy: plan?.inputPolicy
      ? {
          kind: normalizeNonEmptyString(plan.inputPolicy.kind),
          sourceRoute: normalizeNonEmptyString(plan.inputPolicy.sourceRoute),
          sourceRouteLabel: normalizeNonEmptyString(plan.inputPolicy.sourceRouteLabel),
          canExecute: plan.inputPolicy.canExecute !== false,
          compatibilitySource: normalizeNonEmptyString(
            plan.inputPolicy.compatibilitySource,
          ),
          inputMode: normalizeNonEmptyString(plan.inputPolicy.inputMode),
        }
      : null,
    executionContract: cloneContract(plan?.executionContract),
    receipt: receipt
      ? {
          status: normalizeNonEmptyString(receipt.status),
          strategy: normalizeNonEmptyString(receipt.strategy),
          summary: normalizeNonEmptyString(receipt.summary),
          userVisibleMessage: normalizeNonEmptyString(receipt.userVisibleMessage),
          trace: receipt.trace ? { ...receipt.trace } : null,
          evidence: receipt.evidence ? { ...receipt.evidence } : null,
        }
      : null,
    response: response
      ? {
          model: normalizeNonEmptyString(response.model),
          skillName: normalizeNonEmptyString(response.skillName),
          taskId: normalizeNonEmptyString(response.taskId),
        }
      : null,
    errorMessage:
      error instanceof Error
        ? normalizeNonEmptyString(error.message)
        : normalizeNonEmptyString(error),
    contextPackageSummary: contextPackage?.execution
      ? {
          primarySourceKind: normalizeNonEmptyString(
            contextPackage.execution.primarySourceKind,
          ),
          totalSourceCount:
            Number(contextPackage.execution?.summary?.totalSourceCount) || 0,
        }
      : null,
  };
}
