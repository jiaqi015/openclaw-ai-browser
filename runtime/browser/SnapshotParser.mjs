/**
 * SnapshotParser.mjs
 * 原生 CDP 快照解析引擎 (V9: Native Sensor)
 * 负责将扁平化的 DOMSnapshot 解析为人机可读的语义格式
 */

export function parseCdpSnapshot(cdpData) {
  if (!cdpData) return null;
  const { documents, strings } = cdpData;
  if (!documents || documents.length === 0) return null;

  const stringLookup = (idx) => (idx !== -1 ? strings[idx] : "");
  const interactiveElements = [];
  let pageText = "";

  // 1. 辅助函数：深度提取文本 (递归)
  const aggregateText = (doc, nodeIdx) => {
    const nodes = doc.nodes;
    let text = stringLookup(nodes.nodeValue?.[nodeIdx] ?? -1).trim();
    const children = nodes.childNodeIndexes?.[nodeIdx] || [];
    for (const childIdx of children) {
      text += " " + aggregateText(doc, childIdx);
    }
    return text.trim();
  };

  // 2. 建立文档偏移映射 (Document Index -> {offsetX, offsetY})
  const docOffsets = new Map();
  docOffsets.set(0, { x: 0, y: 0 }); // 根文档偏移为 0

  // 预扫描：计算每个子文档相对于根文档的物理偏移
  for (let docIdx = 0; docIdx < documents.length; docIdx++) {
    const doc = documents[docIdx];
    const nodes = doc.nodes;
    const currentOffset = docOffsets.get(docIdx) || { x: 0, y: 0 };
    const layout = doc.layout || {};
    const nodeToLayout = new Map();
    layout.nodeIndex?.forEach((idx, lIdx) => nodeToLayout.set(idx, lIdx));

    for (let i = 0; i < nodes.nodeName.length; i++) {
        const contentDocIdx = nodes.contentDocumentIndex?.[i];
        if (contentDocIdx !== undefined && contentDocIdx !== -1) {
            // 这是一个 iFrame 节点，它的位置就是子文档的起点
            const layoutIdx = nodeToLayout.get(i);
            if (layoutIdx !== undefined) {
                const bounds = layout.bounds[layoutIdx];
                docOffsets.set(contentDocIdx, {
                    x: currentOffset.x + Math.round(bounds[0]),
                    y: currentOffset.y + Math.round(bounds[1])
                });
            }
        }
    }
  }

  // 3. 遍历所有文档并提取
  for (let docIdx = 0; docIdx < documents.length; docIdx++) {
    const doc = documents[docIdx];
    const offset = docOffsets.get(docIdx) || { x: 0, y: 0 };
    const nodes = doc.nodes;
    const domNodes = nodes.nodeName;
    const layout = doc.layout || {};
    const nodeToLayout = new Map();
    layout.nodeIndex?.forEach((nodeIdx, layoutIdx) => nodeToLayout.set(nodeIdx, layoutIdx));

    for (let i = 0; i < domNodes.length; i++) {
      const tag = stringLookup(domNodes[i]).toLowerCase();
      const attrArray = nodes.attributes?.[i] || [];
      const attrs = {};
      for (let j = 0; j < attrArray.length; j += 2) {
        attrs[stringLookup(attrArray[j])] = stringLookup(attrArray[j + 1]);
      }

      const isInput = /^(input|textarea)$/.test(tag);
      const isStandardLink = /^(a|button|select)$/.test(tag) || isInput;
      // 只有明确具备交互语义的属性才算（去掉 class/id 这种噪音条件）
      const hasInteractionAttr =
        attrs.role === 'button' || attrs.role === 'link' || attrs.role === 'menuitem' ||
        attrs.role === 'option' || attrs.role === 'tab' || attrs.role === 'checkbox' ||
        attrs.role === 'radio' || attrs.role === 'switch' || attrs.role === 'combobox' ||
        (attrs['aria-label'] && attrs['aria-label'].trim()) ||
        (attrs.onclick && attrs.onclick.trim()) ||
        (attrs.href && attrs.href.trim() && attrs.href !== '#') ||
        attrs.tabindex === '0';
      // list item 仅当有明确 ARIA 角色（option/menuitem/row 等）时才算交互
      const isListItem = /^(li|tr|dt)$/.test(tag) && /^(option|menuitem|row|treeitem|gridcell)$/.test(attrs.role || "");

      if (isStandardLink || hasInteractionAttr || isListItem) {
        const layoutIdx = nodeToLayout.get(i);
        if (layoutIdx === undefined) continue;

        const bounds = layout.bounds[layoutIdx];
        const rect = {
          x: Math.round(bounds[0]) + offset.x, // 加上框架偏移
          y: Math.round(bounds[1]) + offset.y,
          w: Math.round(bounds[2]),
          h: Math.round(bounds[3])
        };

        // 文本提取逻辑增强
        const inputType = (attrs.type || "").toLowerCase();
        const inputValue = stringLookup(nodes.inputValue?.[i] ?? -1) || attrs.value || "";
        const placeholder = attrs.placeholder || "";

        let text = aggregateText(doc, i);
        if (isInput) {
           // 对于输入框，优先使用 value 或 placeholder 作为可读文本
           text = inputValue || placeholder || text;
        } else {
           text = text || attrs.title || attrs['aria-label'] || "";
        }

        // 只要是标准交互组件（输入框、按钮等），即使没文字也必须保留
        if (!text && !isStandardLink) continue;

        interactiveElements.push({
          index: interactiveElements.length + 1,
          tag,
          type: inputType,
          text: text.replace(/\s+/g, ' ').slice(0, 150),
          value: inputValue,
          placeholder,
          disabled: attrs.disabled != null || attrs['aria-disabled'] === 'true',
          rect,
          backendNodeId: nodes.backendNodeId[i],
          isFrame: docIdx > 0,
          failureCount: 0,
        });
      }
    }

    if (pageText.length < 5000) {
      pageText += " " + aggregateText(doc, 0);
    }
  }

  return {
    url: documents[0].documentURL ? stringLookup(documents[0].documentURL) : "",
    title: documents[0].title ? stringLookup(documents[0].title) : "",
    interactiveElements,
    pageText: pageText.trim(),
    scrollPosition: { y: 0, totalHeight: 0 }
  };
}
