# Sabrina 接入 OpenClaw

这份文档给第一次使用 Sabrina 的用户。

目标只有一个：**把 Sabrina 接到你的 OpenClaw 上，然后直接开始用。**

## 你会看到的两条路径

### 1. 本机

适合：

- Sabrina 和 OpenClaw 在同一台机器
- 你已经能在终端里正常运行 `openclaw`

推荐顺序：

1. 启动 Sabrina
2. 打开 `OpenClaw` 设置页
3. 直接点 `自动连接这台机器`
4. 如果需要，再点一次 `重新检查`

成功后你会看到：

- 已接入
- 当前浏览器开始复用 OpenClaw
- 模型、技能、记忆都能直接用

## 2. 另一台机器

适合：

- 你的 OpenClaw 跑在另一台机器上
- 你想在 Sabrina 里切过去使用它

Sabrina 现在把“**连接地址 + 连接码**”当成另一台机器的主路径。

### 2.1 通过连接地址和连接码

适合：

- 不方便直接 SSH
- 想通过 Sabrina 生成一次性连接码并在另一台机器上认领

推荐顺序：

1. 点 `连接另一台机器`
2. 填 `连接地址`
3. 点 `生成连接码`
4. Sabrina 会给你一条需要在另一台机器执行的命令
5. 在那台 OpenClaw 机器上执行那条命令
6. 等待 Sabrina 显示远端已认领、worker 已就绪
7. 回到 Sabrina，点 `连接这台机器`
8. 如果以后还会切回来，点 `保存这台机器`

如果你想先确认参数，也可以在终端里检查：

```bash
openclaw sabrina probe --target remote --driver relay-paired --relay-url https://relay.example.com --connect-code 482913
```

## 保存多个 OpenClaw

Sabrina 现在支持：

- 保存多个 OpenClaw 目标
- 但一次只激活一个

建议：

- 经常使用的机器先保存
- 需要切换时，直接在“已保存的 OpenClaw”里点 `连接`

## 常见问题

### `fetch failed`

这通常不是另一台机器上的 OpenClaw 本身挂了，而是 **本机 Sabrina connector bridge 没起来**。

优先这样做：

1. 确认 Sabrina 正在运行
2. 回到 `OpenClaw` 设置页
3. 重新做一次连接或检查

现在插件也会尝试自动恢复陈旧的本地桥信息，但如果 Sabrina 根本没打开，还是需要先启动 Sabrina。

### SSH 能连上，但 Sabrina 里还是显示需要处理

SSH 不再是 Sabrina 远程连接的主路径。

如果你看到的是旧版 SSH 目标：

1. 保留这个目标没问题
2. 但更推荐重新建一个 `连接地址 + 连接码` 的远程目标
3. 后续主交互会优先围绕连接码工作

### 连接码模式卡在等待认领

先确认：

1. `连接地址` 正确
2. 远端机器已经执行 Sabrina 给出的命令
3. 连接码还没过期

## 给维护者的建议

如果你在帮助别人远程接入 OpenClaw，最省心的路径通常是：

1. 先让用户填 `连接地址`
2. 生成连接码并拉起远端 worker
3. `检查` 通过后再连接
4. 常用远端先保存成目标，后面直接切换
