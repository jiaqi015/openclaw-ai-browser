# Sabrina GenTab PRD

这份文档定义 Sabrina 的 **GenTab** 产品需求。

它不是一份纯概念稿，也不是离开仓库现状的未来幻想。

它基于 Sabrina 当前已经成立的 browser-native contract 来定义：

- 用户为什么需要 GenTab
- GenTab 在 Sabrina 里的产品定位
- 它的输入、输出、约束、交互和非功能要求
- 当前已经成立的实现范围

---

## 1. 需求概述

### 1.1 问题背景

用户在浏览器里研究一个主题时，通常会：

- 打开 3-10 个标签页收集信息
- 在多个网页之间来回对比
- 手动复制、粘贴、整理到笔记、表格或文档
- 在“阅读材料”和“产出结果”之间切换多次

这个过程耗时、重复、容易遗漏来源，也很难保持结构化。

### 1.2 灵感来源

Google Disco 证明了一件重要的事：

**“从多个标签页直接生成结构化工作台”** 不是 gimmick，而是浏览器下一代 AI 能力的真实需求。

但 Sabrina 不复制 Disco 的产品形态。

Sabrina 的方式是：

- 浏览器先组织真实页面上下文
- 用户明确表达自己的意图
- OpenClaw 复用既有模型、skill 和执行能力
- 最终生成一个新的浏览器内结果页面

### 1.3 产品定位

**GenTab = Generate Tab**

它的核心价值不是“AI 帮你总结几个网页”，而是：

**把多标签页材料，生成一个结构化、可继续工作的浏览器结果工作台。**

也就是说，GenTab 代表 Sabrina 从：

- 阅读网页

走向：

- 生产结果页

### 1.4 与 Sabrina 总定位的关系

GenTab 必须服从 Sabrina 的核心边界：

- **Browser owns truth**：浏览器负责页面真相与来源
- **Threads own continuity**：线程负责用户可见连续性
- **Turns own planning**：GenTab 生成是正式 turn
- **OpenClaw owns execution**：OpenClaw 负责生成与执行

所以 GenTab 不是一个“悬浮在页面上的聊天技巧”，而是 Sabrina browser-native contract 的一条代表性主链。

---

## 2. 目标用户

- 需要调研与对比多个方案的开发者
- 需要整理行业和竞品信息的产品经理
- 需要汇总资料的研究者
- 需要多页面比价和筛选的消费者

这些用户的共同点是：

- 真实工作发生在多个标签页之间
- 需要从材料中生成结构化成果
- 需要保留来源以便回查和验证

---

## 3. 核心价值

GenTab 要解决的不是“看懂网页”，而是 3 件事：

1. **把多个标签页变成一个可工作的结果页面**
2. **把来源保留下来，保证可验证**
3. **把后续追问和继续调整变成浏览器里的连续工作**

一句话：

**从收集材料，到产出工作台。**

---

## 4. 用户入口流程

```text
1. 用户打开多个标签页浏览材料
2. 用户在 AI 侧边栏引用一个或多个标签页
3. 用户输入自然语言意图，或点击“生成 GenTab”
4. Sabrina 新建一个特殊标签页 sabrina://gentab/{genId}
5. 页面显示生成中状态，后台执行 GenTab turn
6. 生成完成后渲染结构化结果
7. 用户可以继续 refine、切换形态、回到来源页
```

---

## 5. 输入要求

### 5.1 引用标签页

- 至少 1 个
- 推荐 2-10 个
- 超过合理上限时，系统应保守处理并给出裁剪结果

### 5.2 用户意图

自然语言输入，描述用户希望生成什么结果，例如：

- “对比这 5 款 AI 编码工具”
- “把这些招聘 JD 整理成对比台”
- “基于这些资料生成一个时间线”

### 5.3 期望形态

允许用户选择：

- `auto`
- `table`
- `list`
- `timeline`
- `comparison`
- `card-grid`

如果用户明确指定，系统应优先遵守；如果用户选择 `auto`，由 planner 和生成策略共同决定。

---

## 6. 后端处理流程

GenTab 后端主链应是：

```text
1. 收集引用标签页与当前页上下文
2. 组织 Browser Context Package
3. 生成 GenTab turn 的 ExecutionPlan
4. 构建符合 schema 的生成提示
5. 调用 OpenClaw sabrina-browser agent 执行
6. 解析与规范化 AI 输出
7. 存储 GenTab 结果与元数据
8. 通知 UI 渲染完成
```

这意味着 GenTab 不是单独的 ad hoc 路径，而应该走 Sabrina 的 turn contract。

---

## 7. 输出 Schema

AI 必须输出严格 JSON，结构约束如下：

```json
{
  "success": true,
  "error": "",
  "gentab": {
    "schemaVersion": "2",
    "type": "table",
    "title": "标题",
    "description": "描述",
    "summary": "总结",
    "insights": ["洞见 1", "洞见 2"],
    "sections": [
      {
        "id": "section-1",
        "title": "章节标题",
        "description": "章节说明",
        "bullets": ["要点 1", "要点 2"]
      }
    ],
    "suggestedPrompts": ["下一步可以继续问什么"],
    "sources": [
      {
        "url": "https://example.com",
        "title": "来源标题",
        "host": "example.com",
        "whyIncluded": "为什么纳入"
      }
    ],
    "items": [
      {
        "id": "item-1",
        "title": "项目标题",
        "description": "项目描述",
        "sourceUrl": "https://example.com",
        "sourceTitle": "来源标题",
        "fields": {
          "价格": "$20",
          "平台": "macOS"
        },
        "date": "2026-04-07"
      }
    ]
  }
}
```

---

## 8. 给生成模型的硬约束

### 8.1 来源必须保留

每个 item 必须保留：

- `sourceUrl`
- `sourceTitle`

这样用户才能回到原始网页验证。

### 8.2 形态选择必须受控

如果用户指定了形态，优先遵守。  
如果是 `auto`，生成逻辑应遵循这些优先级：

- 多对象对比：优先 `table` / `comparison`
- 时间顺序、计划、事件演进：优先 `timeline`
- 摘录、清单、结论：优先 `list`
- 卡片集合：优先 `card-grid`

### 8.3 sections 不是重复 items

`sections` 应该帮助用户理解“这组材料怎么看”，而不是简单重复 `items`。

### 8.4 suggestedPrompts 要面向下一步工作

它们不是通用问题，而应该是用户下一步最可能继续调整、追问、重组的自然语言建议。

### 8.5 只输出 JSON

不输出 markdown，不输出解释，不输出额外自然语言前后缀。

---

## 9. UI 渲染要求

### 9.1 页面结构

```text
头部
  - 图标 / 标题
  - 描述 / type / 来源数量
  - 重新生成 / 关闭

上半区
  - 摘要、总结、洞见
  - 调整意图输入框
  - 形态选择
  - 建议下一步 quick actions

中部
  - 来源卡片
  - sections

主内容区
  - 根据 type 选择渲染器
  - 支持切换视图

页脚
  - 来源数量
  - 生成时间
  - 元数据
```

### 9.2 各渲染器

| 形态 | 渲染方式 |
|------|---------|
| `table` | 表格 |
| `comparison` | 强调对比列的表格式布局 |
| `list` | 清单式结果 |
| `timeline` | 垂直时间线 |
| `card-grid` | 响应式卡片网格 |

### 9.3 交互

- 点击来源链接，在新标签页打开原始 URL
- 支持改意图重新生成
- 支持换形态重新生成
- 生成过程中显示明确状态
- 失败时显示错误并允许重试
- 所有来源链接保持可点击

---

## 10. 后处理规范化要求

后端必须做容错规范化：

1. 如果输出不是完全合法 JSON，尝试提取和修复
2. 补齐缺失字段
3. 清洗异常文本和空白
4. 对来源去重
5. 限制 item 数量，避免结果页失控
6. 保留关键元数据：
   - `sourceTabIds`
   - `userIntent`
   - `preferredType`
   - `generatedAt`

---

## 11. Refine 要求

用户应能：

- 修改用户意图
- 修改期望形态
- 重新生成当前 GenTab

当前版本可以只保留最新结果，不要求内建历史版本面板。

---

## 12. 非功能需求

### 12.1 性能

- 上下文收集应尽量复用现有快照
- 渲染应保持轻量
- AI 生成时长由 OpenClaw 模型决定，但前后处理应尽量稳定、低开销

### 12.2 存储

- GenTab 数据本地持久化
- `sabrina://gentab/{genId}` 可直接恢复打开
- 元数据和来源信息保留完整

### 12.3 容错

- JSON 非法时可修复则修复
- 缺失字段时补默认
- 缺失引用页时明确标记
- 生成失败时支持重试

### 12.4 隐私

- 结果本地存储
- Sabrina 不引入新的中心化存储依赖
- 生成继续通过用户已有的 OpenClaw 路径执行

---

## 13. 当前实现状态

对照仓库，GenTab 当前已经具备完整主链：

| 模块 | 状态 | 仓库对应 |
|------|------|----------|
| 浏览器上下文收集 | ✅ | `buildBrowserContextPackageFromTabSet` |
| Prompt 构建 | ✅ | `buildGenTabPrompt` |
| JSON 解析与规范化 | ✅ | `normalizeGeneratedGenTab` |
| Turn 主链接入 | ✅ | `runtime/turns/TurnEngine` |
| IPC 路由 | ✅ | `host/electron/GenTabIpcActionService` |
| 本地存储 | ✅ | `runtime/browser/GenTabStore.mjs` + `host/electron/register-gentab-ipc-handlers.mjs` |
| GenTab 页面 | ✅ | `src/components/gentab-surface.tsx` |
| 多渲染器 | ✅ | `src/components/gentab-renderers.tsx` |
| Refine | ✅ | `use-gentab-surface-state` + `gentab-surface` |
| 测试 | ✅ | `GenTabGenerationService.test.mjs` / `GenTabIpcActionService.test.mjs` / `TurnEngine.test.mjs` |

当前最准确的说法是：

**GenTab 已经完成功能闭环，并且已经接入 Sabrina 的 Browser Context Package 与 TurnEngine 主链。**

---

## 14. 与 Google Disco 的关系

| 维度 | Google Disco | Sabrina GenTab |
|------|--------------|----------------|
| 核心理念 | 多标签页生成结果工作台 | 相同 |
| 能力来源 | Google 自有 AI 体系 | 复用 OpenClaw 生态 |
| 产品定位 | 独立 AI 浏览器体验探索 | OpenClaw 的浏览器原生工作台 |
| 架构 | 云端原生整合 | Browser truth + Turn planning + OpenClaw execution |

所以 Sabrina 的借鉴重点不是“抄一个 UI”，而是：

**确认 GenTab 这类多标签页到结果页的能力，确实是浏览器场景里的核心价值。**

---

## 15. 验收标准

1. 用户选中多个标签页并给出意图后，可以成功生成结构化结果
2. 每个结果条目都保留可点击来源
3. 五种形态都能正确渲染
4. 失败时有明确错误和重试路径
5. 用户可以通过 refine 改意图和形态重新生成
6. 元数据和来源信息在重开后仍然可恢复
7. 用户感受到的结果不是“总结网页”，而是“生成一个可继续工作的结果页”

---

## 最后一句

GenTab 在 Sabrina 里的意义，不是一个附属 feature。

它是 Sabrina 最能代表 browser-native 方向的一条主链：

**从多标签页材料，直接生成新的工作页面。**
