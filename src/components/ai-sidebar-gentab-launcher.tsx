import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { SabrinaTabReferenceCandidate } from "../application/sabrina-openclaw";
import gentabIcon from "../assets/gentab-icon.svg";
import {
  getGenTabTypeLabel,
  type GenTabPreferredType,
} from "../lib/gentab-types";
import { cn } from "../lib/utils";
import { useUiPreferences } from "../application/use-ui-preferences";

const GENTAB_TYPE_OPTIONS: GenTabPreferredType[] = [
  "auto",
  "comparison",
  "table",
  "timeline",
  "list",
  "card-grid",
];

export function AiSidebarGenTabLauncher(props: {
  blockedReason: string;
  canGenerate: boolean;
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
  onOpenCodingGenTabGenerator: (params?: {
    userIntent?: string;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  primarySourceTab: SabrinaTabReferenceCandidate | null;
  selectedReferenceTabs: SabrinaTabReferenceCandidate[];
  totalSourcePageCount: number;
}) {
  const {
    blockedReason,
    canGenerate,
    chatKey,
    composerText,
    generatingGenTabId,
    hasConnectedLobster,
    onOpenGenTabGenerator,
    onOpenCodingGenTabGenerator,
    primarySourceTab,
    selectedReferenceTabs,
    totalSourcePageCount,
  } = props;
  const [genTabLauncherOpen, setGenTabLauncherOpen] = useState(false);
  const [genTabIntentDraft, setGenTabIntentDraft] = useState("");
  const [genTabPreferredType, setGenTabPreferredType] = useState<GenTabPreferredType>("auto");
  const [genTabInlineError, setGenTabInlineError] = useState("");
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();

  const canStartGenTab = hasConnectedLobster && canGenerate && !generatingGenTabId;

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
        : composerText.trim() || t("gentab.defaultIntent"),
    );
  }, [composerText, genTabLauncherOpen, t]);

  useEffect(() => {
    if (selectedReferenceTabs.length >= 1 && hasConnectedLobster) {
      return;
    }

    setGenTabLauncherOpen(false);
    setGenTabInlineError("");
  }, [hasConnectedLobster, selectedReferenceTabs.length]);

  if (selectedReferenceTabs.length < 1) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Classic structured GenTab */}
      {selectedReferenceTabs.length >= 1 ? (<>
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
          <span>
          {genTabLauncherOpen
            ? t("gentab.launcher.open")
            : t("gentab.launcher.closed", { count: totalSourcePageCount })}
        </span>
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
                <div className="text-[11px] font-semibold text-white/78">{t("gentab.launcher.draftTitle")}</div>
                <div className="mt-1 text-[10px] text-white/38">
                  {t("gentab.launcher.draftDescription")}
                </div>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-white/45">
                {t("gentab.launcher.pageCount", { count: totalSourcePageCount })}
              </span>
            </div>

            {primarySourceTab ? (
              <div className="mb-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/28">
                  {t("common.currentPage")}
                </div>
                <div className="mt-1 truncate text-[12px] font-medium text-white/82">
                  {primarySourceTab.title}
                </div>
                <div className="mt-1 text-[10px] text-white/38">
                  {primarySourceTab.sourceAvailability?.label}
                </div>
              </div>
            ) : null}

            <textarea
              value={genTabIntentDraft}
              onChange={(event) => {
                setGenTabIntentDraft(event.target.value);
                if (genTabInlineError) {
                  setGenTabInlineError("");
                }
              }}
              rows={3}
              placeholder={t("gentab.launcher.placeholder")}
              className="w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-white/82 placeholder:text-white/28 focus:outline-none"
            />

            <div className="mt-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/28">
                {t("gentab.launcher.shape")}
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
                    {getGenTabTypeLabel(uiLocale, option)}
                  </button>
                ))}
              </div>
            </div>

            {genTabInlineError ? (
              <div className="mt-3 text-[11px] text-apple-pink/85">{genTabInlineError}</div>
            ) : !canGenerate && blockedReason ? (
              <div className="mt-3 text-[11px] text-white/46">{blockedReason}</div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-white/30">
                {t("gentab.launcher.newTabHint")}
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
                  {t("common.cancel")}
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
                      setGenTabInlineError(result.error || t("gentab.launcher.startError"));
                      return;
                    }
                    setGenTabLauncherOpen(false);
                    setGenTabInlineError("");
                  }}
                  className="surface-button-ai inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingGenTabId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{t("gentab.launcher.create")}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </>) : null}
    </div>
  );
}
