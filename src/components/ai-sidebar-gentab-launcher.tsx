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

type GenTabLauncherMode = "structured" | "creative";

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
  const [genTabMode, setGenTabMode] = useState<GenTabLauncherMode>("structured");
  const [genTabInlineError, setGenTabInlineError] = useState("");
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();

  const isRegularPage =
    primarySourceTab !== null && !primarySourceTab.url.startsWith("sabrina://");
  const supportsStructuredMode = selectedReferenceTabs.length >= 1;
  const supportsCreativeMode = isRegularPage;
  const showLauncher = supportsStructuredMode || supportsCreativeMode;
  const totalPageCount = Math.max(totalSourcePageCount, supportsCreativeMode ? 1 : 0);
  const canStartStructuredGenTab = hasConnectedLobster && canGenerate && !generatingGenTabId;
  const canStartCreativeGenTab =
    hasConnectedLobster && supportsCreativeMode && !generatingGenTabId;

  useEffect(() => {
    setGenTabLauncherOpen(false);
    setGenTabIntentDraft("");
    setGenTabPreferredType("auto");
    setGenTabMode(selectedReferenceTabs.length >= 1 ? "structured" : "creative");
    setGenTabInlineError("");
  }, [chatKey]);

  useEffect(() => {
    if (!genTabLauncherOpen) {
      return;
    }

    setGenTabIntentDraft((current) =>
      current.trim()
        ? current
        : composerText.trim(),
    );
  }, [composerText, genTabLauncherOpen, t]);

  useEffect(() => {
    if (!showLauncher) {
      setGenTabLauncherOpen(false);
      setGenTabInlineError("");
      return;
    }

    if (!supportsStructuredMode && genTabMode === "structured") {
      setGenTabMode("creative");
    } else if (!supportsCreativeMode && genTabMode === "creative") {
      setGenTabMode("structured");
    }
  }, [genTabMode, showLauncher, supportsCreativeMode, supportsStructuredMode]);

  if (!showLauncher) {
    return null;
  }

  const isStructuredMode = genTabMode === "structured";
  const actionHint = isStructuredMode
    ? t("gentab.launcher.newTabHint")
    : t("gentab.launcher.creativeNewTabHint");
  const activeBlockedReason = isStructuredMode
    ? !hasConnectedLobster
      ? t("gentab.launcher.requiresOpenClaw")
      : !supportsStructuredMode
      ? t("gentab.launcher.structuredRequiresRefs")
      : !canGenerate && blockedReason
      ? blockedReason
      : ""
    : !hasConnectedLobster
    ? t("gentab.launcher.requiresOpenClaw")
    : !supportsCreativeMode
    ? t("gentab.launcher.creativeRequiresPage")
    : "";

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!genTabLauncherOpen) {
            setGenTabMode(supportsStructuredMode ? "structured" : "creative");
          }
          setGenTabInlineError("");
          setGenTabLauncherOpen((current) => !current);
        }}
        title={
          supportsStructuredMode
            ? t("gentab.launcher.closed", { count: totalSourcePageCount })
            : t("gentab.launcher.closedCurrent")
        }
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
          genTabLauncherOpen
            ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
            : hasConnectedLobster
            ? "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white hover:bg-white/10"
            : "border-white/5 bg-transparent text-white/20 cursor-not-allowed",
        )}
      >
        {generatingGenTabId ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <img src={gentabIcon} className={cn("w-3.5 h-3.5 transition-all", !hasConnectedLobster && "grayscale opacity-50")} alt="GenTab" />
        )}
      </button>

      {/* The panel should be absolutely positioned if triggered from a small icon, 
          or we keep it in the flow but need to make sure it doesn't break the layout.
          Actually, the user suggested "in the red position" which is the top right.
          I will keep the panel logic here but move the launcher to the top right in ComposerCard. */}


      <AnimatePresence initial={false}>
        {genTabLauncherOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full right-0 mt-2 w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/95 backdrop-blur-xl p-3 shadow-2xl z-50"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-white/78">{t("gentab.launcher.draftTitle")}</div>
                <div className="mt-1 text-[10px] text-white/38">
                  {t("gentab.launcher.draftDescription")}
                </div>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-white/45">
                {t("gentab.launcher.pageCount", { count: totalPageCount })}
              </span>
            </div>

            <div className="mb-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/28">
                {t("gentab.launcher.mode")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!supportsStructuredMode}
                  onClick={() => {
                    if (!supportsStructuredMode) {
                      return;
                    }
                    setGenTabMode("structured");
                    setGenTabInlineError("");
                  }}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    genTabMode === "structured"
                      ? "border-apple-pink/20 bg-apple-pink/8"
                      : supportsStructuredMode
                      ? "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                      : "cursor-not-allowed border-white/6 bg-white/[0.02] opacity-45",
                  )}
                >
                  <div className="text-[11px] font-semibold text-white/82">
                    {t("gentab.launcher.mode.structured")}
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-white/38">
                    {t("gentab.launcher.mode.structuredDescription")}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!supportsCreativeMode}
                  onClick={() => {
                    if (!supportsCreativeMode) {
                      return;
                    }
                    setGenTabMode("creative");
                    setGenTabInlineError("");
                  }}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    genTabMode === "creative"
                      ? "border-apple-pink/20 bg-apple-pink/8"
                      : supportsCreativeMode
                      ? "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                      : "cursor-not-allowed border-white/6 bg-white/[0.02] opacity-45",
                  )}
                >
                  <div className="text-[11px] font-semibold text-white/82">
                    {t("gentab.launcher.mode.creative")}
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-white/38">
                    {t("gentab.launcher.mode.creativeDescription")}
                  </div>
                </button>
              </div>
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
              placeholder={
                isStructuredMode
                  ? t("gentab.launcher.placeholder")
                  : t("gentab.launcher.creativePlaceholder")
              }
              className="w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-white/82 placeholder:text-white/28 focus:outline-none"
            />

            {isStructuredMode ? (
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
            ) : (
              <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-2 text-[11px] leading-5 text-white/45">
                {t("gentab.launcher.creativeHint")}
              </div>
            )}

            {genTabInlineError ? (
              <div className="mt-3 text-[11px] text-apple-pink/85">{genTabInlineError}</div>
            ) : activeBlockedReason ? (
              <div className="mt-3 text-[11px] text-white/46">{activeBlockedReason}</div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-white/30">
                {actionHint}
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
                  disabled={
                    !(isStructuredMode ? canStartStructuredGenTab : canStartCreativeGenTab) ||
                    !genTabIntentDraft.trim()
                  }
                  onClick={async () => {
                    const result = isStructuredMode
                      ? await onOpenGenTabGenerator({
                          userIntent: genTabIntentDraft.trim(),
                          preferredType: genTabPreferredType,
                        })
                      : await onOpenCodingGenTabGenerator({
                          userIntent: genTabIntentDraft.trim(),
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
                  <span>
                    {isStructuredMode
                      ? t("gentab.launcher.create")
                      : t("gentab.launcher.createCreative")}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
