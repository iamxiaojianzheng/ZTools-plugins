/**
 * 适配 Ruck 运行时的 window.services 门面实现
 * 彻底替换 Node.js 原生依赖，基于 Ruck Shell 安全沙箱与 Native Helper 调度
 */

import { executeCommand, executePowerShell, executeTaskkill, executeDetector } from './executor'

export interface ProcessRaw {
  name: string
  pid: number
  path: string
}

export interface PortEntry {
  port: number
  pid: number
  protocol: string
}

export interface KillResult {
  success: boolean
  error?: string
}

export interface FileHolder {
  pid: number
  name: string
  service?: string
  type?: string
  handleCount?: number
  handlePath?: string
  handlePaths?: string[]
}

export interface WhoLocksOptions {
  mode?: 'files' | 'handles'
}

export interface WhoLocksResult {
  success: boolean
  holders?: FileHolder[]
  error?: string
  mode?: 'files' | 'handles'
  kind?: 'file' | 'directory'
  method?: 'restart-manager' | 'handle-scan'
  partial?: boolean
  skipped?: number
  timedOut?: number
  examined?: number
}

export interface PathInfoResult {
  success: boolean
  exists: boolean
  isFile: boolean
  isDirectory: boolean
  path: string
}

// 按标准 CSV 规范拆分字段，支持字段内引号与逗号
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch !== '"') {
        field += ch
      } else if (line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = false
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

// 解析 PowerShell CIM 与 wmic 的 CSV 进程数据
function parseProcessCsv(output: string): ProcessRaw[] {
  const lines = output.replace(/^\uFEFF/, '').trim().replace(/\r/g, '').split('\n').filter(Boolean)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const nameIdx = header.indexOf('name')
  const pidIdx = header.indexOf('processid')
  const pathIdx = header.indexOf('executablepath')
  if (nameIdx === -1 || pidIdx === -1) return []

  return lines
    .slice(1)
    .map((line) => {
      const parts = parseCsvLine(line)
      return {
        name: (parts[nameIdx] || '').trim(),
        pid: parseInt(parts[pidIdx], 10) || 0,
        path: (parts[pathIdx] || '').trim()
      }
    })
    .filter((p) => p.pid > 0)
}

// 解析 netstat -ano 输出
function parseNetstat(output: string): PortEntry[] {
  const lines = output.trim().replace(/\r/g, '').split('\n').filter(Boolean)
  const ports: PortEntry[] = []

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const addr = parts[1]
    const pid = parseInt(parts[4], 10)
    if (!addr || isNaN(pid)) continue
    const portMatch = addr.match(/:(\d+)$/)
    if (portMatch) {
      ports.push({ port: parseInt(portMatch[1], 10), pid, protocol: parts[0] })
    }
  }
  return ports
}

function groupHandles(handles: any[]): FileHolder[] {
  const byPid = new Map<number, FileHolder>()
  for (const handle of handles) {
    if (!Number.isInteger(handle.pid) || handle.pid <= 0) continue

    let entry = byPid.get(handle.pid)
    if (!entry) {
      entry = {
        pid: handle.pid,
        name: handle.name || '',
        handleCount: 0,
        handlePath: '',
        handlePaths: []
      }
      byPid.set(handle.pid, entry)
    }

    entry.handleCount = (entry.handleCount || 0) + 1
    const handlePath = handle.path || ''
    if (handlePath && entry.handlePaths && !entry.handlePaths.includes(handlePath)) {
      entry.handlePaths.push(handlePath)
      if (!entry.handlePath) entry.handlePath = handlePath
    }
  }

  return Array.from(byPid.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.pid - b.pid
  )
}

function firstLine(text: string): string {
  return (text || '').trim().split(/\r?\n/)[0] || ''
}

const PS_LIST_PROCESSES_ARGS = [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
    'Get-CimInstance Win32_Process | ' +
    'Select-Object ProcessId,Name,ExecutablePath | ' +
    'ConvertTo-Csv -NoTypeInformation'
]

export const services = {
  /**
   * 枚举系统进程列表
   */
  async listProcesses(): Promise<ProcessRaw[]> {
    // 1. 优先使用 PowerShell CIM 获取进程及 ExecutablePath
    const ps = await executePowerShell(PS_LIST_PROCESSES_ARGS, 8000)
    if (ps.stdout) {
      const psList = parseProcessCsv(ps.stdout)
      if (psList.length) return psList
    }

    // 2. 旧系统 wmic 兜底
    const wmic = await executeCommand('wmic.exe', ['process', 'get', 'ProcessId,Name,ExecutablePath', '/FORMAT:CSV'], { timeout: 8000 })
    if (wmic.stdout) {
      const wmicList = parseProcessCsv(wmic.stdout)
      if (wmicList.length) return wmicList
    }

    // 3. tasklist 兜底（无路径，保障基础可用性）
    const tasklist = await executeCommand('tasklist.exe', ['/FO', 'CSV', '/NH'], { timeout: 5000 })
    if (tasklist.stdout) {
      return tasklist.stdout
        .trim()
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parts = parseCsvLine(line)
          return { name: parts[0] || '', pid: parseInt(parts[1], 10) || 0, path: '' }
        })
        .filter((p) => p.pid > 0)
    }

    return []
  },

  /**
   * 扫描系统端口与 PID 绑定
   */
  async scanPorts(): Promise<PortEntry[]> {
    const res = await executeCommand('netstat.exe', ['-ano'], { timeout: 5000 })
    return res.stdout ? parseNetstat(res.stdout) : []
  },

  /**
   * 获取文件/文件夹属性与存在性
   */
  async pathInfo(filePath: string): Promise<PathInfoResult> {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { success: false, exists: false, isFile: false, isDirectory: false, path: '' }
    }

    const target = filePath.trim()

    // 1. 优先调用 win-file-lock-detector.exe 做探测
    try {
      const res = await executeDetector([target, '--json'], 6000)
      if (res.stdout) {
        try {
          const data = JSON.parse(res.stdout)
          if (data && typeof data.type === 'string') {
            const isDir = data.type === 'directory'
            return {
              success: true,
              exists: true,
              isFile: !isDir,
              isDirectory: isDir,
              path: data.path || target
            }
          }
        } catch (e) {}
      }

      // 如果 stderr 明确报错 path does not exist
      if (res.stderr && /does not exist/i.test(res.stderr)) {
        return { success: true, exists: false, isFile: false, isDirectory: false, path: target }
      }
    } catch (e) {}

    // 2. 兜底使用 PowerShell 检测文件/目录状态
    try {
      const psCmd = `if (Test-Path -LiteralPath '${target.replace(/'/g, "''")}') { $item = Get-Item -LiteralPath '${target.replace(/'/g, "''")}'; if ($item.PSIsContainer) { 'DIR' } else { 'FILE' } } else { 'NONE' }`
      const psRes = await executePowerShell(['-NoProfile', '-Command', psCmd], 4000)
      const out = (psRes.stdout || '').trim()
      if (out === 'DIR') {
        return { success: true, exists: true, isFile: false, isDirectory: true, path: target }
      } else if (out === 'FILE') {
        return { success: true, exists: true, isFile: true, isDirectory: false, path: target }
      } else if (out === 'NONE') {
        return { success: true, exists: false, isFile: false, isDirectory: false, path: target }
      }
    } catch (e) {}

    return { success: false, exists: false, isFile: false, isDirectory: false, path: target }
  },

  /**
   * 查询指定文件或目录的占用进程
   */
  async whoLocks(filePath: string, options: WhoLocksOptions = {}): Promise<WhoLocksResult> {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { success: false, error: '无效的文件路径' }
    }

    const target = filePath.trim()
    const info = await services.pathInfo(target)
    if (!info.exists) {
      return { success: false, error: `文件或目录不存在: ${target}` }
    }

    const isDirectory = info.isDirectory
    const mode =
      options.mode === 'handles' || options.mode === 'files'
        ? options.mode
        : isDirectory
        ? 'handles'
        : 'files'

    const useRestartManager = !isDirectory && mode === 'files'
    const args = [target, '--json']
    if (!useRestartManager) {
      args.push('--handles')
    }

    const timeout = useRestartManager ? 20000 : 120000
    const scan = await executeDetector(args, timeout)

    if (scan.timedOut) {
      return { success: false, error: '检测超时，进程句柄较多时请稍后重试' }
    }
    if (scan.exitCode !== 0 && scan.exitCode !== 1) {
      return {
        success: false,
        error: firstLine(scan.stderr || '') || firstLine(scan.error || '') || '检测失败'
      }
    }

    let data: any
    try {
      data = JSON.parse(scan.stdout)
    } catch {
      return { success: false, error: firstLine(scan.stderr || '') || '无法解析检测结果' }
    }

    // 1. Restart Manager 模式
    if (data.method === 'restart-manager') {
      const holders: FileHolder[] = (Array.isArray(data.processes) ? data.processes : [])
        .filter((proc: any) => Number.isInteger(proc.pid) && proc.pid > 0)
        .map((proc: any) => ({
          pid: proc.pid,
          name: proc.app_name || proc.name || '',
          service: proc.service || undefined,
          type: proc.type || undefined
        }))

      return {
        success: true,
        mode: 'files',
        kind: 'file',
        method: 'restart-manager',
        holders
      }
    }

    // 2. 句柄扫描模式
    const skipped = Array.isArray(data.skipped_processes) ? data.skipped_processes : []
    const timedOut = Array.isArray(data.timed_out_processes) ? data.timed_out_processes : []
    let handles: any[] = Array.isArray(data.handles) ? data.handles : []

    // 目录句柄模式只看文件夹句柄，目录内文件模式只看文件句柄
    if (isDirectory) {
      const objectKind = mode === 'handles' ? 'directory' : 'file'
      handles = handles.filter((h) => h.object === objectKind)
    }

    return {
      success: true,
      mode,
      kind: isDirectory ? 'directory' : 'file',
      method: 'handle-scan',
      holders: groupHandles(handles),
      partial: skipped.length > 0 || timedOut.length > 0,
      skipped: skipped.length,
      timedOut: timedOut.length,
      examined: data.examined_handles || 0
    }
  },

  /**
   * 终止指定 PID 进程
   */
  async killProcess(pid: number): Promise<KillResult> {
    if (!Number.isInteger(pid) || pid <= 0) {
      return { success: false, error: '无效的 PID' }
    }

    const res = await executeTaskkill(pid, true)
    if (res.exitCode === 0) {
      return { success: true }
    }
    return { success: false, error: res.stderr || res.error || 'Kill 失败' }
  }
}
