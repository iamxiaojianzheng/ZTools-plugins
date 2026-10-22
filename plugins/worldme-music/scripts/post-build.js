// 构建后处理：为 src-ztools/preload 安装运行依赖并精简体积
// ZTools 要求 preload 的第三方依赖位于 preload 同级目录且保持源码可读，不做打包压缩。
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const preloadDir = join(projectRoot, 'src-ztools', 'preload');
const distDir = join(projectRoot, 'src-ztools', 'dist');

function log(msg) {
  console.log('📦 ' + msg);
}

if (!existsSync(preloadDir)) {
  console.error('❌ 未找到 src-ztools/preload');
  process.exit(1);
}
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('❌ 未找到 src-ztools/dist/index.html，请确认 vite 构建完成');
  process.exit(1);
}

log('安装 preload 运行依赖 ...');
try {
  execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund --loglevel=error', {
    cwd: preloadDir,
    stdio: 'inherit'
  });
} catch (e) {
  console.error('❌ preload 依赖安装失败：', e.message);
  process.exit(1);
}

// 精简 node_modules 中的无关文件，减小插件体积
const REMOVE_EXT = new Set(['.md', '.markdown', '.txt', '.map', '.ts', '.flow']);
const REMOVE_DIR = new Set([
  'test', 'tests', '__tests__', 'example', 'examples', 'demo', 'demos',
  'doc', 'docs', 'coverage', '.github', '.git', 'benchmark'
]);
const REMOVE_FILE = new Set(['LICENSE', 'LICENSE.md', 'CHANGELOG', 'CHANGELOG.md', 'README', 'README.md', '.npmignore']);

let removed = 0;
function prune(dir) {
  let items;
  try {
    items = readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const item of items) {
    const full = join(dir, item);
    let st;
    try {
      st = statSync(full);
    } catch (e) {
      continue;
    }
    if (st.isDirectory()) {
      if (REMOVE_DIR.has(item.toLowerCase())) {
        try {
          rmSync(full, { recursive: true, force: true });
          removed++;
        } catch (e) {
          /* ignore */
        }
      } else {
        prune(full);
      }
    } else {
      const lower = item.toLowerCase();
      if (REMOVE_EXT.has(extname(lower)) || REMOVE_FILE.has(item) || REMOVE_FILE.has(lower)) {
        try {
          rmSync(full, { force: true });
          removed++;
        } catch (e) {
          /* ignore */
        }
      }
    }
  }
}

const nodeModules = join(preloadDir, 'node_modules');
if (existsSync(nodeModules)) {
  prune(nodeModules);
  log('已精简 ' + removed + ' 个无关文件');
}

log('构建完成 → src-ztools/');
