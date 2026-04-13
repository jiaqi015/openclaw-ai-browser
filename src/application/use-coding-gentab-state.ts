/**
 * Hook that drives the CodingGenTabSurface lifecycle:
 *
 *  1. On mount — read pending metadata from the store (referenceTabIds, userIntent)
 *  2. Auto-start generation via gentab.generateCoding (no user button press)
 *  3. Subscribe to real IPC progress events from the main process
 *  4. Expose { status, stage, stageLabel, gentab, error } to the surface
 *
 * Stage advances are driven by real IPC progress events from the main process.
 * A light fallback timer shows "reading" after a few seconds if no events arrive.
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

export type CodingGenTabStatus = "idle" | "generating" | "refining" | "done" | "error";

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
  const [wasFixed, setWasFixed] = useState(false);
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

  // Fallback timer: if no real progress events arrive within 8s, show "reading" stage
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedProgressRef = useRef(false);

  const startFallbackTimer = useCallback(() => {
    hasReceivedProgressRef.current = false;
    fallbackTimerRef.current = setTimeout(() => {
      if (!hasReceivedProgressRef.current) {
        const readingStage = STAGES.find((s) => s.stage === "reading") ?? IDLE_STAGE;
        setStageInfo(readingStage);
        animateProgress(readingStage.progressPct);
      }
    }, 2_000);
  }, [animateProgress]);

  const stopFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  // Slow-crawl timer: during the coding stage (30-60s) the progress bar would
  // otherwise sit motionless at 65%. We creep it toward 82% (just below the
  // checking stage waypoint at 88%) so the user sees ongoing motion.
  // The crawl uses asymptotic easing — it approaches 82% but never reaches it,
  // which is honest: we don't know exactly how long coding will take.
  const crawlTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCrawl = useCallback(() => {
    if (crawlTimerRef.current) {
      clearInterval(crawlTimerRef.current);
      crawlTimerRef.current = null;
    }
  }, []);

  const startCrawl = useCallback(() => {
    stopCrawl();
    // Tick every 1.2s; move 3% of remaining distance toward the 82% cap each tick.
    // From 65% this reaches ~75% after 30s and ~79% after 60s — noticeably moving
    // without falsely promising completion.
    const CRAWL_CAP = 82;
    crawlTimerRef.current = setInterval(() => {
      const curr = currentProgressRef.current;
      if (curr >= CRAWL_CAP) {
        stopCrawl();
        return;
      }
      animateProgress(curr + (CRAWL_CAP - curr) * 0.03);
    }, 1_200);
  }, [animateProgress, stopCrawl]);

  // Main generation effect — fires on mount and on retry
  useEffect(() => {
    if (!desktop || !genId) return;

    let cancelled = false;

    // Subscribe to real progress events from main process
    const stageMap: Record<string, CodingGenTabStage> = {
      reading: "reading",
      thinking: "thinking",
      coding: "coding",
      checking: "checking",
    };

    const unsubProgress = desktop.gentab.onCodingProgress?.((event: { genId: string; stage: string; label: string }) => {
      if (event.genId !== genId || cancelled) return;
      const mappedStage = stageMap[event.stage];
      if (mappedStage) {
        hasReceivedProgressRef.current = true;
        // Stop crawl before jumping to the real next waypoint
        stopCrawl();
        const stageData = STAGES.find((s) => s.stage === mappedStage) ?? IDLE_STAGE;
        setStageInfo({ ...stageData, sublabel: event.label || stageData.sublabel });
        animateProgress(stageData.progressPct);
        // During the long coding stage, creep the bar forward so it doesn't freeze
        if (mappedStage === "coding") {
          startCrawl();
        }
      }
    });

    async function run() {
      if (!desktop) return;
      // If refinementTextRef is already set, this is a refine/fix pass — show different status
      const isRefinePass = refinementTextRef.current.length > 0;
      setStatus(isRefinePass ? "refining" : "generating");
      startFallbackTimer();

      // Load pending metadata to know which tabs to reference
      let pendingMeta: SabrinaPendingGenTabMetadata | null = null;
      try {
        const stateResult = await desktop.gentab.getState({ genId });
        if (stateResult.success) {
          // Check if already generated (user navigated back to a done coding gentab)
          const existing = stateResult.gentab as unknown as CodingGenTabData | undefined;
          if (existing?.schemaVersion === "coding") {
            stopFallbackTimer();
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
        stopFallbackTimer();
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
        stopFallbackTimer();
        setError(msg);
        setStageInfo(buildErrorStage(msg));
        setStatus("error");
        return;
      }

      if (cancelled) return;
      stopFallbackTimer();

      if (!result.success) {
        const msg = ("error" in result && result.error) ? result.error : "生成失败";
        setError(msg);
        setStageInfo(buildErrorStage(msg));
        setStatus("error");
        return;
      }

      stopCrawl();
      animateProgress(100);
      setGentab(result.gentab);
      setWasFixed(result.wasFixed === true);
      setStatus("done");
      desktop.gentab.markGenerationCompleted(genId);
    }

    run();

    return () => {
      cancelled = true;
      unsubProgress?.();
      stopFallbackTimer();
      stopCrawl();
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genId, desktop, startFallbackTimer, stopFallbackTimer, startCrawl, stopCrawl, animateProgress, retryKey]);

  const handleClose = useCallback(() => {
    onClose?.(genId);
  }, [genId, onClose]);

  const handleRetry = useCallback(() => {
    refinementTextRef.current = "";
    originalHtmlRef.current = "";
    setGentab(null);
    setError(null);
    setWasFixed(false);
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
      // Set refs BEFORE resetting status so run() can read isRefinePass correctly
      refinementTextRef.current = refinementText.trim();
      originalHtmlRef.current = currentHtml;
      setGentab(null);
      setError(null);
      setWasFixed(false);
      // Use "idle" so the useEffect fires; run() will detect refinementTextRef and set "refining"
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
    wasFixed,
    handleClose,
    handleRetry,
    handleRefine,
  };
}
