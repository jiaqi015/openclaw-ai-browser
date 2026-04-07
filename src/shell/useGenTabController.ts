import { useEffect, useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";
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

type CreateGenTabResponse =
  | {
      success: true;
      tab: SabrinaDesktopTab;
    }
  | {
      success: false;
      error?: string;
      tab?: undefined;
    };

export function useGenTabController(params: {
  activeTabId: string | null;
  binding: SabrinaOpenClawBinding | null;
  composerText: string;
  selectedReferenceIds: string[];
}) {
  const { activeTabId, binding, composerText, selectedReferenceIds } = params;
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
    if (!activeTabId) {
      return { success: false, error: "当前没有可用页面，暂时无法生成 GenTab。" };
    }
    if (selectedReferenceIds.length < 1) {
      return {
        success: false,
        error: "至少再引用 1 个页面，和当前页一起生成 GenTab。",
      };
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

    try {
      const sourceTabIds = Array.from(new Set([activeTabId, ...selectedReferenceIds]));
      const result = (await desktop.gentab.createGenTab({
        genId,
        referenceTabIds: sourceTabIds,
        userIntent,
        preferredType,
      })) as CreateGenTabResponse;

      if (result.success === false) {
        setGeneratingGenTabId(null);
        return {
          success: false,
          error: result.error || "GenTab 标签页创建失败。",
        };
      }

      return { success: true, genId };
    } catch (error) {
      setGeneratingGenTabId(null);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function handleCloseGenTab(genId: string) {
    void desktop?.gentab?.closeGenTab?.(genId);
    setGeneratingGenTabId((current) => (current === genId ? null : current));
  }

  return {
    generatingGenTabId,
    handleOpenGenTabGenerator,
    handleCloseGenTab,
  };
}
