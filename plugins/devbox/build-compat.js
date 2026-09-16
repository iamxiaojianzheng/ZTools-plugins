/**
 * Devbox 兼容垫片构建脚本 (ESM)
 * 将 src-compat/ 打包编译为独立的 preload.js
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = (await import("esbuild")).default;
} catch (e1) {
  try {
    esbuild = require("esbuild");
  } catch (e2) {
    const candidatePaths = [
      path.resolve(__dirname, "../../node_modules/esbuild"),
      path.resolve(__dirname, "../color-helper/node_modules/esbuild"),
      "D:/github/ruck/node_modules/esbuild"
    ];
    for (const p of candidatePaths) {
      try {
        esbuild = require(p);
        if (esbuild) break;
      } catch (err) {}
    }
    if (!esbuild) {
      throw new Error("Cannot find esbuild. Please install esbuild or check paths.");
    }
  }
}

const entryPoint = path.resolve(__dirname, "src-compat/index.js");
const publicPreload = path.resolve(__dirname, "public/preload.js");
const rootPreload = path.resolve(__dirname, "preload.js");

// 确保 public 目录存在
const publicDir = path.resolve(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

esbuild.buildSync({
  entryPoints: [entryPoint],
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  outfile: publicPreload,
  minify: false,
  sourcemap: false
});

// 同步拷贝一份到插件根目录，便于不同运行环境读取
fs.copyFileSync(publicPreload, rootPreload);

// 同步一份 public/plugin.json 到根目录 plugin.json
const publicPluginJson = path.resolve(__dirname, "public/plugin.json");
const rootPluginJson = path.resolve(__dirname, "plugin.json");
if (fs.existsSync(publicPluginJson)) {
  fs.copyFileSync(publicPluginJson, rootPluginJson);
}

console.log("✅ [Devbox] Preload compiled successfully to public/preload.js and preload.js");
