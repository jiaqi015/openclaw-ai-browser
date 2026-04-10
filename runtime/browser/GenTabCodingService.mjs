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
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function renderContextBlock(ctx, index) {
  const parts = [
    `### 网页 ${index + 1}`,
    `标题: ${sanitize(ctx.title ?? ctx.sourceTitle ?? "", 200)}`,
    `URL: ${sanitize(ctx.url ?? ctx.sourceUrl ?? "", 300)}`,
  ];
  if (ctx.leadText) parts.push(`导语: ${sanitize(ctx.leadText, 400)}`);
  if (ctx.selectedText) parts.push(`用户选中文字: ${sanitize(ctx.selectedText, 600)}`);
  if (ctx.headings?.length) {
    parts.push(`页面标题层级: ${ctx.headings.slice(0, 10).map((h) => h.text ?? h).join(" / ")}`);
  }
  const body = ctx.contentText ?? ctx.contentPreview ?? ctx.leadText ?? "";
  if (body) parts.push(`\n正文摘录:\n${sanitize(body, 2400)}`);
  return parts.filter(Boolean).join("\n");
}

function buildContextSection(contexts) {
  if (!contexts?.length) return "（无网页内容）";
  return contexts.map((ctx, i) => renderContextBlock(ctx, i)).join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// The creative prompt
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
  // Truncate original HTML for the prompt — keep it manageable
  const truncatedHtml = originalHtml.length > 40_000
    ? originalHtml.slice(0, 40_000) + "\n<!-- ... truncated ... -->"
    : originalHtml;

  return `你是 Sabrina 浏览器的 GenTab 优化引擎。用户对一张已生成的 GenTab 提出了修改要求。

你的任务：**只做用户要求的修改**，保持原始设计的风格、结构和所有其他内容不变。

修改要求：「${normalizedRequest}」

---

## 规则

1. 尽量做最小改动——只改用户要求改的部分
2. 保留原有的深色主题、字体、动画、交互逻辑
3. 如果修改需要补充数据，从下方"网页内容"里提取
4. 输出格式与原始生成完全一致

---

## 输出格式

只输出 JSON，不要解释文字，直接是 JSON 对象：

{
  "success": true,
  "title": "GenTab 标题（可以和原来一样或略作调整）",
  "intent": "一句话描述",
  "designChoice": "这次改了什么（设计师视角，一两句）",
  "html": "完整的修改后 HTML 字符串，所有双引号用 \\" 转义，换行用 \\n"
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

/**
 * This is the heart of the coding agent. The prompt tells the LLM to think
 * like a creative frontend developer — not a data formatter. It should produce
 * opinionated, interactive HTML that has personality.
 *
 * @param {string} userIntent
 * @param {Array} contexts  — array of tab context snapshots
 * @param {string} assistantLocale
 */
export function buildCodingGenTabPrompt(userIntent, contexts, assistantLocale = "zh-CN") {
  const normalizedIntent = sanitize(userIntent, 600) || "帮我用好这些网页";
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);

  return `你是 Sabrina 浏览器的 GenTab 创作引擎。你不是一个信息汇总器，也不是一个数据表格生成器。

你是一个有品味的前端创作者。用户打开了一些网页，你要为这件具体的事情创作一个**原创的、可以交互的迷你网页应用**。

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

所有具体数据（价格、名称、日期、规格、引语）都从我给你的网页内容里提取。不要留 TODO、不要留占位符。这张 GenTab 打开就是真实可用的。

---

## 技术规格

- 输出：**单个完整 HTML 文件**，所有 CSS 和 JS 内联或走 CDN
- 允许的 CDN 库：
  - Tailwind CSS: \`<script src="https://cdn.tailwindcss.com"></script>\`
  - Alpine.js: \`<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>\`
  - Chart.js: \`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\`
  - Animate.css: \`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>\`
- 不允许：React、Vue、npm 依赖、外部 fetch 请求、localStorage 持久化
- 所有数据硬编码在 HTML/JS 里
- 深色主题，背景 #0d0d0d 或 #111111
- 字体：system-ui 或 inter（Google Fonts CDN 可用）
- 行数建议 200–500 行，追求质量不追求量
- 必须在 Chromium 里直接运行，无需构建步骤

---

## 视觉调性

- 深色玻璃感 UI，不是企业软件，是有设计意识的产品
- 关键信息大字号突出（价格/核心数字要大）
- 至少一处 CSS 过渡或动画，让页面有生命感
- 按钮和可交互元素要有明确的 hover 反馈
- 文字层级清晰（primary / secondary / muted）

---

## 输出格式

只输出 JSON，不要任何解释文字，不要 markdown 代码块，直接是 JSON 对象：

{
  "success": true,
  "title": "GenTab 的标题（简短有力，描述这件事，不带 GenTab 字样）",
  "intent": "一句话，描述这张 GenTab 在帮用户做什么",
  "designChoice": "你选了什么形态？为什么？（一两句话，设计师视角，给用户看的）",
  "html": "完整的 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n"
}

如果网页内容不足以创作（如全是登录页、验证码等），返回：
{
  "success": false,
  "error": "说明原因"
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
 *
 * If everything looks good → {"ok": true}
 * If fixable issues found → {"ok": false, "html": "...fixed complete HTML..."}
 *
 * This is a best-effort pass. The caller must fall back to original HTML if the
 * verifier itself fails or returns unparseable output.
 *
 * @param {string} generatedHtml   — the HTML from the generation pass
 * @param {Array}  contexts        — original page context snapshots
 * @param {string} assistantLocale
 */
export function buildCodingGenTabVerifyPrompt(generatedHtml, contexts, assistantLocale = "zh-CN") {
  const contextSection = buildContextSection(Array.isArray(contexts) ? contexts : []);
  const langInstruction = getGenTabLanguageInstruction(assistantLocale);
  // Truncate HTML to keep the total prompt under control
  const truncatedHtml = generatedHtml.length > 40_000
    ? generatedHtml.slice(0, 40_000) + "\n<!-- ... truncated ... -->"
    : generatedHtml;

  return `你是 Sabrina GenTab 的 QA 工程师。一个 AI 刚刚生成了下面这段 HTML，你要帮它做最后一道自检。

## 检查要点（按优先级）

1. **数据准确** — 页面里出现的每一个具体数据（价格、名称、日期、规格、引语）必须能在"原始网页内容"里找到依据。如果有捏造数据，把它改成正确的或去掉。
2. **交互可用** — 所有可点击元素（按钮、卡片、拖动条）必须绑定了有效的事件处理函数，点击后有可见反应。
3. **无占位符** — 不允许出现 TODO、[INSERT]、"示例"、"sample"、"placeholder" 等字眼。把它们替换成真实内容或删除。
4. **JS 无明显错误** — 检查是否有未定义变量、语法明显错误、或空函数体（function () {}）影响交互的情况。

## 判断标准

- 如果上述四点全部通过，或只有极小的不影响使用的问题 → 直接返回 {"ok": true}
- 如果发现需要修复的问题 → 修复后返回完整的 HTML，格式如下

## 输出格式

情况 A — 没有问题（或问题可以接受）：
{"ok": true}

情况 B — 发现问题并已修复：
{
  "ok": false,
  "fixes": ["修复了什么（一句话）", "还修复了什么"],
  "html": "完整的修复后 HTML 字符串，所有双引号用 \\" 转义，所有换行用 \\n"
}

只输出 JSON，不要任何解释文字，不要 markdown 代码块。

${langInstruction}

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
 * Parse the verifier's response. Returns:
 *   { ok: true }                          — pass, use original HTML
 *   { ok: false, html: string }           — fixed HTML available
 *   null                                  — unparseable, ignore and use original
 */
export function normalizeCodingGenTabVerifyResult(rawText) {
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
