import { normalizeBrowserSourceRoute as normalizeSourceRoute } from "../browser/BrowserContextPackageService.mjs";
import {
  getDeclaredBrowserSkillCompatibility,
  getDefaultBrowserSourceKinds,
  getDefaultBrowserUseHint,
  normalizeNonEmptyString,
} from "./BrowserSkillCapabilityService.mjs";
import { getBrowserSkillRegistryEntry } from "./BrowserSkillRegistry.mjs";

const SOURCE_URL_DESCRIPTION_HINT =
  /\b(urls?|youtube|podcasts?|transcripts?|local files?)\b/i;

function getRequiredSourceKindForRoute(routeKind) {
  if (routeKind === "public-http") {
    return "public-url";
  }

  if (routeKind === "private-http") {
    return "private-url";
  }

  if (routeKind === "local-file") {
    return "local-file";
  }

  return "";
}

function buildUnsupportedSourceKindNote(sourceRoute, sourceKinds) {
  const supportedLabels = [];
  if (sourceKinds.includes("public-url")) {
    supportedLabels.push("公开链接");
  }
  if (sourceKinds.includes("private-url")) {
    supportedLabels.push("本机/私有链接");
  }
  if (sourceKinds.includes("local-file")) {
    supportedLabels.push("本地文件");
  }

  return `当前页面路由为“${sourceRoute.label}”，但这个 skill 当前只声明支持：${supportedLabels.join("、") || "无"}。`;
}

function buildSourceRouteNote(sourceRoute) {
  if (sourceRoute.kind === "public-http") {
    return "当前页面 URL 可以作为 URL-native skill 的直接输入。";
  }

  if (sourceRoute.kind === "private-http") {
    return "当前页面看起来是本机、内网或私有地址。Sabrina 会把它直接交给 URL-native skill，但如果 OpenClaw 当前执行环境无法访问、需要浏览器登录态、或只能在当前网络里打开，skill 必须显式失败，不能把页面快照伪装成抓取成功。";
  }

  if (sourceRoute.kind === "local-file") {
    return sourceRoute.localFilePath
      ? "当前页面是 file:// 本地文件。Sabrina 会把安全解析出的本地绝对路径直接交给明确支持本地文件输入的 skill；如果 OpenClaw 当前执行环境无法读取这个路径，skill 必须显式失败，不能把页面快照伪装成文件读取成功。"
      : "当前页面是 file:// 本地文件，但 Sabrina 现在无法把它安全解析成可交给 skill 的本地绝对路径。";
  }

  if (sourceRoute.kind === "internal-surface") {
    return "当前页面属于 Sabrina 或浏览器内部 surface，没有可以直接交给 URL-native skill 的外部网页 URL。";
  }

  if (sourceRoute.kind === "non-http") {
    return `当前页面使用 ${(sourceRoute.protocol || "").replace(/:$/, "") || "非 HTTP"} 协议，这类 URL 目前不会被 Sabrina 自动交给 URL-native skill。`;
  }

  return "当前页面没有可交给 URL-native skill 的来源地址。";
}

function inferBrowserSkillInputModeHeuristic(skill) {
  const description = `${skill?.description ?? ""}`.trim();
  if (description && SOURCE_URL_DESCRIPTION_HINT.test(description)) {
    return "source-url";
  }

  return "page-snapshot";
}

export function describeBrowserSkillCompatibility(skill) {
  const declaredCompatibility = getDeclaredBrowserSkillCompatibility(skill);
  if (declaredCompatibility) {
    return declaredCompatibility;
  }

  const registryEntry = getBrowserSkillRegistryEntry(skill);
  if (registryEntry) {
    const normalizedSourceKinds =
      registryEntry.inputMode === "source-url" && registryEntry.sourceKinds.length > 0
        ? registryEntry.sourceKinds
        : getDefaultBrowserSourceKinds(registryEntry.inputMode);
    return {
      inputMode: registryEntry.inputMode,
      sourceKinds: normalizedSourceKinds,
      useHint:
        registryEntry.useHint ||
        getDefaultBrowserUseHint(registryEntry.inputMode, normalizedSourceKinds),
      source: registryEntry.source,
    };
  }

  const inputMode = inferBrowserSkillInputModeHeuristic(skill);
  const sourceKinds = getDefaultBrowserSourceKinds(inputMode);

  return {
    inputMode,
    sourceKinds,
    useHint: getDefaultBrowserUseHint(inputMode, sourceKinds),
    source: "heuristic",
  };
}

export function resolveBrowserSkillInputPlan({ skill, context }) {
  const compatibility = describeBrowserSkillCompatibility(skill);
  const inputMode = compatibility.inputMode;
  const contextPackage = context?.execution ? context : null;
  const primaryContext = contextPackage?.primary ?? context ?? null;
  const sourceUrl = `${primaryContext?.url ?? ""}`.trim();

  const browserExecution = contextPackage?.execution ?? null;

  if (inputMode === "source-url") {
    const sourceRoute = browserExecution
      ? {
          kind: browserExecution.primarySourceKind || "missing-url",
          label: browserExecution.primarySourceLabel || "缺少可用 URL",
          canExecute:
            browserExecution.primarySourceKind === "public-http" ||
            browserExecution.primarySourceKind === "private-http" ||
            (browserExecution.primarySourceKind === "local-file" &&
              Boolean(browserExecution.sourceFilePath)),
          localFilePath: browserExecution.sourceFilePath || "",
          protocol: browserExecution.sourceProtocol || "",
        }
      : normalizeSourceRoute(sourceUrl);
    const requiredSourceKind = getRequiredSourceKindForRoute(sourceRoute.kind);
    const sourceKindSupported =
      !requiredSourceKind || compatibility.sourceKinds.includes(requiredSourceKind);
    const canExecute = sourceRoute.canExecute && sourceKindSupported;
    const sourceRouteNote = buildSourceRouteNote(sourceRoute);
    const routeNote = sourceKindSupported
      ? sourceRouteNote
      : buildUnsupportedSourceKindNote(sourceRoute, compatibility.sourceKinds);

    return {
      inputMode,
      sourceUrl,
      sourceFilePath:
        sourceKindSupported && sourceRoute.kind === "local-file"
          ? sourceRoute.localFilePath || ""
          : "",
      canExecute,
      useHint: compatibility.useHint,
      compatibilitySource: compatibility.source,
      supportedSourceKinds: compatibility.sourceKinds,
      sourceRoute: sourceRoute.kind,
      sourceRouteLabel: sourceRoute.label,
      routeNote,
      failureReason: canExecute
        ? ""
        : `OpenClaw skill ${skill?.name || "当前技能"} 主要处理 URL 或文件输入，但当前页面路由为“${sourceRoute.label}”。${routeNote} Sabrina 不会把浏览器正文快照伪装成这类 skill 的原始输入。`,
    };
  }

  return {
    inputMode,
    sourceUrl,
    sourceFilePath: "",
    canExecute: true,
    useHint: compatibility.useHint,
    compatibilitySource: compatibility.source,
    supportedSourceKinds: [],
    sourceRoute: "page-snapshot",
    sourceRouteLabel: "页面快照输入",
    routeNote: "当前 skill 直接消费 Sabrina 的页面快照与引用页材料。",
    failureReason: "",
  };
}

export { normalizeSourceRoute };
