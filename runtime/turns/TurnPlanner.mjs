function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function createTurnId() {
  return `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createIsoTimestamp(input = Date.now()) {
  return new Date(input).toISOString();
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

function getExecutionPlanStrategy(intentType, actionPayload = {}) {
  if (intentType === "agent") {
    return "browser_agent_task";
  }

  if (intentType === "handoff") {
    return "background_task";
  }

  if (intentType === "gentab") {
    return "artifact_generation";
  }

  return normalizeNonEmptyString(actionPayload?.skillName)
    ? "strict_skill_execution"
    : "chat_response";
}

function buildBrowserContextPlan(contextPackage) {
  const execution = contextPackage?.execution ?? {};
  const summary = execution?.summary ?? {};

  return {
    primarySourceKind: normalizeNonEmptyString(execution?.primarySourceKind),
    primarySourceLabel: normalizeNonEmptyString(execution?.primarySourceLabel),
    authBoundary: normalizeNonEmptyString(execution?.authBoundary),
    trustLevel: normalizeNonEmptyString(execution?.trustLevel),
    reproducibility: normalizeNonEmptyString(execution?.reproducibility),
    executionReliability: normalizeNonEmptyString(execution?.executionReliability),
    reachabilityConfidence: normalizeNonEmptyString(execution?.reachabilityConfidence),
    authBoundaryConfidence: normalizeNonEmptyString(execution?.authBoundaryConfidence),
    reproducibilityGuarantee: normalizeNonEmptyString(
      execution?.reproducibilityGuarantee,
    ),
    outsideBrowserExecutable: Boolean(execution?.outsideBrowserExecutable),
    requiresBrowserSession: Boolean(execution?.requiresBrowserSession),
    requiresFilesystemAccess: Boolean(execution?.requiresFilesystemAccess),
    selectionState: contextPackage?.selectionState === "selection" ? "selection" : "page",
    totalSourceCount: Number(summary?.totalSourceCount) || 0,
    executableSourceCount: Number(summary?.executableSourceCount) || 0,
    browserOnlySourceCount: Number(summary?.browserOnlySourceCount) || 0,
    replayableSourceCount: Number(summary?.replayableSourceCount) || 0,
    outsideBrowserExecutableCount: Number(summary?.outsideBrowserExecutableCount) || 0,
    requiresBrowserSessionCount: Number(summary?.requiresBrowserSessionCount) || 0,
    requiresFilesystemAccessCount:
      Number(summary?.requiresFilesystemAccessCount) || 0,
    deterministicReplayableCount:
      Number(summary?.deterministicReplayableCount) || 0,
    lossinessFlags: normalizeStringArray(execution?.lossinessFlags),
  };
}

function buildSkillPolicy(intent, capability) {
  const skillName = normalizeNonEmptyString(
    capability?.skillName ?? intent?.actionPayload?.skillName,
  );
  if (!skillName) {
    return null;
  }

  const inputPlan = capability?.inputPlan ?? null;
  const skill = capability?.skill ?? null;

  return {
    name: skillName,
    mode: capability?.skillMode === "assist" ? "assist" : "strict",
    ready: skill?.ready !== false,
    missingSummary: normalizeNonEmptyString(skill?.missingSummary),
    browserCapabilityDeclared: Boolean(skill?.browserCapabilityDeclared),
    compatibilitySource: normalizeNonEmptyString(inputPlan?.compatibilitySource),
    inputMode: normalizeNonEmptyString(inputPlan?.inputMode),
    supportedSourceKinds: normalizeStringArray(inputPlan?.supportedSourceKinds),
    declaredBrowserCapability: skill?.declaredBrowserCapability
      ? {
          inputMode: normalizeNonEmptyString(skill.declaredBrowserCapability.inputMode),
          sourceKinds: normalizeStringArray(skill.declaredBrowserCapability.sourceKinds),
          useHint: normalizeNonEmptyString(skill.declaredBrowserCapability.useHint),
          source:
            normalizeNonEmptyString(skill.declaredBrowserCapability.source) ||
            "skill-metadata",
          overlay: Boolean(skill.declaredBrowserCapability.overlay),
        }
      : null,
    browserCapability: skill?.browserCapability
      ? {
          inputMode: normalizeNonEmptyString(skill.browserCapability.inputMode),
          sourceKinds: normalizeStringArray(skill.browserCapability.sourceKinds),
          useHint: normalizeNonEmptyString(skill.browserCapability.useHint),
          source:
            normalizeNonEmptyString(skill.browserCapability.source) || "skill-metadata",
          overlay: Boolean(skill.browserCapability.overlay),
        }
      : null,
  };
}

function buildInputPolicy(intent, intentType, strategy, contextPackage, capability) {
  const execution = contextPackage?.execution ?? {};

  if (strategy === "strict_skill_execution") {
    const inputPlan = capability?.inputPlan ?? null;
    return {
      kind: "browser-skill",
      canExecute: inputPlan?.canExecute !== false,
      sourceRoute: normalizeNonEmptyString(
        inputPlan?.sourceRoute ?? execution?.primarySourceKind,
      ),
      sourceRouteLabel: normalizeNonEmptyString(
        inputPlan?.sourceRouteLabel ?? execution?.primarySourceLabel,
      ),
      compatibilitySource: normalizeNonEmptyString(inputPlan?.compatibilitySource),
      inputMode: normalizeNonEmptyString(inputPlan?.inputMode),
      supportedSourceKinds: normalizeStringArray(inputPlan?.supportedSourceKinds),
      routeNote: normalizeNonEmptyString(inputPlan?.routeNote),
      failureReason: normalizeNonEmptyString(inputPlan?.failureReason),
      resolutionError: normalizeNonEmptyString(capability?.resolutionError),
    };
  }

  if (strategy === "background_task") {
    return {
      kind: "browser-handoff",
      sourceRoute: normalizeNonEmptyString(execution?.primarySourceKind),
      sourceRouteLabel: normalizeNonEmptyString(execution?.primarySourceLabel),
      sourceCount: Number(execution?.summary?.totalSourceCount) || 0,
      browserOnlySourceCount: Number(execution?.summary?.browserOnlySourceCount) || 0,
      note:
        "后台 handoff 继续使用 Sabrina 的 Browser Context Package 作为浏览器现场工作包。",
    };
  }

  if (strategy === "browser_agent_task") {
    return {
      kind: "browser-agent",
      sourceRoute: normalizeNonEmptyString(execution?.primarySourceKind),
      sourceRouteLabel: normalizeNonEmptyString(execution?.primarySourceLabel),
      sourceCount: Number(execution?.summary?.totalSourceCount) || 0,
      browserOnlySourceCount: Number(execution?.summary?.browserOnlySourceCount) || 0,
      note:
        "Browser Agent 必须沿用 Browser Context Package 作为页面现场契约，并回写 Sabrina turn receipt。",
    };
  }

  if (strategy === "artifact_generation") {
    return {
      kind: "artifact-generation",
      preferredType: normalizeNonEmptyString(intent?.genTabPayload?.preferredType),
      sourceCount: Number(execution?.summary?.totalSourceCount) || 0,
      missingReferenceCount: Number(contextPackage?.missingReferenceTabIds?.length) || 0,
      note:
        "GenTab 使用 Browser Context Package 作为结构化 artifact generation 输入，而不是 ad hoc snapshot array。",
    };
  }

  return {
    kind: "browser-chat",
    sourceRoute: normalizeNonEmptyString(execution?.primarySourceKind),
    sourceRouteLabel: normalizeNonEmptyString(execution?.primarySourceLabel),
    note: "浏览器问答继续以 Browser Context Package 为统一输入边界。",
  };
}

function getPolicyDecision(strategy, contextPackage, inputPolicy) {
  const sourceKind = contextPackage?.execution?.primarySourceKind;

  if (strategy === "strict_skill_execution" && inputPolicy?.canExecute === false) {
    return "reject";
  }

  if (
    strategy === "strict_skill_execution" &&
    (sourceKind === "private-http" || sourceKind === "local-file")
  ) {
    return "allow-with-honesty-constraints";
  }

  return "allow";
}

function buildExecutionContract(strategy, browserContext, skillPolicy, inputPolicy, policyDecision) {
  const capabilitySource = normalizeNonEmptyString(
    skillPolicy?.declaredBrowserCapability?.source ||
      skillPolicy?.browserCapability?.source ||
      skillPolicy?.compatibilitySource,
  );
  const requiredEvidence =
    strategy === "strict_skill_execution"
      ? ["skill-receipt", "skill-trace"]
      : strategy === "browser_agent_task"
        ? ["agent-receipt", "agent-journal"]
      : strategy === "background_task"
        ? ["task-record"]
        : strategy === "artifact_generation"
          ? ["artifact"]
          : ["assistant-message"];

  return {
    contractVersion: 1,
    browserContextContract: "browser-context-package",
    resultContract:
      strategy === "strict_skill_execution"
        ? "skill-result"
        : strategy === "browser_agent_task"
          ? "agent-task"
        : strategy === "background_task"
          ? "task-record"
          : strategy === "artifact_generation"
            ? "artifact"
            : "assistant-message",
    capabilitySource,
    capabilityDeclared: Boolean(
      skillPolicy?.browserCapabilityDeclared || skillPolicy?.declaredBrowserCapability,
    ),
    overlayUsed: capabilitySource === "sabrina-overlay",
    honestyMode:
      policyDecision === "allow-with-honesty-constraints"
        ? "explicit-failure-required"
        : strategy === "browser_agent_task"
          ? "agent-receipt"
        : strategy === "strict_skill_execution"
          ? "strict-skill-receipt"
          : strategy === "background_task"
            ? "task-record-required"
            : strategy === "artifact_generation"
              ? "artifact-required"
              : "assistant-message",
    blockingMode:
      strategy === "strict_skill_execution" ? "reject-before-execution" : "none",
    requiredEvidence,
    sourceRoute: normalizeNonEmptyString(
      inputPolicy?.sourceRoute || browserContext?.primarySourceKind,
    ),
    outsideBrowserExecutable: Boolean(browserContext?.outsideBrowserExecutable),
    requiresBrowserSession: Boolean(browserContext?.requiresBrowserSession),
    requiresFilesystemAccess: Boolean(browserContext?.requiresFilesystemAccess),
    reproducibilityGuarantee: normalizeNonEmptyString(
      browserContext?.reproducibilityGuarantee,
    ),
    executionReliability: normalizeNonEmptyString(browserContext?.executionReliability),
  };
}

function getPlanNotes(strategy, contextPackage, inputPolicy) {
  const notes = [];
  const sourceKind = normalizeNonEmptyString(
    contextPackage?.execution?.primarySourceKind,
  );
  const lossinessFlags = normalizeStringArray(contextPackage?.execution?.lossinessFlags);

  if (strategy === "strict_skill_execution" && sourceKind) {
    notes.push(`browser-source-kind:${sourceKind}`);
  }
  if (strategy === "browser_agent_task" && sourceKind) {
    notes.push(`agent-browser-source-kind:${sourceKind}`);
  }
  if (normalizeNonEmptyString(inputPolicy?.compatibilitySource)) {
    notes.push(`skill-compatibility-source:${inputPolicy.compatibilitySource}`);
  }
  if (normalizeNonEmptyString(inputPolicy?.inputMode)) {
    notes.push(`skill-input-mode:${inputPolicy.inputMode}`);
  }
  if (normalizeNonEmptyString(inputPolicy?.sourceRoute)) {
    notes.push(`input-route:${inputPolicy.sourceRoute}`);
  }
  if (inputPolicy?.canExecute === false) {
    notes.push("policy:rejected-before-execution");
  }

  if (lossinessFlags.length > 0) {
    notes.push(`browser-lossiness:${lossinessFlags.join(",")}`);
  }

  return notes;
}

export function planTurnExecution({ intent, contextPackage, capability } = {}) {
  const normalizedIntentType = normalizeNonEmptyString(intent?.type);
  if (!normalizedIntentType) {
    throw new Error("Turn intent 缺少 type。");
  }

  const strategy = getExecutionPlanStrategy(
    normalizedIntentType,
    intent?.actionPayload,
  );
  const browserContext = buildBrowserContextPlan(contextPackage);
  const skillPolicy = buildSkillPolicy(intent, capability);
  const inputPolicy = buildInputPolicy(
    intent,
    normalizedIntentType,
    strategy,
    contextPackage,
    capability,
  );
  const policyDecision = getPolicyDecision(strategy, contextPackage, inputPolicy);
  const executionContract = buildExecutionContract(
    strategy,
    browserContext,
    skillPolicy,
    inputPolicy,
    policyDecision,
  );

  return {
    turnId: createTurnId(),
    createdAt: createIsoTimestamp(),
    turnType: normalizedIntentType,
    strategy,
    policyDecision,
    browserContext,
    skillPolicy,
    inputPolicy,
    executionContract,
    notes: getPlanNotes(strategy, contextPackage, inputPolicy),
  };
}
