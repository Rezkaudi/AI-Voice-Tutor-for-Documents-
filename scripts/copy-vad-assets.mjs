// Copies the @ricky0123/vad-web runtime assets (speech-detection worklet, the
// Silero ONNX models, and the onnxruntime-web WASM binaries) into public/vad/
// so the browser can load them as static files. Re-run automatically on every
// install via the `postinstall` script; safe to run by hand.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "vad");
mkdirSync(dest, { recursive: true });

const vadDist = join(root, "node_modules", "@ricky0123", "vad-web", "dist");
const ortDist = join(root, "node_modules", "onnxruntime-web", "dist");

const files = [
  [join(vadDist, "vad.worklet.bundle.min.js"), "vad.worklet.bundle.min.js"],
  [join(vadDist, "silero_vad_v5.onnx"), "silero_vad_v5.onnx"],
  [join(vadDist, "silero_vad_legacy.onnx"), "silero_vad_legacy.onnx"],
  [join(ortDist, "ort-wasm-simd-threaded.wasm"), "ort-wasm-simd-threaded.wasm"],
  [join(ortDist, "ort-wasm-simd-threaded.mjs"), "ort-wasm-simd-threaded.mjs"],
  [join(ortDist, "ort-wasm-simd-threaded.jsep.wasm"), "ort-wasm-simd-threaded.jsep.wasm"],
  [join(ortDist, "ort-wasm-simd-threaded.jsep.mjs"), "ort-wasm-simd-threaded.jsep.mjs"]
];

for (const [from, name] of files) {
  cpSync(from, join(dest, name));
}

console.log(`Copied ${files.length} VAD assets into public/vad/`);
