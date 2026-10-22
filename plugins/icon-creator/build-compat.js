/**
 * Icon-Creator 兼容垫片构建脚本 (ESM)
 * 将 src-compat/ 打包编译为独立的 preload.js (IIFE 格式)
 */
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

let esbuild = null
const candidates = [
  'esbuild',
  path.resolve(__dirname, '../color-helper/node_modules/esbuild'),
  path.resolve(__dirname, '../../node_modules/esbuild'),
  'D:/github/ruck/node_modules/esbuild'
]

for (const candidate of candidates) {
  try {
    const mod = await import(candidate)
    esbuild = mod.default || mod
    if (esbuild?.buildSync) break
  } catch {
    try {
      esbuild = require(candidate)
      if (esbuild?.buildSync) break
    } catch {}
  }
}

if (!esbuild || !esbuild.buildSync) {
  throw new Error('未找到可用 esbuild，请在当前目录运行 npm install 或确保同级依赖存在。')
}

const entryPoint = path.resolve(__dirname, 'src-compat/index.js')
const publicPreload = path.resolve(__dirname, 'public/preload.js')
const rootPreload = path.resolve(__dirname, 'preload.js')

const publicDir = path.resolve(__dirname, 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

esbuild.buildSync({
  entryPoints: [entryPoint],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  outfile: publicPreload,
  minify: false,
  sourcemap: false
})

fs.copyFileSync(publicPreload, rootPreload)

console.log('✅ [IconCreator] Preload compiled successfully to public/preload.js and preload.js')
