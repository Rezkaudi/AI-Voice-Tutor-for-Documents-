export const appConfig = {
  accessCode: process.env.APP_ACCESS_CODE?.trim() || "",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  tutorModel: process.env.OPENAI_TUTOR_MODEL?.trim() || "gpt-5.4-mini",
  // Cheaper tutor model used when the learner turns on "save-cost mode".
  tutorModelSaveCost: process.env.OPENAI_TUTOR_MODEL_SAVE_COST?.trim() || "gpt-5-nano",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
  speechModel: process.env.OPENAI_SPEECH_MODEL?.trim() || "gpt-4o-mini-tts",
  speechVoice: process.env.OPENAI_SPEECH_VOICE?.trim() || "alloy",
  supabaseUrl: process.env.SUPABASE_URL?.trim() || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "teaching-documents"
};

export function hasSupabaseConfig(): boolean {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseServiceRoleKey);
}

export function hasOpenAIConfig(): boolean {
  return Boolean(appConfig.openaiApiKey);
}

export function getSupabaseConfigIssue(): string | null {
  if (!appConfig.supabaseUrl && !appConfig.supabaseServiceRoleKey) {
    return null;
  }

  if (!appConfig.supabaseUrl || !appConfig.supabaseServiceRoleKey) {
    return "Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or leave both empty to use local storage.";
  }

  if (!isLikelySupabaseServiceKey(appConfig.supabaseServiceRoleKey)) {
    return "SUPABASE_SERVICE_ROLE_KEY must be a Supabase secret/service-role key. Do not use the anon or publishable key.";
  }

  return null;
}

function isLikelySupabaseServiceKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) {
    return true;
  }

  if (!key.startsWith("eyJ")) {
    return false;
  }

  const payload = key.split(".")[1];
  if (!payload) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string };
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}
