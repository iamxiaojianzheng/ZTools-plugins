import esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const publicPreload = path.resolve('public/preload.js')

esbuild.buildSync({
  entryPoints: ['src-compat/index.ts'],
  bundle: true,
  outfile: publicPreload,
  format: 'iife',
  platform: 'browser',
  target: ['es2020']
})

console.log('✅ Preload successfully compiled to', publicPreload)

// 若 dist 目录存在，也同步备份一份
const distPreload = path.resolve('dist/preload.js')
if (fs.existsSync(path.dirname(distPreload))) {
  fs.copyFileSync(publicPreload, distPreload)
  console.log('✅ Synchronized to', distPreload)
}
