#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import readline from 'readline';

/**
 * ZTools-plugins 下专用的 Ruck 插件一键发布工具
 * 支持发布适配为 Ruck 的插件（如 memo-quick-paste）到 @ruck-plugins 组织
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function success(msg) {
  log(`✅ ${msg}`, colors.green);
}

function warn(msg) {
  log(`⚠️  ${msg}`, colors.yellow);
}

function error(msg) {
  log(`❌ ${msg}`, colors.red);
}

function info(msg) {
  log(`ℹ️  ${msg}`, colors.cyan);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(`${colors.bright}${question}${colors.reset} `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 判定是否是适配好的 Ruck 插件
function isRuckPlugin(pluginDir) {
  const pPath = fs.existsSync(path.join(pluginDir, 'public', 'plugin.json'))
    ? path.join(pluginDir, 'public', 'plugin.json')
    : path.join(pluginDir, 'plugin.json');

  if (fs.existsSync(pPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pPath, 'utf8'));
      if (data.pluginType === 'ui' || (data.name && data.name.startsWith('@ruck-plugins/'))) {
        return true;
      }
    } catch (e) {}
  }

  const pkgPath = path.join(pluginDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name && pkg.name.startsWith('@ruck-plugins/')) {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

// 扫描 plugins/ 目录下的 Ruck 插件
function scanRuckPlugins(workspaceRoot) {
  const baseDir = path.join(workspaceRoot, 'plugins');
  if (!fs.existsSync(baseDir)) return [];

  const items = fs.readdirSync(baseDir, { withFileTypes: true });
  const plugins = [];

  for (const item of items) {
    if (!item.isDirectory()) continue;
    const pluginDir = path.join(baseDir, item.name);

    if (isRuckPlugin(pluginDir)) {
      let name = item.name;
      let version = '1.0.0';
      let title = item.name;

      const pPath = fs.existsSync(path.join(pluginDir, 'public', 'plugin.json'))
        ? path.join(pluginDir, 'public', 'plugin.json')
        : path.join(pluginDir, 'plugin.json');

      if (fs.existsSync(pPath)) {
        try {
          const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          name = pData.name || name;
          version = pData.version || version;
          title = pData.displayName || pData.title || title;
        } catch (e) {}
      }

      plugins.push({
        folder: item.name,
        fullPath: pluginDir,
        name,
        title,
        version
      });
    }
  }

  return plugins;
}

function bumpVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'patch') parts[2] += 1;
  else if (type === 'minor') { parts[1] += 1; parts[2] = 0; }
  else if (type === 'major') { parts[0] += 1; parts[1] = 0; parts[2] = 0; }
  return parts.slice(0, 3).join('.');
}

function syncVersion(pluginDir, newVersion) {
  let updatedFiles = [];
  const pkgPath = path.join(pluginDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = newVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      updatedFiles.push('package.json');
    } catch (e) {}
  }

  const pPaths = [path.join(pluginDir, 'public', 'plugin.json'), path.join(pluginDir, 'plugin.json')];
  for (const p of pPaths) {
    if (fs.existsSync(p)) {
      try {
        const pData = JSON.parse(fs.readFileSync(p, 'utf8'));
        pData.version = newVersion;
        fs.writeFileSync(p, JSON.stringify(pData, null, 2) + '\n', 'utf8');
        updatedFiles.push(path.relative(pluginDir, p));
      } catch (e) {}
    }
  }
  return updatedFiles;
}

function executeBuild(pluginDir) {
  const pkgPath = path.join(pluginDir, 'package.json');
  const buildScriptPath = path.join(pluginDir, 'build.js');

  let hasPkgBuild = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.build) hasPkgBuild = true;
    } catch (e) {}
  }

  if (hasPkgBuild) {
    info(`🔨 正在执行构建: npm run build ...`);
    execSync('npm run build', { cwd: pluginDir, stdio: 'inherit' });
    success('构建完成！');
  } else if (fs.existsSync(buildScriptPath)) {
    info(`🔨 正在编译垫片: node build.js ...`);
    execSync('node build.js', { cwd: pluginDir, stdio: 'inherit' });
    success('垫片编译完成！');
  } else {
    info(`ℹ️ 无需编译步骤，使用现有静态产物。`);
  }
}

function preparePublishDir(pluginDir, targetVersion) {
  const distDir = path.join(pluginDir, 'dist');
  const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));

  if (hasDist) {
    info(`📦 准备发布 dist/ 目录产物...`);
    const rootPkgPath = path.join(pluginDir, 'package.json');
    let pkg = { name: path.basename(pluginDir), version: targetVersion };
    if (fs.existsSync(rootPkgPath)) {
      try {
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
        pkg = { ...rootPkg, version: targetVersion };
      } catch (e) {}
    }
    delete pkg.scripts;
    delete pkg.devDependencies;
    fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    return distDir;
  } else {
    info(`📦 准备发布插件根目录产物...`);
    const pkgPath = path.join(pluginDir, 'package.json');
    const pluginJsonPath = path.join(pluginDir, 'plugin.json');

    if (!fs.existsSync(pkgPath) && fs.existsSync(pluginJsonPath)) {
      const pData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      fs.writeFileSync(pkgPath, JSON.stringify({
        name: pData.name,
        version: targetVersion,
        description: pData.description || '',
        author: pData.author || ''
      }, null, 2) + '\n', 'utf8');
    }

    // 写入过滤开发文件的 .npmignore
    const npmignorePath = path.join(pluginDir, '.npmignore');
    if (!fs.existsSync(npmignorePath)) {
      fs.writeFileSync(npmignorePath, 'src-compat/\nbuild.js\n.git\nnode_modules/\n*.log\n', 'utf8');
    }

    return pluginDir;
  }
}

async function main() {
  log(`\n========================================`, colors.bright);
  log(`🚀  ZTools -> Ruck 插件一键发包工具       `, colors.bright);
  log(`========================================\n`, colors.bright);

  try {
    const whoami = execSync('npm whoami', { encoding: 'utf8' }).trim();
    success(`已登录 NPM 账号: ${whoami}`);
  } catch (e) {
    warn(`未检测到 NPM 登录状态，若尚未登录请先执行 "npm login"`);
  }

  const workspaceRoot = process.cwd();
  const plugins = scanRuckPlugins(workspaceRoot);

  if (plugins.length === 0) {
    error('未在 plugins/ 目录下找到适配了 Ruck 的插件（需在 plugin.json 声明 pluginType: "ui" 或 @ruck-plugins/）');
    process.exit(1);
  }

  let targetPlugin = null;
  const argPluginName = process.argv[2];

  if (argPluginName && !argPluginName.startsWith('-')) {
    targetPlugin = plugins.find(p => p.folder === argPluginName || p.name === argPluginName);
    if (!targetPlugin) {
      error(`未找到插件 "${argPluginName}"，可用 Ruck 插件: ${plugins.map(p => p.folder).join(', ')}`);
      process.exit(1);
    }
  } else {
    log(`已检测到以下已适配的 Ruck 插件:`, colors.cyan);
    plugins.forEach((p, idx) => {
      console.log(`  [${colors.bright}${idx + 1}${colors.reset}] ${p.title} (${colors.yellow}${p.name}${colors.reset} v${p.version})`);
    });

    const choice = await ask(`\n请选择要发布的插件 (1-${plugins.length}):`);
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= plugins.length) {
      error('无效的选择，发布已取消。');
      process.exit(1);
    }
    targetPlugin = plugins[idx];
  }

  log(`\n🎯 目标插件: ${colors.bright}${targetPlugin.title}${colors.reset} [${targetPlugin.name}]`);
  log(`📌 当前版本: ${colors.yellow}v${targetPlugin.version}${colors.reset}\n`);

  const patchVer = bumpVersion(targetPlugin.version, 'patch');
  const minorVer = bumpVersion(targetPlugin.version, 'minor');
  const majorVer = bumpVersion(targetPlugin.version, 'major');

  console.log(`请选择版本号升级策略:`);
  console.log(`  [1] Patch:  ${colors.green}${patchVer}${colors.reset} (小修复)`);
  console.log(`  [2] Minor:  ${colors.green}${minorVer}${colors.reset} (新特性)`);
  console.log(`  [3] Major:  ${colors.green}${majorVer}${colors.reset} (大版本)`);
  console.log(`  [4] 保持当前版本 (${targetPlugin.version}) 重发`);
  console.log(`  [5] 自定义输入`);

  const verChoice = await ask(`\n选择策略 (1-5) [默认 1]:`);
  let newVersion = patchVer;
  if (verChoice === '2') newVersion = minorVer;
  else if (verChoice === '3') newVersion = majorVer;
  else if (verChoice === '4') newVersion = targetPlugin.version;
  else if (verChoice === '5') {
    newVersion = await ask('请输入版本号 (如 1.0.1):');
  }

  info(`目标版本: v${newVersion}`);

  if (newVersion !== targetPlugin.version) {
    const updated = syncVersion(targetPlugin.fullPath, newVersion);
    success(`版本号已同步到: ${updated.join(', ')}`);
  }

  try {
    executeBuild(targetPlugin.fullPath);
  } catch (e) {
    error('构建失败，已中断发布。');
    process.exit(1);
  }

  const publishDir = preparePublishDir(targetPlugin.fullPath, newVersion);

  const confirm = await ask(`\n确认立即发布 ${targetPlugin.name}@${newVersion} 到 NPM? (y/N):`);
  if (confirm.toLowerCase() !== 'y') {
    warn('发布已取消。');
    process.exit(0);
  }

  info(`🚀 正在发布到 NPM...`);
  try {
    execSync('npm publish --access public', { cwd: publishDir, stdio: 'inherit' });
    log(`\n🎉🎉 成功发布 ${targetPlugin.name}@${newVersion} 到 NPM！`, colors.bright + colors.green);
  } catch (e) {
    error(`发布失败: ${e.message}`);
    process.exit(1);
  }

  log(`\n========================================`, colors.bright);
  log(`📋 后续操作:`, colors.cyan);
  console.log(`1. 提交并推送到你的 me 远程:`);
  console.log(`   ${colors.yellow}git add plugins/${targetPlugin.folder} && git commit -m "chore(release): ${targetPlugin.name} v${newVersion}" && git push me ruck${colors.reset}`);
  console.log(`2. GitHub Actions 将自动触发 ruck-plugin-registry 同步并部署上线！\n`);
}

main().catch(err => {
  error(`异常: ${err.message}`);
  process.exit(1);
});
