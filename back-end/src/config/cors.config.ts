import type { CorsOptions } from "cors";
import { ENV_CONFIG } from "@/config/env.config";

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "null"
];

export const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...ENV_CONFIG.CORS_ORIGINS])
);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
};
