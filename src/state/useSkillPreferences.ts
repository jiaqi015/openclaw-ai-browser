import { useEffect, useState } from "react";

const storageKey = "sabrina-skill-preferences-v1";

type SkillPreferencesState = {
  pinnedSkillNames: string[];
  hiddenSkillNames: string[];
};

const defaultState: SkillPreferencesState = {
  pinnedSkillNames: ["summarize", "skill-creator", "obsidian"],
  hiddenSkillNames: [],
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean);
}

function readSavedPreferences(): SkillPreferencesState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultState;
    }

    const parsed = JSON.parse(raw);
    return {
      pinnedSkillNames: normalizeStringArray(parsed?.pinnedSkillNames),
      hiddenSkillNames: normalizeStringArray(
        parsed?.hiddenSkillNames ?? parsed?.disabledSkillNames,
      ),
    };
  } catch {
    return defaultState;
  }
}

function savePreferences(nextState: SkillPreferencesState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextState));
}

export function useSkillPreferences() {
  const [preferences, setPreferences] = useState<SkillPreferencesState>(readSavedPreferences);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  function togglePinnedSkill(skillName: string) {
    setPreferences((current) => {
      const nextPinned = current.pinnedSkillNames.includes(skillName)
        ? current.pinnedSkillNames.filter((name) => name !== skillName)
        : [...current.pinnedSkillNames, skillName];

      return {
        ...current,
        pinnedSkillNames: nextPinned,
      };
    });
  }

  function toggleHiddenSkill(skillName: string) {
    setPreferences((current) => {
      const isCurrentlyHidden = current.hiddenSkillNames.includes(skillName);
      const nextHidden = isCurrentlyHidden
        ? current.hiddenSkillNames.filter((name) => name !== skillName)
        : [...current.hiddenSkillNames, skillName];

      return {
        pinnedSkillNames: isCurrentlyHidden
          ? current.pinnedSkillNames
          : current.pinnedSkillNames.filter((name) => name !== skillName),
        hiddenSkillNames: nextHidden,
      };
    });
  }

  return {
    pinnedSkillNames: preferences.pinnedSkillNames,
    hiddenSkillNames: preferences.hiddenSkillNames,
    togglePinnedSkill,
    toggleHiddenSkill,
  };
}
