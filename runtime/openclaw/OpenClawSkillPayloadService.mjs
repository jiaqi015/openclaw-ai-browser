import {
  getDeclaredBrowserSkillCompatibility,
  normalizeNonEmptyString,
} from "./BrowserSkillCapabilityService.mjs";

function normalizeInstallEntries(install) {
  return Array.isArray(install)
    ? install
        .map((entry) => ({
          id: normalizeNonEmptyString(entry?.id),
          kind: normalizeNonEmptyString(entry?.kind),
          label: normalizeNonEmptyString(entry?.label),
          bins: Array.isArray(entry?.bins)
            ? entry.bins.filter((value) => typeof value === "string" && value.trim())
            : [],
        }))
        .filter((entry) => entry.id || entry.label)
    : [];
}

export function normalizeOpenClawSkillPayload(rawSkill = {}) {
  const name =
    normalizeNonEmptyString(rawSkill?.name) ||
    normalizeNonEmptyString(rawSkill?.skillKey);

  return {
    name,
    skillKey: normalizeNonEmptyString(rawSkill?.skillKey) || name,
    displayName:
      normalizeNonEmptyString(rawSkill?.displayName) ||
      normalizeNonEmptyString(rawSkill?.display_name) ||
      undefined,
    description: normalizeNonEmptyString(rawSkill?.description),
    eligible: Boolean(rawSkill?.eligible),
    disabled: Boolean(rawSkill?.disabled),
    blockedByAllowlist: Boolean(rawSkill?.blockedByAllowlist),
    source: normalizeNonEmptyString(rawSkill?.source),
    bundled: Boolean(rawSkill?.bundled),
    emoji: normalizeNonEmptyString(rawSkill?.emoji) || undefined,
    homepage: normalizeNonEmptyString(rawSkill?.homepage) || undefined,
    declaredBrowserCapability: getDeclaredBrowserSkillCompatibility(rawSkill),
    missing:
      rawSkill?.missing && typeof rawSkill.missing === "object" ? rawSkill.missing : {},
    filePath: normalizeNonEmptyString(rawSkill?.filePath),
    baseDir: normalizeNonEmptyString(rawSkill?.baseDir),
    install: normalizeInstallEntries(rawSkill?.install),
  };
}
