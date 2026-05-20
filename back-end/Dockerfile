# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Build toolchain for any native deps that fall back to source build
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Runtime libs for @napi-rs/canvas + pdfjs-dist (font rendering)
RUN apk add --no-cache \
      fontconfig \
      freetype \
      ttf-dejavu \
      ttf-liberation \
      font-noto \
      font-noto-cjk \
      font-noto-arabic \
      font-noto-emoji

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Drop privileges
USER node

EXPOSE 5000
CMD ["node", "dist/main.js"]
