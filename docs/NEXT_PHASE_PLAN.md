# Sabrina Next Phase Plan

这份文档不重新定义 Sabrina。

它只做一件事：

**把已经成立的 browser-native contract，继续推进成长期真相。**

---

## 当前阶段判断

Sabrina 现在已经拥有：

- Browser Context Package
- Turn planning
- Capability provenance
- Execution honesty
- Turn journal
- Connector/runtime insights contract

所以接下来不是再“补一个 AI 功能”，而是把这套系统做成熟。

---

## 总目标

下一阶段的目标是：

**让 Browser owns truth / Turn owns planning / OpenClaw owns execution 这套边界，越来越少依赖 Sabrina 本地兜底，越来越多变成上游真相、正式 contract 和可验证能力。**

---

## Workstream 1: Push Browser Capability Truth Upstream

### 为什么先做这个

当前已经有：

- `declaredBrowserCapability`
- resolved `browserCapability`
- Sabrina overlay

这让 split-brain 风险已经被显式化，但还没有彻底消除。

### 目标

把 browser capability 的长期真相继续往 OpenClaw 上游推进，让 Sabrina 本地 registry 继续退化成 overlay。

### 具体交付

1. 明确 OpenClaw skill payload 的 browser capability schema
2. 在 connector / plugin 层保留 schema version 和 provenance
3. 给 overlay 加更硬的门禁：
   - overlay 不能伪装成 declared truth
   - UI 必须能看见 provenance

### 验收

- skill catalog 对每个 browser-capable skill 都能解释 truth source
- overlay 被禁用时，系统仍可诚实退化
- acceptance gate 覆盖 provenance invariant

---

## Workstream 2: Turn Browser Context Package Into A Stronger Execution Package

### 现状

Browser Context Package 已经不只是内容快照，但还没有完全成为 OpenClaw-native execution object。

### 目标

让 package 更像执行包，而不是主要服务 prompt/routing 的内容包。

### 具体交付

1. 继续按 source 粒度增强 execution facts：
   - reachability confidence
   - auth boundary detail
   - trust level
   - reproducibility guarantee
2. 把这些 facts 更深地接进 `ExecutionPlan`
3. 避免 skill policy 再重复猜一次 source truth

### 验收

- plan 里的 execution contract 可以解释为什么 allow / reject / allow-with-honesty-constraints
- GenTab / strict skill / handoff 共用同一套 source facts
- internal/private/file/http 的路由不再依赖 ad hoc 分支

---

## Workstream 3: Productize Turn Journal

### 现状

turn journal 已经存在，也能查询，但仍偏“内部诊断资产”。

### 目标

把它变成真正可用的支持与排障入口。

### 具体交付

1. retention / pruning 规则
2. diagnostics 查询、过滤、复制
3. connector / doctor 对 turn journal 的统一摘要
4. 为 replay/support 留出稳定 schema

### 验收

- 可以用 turn journal 回答“这次为什么 blocked / failed / degraded”
- diagnostics 和 connector 输出同一套摘要
- journal 不再无限制增长或把 repo 根当默认落盘点

---

## Workstream 4: Unify Connector, Doctor, and Runtime Insights

### 现状

settings、diagnostics、connector status 已经能看到 contract 数据，但仍有继续统一的空间。

### 目标

让用户和开发者看到的是同一套 runtime truth，而不是不同页面各说各话。

### 具体交付

1. connector status、doctor、settings、diagnostics 统一字段命名
2. contract version / feature summary 统一展示
3. 结构化快照导出，方便支持和排障

### 验收

- 相同 runtime fact 在不同 surface 上值一致、命名一致
- 文本输出与 UI 读到的是同一套 object

---

## Workstream 5: Keep Memory And Remote Contract-first

### 现状

browser memory bridge 和 remote session contract 已经存在，但这两条最容易被误做成 UI-first。

### 目标

让 memory 和 remote 继续沿着 contract / transport 的方向长，而不是先做表面功能。

### 具体交付

1. 定义 browser memory record 的长期 schema
2. 明确 Sabrina memory 与 OpenClaw workspace memory 的桥接边界
3. 明确 remote session transport contract 的稳定字段
4. 继续把 pairing / relay / driver 差异收在 transport layer

### 验收

- 文档不再把 browser memory bridge 说成统一 memory
- remote UX 改动不需要重写 transport truth

---

## 推荐推进顺序

1. Push browser capability truth upstream
2. Strengthen Browser Context Package as execution package
3. Productize turn journal
4. Unify connector / doctor / runtime insights
5. Continue contract-first memory and remote work

---

## 不该做的事

- 不把 Sabrina 变成第二套 OpenClaw 平台
- 不靠更多 prompt glue 填 contract 缺口
- 不在 UI 上先做一层“看起来像真相”的能力
- 不把 thread continuity 误写成统一 memory substrate
- 不把 overlay 长期当成平台真相

---

## 最后一句

下一阶段最重要的，不是再增加多少 feature，而是：

**让 Sabrina 这套 browser-native contract，从“已经成立”变成“长期可靠”。**
