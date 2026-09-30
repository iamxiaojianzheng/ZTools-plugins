/**
 * Jet-plugin Ruck 兼容垫片构建脚本 (ESM)
 * 将 src-compat/ 编译为单文件 IIFE 格式的 preload.js
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
  try {
    esbuild = require("D:/github/ruck/node_modules/esbuild");
  } catch (err2) {
    try {
      esbuild = require("esbuild");
    } catch (err3) {
      console.error("未找到 esbuild 模块，请先安装或配置路径");
      process.exit(1);
    }
  }
}

try {
  esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, "src-compat/index.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: path.resolve(__dirname, "preload.js"),
    minify: false,
    sourcemap: false
  });

  console.log("✅ Jet-plugin Preload 成功编译至 preload.js");
} catch (buildErr) {
  console.error("❌ Preload 编译失败:", buildErr);
  process.exit(1);
}
