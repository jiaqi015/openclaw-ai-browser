/**
 * Hook that drives the CodingGenTabSurface lifecycle:
 *
 *  1. On mount — read pending metadata from the store (referenceTabIds, userIntent)
 *  2. Auto-start generation via gentab.generateCoding (no user button press)
 *  3. Expose { status, stage, stageLabel, gentab, error } to the surface
 *
 * "Stage" is a UI concept used by the loading theatre. Even though generation
 * is a single async IPC call, we advance through stages on a timer to give
 * the impression of a working agent. The real call runs in parallel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";

// The stages the loading theatre cycles through
export type CodingGenTabStage =
  | "reading"    // Reading your tabs…
  | "thinking"   // Thinking about the best shape…
  | "coding"     // Writing the code…
  | "checking"   // Almost done, checking…
  | "done"
  | "error";

export interface StageInfo {
  stage: CodingGenTabStage;
  label: string;
  sublabel: string;
  progressPct: number;
}

const STAGES: StageInfo[] = [
  {
    stage: "reading",
    label: "正在读你打开的网页",
    sublabel: "提取标题、正文和关键数据…",
    progressPct: 12,
  },
  {
    stage: "thinking",
    label: "在想最合适的表现形式",
    sublabel: "这件事应该长什么样？不是表格，是一个网页…",
    progressPct: 32,
  },
  {
    stage: "coding",
    label: "开始写代码",
    sublabel: "构建交互、填入真实数据、加上动画…",
    progressPct: 65,
  },
  {
    stage: "checking",
    label: "差不多了，自检一遍",
    sublabel: "确保数据对得上、交互能点通…",
    progressPct: 88,
  },
];

// Advance through stages at these millisecond intervals (approximate)
const STAGE_DURATIONS_MS = [4_000, 8_000, 20_000, 10_000];

export type CodingGenTabStatus = "idle" | "generating" | "done" | "error";

export interface CodingGenTabState {
  status: CodingGenTabStatus;
  stageInfo: StageInfo;
  progressPct: number;
  gentab: CodingGenTabData | null;
  error: string | null;
  title: string | null;
  designChoice: string | null;
}

const IDLE_STAGE: StageInfo = {
  stage: "reading",
  label: "准备中",
  sublabel: "",
  progressPct: 0,
};

function buildErrorStage(msg: string): StageInfo {
  return {
    stage: "error",
    label: "生成失败",
    sublabel: msg,
    progressPct: 0,
  };
}

export function useCodingGenTabState(params: {
  genId: string;
  url: string;
  onClose?: (genId: string) => void;
}) {
  const { genId, onClose } = params;
  const desktop = getSabrinaDesktop();

  const [status, setStatus] = useState<CodingGenTabStatus>("idle");
  const [stageInfo, setStageInfo] = useState<StageInfo>(IDLE_STAGE);
  const [progressPct, setProgressPct] = useState(0);
  const [gentab, setGentab] = useState<CodingGenTabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  // Refinement: when set, the next generation run uses these instead of starting fresh
  const pendingMetaRef = useRef<SabrinaPendingGenTabMetadata | null>(null);
  const refinementTextRef = useRef<string>("");
  const originalHtmlRef = useRef<string>("");

  // Smooth progress interpolation between stage waypoints
  const progressRafRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);

  const animateProgress = useCallback((target: number) => {
    targetProgressRef.current = target;
    const tick = () => {
      const curr = currentProgressRef.current;
      const tgt = targetProgressRef.current;
      if (Math.abs(curr - tgt) < 0.5) {
        currentProgressRef.current = tgt;
        setProgressPct(Math.round(tgt));
        return;
      }
      const next = curr + (tgt - curr) * 0.04;
      currentProgressRef.current = next;
      setProgressPct(Math.round(next));
      progressRafRef.current = requestAnimationFrame(tick);
    };
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    progressRafRef.current = requestAnimationFrame(tick);
  }, []);

  // Stage timer: advances UI stages while the IPC call runs in background
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startStageTimer = useCallback(() => {
    let idx = 0;
    const advance = () => {
      if (idx >= STAGES.length) return;
      const info = STAGES[idx];
      setStageInfo(info);
      animateProgress(info.progressPct);
      idx++;
      if (idx < STAGES.length) {
        stageTimerRef.current = setTimeout(advance, STAGE_DURATIONS_MS[idx - 1]);
      }
    };
    advance();
  }, [animateProgress]);

  const stopStageTimer = useCallback(() => {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  // Main generation effect — fires on mount and on retry
  useEffect(() => {
    if (!desktop || !genId) return;

    let cancelled = false;

    async function run() {
      if (!desktop) return;
      setStatus("generating");
      startStageTimer();

      // Load pending metadata to know which tabs to reference
      let pendingMeta: SabrinaPendingGenTabMetadata | null = null;
      try {
        const stateResult = await desktop.gentab.getState({ genId });
        if (stateResult.success) {
          // Check if already generated (user navigated back to a done coding gentab)
          const existing = stateResult.gentab as unknown as CodingGenTabData | undefined;
          if (existing?.schemaVersion === "coding") {
            stopStageTimer();
            setGentab(existing);
            setStatus("done");
            animateProgress(100);
            return;
          }
          pendingMeta = stateResult.pendingMetadata ?? null;
        }
      } catch {
        // ignore — will fail gracefully below
      }

      // Cache pendingMeta so refinement runs can reuse it
      if (pendingMeta) pendingMetaRef.current = pendingMeta;

      // For refinement runs, fall back to cached meta if fresh meta not available
      const effectiveMeta = pendingMeta ?? pendingMetaRef.current;

      if (!effectiveMeta || !effectiveMeta.referenceTabIds?.length) {
        stopStageTimer();
        setError("找不到来源标签页，无法生成 GenTab");
        setStageInfo(buildErrorStage("找不到来源标签页，无法生成 GenTab"));
        setStatus("error");
        return;
      }

      // Grab refinement context (if this is a refine run)
      const activeRefinementText = refinementTextRef.current;
      const activeOriginalHtml = originalHtmlRef.current;
      // Clear refs so subsequent retries are clean
      refinementTextRef.current = "";
      originalHtmlRef.current = "";

      let result: Awaited<ReturnType<NonNullable<typeof desktop>["gentab"]["generateCoding"]>>;
      try {
        result = await desktop.gentab.generateCoding({
          genId,
          referenceTabIds: effectiveMeta.referenceTabIds,
          userIntent: effectiveMeta.userIntent,
          ...(activeRefinementText ? { refinementText: activeRefinementText, originalHtml: activeOriginalHtml } : {}),
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        stopStageTimer();
        setError(msg);
        setStageInfo(buildErrorStage(msg));
        setStatus("error");
        return;
      }

      if (cancelled) return;
      stopStageTimer();

      if (!result.success) {
        const msg = ("error" in result && result.error) ? result.error : "生成失败";
        setError(msg);
        setStageInfo(buildErrorStage(msg));
        setStatus("error");
        return;
      }

      animateProgress(100);
      setGentab(result.gentab);
      setStatus("done");
      desktop.gentab.markGenerationCompleted(genId);
    }

    run();

    return () => {
      cancelled = true;
      stopStageTimer();
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genId, desktop, startStageTimer, stopStageTimer, animateProgress, retryKey]);

  const handleClose = useCallback(() => {
    onClose?.(genId);
  }, [genId, onClose]);

  const handleRetry = useCallback(() => {
    refinementTextRef.current = "";
    originalHtmlRef.current = "";
    setGentab(null);
    setError(null);
    setStatus("idle");
    setStageInfo(IDLE_STAGE);
    setProgressPct(0);
    currentProgressRef.current = 0;
    setRetryKey((k) => k + 1);
  }, []);

  /** Start a refinement pass — keeps original context, sends new instruction to the agent */
  const handleRefine = useCallback(
    (refinementText: string, currentHtml: string) => {
      if (!refinementText.trim()) return;
      refinementTextRef.current = refinementText.trim();
      originalHtmlRef.current = currentHtml;
      setGentab(null);
      setError(null);
      setStatus("idle");
      setStageInfo(IDLE_STAGE);
      setProgressPct(0);
      currentProgressRef.current = 0;
      setRetryKey((k) => k + 1);
    },
    [],
  );

  return {
    status,
    stageInfo,
    progressPct,
    gentab,
    error,
    handleClose,
    handleRetry,
    handleRefine,
  };
}
