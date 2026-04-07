# Sabrina 接入 OpenClaw

这份文档给第一次使用 Sabrina 的用户。

目标只有一个：**把 Sabrina 接到你的 OpenClaw 上，然后直接开始用。**

## 你会看到的两种连接方式

### 1. 本机

适合：

- Sabrina 和 OpenClaw 在同一台机器
- 你已经能在终端里正常运行 `openclaw`

推荐顺序：

1. 启动 Sabrina
2. 打开 `OpenClaw` 设置页
3. 选择 `本机`
4. 点 `开始连接`
5. 如果需要，再点一次 `重新检查`

成功后你会看到：

- 已接入
- 当前浏览器开始复用 OpenClaw
- 模型、技能、记忆都能直接用

## 2. 远程

适合：

- 你的 OpenClaw 跑在另一台机器上
- 你想在 Sabrina 里切过去使用它

Sabrina 现在支持两种远程方式：

### 2.1 通过 SSH

适合：

- 你已经配好了免交互 SSH
- 远端机器上已经装好 OpenClaw

推荐顺序：

1. 打开 `OpenClaw` 设置页
2. 选择 `远程`
3. 选择 `通过 SSH`
4. 填 `SSH 目标`
5. 先点 `快速检查`
6. 检查通过后，再点 `连接远程`
7. 如果以后还会切回来，点 `保存目标`

也可以直接在终端里先做一次快速检查：

```bash
openclaw sabrina probe --target remote --driver ssh-cli --ssh-target root@example.com
```

快速检查会告诉你：

- 远端是不是可达
- Gateway 是不是正常
- 默认模型是什么
- 最近会话是不是正常

注意：

- Sabrina 的 SSH 模式不会弹密码框
- 如果远端需要手输密码，`快速检查` 会直接失败
- 更稳的方式是先配好 SSH key / ssh-agent，再回到 Sabrina 里连接

### 2.2 通过连接码

适合：

- 不方便直接 SSH
- 想通过 Sabrina 生成一次性连接码

推荐顺序：

1. 选择 `远程`
2. 选择 `通过连接码`
3. 填 `Relay 地址`
4. 点 `生成连接码`
5. Sabrina 会给你一条远端命令
6. 在远端 OpenClaw 机器上执行那条命令
7. 等待 Sabrina 显示远端已认领、worker 已就绪
8. 再正式连接

如果你想先确认 relay 参数，也可以在终端里检查：

```bash
openclaw sabrina probe --target remote --driver relay-paired --relay-url https://relay.example.com --connect-code 482913
```

## 保存多个 OpenClaw

Sabrina 现在支持：

- 保存多个 OpenClaw 目标
- 但一次只激活一个

建议：

- 经常使用的远端机器先保存
- 需要切换时，直接在“已保存的 OpenClaw”里点 `连接`

## 常见问题

### `fetch failed`

这通常不是远端 OpenClaw 本身挂了，而是 **本机 Sabrina connector bridge 没起来**。

优先这样做：

1. 确认 Sabrina 正在运行
2. 回到 `OpenClaw` 设置页
3. 重新做一次连接或检查

现在插件也会尝试自动恢复陈旧的本地桥信息，但如果 Sabrina 根本没打开，还是需要先启动 Sabrina。

### SSH 能连上，但 Sabrina 里还是显示需要处理

优先点：

- `快速检查`

如果快速检查通过，但连接仍有问题，再点：

- `详细诊断`

### 连接码模式卡在等待认领

先确认：

1. `Relay 地址` 正确
2. 远端机器已经执行 Sabrina 给出的命令
3. 连接码还没过期

## 给维护者的建议

如果你在帮助别人远程接入 OpenClaw，最省心的路径通常是：

1. 先让用户在 Sabrina 里做 `快速检查`
2. 再决定走 `SSH` 还是 `连接码`
3. 常用远端先保存成目标，后面直接切换
