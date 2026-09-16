/**
 * Memo-Quick-Paste 兼容垫片构建脚本 (ESM)
 * 将 src-compat/ 打包为单一可用的 preload.js
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = (await import("esbuild")).default;
} catch (e) {
  esbuild = require("D:/github/ruck/node_modules/esbuild");
}

esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, "src-compat/index.js")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: path.resolve(__dirname, "preload.js"),
  minify: false,
  sourcemap: false
});

console.log("✅ Preload successfully compiled to preload.js");
