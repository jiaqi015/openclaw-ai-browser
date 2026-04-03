import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { UiPreferencesProvider } from "./application/use-ui-preferences.tsx";
import { AppErrorBoundary } from "./components/app-error-boundary.tsx";
import "./index.css";
import {
  getSabrinaMonitor,
  reportRendererEvent,
} from "./lib/sabrina-desktop";

function safeSerialize(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function attachRendererMonitoring() {
  if (!getSabrinaMonitor()) {
    return;
  }

  window.addEventListener("error", (event) => {
    void reportRendererEvent({
      level: "error",
      scope: "renderer",
      message: event.message || "窗口 error 事件",
      kind: "window-error",
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: safeSerialize(event.error),
      },
      url: window.location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    void reportRendererEvent({
      level: "error",
      scope: "renderer",
      message: "发生未处理 Promise 拒绝",
      kind: "unhandled-rejection",
      details: safeSerialize(event.reason),
      url: window.location.href,
    });
  });

  const nativeWarn = console.warn.bind(console);
  const nativeError = console.error.bind(console);

  console.warn = (...args) => {
    void reportRendererEvent({
      level: "warn",
      scope: "console",
      message: args.map((item) => String(item)).join(" ").slice(0, 500),
      kind: "console-warn",
      details: safeSerialize(args),
      url: window.location.href,
    });
    nativeWarn(...args);
  };

  console.error = (...args) => {
    void reportRendererEvent({
      level: "error",
      scope: "console",
      message: args.map((item) => String(item)).join(" ").slice(0, 500),
      kind: "console-error",
      details: safeSerialize(args),
      url: window.location.href,
    });
    nativeError(...args);
  };
}

attachRendererMonitoring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <UiPreferencesProvider>
        <App />
      </UiPreferencesProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
