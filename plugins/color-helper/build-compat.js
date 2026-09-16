/**
 * Color-Helper 兼容垫片构建脚本 (ESM)
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
    try {
      esbuild = require("D:/github/ruck/node_modules/esbuild");
    } catch (e3) {
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

console.log("✅ [ColorHelper] Preload compiled successfully to public/preload.js and preload.js");
