/**
 * GenTab Coding Agent Service
 *
 * Philosophy shift: GenTab is no longer a "data structuring" agent that fills
 * in table rows. It is a creative frontend developer that reads what the user
 * is browsing and builds a bespoke, interactive HTML mini-app for that task.
 *
 * The agent outputs a single self-contained HTML file. No block DSL. No
 * renderer config. No preferred-type toggle. The AI decides the shape.
 *
 * Pipeline:
 *   buildCodingGenTabPrompt()        →  rich creative brief fed to LLM
 *   runLocalAgentTurn() [pass 1]     →  LLM produces { title, intent, designChoice, html }
 *   normalizeCodingGenTabResult()    →  validate output
 *   buildCodingGenTabVerifyPrompt()  →  QA brief: check data accuracy + interactivity
 *   runLocalAgentTurn() [pass 2]     →  { ok: true } or { ok: false, html: fixedHtml }
 *   normalizeCodingGenTabVerifyResult() → use fixed HTML if available, else original
 *   persist to GenTabStore
 */

import { getGenTabLanguageInstruction } from "../../shared/localization.mjs";
import { extractJsonFromOutput } from "./GenTabGenerationService.mjs";

// ---------------------------------------------------------------------------
// Context rendering helpers (mirrors GenTabGenerationService patterns)
// ---------------------------------------------------------------------------

function sanitize(value, maxLen = 800) {
  const s = `${value ?? ""}`.trim();
  return s.length > maxLen ? `${s.slice(0, maxLen)}…[已截断，原文 ${s.length} 字符]` : s;
}

/** Strip fences + find boundaries + JSON.parse. Returns parsed object or null. */
function parseJsonOutput(raw) {
  const text = `${raw ?? ""}`.trim();
  if (!text) return null;
  try {
    return JSON.parse(extractJsonFromOutput(text));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared prompt building blocks
// ---------------------------------------------------------------------------

/**
 * Must be the FIRST line of any prompt that requires strict JSON output.
 * The "consequence" framing reduces format violations significantly.
 */
const JSON_OUTPUT_CONSTRAINT =
  `CRITICAL: 只输出 JSON 对象。任何额外内容（markdown 代码块、解释文字、注释行）都会导致解析失败，输出将被完全丢弃。`;

const SINGLE_TURN_CONSTRAINT =
  `你只有一次输出机会，必须在这次输出里完成全部工作。`;

const NO_PLACEHOLDER_RULE =
  `**禁止占位符**：不允许出现 TODO、[INSERT]、"示例"、"sample"、"placeholder"、"暂无" 等内容，全部替换为从网页内容中提取的真实数据。`;

const OFFLINE_SANDBOX_CONSTRAINT =
  `## 运行环境\n\n你在一个离线沙箱里。不能 fetch 外部 API，不能读写文件系统，不能依赖 localStorage。所有数据必须硬编码在 HTML 里。`;

/**
 * Truncate HTML while preserving both the head (structure/CSS) and tail
 * (closing tags/scripts). Slicing only from the front would break the DOM.
 */
function truncateHtml(html, maxChars = 40_000) {
  if (html.length <= maxChars) return html;
  const headChars = Math.floor(maxChars * 0.88);
  const tailChars = Math.floor(maxChars * 0.08);
  return (
    html.slice(0, headChars) +
    `\n\n<!-- [truncated — original ${html.length} chars, middle omitted] -->\n\n` +
    html.slice(-tailChars)
  );
}

/**
 * Extract numeric facts that are likely to be key data points:
 * prices, specs, ratings, dates.  Returns an array of short fact strings
 * (≤ 25 chars) de-duplicated, capped at 24 entries.
 */
function extractKeyFacts(text) {
  if (!text) return [];
  const patterns = [
    // Prices: ¥12,999 / $999.99 / €1,299 / £899
    /[¥$€£]\s*[\d,]+(?:\.\d+)?/g,
    // Chinese RMB written differently: 12999元 / 12,999元
    /[\d,]+(?:\.\d+)?\s*元/g,
    // Specs with units: 24GB / 4.0GHz / 500W / 4K / 144Hz / 0.1ms
    /\d+(?:\.\d+)?\s*(?:GB|TB|MB|KB|GHz|MHz|Hz|W|K|nm|ms|fps|FPS|MP|mAh|rpm|RPM)\b/gi,
    // Ratings/scores: 9.5分 / 4.8/5 / 98% / 4.8★
    /\d+(?:\.\d+)?\s*[分\/]\s*\d*(?:\s*[★☆])?/g,
    /\d+(?:\.\d+)?%/g,
    // Dates: 2024年3月15日 / 2024-03-15
    /\d{4}年\d{1,2}月(?:\d{1,2}日)?/g,
    /\d{4}-\d{2}-\d{2}/g,
  ];
  const seen = new Set();
  const facts = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const fact = match[0].replace(/\s+/g, "").trim();
      if (fact.length >= 2 && fact.length <= 25 && !seen.has(fact)) {
        seen.add(fact);
        facts.push(fact);
        if (facts.length >= 24) return facts;
      }
    }
  }
  return facts;
}

/**
 * Render one tab context into a compact markdown block.
 *
 * @param {object} ctx         — tab context snapshot
 * @param {number} index       — 0-based index
 * @param {string} customLabel — optional override for the ### header line
 */
function renderContextBlock(ctx, index, customLabel) {
  // Filter noise sections (nav, footer, cookie banners, copyright notices, etc.)
  const noiseTitles = /copyright|版权|©|cookie|隐私政策|terms of|服务条款|导航|footer|header/i;

  const parts = [
    customLabel ?? `### 网页 ${index + 1}`,
    `标题: ${sanitize(ctx.title ?? ctx.sourceTitle ?? "", 200)}`,
    `URL: ${sanitize(ctx.url ?? ctx.sourceUrl ?? "", 300)}`,
  ];

  const description =
    ctx.description ??
    ctx.og?.description ??
    ctx.metadata?.description ??
    "";
  if (description) parts.push(`简介: ${sanitize(description, 300)}`);

  // User-highlighted text has the highest signal — put it first
  const selectedText = ctx.selectedText ?? ctx.selection ?? "";
  if (selectedText) {
    parts.push(`\n**用户划选内容（高优先级）:**\n${sanitize(selectedText, 1_000)}`);
  }

  // Extract key numeric facts from all text sources on this page
  const allText = [
    ctx.textContent ?? ctx.text ?? ctx.contentText ?? "",
    ctx.bodyText ?? "",
    ...(Array.isArray(ctx.sections)
      ? ctx.sections.map(s => s.content ?? s.text ?? s.summary ?? "")
      : []),
  ].join(" ");
  const keyFacts = extractKeyFacts(allText);
  if (keyFacts.length > 0) {
    parts.push(`\n关键数值: ${keyFacts.join(" | ")}`);
  }

  // Content sections — filter out noise headings
  const sections = (Array.isArray(ctx.sections) ? ctx.sections : []).filter(
    s => !noiseTitles.test(s.title ?? s.heading ?? ""),
  );
  if (sections.length > 0) {
    parts.push("\n页面章节:");
    for (const section of sections.slice(0, 12)) {
      const heading = sanitize(section.title ?? section.heading ?? "", 100);
      const content = sanitize(section.content ?? section.text ?? section.summary ?? "", 600);
      if (heading || content) {
        parts.push(heading ? `**${heading}**\n${content}` : content);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Build the full context section string for prompts.
 * Injects today's date (zh-CN locale) and labels the first context as primary.
 */
function buildContextSection(contexts) {
  const list = Array.isArray(contexts) ? contexts : [];
  if (list.length === 0) return "无网页内容";

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const blocks = list
    .map((ctx, i) => {
      const label = i === 0 ? `### ⭐ 网页 1（主要来源）` : undefined;
      return renderContextBlock(ctx, i, label);
    })
    .join("\n\n---\n\n");

  return `> 当前日期：${today}\n\n${blocks}`;
}

// ---------------------------------------------------------------------------
// Shared tech spec — used by both code prompts
// ---------------------------------------------------------------------------

/**
 * Technical requirements shared across all HTML generation prompts.
 * Kept concise: instructions only, no rationale prose.
 */
const TECH_SPEC = `## 技术规格

- 单个完整 HTML 文件，CSS 和 JS 全部内联
- **禁止** Tailwind CDN、React、Vue、npm 依赖、fetch 请求、localStorage
- 允许的 CDN（按需）：Chart.js, Animate.css, Alpine.js, Google Fonts
- 200–400 行代码，Chromium 直接运行

## CSS 起手式（必须使用）

所有 HTML 文件的 <head> 必须包含以下 viewport meta 和 CSS 变量起手式，在此基础上自定义 --accent 颜色：

<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0d0d0d; --surface: #1a1a1a; --surface-2: #242424;
    --border: rgba(255,255,255,0.08);
    --text-1: rgba(255,255,255,0.9);
    --text-2: rgba(255,255,255,0.5);
    --text-3: rgba(255,255,255,0.3);
    --accent: #818cf8;           /* 根据内容主题自定义这个颜色 */
    --accent-glow: rgba(129,140,248,0.12);
    --radius: 12px;
    --font: 'Inter', -apple-system, system-ui, sans-serif;
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text-1); font-family: var(--font); min-height: 100vh; }
</style>

## 视觉调性

- 深色玻璃感，不是企业后台——有设计温度的产品
- 关键数字用 2rem+ 或 font-weight:700 突出，seconday 用 --text-2，muted 用 --text-3
- 至少一处 CSS transition 或 animation
- 所有可交互元素必须有 :hover/:active 反馈
- 页面首屏（不滚动时）必须有完整的核心内容，不能只有标题和大片空白

## 错误兜底

在 </body> 之前加入：
<script>window.onerror=function(m,s,l){document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;bottom:12px;left:12px;right:12px;padding:10px 14px;background:#2d1b1b;color:#f87171;border-radius:8px;font-size:12px;z-index:9999">⚠️ '+m+'</div>')}</script>`;

// ---------------------------------------------------------------------------
// Refinement prompt
// ---------------------------------------------------------------------------

/**
 * Refinement prompt — used when the user wants to tweak an existing GenTab.
 * Instead of regenerating from scratch, the agent receives the original HTML
 * and a single targeted instruction. The goal: minimal diff, maximal fidelity.
 *
 * @param {string} refinementText  — user's modification request
 * @param {string} originalHtml    — the existing HTML to refine
 * @param {Array}  contexts        — original page contexts (for data lookup)
 * @param {string} assistantLocale
 */
export function buildCodingGenTabRefinementPrompt(
  refinementText,
  originalHtml,
  contexts,
  assistantLocale = "zh-CN",
) {
  const normalizedRequest = sanitize(refinementText, 600);
  const contextSection = buildContextSection(contexts);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);
  const truncatedHtml = truncateHtml(originalHtml);

  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina 浏览器的 GenTab 优化引擎。${SINGLE_TURN_CONSTRAINT}

用户对一张已生成的 GenTab 提出了修改要求。你的唯一任务是**只做用户要求的修改**，保持原始设计的风格、结构和所有其他内容不变。

修改要求：「${normalizedRequest}」

---

## 规则

1. **最小改动** — 只改用户要求的部分，其余保留
2. **级联修复** — 如果改动导致 JS 变量引用断裂、CSS 选择器不匹配、或数据绑定断裂，必须一并修复
3. **风格冻结** — 保留原有的深色主题、字体、动画、交互逻辑
4. **数据来源** — 补充数据从"网页内容"提取，不能捏造
5. ${NO_PLACEHOLDER_RULE}

---

## 输出格式

直接输出 JSON 对象，字段说明：
- \`success\`: 固定为 true
- \`title\`: GenTab 标题（可与原来相同或略作调整，简短有力）
- \`intent\`: 一句话描述这张页面在帮用户做什么
- \`designChoice\`: 这次改了什么（设计师视角，一两句）
- \`html\`: 完整的修改后 HTML 字符串，所有双引号用 \\" 转义，换行用 \\n

{
  "success": true,
  "title": "...",
  "intent": "...",
  "designChoice": "...",
  "html": "..."
}

${langInstruction}

---

## 原始 HTML

\`\`\`html
${truncatedHtml}
\`\`\`

---

## 网页内容（如需补充数据可参考）

${contextSection}`;
}

// ---------------------------------------------------------------------------
// Plan prompt — fast first-pass to decide design form before writing code
// ---------------------------------------------------------------------------

/**
 * Short prompt for the planning turn. Goal: decide design form and interaction
 * in ~2-3 seconds before the full code generation turn.
 *
 * @param {string} userIntent
 * @param {Array}  contexts  — array of tab context snapshots
 * @param {string} assistantLocale
 */
export function buildCodingGenTabPlanPrompt(userIntent, contexts, assistantLocale = "zh-CN") {
  const normalizedIntent = sanitize(userIntent, 600) || "帮我用好这些网页";
  const contextSection = buildContextSection(contexts);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);

  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina GenTab 的设计规划师。${SINGLE_TURN_CONSTRAINT}

用户想创建一张交互网页，你需要快速决定最合适的设计方案。

用户的意图：「${normalizedIntent}」

---

## 你的任务

先判断数据本质属于哪一类，再选形式：

| 数据类型 | 特征 | 推荐形式 | 主交互 |
|---------|------|---------|-------|
| 对比型 | 2-5 个同类实体（商品、方案、选项） | 卡片对决 / 并排擂台 | 「帮我选」按钮，动画宣告胜者 |
| 时序型 | 有时间线、步骤、流程、日程 | 横向时间轴 / 进度条 | 点击节点展开详情 |
| 层级型 | 有分类、标签、多维属性 | 可翻转/折叠的卡片组 | 翻转、展开、切换标签 |
| 单体型 | 一个主体的详细规格（一个产品、一家餐厅） | 仪表盘 / 大数字英雄区 | 切换维度或数据视图 |
| 列表型 | 10+ 同质条目（新闻、搜索结果、评论） | 可搜索/可过滤的卡片流 | 实时搜索或标签过滤 |
| 叙事型 | 长文要点、知识总结、教程 | 知识卡片组 / 报纸版面 | 翻转展开、分页浏览 |

1. 从网页内容判断数据类型
2. 从上表选一个形式（或组合，但主交互只能有一个）
3. 用一句话描述：控件 + 交互动作 + 视觉结果

**不合格的 design（直接被系统拒绝）：**
- "展示信息" / "可视化数据" / "交互式页面"（无法编码）
- "让用户能够……"（说功能不说形态）
- 缺少三要素中的任何一个（控件名称、交互动作、视觉结果）

---

## 输出格式

直接输出 JSON 对象：

{
  "title": "GPU 擂台赛",
  "design": "三张对决卡片横排，底部一个「帮我选」按钮，点击后胜者放大+发光、败者半透明缩小",
  "layout": "header(标题) → cards-row(3张卡片 flex) → action-bar(按钮居中) → result-zone(胜者展示)",
  "accent": "#818cf8",
  "keyData": ["¥12999", "24GB", "450W"]
}

字段说明：
- \`title\`: 简短有力，不带 GenTab 字样
- \`design\`: 控件 + 交互动作 + 视觉结果，缺一不可
- \`layout\`: 从上到下的布局骨架，用 → 连接区块，括号内写区块内容
- \`accent\`: 推荐的主题强调色（hex），根据内容氛围选
- \`keyData\`: 3-5 个最关键的数值（价格优先、规格次之）

${langInstruction}

---

## 网页内容

${contextSection}`;
}

export function normalizeCodingGenTabPlan(rawText) {
  const text = `${rawText ?? ""}`.trim();
  if (!text) return null;

  // Stripping potential leading conversation before the first {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const cleanText = (firstBrace >= 0 && lastBrace > firstBrace)
    ? text.slice(firstBrace, lastBrace + 1)
    : text;

  const parsed = parseJsonOutput(cleanText);
  if (!parsed) return null;
  if (!parsed.design || typeof parsed.design !== "string" || !parsed.design.trim()) return null;
  return {
    title: sanitize(parsed.title ?? "", 120),
    design: sanitize(parsed.design, 400),
    layout: sanitize(parsed.layout ?? "", 300),
    accent: /^#[0-9a-f]{3,8}$/i.test(`${parsed.accent ?? ""}`.trim()) ? parsed.accent.trim() : "",
    keyData: Array.isArray(parsed.keyData)
      ? parsed.keyData.map((s) => sanitize(String(s ?? ""), 100)).filter(Boolean)
      : [],
  };
}

// ---------------------------------------------------------------------------
// The creative prompt
// ---------------------------------------------------------------------------

/**
 * This is the heart of the coding agent. The prompt tells the LLM to think
 * like a creative frontend developer — not a data formatter.
 *
 * It supports both a two-pass flow (plan provided) and a single-pass flow
 * (no plan provided, agent must plan internally).
 */
export function buildCodingGenTabPrompt(userIntent, contexts, assistantLocale = "zh-CN", plan = null) {
  const normalizedIntent = sanitize(userIntent, 600) || "帮我用好这些网页";
  const contextSection = buildContextSection(contexts);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);

  if (plan) {
    return buildCodingGenTabFromPlanPrompt(plan, normalizedIntent, contextSection, langInstruction);
  }

  // No plan — full creative brief with "Think-then-Code" instruction
  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina 浏览器的 GenTab 创作引擎。${SINGLE_TURN_CONSTRAINT}

你是一个有品味的前端创作者。用户打开了一些网页，你要创作一个**原创、可交互的迷你网页应用**。

用户的意图：「${normalizedIntent}」

---

## 创作方法

**第一步：在输出 HTML 之前，先在心里（或 JSON 的 designChoice 字段中）决定形式：**

| 数据类型 | 推荐形式 | 主交互 |
|---------|---------|-------|
| 对比型（2-5 个同类） | 卡片对决 / 擂台 | 「帮我选」动画宣告胜者 |
| 时序型（步骤/日程） | 横向时间轴 | 点击节点展开 |
| 层级型（分类/多维） | 可翻转/折叠卡片组 | 翻转、切换标签 |
| 单体型（一个主体） | 仪表盘 / 英雄区 | 切换维度 |
| 列表型（10+ 条目） | 可搜索卡片流 | 实时搜索或过滤 |
| 叙事型（长文要点） | 知识卡片 / 报纸版面 | 翻转展开 |

**第二步：一个主交互，只有一个**

用户打开就知道能做什么。**禁止**同页面多个独立控件组、隐藏菜单、多张不相关数据表。200–400 行代码。

**第三步：真实数据**

所有数据从网页内容提取。${NO_PLACEHOLDER_RULE}

如果数据量不足以支撑选定的设计，缩减设计适配数据（3 个产品就做 3 张卡片，不要凑 12 张）。

---

${OFFLINE_SANDBOX_CONSTRAINT}

---

${TECH_SPEC}

---

## 输出格式

直接输出 JSON 对象，字段说明：
- \`success\`: true
- \`title\`: GenTab 的标题（简短有力，描述这件事，不带 GenTab 字样）
- \`intent\`: 一句话，描述这张 GenTab 在帮用户做什么
- \`designChoice\`: 你选了什么形态？为什么？（一两句话，设计师视角，给用户看的）
- \`html\`: 完整的 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n

{
  "success": true,
  "title": "...",
  "intent": "...",
  "designChoice": "...",
  "html": "..."
}

如果网页内容不足以创作（如全是登录页、验证码等），返回：
{"success": false, "error": "说明原因"}

${langInstruction}

---

## 网页内容

${contextSection}`;
}

/**
 * Focused implementation prompt used when a plan is already decided.
 * ~40% shorter than the full creative brief — the LLM just implements a spec.
 */
function buildCodingGenTabFromPlanPrompt(plan, normalizedIntent, contextSection, langInstruction) {
  const keyDataLine = plan.keyData?.length
    ? plan.keyData.join(" / ")
    : "（从网页内容中提取）";
  // Escape quotes so plan.title (untrusted LLM output) can't corrupt the prompt JSON example
  const safeTitle = (plan.title || normalizedIntent).replace(/"/g, '\\"').replace(/`/g, "\\`");

  return `${JSON_OUTPUT_CONSTRAINT}

你现在只做一件事：按照下面的设计方案写代码。${SINGLE_TURN_CONSTRAINT}

---

## 任务

标题：${safeTitle}
形态与交互：**${plan.design}**${plan.layout ? `\n布局骨架：\`${plan.layout}\`` : ""}${plan.accent ? `\n主题色：\`--accent: ${plan.accent}\`` : ""}
关键数据：${keyDataLine}

严格按照上面的形态和布局实现，不要改方向。

---

## 数据要求

所有具体数值（价格、名称、日期、规格）**必须**从下方"网页内容"里提取，不能捏造。${NO_PLACEHOLDER_RULE}这张页面打开就是真实可用的。

---

${OFFLINE_SANDBOX_CONSTRAINT}

---

${TECH_SPEC}

---

## 输出格式

直接输出 JSON 对象，字段说明：
- \`success\`: 固定为 true
- \`title\`: "${safeTitle}"
- \`intent\`: 一句话描述这张页面在帮用户做什么
- \`designChoice\`: 实现了什么交互（一两句话，设计师视角）
- \`html\`: 完整的 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n

{
  "success": true,
  "title": "${safeTitle}",
  "intent": "...",
  "designChoice": "...",
  "html": "..."
}

${langInstruction}

---

## 网页内容

${contextSection}`;
}

// ---------------------------------------------------------------------------
// Output normalization
// ---------------------------------------------------------------------------

/**
 * Parse and validate the raw LLM output for a coding GenTab.
 * Returns a normalized CodingGenTabData object or null on failure.
 */
export function normalizeCodingGenTabResult(rawText, { sourceTabIds, userIntent } = {}) {
  const text = `${rawText ?? ""}`.trim();
  if (!text) return null;

  const parsed = parseJsonOutput(text) ?? rescueHtmlFromFreeformOutput(text);

  if (!parsed) return null;
  if (parsed.success === false) {
    return { success: false, error: sanitize(parsed.error, 300) };
  }

  const html = sanitize(parsed.html ?? "", 200_000); // 200k char limit
  if (!html || html.length < 100) return null;

  return {
    success: true,
    schemaVersion: "coding",
    type: "coding",
    title: sanitize(parsed.title ?? userIntent ?? "GenTab", 120),
    intent: sanitize(parsed.intent ?? userIntent ?? "", 300),
    designChoice: sanitize(parsed.designChoice ?? "", 400),
    html,
    metadata: {
      sourceTabIds: Array.isArray(sourceTabIds) ? sourceTabIds.filter(Boolean) : [],
      userIntent: sanitize(userIntent ?? "", 400),
      generatedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Verification prompt — second-pass self-critique
// ---------------------------------------------------------------------------

/**
 * After the first generation pass produces HTML, we feed it back to the agent
 * for a targeted QA pass. The verifier checks:
 *
 *  1. Data accuracy — does every number / name / date match the source pages?
 *  2. Interaction completeness — do interactive elements actually do something?
 *  3. No dead placeholders — no TODO, [INSERT], "示例" left in the final page
 *  4. JS runtime safety — no obvious syntax errors or missing variable refs
 *  5. Plan adherence — if a plan was provided, does the HTML implement it?
 *
 * Uses an <analysis> scratchpad to improve diagnosis quality before committing
 * to the final JSON output.
 *
 * If everything looks good → {"ok": true}
 * If fixable issues found → {"ok": false, "html": "...fixed complete HTML..."}
 *
 * @param {string} generatedHtml   — the HTML from the generation pass
 * @param {Array}  contexts        — original page context snapshots
 * @param {string} assistantLocale
 * @param {object|null} plan       — the plan from the planning turn (if available)
 */
export function buildCodingGenTabVerifyPrompt(generatedHtml, contexts, assistantLocale = "zh-CN", plan = null) {
  const contextSection = buildContextSection(contexts);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);
  const truncatedHtml = truncateHtml(generatedHtml);

  const planCheck = plan
    ? `5. **设计方案符合** — 设计方案要求"${sanitize(plan.design, 200)}"。检查 HTML 是否实现了这个形态。如果实现的是完全不同的形态（比如要求是卡片对决但做成了表格），需要重写。小的偏差（按钮文字不同、布局稍有变化）可以接受。`
    : "";

  const planSection = plan
    ? `\n## 设计方案（用于验证第 5 条）\n\n${sanitize(plan.design, 400)}\n`
    : "";

  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina GenTab 的 QA 工程师。${SINGLE_TURN_CONSTRAINT}一个 AI 刚刚生成了下面这段 HTML，你要帮它做最后一道自检。

---

## 检查步骤

**第一步：在 \`<analysis>\` 标签里做诊断**

逐条检查以下要点，把发现的问题列出来：

1. **数据准确** — 每一个具体数据（价格、名称、日期、规格）必须能在"原始网页内容"里找到依据。捏造的数据改正或去掉。
2. **交互可用** — 所有可点击元素必须绑定有效事件处理函数，点击后有可见反应。空函数体 \`function(){}\` 视为不可用。
3. **无占位符** — 不允许出现 TODO、[INSERT]、"示例"、"sample"、"placeholder"。替换为真实内容或删除。
4. **JS 无错** — 未定义变量、语法错误、空函数体。
${planCheck}
6. **首屏完整** — 不滚动时能看到核心内容（标题+主要数据+主交互），不能只有标题和大片空白。
7. **CSS 起手式** — 必须有 viewport meta 和 :root 变量（--bg, --text-1 等），必须有 onerror 兜底脚本。缺失则补上。

**第二步：根据诊断输出 JSON**

- 如果上述检查全部通过，或只有极小的不影响使用的问题 → 输出 \`{"ok": true}\`
- 如果发现需要修复的问题 → 修复后输出完整的修复后 HTML

---

## 输出格式

**必须**先写 \`<analysis>\` 诊断块（系统自动剥离，不占用输出），再紧跟 JSON。
即使全部通过也必须写，空 analysis 块不可接受。

<analysis>
1 数据准确：[结论]
2 交互可用：[结论]
3 无占位符：[结论]
4 JS 无错：[结论]
${planCheck ? `5 方案符合：[结论]\n` : ""}6 首屏完整：[结论]
7 CSS 起手式：[结论]
问题清单：[逐条列出，或"无"]
</analysis>

情况 A — 全部通过：
{"ok": true}

情况 B — 发现问题并已修复：
{
  "ok": false,
  "fixes": ["修复描述，每条一句话，如：价格 ¥999 改正为网页中的 ¥1299"],
  "html": "完整的修复后 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n"
}

${langInstruction}
${planSection}
---

## 生成的 HTML（待检查）

\`\`\`html
${truncatedHtml}
\`\`\`

---

## 原始网页内容（用于核对数据准确性）

${contextSection}`;
}

/**
 * Parse the verifier's response.
 * Strips <analysis> scratchpad before JSON parsing.
 * Returns:
 *   { ok: true }                          — pass, use original HTML
 *   { ok: false, html: string }           — fixed HTML available
 *   null                                  — unparseable, ignore and use original
 */
export function normalizeCodingGenTabVerifyResult(rawText) {
  const text = `${rawText ?? ""}`.trim();
  if (!text) return null;
  // Strip <analysis>...</analysis> scratchpad before JSON parsing
  const withoutAnalysis = text.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "").trim();
  const parsed = parseJsonOutput(withoutAnalysis);
  if (!parsed) return null;
  if (parsed.ok === true) return { ok: true };
  if (parsed.ok === false && typeof parsed.html === "string" && parsed.html.length > 100) {
    return { ok: false, html: parsed.html };
  }
  // ok:false but no usable html → treat as pass (don't break the user experience)
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HTML rescue helper
// ---------------------------------------------------------------------------

/**
 * Last-resort rescue: if the LLM forgot JSON and just wrote HTML, try to
 * extract it directly. Better to show something than nothing.
 */
function rescueHtmlFromFreeformOutput(text) {
  const htmlStart = text.search(/<(!DOCTYPE html|html)/i);
  const htmlEnd = text.lastIndexOf("</html>");
  if (htmlStart >= 0 && htmlEnd > htmlStart) {
    const html = text.slice(htmlStart, htmlEnd + 7);
    return { success: true, title: "GenTab", intent: "", designChoice: "", html };
  }
  return null;
}
