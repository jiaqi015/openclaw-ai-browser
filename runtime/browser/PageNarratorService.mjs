/**
 * PageNarratorService.mjs
 * 叙述层：将原始 CDP 快照转换为大脑可高效读取的结构化场景描述。
 * 输出替代原来"把 50 个元素扔给 LLM"的做法。
 */

/**
 * 场景分类（启发式，帮助 LLM 快速定位上下文）
 */
function classifyScene(snapshot) {
  const url   = (snapshot.url   || '').toLowerCase();
  const title = (snapshot.title || '').toLowerCase();
  const text  = (snapshot.pageText || '').toLowerCase().slice(0, 500);
  const els   = snapshot.interactiveElements || [];

  // 优先看 URL + 标题关键词
  if (/login|signin|sign-in|登录/.test(url + title))         return 'login';
  if (/register|signup|sign-up|注册/.test(url + title))      return 'register';
  if (/search|results?|搜索结果/.test(url + title))          return 'search_results';
  if (/cart|checkout|支付|购物车|结算|order/.test(url + title)) return 'checkout';
  if (/product|商品|item|detail|goods/.test(url + title))    return 'product';
  if (/article|post|news|blog|新闻|文章/.test(url + title))  return 'article';

  // 降级：看页面结构
  const hasPassword  = els.some(e => e.type === 'password');
  const hasSearchBox = els.some(e => e.type === 'search' || /search/i.test(e.placeholder || ''));
  const inputCount   = els.filter(e => ['input', 'textarea', 'select'].includes(e.tag)).length;

  if (hasPassword) return 'login_form';
  if (hasSearchBox) return 'search_home';
  if (inputCount >= 3) return 'form';
  if (els.length === 0) return 'loading';

  return 'generic';
}

/**
 * 对元素按交互价值评分，取 topN 作为"关键元素"
 */
function scoreElement(el) {
  let score = 0;
  const text = (el.text || '').toLowerCase();
  const tag  = el.tag || '';
  const type = el.type || '';

  // 标签得分
  if (tag === 'button')   score += 4;
  if (tag === 'input')    score += 3;
  if (tag === 'select')   score += 3;
  if (tag === 'textarea') score += 3;
  if (tag === 'a')        score += 2;

  // 有意义文字
  if (text.length > 1 && text.length < 60) score += 2;
  if (text.length === 0) score -= 3;

  // 高价值关键词
  if (/提交|搜索|search|submit|确认|下一步|登录|注册|立即/i.test(text)) score += 4;
  if (/delete|删除|cancel|取消/.test(text)) score += 1;

  // 输入框类型加分
  if (type === 'search') score += 4;
  if (type === 'text' || type === 'email') score += 1;
  if (type === 'password') score += 2; // 登录表单关键字段

  // 失败过的元素降权
  score -= (el.failureCount || 0) * 3;

  return score;
}

function pickTopElements(elements = [], limit = 12) {
  return elements
    .map(el => ({ ...el, _score: scoreElement(el) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index); // 恢复原始顺序，LLM 更好理解
}

/**
 * 计算两次快照之间的变化摘要（Diff）
 */
function diffSnapshots(prev, curr) {
  if (!prev) return null;
  return {
    url_changed:      prev.url !== curr.url,
    title_changed:    prev.title !== curr.title,
    elements_delta:   (curr.interactiveElements?.length || 0) - (prev.interactiveElements?.length || 0),
    scroll_moved:     Math.abs((curr.scrollPosition?.y || 0) - (prev.scrollPosition?.y || 0)) > 10,
  };
}

/**
 * 主函数：将快照 + 可选前一快照转换为叙述对象
 */
export function narratePage(snapshot, prevSnapshot = null) {
  const scene_type    = classifyScene(snapshot);
  const key_elements  = pickTopElements(snapshot.interactiveElements, 12);
  const diff          = diffSnapshots(prevSnapshot, snapshot);

  return {
    scene_type,
    url:          snapshot.url   || '',
    title:        snapshot.title || '',
    scroll_y:     snapshot.scrollPosition?.y         || 0,
    scroll_height:snapshot.scrollPosition?.scrollHeight || 0,
    has_more:     snapshot.hasMoreContent || false,
    key_elements,                            // 评分最高的 12 个
    all_count:    snapshot.interactiveElements?.length || 0,
    text_excerpt: (snapshot.pageText || '').slice(0, 600),
    diff,
  };
}

/**
 * 将叙述对象格式化为 prompt 用的文字段落
 */
export function formatNarration(narration, allElements) {
  const scrollInfo = narration.has_more
    ? `${narration.scroll_y}/${narration.scroll_height}  ⬇ 页面下方还有更多内容`
    : `${narration.scroll_y}/${narration.scroll_height}  (内容已全部可见)`;

  const diffLine = narration.diff ? (() => {
    const parts = [];
    if (narration.diff.url_changed)     parts.push('URL 已变化');
    if (narration.diff.title_changed)   parts.push('标题已变化');
    if (narration.diff.elements_delta !== 0) parts.push(`元素数量变化 ${narration.diff.elements_delta > 0 ? '+' : ''}${narration.diff.elements_delta}`);
    if (narration.diff.scroll_moved)    parts.push('页面发生了滚动');
    return parts.length ? `上一步变化：${parts.join(' / ')}` : '上一步：页面无明显变化（操作可能未生效，考虑换策略）';
  })() : '';

  const keyElsDesc = narration.key_elements.map(el => {
    const typeStr = el.type ? ` type="${el.type}"` : '';
    const valStr  = el.value ? ` 值="${el.value}"` : '';
    const failStr = el.failureCount > 0 ? ` ⚠️ 已失败${el.failureCount}次` : '';
    return `  [${el.index}] <${el.tag}${typeStr}> "${el.text}"${valStr}${failStr}`;
  }).join('\n');

  const remainingEls = allElements
    .filter(el => !narration.key_elements.find(k => k.index === el.index))
    .map(el => {
      const typeStr = el.type ? ` type="${el.type}"` : '';
      return `  [${el.index}] <${el.tag}${typeStr}> "${el.text}"`;
    }).join('\n');

  return `## 当前页面
URL: ${narration.url}
标题: ${narration.title}
场景类型: ${narration.scene_type}
滚动位置: ${scrollInfo}
${diffLine}

### 🔑 关键元素 (按重要性排序, ${narration.key_elements.length}/${narration.all_count})
${keyElsDesc || '  （无关键元素）'}

### 其余元素 (${narration.all_count - narration.key_elements.length} 个，备查)
${remainingEls || '  （无）'}

### 页面文字摘要
${narration.text_excerpt || '（无）'}`;
}
