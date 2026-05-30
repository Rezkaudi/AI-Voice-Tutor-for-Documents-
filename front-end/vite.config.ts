import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pdfjsWasmDir = path.resolve(rootDir, "node_modules/pdfjs-dist/wasm");

// pdfjs-dist v5 loads JBig2 / OpenJPEG / QCMS as external .wasm files at
// runtime. This plugin serves them at `/pdfjs-wasm/` in dev and emits them
// to the same path in the production build so deployments (Vercel) have the
// decoders the worker reaches for.
function pdfjsWasm(): Plugin {
  const urlPrefix = "/pdfjs-wasm/";
  return {
    name: "pdfjs-wasm",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(urlPrefix)) return next();
        const name = req.url.slice(urlPrefix.length).split("?")[0]!;
        if (!/^[\w.-]+$/.test(name)) return next();
        try {
          const buf = await readFile(path.join(pdfjsWasmDir, name));
          res.setHeader(
            "Content-Type",
            name.endsWith(".wasm") ? "application/wasm" : "application/javascript"
          );
          res.end(buf);
        } catch {
          next();
        }
      });
    },
    async generateBundle() {
      const entries = await readdir(pdfjsWasmDir);
      for (const name of entries) {
        if (!name.endsWith(".wasm") && !name.endsWith(".js")) continue;
        const source = await readFile(path.join(pdfjsWasmDir, name));
        this.emitFile({
          type: "asset",
          fileName: `pdfjs-wasm/${name}`,
          source
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsWasm()],
  resolve: {
    alias: { "@": path.resolve(rootDir, "./src") }
  }
});
