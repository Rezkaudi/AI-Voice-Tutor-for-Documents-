export const LANGUAGE_NAMES: Record<string, string> = {
    ja: "Japanese",
    en: "English",
    ar: "Arabic"
};

export const MAX_LESSON_PAGES = 5;

export interface TutorGenerationProfile {
    reasoningEffort: string;
    historyWindow: number;
    maxOutputTokens: number;
    maxToolSteps: number;
}

export const NORMAL_GENERATION: TutorGenerationProfile = {
    reasoningEffort: "low",
    historyWindow: 8,
    maxOutputTokens: 700,
    maxToolSteps: 8
};

export const SAVE_COST_GENERATION: TutorGenerationProfile = {
    reasoningEffort: "minimal",
    historyWindow: 4,
    maxOutputTokens: 700,
    maxToolSteps: 8
};
