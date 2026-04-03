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

function getExecutionPlanStrategy(intentType, actionPayload = {}) {
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
    selectionState: contextPackage?.selectionState === "selection" ? "selection" : "page",
    totalSourceCount: Number(summary?.totalSourceCount) || 0,
    executableSourceCount: Number(summary?.executableSourceCount) || 0,
    browserOnlySourceCount: Number(summary?.browserOnlySourceCount) || 0,
    replayableSourceCount: Number(summary?.replayableSourceCount) || 0,
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
    compatibilitySource: normalizeNonEmptyString(inputPlan?.compatibilitySource),
    inputMode: normalizeNonEmptyString(inputPlan?.inputMode),
    supportedSourceKinds: normalizeStringArray(inputPlan?.supportedSourceKinds),
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

function getPlanNotes(strategy, contextPackage, inputPolicy) {
  const notes = [];
  const sourceKind = normalizeNonEmptyString(
    contextPackage?.execution?.primarySourceKind,
  );
  const lossinessFlags = normalizeStringArray(contextPackage?.execution?.lossinessFlags);

  if (strategy === "strict_skill_execution" && sourceKind) {
    notes.push(`browser-source-kind:${sourceKind}`);
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

  return {
    turnType: normalizedIntentType,
    strategy,
    policyDecision,
    browserContext,
    skillPolicy,
    inputPolicy,
    notes: getPlanNotes(strategy, contextPackage, inputPolicy),
  };
}
