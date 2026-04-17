import { useState, useEffect, useCallback } from "react";

export interface AgentActionEntry {
  step: number;
  type: string;
  action?: any;
  risk?: string;
  element?: any;
  result?: any;
  message?: string;
  summary?: string;
  timestamp: number;
  screenshot?: string; // Base64
  reasoning?: string;
  axLabel?: string;
}


export function useBrowserAgentState(tabId: string | null) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [journal, setJournal] = useState<AgentActionEntry[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [taskTree, setTaskTree] = useState<any[]>([]);

  const runTask = useCallback(async (task: string, userData?: any, threadId?: string) => {
    if (!tabId) return;
    
    setError(null);
    setSummary(null);
    setWarnings([]);
    setJournal([]);
    setTaskTree([]);
    
    const result = await window.sabrinaDesktop?.agent?.runBrowserTask({
      tabId,
      task,
      userData,
      threadId // Pass it through properly
    });

    if (result?.ok && result.taskId) {
      setActiveTaskId(result.taskId);
      setStatus("running");
    } else {
      setError(result?.error || "启动任务失败");
    }
  }, [tabId]);

  const stopTask = useCallback(async () => {
    if (activeTaskId) {
      await window.sabrinaDesktop?.agent?.stop({ taskId: activeTaskId });
    }
  }, [activeTaskId]);

  const respondConfirm = useCallback(async (confirmed: boolean) => {
    if (activeTaskId && pendingConfirm) {
      await window.sabrinaDesktop?.agent?.confirmResponse({ taskId: activeTaskId, confirmed });
      setPendingConfirm(null);
    }
  }, [activeTaskId, pendingConfirm]);

  useEffect(() => {
    if (!window.sabrinaDesktop?.agent) return;

    const unsubs = [
      window.sabrinaDesktop.agent.onProgress((data) => {
        if (data.taskId !== activeTaskId) return;
        
        setJournal(prev => {
          const entry: AgentActionEntry = {
            step: data.step,
            type: data.type,
            action: data.action,
            risk: data.risk,
            element: data.element,
            result: data.result,
            message: data.message,
            screenshot: data.screenshot,
            reasoning: data.reasoning,
            axLabel: data.axLabel || data.element?.name,
            timestamp: Date.now()
          };
          if (data.taskTree) {
            setTaskTree(data.taskTree);
          }
          return [...prev, entry];
        });

      }),

      window.sabrinaDesktop.agent.onRequestConfirm((data) => {
        if (data.taskId !== activeTaskId) return;
        setStatus("paused");
        setPendingConfirm(data);
      }),

      window.sabrinaDesktop.agent.onCompleted((data) => {
        if (data.taskId !== activeTaskId) return;
        setStatus(data.status);
        setSummary(data.summary);
        setError(data.error);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        if (data.status === "completed" || data.status === "error" || data.status === "cancelled") {
          setActiveTaskId(null);
        }
      })
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [activeTaskId]);

  return {
    activeTaskId,
    status,
    journal,
    pendingConfirm,
    error,
    summary,
    warnings,
    taskTree,
    runTask,
    stopTask,
    respondConfirm
  };
}
