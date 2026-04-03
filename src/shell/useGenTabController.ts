import { useEffect, useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";
import {
  clearPendingGenTabMetadata,
  setPendingGenTabMetadata,
} from "../lib/gentab-storage";
import type { GenTabPreferredType } from "../lib/gentab-types";

type OpenGenTabParams = {
  userIntent?: string;
  preferredType?: GenTabPreferredType;
};

type OpenGenTabResult = {
  success: boolean;
  genId?: string;
  error?: string;
};

export function useGenTabController(params: {
  binding: SabrinaOpenClawBinding | null;
  composerText: string;
  selectedReferenceIds: string[];
}) {
  const { binding, composerText, selectedReferenceIds } = params;
  const desktop = getSabrinaDesktop();
  const [generatingGenTabId, setGeneratingGenTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop?.gentab?.onGenerationCompleted) {
      return;
    }

    return desktop.gentab.onGenerationCompleted((genId) => {
      setGeneratingGenTabId((current) => (current === genId ? null : current));
    });
  }, [desktop]);

  async function handleOpenGenTabGenerator(
    nextParams?: OpenGenTabParams,
  ): Promise<OpenGenTabResult> {
    if (!desktop?.gentab?.createGenTab) {
      return { success: false, error: "当前环境暂不支持 GenTab。" };
    }
    if (!binding) {
      return { success: false, error: "请先连接你的龙虾，再生成 GenTab。" };
    }
    if (selectedReferenceIds.length < 2) {
      return { success: false, error: "至少引用 2 个页面，GenTab 才有足够材料。" };
    }
    if (generatingGenTabId) {
      return { success: false, error: "当前已有一个 GenTab 正在生成，请完成或取消后再试。" };
    }

    const userIntent =
      nextParams?.userIntent?.trim() ||
      composerText.trim() ||
      "整理这些页面为结构化表格";
    const preferredType = nextParams?.preferredType ?? "auto";
    const genId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setGeneratingGenTabId(genId);
    setPendingGenTabMetadata(genId, {
      referenceTabIds: selectedReferenceIds,
      userIntent,
      preferredType,
    });

    try {
      await desktop.gentab.createGenTab({
        genId,
        referenceTabIds: selectedReferenceIds,
        userIntent,
        preferredType,
      });
      return { success: true, genId };
    } catch (error) {
      clearPendingGenTabMetadata(genId);
      setGeneratingGenTabId(null);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function handleCloseGenTab(genId: string) {
    clearPendingGenTabMetadata(genId);
    void desktop?.gentab?.closeGenTab?.(genId);
    setGeneratingGenTabId((current) => (current === genId ? null : current));
  }

  return {
    generatingGenTabId,
    handleOpenGenTabGenerator,
    handleCloseGenTab,
  };
}
