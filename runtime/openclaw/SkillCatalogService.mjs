import {
  describeBrowserSkillCompatibility,
} from "./BrowserSkillInputPolicyService.mjs";
import { getDeclaredBrowserSkillCompatibility } from "./BrowserSkillCapabilityService.mjs";

function flattenMissingReasons(missing) {
  const labels = [];

  for (const value of [
    ...(Array.isArray(missing?.bins) ? missing.bins : []),
    ...(Array.isArray(missing?.anyBins) ? missing.anyBins : []),
    ...(Array.isArray(missing?.env) ? missing.env : []),
    ...(Array.isArray(missing?.config) ? missing.config : []),
    ...(Array.isArray(missing?.os) ? missing.os : []),
  ]) {
    if (typeof value === "string" && value.trim()) {
      labels.push(value.trim());
    }
  }

  return labels;
}

export function normalizeSkillMetadata(rawSkill) {
  const missingReasons = flattenMissingReasons(rawSkill?.missing);
  const blockedByAllowlist = Boolean(rawSkill?.blockedByAllowlist);
  const declaredBrowserCapability =
    getDeclaredBrowserSkillCompatibility(rawSkill);
  const browserCompatibility = describeBrowserSkillCompatibility(rawSkill);
  const browserCapability = {
    inputMode: browserCompatibility.inputMode,
    sourceKinds: browserCompatibility.sourceKinds,
    useHint: browserCompatibility.useHint,
    source: browserCompatibility.source,
    overlay: browserCompatibility.source === "sabrina-overlay",
  };

  return {
    name: `${rawSkill?.name ?? rawSkill?.skillKey ?? ""}`.trim(),
    displayName: `${rawSkill?.displayName ?? rawSkill?.display_name ?? ""}`.trim() || undefined,
    description: `${rawSkill?.description ?? ""}`.trim(),
    eligible: Boolean(rawSkill?.eligible),
    ready:
      Boolean(rawSkill?.eligible) &&
      !Boolean(rawSkill?.disabled) &&
      !blockedByAllowlist &&
      missingReasons.length === 0,
    disabled: Boolean(rawSkill?.disabled),
    blockedByAllowlist,
    source: `${rawSkill?.source ?? ""}`.trim(),
    bundled: Boolean(rawSkill?.bundled),
    emoji: `${rawSkill?.emoji ?? ""}`.trim() || undefined,
    homepage: `${rawSkill?.homepage ?? ""}`.trim() || undefined,
    declaredBrowserCapability,
    browserCapabilityDeclared: Boolean(declaredBrowserCapability),
    browserCapability,
    browserInputMode: browserCapability.inputMode,
    browserSourceKinds: browserCapability.sourceKinds,
    browserUseHint: browserCapability.useHint,
    browserCompatibilitySource: browserCapability.source,
    browserCompatibilityOverlay: browserCapability.overlay,
    missingSummary: missingReasons.join(" · "),
    missingReasons,
    filePath: `${rawSkill?.filePath ?? ""}`.trim() || "",
    baseDir: `${rawSkill?.baseDir ?? ""}`.trim() || "",
    install: Array.isArray(rawSkill?.install)
      ? rawSkill.install
          .map((entry) => ({
            id: `${entry?.id ?? ""}`.trim(),
            kind: `${entry?.kind ?? ""}`.trim(),
            label: `${entry?.label ?? ""}`.trim(),
            bins: Array.isArray(entry?.bins)
              ? entry.bins.filter((value) => typeof value === "string" && value.trim())
              : [],
          }))
          .filter((entry) => entry.id || entry.label)
      : [],
  };
}

export function toCatalogSkillEntry(rawSkill) {
  const normalized = normalizeSkillMetadata(rawSkill);

  return {
    name: normalized.name,
    displayName: normalized.displayName,
    description: normalized.description,
    eligible: normalized.eligible,
    ready: normalized.ready,
    disabled: normalized.disabled,
    blockedByAllowlist: normalized.blockedByAllowlist,
    source: normalized.source,
    bundled: normalized.bundled,
    emoji: normalized.emoji,
    homepage: normalized.homepage,
    declaredBrowserCapability: normalized.declaredBrowserCapability,
    browserCapabilityDeclared: normalized.browserCapabilityDeclared,
    browserCapability: normalized.browserCapability,
    browserInputMode: normalized.browserInputMode,
    browserSourceKinds: normalized.browserSourceKinds,
    browserUseHint: normalized.browserUseHint,
    browserCompatibilitySource: normalized.browserCompatibilitySource,
    browserCompatibilityOverlay: normalized.browserCompatibilityOverlay,
    missingSummary: normalized.missingSummary,
  };
}

export function buildSkillCatalogSummary(skills) {
  const entries = Array.isArray(skills) ? skills : [];
  return {
    total: entries.length,
    eligible: entries.filter((skill) => skill.eligible).length,
    ready: entries.filter((skill) => skill.ready).length,
    disabled: entries.filter((skill) => skill.disabled).length,
    blockedByAllowlist: entries.filter((skill) => skill.blockedByAllowlist).length,
    missingRequirements: entries.filter(
      (skill) =>
        !skill.ready &&
        !skill.disabled &&
        !skill.blockedByAllowlist &&
        Boolean(skill.missingSummary),
    ).length,
  };
}

export function sortSkillCatalogEntries(skills) {
  return [...(Array.isArray(skills) ? skills : [])].sort((left, right) => {
    if (left.ready !== right.ready) {
      return left.ready ? -1 : 1;
    }

    if (left.browserInputMode !== right.browserInputMode) {
      return left.browserInputMode === "page-snapshot" ? -1 : 1;
    }

    if (left.eligible !== right.eligible) {
      return left.eligible ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

export { flattenMissingReasons };
