const BROWSER_SOURCE_KINDS = [
  "public-url",
  "private-url",
  "local-file",
];

export const SABRINA_BROWSER_SKILL_OVERLAY_SOURCE = "sabrina-overlay";

const BROWSER_SKILL_REGISTRY = new Map([
  [
    "summarize",
    {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint:
        "这类 skill 主要处理可直接访问的 URL 或文件输入。Sabrina 会把当前页面 URL 或安全解析出的本地文件路径当成主输入，而不是把正文快照伪装成原始材料；遇到 internal surface、非 HTTP 页面或仅浏览器内可见的页面时，会显式拒绝或要求改用页面快照型 skill。",
    },
  ],
]);

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function normalizeBrowserInputMode(value) {
  return value === "source-url" || value === "page-snapshot" ? value : "";
}

export function normalizeBrowserSourceKinds(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeNonEmptyString(value))
        .filter((value) => BROWSER_SOURCE_KINDS.includes(value)),
    ),
  );
}

export function getBrowserSkillRegistryEntry(skill) {
  const normalizedName = normalizeNonEmptyString(skill?.name ?? skill?.skillKey);
  if (!normalizedName) {
    return null;
  }

  const entry = BROWSER_SKILL_REGISTRY.get(normalizedName);
  if (!entry) {
    return null;
  }

  return {
    inputMode: entry.inputMode,
    sourceKinds: normalizeBrowserSourceKinds(entry.sourceKinds),
    useHint: normalizeNonEmptyString(entry.useHint),
    source: SABRINA_BROWSER_SKILL_OVERLAY_SOURCE,
  };
}

export function listRegisteredBrowserSkills() {
  return [...BROWSER_SKILL_REGISTRY.keys()];
}
