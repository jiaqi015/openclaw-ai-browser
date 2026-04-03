import {
  describeBrowserSkillCompatibility,
} from "./BrowserSkillInputPolicyService.mjs";
import { normalizeOpenClawSkillPayload } from "./OpenClawSkillPayloadService.mjs";
import {
  SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION,
} from "../../packages/sabrina-protocol/index.mjs";

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
  const normalizedPayload = normalizeOpenClawSkillPayload(rawSkill);
  const missingReasons = flattenMissingReasons(normalizedPayload.missing);
  const blockedByAllowlist = Boolean(normalizedPayload.blockedByAllowlist);
  const declaredBrowserCapability = normalizedPayload.declaredBrowserCapability;
  const browserCompatibility = describeBrowserSkillCompatibility(normalizedPayload);
  const browserCapability = {
    inputMode: browserCompatibility.inputMode,
    sourceKinds: browserCompatibility.sourceKinds,
    useHint: browserCompatibility.useHint,
    source: browserCompatibility.source,
    overlay: browserCompatibility.source === "sabrina-overlay",
  };

  return {
    name: normalizedPayload.name,
    displayName: normalizedPayload.displayName,
    description: normalizedPayload.description,
    eligible: Boolean(normalizedPayload.eligible),
    ready:
      Boolean(normalizedPayload.eligible) &&
      !Boolean(normalizedPayload.disabled) &&
      !blockedByAllowlist &&
      missingReasons.length === 0,
    disabled: Boolean(normalizedPayload.disabled),
    blockedByAllowlist,
    source: normalizedPayload.source,
    bundled: Boolean(normalizedPayload.bundled),
    emoji: normalizedPayload.emoji,
    homepage: normalizedPayload.homepage,
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
    filePath: normalizedPayload.filePath || "",
    baseDir: normalizedPayload.baseDir || "",
    install: normalizedPayload.install,
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
    browserCapabilitySchemaVersion: SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION,
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
    capabilitySourceCounts: {
      declared: entries.filter((skill) => skill.browserCapabilityDeclared).length,
      overlay: entries.filter((skill) => skill.browserCompatibilitySource === "sabrina-overlay")
        .length,
      heuristic: entries.filter((skill) => skill.browserCompatibilitySource === "heuristic")
        .length,
      metadata: entries.filter((skill) => skill.browserCompatibilitySource === "skill-metadata")
        .length,
    },
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
