# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Build toolchain for any native deps that fall back to source build
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Runtime libs for @napi-rs/canvas + pdfjs-dist (font rendering)
# ghostscript: PDF compression/optimization (the `gs` binary)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ghostscript \
      fontconfig \
      libfreetype6 \
      fonts-dejavu-core \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-cjk \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Drop privileges
USER node

EXPOSE 5000
CMD ["node", "dist/main.js"]
