import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // Vercel's file tracing can't see pdf.js's dynamic worker import,
  // so force the worker file into the serverless function bundle.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"]
  }
};

export default nextConfig;
