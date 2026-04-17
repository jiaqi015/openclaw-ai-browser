/**
 * VerifiedActionExecutor.mjs
 * Sabrina SAP V3 执行引擎 - 物理对齐与命中验证
 */

import { cdpDriver } from "./CdpDriverService.mjs";

export class VerifiedActionExecutor {
  /**
   * 执行具备多重验证的点击动作
   */
  static async executeClick(webContents, element) {
    if (!element || !element.rect) {
      return { ok: false, error: "Missing element data" };
    }

    try {
      // 1. 滚动到元素
      await cdpDriver.sendCommand(webContents, 'DOM.scrollIntoViewIfNeeded', {
        backendNodeId: element.backendNodeId
      });
      await new Promise(r => setTimeout(r, 300));

      // 2. 滚动后重新获取视口坐标（element.rect 是快照时的文档坐标，滚动后偏移变了）
      let x, y;
      try {
        const boxModel = await cdpDriver.sendCommand(webContents, 'DOM.getBoxModel', {
          backendNodeId: element.backendNodeId
        });
        // boxModel.model.content 是 [x1,y1, x2,y1, x2,y2, x1,y2]（顺时针四个角，viewport 坐标）
        const c = boxModel?.model?.content;
        if (c && c.length >= 6) {
          x = Math.round((c[0] + c[2]) / 2);
          y = Math.round((c[1] + c[5]) / 2);
        }
      } catch {}
      // 降级：用快照坐标（不理想，但总比崩溃好）
      if (x === undefined) {
        x = Math.round(element.rect.x + element.rect.w / 2);
        y = Math.round(element.rect.y + element.rect.h / 2);
      }

      // 3. 命中测试
      const hitNodeId = await cdpDriver.getNodeForLocation(webContents, x, y);
      if (hitNodeId !== element.backendNodeId) {
        console.warn(`[V3-Act] Hit mismatch! Expected: ${element.backendNodeId}, Got: ${hitNodeId}`);
      }

      // 4. 物理点击
      await cdpDriver.mouseClick(webContents, x, y);

      // 5. 视觉证据
      const screenshot = await cdpDriver.captureElementScreenshot(webContents, element.rect).catch(() => null);

      return { ok: true, screenshot, hitVerified: hitNodeId === element.backendNodeId };

    } catch (err) {
      console.error("[V3-Act] Click failed:", err);
      return { ok: false, error: err.message };
    }
  }

  /**
   * 执行文本输入，包括自动聚焦和可靠清空
   */
  static async executeFill(webContents, element, text) {
    if (!element) return { ok: false, error: "Missing element" };

    try {
      // 1. 聚焦
      await cdpDriver.sendCommand(webContents, 'DOM.focus', {
        backendNodeId: element.backendNodeId
      });

      // 2. 点击激活输入状态（不需要截图，直接用内部鼠标点击）
      const clickResult = await this.executeClick(webContents, element);
      if (!clickResult.ok) return clickResult;

      // 3. Ctrl+A 全选（含 keyUp，确保修饰键释放）+ 直接输入新内容覆盖选区
      await cdpDriver.sendCommand(webContents, 'Input.dispatchKeyEvent', {
        type: 'keyDown', modifiers: 2, key: 'a', windowsVirtualKeyCode: 65
      });
      await cdpDriver.sendCommand(webContents, 'Input.dispatchKeyEvent', {
        type: 'keyUp', modifiers: 2, key: 'a', windowsVirtualKeyCode: 65
      });

      // 4. 输入新文本（直接覆盖选区，比 Backspace 可靠）
      await cdpDriver.keyType(webContents, text);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
