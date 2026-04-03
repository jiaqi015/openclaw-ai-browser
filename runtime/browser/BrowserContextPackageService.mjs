import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeTabIdList(tabIds) {
  return Array.from(
    new Set(
      (Array.isArray(tabIds) ? tabIds : [])
        .map((tabId) => normalizeNonEmptyString(tabId))
        .filter(Boolean),
    ),
  );
}

function getContextApproxChars(context) {
  const approxChars = Number(context?.extraction?.approxChars);
  if (Number.isFinite(approxChars) && approxChars > 0) {
    return approxChars;
  }

  return `${context?.contentText ?? ""}`.trim().length;
}

function isPrivateReachabilityHost(hostname) {
  if (!hostname) {
    return false;
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "[::1]"
  ) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    const [a, b] = hostname.split(".").map((value) => Number(value));
    return (
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }

  if (/^[a-z0-9-]+$/i.test(hostname) && !hostname.includes(".")) {
    return true;
  }

  return false;
}

function resolveSafeLocalFilePath(parsedUrl) {
  try {
    const localFilePath = fileURLToPath(parsedUrl);
    if (
      !path.isAbsolute(localFilePath) ||
      localFilePath.includes("\0") ||
      /[\r\n]/.test(localFilePath)
    ) {
      return "";
    }

    return existsSync(localFilePath) ? localFilePath : "";
  } catch {
    return "";
  }
}

export function normalizeBrowserSourceRoute(url) {
  const normalizedUrl = `${url ?? ""}`.trim();
  if (!normalizedUrl) {
    return {
      kind: "missing-url",
      label: "缺少可用 URL",
      canExecute: false,
      protocol: "",
      hostname: "",
      localFilePath: "",
    };
  }

  if (normalizedUrl === "about:blank") {
    return {
      kind: "internal-surface",
      label: "浏览器内部页",
      canExecute: false,
      protocol: "about:",
      hostname: "",
      localFilePath: "",
    };
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return {
      kind: "non-http",
      label: "非标准 URL",
      canExecute: false,
      protocol: "",
      hostname: "",
      localFilePath: "",
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  if (protocol === "http:" || protocol === "https:") {
    if (isPrivateReachabilityHost(hostname)) {
      return {
        kind: "private-http",
        label: "本机或私有 HTTP(S) 页面",
        canExecute: true,
        protocol,
        hostname,
        localFilePath: "",
      };
    }

    return {
      kind: "public-http",
      label: "公开 HTTP(S) 页面",
      canExecute: true,
      protocol,
      hostname,
      localFilePath: "",
    };
  }

  if (protocol === "file:") {
    const localFilePath = resolveSafeLocalFilePath(parsed);
    return {
      kind: "local-file",
      label: "本地文件页面",
      canExecute: Boolean(localFilePath),
      protocol,
      hostname,
      localFilePath,
    };
  }

  if (
    protocol === "sabrina:" ||
    protocol === "internal:" ||
    protocol === "devtools:" ||
    protocol === "chrome:"
  ) {
    return {
      kind: "internal-surface",
      label: "Sabrina 或浏览器内部页",
      canExecute: false,
      protocol,
      hostname,
      localFilePath: "",
    };
  }

  return {
    kind: "non-http",
    label: "非 HTTP(S) 页面",
    canExecute: false,
    protocol,
    hostname,
    localFilePath: "",
  };
}

function buildLossinessFlags(primary, references, missingReferenceTabIds) {
  const flags = new Set();

  if (primary?.extraction?.pageTruncated) {
    flags.add("primary-page-truncated");
  }
  if (primary?.extraction?.selectionTruncated) {
    flags.add("primary-selection-truncated");
  }
  if ((Array.isArray(missingReferenceTabIds) ? missingReferenceTabIds : []).length > 0) {
    flags.add("missing-references");
  }

  for (const entry of Array.isArray(references) ? references : []) {
    const context = entry?.context;
    if (!context) {
      continue;
    }
    if (context?.extraction?.pageTruncated) {
      flags.add("reference-page-truncated");
    }
    if (context?.extraction?.selectionTruncated) {
      flags.add("reference-selection-truncated");
    }
  }

  return Array.from(flags);
}

function getExecutionDescriptorKey(sourceKind) {
  if (sourceKind === "public-http") {
    return "publicHttp";
  }
  if (sourceKind === "private-http") {
    return "privateHttp";
  }
  if (sourceKind === "local-file") {
    return "localFile";
  }
  if (sourceKind === "internal-surface") {
    return "internalSurface";
  }
  if (sourceKind === "non-http") {
    return "nonHttp";
  }
  return "missingUrl";
}

function buildBrowserSourceExecutionDescriptor(params = {}) {
  const route = normalizeBrowserSourceRoute(params?.context?.url);
  let reachability = "unknown";
  let authBoundary = "none";
  let trustLevel = "private";
  let reproducibility = "not-guaranteed";
  let executionReliability = "low";
  let reachabilityConfidence = "low";
  let authBoundaryConfidence = "medium";
  let reproducibilityGuarantee = "weak";
  let outsideBrowserExecutable = false;
  let requiresBrowserSession = false;
  let requiresFilesystemAccess = false;

  if (route.kind === "public-http") {
    reachability = "reachable";
    authBoundary = "none";
    trustLevel = "public";
    reproducibility = "replayable";
    executionReliability = "high";
    reachabilityConfidence = "high";
    authBoundaryConfidence = "high";
    reproducibilityGuarantee = "strong";
    outsideBrowserExecutable = true;
  } else if (route.kind === "private-http") {
    reachability = "unknown";
    authBoundary = "private-origin";
    trustLevel = "private";
    reproducibility = "not-guaranteed";
    executionReliability = "medium";
    reachabilityConfidence = "medium";
    authBoundaryConfidence = "medium";
    reproducibilityGuarantee = "weak";
    requiresBrowserSession = true;
  } else if (route.kind === "local-file") {
    reachability = "unknown";
    authBoundary = "none";
    trustLevel = "local";
    reproducibility = "not-guaranteed";
    executionReliability = route.canExecute ? "medium" : "low";
    reachabilityConfidence = route.canExecute ? "medium" : "low";
    authBoundaryConfidence = "high";
    reproducibilityGuarantee = route.canExecute ? "weak" : "none";
    requiresFilesystemAccess = true;
  } else if (route.kind === "internal-surface") {
    reachability = "browser-only";
    authBoundary = "internal-only";
    trustLevel = "internal";
    reproducibility = "browser-only";
    executionReliability = "none";
    reachabilityConfidence = "high";
    authBoundaryConfidence = "high";
    reproducibilityGuarantee = "none";
    requiresBrowserSession = true;
  } else if (route.kind === "non-http") {
    reachability = "browser-only";
    authBoundary = "none";
    trustLevel = "private";
    reproducibility = "browser-only";
    executionReliability = "none";
    reachabilityConfidence = "medium";
    authBoundaryConfidence = "low";
    reproducibilityGuarantee = "none";
    requiresBrowserSession = true;
  } else if (route.kind === "missing-url") {
    reachability = "unknown";
    authBoundary = "none";
    trustLevel = "internal";
    reproducibility = "not-guaranteed";
    executionReliability = "none";
    reachabilityConfidence = "low";
    authBoundaryConfidence = "low";
    reproducibilityGuarantee = "none";
  }

  return {
    tabId: normalizeNonEmptyString(params?.tabId),
    role: params?.role === "reference" ? "reference" : "primary",
    sourceUrl: normalizeNonEmptyString(params?.context?.url),
    sourceKind: route.kind,
    sourceLabel: route.label,
    canExecute: Boolean(route.canExecute),
    sourceProtocol: route.protocol || "",
    sourceHost: route.hostname || "",
    sourceFilePath: route.localFilePath || "",
    reachability,
    authBoundary,
    trustLevel,
    reproducibility,
    executionReliability,
    reachabilityConfidence,
    authBoundaryConfidence,
    reproducibilityGuarantee,
    outsideBrowserExecutable,
    requiresBrowserSession,
    requiresFilesystemAccess,
  };
}

function buildBrowserExecutionSummary(descriptors = []) {
  const sourceKindCounts = {
    publicHttp: 0,
    privateHttp: 0,
    localFile: 0,
    internalSurface: 0,
    nonHttp: 0,
    missingUrl: 0,
  };

  let executableSourceCount = 0;
  let browserOnlySourceCount = 0;
  let replayableSourceCount = 0;
  let outsideBrowserExecutableCount = 0;
  let requiresBrowserSessionCount = 0;
  let requiresFilesystemAccessCount = 0;
  let deterministicReplayableCount = 0;

  for (const descriptor of descriptors) {
    if (!descriptor) {
      continue;
    }

    sourceKindCounts[getExecutionDescriptorKey(descriptor.sourceKind)] += 1;
    if (descriptor.canExecute) {
      executableSourceCount += 1;
    }
    if (descriptor.reachability === "browser-only") {
      browserOnlySourceCount += 1;
    }
    if (descriptor.reproducibility === "replayable") {
      replayableSourceCount += 1;
    }
    if (descriptor.outsideBrowserExecutable) {
      outsideBrowserExecutableCount += 1;
    }
    if (descriptor.requiresBrowserSession) {
      requiresBrowserSessionCount += 1;
    }
    if (descriptor.requiresFilesystemAccess) {
      requiresFilesystemAccessCount += 1;
    }
    if (descriptor.reproducibilityGuarantee === "strong") {
      deterministicReplayableCount += 1;
    }
  }

  return {
    totalSourceCount: descriptors.length,
    executableSourceCount,
    browserOnlySourceCount,
    replayableSourceCount,
    outsideBrowserExecutableCount,
    requiresBrowserSessionCount,
    requiresFilesystemAccessCount,
    deterministicReplayableCount,
    sourceKindCounts,
  };
}

export function buildBrowserContextExecution(
  primary,
  references = [],
  missingReferenceTabIds = [],
) {
  const lossinessFlags = buildLossinessFlags(
    primary,
    references,
    missingReferenceTabIds,
  );
  const sourceDescriptors = [
    buildBrowserSourceExecutionDescriptor({
      tabId: "",
      role: "primary",
      context: primary,
    }),
    ...(Array.isArray(references) ? references : []).map((entry) =>
      buildBrowserSourceExecutionDescriptor({
        tabId: entry?.tabId,
        role: "reference",
        context: entry?.context,
      }),
    ),
  ].filter(Boolean);
  const primaryDescriptor = sourceDescriptors[0] ?? null;

  return {
    primarySourceKind: primaryDescriptor?.sourceKind || "missing-url",
    primarySourceLabel: primaryDescriptor?.sourceLabel || "缺少可用 URL",
    canExecute: Boolean(primaryDescriptor?.canExecute),
    sourceProtocol: primaryDescriptor?.sourceProtocol || "",
    sourceHost: primaryDescriptor?.sourceHost || "",
    sourceFilePath: primaryDescriptor?.sourceFilePath || "",
    reachability: primaryDescriptor?.reachability || "unknown",
    authBoundary: primaryDescriptor?.authBoundary || "none",
    trustLevel: primaryDescriptor?.trustLevel || "private",
    reproducibility: primaryDescriptor?.reproducibility || "not-guaranteed",
    executionReliability: primaryDescriptor?.executionReliability || "low",
    reachabilityConfidence: primaryDescriptor?.reachabilityConfidence || "low",
    authBoundaryConfidence: primaryDescriptor?.authBoundaryConfidence || "low",
    reproducibilityGuarantee:
      primaryDescriptor?.reproducibilityGuarantee || "weak",
    outsideBrowserExecutable: Boolean(primaryDescriptor?.outsideBrowserExecutable),
    requiresBrowserSession: Boolean(primaryDescriptor?.requiresBrowserSession),
    requiresFilesystemAccess: Boolean(primaryDescriptor?.requiresFilesystemAccess),
    lossinessFlags,
    sources: sourceDescriptors,
    summary: buildBrowserExecutionSummary(sourceDescriptors),
  };
}

export function normalizeReferenceTabIds(activeTabId, referenceTabIds) {
  const normalizedActiveTabId = normalizeNonEmptyString(activeTabId);
  return Array.from(
    new Set(
      (Array.isArray(referenceTabIds) ? referenceTabIds : [])
        .map((tabId) => normalizeNonEmptyString(tabId))
        .filter((tabId) => tabId && tabId !== normalizedActiveTabId),
    ),
  );
}

export function getContextPackageSourceTabIds(contextPackage) {
  const explicitSourceTabIds = normalizeTabIdList(contextPackage?.sourceTabIds);
  if (explicitSourceTabIds.length > 0) {
    return explicitSourceTabIds;
  }

  return normalizeTabIdList([
    contextPackage?.sourceTabId,
    ...(Array.isArray(contextPackage?.references)
      ? contextPackage.references.map((entry) => entry?.tabId)
      : []),
  ]);
}

export async function buildBrowserContextPackage(params = {}, dependencies = {}) {
  const activeTabId = normalizeNonEmptyString(params?.activeTabId);
  const getContextSnapshotForTab = dependencies?.getContextSnapshotForTab;

  if (!activeTabId) {
    throw new Error("当前没有可用标签页，暂时无法提取网页上下文。");
  }

  if (typeof getContextSnapshotForTab !== "function") {
    throw new Error("上下文提取器暂未就绪。");
  }

  const primary = await getContextSnapshotForTab(activeTabId);
  const requestedReferenceTabIds = normalizeReferenceTabIds(
    activeTabId,
    params?.referenceTabIds,
  );

  const referenceResults = await Promise.all(
    requestedReferenceTabIds.map(async (tabId) => {
      try {
        const context = await getContextSnapshotForTab(tabId);
        return { tabId, context };
      } catch {
        return { tabId, context: null };
      }
    }),
  );

  const references = referenceResults
    .filter((entry) => entry?.context)
    .map((entry) => ({
      tabId: entry.tabId,
      context: entry.context,
    }));
  const missingReferenceTabIds = referenceResults
    .filter((entry) => !entry?.context)
    .map((entry) => entry.tabId);
  const totalApproxChars = references.reduce(
    (sum, entry) => sum + getContextApproxChars(entry.context),
    getContextApproxChars(primary),
  );

  return {
    sourceTabId: activeTabId,
    capturedAt: new Date().toISOString(),
    selectionState: primary?.selectedText ? "selection" : "page",
    primary,
    references,
    requestedReferenceTabIds,
    missingReferenceTabIds,
    execution: buildBrowserContextExecution(
      primary,
      references,
      missingReferenceTabIds,
    ),
    stats: {
      referenceCount: references.length,
      missingReferenceCount: missingReferenceTabIds.length,
      totalApproxChars,
    },
  };
}

export async function buildBrowserContextPackageFromTabSet(
  params = {},
  dependencies = {},
) {
  const sourceTabIds = normalizeTabIdList(params?.tabIds);
  if (sourceTabIds.length === 0) {
    throw new Error("请至少提供一个来源标签页。");
  }

  const [activeTabId, ...referenceTabIds] = sourceTabIds;
  const contextPackage = await buildBrowserContextPackage(
    {
      activeTabId,
      referenceTabIds,
    },
    dependencies,
  );

  return {
    ...contextPackage,
    sourceTabIds,
  };
}
