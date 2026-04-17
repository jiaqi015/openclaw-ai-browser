import { cdpDriver } from "./CdpDriverService.mjs";

/**
 * PageActionExecutor.mjs
 * 操作层：执行 5 个原子操作，V2 版引入 CDP 拟真点击与按键。
 */

export async function executeAction(webContents, action) {
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: "webContents is not available" };
  }

  const { index, text, value, direction, url } = action;
  const actionType = action.action ?? action.type; // 兼容 LLM 的 action.action 和旧路径的 action.type

  try {
    switch (actionType) {
      case "click":
        return await executeClick(webContents, action.rect || action.element?.rect, action.element?.backendNodeId);
      case "fill":
        return await executeFill(webContents, action.rect || action.element?.rect, text, action.element?.backendNodeId, action.submit);
      case "select":
        return await executeSelect(webContents, action.element?.backendNodeId, value);
      case "scroll":
        return await executeScroll(webContents, direction);
      case "navigate":
        return await executeNavigate(webContents, url);
      default:
        return { ok: false, error: `Unknown action type: ${actionType}` };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function executeClick(webContents, rect, targetNodeId) {
  if (!rect) return { ok: false, error: "Missing element coordinates for click" };

  const x = Math.round(rect.x + rect.w / 2);
  const y = Math.round(rect.y + rect.h / 2);

  // 1. 工业级命中测试 (Hit-Testing)
  if (targetNodeId) {
    const hitNodeId = await cdpDriver.getNodeForLocation(webContents, x, y);
    if (hitNodeId !== targetNodeId) {
      console.warn(`[Action] Hit-test mismatch: Target=${targetNodeId}, Hit=${hitNodeId}. Potential overlay detected.`);
    }
  }

  // 2. 使用 CDP 发送物理点击
  await cdpDriver.mouseClick(webContents, x, y);

  // 2. V9: 收集视觉验证证据
  await new Promise(r => setTimeout(r, 500));
  const screenshot = await cdpDriver.captureElementScreenshot(webContents, {
    x: x - 50, y: y - 25, w: 100, h: 50
  }).catch(() => null);

  return { 
    ok: true, 
    screenshot,
    urlChanged: false 
  };
}

async function executeFill(webContents, rect, text, backendNodeId, submit = false) {
  if (!rect) return { ok: false, error: "Missing element coordinates for fill" };
  const isPassword = text === "__PASSWORD__";

  const x = Math.round(rect.x + rect.w / 2);
  const y = Math.round(rect.y + rect.h / 2);

  // 1. 物理点击聚焦
  await cdpDriver.mouseClick(webContents, x, y);

  // 2. 清空现有内容 (Ctrl+A + 覆盖输入)，modifiers: 2 = Ctrl（跨平台）
  await cdpDriver.sendCommand(webContents, 'Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', windowsVirtualKeyCode: 65 });
  await cdpDriver.sendCommand(webContents, 'Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', windowsVirtualKeyCode: 65 });

  // 3. 模拟物理按键输入
  if (!isPassword) {
    await cdpDriver.keyType(webContents, text);
    // 仅当 LLM 明确要求提交（submit:true）或这是搜索框时才回车
    if (submit) {
      await cdpDriver.keyType(webContents, '\r');
    }
  }

  // 3. V9: 收集视觉验证证据
  await new Promise(r => setTimeout(r, 500));
  const screenshot = await cdpDriver.captureElementScreenshot(webContents, {
    x: x - 100, y: y - 25, w: 200, h: 50
  }).catch(() => null);

  return { 
    ok: true, 
    isPasswordEntry: isPassword,
    screenshot,
    domChanged: true 
  };
}

async function executeSelect(webContents, backendNodeId, value) {
  // 优先用 backendNodeId 定位（稳定），降级回 DOM 扫描
  if (backendNodeId) {
    try {
      const { object } = await cdpDriver.sendCommand(webContents, 'DOM.resolveNode', { backendNodeId });
      if (object?.objectId) {
        await cdpDriver.sendCommand(webContents, 'Runtime.callFunctionOn', {
          objectId: object.objectId,
          functionDeclaration: `function(v) {
            this.scrollIntoView({ behavior: 'instant', block: 'center' });
            this.value = v;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, elementText: this.value };
          }`,
          arguments: [{ value }],
          returnByValue: true
        });
        return { ok: true, domChanged: true };
      }
    } catch (err) {
      console.warn('[Action] executeSelect via backendNodeId failed, falling back:', err);
    }
  }
  // 降级：通过 CSS 扫描
  return await webContents.executeJavaScript(`(() => {
    const elements = Array.from(document.querySelectorAll('select')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!elements.length) return { ok: false, error: 'No select element found' };
    const el = elements[0];
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, elementText: el.value };
  })()`);
}

async function executeScroll(webContents, direction) {
  const amount = direction === "up" ? -1 : 1; // 1 = down, -1 = up，不做字符串插值
  return await webContents.executeJavaScript(`(() => {
    window.scrollBy(0, window.innerHeight * 0.8 * ${amount});
    return { ok: true };
  })()`);
}

async function executeNavigate(webContents, url) {
  try {
    await webContents.loadURL(url);
    return { ok: true, urlChanged: true, newUrl: url };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

