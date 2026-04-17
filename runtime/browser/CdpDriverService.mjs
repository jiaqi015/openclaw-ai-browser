/**
 * CdpDriverService.mjs
 * 负责与 Electron webContents.debugger 进行通信，封装常用的 CDP 指令。
 */

export class CdpDriverService {
  constructor() {
    this.activeDebuggerMap = new Set(); // 存储已挂载的 webContents ID
  }

  /**
   * 挂载调试器
   */
  async attach(webContents) {
    if (!webContents || webContents.isDestroyed()) return false;
    const id = webContents.id;
    const dbg = webContents.debugger;

    if (dbg.isAttached()) {
      this.activeDebuggerMap.add(id);
      return true;
    }

    // 3 次指数退避重试（应对 debugger busy / 时序竞争）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 先尝试强制 detach 清除可能遗留的僵尸连接
        if (attempt > 1) {
          try { dbg.detach(); } catch {}
          await new Promise(r => setTimeout(r, 400 * attempt));
        }

        dbg.attach('1.3');
        this.activeDebuggerMap.add(id);
        console.log(`[CDP] Attached to webContents ${id} (attempt ${attempt})`);

        // 启用必要的 Domain
        await this.sendCommand(webContents, 'Page.enable');
        await this.sendCommand(webContents, 'Network.enable');
        await this.sendCommand(webContents, 'Runtime.enable');
        await this.sendCommand(webContents, 'DOMSnapshot.enable');

        // 启用自动附加以追踪新打开的标签页 (V6 空间延续性)
        await this.sendCommand(webContents, 'Target.setAutoAttach', {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true
        });

        return true;
      } catch (err) {
        console.warn(`[CDP] Attach attempt ${attempt} failed for ${id}:`, err.message);
        if (attempt === 3) {
          console.error(`[CDP] All attach attempts exhausted for ${id}`);
          return false;
        }
      }
    }
    return false;
  }

  /**
   * 卸载调试器
   */
  async detach(webContents) {
    if (!webContents || webContents.isDestroyed()) return;
    const id = webContents.id;

    if (webContents.debugger.isAttached()) {
      webContents.debugger.detach();
      this.activeDebuggerMap.delete(id);
      console.log(`[CDP] Detached from webContents ${id}`);
    }
  }

  /**
   * 发送 CDP 指令
   */
  async sendCommand(webContents, method, params = {}) {
    if (!webContents || webContents.isDestroyed()) {
      throw new Error("webContents is destroyed");
    }

    const dbg = webContents.debugger;
    if (!dbg.isAttached()) {
      await this.attach(webContents);
    }

    return dbg.sendCommand(method, params);
  }

  /**
   * 获取增强的无障碍树 (AXTree)
   * V9+: 包含所有属性和计算值，用于高精度语义解析
   */
  async getAXTree(webContents) {
    try {
      await this.sendCommand(webContents, 'Accessibility.enable');
      // 获取全量无障碍树
      const { nodes } = await this.sendCommand(webContents, 'Accessibility.getFullAXTree');
      
      // V9+: 额外获取 DOM 树的根节点，用于跨模型索引对齐
      const { root } = await this.sendCommand(webContents, 'DOM.getDocument', { depth: -1, pierce: true });
      
      return { axNodes: nodes, domRoot: root };
    } catch (err) {
      console.error("[CDP] Failed to get AXTree:", err);
      return { axNodes: [], domRoot: null };
    }
  }

  /**
   * 原生网页快照获取 (V9: Native Capture)
   */
  async captureSnapshot(webContents, computedStyles = []) {
    // 默认请求一些关键样式
    const styles = computedStyles.length > 0 ? computedStyles : [
      "display", "visibility", "opacity", "position", "z-index"
    ];

    return this.sendCommand(webContents, 'DOMSnapshot.captureSnapshot', {
      computedStyles: styles,
      includeDOMRects: true,
      includePaintOrder: true
    });
  }

  /**
   * 获取节点的详细信息
   */
  async describeNode(webContents, backendNodeId) {
    return this.sendCommand(webContents, 'DOM.describeNode', { backendNodeId });
  }

  /**
   * 命中测试：验证坐标点下方的节点
   */
  async getNodeForLocation(webContents, x, y) {
    try {
      const { backendNodeId } = await this.sendCommand(webContents, 'DOM.getNodeForLocation', { x, y });
      return backendNodeId;
    } catch (err) {
      return null;
    }
  }

  /**
   * 截取特定元素的微缩图 (视觉证据)
   */
  async captureElementScreenshot(webContents, rect) {
    if (!webContents || webContents.isDestroyed()) return null;
    
    // 适当增加 Margin 以包含边框
    const margin = 5;
    const clip = {
      x: Math.max(0, rect.x - margin),
      y: Math.max(0, rect.y - margin),
      width: rect.w + (margin * 2),
      height: rect.h + (margin * 2),
      scale: 1
    };

    try {
      const { data } = await this.sendCommand(webContents, 'Page.captureScreenshot', {
        format: 'jpeg',
        quality: 60,
        clip
      });
      return data; // base64
    } catch (err) {
      console.warn("[CDP] Screenshot failed:", err);
      return null;
    }
  }

  /**
   * 精确模拟鼠标点击
   */

  async mouseClick(webContents, x, y, button = 'left') {
    await this.sendCommand(webContents, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x, y, button, clickCount: 1
    });
    // 模拟极速物理释放
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.sendCommand(webContents, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x, y, button, clickCount: 1
    });
  }

  /**
   * 模拟鼠标移动 (用于悬停效果)
   */
  async mouseMove(webContents, x, y) {
    await this.sendCommand(webContents, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x, y
    });
  }

  /**
   * 模拟键盘按键
   */
  async keyType(webContents, text) {
    // 简单的文本输入模拟，实际中可以支持更多按键
    for (const char of text) {
      await this.sendCommand(webContents, 'Input.dispatchKeyEvent', {
        type: 'char',
        text: char
      });
    }
  }

  /**
   * 精准等待网络静默 (Network Idle 2.0)
   */
  async waitForNetworkIdle(webContents, timeout = 10000, idleTime = 1000) {
    return new Promise((resolve) => {
      let inflight = 0;
      let lastActivity = Date.now();
      const dbg = webContents.debugger;

      const onMessage = (event, method, params) => {
        // 过滤常见的轮询请求，只考虑重要的子资源
        if (method === 'Network.requestWillBeSent') {
          inflight++;
          lastActivity = Date.now();
        } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
          inflight = Math.max(0, inflight - 1);
          lastActivity = Date.now();
        }
      };

      dbg.on('message', onMessage);

      const check = setInterval(() => {
        const now = Date.now();
        // 如果当前没有正在进行的请求且静默时间达标，则认为已就绪
        if (inflight === 0 && (now - lastActivity) >= idleTime) {
          cleanup();
          resolve(true);
        }
      }, 100);

      const cleanup = () => {
        clearInterval(check);
        dbg.removeListener('message', onMessage);
      };

      setTimeout(() => {
        cleanup();
        resolve(false); // 超时退出
      }, timeout);
    });
  }
}


// 单例导出
export const cdpDriver = new CdpDriverService();
