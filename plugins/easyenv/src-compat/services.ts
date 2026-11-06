/**
 * 适配 Ruck 运行时的 window.services 门面实现
 * 彻底替换 Node.js 原生依赖，基于跨环境执行器与 PowerShell 内存 Base64 管道
 */

import { executeCommand, runPSJson, psq, b64Utf16Le } from './executor'

const SHARED_DIR = 'C:\\ProgramData\\easyenv'
const SNAPSHOT_KEY = 'easyenv_snapshots'
const PRESET_KEY = 'easyenv_presets'
const MAX_SNAPSHOTS = 20

const SCOPES: Record<string, { hive: string; sub: string }> = {
  user: { hive: 'CurrentUser', sub: 'Environment' },
  machine: {
    hive: 'LocalMachine',
    sub: 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  }
}

// ==================== 权限 ====================

let adminCache: boolean | null = null

export async function isAdmin(): Promise<boolean> {
  if (adminCache !== null) return adminCache
  const script =
    '$r = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)\n' +
    '$result = @{ isAdmin = $r }'
  const r = await runPSJson<{ isAdmin: boolean }>(script, 20000)
  adminCache = !!(r.ok && r.data && r.data.isAdmin)
  return adminCache
}

// ==================== 环境变量读取 ====================

export interface EnvVarItem {
  name: string
  kind: string
  value: string
}

export async function readScope(scope: string): Promise<{ ok: boolean; error?: string; vars: EnvVarItem[] }> {
  const s = SCOPES[scope]
  if (!s) return { ok: false, error: '未知作用域：' + scope, vars: [] }
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$result = @{ error = ''; vars = @() }",
    'try {',
    '  $key = [Microsoft.Win32.Registry]::' + s.hive + '.OpenSubKey(' + psq(s.sub) + ')',
    '  if ($key -eq $null) { throw "注册表键不存在：" + ' + psq(s.sub) + ' }',
    '  $list = New-Object System.Collections.ArrayList',
    '  foreach ($n in $key.GetValueNames()) {',
    '    $kind = $key.GetValueKind($n).ToString()',
    '    $raw = $key.GetValue($n, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)',
    "    $val = ''",
    "    if ($kind -eq 'MultiString') { $val = (@($raw) -join \"`n\") } else { $val = [string]$raw }",
    '    [void]$list.Add(@{ name = [string]$n; kind = $kind; value = $val })',
    '  }',
    '  $key.Close()',
    '  $result.vars = @($list)',
    '} catch { $result.error = $_.Exception.Message }'
  ].join('\n')

  const r = await runPSJson<{ error: string; vars: EnvVarItem[] | EnvVarItem }>(script, 30000)
  if (!r.ok) return { ok: false, error: r.error, vars: [] }
  let vars = (r.data && r.data.vars) || []
  if (!Array.isArray(vars)) vars = [vars]
  const error = (r.data && r.data.error) || ''
  return { ok: !error, error, vars: vars.map((v) => ({ name: v.name, kind: v.kind, value: v.value })) }
}

export async function listEnv(scope: string) {
  return readScope(scope)
}

// ==================== 批量操作清单写入与提权中转 ====================

function buildOpsScript(scope: string, opsJsonLiteral: string): string {
  const s = SCOPES[scope]
  return [
    "$ErrorActionPreference = 'Stop'",
    "$result = @{ ok = $false; error = ''; applied = 0; failed = @() }",
    'try {',
    '  $ops = @(ConvertFrom-Json ' + psq(opsJsonLiteral) + ')',
    '  $key = [Microsoft.Win32.Registry]::' + s.hive + '.OpenSubKey(' + psq(s.sub) + ', $true)',
    "  if ($key -eq $null) { throw '无法以写权限打开注册表键（需要管理员权限）' }",
    '  foreach ($o in $ops) {',
    '    $n = [string]$o.name',
    '    try {',
    "      if ($o.op -eq 'delete') {",
    '        $key.DeleteValue($n, $false)',
    '      } else {',
    "        $v = ''",
    '        if ($o.value -ne $null) { $v = [string]$o.value }',
    '        $k = [string]$o.kind',
    '        switch ($k) {',
    "          'ExpandString' { $key.SetValue($n, $v, [Microsoft.Win32.RegistryValueKind]::ExpandString) }",
    "          'DWord'        { $key.SetValue($n, [int]$v, [Microsoft.Win32.RegistryValueKind]::DWord) }",
    "          'QWord'        { $key.SetValue($n, [long]$v, [Microsoft.Win32.RegistryValueKind]::QWord) }",
    "          'MultiString'  { $key.SetValue($n, [string[]]($v -split \"`r?`n\"), [Microsoft.Win32.RegistryValueKind]::MultiString) }",
    '          default        { $key.SetValue($n, $v, [Microsoft.Win32.RegistryValueKind]::String) }',
    '        }',
    '      }',
    '      $result.applied = $result.applied + 1',
    '    } catch { $result.failed += ($n + ": " + $_.Exception.Message) }',
    '  }',
    '  $key.Close()',
    '  if (@($result.failed).Count -eq 0) { $result.ok = $true }',
    '  else { $result.error = (@($result.failed) -join "; ") }',
    '} catch { $result.error = $_.Exception.Message }'
  ].join('\n')
}

// 广播系统级 WM_SETTINGCHANGE
export async function broadcastEnvChange(): Promise<{ ok: boolean; error?: string }> {
  const script = [
    "$src = @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class EnvBroadcast {',
    '  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]',
    '  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);',
    '}',
    "'@",
    'try {',
    '  Add-Type -TypeDefinition $src',
    '  $ptr = [UIntPtr]::Zero',
    '  [EnvBroadcast]::SendMessageTimeout([IntPtr]0xFFFF, 0x001A, [UIntPtr]::Zero, "Environment", 2, 5000, [ref]$ptr) | Out-Null',
    "$result = @{ ok = $true; error = '' }",
    '} catch { $result = @{ ok = $false; error = $_.Exception.Message } }'
  ].join('\n')
  const r = await runPSJson<{ ok: boolean; error: string }>(script, 30000)
  return r.ok && r.data ? r.data : { ok: false, error: r.error }
}

export async function applyOps(
  scope: string,
  ops: any[]
): Promise<{ ok: boolean; error?: string; applied: number }> {
  if (!Array.isArray(ops) || ops.length === 0) return { ok: true, error: '', applied: 0 }

  const elevated = scope === 'machine'
  const admin = await isAdmin()
  const opsJson = JSON.stringify(ops)

  let r: { ok: boolean; data?: { ok: boolean; error: string; applied: number }; error?: string }

  if (!elevated || admin) {
    // 免提权 / 已提权快路径：直接在当前进程执行注册表写入
    const script = buildOpsScript(scope, opsJson)
    r = await runPSJson(script, 120000)
  } else {
    // 普通用户写系统变量慢路径：通过 Start-Process -Verb RunAs 唤起 UAC
    const filePrefix = 'easyenv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    const outFile = `${SHARED_DIR}\\${filePrefix}-result.json`
    const OUT = psq(outFile)

    // 提权子进程执行的脚本（写入 outFile）
    const innerScript =
      buildOpsScript(scope, opsJson) +
      '\n[IO.File]::WriteAllText(' +
      OUT +
      ', ($result | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8)'

    const innerB64 = b64Utf16Le(innerScript)

    // 父进程协调脚本：创建共享目录 -> 唤起提权进程 -> 轮询等待结果 -> 读取结果 -> 清理 outFile -> 返回 Base64
    const outerScript = [
      'try {',
      '  New-Item -ItemType Directory -Force -Path ' + psq(SHARED_DIR) + ' | Out-Null',
      "  $p = Start-Process powershell.exe -Verb RunAs -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','" +
        innerB64 +
        "')",
      '  $sw = [Diagnostics.Stopwatch]::StartNew()',
      '  while (-not (Test-Path ' + OUT + ') -and $sw.Elapsed.TotalSeconds -lt 120) { Start-Sleep -Milliseconds 400 }',
      '  if (-not (Test-Path ' + OUT + ')) {',
      "    $alive = '?'",
      '    try { $alive = (-not $p.HasExited) } catch {}',
      "    $result = @{ ok = $false; error = ('等待提权结果超时：PID=' + $p.Id + ' HasExited=' + $alive + '。若未看到 UAC 弹窗，请检查是否被遮挡'); applied = 0 }",
      '  } else {',
      '    $raw = [IO.File]::ReadAllText(' + OUT + ', [Text.Encoding]::UTF8)',
      '    $result = ConvertFrom-Json $raw',
      '  }',
      '} catch {',
      '  $msg = $_.Exception.Message',
      "  if ($msg -match 'cancel') { $msg = 'UAC 确认被取消' }",
      '  $result = @{ ok = $false; error = $msg; applied = 0 }',
      '} finally {',
      '  Remove-Item -Force -Path ' + OUT + ' -ErrorAction SilentlyContinue',
      '}'
    ].join('\n')

    r = await runPSJson(outerScript, 180000)
  }

  if (!r.ok || !r.data) {
    return { ok: false, error: r.error || '写入失败', applied: 0 }
  }

  const result = r.data
  if (result.ok) {
    await broadcastEnvChange()
  }
  return { ok: !!result.ok, error: result.error || '', applied: result.applied || 0 }
}

// ==================== 快照持久化（localStorage 0ms 同步） ====================

function readSnapshots(): any[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function writeSnapshots(list: any[]): boolean {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    return false
  }
}

function normalizeChange(c: any) {
  return {
    scope: c.scope === 'machine' ? 'machine' : 'user',
    name: String(c.name || ''),
    before: String(c.before == null ? '' : c.before),
    after: String(c.after == null ? '' : c.after),
    existed: !!c.existed,
    kindBefore: String(c.kindBefore || 'String'),
    kindAfter: String(c.kindAfter || 'String')
  }
}

export async function takeSnapshot(reason?: string, changes?: any[]) {
  let snap: any
  if (Array.isArray(changes) && changes.length) {
    snap = {
      id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      reason: reason || '修改前自动快照',
      kind: 'diff',
      changes: changes.map(normalizeChange)
    }
  } else {
    const [u, m] = await Promise.all([readScope('user'), readScope('machine')])
    if (!u.ok && !m.ok) return { ok: false, error: u.error || m.error || '读取失败' }
    snap = {
      id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      reason: reason || '手动快照',
      kind: 'full',
      user: u.vars || [],
      machine: m.vars || []
    }
  }
  const list = readSnapshots()
  list.unshift(snap)
  writeSnapshots(list.slice(0, MAX_SNAPSHOTS))
  return { ok: true, snapshot: snap }
}

export function listSnapshots() {
  return { ok: true, snapshots: readSnapshots() }
}

export function deleteSnapshot(id: string) {
  const list = readSnapshots().filter((s) => s.id !== id)
  writeSnapshots(list)
  return { ok: true }
}

function buildRestoreOps(current: EnvVarItem[], target: EnvVarItem[]) {
  const curMap = new Map<string, EnvVarItem>()
  for (const v of current) curMap.set(v.name.toUpperCase(), v)
  const tgtMap = new Map<string, EnvVarItem>()
  for (const v of target) tgtMap.set(v.name.toUpperCase(), v)
  const ops: any[] = []
  for (const v of target) {
    const cur = curMap.get(v.name.toUpperCase())
    if (!cur || cur.value !== v.value || cur.kind !== v.kind) {
      ops.push({ op: 'set', name: v.name, value: v.value, kind: v.kind })
    }
  }
  for (const v of current) {
    if (!tgtMap.has(v.name.toUpperCase())) ops.push({ op: 'delete', name: v.name })
  }
  return ops
}

export async function restoreSnapshot(id: string) {
  const snap = readSnapshots().find((s) => s.id === id)
  if (!snap) return { ok: false, error: '快照不存在（可能已被删除）' }

  if (Array.isArray(snap.changes)) {
    const [u, m] = await Promise.all([readScope('user'), readScope('machine')])
    if (!u.ok) return { ok: false, error: '读取用户变量失败：' + u.error }
    if (!m.ok) return { ok: false, error: '读取系统变量失败：' + m.error }
    const current: Record<string, EnvVarItem[]> = { user: u.vars, machine: m.vars }
    const findVar = (scope: string, name: string) => {
      const upper = String(name).toUpperCase()
      return (current[scope] || []).find((v) => v.name.toUpperCase() === upper)
    }

    const reverse = snap.changes.map((c: any) => {
      const cur = findVar(c.scope, c.name)
      return {
        scope: c.scope,
        name: c.name,
        before: cur ? cur.value : '',
        after: c.before,
        existed: !!cur,
        kindBefore: cur ? cur.kind : 'String',
        kindAfter: c.kindBefore
      }
    })
    if (reverse.length) await takeSnapshot('回滚前自动快照', reverse)

    const byScope: Record<string, any[]> = { user: [], machine: [] }
    for (const c of snap.changes) {
      if (c.existed) {
        byScope[c.scope].push({ op: 'set', name: c.name, value: c.before, kind: c.kindBefore || 'String' })
      } else {
        byScope[c.scope].push({ op: 'delete', name: c.name })
      }
    }

    let userChanges = 0
    let machineChanges = 0
    if (byScope.user.length) {
      const r = await applyOps('user', byScope.user)
      if (!r.ok) return { ok: false, error: '恢复用户变量失败：' + r.error }
      userChanges = byScope.user.length
    }
    if (byScope.machine.length) {
      const r = await applyOps('machine', byScope.machine)
      if (!r.ok) return { ok: false, error: '恢复系统变量失败：' + r.error }
      machineChanges = byScope.machine.length
    }
    return { ok: true, userChanges, machineChanges }
  }

  // 手动整份快照回滚
  await takeSnapshot('回滚前自动快照')
  const [u, m] = await Promise.all([readScope('user'), readScope('machine')])
  if (!u.ok) return { ok: false, error: '读取用户变量失败：' + u.error }
  if (!m.ok) return { ok: false, error: '读取系统变量失败：' + m.error }

  const userOps = buildRestoreOps(u.vars, snap.user || [])
  const machineOps = buildRestoreOps(m.vars, snap.machine || [])

  if (userOps.length) {
    const r = await applyOps('user', userOps)
    if (!r.ok) return { ok: false, error: '恢复用户变量失败：' + r.error }
  }
  if (machineOps.length) {
    const r = await applyOps('machine', machineOps)
    if (!r.ok) return { ok: false, error: '恢复系统变量失败：' + r.error }
  }
  return { ok: true, userChanges: userOps.length, machineChanges: machineOps.length }
}

// ==================== 快照导入与导出（纯 Web 标准） ====================

export function exportSnapshot(id: string): { ok: boolean; path?: string; error?: string } {
  const snap = readSnapshots().find((s) => s.id === id)
  if (!snap) return { ok: false, error: '快照不存在' }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `easyenv-snapshot-${stamp}.json`
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return { ok: true, path: fileName }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export function importSnapshot(): Promise<{ ok: boolean; snapshot?: any; error?: string }> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.style.display = 'none'

      let hasHandled = false
      const finish = (result: { ok: boolean; snapshot?: any; error?: string }) => {
        if (hasHandled) return
        hasHandled = true
        if (input.parentNode) input.parentNode.removeChild(input)
        resolve(result)
      }

      input.onchange = (e: any) => {
        const file = e.target?.files?.[0]
        if (!file) {
          finish({ ok: false, error: '已取消' })
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string)
            const isDiff = Array.isArray(data && data.changes) && data.changes.length > 0
            const isFull = Array.isArray(data && data.user) && Array.isArray(data && data.machine)
            if (!isDiff && !isFull) {
              finish({ ok: false, error: '不是有效的 easyenv 快照文件' })
              return
            }
            const base = {
              id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              ts: data.ts || Date.now(),
              reason: (data.reason || '导入快照') + '（导入）'
            }
            const snap = isDiff
              ? Object.assign(base, { kind: 'diff', changes: data.changes.map(normalizeChange) })
              : Object.assign(base, { kind: 'full', user: data.user, machine: data.machine })
            const list = readSnapshots()
            list.unshift(snap)
            writeSnapshots(list.slice(0, MAX_SNAPSHOTS))
            finish({ ok: true, snapshot: snap })
          } catch (err: any) {
            finish({ ok: false, error: '解析快照 JSON 失败: ' + (err?.message || err) })
          }
        }
        reader.onerror = () => {
          finish({ ok: false, error: '读取文件失败' })
        }
        reader.readAsText(file, 'utf8')
      }

      document.body.appendChild(input)
      input.click()

      // 30 秒兜底保底取消
      setTimeout(() => {
        if (!hasHandled) finish({ ok: false, error: '已取消' })
      }, 30000)
    } catch (e: any) {
      resolve({ ok: false, error: e?.message || String(e) })
    }
  })
}

// ==================== PATH 展开与存在性检测 ====================

function expandValue(value: string, upperMap: Record<string, string>, depth = 0): string {
  if (depth > 8) return String(value)
  return String(value).replace(/%([^%]+)%/g, (m, name) => {
    const hit = upperMap[String(name).toUpperCase()]
    if (hit == null) return m
    return expandValue(hit, upperMap, depth + 1)
  })
}

function buildUpperEnvMap(envMap?: Record<string, string>): Record<string, string> {
  const upperMap: Record<string, string> = {}
  if (envMap) {
    for (const k of Object.keys(envMap)) {
      upperMap[k.toUpperCase()] = envMap[k]
    }
  }
  return upperMap
}

export function expandEnvValue(value: string, envMap?: Record<string, string>): string {
  return expandValue(String(value == null ? '' : value), buildUpperEnvMap(envMap), 0)
}

// 路径存在性缓存：避免重复异步调用
const pathExistsCache = new Map<string, boolean>()

export function checkPaths(
  entries: string[],
  envMap?: Record<string, string>
): { raw: string; expanded: string; exists: boolean }[] {
  const upperMap = buildUpperEnvMap(envMap)
  const uncached: string[] = []

  const results = (entries || []).map((raw) => {
    const text = String(raw == null ? '' : raw)
    const clean = text.trim().replace(/^"(.*)"$/, '$1')
    const expanded = expandValue(clean, upperMap, 0)
    let exists = true
    if (clean) {
      if (pathExistsCache.has(expanded)) {
        exists = pathExistsCache.get(expanded)!
      } else {
        uncached.push(expanded)
      }
    }
    return { raw: text, expanded, exists }
  })

  // 若存在未缓存的路径，后台静默批量探测并更新缓存
  if (uncached.length > 0) {
    checkPathsBatchAsync(uncached).catch(() => {})
  }

  return results
}

async function checkPathsBatchAsync(paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (!unique.length) return
  const script = [
    '$paths = @(' + unique.map(psq).join(',') + ')',
    '$res = @{}',
    'foreach ($p in $paths) {',
    '  try {',
    '    $res[$p] = [bool](Test-Path -LiteralPath $p)',
    '  } catch {',
    '    $res[$p] = $false',
    '  }',
    '}',
    '$result = $res'
  ].join('\n')

  const r = await runPSJson<Record<string, boolean>>(script, 15000)
  if (r.ok && r.data) {
    for (const [p, exists] of Object.entries(r.data)) {
      pathExistsCache.set(p, Boolean(exists))
    }
  }
}

// ==================== 资源管理器定位 ====================

export async function openPath(
  target: string,
  envMap?: Record<string, string>
): Promise<{ ok: boolean; path?: string; isDir?: boolean; error?: string }> {
  const raw = String(target == null ? '' : target).trim().replace(/^"(.*)"$/, '$1')
  if (!raw) return { ok: false, error: '路径为空' }
  if (raw.includes(';')) return { ok: false, error: '这不是单条路径（含分号），请到 PATH 编辑器里逐条打开' }
  const resolved = expandEnvValue(raw, envMap)

  try {
    // 探测路径类型与存在性
    const checkScript =
      `$p = ${psq(resolved)}\n` +
      'if (Test-Path -LiteralPath $p) {\n' +
      '  $isDir = [bool](Test-Path -LiteralPath $p -PathType Container)\n' +
      '  $result = @{ ok = $true; isDir = $isDir }\n' +
      '} else {\n' +
      "  $result = @{ ok = $false; error = ('路径不存在：' + $p) }\n" +
      '}'
    const probe = await runPSJson<{ ok: boolean; isDir?: boolean; error?: string }>(checkScript, 10000)
    if (!probe.ok || !probe.data?.ok) {
      return { ok: false, error: probe.data?.error || probe.error || '路径不存在' }
    }

    const isDir = Boolean(probe.data.isDir)
    const args = isDir ? [resolved] : ['/select,' + resolved]
    await executeCommand('explorer.exe', args)
    return { ok: true, path: resolved, isDir }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

// ==================== 备选值（localStorage 同步存储） ====================

export function listPresets(): { ok: boolean; presets: Record<string, string[]> } {
  try {
    const raw = window.localStorage.getItem(PRESET_KEY)
    if (!raw) return { ok: true, presets: {} }
    const obj = JSON.parse(raw)
    return { ok: true, presets: obj && typeof obj === 'object' ? obj : {} }
  } catch (e) {
    return { ok: true, presets: {} }
  }
}

export function savePresets(presets: Record<string, string[]>): {
  ok: boolean
  presets: Record<string, string[]>
  error?: string
} {
  try {
    const clean: Record<string, string[]> = {}
    const src = presets && typeof presets === 'object' ? presets : {}
    for (const k of Object.keys(src)) {
      const arr = Array.isArray(src[k]) ? src[k] : []
      const values: string[] = []
      for (const v of arr) {
        const s = String(v == null ? '' : v).trim()
        if (s && !values.some((x) => x.toUpperCase() === s.toUpperCase())) values.push(s)
      }
      if (values.length) clean[k] = values
    }
    window.localStorage.setItem(PRESET_KEY, JSON.stringify(clean))
    return { ok: true, presets: clean }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), presets: {} }
  }
}

export const services = {
  isAdmin,
  listEnv,
  applyOps,
  takeSnapshot,
  listSnapshots,
  deleteSnapshot,
  restoreSnapshot,
  exportSnapshot,
  importSnapshot,
  checkPaths,
  expandEnvValue,
  openPath,
  listPresets,
  savePresets
}
