import { useEffect, useState } from "react";

const storageKey = "sabrina-skill-preferences-v2";
const legacyStorageKey = "sabrina-skill-preferences-v1";
const legacyDisabledField = ["disabled", "Skill", "Names"].join("");

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

  return Array.from(
    new Set(
      value
        .map((entry) => `${entry ?? ""}`.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeSavedPreferences(parsed: unknown): SkillPreferencesState {
  const payload = parsed && typeof parsed === "object" ? parsed : {};
  const legacyHiddenValue =
    payload && typeof payload === "object"
      ? Reflect.get(payload, legacyDisabledField)
      : undefined;

  return {
    pinnedSkillNames: normalizeStringArray(
      payload && typeof payload === "object"
        ? Reflect.get(payload, "pinnedSkillNames")
        : undefined,
    ),
    hiddenSkillNames: normalizeStringArray(
      payload && typeof payload === "object"
        ? Reflect.get(payload, "hiddenSkillNames") ?? legacyHiddenValue
        : legacyHiddenValue,
    ),
  };
}

function readSavedPreferences() {
  if (typeof window === "undefined") {
    return {
      preferences: defaultState,
      needsMigration: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      return {
        preferences: normalizeSavedPreferences(JSON.parse(raw)),
        needsMigration: false,
      };
    }

    const legacyRaw = window.localStorage.getItem(legacyStorageKey);
    if (!legacyRaw) {
      return {
        preferences: defaultState,
        needsMigration: false,
      };
    }

    return {
      preferences: normalizeSavedPreferences(JSON.parse(legacyRaw)),
      needsMigration: true,
    };
  } catch {
    return {
      preferences: defaultState,
      needsMigration: false,
    };
  }
}

function savePreferences(nextState: SkillPreferencesState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  window.localStorage.removeItem(legacyStorageKey);
}

export function useSkillPreferences() {
  const initialState = readSavedPreferences();
  const [preferences, setPreferences] = useState<SkillPreferencesState>(initialState.preferences);
  const [needsMigration, setNeedsMigration] = useState(initialState.needsMigration);

  useEffect(() => {
    savePreferences(preferences);
    if (needsMigration) {
      setNeedsMigration(false);
    }
  }, [needsMigration, preferences]);

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
