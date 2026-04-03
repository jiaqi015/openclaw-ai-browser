import { useMemo, useState } from "react";
import { translate, type UiLocale } from "../../shared/localization.mjs";
import {
  BROWSER_RECOMMENDED_SKILLS,
  BROWSER_UNSUITED_SKILLS,
  filterSkillEntries,
  type SkillFilter,
} from "./skill-catalog";

export type SkillsSurfaceSection = {
  key: string;
  title: string;
  subtitle: string;
  titleClassName: string;
  subtitleClassName: string;
  dotClassName: string;
  skills: SabrinaOpenClawSkillEntry[];
  visibleSkills: SabrinaOpenClawSkillEntry[];
  expanded: boolean;
  hiddenCount: number;
  collapsible: boolean;
};

export function useSkillsSurfaceState(params: {
  hiddenSkillNames: string[];
  pinnedSkillNames: string[];
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  uiLocale: UiLocale;
}) {
  const { hiddenSkillNames, pinnedSkillNames, skillCatalog, uiLocale } = params;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillFilter>("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const allSkills = skillCatalog?.skills ?? [];
  const readyCount = skillCatalog?.summary.ready ?? 0;
  const missingCount = skillCatalog?.summary.missingRequirements ?? 0;
  const pinnedSkills = useMemo(
    () =>
      pinnedSkillNames
        .map((skillName) => allSkills.find((skill) => skill.name === skillName))
        .filter((skill): skill is SabrinaOpenClawSkillEntry => Boolean(skill)),
    [allSkills, pinnedSkillNames],
  );
  const filteredSkills = useMemo(
    () => filterSkillEntries(allSkills, query, statusFilter, hiddenSkillNames),
    [allSkills, hiddenSkillNames, query, statusFilter],
  );
  const hasActiveFilter = query.trim().length > 0 || statusFilter !== "all";

  const sections = useMemo<SkillsSurfaceSection[]>(() => {
    const sectionDefs = [
      {
        key: "favorites",
        title: translate(uiLocale, "skills.section.favorites.title"),
        subtitle: translate(uiLocale, "skills.section.favorites.subtitle"),
        titleClassName: "text-apple-pink",
        subtitleClassName: "text-apple-pink/60",
        dotClassName: "bg-apple-pink",
        skills: filteredSkills.filter(
          (skill) => pinnedSkillNames.includes(skill.name) && !hiddenSkillNames.includes(skill.name),
        ),
      },
      {
        key: "recommended",
        title: translate(uiLocale, "skills.section.recommended.title"),
        subtitle: translate(uiLocale, "skills.section.recommended.subtitle"),
        titleClassName: "text-emerald-300",
        subtitleClassName: "text-emerald-300/60",
        dotClassName: "bg-emerald-400",
        skills: filteredSkills.filter(
          (skill) =>
            !pinnedSkillNames.includes(skill.name) &&
            !hiddenSkillNames.includes(skill.name) &&
            BROWSER_RECOMMENDED_SKILLS.has(skill.name),
        ),
      },
      {
        key: "others",
        title: translate(uiLocale, "skills.section.others.title"),
        subtitle: translate(uiLocale, "skills.section.others.subtitle"),
        titleClassName: "text-white/70",
        subtitleClassName: "text-white/40",
        dotClassName: "bg-white/40",
        skills: filteredSkills.filter(
          (skill) =>
            !pinnedSkillNames.includes(skill.name) &&
            !hiddenSkillNames.includes(skill.name) &&
            !BROWSER_RECOMMENDED_SKILLS.has(skill.name) &&
            !BROWSER_UNSUITED_SKILLS.has(skill.name),
        ),
      },
      {
        key: "forbidden",
        title: translate(uiLocale, "skills.section.forbidden.title"),
        subtitle: translate(uiLocale, "skills.section.forbidden.subtitle"),
        titleClassName: "text-white/50",
        subtitleClassName: "text-white/35",
        dotClassName: "bg-white/20",
        skills: filteredSkills.filter((skill) => BROWSER_UNSUITED_SKILLS.has(skill.name)),
      },
      {
        key: "hidden",
        title: translate(uiLocale, "skills.section.hidden.title"),
        subtitle: translate(uiLocale, "skills.section.hidden.subtitle"),
        titleClassName: "text-white/40",
        subtitleClassName: "text-white/30",
        dotClassName: "bg-white/15",
        skills: filteredSkills.filter((skill) => hiddenSkillNames.includes(skill.name)),
      },
    ];

    return sectionDefs
      .filter((section) => section.skills.length > 0)
      .map((section) => {
        const expanded = hasActiveFilter || Boolean(expandedSections[section.key]);
        const visibleSkills = expanded ? section.skills : section.skills.slice(0, 6);
        return {
          ...section,
          visibleSkills,
          expanded,
          hiddenCount: section.skills.length - visibleSkills.length,
          collapsible: !hasActiveFilter && section.skills.length > 6,
        };
      });
  }, [
    expandedSections,
    filteredSkills,
    hasActiveFilter,
    hiddenSkillNames,
    pinnedSkillNames,
    uiLocale,
  ]);

  function toggleSection(sectionKey: string) {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
  }

  return {
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
  };
}
