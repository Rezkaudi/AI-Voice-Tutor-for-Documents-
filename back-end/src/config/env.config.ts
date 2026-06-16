import dotenv from "dotenv";

dotenv.config();

export type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  DB_SYNCHRONIZE: boolean;
  DB_LOGGING: boolean;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  OPENAI_API_KEY: string;
  OPENAI_TUTOR_MODEL: string;
  OPENAI_TUTOR_MODEL_SAVE_COST: string;
  OPENAI_EMBEDDING_MODEL: string;
  OPENAI_TRANSCRIBE_MODEL: string;
  OPENAI_SPEECH_MODEL: string;
  OPENAI_SPEECH_VOICE: string;
  TUTOR_LOG_VERBOSE: boolean;

  // ─── Auth (Google OAuth + JWT cookie sessions) ───────────────────────────
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  FRONTEND_URL: string;
};

type EnvKey = keyof EnvConfig;

const getEnv = (key: EnvKey): string | undefined => process.env[key];

const requireEnv = (key: EnvKey): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const csv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === "" ? fallback : value === "true" || value === "1";

export const ENV_CONFIG: Readonly<EnvConfig> = Object.freeze({
  NODE_ENV: getEnv("NODE_ENV") || "development",
  PORT: Number(getEnv("PORT") || 5000),

  CORS_ORIGINS: csv(getEnv("CORS_ORIGINS")),

  DATABASE_URL: getEnv("DATABASE_URL") || "",
  DB_SYNCHRONIZE: getEnv("DB_SYNCHRONIZE") === "true" || getEnv("DB_SYNCHRONIZE") === "1",
  DB_LOGGING: getEnv("DB_LOGGING") === "true" || getEnv("DB_LOGGING") === "1",

  S3_BUCKET: getEnv("S3_BUCKET") || "",
  S3_REGION: getEnv("S3_REGION") || "us-east-1",
  S3_ACCESS_KEY_ID: getEnv("S3_ACCESS_KEY_ID") || "",
  S3_SECRET_ACCESS_KEY: getEnv("S3_SECRET_ACCESS_KEY") || "",

  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  OPENAI_TUTOR_MODEL: getEnv("OPENAI_TUTOR_MODEL") || "gpt-5.4-mini",
  OPENAI_TUTOR_MODEL_SAVE_COST: getEnv("OPENAI_TUTOR_MODEL_SAVE_COST") || "gpt-5-nano",
  OPENAI_EMBEDDING_MODEL: getEnv("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small",
  OPENAI_TRANSCRIBE_MODEL: getEnv("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe",
  OPENAI_SPEECH_MODEL: getEnv("OPENAI_SPEECH_MODEL") || "gpt-4o-mini-tts",
  OPENAI_SPEECH_VOICE: getEnv("OPENAI_SPEECH_VOICE") || "alloy",

  // Verbose tutor tracing: dump the full result of each agentic step (tool
  // output, recorded citations, answer text). On by default outside production;
  // set TUTOR_LOG_VERBOSE=false to keep only the concise step summaries.
  TUTOR_LOG_VERBOSE: bool(
    getEnv("TUTOR_LOG_VERBOSE"),
    (getEnv("NODE_ENV") || "development") !== "production"
  ),

  // ─── Auth (Google OAuth + JWT cookie sessions) ───────────────────────────
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_CALLBACK_URL: requireEnv("GOOGLE_CALLBACK_URL"),
  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  // Short-lived access token; long-lived refresh token ("1 week").
  ACCESS_TOKEN_TTL: getEnv("ACCESS_TOKEN_TTL") || "1d",
  REFRESH_TOKEN_TTL: getEnv("REFRESH_TOKEN_TTL") || "7d",
  // Where the OAuth callback sends the browser once cookies are set.
  FRONTEND_URL: getEnv("FRONTEND_URL") || "http://localhost:5173",
});
