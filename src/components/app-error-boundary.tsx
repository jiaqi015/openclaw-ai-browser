import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, FolderOpen, RefreshCw } from "lucide-react";
import {
  openMonitorLogDirectory,
  reportRendererEvent,
} from "../lib/sabrina-desktop";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  };

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error });
    void reportRendererEvent({
      level: "error",
      scope: "renderer",
      message: "React 渲染树发生未捕获错误",
      kind: "react-error-boundary",
      details: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        componentStack: info.componentStack,
      },
    });
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="surface-screen min-h-screen text-white flex items-center justify-center p-8">
        <div className="surface-panel w-full max-w-2xl rounded-[28px] border p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-500/15 p-3 text-red-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                应用界面遇到了未处理错误
              </h1>
              <p className="mt-2 text-sm leading-7 text-white/60">
                错误已经写入本地诊断日志。你可以先刷新界面继续使用，也可以直接打开日志目录排查。
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-medium text-white">
              {this.state.error.name || "Error"}
            </p>
            <p className="mt-2 text-sm text-white/55">
              {this.state.error.message || "未知错误"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="surface-button-system inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </button>
            <button
              onClick={() => void openMonitorLogDirectory()}
              className="surface-button-system inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
            >
              <FolderOpen className="h-4 w-4" />
              打开日志目录
            </button>
          </div>
        </div>
      </div>
    );
  }
}
