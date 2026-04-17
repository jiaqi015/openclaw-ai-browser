// Registers all IPC handlers. Keep handler logic thin — delegate to domain modules.
import { registerOpenClawIpcHandlers } from "./register-openclaw-ipc-handlers.mjs";
import { registerBrowserIpcHandlers } from "./register-browser-ipc-handlers.mjs";
import { registerThreadIpcHandlers } from "./register-thread-ipc-handlers.mjs";
import { registerGentabIpcHandlers } from "./register-gentab-ipc-handlers.mjs";
import { registerAgentIpcHandlers } from "./register-agent-ipc-handlers.mjs";

export function registerIpcHandlers(getMainWindow) {
  registerBrowserIpcHandlers(getMainWindow);
  registerThreadIpcHandlers();
  registerOpenClawIpcHandlers();
  registerGentabIpcHandlers(getMainWindow);
  registerAgentIpcHandlers();
}
