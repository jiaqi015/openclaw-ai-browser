import {
  normalizeSabrinaBrowserCapabilityInputMode,
  normalizeSabrinaBrowserCapabilitySourceKinds,
  normalizeSabrinaCapabilitySource,
} from "../../packages/sabrina-protocol/index.mjs";

export function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getDefaultBrowserSourceKinds(inputMode) {
  return inputMode === "source-url" ? ["public-url", "private-url"] : [];
}

export function getDefaultBrowserUseHint(inputMode, sourceKinds = []) {
  if (inputMode !== "source-url") {
    return "这类 skill 可以直接消费 Sabrina 提供的页面快照、选区和引用页材料。";
  }

  const labels = [];
  if (sourceKinds.includes("public-url")) {
    labels.push("公开链接");
  }
  if (sourceKinds.includes("private-url")) {
    labels.push("本机/私有链接");
  }
  if (sourceKinds.includes("local-file")) {
    labels.push("本地文件");
  }

  const supportText = labels.length > 0 ? labels.join("、") : "URL 输入";
  return `这类 skill 主要处理可直接访问的 URL 或文件输入。当前浏览器策略会把 ${supportText} 当成主输入；遇到 internal surface、非 HTTP 页面或未声明支持的输入类型时，会显式拒绝，而不是把正文快照伪装成原始材料。`;
}

export function normalizeDeclaredBrowserCapabilityDescriptor(
  rawCapability = {},
  fallbackSkill = {},
) {
  const inputMode = normalizeSabrinaBrowserCapabilityInputMode(
    rawCapability?.inputMode ?? fallbackSkill?.browserInputMode,
  );
  if (!inputMode) {
    return null;
  }

  const sourceKinds = normalizeSabrinaBrowserCapabilitySourceKinds(
    rawCapability?.sourceKinds ??
      fallbackSkill?.browserSourceKinds ??
      fallbackSkill?.sourceKinds,
  );
  const normalizedSourceKinds =
    inputMode === "source-url" && sourceKinds.length > 0
      ? sourceKinds
      : getDefaultBrowserSourceKinds(inputMode);
  const source = normalizeSabrinaCapabilitySource(rawCapability?.source);

  return {
    inputMode,
    sourceKinds: normalizedSourceKinds,
    useHint:
      normalizeNonEmptyString(rawCapability?.useHint ?? fallbackSkill?.browserUseHint) ||
      getDefaultBrowserUseHint(inputMode, normalizedSourceKinds),
    source,
    overlay: source === "sabrina-overlay",
  };
}

export function getDeclaredBrowserSkillCompatibility(skill) {
  if (skill?.declaredBrowserCapability) {
    return normalizeDeclaredBrowserCapabilityDescriptor(skill.declaredBrowserCapability);
  }

  const explicitCapability = skill?.browserCapability;
  if (
    explicitCapability &&
    normalizeSabrinaBrowserCapabilityInputMode(explicitCapability.inputMode)
  ) {
    const explicitSource = normalizeSabrinaCapabilitySource(explicitCapability.source);
    if (explicitSource === "sabrina-overlay" || explicitSource === "heuristic") {
      return null;
    }

    return normalizeDeclaredBrowserCapabilityDescriptor(explicitCapability);
  }

  return normalizeDeclaredBrowserCapabilityDescriptor({}, skill);
}
