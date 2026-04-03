import { Search, Swords } from "lucide-react";
import {
  FILTER_OPTIONS,
} from "../application/skill-catalog";
import { useSkillsSurfaceState } from "../application/use-skills-surface-state";
import { useSkillTranslation } from "../application/use-skill-translation";
import { cn } from "../lib/utils";
import {
  SkillsGrid,
  SkillsSectionHeader,
} from "./skills-surface-sections";

export function SkillsSurface(props: {
  pinnedSkillNames: string[];
  hiddenSkillNames: string[];
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  onTogglePinnedSkill: (skillName: string) => void;
  onToggleHiddenSkill: (skillName: string) => void;
}) {
  const {
    onTogglePinnedSkill,
    onToggleHiddenSkill,
    skillCatalog,
    pinnedSkillNames,
    hiddenSkillNames,
  } = props;
  const {
    translatedBySkillName,
    translateErrorsBySkillName,
    translatingBySkillName,
    handleTranslateSkill,
  } = useSkillTranslation();
  const {
    allSkills,
    clearFilters,
    filteredSkills,
    hasActiveFilter,
    missingCount,
    pinnedSkills,
    query,
    readyCount,
    sections,
    setQuery,
    setStatusFilter,
    statusFilter,
    toggleSection,
  } = useSkillsSurfaceState({
    hiddenSkillNames,
    pinnedSkillNames,
    skillCatalog,
  });

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-apple-pink/20 to-apple-purple/20 shadow-[0_0_15px_rgba(255,45,85,0.15)]">
              <Swords className="h-6 w-6 text-apple-pink" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">技能馆</h1>
          </div>
          <p className="ml-[60px] text-sm text-white/40">
            发掘、管理并配置你的专属 AI 能力，挑选最爱的技能固定在侧边栏，并按需隐藏本地快捷入口
          </p>
        </div>

        <div className="space-y-6">
          <div className="surface-panel rounded-2xl border p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">最爱的技能</h2>
                <p className="mt-1 text-sm text-white/50">
                  挑选你最常用的技能，它们会固定显示在侧边栏顶部
                </p>
              </div>
            </div>

            {pinnedSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                还没有添加最爱技能。在下方技能列表中开启最爱即可。
              </div>
            ) : (
              <SkillsGrid
                skills={pinnedSkills}
                pinnedSkillNames={pinnedSkillNames}
                hiddenSkillNames={hiddenSkillNames}
                onTogglePinnedSkill={onTogglePinnedSkill}
                onToggleHiddenSkill={onToggleHiddenSkill}
                translatedBySkillName={translatedBySkillName}
                translateErrorsBySkillName={translateErrorsBySkillName}
                translatingBySkillName={translatingBySkillName}
                onTranslateSkill={handleTranslateSkill}
                compact
              />
            )}
          </div>

          <div className="surface-panel rounded-2xl border p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">OpenClaw 技能生态</h2>
                <p className="mt-1 text-sm text-white/50">
                  浏览器直接复用当前 OpenClaw 上可见的 skills，不再单独维护一套能力定义。
                </p>
              </div>
              <div className="text-right text-sm text-white/45">
                <div>可用 {readyCount}</div>
                <div>缺依赖 {missingCount}</div>
                <div>总计 {skillCatalog?.summary.total ?? 0}</div>
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 skill 名称、说明、来源或依赖"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/8"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setStatusFilter(option.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      statusFilter === option.id
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/38">
                <span>
                  当前显示 {filteredSkills.length} / {allSkills.length}
                </span>
                {hasActiveFilter ? (
                  <button
                    onClick={clearFilters}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
                  >
                    清空筛选
                  </button>
                ) : (
                  <span>每组默认先展示 6 个</span>
                )}
              </div>
            </div>

            {!skillCatalog || skillCatalog.skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
                当前还没有读取到 OpenClaw skills。
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-12 text-center text-sm text-white/45">
                当前筛选条件下没有匹配的技能。
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-3">
                    <SkillsSectionHeader
                      title={section.title}
                      subtitle={section.subtitle}
                      titleClassName={section.titleClassName}
                      subtitleClassName={section.subtitleClassName}
                      dotClassName={section.dotClassName}
                      count={section.skills.length}
                      expanded={section.expanded}
                      hiddenCount={section.hiddenCount}
                      collapsible={section.collapsible}
                      onToggle={() => toggleSection(section.key)}
                    />
                    <SkillsGrid
                      skills={section.visibleSkills}
                      pinnedSkillNames={pinnedSkillNames}
                      hiddenSkillNames={hiddenSkillNames}
                      onTogglePinnedSkill={onTogglePinnedSkill}
                      onToggleHiddenSkill={onToggleHiddenSkill}
                      translatedBySkillName={translatedBySkillName}
                      translateErrorsBySkillName={translateErrorsBySkillName}
                      translatingBySkillName={translatingBySkillName}
                      onTranslateSkill={handleTranslateSkill}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
