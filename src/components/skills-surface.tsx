import { Search, Swords } from "lucide-react";
import {
  getSkillFilterOptions,
} from "../application/skill-catalog";
import { useSkillsSurfaceState } from "../application/use-skills-surface-state";
import { useSkillTranslation } from "../application/use-skill-translation";
import { useUiPreferences } from "../application/use-ui-preferences";
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
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
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
    uiLocale,
  });
  const filterOptions = getSkillFilterOptions(uiLocale);

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-apple-pink/20 to-apple-purple/20 shadow-[0_0_15px_rgba(255,45,85,0.15)]">
              <Swords className="h-6 w-6 text-apple-pink" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{t("skills.pageTitle")}</h1>
          </div>
          <p className="ml-[60px] text-sm text-white/40">
            {t("skills.pageDescription")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="surface-panel rounded-2xl border p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">{t("skills.favoritesTitle")}</h2>
                <p className="mt-1 text-sm text-white/50">
                  {t("skills.favoritesDescription")}
                </p>
              </div>
            </div>

            {pinnedSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                {t("skills.favoritesEmpty")}
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
                <h2 className="text-lg font-medium text-white">{t("skills.ecosystemTitle")}</h2>
                <p className="mt-1 text-sm text-white/50">
                  {t("skills.ecosystemDescription")}
                </p>
              </div>
              <div className="text-right text-sm text-white/45">
                <div>{t("skills.readyCount", { count: readyCount })}</div>
                <div>{t("skills.missingCount", { count: missingCount })}</div>
                <div>{t("skills.totalCount", { count: skillCatalog?.summary.total ?? 0 })}</div>
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("skills.searchPlaceholder")}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/8"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
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
                  {t("skills.showingCount", {
                    visible: filteredSkills.length,
                    total: allSkills.length,
                  })}
                </span>
                {hasActiveFilter ? (
                  <button
                    onClick={clearFilters}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
                  >
                    {t("skills.clearFilters")}
                  </button>
                ) : (
                  <span>{t("skills.defaultVisibleHint")}</span>
                )}
              </div>
            </div>

            {!skillCatalog || skillCatalog.skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
                {t("skills.catalogEmpty")}
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-12 text-center text-sm text-white/45">
                {t("skills.noMatches")}
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
