# What Sabrina Should Learn From Claude Code

这份文档不是要把 Sabrina 做成 Claude Code。

它只回答一个问题：

**在 Sabrina 自己的定位下，Claude Code 真正值得学的是什么。**

---

## 先说结论

Claude Code 最值得学的不是：

- 功能多
- tool 多
- agent 多
- runtime 很大

最值得学的是：

**它把一轮 turn 当成正式系统来经营。**

也就是：

- context 先治理
- capability 先筛选
- execution 有纪律
- memory 是后台资产
- remote 是 transport contract

Sabrina 应该学这套**机制纪律**，而不是照搬它的产品形态。

---

## Sabrina 的定位不能丢

Sabrina 不是通用 agent OS。

Sabrina 的本体仍然是：

- 浏览器现场真相
- thread 可见连续性
- OpenClaw 执行与生态复用

一句话：

**Browser owns truth, Threads own continuity, Turns own planning, OpenClaw owns execution.**

所以我们学习 Claude Code 的方式必须是：

**把它的系统纪律放回浏览器现场，而不是把浏览器降级成 agent UI。**

---

## 一、从策略上学什么

### 1. 上下文要先治理，再喂给模型

Claude Code 不是先拼 prompt，再祈祷结果对。

它会在 turn 内先处理：

- context prefetch
- budget
- compact
- collapse
- tool visibility
- permission boundaries

对应代码主线在：

- `src/QueryEngine.ts`
- `src/query.ts`
- `src/context.ts`

Sabrina 对应要学的是：

- Browser Context Package 必须继续成为正式对象
- execution facts 不能长期散在 prompt/helper 里
- routing/plan 要优先消费 package，而不是重新猜现场

### 2. capability 必须先治理，再暴露给模型或用户

Claude Code 不把工具池默认全开，而是先过滤、排序、约束。

对应代码：

- `src/tools.ts`
- `src/services/tools/toolOrchestration.ts`

Sabrina 对应要学的是：

- skill compatibility 要有显式 contract
- browser capability 的 declared truth 和 overlay 要分层
- UI、planner、policy 要围绕同一个 capability object 工作

### 3. skill 不是按钮，而是受控执行单元

Claude Code 的 skill 更像一个被隔离的子环境，而不是菜单项。

对应代码：

- `src/tools/SkillTool/SkillTool.ts`
- `src/tools/AgentTool/runAgent.ts`

Sabrina 对应要学的是：

- strict skill execution 要继续走 honesty contract
- Sabrina 不该让 URL-native/file-native skill 假装成功
- capability planning 必须发生在 execution 前

### 4. memory 是后台资产，不是聊天记录

Claude Code 的 session memory 不是每轮都写。

它会达到阈值后，再由后台 agent 进行提取和整理。

对应代码：

- `src/services/SessionMemory/sessionMemory.ts`

Sabrina 对应要学的是：

- thread continuity 和 memory 要继续分开说
- browser memory bridge 应该继续结构化、后台化
- 不要把 thread history 硬说成统一 memory substrate

### 5. remote 先是 transport，再是功能

Claude Code 的 remote 不是先做一个“远程连接页面”，而是先做 session transport、permission roundtrip、reconnect。

对应代码：

- `src/remote/RemoteSessionManager.ts`

Sabrina 对应要学的是：

- remote session contract 先于 UI
- pairing / relay / driver 差异要收在 transport layer
- UX 只是 transport truth 的投影

---

## 二、从具体代码里学什么

### Query owner

Claude Code 有一个明确的 conversation/turn owner。

关键点不是类名，而是：

- 谁持有长期状态
- 谁决定 turn 何时 compact
- 谁决定工具何时可见

Sabrina 当前对应的是：

- `runtime/turns/TurnEngine`
- `runtime/threads/ThreadTurnService`

继续方向是：

- 让 turn 真正拥有 planning contract
- 让 receipt/journal/evidence 继续从 thread visible history 中分层

### Tool orchestration discipline

Claude Code 会先判断工具是否 concurrency-safe，再决定是否并发。

这说明“工具调用”本身也有正式调度层。

Sabrina 当前对应的是：

- `runtime/openclaw/BrowserSkillInputPolicyService`
- `runtime/turns/TurnPlanner`

继续方向是：

- capability plan 更强
- execution contract 更清楚
- skill/input policy 不再反复在执行前后补判断

### Context snapshot policy

Claude Code 的 context 获取会把哪些东西该缓存、该 snapshot、该 collapse 讲清楚。

Sabrina 当前对应的是：

- `runtime/browser/PageContextService`
- `runtime/browser/BrowserContextPackageService`

继续方向是：

- source-level execution facts 更强
- package 更少像内容数组，更像执行工作包

### Background memory/update mechanics

Claude Code 把 memory 更新放到后台机制里，而不是把每轮消息都等价成 memory。

Sabrina 当前对应的是：

- `runtime/openclaw/SabrinaMemoryBridgeService`
- browser memory stats/search contract

继续方向是：

- 明确 browser memory record schema
- 明确它和 OpenClaw memory 的桥接点

---

## 三、Sabrina 明确不该学什么

### 1. 不该学 monolithic agent runtime

Sabrina 不是通用 agent 平台。

它的价值在浏览器现场，不在于把一切都吞进单体 runtime。

### 2. 不该让一切都变成 tool

Claude Code 的自然抽象是 tool。

Sabrina 的自然抽象首先应该是：

- browser truth
- thread continuity
- turn planning

### 3. 不该把 OpenClaw 变成浏览器真相 owner

OpenClaw 负责 execution。

浏览器现场仍然应该由 Sabrina own。

### 4. 不该用 memory 叙事掩盖边界还没打通

Sabrina 当前真正成立的是：

- strong thread continuity
- browser memory bridge

不是统一 memory substrate。

---

## 四、对 Sabrina 真正有价值的学习目标

如果把学习目标压成 5 条，就是：

1. 让 Browser Context Package 更像 execution object
2. 让 ExecutionPlan 更像正式 contract
3. 让 capability truth 更少 split-brain
4. 让 turn journal 成为正式 support/diagnostics 能力
5. 让 memory/remote 继续 contract-first

---

## 五、最短总结

Claude Code 真正教我们的不是“做更多 agent 功能”，而是：

**把 context、capability、execution、memory、remote 都收进受控 turn system。**

Sabrina 应该把这套纪律放进浏览器场景里，继续守住自己的定位，而不是变成另一个通用 agent runtime。
