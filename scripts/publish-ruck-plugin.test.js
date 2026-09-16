import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findProjectReadme,
  syncReadmeToDist,
  preparePublishDir,
  bumpVersion
} from './publish-ruck-plugin.js';

async function createFixture() {
  return mkdtemp(join(tmpdir(), 'ruck-plugin-test-'));
}

test('findProjectReadme 能够命中根目录大写 README.md', async () => {
  const root = await createFixture();
  try {
    const readmeFile = join(root, 'README.md');
    await writeFile(readmeFile, '# Test Plugin\nThis is a test.');
    const found = findProjectReadme(root);
    assert.equal(found, readmeFile);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('findProjectReadme 能够命中根目录小写 readme.md', async () => {
  const root = await createFixture();
  try {
    const readmeFile = join(root, 'readme.md');
    await writeFile(readmeFile, '# Lowercase Readme');
    const found = findProjectReadme(root);
    assert.equal(found, readmeFile);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('findProjectReadme 能够命中 public 目录下的 README.md', async () => {
  const root = await createFixture();
  try {
    const pubDir = join(root, 'public');
    await mkdir(pubDir, { recursive: true });
    const readmeFile = join(pubDir, 'README.md');
    await writeFile(readmeFile, '# Public Readme');
    const found = findProjectReadme(root);
    assert.equal(found, readmeFile);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('findProjectReadme 在没有说明文档时返回 null', async () => {
  const root = await createFixture();
  try {
    await writeFile(join(root, 'package.json'), '{}');
    const found = findProjectReadme(root);
    assert.equal(found, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('syncReadmeToDist 能够正确将 README.md 同步为 dist/readme.md', async () => {
  const root = await createFixture();
  const dist = join(root, 'dist');
  try {
    await mkdir(dist, { recursive: true });
    const readmeContent = '# My Ruck Plugin\nDetailed description.';
    await writeFile(join(root, 'README.md'), readmeContent, 'utf8');

    const result = syncReadmeToDist(root, dist);
    assert.equal(result, true);

    const distReadme = join(dist, 'readme.md');
    assert.equal(existsSync(distReadme), true);
    assert.equal(readFileSync(distReadme, 'utf8'), readmeContent);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preparePublishDir 在 dist 模式下完整组装产物 (包含 readme.md 与 package.json)', async () => {
  const root = await createFixture();
  const dist = join(root, 'dist');
  try {
    await mkdir(dist, { recursive: true });
    await writeFile(join(dist, 'index.html'), '<!DOCTYPE html><html><body>Test</body></html>');
    
    // 写入根目录配置
    await writeFile(join(root, 'README.md'), '# Document Content', 'utf8');
    await writeFile(join(root, 'package.json'), JSON.stringify({
      name: '@ruck-plugins/test-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      scripts: { build: 'vite build' },
      devDependencies: { vite: '^5.0.0' }
    }, null, 2));

    await writeFile(join(root, 'plugin.json'), JSON.stringify({
      name: '@ruck-plugins/test-plugin',
      version: '1.0.0',
      pluginType: 'ui',
      author: 'Tester'
    }, null, 2));

    const publishDir = preparePublishDir(root, '1.1.0');
    assert.equal(publishDir, dist);

    // 验证 dist/readme.md
    const distReadmePath = join(dist, 'readme.md');
    assert.equal(existsSync(distReadmePath), true);
    assert.equal(readFileSync(distReadmePath, 'utf8'), '# Document Content');

    // 验证 dist/package.json
    const distPkgPath = join(dist, 'package.json');
    assert.equal(existsSync(distPkgPath), true);
    const distPkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));
    assert.equal(distPkg.version, '1.1.0');
    assert.equal(distPkg.name, '@ruck-plugins/test-plugin');
    assert.equal(distPkg.author, 'Tester');
    assert.equal(distPkg.scripts, undefined);
    assert.equal(distPkg.devDependencies, undefined);

    // 验证 dist/plugin.json 及其版本已更新
    const distPluginJsonPath = join(dist, 'plugin.json');
    assert.equal(existsSync(distPluginJsonPath), true);
    const distPluginData = JSON.parse(readFileSync(distPluginJsonPath, 'utf8'));
    assert.equal(distPluginData.version, '1.1.0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preparePublishDir 在无 readme 时不中断且正常处理', async () => {
  const root = await createFixture();
  const dist = join(root, 'dist');
  try {
    await mkdir(dist, { recursive: true });
    await writeFile(join(dist, 'index.html'), '<html></html>');
    await writeFile(join(root, 'package.json'), JSON.stringify({
      name: '@ruck-plugins/no-readme',
      version: '1.0.0'
    }));

    const publishDir = preparePublishDir(root, '1.0.1');
    assert.equal(publishDir, dist);

    const distReadmePath = join(dist, 'readme.md');
    assert.equal(existsSync(distReadmePath), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('bumpVersion 正确进行 semver 升级', () => {
  assert.equal(bumpVersion('1.0.0', 'patch'), '1.0.1');
  assert.equal(bumpVersion('1.0.0', 'minor'), '1.1.0');
  assert.equal(bumpVersion('1.0.0', 'major'), '2.0.0');
  assert.equal(bumpVersion('1.2', 'patch'), '1.2.1');
});

test('真实插件 color-helper 与 devbox 的 README 识别与同步验证', () => {
  const colorHelperDir = join(process.cwd(), 'plugins', 'color-helper');
  if (existsSync(colorHelperDir)) {
    const readmePath = findProjectReadme(colorHelperDir);
    assert.notEqual(readmePath, null);
    assert.match(readmePath, /README\.md$/i);

    // 验证同步到 dist
    const distDir = join(colorHelperDir, 'dist');
    if (existsSync(distDir)) {
      const ok = syncReadmeToDist(colorHelperDir, distDir);
      assert.equal(ok, true);
      assert.equal(existsSync(join(distDir, 'readme.md')), true);
    }
  }

  const devboxDir = join(process.cwd(), 'plugins', 'devbox');
  if (existsSync(devboxDir)) {
    const readmePath = findProjectReadme(devboxDir);
    assert.notEqual(readmePath, null);
    assert.match(readmePath, /README\.md$/i);

    // 验证同步到 dist
    const distDir = join(devboxDir, 'dist');
    if (existsSync(distDir)) {
      const ok = syncReadmeToDist(devboxDir, distDir);
      assert.equal(ok, true);
      assert.equal(existsSync(join(distDir, 'readme.md')), true);
    }
  }
});

