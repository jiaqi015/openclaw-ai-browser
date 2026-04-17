/**
 * Lightweight client-side intent detector for the creative-page GenTab mode.
 *
 * When the user sends a message that clearly describes "make me an interactive
 * web page", we can auto-route to the creative GenTab generator instead of the
 * chat thread — making the feature feel like a GenTab sub-capability instead of
 * a hidden parallel product.
 *
 * Design principle: err on the side of NOT triggering. A false positive
 * (routing a chat message to GenTab when the user just wanted to chat) is more
 * annoying than a false negative (making them click the button manually).
 * The trigger patterns are therefore intentionally narrow and high-confidence.
 */

/**
 * Returns true when the message strongly signals "generate a creative web page
 * from what I'm looking at".  This is a pure function — no side effects.
 */
export function detectCodingGenTabIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length < 4) return false;

  // Explicit brand/feature terms (highest confidence)
  if (/gentab|创意网页|交互网页|交互页面/.test(t)) return true;

  // "帮我 + 做/生成/制作/创建 + 网页/页面/界面/可视化/dashboard"
  if (/帮(我|忙).{0,8}(做|生成|制作|创建|写|建).{0,12}(网页|页面|界面|可视化|dashboard|app|应用)/.test(t)) return true;

  // "做一个/给我一个 + 网页/页面/界面"
  if (/(做|给我|来|搞|写)(一个|个).{0,12}(网页|页面|界面|可视化|app|应用)/.test(t)) return true;

  // Imperative: "生成/制作/创建 + 网页/页面"
  if (/^(生成|制作|创建|写|建).{0,12}(网页|页面|界面|可视化)/.test(t)) return true;

  return false;
}
