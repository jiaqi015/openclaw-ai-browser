# Sabrina Docs Guide

这份文档不是新的设计稿。

它只回答一个问题：

**如果你要理解 Sabrina，现在应该先读哪篇，再读哪篇。**

---

## 最短路径

如果你第一次接手 Sabrina，建议按这个顺序读：

1. [SYSTEM_STATE.md](./SYSTEM_STATE.md)
2. [BROWSER_OPENCLAW_ARCHITECTURE.md](./BROWSER_OPENCLAW_ARCHITECTURE.md)
3. [TURN_ENGINE_DESIGN.md](./TURN_ENGINE_DESIGN.md)
4. [ENGINEERING_SYSTEM.md](./ENGINEERING_SYSTEM.md)
5. [ACCEPTANCE_MATRIX.md](./ACCEPTANCE_MATRIX.md)
6. [ITERATION_LOOP.md](./ITERATION_LOOP.md)

如果只看一篇，请先看 [SYSTEM_STATE.md](./SYSTEM_STATE.md)。

---

## 先建立的 4 个判断

在读任何实现细节之前，先确认这 4 句话：

- **Browser owns truth**
- **Threads own continuity**
- **Turns own planning**
- **OpenClaw owns execution**

如果后续某个实现、文档或重构方案和这 4 句话冲突，默认它是可疑的。

---

## 每篇文档解决什么问题

### [SYSTEM_STATE.md](./SYSTEM_STATE.md)

适合场景：

- 想快速知道 Sabrina 现在到底是什么
- 想知道哪些是真的、哪些还不能过度宣传
- 想知道当前门禁、主要风险、下一步主线

这篇是**当前真相入口**。

### [BROWSER_OPENCLAW_ARCHITECTURE.md](./BROWSER_OPENCLAW_ARCHITECTURE.md)

适合场景：

- 想搞清楚 Sabrina 和 OpenClaw 的边界
- 想理解 browser package、skill routing、execution honesty
- 想确认 browser truth 为什么不能直接让 OpenClaw 拥有

这篇是**产品边界和运行边界定义**。

### [TURN_ENGINE_DESIGN.md](./TURN_ENGINE_DESIGN.md)

适合场景：

- 想理解 ask / skill / handoff / gentab 是怎么被统一成 turn 的
- 想理解 `ExecutionPlan`、`TurnReceipt`、`TurnJournal`
- 想继续推进 runtime/turns

这篇是**执行主链设计稿**。

### [GENTAB_PRD.md](./GENTAB_PRD.md)

适合场景：

- 想理解 GenTab 为什么是 Sabrina 的关键能力
- 想看 GenTab 的完整输入、输出、UI、容错和验收要求
- 想知道它和 Google Disco 的关系，但不偏离 Sabrina 定位

这篇是**GenTab 的完整产品需求文档**。

### [ENGINEERING_SYSTEM.md](./ENGINEERING_SYSTEM.md)

适合场景：

- 想知道什么是 stop-ship
- 想知道什么叫完成
- 想知道 P0 / P1 / P2 的工程含义

这篇是**工程治理层**。

### [ACCEPTANCE_MATRIX.md](./ACCEPTANCE_MATRIX.md)

适合场景：

- 想知道关键用户流有哪些
- 想知道改了什么后该验哪些 flow

这篇是**关键流清单**。

### [ITERATION_LOOP.md](./ITERATION_LOOP.md)

适合场景：

- 想知道每轮改动应该怎么推进
- 想区分 hotfix / stabilization / capability
- 想避免边界漂移

这篇是**迭代纪律**。

### [DESIGN_BASELINE.md](./DESIGN_BASELINE.md)

适合场景：

- 想改 UI / 线程系统 / 视觉基线
- 想知道什么风格和结构属于 Sabrina

这篇是**界面与体验基线**。

### [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md)

适合场景：

- 想知道接下来最该继续的工程线
- 想把“下一步”从口号变成具体交付

这篇是**执行计划**。

### [CLAUDE_CODE_LEARNINGS.md](./CLAUDE_CODE_LEARNINGS.md)

适合场景：

- 想知道我们从 Claude Code 学到了什么
- 想区分“值得学的机制”与“不该照搬的形态”
- 想把学习结果落回 Sabrina 自己的定位

这篇是**外部参考到内部策略的桥接**。

---

## 按角色推荐阅读

### 产品 / 设计

建议顺序：

1. [SYSTEM_STATE.md](./SYSTEM_STATE.md)
2. [BROWSER_OPENCLAW_ARCHITECTURE.md](./BROWSER_OPENCLAW_ARCHITECTURE.md)
3. [DESIGN_BASELINE.md](./DESIGN_BASELINE.md)

### 应用层 / UI 开发

建议顺序：

1. [SYSTEM_STATE.md](./SYSTEM_STATE.md)
2. [TURN_ENGINE_DESIGN.md](./TURN_ENGINE_DESIGN.md)
3. [ENGINEERING_SYSTEM.md](./ENGINEERING_SYSTEM.md)
4. [ACCEPTANCE_MATRIX.md](./ACCEPTANCE_MATRIX.md)

### Runtime / OpenClaw / Host 开发

建议顺序：

1. [SYSTEM_STATE.md](./SYSTEM_STATE.md)
2. [BROWSER_OPENCLAW_ARCHITECTURE.md](./BROWSER_OPENCLAW_ARCHITECTURE.md)
3. [TURN_ENGINE_DESIGN.md](./TURN_ENGINE_DESIGN.md)
4. [CLAUDE_CODE_LEARNINGS.md](./CLAUDE_CODE_LEARNINGS.md)
5. [ENGINEERING_SYSTEM.md](./ENGINEERING_SYSTEM.md)

---

## 不该跳过的事实

- Sabrina 不是浏览器里的第二套 OpenClaw 平台
- Browser Context Package 先是 Sabrina runtime object，再投影给 OpenClaw
- thread continuity 不等于统一 memory substrate
- Sabrina overlay 可以存在，但不能伪装成 OpenClaw declared truth
- 工程门禁是系统的一部分，不是上线前补跑的附属动作

---

## 最后一句

如果要一句话描述这套文档阅读方法：

**先看当前真相，再看边界，再看执行主链，最后看工程治理。**
