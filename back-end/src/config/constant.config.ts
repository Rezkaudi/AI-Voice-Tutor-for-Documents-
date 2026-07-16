export const MAX_LESSON_PAGES = 5;

export interface TutorGenerationProfile {
    reasoningEffort: string;
    historyWindow: number;
    maxOutputTokens: number;
}

export const NORMAL_GENERATION: TutorGenerationProfile = {
    reasoningEffort: "low",
    historyWindow: 8,
    maxOutputTokens: 700
};
