/** ISO 639-1 code → display name, used to pin the tutor's reply language. */
export const LANGUAGE_NAMES: Record<string, string> = {
    ja: "Japanese",
    en: "English",
    ar: "Arabic"
};

/**
 * The most pages a student may pick for one focused lesson. Their full text is
 * injected into the model's context, so this caps both the token cost and how
 * much material a single lesson covers. Mirrored on the front-end.
 */
export const MAX_LESSON_PAGES = 5;

export interface TutorGenerationProfile {
    reasoningEffort: string;
    historyWindow: number;
    maxOutputTokens: number;
    maxToolSteps: number;
}

/**
 * Full-quality tutoring: a small reasoning budget so the model aligns each
 * recorded citation with the exact sentence/example it teaches (at "none" the
 * quotes drifted from the prose), plus full history.
 */
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
