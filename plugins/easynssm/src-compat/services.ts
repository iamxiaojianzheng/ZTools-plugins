/**
 * 适配 Ruck 运行时的 window.services 门面实现
 * 彻底替换 Node.js 原生依赖，基于跨环境执行器与 PowerShell 内存 Base64 管道
 */

import { executeCommand, executePowerShell, runPSJson, psq } from './executor'

const NSSM_PATH_KEY = 'easynssm_nssm_path'

const NSSM_PARAM_KEYS = [
  'AppDirectory', 'AppApplication', 'AppParameters', 'AppStdout', 'AppStderr',
  'AppRotateFiles', 'AppRotateOnline', 'AppRotateBytes', 'AppRotateSeconds',
  'AppExit', 'AppRestartDelay', 'AppThrottle', 'AppPriority',
  'AppStopMethodSkip', 'AppStopMethodConsole', 'AppEnvironment'
]

const START_TYPE_SC: Record<string, string> = {
  auto: 'auto',
  delayed: 'delayed-auto',
  manual: 'demand',
  disabled: 'disabled'
}

export interface ServiceInfo {
  Name: string
  DisplayName: string
  State: string
  StartMode: string
  PathName: string
  StartName: string
  Description: string
  ProcessId: number
  ExitCode: number
}

export interface CmdResult {
  exitCode: number
  message: string
  output: { op: string; code: number; output: string }[]
}

export interface NssmDetect {
  found: boolean
  path: string
  version: string
}

// ==================== 权限 ====================

export async function isAdmin(): Promise<boolean> {
  const script =
    '$r = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)\n' +
    '$result = @{ isAdmin = $r }'
  const r = await runPSJson<{ isAdmin: boolean }>(script, 20000)
  return !!(r.ok && r.data && r.data.isAdmin)
}

// ==================== 系统服务查询 ====================

export async function listServices(): Promise<{ ok: boolean; services: ServiceInfo[]; error?: string }> {
  const script =
    "$ErrorActionPreference = 'Stop'\n" +
    'try {\n' +
    '  $list = Get-CimInstance Win32_Service | Select-Object Name,DisplayName,State,StartMode,PathName,StartName,Description,ProcessId,ExitCode\n' +
    '  $result = @{ error = \'\'; services = @($list) }\n' +
    "} catch { $result = @{ error = $_.Exception.Message; services = @() } }"

  const r = await runPSJson<{ error: string; services: ServiceInfo[] | ServiceInfo }>(script, 90000)
  if (!r.ok) {
    return { ok: false, services: [], error: r.error || '获取服务列表失败' }
  }
  let svcs = (r.data && r.data.services) || []
  if (!Array.isArray(svcs)) svcs = [svcs]
  return { ok: true, services: svcs, error: (r.data && r.data.error) || '' }
}

// ==================== nssm 路径管理与探测 ====================

export function getNssmPath(): string {
  try {
    const bridge = (window as any).ztools
    const v = bridge?.dbStorage?.getItem(NSSM_PATH_KEY)
    return (v && String(v)) || ''
  } catch (e) {
    return ''
  }
}

export async function probeNssm(p: string): Promise<string> {
  if (!p) return ''
  // 1. 优先直接运行
  try {
    const res = await executeCommand(p, ['version'], { timeout: 8000 })
    const text = (res.stdout || '') + (res.stderr || '')
    if (/nssm\s+\d/i.test(text)) {
      return text.trim().split(/\r?\n/)[0]
    }
  } catch (e) {}

  // 2. 兜底通过 PowerShell 运行（规避直接调用非白名单路径可能被沙箱拦截的问题）
  try {
    const script =
      `$p = ${psq(p)}\n` +
      'if (Test-Path -LiteralPath $p) {\n' +
      '  $out = (& $p version) 2>&1 | Out-String\n' +
      '  $result = @{ text = ("" + $out).Trim() }\n' +
      '} else {\n' +
      "  $result = @{ text = '' }\n" +
      '}'
    const r = await runPSJson<{ text: string }>(script, 10000)
    const text = (r.ok && r.data && r.data.text) || ''
    if (/nssm\s+\d/i.test(text)) {
      return text.split(/\r?\n/)[0]
    }
  } catch (e) {}

  return ''
}

export async function detectNssm(): Promise<NssmDetect> {
  const candidates: string[] = []
  const saved = getNssmPath()
  if (saved) candidates.push(saved)

  // 1. where.exe 查找
  try {
    const whereRes = await executeCommand('where.exe', ['nssm.exe'], { timeout: 8000 })
    if (whereRes.stdout) {
      const line = whereRes.stdout.split(/\r?\n/)[0].trim()
      if (line) candidates.push(line)
    }
  } catch (e) {}

  // 2. 从当前服务的 binPath 反查
  try {
    const svcList = await listServices()
    if (svcList.ok) {
      for (const s of svcList.services) {
        const pn = String((s && s.PathName) || '')
        if (!/nssm\.exe/i.test(pn)) continue
        const m = /^"([^"]+nssm\.exe)"/i.exec(pn) || /^([^\s"]+nssm\.exe)/i.exec(pn)
        if (m) candidates.push(m[1])
      }
    }
  } catch (e) {}

  // 3. 常见候选路径
  candidates.push(
    'C:\\nssm\\nssm.exe',
    'C:\\nssm.exe',
    'C:\\Program Files\\nssm\\win64\\nssm.exe',
    'C:\\Program Files (x86)\\nssm\\win32\\nssm.exe',
    'C:\\ProgramData\\chocolatey\\bin\\nssm.exe'
  )

  const unique = Array.from(new Set(candidates))
  for (const c of unique) {
    const version = await probeNssm(c)
    if (version) {
      return { found: true, path: c, version }
    }
  }

  return { found: false, path: '', version: '' }
}

export async function saveNssmPath(p: string): Promise<{ ok: boolean; message: string }> {
  const version = await probeNssm(p)
  if (!version) {
    return { ok: false, message: '该路径不是可用的 nssm.exe（version 命令无响应）' }
  }
  try {
    const bridge = (window as any).ztools
    bridge?.dbStorage?.setItem(NSSM_PATH_KEY, String(p))
  } catch (e: any) {
    return { ok: false, message: '保存失败：' + (e?.message || e) }
  }
  return { ok: true, message: '已保存：' + version }
}

// ==================== nssm 配置读取（注册表） ====================

export async function getNssmConfig(name: string): Promise<{ ok: boolean; config: Record<string, any>; error?: string }> {
  const keys = NSSM_PARAM_KEYS.map(psq).join(',')
  const script =
    `$svc = ${psq(name)}\n` +
    'try {\n' +
    '  $p = Get-ItemProperty -Path ("HKLM:\\SYSTEM\\CurrentControlSet\\Services\\" + $svc + "\\Parameters") -ErrorAction Stop\n' +
    '  $c = @{}\n' +
    '  foreach ($k in @(' + keys + ')) {\n' +
    '    if ($p.PSObject.Properties.Name -contains $k) { $c[$k] = $p.$k }\n' +
    '  }\n' +
    '  $result = @{ error = \'\'; config = $c }\n' +
    "} catch { $result = @{ error = $_.Exception.Message; config = @{} } }"

  const r = await runPSJson<{ error: string; config: Record<string, any> }>(script, 30000)
  if (!r.ok) return { ok: false, config: {}, error: r.error }
  const cfg = (r.data && r.data.config) || {}
  if (cfg.AppEnvironment != null && !Array.isArray(cfg.AppEnvironment)) {
    cfg.AppEnvironment = [cfg.AppEnvironment]
  }
  return { ok: true, config: cfg, error: (r.data && r.data.error) || '' }
}

// ==================== 提权命令执行 ====================

export async function runCommands(ops: string[], timeout = 300000): Promise<CmdResult> {
  const admin = await isAdmin()
  const SHARED_DIR = 'C:\\ProgramData\\easynssm'
  const filePrefix = 'easynssm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const opsFile = `${SHARED_DIR}\\${filePrefix}-ops.json`
  const outFile = `${SHARED_DIR}\\${filePrefix}-result.json`

  // 内部执行脚本主体
  const innerScript =
    "$ErrorActionPreference = 'Continue'\n" +
    'try {\n' +
    '  New-Item -ItemType Directory -Force -Path ' + psq(SHARED_DIR) + ' | Out-Null\n' +
    '  $ops = ConvertFrom-Json ([IO.File]::ReadAllText(' + psq(opsFile) + '))\n' +
    '  $results = New-Object System.Collections.ArrayList\n' +
    '  $fail = 0\n' +
    "  $lastErr = ''\n" +
    '  foreach ($op in $ops) {\n' +
    "    $o = ''\n" +
    '    $c = 0\n' +
    '    try {\n' +
    '      $o = (Invoke-Expression $op) 2>&1 | Out-String\n' +
    '      if ($LASTEXITCODE -ne $null) { $c = $LASTEXITCODE }\n' +
    '    } catch {\n' +
    '      $o = $_.Exception.Message\n' +
    '      $c = -1\n' +
    '    }\n' +
    '    if ($c -ne 0) { $fail = 1; $lastErr = $o }\n' +
    '    [void]$results.Add(@{ op = $op; code = $c; output = ("" + $o).Trim() })\n' +
    '  }\n' +
    '  $result = @{ exitCode = $fail; message = $lastErr; output = $results }\n' +
    '} catch {\n' +
    '  $result = @{ exitCode = -5; message = ("提权脚本异常: " + $_.Exception.Message); output = @() }\n' +
    '}\n' +
    '[IO.File]::WriteAllText(' + psq(outFile) + ', ($result | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8)'

  let executionScript = ''

  if (admin) {
    // 管理员快路径：直接写入 opsFile 并执行 innerScript
    const opsJson = JSON.stringify(ops)
    executionScript =
      'New-Item -ItemType Directory -Force -Path ' + psq(SHARED_DIR) + ' | Out-Null\n' +
      '[IO.File]::WriteAllText(' + psq(opsFile) + ', ' + psq(opsJson) + ', [Text.Encoding]::UTF8)\n' +
      innerScript + '\n' +
      'if (Test-Path ' + psq(outFile) + ') {\n' +
      '  $data = [IO.File]::ReadAllText(' + psq(outFile) + ', [Text.Encoding]::UTF8)\n' +
      '  $result = ConvertFrom-Json $data\n' +
      '} else {\n' +
      "  $result = @{ exitCode = -99; message = '未生成执行结果文件'; output = @() }\n" +
      '}\n' +
      'Remove-Item -Force -Path ' + psq(opsFile) + ' -ErrorAction SilentlyContinue\n' +
      'Remove-Item -Force -Path ' + psq(outFile) + ' -ErrorAction SilentlyContinue'
  } else {
    // 普通用户慢路径：Start-Process powershell.exe -Verb RunAs 唤起 UAC
    const opsJson = JSON.stringify(ops)
    const { b64Utf16Le } = await import('./executor')
    const innerB64 = b64Utf16Le(innerScript)

    executionScript =
      'New-Item -ItemType Directory -Force -Path ' + psq(SHARED_DIR) + ' | Out-Null\n' +
      '[IO.File]::WriteAllText(' + psq(opsFile) + ', ' + psq(opsJson) + ', [Text.Encoding]::UTF8)\n' +
      'try {\n' +
      "  $p = Start-Process powershell.exe -Verb RunAs -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','" + innerB64 + "')\n" +
      '  $sw = [Diagnostics.Stopwatch]::StartNew()\n' +
      '  while (-not (Test-Path ' + psq(outFile) + ') -and $sw.Elapsed.TotalSeconds -lt 120) { Start-Sleep -Milliseconds 500 }\n' +
      '  if (-not (Test-Path ' + psq(outFile) + ')) {\n' +
      "    $alive = '?'\n" +
      '    try { $alive = (-not $p.HasExited) } catch {}\n' +
      "    $result = @{ exitCode = 2; message = ('等待提权结果超时：PID=' + $p.Id + ' HasExited=' + $alive + '。若无 UAC 弹窗，请检查是否被遮挡'); output = @() }\n" +
      '  } else {\n' +
      '    $data = [IO.File]::ReadAllText(' + psq(outFile) + ', [Text.Encoding]::UTF8)\n' +
      '    $result = ConvertFrom-Json $data\n' +
      '  }\n' +
      '} catch {\n' +
      '  $msg = $_.Exception.Message\n' +
      "  if ($msg -match 'cancel') { $msg = 'UAC 确认被取消' }\n" +
      '  $result = @{ exitCode = 3; message = $msg; output = @() }\n' +
      '}\n' +
      'Remove-Item -Force -Path ' + psq(opsFile) + ' -ErrorAction SilentlyContinue\n' +
      'Remove-Item -Force -Path ' + psq(outFile) + ' -ErrorAction SilentlyContinue'
  }

  const r = await runPSJson<CmdResult>(executionScript, timeout)
  if (!r.ok || !r.data) {
    return { exitCode: -99, message: r.error || '执行提权命令未返回有效结果', output: [] }
  }
  return r.data
}

// ==================== 命令构造纯函数 ====================

export function buildNssmOps(payload: any): string[] {
  const nssm = psq(payload.nssmPath)
  const name = payload.name
  const ops: string[] = []
  const set = function (...args: any[]) {
    const quoted = args.map(psq)
    ops.push('& ' + nssm + ' set ' + psq(name) + ' ' + quoted.join(' '))
  }

  if (payload.mode === 'install') {
    const installArgs = ['install', name, payload.application]
    if (payload.parameters) installArgs.push(payload.parameters)
    ops.push('& ' + nssm + ' ' + installArgs.map(psq).join(' '))
  } else {
    if (payload.application) set('AppApplication', payload.application)
    if (payload.parameters) set('AppParameters', payload.parameters)
  }

  if (payload.appDirectory) set('AppDirectory', payload.appDirectory)
  if (payload.stdout) set('AppStdout', payload.stdout)
  if (payload.stderr) set('AppStderr', payload.stderr)
  if (payload.rotate) {
    set('AppRotateFiles', '1')
    if (payload.rotateOnline) set('AppRotateOnline', '1')
    if (payload.rotateBytes) set('AppRotateBytes', String(payload.rotateBytes))
  }
  if (payload.exitCode !== '' && payload.exitCode != null && payload.exitAction) {
    set('AppExit', String(payload.exitCode), payload.exitAction)
  }
  if (payload.restartDelay !== '' && payload.restartDelay != null) {
    set('AppRestartDelay', String(payload.restartDelay))
  }
  if (payload.throttle) set('AppThrottle', String(payload.throttle))
  if (payload.priority) set('AppPriority', payload.priority)
  if (payload.stopSkip) set('AppStopMethodSkip', String(payload.stopSkip))
  if (payload.environment && payload.environment.length) {
    ops.push('& ' + nssm + ' set ' + psq(name) + ' AppEnvironment ' + payload.environment.map(psq).join(' '))
  }
  if (payload.startType && START_TYPE_SC[payload.startType]) {
    ops.push('& sc.exe config ' + psq(name) + ' start= ' + START_TYPE_SC[payload.startType])
  }
  return ops
}

export function buildRemoveOp(nssmPath: string, name: string): string {
  return '& ' + psq(nssmPath) + ' remove ' + psq(name) + ' confirm'
}

export function buildServiceActionOps(name: string, action: string): string[] {
  const n = psq(name)
  if (action === 'start') return ['& sc.exe start ' + n]
  if (action === 'stop') return ['& sc.exe stop ' + n]
  if (action === 'restart') {
    return [
      '& sc.exe stop ' + n + ' | Out-Null\n' +
      '$d = (Get-Date).AddSeconds(20)\n' +
      "while ((Get-Date) -lt $d) { $sv = Get-Service -Name " + n + " -ErrorAction SilentlyContinue; if ($sv -and $sv.Status -eq 'Stopped') { break }; Start-Sleep -Milliseconds 400 }\n" +
      '& sc.exe start ' + n
    ]
  }
  return []
}

export function buildStartTypeOp(name: string, startType: string): string[] {
  const v = START_TYPE_SC[startType]
  if (!v) return []
  return ['& sc.exe config ' + psq(name) + ' start= ' + v]
}

// ==================== 日志查看 ====================

export async function readLogTail(
  p: string,
  maxLines = 200
): Promise<{ ok: boolean; content?: string; truncated?: boolean; error?: string }> {
  if (!p) {
    return { ok: false, error: '日志文件未配置' }
  }

  const script =
    `$p = ${psq(p)}\n` +
    'if (-not (Test-Path -LiteralPath $p)) {\n' +
    "  $result = @{ ok = $false; error = ('日志文件不存在（可能尚未产生输出）：' + $p); content = ''; truncated = $false }\n" +
    '} else {\n' +
    '  try {\n' +
    `    $lines = Get-Content -LiteralPath $p -Tail ${maxLines} -ErrorAction Stop\n` +
    "    $text = ($lines -join \"`r`n\")\n" +
    '    $result = @{ ok = $true; content = $text; truncated = $true; error = \'\' }\n' +
    '  } catch {\n' +
    "    $result = @{ ok = $false; error = ('读取日志失败：' + $_.Exception.Message); content = ''; truncated = $false }\n" +
    '  }\n' +
    '}'

  const r = await runPSJson<{ ok: boolean; content: string; truncated: boolean; error: string }>(script, 30000)
  if (!r.ok || !r.data) {
    return { ok: false, error: r.error || '执行读取日志脚本失败' }
  }
  return r.data
}

export const services = {
  isAdmin,
  listServices,
  getNssmConfig,
  detectNssm,
  getNssmPath,
  saveNssmPath,
  runCommands,
  buildNssmOps,
  buildRemoveOp,
  buildServiceActionOps,
  buildStartTypeOp,
  readLogTail
}
