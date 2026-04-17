/**
 * AXSemanticEngine.mjs
 * Sabrina SAP V3 感知引擎 - 语义优先驱动
 */

export class AXSemanticEngine {
  /**
   * 解析原生 CDP 数据，生成语义化的交互元素列表
   * @param {Object} cdpData - 包含 axNodes 和 domSnapshot 的原始数据
   */
  static parse(cdpData) {
    const { axNodes = [], domSnapshot = {} } = cdpData;
    if (!axNodes.length) return { elements: [], metadata: { empty: true } };

    const nodes = domSnapshot.nodes || {};
    const layout = domSnapshot.layout || { bounds: [] };
    
    // 1. 建立 backendDOMNodeId -> DOM 索引的快速映射
    const backendToDomIdx = new Map();
    if (nodes.backendNodeId) {
      nodes.backendNodeId.forEach((id, idx) => {
        backendToDomIdx.set(id, idx);
      });
    }

    // 2. 建立 DOM 索引 -> Layout 索引的映射
    const domToLayoutIdx = new Map();
    if (domSnapshot.nodeToLayoutIndex) {
      domSnapshot.nodeToLayoutIndex.forEach((layoutIdx, domIdx) => {
        if (layoutIdx !== -1) domToLayoutIdx.set(domIdx, layoutIdx);
      });
    }

    // 3. 筛选有意义的无障碍节点
    const interactiveElements = [];
    axNodes.forEach(axNode => {
      // 过滤掉被忽略的节点或无意义的角色
      if (axNode.ignored) return;
      
      const role = axNode.role?.value || "";
      const name = axNode.name?.value || "";
      const description = axNode.description?.value || "";
      const value = axNode.value?.value || "";

      // 工业级过滤器：重点关注可交互角色
      const isActionable = /button|link|menuitem|tab|searchbox|textbox|combobox|checkbox|radio|slider/.test(role);
      const isInput = /searchbox|textbox|combobox/.test(role);
      
      // 即使不是标准交互角色，如果有名字且有点击事件，也视为潜在目标
      const hasName = name.length > 0;
      
      if (isActionable || (hasName && axNode.properties?.some(p => p.name === 'focusable' && p.value.value))) {
        // 查找物理坐标
        const backendId = axNode.backendDOMNodeId;
        const domIdx = backendToDomIdx.get(backendId);
        const layoutIdx = domToLayoutIdx.get(domIdx);

        if (layoutIdx !== undefined) {
          const bounds = layout.bounds[layoutIdx];
          const rect = {
            x: Math.round(bounds[0]),
            y: Math.round(bounds[1]),
            w: Math.round(bounds[2]),
            h: Math.round(bounds[3])
          };

          // 计算视觉权重 (简易版：面积 + 是否在视觉中心)
          const area = rect.w * rect.h;
          const score = area > 0 ? area : 0;

          interactiveElements.push({
            index: interactiveElements.length + 1,
            role,
            tag: role, // 在 V3 中，Tag 被 Role 取代以提高语义准确度
            text: name || description || value || "(无名称组件)",
            value: value,
            rect,
            backendNodeId: backendId,
            score,
            isInput
          });
        }
      }
    });

    // 4. 按权重和位置排序
    return {
      elements: interactiveElements.sort((a, b) => b.score - a.score),
      metadata: {
        url: domSnapshot.documentUrl,
        title: domSnapshot.title,
        count: interactiveElements.length
      }
    };
  }
}
