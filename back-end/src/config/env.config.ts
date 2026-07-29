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
  OPENAI_TRANSCRIBE_MODEL: string;
  OPENAI_SPEECH_MODEL: string;
  OPENAI_SPEECH_VOICE: string;
  TUTOR_LOG_VERBOSE: boolean;
  DEFAULT_PAGE_EXTRACTION_BATCH_SIZE: number;
  MAX_PAGE_EXTRACTION_ATTEMPTS: number;
  DOCUMENT_URL_TTL_SECONDS: number;

  PDF_COMPRESSION_ENABLED: boolean;
  PDF_COMPRESSION_MIN_BYTES: number;
  PDF_COMPRESSION_PRESET: string;
  PDF_COMPRESSION_MIN_GAIN: number;
  PDF_COMPRESSION_TIMEOUT_MS: number;

  // ─── Hugging Face vision-language OCR (Qwen3-VL) ──────────────────────────
  HF_TOKEN: string;
  HF_VL_MODEL: string;
  HF_VL_BASE_URL: string;
  HF_VL_CONCURRENCY: number;

  OCR_SERVICE_URL: string;
  OCR_SERVICE_TIMEOUT_MS: number;
  OCR_SERVICE_MAX_ATTEMPTS: number;
  OCR_SOURCE_URL_TTL_SECONDS: number;

  PAGE_EXTRACTION_CONCURRENCY: number;
  PAGE_EXTRACTION_FLUSH_PAGES: number;
  PAGE_EXTRACTION_FLUSH_MS: number;
  PAGE_EXTRACTION_ACTIVE_REPORT_MS: number;

  EXTRACTION_WORKER_TOKEN: string;
  EXTRACTION_WORKER_URL: string;
  EXTRACTION_JOB_BUDGET_MS: number;
  EXTRACTION_LEASE_TTL_SECONDS: number;
  GCP_PROJECT_ID: string;
  GCP_TASKS_LOCATION: string;
  GCP_TASKS_QUEUE: string;
  GCP_TASKS_SERVICE_ACCOUNT: string;

  // ─── Auth (Google OAuth + JWT cookie sessions) ───────────────────────────
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  FRONTEND_URL: string;

  // ─── Brevo (marketing contact list for feature announcements) ────────────
  BREVO_API_KEY: string;
  BREVO_LIST_ID: number;
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
  OPENAI_TRANSCRIBE_MODEL: getEnv("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe",
  OPENAI_SPEECH_MODEL: getEnv("OPENAI_SPEECH_MODEL") || "gpt-4o-mini-tts",
  OPENAI_SPEECH_VOICE: getEnv("OPENAI_SPEECH_VOICE") || "alloy",

  TUTOR_LOG_VERBOSE: bool(
    getEnv("TUTOR_LOG_VERBOSE"),
    (getEnv("NODE_ENV") || "development") !== "production"
  ),
  DEFAULT_PAGE_EXTRACTION_BATCH_SIZE: Number(getEnv("DEFAULT_PAGE_EXTRACTION_BATCH_SIZE")) || 4,

  MAX_PAGE_EXTRACTION_ATTEMPTS: Number(getEnv("MAX_PAGE_EXTRACTION_ATTEMPTS")) || 5,
  DOCUMENT_URL_TTL_SECONDS: Number(getEnv("DOCUMENT_URL_TTL_SECONDS")) || 24 * 60 * 60,

  PDF_COMPRESSION_ENABLED: bool(getEnv("PDF_COMPRESSION_ENABLED"), true),
  PDF_COMPRESSION_MIN_BYTES: Number(getEnv("PDF_COMPRESSION_MIN_BYTES")) || 4 * 1024 * 1024,
  PDF_COMPRESSION_PRESET: getEnv("PDF_COMPRESSION_PRESET") || "ebook",
  PDF_COMPRESSION_MIN_GAIN: Number(getEnv("PDF_COMPRESSION_MIN_GAIN")) || 0.1,
  PDF_COMPRESSION_TIMEOUT_MS: Number(getEnv("PDF_COMPRESSION_TIMEOUT_MS")) || 4 * 60 * 1000,

  HF_TOKEN: getEnv("HF_TOKEN") || "",
  HF_VL_MODEL: getEnv("HF_VL_MODEL") || "Qwen/Qwen3-VL-30B-A3B-Instruct",
  HF_VL_BASE_URL: getEnv("HF_VL_BASE_URL") || "https://router.huggingface.co/v1",
  HF_VL_CONCURRENCY: Number(getEnv("HF_VL_CONCURRENCY")) || 5,

  OCR_SERVICE_URL: getEnv("OCR_SERVICE_URL") || "http://localhost:8080",
  OCR_SERVICE_TIMEOUT_MS: Number(getEnv("OCR_SERVICE_TIMEOUT_MS")) || 5 * 60 * 1000,
  // Retries for saturation-style failures (429/503). Without these a busy
  // fleet consumes a page's MAX_PAGE_EXTRACTION_ATTEMPTS budget.
  OCR_SERVICE_MAX_ATTEMPTS: Number(getEnv("OCR_SERVICE_MAX_ATTEMPTS")) || 6,

  OCR_SOURCE_URL_TTL_SECONDS: Number(getEnv("OCR_SOURCE_URL_TTL_SECONDS")) || 4 * 60 * 60,

  // OCR requests in flight per document. This — not the batch size — is what
  // sets extraction throughput, and it needs headroom on ocr-service's
  // max-instances (which is per-project, shared by every document at once).
  PAGE_EXTRACTION_CONCURRENCY: Number(getEnv("PAGE_EXTRACTION_CONCURRENCY")) || 20,
  // How much finished work may sit unwritten before pages.json is updated.
  PAGE_EXTRACTION_FLUSH_PAGES: Number(getEnv("PAGE_EXTRACTION_FLUSH_PAGES")) || 16,
  PAGE_EXTRACTION_FLUSH_MS: Number(getEnv("PAGE_EXTRACTION_FLUSH_MS")) || 5_000,
  PAGE_EXTRACTION_ACTIVE_REPORT_MS:
    Number(getEnv("PAGE_EXTRACTION_ACTIVE_REPORT_MS")) || 5_000,

  EXTRACTION_WORKER_TOKEN: getEnv("EXTRACTION_WORKER_TOKEN") || "",
  EXTRACTION_WORKER_URL: getEnv("EXTRACTION_WORKER_URL") || "",
  EXTRACTION_JOB_BUDGET_MS: Number(getEnv("EXTRACTION_JOB_BUDGET_MS")) || 8 * 60 * 1000,
  EXTRACTION_LEASE_TTL_SECONDS: Number(getEnv("EXTRACTION_LEASE_TTL_SECONDS")) || 3 * 60,
  GCP_PROJECT_ID: getEnv("GCP_PROJECT_ID") || "",
  GCP_TASKS_LOCATION: getEnv("GCP_TASKS_LOCATION") || "",
  GCP_TASKS_QUEUE: getEnv("GCP_TASKS_QUEUE") || "",
  GCP_TASKS_SERVICE_ACCOUNT: getEnv("GCP_TASKS_SERVICE_ACCOUNT") || "",

  // ─── Auth (Google OAuth + JWT cookie sessions) ───────────────────────────
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_CALLBACK_URL: requireEnv("GOOGLE_CALLBACK_URL"),
  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_TTL: getEnv("ACCESS_TOKEN_TTL") || "1d",
  REFRESH_TOKEN_TTL: getEnv("REFRESH_TOKEN_TTL") || "7d",
  FRONTEND_URL: getEnv("FRONTEND_URL") || "http://localhost:5173",

  BREVO_API_KEY: getEnv("BREVO_API_KEY") || "",
  BREVO_LIST_ID: Number(getEnv("BREVO_LIST_ID")) || 0,
});
