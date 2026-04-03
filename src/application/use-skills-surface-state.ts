import { useMemo, useState } from "react";
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
}) {
  const { hiddenSkillNames, pinnedSkillNames, skillCatalog } = params;
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
        title: "最爱 · 可见",
        subtitle: "你标记的最爱，随时可用",
        titleClassName: "text-apple-pink",
        subtitleClassName: "text-apple-pink/60",
        dotClassName: "bg-apple-pink",
        skills: filteredSkills.filter(
          (skill) => pinnedSkillNames.includes(skill.name) && !hiddenSkillNames.includes(skill.name),
        ),
      },
      {
        key: "recommended",
        title: "浏览器推荐 · 可见",
        subtitle: "最适合在浏览器场景下使用",
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
        title: "其他技能 · 可见",
        subtitle: "可在特定场景使用",
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
        title: "不太适合",
        subtitle: "这类技能通常不适合在浏览器中使用",
        titleClassName: "text-white/50",
        subtitleClassName: "text-white/35",
        dotClassName: "bg-white/20",
        skills: filteredSkills.filter((skill) => BROWSER_UNSUITED_SKILLS.has(skill.name)),
      },
      {
        key: "hidden",
        title: "已隐藏",
        subtitle: "不会出现在 Sabrina 的本地快捷入口里，但仍保留在技能馆",
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
