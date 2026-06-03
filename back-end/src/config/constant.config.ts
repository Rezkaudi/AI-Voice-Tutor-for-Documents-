/** ISO 639-1 code → display name, used to pin the tutor's reply language. */
export const LANGUAGE_NAMES: Record<string, string> = {
    ja: "Japanese",
    en: "English",
    ar: "Arabic"
};

export interface TutorGenerationProfile {
    reasoningEffort: string;
    historyWindow: number;
    maxOutputTokens: number;
    maxToolSteps: number;
}

/** Full-quality tutoring: fastest reasoning, full history. */
export const NORMAL_GENERATION: TutorGenerationProfile = {
    reasoningEffort: "none",
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
