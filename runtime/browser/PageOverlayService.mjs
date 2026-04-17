/**
 * PageOverlayService.mjs (Refined)
 * Visual enhancement layer for the in-page Sabrina agent overlay.
 */

const OVERLAY_STYLE_TEXT = `
  @keyframes sabrina-ripple {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 4px; }
    100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; border-width: 1px; }
  }
  .sabrina-ripple {
    position: absolute;
    width: 40px;
    height: 40px;
    border: 2px solid #FF2D55;
    border-radius: 50%;
    animation: sabrina-ripple 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    pointer-events: none;
    box-shadow: 0 0 20px rgba(255, 45, 85, 0.3);
  }
  .updating {
    opacity: 0.55;
    filter: blur(4px);
    transform: translateY(1px);
  }
`;

const INJECT_OVERLAY_SCRIPT = `(() => {
  if (!document.body || !document.head) {
    return;
  }

  if (document.getElementById('sabrina-agent-overlay')) {
    const bar = document.getElementById('sabrina-status-bar');
    if (bar) bar.style.opacity = '1';
    return;
  }

  const existingStyle = document.getElementById('sabrina-agent-overlay-style');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'sabrina-agent-overlay-style';
    style.textContent = ${JSON.stringify(OVERLAY_STYLE_TEXT)};
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.id = 'sabrina-agent-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';

  const cursor = document.createElement('div');
  cursor.id = 'sabrina-cursor';
  cursor.style.position = 'absolute';
  cursor.style.width = '24px';
  cursor.style.height = '24px';
  cursor.style.left = '50%';
  cursor.style.top = '50%';
  cursor.style.background = 'rgba(255, 45, 85, 0.4)';
  cursor.style.border = '2px solid white';
  cursor.style.borderRadius = '50%';
  cursor.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
  cursor.style.boxShadow = '0 0 15px rgba(255, 45, 85, 0.6), inset 0 0 5px white';
  cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  cursor.style.zIndex = '2';
  cursor.style.display = 'flex';
  cursor.style.alignItems = 'center';
  cursor.style.justifyContent = 'center';
  cursor.innerHTML = '<span style="font-size: 14px; margin-left: 20px; margin-top: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5))">&#128070;</span>';

  const statusBar = document.createElement('div');
  statusBar.id = 'sabrina-status-bar';
  statusBar.style.position = 'absolute';
  statusBar.style.bottom = '40px';
  statusBar.style.left = '50%';
  statusBar.style.transform = 'translateX(-50%) translateY(0)';
  statusBar.style.padding = '12px 24px';
  statusBar.style.background = 'rgba(12, 12, 12, 0.75)';
  statusBar.style.backdropFilter = 'blur(24px) saturate(200%)';
  statusBar.style.webkitBackdropFilter = 'blur(24px) saturate(200%)';
  statusBar.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  statusBar.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)';
  statusBar.style.borderRadius = '32px';
  statusBar.style.color = 'white';
  statusBar.style.fontSize = '12px';
  statusBar.style.fontWeight = '600';
  statusBar.style.letterSpacing = '0.04em';
  statusBar.style.textTransform = 'uppercase';
  statusBar.style.display = 'flex';
  statusBar.style.alignItems = 'center';
  statusBar.style.gap = '12px';
  statusBar.style.opacity = '0';
  statusBar.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
  statusBar.innerHTML =
    '<div id="sabrina-status-dot" style="width: 8px; height: 8px; background: #FF2D55; border-radius: 50%; box-shadow: 0 0 10px #FF2D55; transition: background 0.4s ease"></div>' +
    '<span id="sabrina-status-text" style="transition: all 0.2s ease">Sabrina Agent Active</span>';

  overlay.appendChild(cursor);
  overlay.appendChild(statusBar);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    statusBar.style.opacity = '1';
  });
})()`;

function buildStatusScript(text, color) {
  return `(() => {
    const textEl = document.getElementById('sabrina-status-text');
    const dotEl = document.getElementById('sabrina-status-dot');
    const nextText = ${JSON.stringify(text)};
    const nextColor = ${JSON.stringify(color)};

    if (textEl && textEl.innerText !== nextText) {
      textEl.classList.add('updating');
      setTimeout(() => {
        textEl.innerText = nextText;
        textEl.classList.remove('updating');
      }, 150);
    }

    if (dotEl) {
      dotEl.style.background = nextColor;
      dotEl.style.boxShadow = \`0 0 10px \${nextColor}\`;
    }
  })()`;
}

function buildMoveCursorScript(x, y, isClick) {
  return `(() => {
    const cursor = document.getElementById('sabrina-cursor');
    const overlay = document.getElementById('sabrina-agent-overlay');
    if (!cursor || !overlay) return;

    cursor.style.left = ${JSON.stringify(`${x}px`)};
    cursor.style.top = ${JSON.stringify(`${y}px`)};

    if (${isClick ? "true" : "false"}) {
      const ripple = document.createElement('div');
      ripple.className = 'sabrina-ripple';
      ripple.style.left = ${JSON.stringify(`${x}px`)};
      ripple.style.top = ${JSON.stringify(`${y}px`)};
      overlay.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);

      cursor.style.transform = 'translate(-2px, -2px) scale(0.85)';
      setTimeout(() => {
        cursor.style.transform = 'translate(-2px, -2px) scale(1)';
      }, 150);
    }
  })()`;
}

const CLEANUP_SCRIPT = `(() => {
  const overlay = document.getElementById('sabrina-agent-overlay');
  if (overlay) {
    overlay.style.transition = 'all 0.4s ease';
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(0.98)';
    setTimeout(() => overlay.remove(), 450);
  }
})()`;

export async function injectOverlay(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  try {
    await webContents.executeJavaScript(INJECT_OVERLAY_SCRIPT);
  } catch (error) {
    console.warn("[Overlay] UI injection blocked by CSP or page error:", error?.message || error);
  }
}

export async function updateOverlayStatus(webContents, text, type = "info") {
  if (!webContents || webContents.isDestroyed()) return;

  const colorMap = {
    info: "#FF2D55",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#FF2D55",
  };
  const color = colorMap[type] || colorMap.info;

  try {
    await webContents.executeJavaScript(buildStatusScript(text, color));
  } catch {
    // Ignore overlay-only failures so page automation can continue.
  }
}

export async function moveCursorTo(webContents, x, y, isClick = false) {
  if (!webContents || webContents.isDestroyed()) return;

  try {
    await webContents.executeJavaScript(buildMoveCursorScript(x, y, isClick));
  } catch {
    // Cursor motion is decorative; do not fail the task on overlay issues.
  }
}

export async function cleanupOverlay(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  try {
    await webContents.executeJavaScript(CLEANUP_SCRIPT);
  } catch {
    // Overlay cleanup should never block the main flow.
  }
}
