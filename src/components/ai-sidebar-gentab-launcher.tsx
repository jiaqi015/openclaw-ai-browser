import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { SabrinaTabReferenceCandidate } from "../application/sabrina-openclaw";
import gentabIcon from "../assets/gentab-icon.svg";
import {
  genTabTypeLabels,
  type GenTabPreferredType,
} from "../lib/gentab-types";
import { cn } from "../lib/utils";

const GENTAB_TYPE_OPTIONS: GenTabPreferredType[] = [
  "auto",
  "comparison",
  "table",
  "timeline",
  "list",
  "card-grid",
];

export function AiSidebarGenTabLauncher(props: {
  chatKey: string;
  composerText: string;
  generatingGenTabId: string | null;
  hasConnectedLobster: boolean;
  onOpenGenTabGenerator: (params: {
    userIntent: string;
    preferredType: GenTabPreferredType;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  selectedReferenceTabs: SabrinaTabReferenceCandidate[];
}) {
  const {
    chatKey,
    composerText,
    generatingGenTabId,
    hasConnectedLobster,
    onOpenGenTabGenerator,
    selectedReferenceTabs,
  } = props;
  const [genTabLauncherOpen, setGenTabLauncherOpen] = useState(false);
  const [genTabIntentDraft, setGenTabIntentDraft] = useState("");
  const [genTabPreferredType, setGenTabPreferredType] = useState<GenTabPreferredType>("auto");
  const [genTabInlineError, setGenTabInlineError] = useState("");

  const canStartGenTab =
    hasConnectedLobster && selectedReferenceTabs.length >= 2 && !generatingGenTabId;

  useEffect(() => {
    setGenTabLauncherOpen(false);
    setGenTabIntentDraft("");
    setGenTabPreferredType("auto");
    setGenTabInlineError("");
  }, [chatKey]);

  useEffect(() => {
    if (!genTabLauncherOpen) {
      return;
    }

    setGenTabIntentDraft((current) =>
      current.trim()
        ? current
        : composerText.trim() || "把这些页面整理成一个可继续比较和追问的工作台",
    );
  }, [composerText, genTabLauncherOpen]);

  useEffect(() => {
    if (selectedReferenceTabs.length >= 2 && hasConnectedLobster) {
      return;
    }

    setGenTabLauncherOpen(false);
    setGenTabInlineError("");
  }, [hasConnectedLobster, selectedReferenceTabs.length]);

  if (!hasConnectedLobster || selectedReferenceTabs.length < 2) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={() => {
          if (!canStartGenTab) {
            return;
          }
          setGenTabInlineError("");
          setGenTabLauncherOpen((current) => !current);
        }}
        disabled={!canStartGenTab}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors",
          canStartGenTab
            ? "surface-button-ai-soft"
            : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed",
        )}
      >
        <img src={gentabIcon} className="w-4 h-4" alt="GenTab" />
        <span>{genTabLauncherOpen ? "收起 GenTab 草案" : `生成 GenTab · ${selectedReferenceTabs.length} 页`}</span>
      </button>

      <AnimatePresence initial={false}>
        {genTabLauncherOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-white/78">GenTab 工作台草案</div>
                <div className="mt-1 text-[10px] text-white/38">
                  让 Sabrina 先理解这组页面，再生成一个可以继续整理的任务面板。
                </div>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-white/45">
                {selectedReferenceTabs.length} 页
              </span>
            </div>

            <textarea
              value={genTabIntentDraft}
              onChange={(event) => {
                setGenTabIntentDraft(event.target.value);
                if (genTabInlineError) {
                  setGenTabInlineError("");
                }
              }}
              rows={3}
              placeholder="比如：比较这几家产品的价格、定位和适合场景，做成一个可继续追问的决策面板"
              className="w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-white/82 placeholder:text-white/28 focus:outline-none"
            />

            <div className="mt-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/28">
                生成形态
              </div>
              <div className="flex flex-wrap gap-2">
                {GENTAB_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setGenTabPreferredType(option);
                      if (genTabInlineError) {
                        setGenTabInlineError("");
                      }
                    }}
                    className={cn(
                      "surface-pill inline-flex h-7 items-center rounded-full border px-3 text-[10px] font-medium transition-colors",
                      genTabPreferredType === option ? "surface-pill-active" : "text-white/52",
                    )}
                  >
                    {genTabTypeLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            {genTabInlineError ? (
              <div className="mt-3 text-[11px] text-apple-pink/85">{genTabInlineError}</div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-white/30">
                新标签页会生成一个可继续细化的内部工作台。
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGenTabLauncherOpen(false);
                    setGenTabInlineError("");
                  }}
                  className="text-[11px] text-white/34 transition-colors hover:text-white/68"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!canStartGenTab || !genTabIntentDraft.trim()}
                  onClick={async () => {
                    const result = await onOpenGenTabGenerator({
                      userIntent: genTabIntentDraft.trim(),
                      preferredType: genTabPreferredType,
                    });
                    if (!result.success) {
                      setGenTabInlineError(result.error || "GenTab 暂时没能启动。");
                      return;
                    }
                    setGenTabLauncherOpen(false);
                    setGenTabInlineError("");
                  }}
                  className="surface-button-ai inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingGenTabId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>生成工作台</span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
