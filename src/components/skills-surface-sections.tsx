import { ChevronDown, ChevronUp, Heart, Languages, Sparkles } from "lucide-react";
import {
  BROWSER_RECOMMENDED_SKILLS,
  BROWSER_UNSUITED_SKILLS,
  getReadableSkillDescription,
} from "../application/skill-catalog";
import { cn } from "../lib/utils";

export function SkillsSectionHeader(props: {
  title: string;
  subtitle: string;
  titleClassName: string;
  subtitleClassName: string;
  dotClassName: string;
  count: number;
  expanded: boolean;
  hiddenCount: number;
  collapsible: boolean;
  onToggle: () => void;
}) {
  const {
    title,
    subtitle,
    titleClassName,
    subtitleClassName,
    dotClassName,
    count,
    expanded,
    hiddenCount,
    collapsible,
    onToggle,
  } = props;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", dotClassName)} />
        <h3 className={cn("text-sm font-medium", titleClassName)}>{title}</h3>
        <span className={cn("text-xs", subtitleClassName)}>{subtitle}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/48">
          {count}
        </span>
      </div>
      {collapsible ? (
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          {expanded ? (
            <>
              收起
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              展开 {hiddenCount} 个
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function SkillCard(props: {
  skill: SabrinaOpenClawSkillEntry;
  pinnedSkillNames: string[];
  hiddenSkillNames: string[];
  onTogglePinnedSkill: (skillName: string) => void;
  onToggleHiddenSkill: (skillName: string) => void;
  translatedText?: string;
  translateError?: string;
  isTranslating?: boolean;
  onTranslateSkill?: (skill: SabrinaOpenClawSkillEntry) => void;
  compact?: boolean;
}) {
  const {
    skill,
    pinnedSkillNames,
    hiddenSkillNames,
    onTogglePinnedSkill,
    onToggleHiddenSkill,
    translatedText,
    translateError,
    isTranslating = false,
    onTranslateSkill,
    compact = false,
  } = props;
  const isPinned = pinnedSkillNames.includes(skill.name);
  const isHidden = hiddenSkillNames.includes(skill.name);
  const readableDescription = getReadableSkillDescription(skill);
  const browserCapability = skill.browserCapability;
  const browserInputMode = browserCapability?.inputMode ?? skill.browserInputMode;
  const browserUseHint = browserCapability?.useHint ?? skill.browserUseHint;
  const browserCompatibilitySource =
    browserCapability?.source ?? skill.browserCompatibilitySource;
  const compatibilityBadgeLabel =
    browserCompatibilitySource === "skill-metadata"
      ? "OpenClaw 元数据"
      : browserCompatibilitySource === "sabrina-overlay"
        ? "Sabrina Overlay"
        : "Heuristic";

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-[20px] border transition-colors",
        compact
          ? "gap-3 border-white/5 bg-white/5 p-3.5 hover:border-white/10"
          : "min-h-[196px] gap-3 border-white/6 bg-white/[0.03] px-3.5 py-3.5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base">
          {skill.emoji || "✦"}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-medium text-white">{skill.displayName || skill.name}</h3>
            {!compact ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  skill.ready
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : skill.eligible
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/45",
                )}
              >
                {skill.ready ? "可直接使用" : skill.eligible ? "待补依赖" : "当前不可用"}
              </span>
            ) : null}
            {!compact && isHidden ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                已隐藏
              </span>
            ) : null}
            {!compact && isPinned ? (
              <span className="flex items-center gap-1 rounded-full border border-apple-pink/20 bg-apple-pink/10 px-2 py-0.5 text-[10px] font-medium text-apple-pink">
                <Heart className="h-2.5 w-2.5 fill-current" />
                最爱
              </span>
            ) : null}
            {!compact && BROWSER_RECOMMENDED_SKILLS.has(skill.name) ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                浏览器推荐
              </span>
            ) : null}
            {!compact ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  browserInputMode === "page-snapshot"
                    ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                    : "border-orange-400/20 bg-orange-400/10 text-orange-200",
                )}
              >
                {browserInputMode === "page-snapshot" ? "页面快照输入" : "链接/文件输入"}
              </span>
            ) : null}
            {!compact && BROWSER_UNSUITED_SKILLS.has(skill.name) ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                不适用此场景
              </span>
            ) : null}
          </div>

          <p
            title={skill.description || undefined}
            className={cn(
              "mt-1 line-clamp-2 text-[11px] text-white/50",
              compact ? "leading-5 text-white/48" : "leading-5",
            )}
          >
            {readableDescription}
          </p>

          {!compact && skill.description ? (
            <div className="mt-2">
              <button
                onClick={() => onTranslateSkill?.(skill)}
                disabled={isTranslating}
                className={cn(
                  "surface-button-ai-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                  isTranslating && "cursor-wait opacity-70",
                )}
              >
                {isTranslating ? (
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <Languages className="h-3.5 w-3.5" />
                )}
                {translatedText ? "重新翻译 + 摘要" : "翻译 + 中文摘要"}
              </button>
            </div>
          ) : null}

          {!compact && translatedText ? (
            <div className="mt-2 rounded-2xl border border-apple-blue/15 bg-apple-blue/10 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-apple-blue/85">
                <Sparkles className="h-3 w-3" />
                龙虾解读
              </div>
              <p className="whitespace-pre-line text-[11px] leading-5 text-white/78">
                {translatedText}
              </p>
            </div>
          ) : null}

          {!compact && translateError ? (
            <div className="mt-2 rounded-2xl border border-red-400/15 bg-red-400/10 px-3 py-2.5 text-[11px] leading-5 text-red-100/88">
              {translateError}
            </div>
          ) : null}

          {!compact ? (
            <>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/34">
                <span>来源：{skill.source || "unknown"}</span>
                {skill.bundled ? <span>内置</span> : null}
                {skill.disabled ? <span>后端停用</span> : null}
                {browserCompatibilitySource ? (
                  <span>兼容性：{compatibilityBadgeLabel}</span>
                ) : null}
              </div>
              {browserUseHint ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/46">
                  浏览器使用：{browserUseHint}
                </p>
              ) : null}
              {browserCompatibilitySource === "sabrina-overlay" ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/40">
                  当前浏览器兼容性来自 Sabrina 侧 overlay，用于在 OpenClaw 尚未提供完整元数据前保持诚实执行。
                </p>
              ) : null}
              {skill.missingSummary ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-amber-200/70">
                  缺少依赖：{skill.missingSummary}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/6 pt-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">最爱</span>
          <button
            onClick={() => onTogglePinnedSkill(skill.name)}
            className={cn(
              "rounded-lg p-2 transition-colors",
              isPinned
                ? "bg-apple-pink/10 text-apple-pink"
                : "bg-white/5 text-white/30 hover:text-white/60",
            )}
          >
            <Heart className={cn("h-4 w-4", isPinned && "fill-current")} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">{isHidden ? "已隐藏" : "显示中"}</span>
          <div
            onClick={() => onToggleHiddenSkill(skill.name)}
            className={cn(
              "relative h-5 w-10 cursor-pointer rounded-full transition-colors",
              !isHidden ? "bg-emerald-400" : "bg-white/20",
            )}
          >
            <div
              className={cn(
                "absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all",
                !isHidden ? "right-1" : "left-1",
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkillsGrid(props: {
  skills: SabrinaOpenClawSkillEntry[];
  pinnedSkillNames: string[];
  hiddenSkillNames: string[];
  onTogglePinnedSkill: (skillName: string) => void;
  onToggleHiddenSkill: (skillName: string) => void;
  translatedBySkillName?: Record<string, string>;
  translateErrorsBySkillName?: Record<string, string>;
  translatingBySkillName?: Record<string, boolean>;
  onTranslateSkill?: (skill: SabrinaOpenClawSkillEntry) => void;
  compact?: boolean;
}) {
  const {
    skills,
    pinnedSkillNames,
    hiddenSkillNames,
    onTogglePinnedSkill,
    onToggleHiddenSkill,
    translatedBySkillName = {},
    translateErrorsBySkillName = {},
    translatingBySkillName = {},
    onTranslateSkill,
    compact = false,
  } = props;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill) => (
        <SkillCard
          key={skill.name}
          skill={skill}
          pinnedSkillNames={pinnedSkillNames}
          hiddenSkillNames={hiddenSkillNames}
          onTogglePinnedSkill={onTogglePinnedSkill}
          onToggleHiddenSkill={onToggleHiddenSkill}
          translatedText={translatedBySkillName[skill.name]}
          translateError={translateErrorsBySkillName[skill.name]}
          isTranslating={Boolean(translatingBySkillName[skill.name])}
          onTranslateSkill={onTranslateSkill}
          compact={compact}
        />
      ))}
    </div>
  );
}
