import { useEffect, useMemo, useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";
import { parseGenTabIdFromUrl } from "../lib/gentab-url";
import {
  clearGenTabFromStorage,
  clearPendingGenTabMetadata,
  getPendingGenTabMetadata,
  loadGenTabFromStorage,
  saveGenTabToStorage,
  setPendingGenTabMetadata,
} from "../lib/gentab-storage";
import {
  createEmptyGenTabState,
  normalizeGenTabPreferredType,
  validateGenTabData,
  type GenTabData,
  type GenTabGenerationState,
  type GenTabPreferredType,
  type GenTabSource,
  type GenTabType,
} from "../lib/gentab-types";

function createInitialGenTabState(genTabId: string | null): GenTabGenerationState {
  const saved = loadGenTabFromStorage(genTabId);
  if (saved && validateGenTabData(saved)) {
    return {
      status: "done",
      gentab: saved,
      error: null,
      progress: 100,
    };
  }

  return {
    ...createEmptyGenTabState(),
    status: "generating",
    progress: 0,
  };
}

function deriveSources(gentab: GenTabData): GenTabSource[] {
  if (Array.isArray(gentab.sources) && gentab.sources.length > 0) {
    return gentab.sources;
  }

  const seen = new Set<string>();
  const nextSources: GenTabSource[] = [];
  gentab.items.forEach((item) => {
    const url = `${item.sourceUrl ?? ""}`.trim();
    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    nextSources.push({
      url,
      title: item.sourceTitle || item.title,
      host: safeHostLabel(url),
    });
  });

  return nextSources;
}

function safeHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function useGenTabSurfaceState(params: {
  url: string;
  onCloseGenTab?: (genTabId: string) => void;
}) {
  const { onCloseGenTab, url } = params;
  const desktop = getSabrinaDesktop();
  const genTabId = parseGenTabIdFromUrl(url);
  const [state, setState] = useState<GenTabGenerationState>(() =>
    createInitialGenTabState(genTabId),
  );
  const [activeView, setActiveView] = useState<GenTabType>("comparison");
  const [refineIntent, setRefineIntent] = useState("");
  const [preferredType, setPreferredType] = useState<GenTabPreferredType>("auto");

  useEffect(() => {
    setState(createInitialGenTabState(genTabId));
    setActiveView("comparison");
    setRefineIntent("");
    setPreferredType("auto");
  }, [genTabId]);

  useEffect(() => {
    if (state.status !== "generating") {
      return;
    }

    let cancelled = false;

    const doGenerate = async () => {
      if (!genTabId) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            status: "error",
            error: "无效的 GenTab ID",
          }));
        }
        return;
      }

      if (!desktop?.gentab?.generate) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            status: "error",
            error: "当前环境暂不支持 GenTab 生成。",
          }));
        }
        return;
      }

      try {
        const metadata = getPendingGenTabMetadata(genTabId);
        if (!metadata) {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              status: "error",
              error: "找不到生成任务元数据",
            }));
          }
          return;
        }

        if (!cancelled) {
          setState((current) => ({ ...current, progress: 20 }));
        }

        const result = await desktop.gentab.generate({
          genId: genTabId,
          referenceTabIds: metadata.referenceTabIds,
          userIntent: metadata.userIntent,
          preferredType: metadata.preferredType,
        });

        if (cancelled) {
          return;
        }

        setState((current) => ({ ...current, progress: 100 }));

        if (!result.success) {
          setState((current) => ({
            ...current,
            status: "error",
            error: result.error || "生成失败",
          }));
          return;
        }

        if (!validateGenTabData(result.gentab)) {
          setState((current) => ({
            ...current,
            status: "error",
            error: "返回数据格式不正确",
          }));
          return;
        }

        saveGenTabToStorage(genTabId, result.gentab);
        clearPendingGenTabMetadata(genTabId);
        setState({
          status: "done",
          gentab: result.gentab,
          error: null,
          progress: 100,
        });
        desktop.gentab.markGenerationCompleted(genTabId);
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    };

    void doGenerate();

    return () => {
      cancelled = true;
    };
  }, [desktop, genTabId, state.status]);

  useEffect(() => {
    if (!state.gentab) {
      return;
    }

    setActiveView(state.gentab.type);
    setRefineIntent(state.gentab.metadata.userIntent);
    setPreferredType(normalizeGenTabPreferredType(state.gentab.metadata.preferredType));
  }, [state.gentab]);

  const sourceCards = useMemo(
    () => (state.gentab ? deriveSources(state.gentab) : []),
    [state.gentab],
  );

  function beginGeneration(nextIntent?: string, nextPreferredType?: GenTabPreferredType) {
    if (!genTabId) {
      return;
    }

    const fallbackMetadata = getPendingGenTabMetadata(genTabId) ?? {
      referenceTabIds: state.gentab?.metadata.sourceTabIds ?? [],
      userIntent: state.gentab?.metadata.userIntent ?? "",
      preferredType: state.gentab?.metadata.preferredType,
    };

    if (fallbackMetadata.referenceTabIds.length === 0) {
      setState((current) => ({
        ...current,
        status: "error",
        error: "缺少来源标签页，暂时无法继续生成。",
      }));
      return;
    }

    const userIntent =
      `${nextIntent ?? refineIntent ?? fallbackMetadata.userIntent}`.trim() ||
      "整理这些页面为结构化工作台";
    const resolvedPreferredType = normalizeGenTabPreferredType(
      nextPreferredType ?? preferredType ?? fallbackMetadata.preferredType,
    );

    clearGenTabFromStorage(genTabId);
    setPendingGenTabMetadata(genTabId, {
      referenceTabIds: fallbackMetadata.referenceTabIds,
      userIntent,
      preferredType: resolvedPreferredType,
    });
    setRefineIntent(userIntent);
    setPreferredType(resolvedPreferredType);
    setState({
      ...createEmptyGenTabState(),
      status: "generating",
      progress: 0,
    });
  }

  function handleCancel() {
    if (!genTabId) {
      return;
    }

    if (onCloseGenTab) {
      onCloseGenTab(genTabId);
      return;
    }

    clearPendingGenTabMetadata(genTabId);
    void desktop?.gentab?.closeGenTab?.(genTabId);
  }

  return {
    activeView,
    beginGeneration,
    genTabId,
    handleCancel,
    preferredType,
    refineIntent,
    setActiveView,
    setPreferredType,
    setRefineIntent,
    sourceCards,
    state,
  };
}
