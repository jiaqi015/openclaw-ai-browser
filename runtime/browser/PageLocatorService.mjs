/**
 * PageLocatorService.mjs
 * 定位层：将 LLM 输出的语义目标（role/text/hint）匹配到快照中的实际元素。
 * 解决 index 漂移问题：当 action.index 查不到时，用语义兜底。
 */

/**
 * 检查元素是否匹配目标描述
 * target: { role?, text?, hint?, type? }
 */
function matchScore(el, target) {
  let score = 0;
  const elText = (el.text || '').toLowerCase().trim();
  const elTag  = (el.tag  || '').toLowerCase();
  const elType = (el.type || '').toLowerCase();
  const elPlaceholder = (el.placeholder || '').toLowerCase();

  // 文本完全匹配（最可靠）
  if (target.text) {
    const t = target.text.toLowerCase().trim();
    if (elText === t) score += 10;
    else if (elText.length > 0 && (elText.includes(t) || t.includes(elText))) score += 5;
  }

  // role 匹配（AXTree role 或 HTML tag）
  if (target.role) {
    const r = target.role.toLowerCase();
    if (elTag === r) score += 4;
    // 语义别名
    if (r === 'searchbox'  && elTag === 'input' && (elType === 'search' || /search/i.test(elPlaceholder))) score += 8;
    if (r === 'button'     && (elTag === 'button' || elTag === 'a'))       score += 3;
    if (r === 'textbox'    && elTag === 'input'   && elType !== 'submit')   score += 3;
    if (r === 'combobox'   && (elTag === 'select' || elTag === 'input'))    score += 3;
    if (r === 'link'       && elTag === 'a')                                score += 3;
    if (r === 'checkbox'   && elType === 'checkbox')                        score += 6;
    if (r === 'radio'      && elType === 'radio')                           score += 6;
  }

  // type 匹配
  if (target.type && elType === target.type.toLowerCase()) score += 4;

  // hint 模糊匹配（最低优先级）
  if (target.hint) {
    const h = target.hint.toLowerCase();
    const searchable = `${elText} ${elPlaceholder} ${elTag} ${elType}`;
    if (searchable.includes(h)) score += 2;
  }

  // 惩罚：失败过的元素
  score -= (el.failureCount || 0) * 5;

  return score;
}

/**
 * 在快照中定位最匹配目标的元素
 * @param {object} snapshot
 * @param {object} target  - { role?, text?, hint?, type? }
 * @param {number} minScore - 匹配分数下限，低于此分直接放弃
 * @returns {object|null}  元素或 null
 */
export function locateElement(snapshot, target, minScore = 2) {
  if (!target || !snapshot?.interactiveElements?.length) return null;

  let best = null;
  let bestScore = minScore - 1;

  for (const el of snapshot.interactiveElements) {
    const s = matchScore(el, target);
    if (s > bestScore) {
      bestScore = s;
      best = el;
    }
  }

  if (best) {
    console.log(`[Locator] Matched [${best.index}] "${best.text}" (score=${bestScore}) for target`, JSON.stringify(target));
  } else {
    console.warn(`[Locator] No match found for target`, JSON.stringify(target));
  }

  return best;
}

/**
 * 根据 action 解析 target 描述（兼容 index-based 和 semantic 两种协议）
 * 优先 action.target 语义目标，降级用 action.index
 */
export function resolveActionElement(snapshot, action) {
  const els = snapshot?.interactiveElements || [];

  // 优先：semantic target（P1 协议）
  if (action.target) {
    return locateElement(snapshot, action.target);
  }

  // 降级：index（P0 协议，向后兼容）
  if (action.index != null) {
    const byIndex = els.find(e => e.index === action.index);
    if (byIndex) return byIndex;

    // index 找不到时，用文本兜底（防 index 漂移）
    if (action.targetText) {
      return locateElement(snapshot, { text: action.targetText });
    }
  }

  return null;
}
