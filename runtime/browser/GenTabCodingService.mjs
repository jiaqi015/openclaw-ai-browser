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

// ---------------------------------------------------------------------------
// Context rendering helpers (mirrors GenTabGenerationService patterns)
// ---------------------------------------------------------------------------

function sanitize(value, maxLen = 800) {
  const s = `${value ?? ""}`.trim();
  return s.length > maxLen ? `${s.slice(0, maxLen)}…[已截断，原文 ${s.length} 字符]` : s;
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

  // Description — check multiple field locations tests and real-world contexts use
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
  if (!contexts || contexts.length === 0) return "无网页内容";

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const header = `> 当前日期：${today}\n`;

  const blocks = contexts
    .map((ctx, i) => {
      const label = i === 0 ? `### ⭐ 网页 1（主要来源）` : undefined;
      return renderContextBlock(ctx, i, label);
    })
    .join("\n\n---\n\n");

  return header + "\n" + blocks;
}

// ---------------------------------------------------------------------------
// Shared tech spec — used by both code prompts
// ---------------------------------------------------------------------------

/**
 * Technical requirements shared across all HTML generation prompts.
 * Kept concise: instructions only, no rationale prose.
 */
const TECH_SPEC = `## 技术规格

- 输出：**单个完整 HTML 文件**，所有 CSS 和 JS 内联
- CSS 方案：**原生 CSS**（CSS 自定义属性 + flex/grid），不要用 Tailwind CDN
- 允许的外部资源（按需使用）：
  - Chart.js: \`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\`
  - Animate.css: \`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>\`
  - Alpine.js: \`<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>\`
  - Google Fonts: \`<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">\`
- 不允许：React、Vue、npm 依赖、外部 fetch 请求、localStorage 持久化
- 所有数据硬编码在 HTML/JS 里
- 深色主题：背景 \`#0d0d0d\` 或 \`#111111\`，文字用 rgba(255,255,255, 0.85/0.5/0.3) 三级层次
- 行数建议 200–500 行，追求质量不追求量
- 必须在 Chromium 里直接运行，无需构建步骤

## 视觉调性

- 深色玻璃感 UI，不是企业软件，是有设计意识的产品
- 关键信息大字号突出（价格/核心数字用 2rem+ 或 font-weight: 700）
- 至少一处 CSS transition 或 animation，让页面有生命感
- 按钮和可交互元素要有明确的 :hover/:active 反馈
- 文字层级清晰（primary rgba(255,255,255,0.9) / secondary 0.5 / muted 0.3）`;

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
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);
  const truncatedHtml = truncateHtml(originalHtml);

  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina 浏览器的 GenTab 优化引擎。${SINGLE_TURN_CONSTRAINT}

用户对一张已生成的 GenTab 提出了修改要求。你的唯一任务是**只做用户要求的修改**，保持原始设计的风格、结构和所有其他内容不变。

修改要求：「${normalizedRequest}」

---

## 规则

1. **最小改动原则** — 只改用户要求改的部分，其余一律保留
2. **风格冻结** — 保留原有的深色主题、字体、动画、交互逻辑
3. **数据来源** — 如果修改需要补充数据，从下方"网页内容"里提取，不能捏造
4. ${NO_PLACEHOLDER_RULE}

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
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);

  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina GenTab 的设计规划师。${SINGLE_TURN_CONSTRAINT}

用户想创建一张交互网页，你需要快速决定最合适的设计方案。

用户的意图：「${normalizedIntent}」

---

## 你的任务

用 2-3 秒思考：这件事最有表达力的形式是什么？选定一个主要交互。

几个参考方向（不是强制，是启发）：
- 三个商品比价 → 三张对决卡片 + 「帮我选」按钮，按下后动画宣告胜者
- 一篇长文要点 → 可以翻转/展开的知识卡片组
- 行程计划 → 有真实城市感的"旅程地图"时间轴
- 技术文档 → 可以交互演示的功能清单，带状态切换
- 新闻摘要 → 仿真的「今日版面」，有大小标题层级感

---

## 输出格式

直接输出 JSON 对象，字段说明：
- \`title\`: GenTab 标题（简短有力，不带 GenTab 字样）
- \`design\`: **必须具体** — 点名用了什么控件/布局，主要交互是什么
  - ✅ 好例子："三张对决卡片 + 「帮我选」按钮，按下后放大胜者并弱化败者"
  - ✅ 好例子："可横向滑动的时间轴，每个节点点击后展开详情卡片"
  - ❌ 坏例子："展示信息" / "可视化数据" / "交互式页面"（过于抽象）
- \`keyData\`: 从网页里提取的关键数据点（具体数值，如价格、规格、日期）

{
  "title": "...",
  "design": "...",
  "keyData": ["¥12999", "24GB 内存", "2024-03-15"]
}

${langInstruction}

---

## 网页内容

${contextSection}`;
}

/**
 * Parse the planner's response. Returns { title, design, keyData } or null.
 */
export function normalizeCodingGenTabPlan(rawText) {
  const text = `${rawText ?? ""}`.trim();
  if (!text) return null;
  try {
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    if (!parsed.design || typeof parsed.design !== "string" || !parsed.design.trim()) return null;
    return {
      title: sanitize(parsed.title ?? "", 120),
      design: sanitize(parsed.design, 400),
      keyData: Array.isArray(parsed.keyData)
        ? parsed.keyData.map((s) => sanitize(String(s ?? ""), 100)).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The creative prompt
// ---------------------------------------------------------------------------

/**
 * This is the heart of the coding agent. The prompt tells the LLM to think
 * like a creative frontend developer — not a data formatter. It should produce
 * opinionated, interactive HTML that has personality.
 *
 * @param {string} userIntent
 * @param {Array} contexts  — array of tab context snapshots
 * @param {string} assistantLocale
 * @param {object|null} plan  — optional plan from the planning turn
 */
export function buildCodingGenTabPrompt(userIntent, contexts, assistantLocale = "zh-CN", plan = null) {
  const normalizedIntent = sanitize(userIntent, 600) || "帮我用好这些网页";
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);

  // When a plan exists, use a focused implementation prompt — no creative thinking needed.
  // This is shorter, faster, and produces better output because the design is already decided.
  if (plan) {
    return buildCodingGenTabFromPlanPrompt(plan, normalizedIntent, contextSection, langInstruction);
  }

  // No plan — full creative brief (single-shot path, e.g. plan turn failed)
  return `${JSON_OUTPUT_CONSTRAINT}

你是 Sabrina 浏览器的 GenTab 创作引擎。${SINGLE_TURN_CONSTRAINT}

你不是一个信息汇总器，也不是一个数据表格生成器。你是一个有品味的前端创作者。用户打开了一些网页，你要为这件具体的事情创作一个**原创的、可以交互的迷你网页应用**。

用户的意图：「${normalizedIntent}」

---

## 创作思路（必读）

**第一步：想清楚这件事的"形"**

在写任何代码之前，先想：这些数据的本质是什么？最有表达力的形式是什么？

几个参考方向（不是强制，是启发）：
- 三个商品比价 → 不是三列表格，是一场"决斗"——三个选手卡片，一个「帮我选」按钮按下去用动画宣布胜者
- 一篇长文要点 → 不是 bullet list，是一张可以翻转/展开的知识卡片组
- 行程计划 → 不是日程表，是一张有真实城市感的"旅程地图"时间轴
- 技术文档 → 不是摘要段落，是可以交互演示的功能清单，带状态切换
- 新闻摘要 → 不是标题列表，是一张仿真的「今日版面」，有大小标题层级感

**第二步：选定一个主要交互**

一张 GenTab 只有一个"玩法"。用户打开就知道能做什么：
- 一个大按钮（「帮我选」「开始对比」「查看答案」）
- 一组可以点击/翻转/拖拽的卡片
- 一个实时过滤/搜索框
- 一个可以拖动的对比拉杆

**第三步：用真实数据**

所有具体数据（价格、名称、日期、规格、引语）都从我给你的网页内容里提取。${NO_PLACEHOLDER_RULE}这张 GenTab 打开就是真实可用的。

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

  return `${JSON_OUTPUT_CONSTRAINT}

你现在只做一件事：按照下面的设计方案写代码。${SINGLE_TURN_CONSTRAINT}

---

## 任务

标题：${plan.title || normalizedIntent}
形态与交互：**${plan.design}**
关键数据：${keyDataLine}

直接写代码，不要重新考虑设计。严格按照上面的形态实现，不要改方向。

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
- \`title\`: "${plan.title || normalizedIntent}"
- \`intent\`: 一句话描述这张页面在帮用户做什么
- \`designChoice\`: 实现了什么交互（一两句话，设计师视角）
- \`html\`: 完整的 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n

{
  "success": true,
  "title": "${plan.title || normalizedIntent}",
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

  // Try JSON extraction (reuses same logic as extractJsonFromOutput)
  let parsed = null;
  try {
    // Remove markdown code fences if present
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    // Find first { and last } to handle surrounding text
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(stripped.slice(start, end + 1));
    } else {
      // No JSON object found at all — try direct HTML rescue
      parsed = rescueHtmlFromFreeformOutput(text);
    }
  } catch {
    // JSON parse failed — try to rescue HTML if agent went rogue
    parsed = rescueHtmlFromFreeformOutput(text);
  }

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
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
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

1. **数据准确** — 页面里出现的每一个具体数据（价格、名称、日期、规格、引语）必须能在"原始网页内容"里找到依据。如果有捏造数据，把它改成正确的或去掉。
2. **交互可用** — 所有可点击元素（按钮、卡片、拖动条）必须绑定了有效的事件处理函数，点击后有可见反应。
3. **无占位符** — 不允许出现 TODO、[INSERT]、"示例"、"sample"、"placeholder" 等字眼。把它们替换成真实内容或删除。
4. **JS 无明显错误** — 检查是否有未定义变量、语法明显错误、或空函数体（function () {}）影响交互的情况。
${planCheck}

**第二步：根据诊断输出 JSON**

- 如果上述检查全部通过，或只有极小的不影响使用的问题 → 输出 \`{"ok": true}\`
- 如果发现需要修复的问题 → 修复后输出完整的修复后 HTML

---

## 输出格式

先写 \`<analysis>\` 诊断块（会被系统自动剥离），再紧跟 JSON：

<analysis>
[逐条写检查结论，发现的问题和修复计划]
</analysis>

情况 A — 没有问题：
{"ok": true}

情况 B — 发现问题并已修复：
{
  "ok": false,
  "fixes": ["修复了什么（一句话）"],
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
  try {
    // Strip <analysis>...</analysis> scratchpad before JSON parsing
    const withoutAnalysis = text.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "").trim();

    const stripped = withoutAnalysis
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    if (parsed.ok === true) return { ok: true };
    if (parsed.ok === false && typeof parsed.html === "string" && parsed.html.length > 100) {
      return { ok: false, html: parsed.html };
    }
    // ok:false but no usable html → treat as pass (don't break the user experience)
    return { ok: true };
  } catch {
    return null;
  }
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
