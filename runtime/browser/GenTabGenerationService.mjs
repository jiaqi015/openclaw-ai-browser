import { getGenTabLanguageInstruction } from "../../shared/localization.mjs";
import { getContextPackageSourceTabIds } from "./BrowserContextPackageService.mjs";

export function buildGenTabPrompt(
  userIntent,
  contextPackageOrContexts,
  preferredType,
  assistantLocale = "zh-CN",
) {
  const normalizedIntent = sanitizeGenTabText(userIntent, 600) || "整理这些页面为结构化工作台";
  const normalizedPreferredType = normalizeGenTabPreferredType(preferredType);
  const normalizedInput = normalizeGenTabInput(contextPackageOrContexts);

  return `你是 Sabrina 的 GenTab 生成器。用户给你 ${normalizedInput.entries.length} 个已打开的网页，想做的事情是：“${normalizedIntent}”。

Sabrina 已经先把这些页面组织成一个带 provenance 的 Browser Context Package。你的任务不是重建网页现场，也不是写一段总结，而是基于这份工作包重组成一个适合继续工作的内部工作台。

输出必须是纯 JSON，不要解释，不要 markdown，不要代码块。严格返回：

{
  "success": boolean,
  "error"?: string,
  "gentab"?: {
    "schemaVersion": "2",
    "type": "table" | "list" | "timeline" | "comparison" | "card-grid",
    "title": string,
    "description"?: string,
    "summary"?: string,
    "insights"?: string[],
    "sections"?: [
      {
        "id": string,
        "title": string,
        "description"?: string,
        "bullets": string[]
      }
    ],
    "suggestedPrompts"?: string[],
    "sources"?: [
      {
        "url": string,
        "title": string,
        "host"?: string,
        "whyIncluded"?: string
      }
    ],
    "items": [
      {
        "id": string,
        "title": string,
        "description"?: string,
        "sourceUrl": string,
        "sourceTitle": string,
        "sourceTabId"?: string,
        "quote"?: string,
        "fields"?: Record<string, string>,
        "date"?: string
      }
    ]
  }
}

要求：
1. 每个 item 必须保留 sourceUrl 和 sourceTitle，方便回到原始网页验证。
2. 如果用户指定了偏好形态，请优先满足。当前偏好：${normalizedPreferredType === "auto" ? "自动判断最合适形态" : normalizedPreferredType}。
3. 如果是多对象比较，优先 table 或 comparison。
4. 如果是时间顺序、计划、事件演进，优先 timeline。
5. 如果是信息摘录、要点归纳，优先 list。
6. 如果是卡片式对象集合，优先 card-grid。
7. sections 要总结“如何看这组材料”，不是重复 items。
8. suggestedPrompts 要是用户接下来还可能继续让 Sabrina 调整工作台的自然语言。
9. sources 只保留最有代表性的来源，并说明为何纳入。
10. 只输出 JSON。
11. ${getGenTabLanguageInstruction(assistantLocale)}
12. 如果 Browser Context Package 标记了缺失引用页，请不要假装看到了它们的内容。
13. 【Live Cells 字段】每个 item 必须尽量填写 sourceTabId（从下方 provenance 里对应网页的"来源标签页 ID"复制），以及 quote（从该网页原文中摘取 30-120 字、最能支撑该 item 结论的连续原文片段，严禁改写或翻译原文）。这两个字段是支撑单元格活性追踪的关键，若确实无法取到请省略，不要编造。

Browser Context Package provenance：
- 来源标签页：${normalizedInput.sourceTabIds.length > 0 ? normalizedInput.sourceTabIds.join(", ") : "未知"}
- 选择状态：${normalizedInput.selectionState === "selection" ? "包含选中文本" : "整页上下文"}
- 请求的引用页：${normalizedInput.requestedReferenceTabIds.length}
- 缺失的引用页：${normalizedInput.missingReferenceTabIds.length}
- 近似字符量：${normalizedInput.totalApproxChars}
${normalizedInput.missingReferenceTabIds.length > 0 ? `- 缺失引用页 ID：${normalizedInput.missingReferenceTabIds.join(", ")}` : ""}
${renderGenTabExecutionSummary(normalizedInput)}

以下是网页材料：

${normalizedInput.entries.map(renderGenTabEntryBlock).join("\n\n")}`;
}

/**
 * Prompt for re-extracting a single GenTab item from a fresh page context.
 * Used by the Live Cells refresh flow so we don't have to regenerate the
 * entire GenTab when only one row's source has drifted.
 */
export function buildRefreshItemPrompt({
  item,
  context,
  userIntent,
  assistantLocale = "zh-CN",
}) {
  const itemSnapshot = JSON.stringify(
    {
      id: item?.id ?? "",
      title: item?.title ?? "",
      description: item?.description ?? "",
      fields: item?.fields ?? {},
      quote: item?.quote ?? "",
      date: item?.date ?? "",
    },
    null,
    2,
  );

  const pageBlock = [
    `标题: ${context?.title ?? ""}`,
    `URL: ${context?.url ?? ""}`,
    context?.leadText ? `导语: ${context.leadText}` : "",
    `正文:\n${context?.contentText ?? context?.contentPreview ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `你是 Sabrina 的 GenTab 单元格刷新器。用户当前 GenTab 的一行记录已经存在，你的任务是基于最新的源网页，重新抽取这一行同结构的字段。

用户对这个 GenTab 的总体意图是：“${sanitizeGenTabText(userIntent, 400) || "整理这些页面为结构化工作台"}”。

这是该行**原始**的结构（保持相同的 field key 集合，不要新增/删除列）：

${itemSnapshot}

这是这个条目绑定的源网页的**最新**内容：

${pageBlock}

输出必须是纯 JSON，不要解释，不要 markdown，不要代码块。严格返回：

{
  "success": boolean,
  "error"?: string,
  "item"?: {
    "id": string,
    "title": string,
    "description"?: string,
    "fields"?: Record<string, string>,
    "date"?: string,
    "quote"?: string
  }
}

要求：
1. id 必须与原始条目相同。
2. fields 的 key 必须完全等于原始条目的 key 集合；若某个 key 在新页面里确实查不到，请将该 key 的 value 设为 "—"（em dash）而不是删掉。
3. title/description 可以根据新页面微调，但不要偏离原 item 主题。
4. quote 必须从新页面原文中摘取 30-120 字连续原文，严禁改写或翻译。如果新页面已经完全不再包含相关内容，请返回 {"success": false, "error": "源页面已不再包含相关内容"}。
5. 如果新页面与这个条目的主题已经完全无关（例如跳转到登录页或 404），请返回 {"success": false, "error": "..."}。
6. ${getGenTabLanguageInstruction(assistantLocale)}
7. 只输出 JSON。`;
}

/**
 * Merge a freshly-extracted item back into the original, preserving fields
 * that the refresh prompt is not supposed to touch (sourceUrl, sourceTitle,
 * sourceTabId). Field keys are clamped to the original key set so a runaway
 * model can't change the table shape.
 */
export function normalizeRefreshedItem(rawItem, originalItem) {
  if (!rawItem || typeof rawItem !== "object" || !originalItem) {
    return null;
  }

  const originalFieldKeys = Object.keys(originalItem.fields ?? {});
  const nextFields = {};
  for (const key of originalFieldKeys) {
    const rawValue = rawItem?.fields?.[key];
    const normalized = sanitizeGenTabText(rawValue, 120);
    nextFields[key] = normalized || "—";
  }

  const rawQuote = typeof rawItem?.quote === "string" ? rawItem.quote.trim() : "";
  const quote = rawQuote ? rawQuote.slice(0, 600) : originalItem.quote;

  return {
    ...originalItem,
    // id must stay the same
    id: originalItem.id,
    title: sanitizeGenTabText(rawItem?.title, 120) || originalItem.title,
    description:
      sanitizeGenTabText(rawItem?.description, 240) || originalItem.description || undefined,
    date: sanitizeGenTabText(rawItem?.date, 80) || originalItem.date || undefined,
    fields: originalFieldKeys.length > 0 ? nextFields : originalItem.fields,
    quote,
    // provenance fields are never touched by the refresh prompt
    sourceUrl: originalItem.sourceUrl,
    sourceTitle: originalItem.sourceTitle,
    sourceTabId: originalItem.sourceTabId,
  };
}

export function extractJsonFromOutput(output) {
  output = `${output || ""}`.trim();
  const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }
  const curlyStart = output.indexOf("{");
  const curlyEnd = output.lastIndexOf("}");
  if (curlyStart >= 0 && curlyEnd >= 0 && curlyEnd > curlyStart) {
    return output.slice(curlyStart, curlyEnd + 1);
  }
  return output;
}

export function normalizeGeneratedGenTab(
  rawGentab,
  { sourceTabIds, userIntent, preferredType, contexts, contextPackage },
) {
  const normalizedInput = normalizeGenTabInput(contextPackage ?? contexts);
  const normalizedSourceTabIds = Array.isArray(sourceTabIds)
    ? sourceTabIds.filter(Boolean)
    : normalizedInput.sourceTabIds;
  const fallbackType =
    normalizeGenTabPreferredType(preferredType) === "auto"
      ? inferGenTabTypeFromEntries(normalizedInput.entries)
      : normalizeGenTabPreferredType(preferredType);

  const sources = normalizeGenTabSources(rawGentab?.sources, normalizedInput.entries);
  const items = normalizeGenTabItems(rawGentab?.items, sources, normalizedInput.entries);
  const sections = normalizeGenTabSections(rawGentab?.sections);

  return {
    schemaVersion: "2",
    type: normalizeGenTabType(rawGentab?.type, fallbackType),
    title:
      sanitizeGenTabText(rawGentab?.title, 120) ||
      buildFallbackGenTabTitle(userIntent, normalizedInput.entries),
    description: sanitizeGenTabText(rawGentab?.description, 280) || undefined,
    summary: sanitizeGenTabText(rawGentab?.summary, 600) || undefined,
    insights: normalizeStringArray(rawGentab?.insights, 8),
    sections,
    suggestedPrompts: normalizeStringArray(rawGentab?.suggestedPrompts, 6),
    sources,
    items,
    metadata: {
      sourceTabIds: normalizedSourceTabIds,
      requestedReferenceTabIds: normalizedInput.requestedReferenceTabIds,
      missingReferenceTabIds: normalizedInput.missingReferenceTabIds,
      selectionState: normalizedInput.selectionState,
      totalApproxChars: normalizedInput.totalApproxChars,
      userIntent: sanitizeGenTabText(userIntent, 400) || "整理这些页面为结构化工作台",
      generatedAt: new Date().toISOString(),
      preferredType: normalizeGenTabPreferredType(preferredType),
    },
  };
}

export function normalizeGenTabPreferredType(value) {
  if (
    value === "table" ||
    value === "list" ||
    value === "timeline" ||
    value === "comparison" ||
    value === "card-grid"
  ) {
    return value;
  }

  return "auto";
}

function sanitizeGenTabText(value, maxLength = 240) {
  const normalized = `${value ?? ""}`
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.slice(0, maxLength).trim();
}

function normalizeGenTabType(value, fallback = "comparison") {
  if (
    value === "table" ||
    value === "list" ||
    value === "timeline" ||
    value === "comparison" ||
    value === "card-grid"
  ) {
    return value;
  }

  return fallback;
}

function normalizeStringArray(values, maxItems = 6) {
  const seen = new Set();
  const normalized = [];

  for (const value of Array.isArray(values) ? values : []) {
    const nextValue = sanitizeGenTabText(value, 280);
    if (!nextValue || seen.has(nextValue)) {
      continue;
    }
    seen.add(nextValue);
    normalized.push(nextValue);
    if (normalized.length >= maxItems) {
      break;
    }
  }

  return normalized;
}

function normalizeSectionId(value, index) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || `section-${index + 1}`;
}

function normalizeGenTabSources(rawSources, entries) {
  const normalized = [];
  const seen = new Set();
  const inputSources =
    Array.isArray(rawSources) && rawSources.length > 0
      ? rawSources
      : entries.map((entry) => ({
          url: entry.url,
          title: entry.title,
          host: entry.host,
          whyIncluded: entry.leadText || entry.contentPreview,
        }));

  for (const source of inputSources) {
    const url = `${source?.url ?? ""}`.trim();
    const title = sanitizeGenTabText(source?.title, 140);
    if (!url || !title || seen.has(url)) {
      continue;
    }

    seen.add(url);
    normalized.push({
      url,
      title,
      host: sanitizeGenTabText(source?.host, 80) || inferSourceHost(url) || undefined,
      whyIncluded: sanitizeGenTabText(source?.whyIncluded, 220) || undefined,
    });
  }

  return normalized.slice(0, 8);
}

function normalizeGenTabItems(rawItems, sources, entries) {
  const items = [];
  const fallbackSource =
    sources[0] ||
    (entries[0]
      ? {
          url: entries[0].url,
          title: entries[0].title,
        }
      : null);

  // Build a lookup from URL -> provenance tabId so we can backfill sourceTabId
  // for items where the model forgot to echo it.
  const urlToTabId = new Map();
  for (const entry of entries) {
    if (entry?.url && entry?.tabId) {
      urlToTabId.set(entry.url, entry.tabId);
    }
  }

  for (const [index, item] of (Array.isArray(rawItems) ? rawItems : []).entries()) {
    const title = sanitizeGenTabText(item?.title, 120);
    if (!title) {
      continue;
    }

    const sourceUrl = `${item?.sourceUrl ?? fallbackSource?.url ?? ""}`.trim();
    const sourceTitle = sanitizeGenTabText(item?.sourceTitle, 120) || fallbackSource?.title || title;

    const fields = {};
    for (const [key, value] of Object.entries(item?.fields ?? {})) {
      const normalizedKey = sanitizeGenTabText(key, 40);
      const normalizedValue = sanitizeGenTabText(value, 120);
      if (!normalizedKey || !normalizedValue) {
        continue;
      }
      fields[normalizedKey] = normalizedValue;
    }

    const explicitTabId = `${item?.sourceTabId ?? ""}`.trim();
    const sourceTabId = explicitTabId || urlToTabId.get(sourceUrl) || undefined;
    // Keep the quote close to the original — only trim whitespace, don't
    // rewrite via sanitizeGenTabText which collapses newlines aggressively.
    const rawQuote = typeof item?.quote === "string" ? item.quote.trim() : "";
    const quote = rawQuote ? rawQuote.slice(0, 600) : undefined;

    items.push({
      id: `${item?.id ?? `item-${index + 1}`}`.trim() || `item-${index + 1}`,
      title,
      description: sanitizeGenTabText(item?.description, 240) || undefined,
      sourceUrl,
      sourceTitle,
      sourceTabId,
      quote,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
      date: sanitizeGenTabText(item?.date, 80) || undefined,
    });
  }

  if (items.length > 0) {
    return items.slice(0, 24);
  }

  return entries.slice(0, 8).map((entry, index) => ({
    id: `item-${index + 1}`,
    title: sanitizeGenTabText(entry.title, 120) || `来源页面 ${index + 1}`,
    description: sanitizeGenTabText(entry.leadText || entry.contentPreview, 220) || undefined,
    sourceUrl: entry.url,
    sourceTitle: sanitizeGenTabText(entry.title, 120) || entry.url,
    sourceTabId: entry.tabId || undefined,
    quote: undefined,
    fields:
      entry.headings?.length > 0
        ? {
            结构: entry.headings.slice(0, 3).join(" / "),
          }
        : undefined,
  }));
}

function normalizeGenTabSections(rawSections) {
  const sections = [];

  for (const [index, section] of (Array.isArray(rawSections) ? rawSections : []).entries()) {
    const title = sanitizeGenTabText(section?.title, 120);
    const bullets = normalizeStringArray(section?.bullets, 6);
    if (!title || bullets.length === 0) {
      continue;
    }

    sections.push({
      id: normalizeSectionId(section?.id, index),
      title,
      description: sanitizeGenTabText(section?.description, 220) || undefined,
      bullets,
    });
  }

  return sections.slice(0, 6);
}

function normalizeGenTabInput(input) {
  if (Array.isArray(input)) {
    const entries = input.map((context, index) => normalizeGenTabEntry(context, {
      role: index === 0 ? "primary" : "reference",
      tabId: "",
    }));
    return {
      entries,
      sourceTabIds: [],
      requestedReferenceTabIds: [],
      missingReferenceTabIds: [],
      selectionState: entries.some((entry) => entry.selectedText) ? "selection" : "page",
      totalApproxChars: entries.reduce((sum, entry) => sum + `${entry.contentText ?? ""}`.length, 0),
      executionSummary: null,
      executionSources: [],
    };
  }

  const primaryEntry = input?.primary
    ? normalizeGenTabEntry(input.primary, {
        role: "primary",
        tabId: `${input?.sourceTabId ?? ""}`.trim(),
      })
    : null;
  const referenceEntries = (Array.isArray(input?.references) ? input.references : [])
    .filter((entry) => entry?.context)
    .map((entry) =>
      normalizeGenTabEntry(entry.context, {
        role: "reference",
        tabId: `${entry?.tabId ?? ""}`.trim(),
      }),
    );
  const entries = [primaryEntry, ...referenceEntries].filter(Boolean);

  return {
    entries,
    sourceTabIds: getContextPackageSourceTabIds(input),
    requestedReferenceTabIds: Array.isArray(input?.requestedReferenceTabIds)
      ? input.requestedReferenceTabIds.filter(Boolean)
      : [],
    missingReferenceTabIds: Array.isArray(input?.missingReferenceTabIds)
      ? input.missingReferenceTabIds.filter(Boolean)
      : [],
    selectionState: input?.selectionState === "selection" ? "selection" : "page",
    totalApproxChars: Number(input?.stats?.totalApproxChars) > 0
      ? Number(input.stats.totalApproxChars)
      : entries.reduce((sum, entry) => sum + `${entry.contentText ?? ""}`.length, 0),
    executionSummary: normalizeGenTabExecutionSummary(input?.execution),
    executionSources: normalizeGenTabExecutionSources(input?.execution),
  };
}

function normalizeGenTabEntry(context, metadata = {}) {
  return {
    tabId: `${metadata?.tabId ?? ""}`.trim(),
    role: metadata?.role === "reference" ? "reference" : "primary",
    url: `${context?.url ?? ""}`.trim(),
    title: sanitizeGenTabText(context?.title, 160),
    host: sanitizeGenTabText(context?.hostname ?? context?.host, 80),
    leadText: sanitizeGenTabText(context?.leadText, 600),
    headings: Array.isArray(context?.headings)
      ? context.headings.map((value) => sanitizeGenTabText(value, 120)).filter(Boolean)
      : [],
    sections: Array.isArray(context?.sections)
      ? context.sections
          .map((section) => ({
            title: sanitizeGenTabText(section?.title, 120),
            summary: sanitizeGenTabText(section?.summary, 240),
          }))
          .filter((section) => section.title || section.summary)
      : [],
    contentPreview: sanitizeGenTabText(context?.contentPreview, 1200),
    contentText: sanitizeGenTabText(context?.contentText, 12000),
    selectedText: sanitizeGenTabText(context?.selectedText, 1600),
  };
}

function renderGenTabEntryBlock(entry, index) {
  const headingBlock = entry.headings.length > 0 ? entry.headings.join(" | ") : "无明显标题结构";
  const sectionBlock =
    entry.sections.length > 0
      ? entry.sections
          .map((section) => `- ${section.title || "未命名章节"}: ${section.summary || "暂无摘要"}`)
          .join("\n")
      : "- 暂无章节摘要";

  return [
    `--- 网页 ${index + 1}${entry.role === "primary" ? "（主来源页）" : "（引用页）"}`,
    entry.tabId ? `来源标签页 ID：${entry.tabId}` : "",
    `标题: ${entry.title}`,
    `URL: ${entry.url}`,
    `Host: ${entry.host}`,
    entry.selectedText ? `选中文本:\n${entry.selectedText}` : "",
    `导语: ${entry.leadText || "暂无导语"}`,
    `标题结构: ${headingBlock}`,
    `章节摘要:\n${sectionBlock}`,
    `正文摘录:\n${entry.contentText || "暂无正文摘录"}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeGenTabExecutionSummary(execution) {
  if (!execution || typeof execution !== "object") {
    return null;
  }

  return {
    primarySourceKind: sanitizeGenTabText(execution?.primarySourceKind, 60),
    authBoundary: sanitizeGenTabText(execution?.authBoundary, 60),
    trustLevel: sanitizeGenTabText(execution?.trustLevel, 60),
    reproducibility: sanitizeGenTabText(execution?.reproducibility, 60),
    totalSourceCount: Number(execution?.summary?.totalSourceCount) || 0,
    executableSourceCount: Number(execution?.summary?.executableSourceCount) || 0,
    browserOnlySourceCount: Number(execution?.summary?.browserOnlySourceCount) || 0,
    replayableSourceCount: Number(execution?.summary?.replayableSourceCount) || 0,
    sourceKindCounts:
      execution?.summary && typeof execution.summary === "object"
        ? {
            publicHttp: Number(execution.summary?.sourceKindCounts?.publicHttp) || 0,
            privateHttp: Number(execution.summary?.sourceKindCounts?.privateHttp) || 0,
            localFile: Number(execution.summary?.sourceKindCounts?.localFile) || 0,
            internalSurface: Number(execution.summary?.sourceKindCounts?.internalSurface) || 0,
            nonHttp: Number(execution.summary?.sourceKindCounts?.nonHttp) || 0,
            missingUrl: Number(execution.summary?.sourceKindCounts?.missingUrl) || 0,
          }
        : null,
  };
}

function normalizeGenTabExecutionSources(execution) {
  return Array.isArray(execution?.sources)
    ? execution.sources
        .map((source) => ({
          role: source?.role === "reference" ? "reference" : "primary",
          tabId: sanitizeGenTabText(source?.tabId, 60),
          sourceKind: sanitizeGenTabText(source?.sourceKind, 60),
          trustLevel: sanitizeGenTabText(source?.trustLevel, 60),
          authBoundary: sanitizeGenTabText(source?.authBoundary, 60),
          reproducibility: sanitizeGenTabText(source?.reproducibility, 60),
        }))
        .filter((source) => source.sourceKind)
    : [];
}

function renderGenTabExecutionSummary(input) {
  const summary = input?.executionSummary;
  if (!summary) {
    return "";
  }

  const kindCounts = summary.sourceKindCounts
    ? [
        `public-http=${summary.sourceKindCounts.publicHttp}`,
        `private-http=${summary.sourceKindCounts.privateHttp}`,
        `local-file=${summary.sourceKindCounts.localFile}`,
        `internal-surface=${summary.sourceKindCounts.internalSurface}`,
        `non-http=${summary.sourceKindCounts.nonHttp}`,
        `missing-url=${summary.sourceKindCounts.missingUrl}`,
      ].join(", ")
    : "";
  const sourceLines =
    Array.isArray(input?.executionSources) && input.executionSources.length > 0
      ? input.executionSources
          .map(
            (source, index) =>
              `- 来源 ${index + 1}${source.role === "primary" ? "（主来源页）" : "（引用页）"}: ${source.sourceKind}${source.tabId ? ` / ${source.tabId}` : ""}${source.trustLevel ? ` / trust=${source.trustLevel}` : ""}${source.authBoundary ? ` / auth=${source.authBoundary}` : ""}${source.reproducibility ? ` / replay=${source.reproducibility}` : ""}`,
          )
          .join("\n")
      : "";

  return [
    "Browser Context Package execution:",
    `- 主来源类型：${summary.primarySourceKind || "unknown"}`,
    `- 主来源鉴权边界：${summary.authBoundary || "unknown"}`,
    `- 主来源信任级别：${summary.trustLevel || "unknown"}`,
    `- 主来源可复现性：${summary.reproducibility || "unknown"}`,
    `- 来源总数：${summary.totalSourceCount}`,
    `- 可执行来源数：${summary.executableSourceCount}`,
    `- browser-only 来源数：${summary.browserOnlySourceCount}`,
    `- replayable 来源数：${summary.replayableSourceCount}`,
    kindCounts ? `- 来源类型统计：${kindCounts}` : "",
    sourceLines,
  ]
    .filter(Boolean)
    .join("\n");
}

function inferGenTabTypeFromEntries(entries) {
  const allText = entries
    .map((entry) =>
      [entry.title, entry.leadText, ...(Array.isArray(entry.headings) ? entry.headings : [])]
        .join(" ")
        .toLowerCase(),
    )
    .join(" ");

  if (/时间|日程|安排|历史|timeline|schedule|roadmap|发布|上线/.test(allText)) {
    return "timeline";
  }

  if (entries.length >= 3) {
    return "comparison";
  }

  return "list";
}

function buildFallbackGenTabTitle(userIntent, entries) {
  const intent = sanitizeGenTabText(userIntent, 28);
  if (intent) {
    return `${intent}工作台`;
  }

  const firstTitle = sanitizeGenTabText(entries?.[0]?.title, 24);
  return firstTitle ? `${firstTitle}工作台` : "新的 GenTab 工作台";
}

function inferSourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
