const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const settingsPath = path.join(__dirname, '../src/settings.ts')
const compiled = ts.transpileModule(fs.readFileSync(settingsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})
const settings = {}
vm.runInNewContext(compiled.outputText, { exports: settings, URL }, { filename: settingsPath })
const { createDefaultSettings, normalizeSettings } = settings

/** 验证首次使用即可选择 GHCR 官方镜像源。 */
test('默认设置包含 GHCR 官方源', () => {
  const defaults = createDefaultSettings('/downloads')
  const ghcr = defaults.sources.find((source) => source.id === 'ghcr')
  assert.equal(defaults.version, 5)
  assert.equal(ghcr.url, 'https://ghcr.io')
  assert.equal(ghcr.username, '')
  assert.equal(ghcr.password, '')
  assert.equal(ghcr.proxyEnabled, false)
  assert.equal(defaults.selectedSourceId, 'docker-hub')
})

/** 验证无有效镜像源的存储仍恢复完整默认设置。 */
test('空镜像源设置恢复默认值', () => {
  for (const version of [4, 5]) {
    const result = normalizeSettings({ version, sources: [] }, '/downloads')
    assert.equal(JSON.stringify(result), JSON.stringify(createDefaultSettings('/downloads')))
  }
})

/** 验证升级只添加 GHCR，并保留原有选择、凭据及各源代理开关。 */
test('第四版设置升级后补充 GHCR 且保留用户配置', () => {
  const stored = {
    version: 4,
    sources: [
      { id: 'private', name: '内网镜像源', url: 'https://registry.example.com', username: '用户', password: '访问令牌', proxyEnabled: false },
      { id: 'dao-ghcr', name: 'GitHub 加速源', url: 'https://ghcr.m.daocloud.io', username: '', password: '', proxyEnabled: true }
    ],
    selectedSourceId: 'private',
    proxy: { protocol: 'http', address: '127.0.0.1:7897', username: '代理用户', password: '代理密码' },
    downloadPath: '/downloads/images'
  }
  const result = normalizeSettings(stored, '/default')
  assert.equal(result.version, 5)
  assert.equal(result.selectedSourceId, 'private')
  assert.equal(result.downloadPath, stored.downloadPath)
  assert.equal(result.sources.length, 3)
  assert.deepEqual(JSON.parse(JSON.stringify(result.sources.slice(0, 2))), stored.sources)
  assert.deepEqual(JSON.parse(JSON.stringify(result.proxy)), stored.proxy)
  assert.equal(result.sources[2].id, 'ghcr')
  assert.equal(result.sources[2].proxyEnabled, false)
  assert.equal(stored.sources.length, 2)
})

/** 验证用户已添加的官方地址不会在升级时被重复添加。 */
test('升级保留已有的自定义 GHCR 源', () => {
  for (const url of ['https://ghcr.io', 'https://ghcr.io/', 'ghcr.io', 'GHCR.IO/']) {
    const stored = createDefaultSettings('/downloads')
    stored.version = 4
    stored.sources = [{ id: 'my-ghcr', name: '我的 GitHub 源', url, username: '用户', password: '访问令牌', proxyEnabled: true }]
    stored.selectedSourceId = 'my-ghcr'
    const result = normalizeSettings(stored, '/default')
    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].url, url)
    assert.equal(result.sources[0].password, '访问令牌')
    assert.equal(result.sources[0].proxyEnabled, true)
    assert.equal(result.selectedSourceId, 'my-ghcr')
  }
})

/** 验证完成迁移后仍可删除新增的内置源。 */
test('第五版设置不会恢复用户删除的 GHCR 源', () => {
  const stored = createDefaultSettings('/downloads')
  stored.sources = stored.sources.filter((source) => source.id !== 'ghcr')
  const result = normalizeSettings(stored, '/default')
  assert.equal(result.sources.some((source) => source.id === 'ghcr'), false)
})

/** 验证更早版本的全局代理仍能迁移到原选中源。 */
test('旧版设置仍能迁移全局代理及内置源', () => {
  const stored = {
    version: 3,
    sources: [{ id: 'custom', name: '自定义源', url: 'https://registry.example.com', username: '', password: '' }],
    selectedSourceId: 'custom',
    proxy: { enabled: true, address: '127.0.0.1:7897' },
    downloadPath: '/downloads'
  }
  const result = normalizeSettings(stored, '/default')
  assert.equal(result.sources.find((source) => source.id === 'custom').proxyEnabled, true)
  assert.equal(result.sources.find((source) => source.id === 'ghcr').proxyEnabled, false)
  assert.equal(result.selectedSourceId, 'custom')
  assert.equal(result.version, 5)
})
