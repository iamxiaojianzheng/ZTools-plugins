import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');
const appDir = path.join(rootDir, 'app');
const distDir = path.join(rootDir, 'dist');

if (!existsSync(appDir)) {
  throw new Error(`App directory not found: ${appDir}`);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
cpSync(appDir, distDir, { recursive: true });

// 同步根目录规范 plugin.json 至 dist/plugin.json
const rootPluginJson = path.join(rootDir, 'plugin.json');
if (existsSync(rootPluginJson)) {
  copyFileSync(rootPluginJson, path.join(distDir, 'plugin.json'));
}

// 同步根目录 README.md 至 dist/readme.md
const readmeNames = ['README.md', 'readme.md'];
for (const name of readmeNames) {
  const readmePath = path.join(rootDir, name);
  if (existsSync(readmePath)) {
    copyFileSync(readmePath, path.join(distDir, 'readme.md'));
    break;
  }
}

// 确保 logo.png 存在于 dist/
const logoSrc = path.join(appDir, 'logo.png');
if (existsSync(logoSrc)) {
  copyFileSync(logoSrc, path.join(distDir, 'logo.png'));
}

console.log(`Successfully built and copied app contents to ${distDir}`);
