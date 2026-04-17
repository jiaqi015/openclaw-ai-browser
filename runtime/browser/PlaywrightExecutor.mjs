/**
 * PlaywrightExecutor.mjs
 * 执行层：替代 PageActionExecutor + VerifiedActionExecutor。
 *
 * 核心改变：
 *   - click/fill 用 Playwright locator（自动 scroll-into-view，自动等待，坐标实时计算）
 *   - 不再需要手动坐标映射 / scrollIntoViewIfNeeded / DOM.getBoxModel
 *   - select / scroll / navigate 同样用 Playwright API
 */

import { getPlaywrightPage } from "./PlaywrightService.mjs";

/**
 * 执行单个动作。
 * @param {Electron.WebContents} webContents
 * @param {object} action  - { action, index, text, value, direction, url, submit, element }
 * @returns {Promise<{ok:boolean, error?:string, urlChanged?:boolean}>}
 */
export async function executeAction(webContents, action) {
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: "webContents is not available" };
  }

  try {
    const page = await getPlaywrightPage(webContents);
    const actionType = action.action ?? action.type;

    switch (actionType) {
      case "click":   return await doClick(page, action);
      case "fill":    return await doFill(page, action);
      case "select":  return await doSelect(page, action);
      case "scroll":  return await doScroll(page, action);
      case "navigate":return await doNavigate(page, action);
      default:
        return { ok: false, error: `Unknown action type: ${actionType}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── 具体执行函数 ───────────────────────────────────────────────────

async function doClick(page, action) {
  const resolution = await withResolvedLocator(page, action, "click", async (locator, timeout) => {
    await locator.click({ timeout });
  });
  return { ok: true, matchedBy: resolution.matchedBy, attempts: resolution.attempts };
}

async function doFill(page, action) {
  const { text = "", submit = false } = action;

  if (text === "__PASSWORD__") {
    // 密码字段：Playwright locator 定位但不填写，让 ActionGate 处理
    return { ok: true, isPasswordEntry: true };
  }

  const resolution = await withResolvedLocator(page, action, "fill", async (locator, timeout) => {
    // Playwright fill() 会先清空再输入，跨平台可靠
    await locator.fill(text, { timeout });

    if (submit) {
      await locator.press("Enter");
    }
  });

  return { ok: true, domChanged: true, matchedBy: resolution.matchedBy, attempts: resolution.attempts };
}

async function doSelect(page, action) {
  const { value } = action;
  const resolution = await withResolvedLocator(page, action, "select", async (locator, timeout) => {
    await locator.selectOption(value, { timeout });
  });
  return { ok: true, domChanged: true, matchedBy: resolution.matchedBy, attempts: resolution.attempts };
}

async function doScroll(page, action) {
  const amount = action.direction === "up" ? -1 : 1;
  await page.evaluate((a) => {
    window.scrollBy(0, window.innerHeight * 0.8 * a);
  }, amount);
  return { ok: true };
}

async function doNavigate(page, action) {
  await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  return { ok: true, urlChanged: true, newUrl: action.url };
}

// ─── Locator 解析 ──────────────────────────────────────────────────

async function withResolvedLocator(page, action, mode, run) {
  const plans = buildLocatorPlans(action, mode);
  if (plans.length === 0) {
    throw new Error("Cannot resolve locator: no target, index, or element fingerprint provided");
  }

  let lastError = null;

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const locator = locatorFromPlan(page, plan);
    const timeout = i === 0 ? 4000 : 1500;
    try {
      await locator.waitFor({ state: "visible", timeout });
      await run(locator, timeout);
      return { matchedBy: describePlan(plan), attempts: i + 1 };
    } catch (err) {
      if (!shouldTryAnotherLocator(err)) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to resolve a usable locator");
}

/**
 * 为不同动作生成多级 locator 计划。
 * 优先级：语义 target -> data index -> element 指纹（placeholder/role/text/tag/type）。
 */
export function buildLocatorPlans(action, mode = "click") {
  const plans = [];
  const seen = new Set();
  const push = (plan) => {
    if (!plan) return;
    const key = JSON.stringify(plan);
    if (seen.has(key)) return;
    seen.add(key);
    plans.push(plan);
  };

  if (action?.target) {
    push({ kind: "target", target: action.target });
  }

  if (action?.index != null) {
    push({ kind: "index", index: action.index });
  }

  const element = action?.element;
  if (!element) {
    return plans;
  }

  const role = inferRoleFromElement(element);
  const tag = normalizeToken(element.tag);
  const type = normalizeToken(element.type);
  const text = normalizeText(element.text);
  const placeholder = normalizeText(element.placeholder);

  if (mode === "fill") {
    if (placeholder) push({ kind: "placeholder", placeholder });
    if (role && text) push({ kind: "roleText", role, text });
    if (type) push({ kind: "type", inputType: type });
    if (tag === "input" || tag === "textarea" || tag === "select") push({ kind: "tag", tag });
    if (role) push({ kind: "role", role });
    return plans;
  }

  if (mode === "select") {
    if (role && text) push({ kind: "roleText", role, text });
    if (tag === "select") push({ kind: "tag", tag: "select" });
    push({ kind: "role", role: "combobox" });
    return plans;
  }

  if (role && text) push({ kind: "roleText", role, text });
  if (tag && text) push({ kind: "tagText", tag, text });
  if (text) push({ kind: "text", text });
  if (role) push({ kind: "role", role });
  if (tag) push({ kind: "tag", tag });

  return plans;
}

function locatorFromPlan(page, plan) {
  switch (plan.kind) {
    case "target":
      return buildSemanticLocator(page, plan.target);
    case "index":
      return page.locator(`[data-sabrina-idx="${plan.index}"]`);
    case "placeholder":
      return page.getByPlaceholder(plan.placeholder, { exact: false }).first();
    case "roleText": {
      const pwRole = toPwRole(plan.role);
      if (!pwRole) throw new Error(`Unsupported role: ${plan.role}`);
      return page.getByRole(pwRole, { name: plan.text, exact: false }).first();
    }
    case "tagText":
      return page.locator(tagSelector(plan.tag)).filter({ hasText: plan.text }).first();
    case "text":
      return page.getByText(plan.text, { exact: false }).first();
    case "role": {
      const pwRole = toPwRole(plan.role);
      if (!pwRole) throw new Error(`Unsupported role: ${plan.role}`);
      return page.getByRole(pwRole).first();
    }
    case "type":
      return page.locator(`input[type="${plan.inputType}"]`).first();
    case "tag":
      return page.locator(tagSelector(plan.tag)).first();
    default:
      throw new Error(`Unknown locator plan: ${plan.kind}`);
  }
}

function describePlan(plan) {
  switch (plan.kind) {
    case "target":
      return "semantic target";
    case "index":
      return "snapshot index";
    case "placeholder":
      return "placeholder";
    case "roleText":
      return "role + text";
    case "tagText":
      return "tag + text";
    case "text":
      return "text";
    case "role":
      return "role";
    case "type":
      return "input type";
    case "tag":
      return "tag";
    default:
      return plan.kind;
  }
}

function inferRoleFromElement(element) {
  const tag = normalizeToken(element?.tag);
  const type = normalizeToken(element?.type);

  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (type === "search") return "searchbox";
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (tag === "input") return "textbox";
  return null;
}

function tagSelector(tag) {
  switch (tag) {
    case "a":
      return 'a,[role="link"]';
    case "button":
      return 'button,[role="button"]';
    case "input":
      return "input";
    case "textarea":
      return "textarea";
    case "select":
      return 'select,[role="combobox"]';
    default:
      return tag;
  }
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function shouldTryAnotherLocator(error) {
  const message = error?.message || "";
  return (
    message.includes("waiting for locator") ||
    message.includes("strict mode violation") ||
    message.includes("resolved to 0 elements") ||
    message.includes("Could not find") ||
    message.includes("Timeout")
  );
}

/**
 * 将语义目标描述转换为 Playwright Locator。
 * target: { role?, text?, hint?, type? }
 */
function buildSemanticLocator(page, target) {
  const { role, text, type } = target;

  // role + text 是最精确的组合
  if (role && text) {
    const pwRole = toPwRole(role);
    if (pwRole) return page.getByRole(pwRole, { name: text, exact: false });
  }

  // 仅 text
  if (text) {
    return page.getByText(text, { exact: false });
  }

  // role 只有类型（如 searchbox）
  if (role) {
    const pwRole = toPwRole(role);
    if (pwRole) return page.getByRole(pwRole).first();
  }

  // type（input type）
  if (type) {
    return page.locator(`input[type="${type}"]`).first();
  }

  throw new Error(`Cannot build locator from target: ${JSON.stringify(target)}`);
}

/** 将 LLM 输出的 role 映射到 Playwright ARIA role */
function toPwRole(role) {
  const map = {
    button:    "button",
    link:      "link",
    textbox:   "textbox",
    searchbox: "searchbox",
    combobox:  "combobox",
    checkbox:  "checkbox",
    radio:     "radio",
    tab:       "tab",
    menuitem:  "menuitem",
    option:    "option",
    a:         "link",
    input:     "textbox",
    select:    "combobox",
  };
  return map[role?.toLowerCase()] || null;
}
