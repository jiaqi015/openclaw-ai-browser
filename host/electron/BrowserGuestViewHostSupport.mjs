import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebContentsView } from "electron";
import { bindGuestContents } from "./monitoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guestPreloadPath = path.join(__dirname, "browser-preload.cjs");

export function createBrowserGuestView() {
  return new WebContentsView({
    webPreferences: {
      preload: guestPreloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
}

export function bindBrowserGuestContents(tabId, contents) {
  bindGuestContents(tabId, contents);
}
