/**
 * 跨平台 / 跨运行时命令执行器抽象
 * 优先调用 Ruck 宿主 shell.execute 安全沙箱 IPC 接口，兼顾 Node.js child_process 兜底
 * 支持内存级 Base64 UTF-8 数据流，彻底摆脱本地磁盘临时文件读写与控制台编码乱码
 */

export interface ShellResult {
  stdout: string
  stderr?: string
  exitCode: number
  error?: string
  timedOut?: boolean
}

function getRuck() {
  return typeof window !== 'undefined' && (window as any).ruck ? (window as any).ruck : null
}

export function isRuckAvailable(): boolean {
  const ruck = getRuck()
  return Boolean(ruck?.shell?.execute && typeof ruck.shell.execute === 'function')
}

/**
 * 将字符串编码为 UTF-16LE 的 Base64（供 powershell -EncodedCommand 使用，纯 Web 标准无 Buffer 依赖）
 */
export function b64Utf16Le(str: string): string {
  const codeUnits = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    codeUnits[i] = str.charCodeAt(i)
  }
  const bytes = new Uint8Array(codeUnits.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 将 UTF-8 的 Base64 字符串解码为文本（纯 Web TextDecoder 标准）
 */
export function decodeBase64Utf8(b64Str: string): string {
  const cleanB64 = b64Str.trim().replace(/\s+/g, '')
  const binary = atob(cleanB64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * PowerShell 单引号字符串安全转义
 */
export function psq(s: any): string {
  return "'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
}

/**
 * 基础命令执行抽象
 */
export async function executeCommand(
  program: string,
  args: string[] = [],
  options: Record<string, any> = {}
): Promise<ShellResult> {
  const ruck = getRuck()

  // 1. 优先使用 Ruck 宿主沙箱 IPC
  if (ruck?.shell?.execute && typeof ruck.shell.execute === 'function') {
    try {
      const result = await ruck.shell.execute(program, args, options)
      if (result && typeof result === 'object') {
        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? 0
        }
      }
      return { stdout: String(result || ''), exitCode: 0 }
    } catch (err: any) {
      console.warn(`[Ruck Shell] execute "${program}" error:`, err)
      return { stdout: '', stderr: '', error: err?.message || String(err), exitCode: -1 }
    }
  }

  // 2. 回退到 Node.js / Electron 环境
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const childProcess = await import('node:child_process')
      return await new Promise<ShellResult>((resolve) => {
        childProcess.execFile(
          program,
          args,
          {
            timeout: options.timeout,
            windowsHide: true,
            encoding: 'utf8',
            maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
            ...options
          },
          (err: any, stdout: any, stderr: any) => {
            const exitCode = typeof err?.code === 'number' ? err.code : (err ? -1 : 0)
            const timedOut = Boolean(err?.killed)
            resolve({
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode,
              error: typeof err?.code !== 'number' && err ? err.message : undefined,
              timedOut
            })
          }
        )
      })
    } catch (nodeErr: any) {
      console.warn(`[Node Shell Fallback] execute "${program}" error:`, nodeErr)
      return { stdout: '', stderr: '', error: nodeErr?.message || String(nodeErr), exitCode: -1 }
    }
  }

  return { stdout: '', stderr: '', error: '当前环境不支持调用系统外部命令', exitCode: -1 }
}

/**
 * 异步执行 PowerShell 脚本（封装为 -EncodedCommand 规避转义问题）
 */
export async function executePowerShell(script: string, timeout = 60000): Promise<ShellResult> {
  return executeCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64Utf16Le(script)],
    { timeout }
  )
}

/**
 * 封装 PowerShell JSON 结果查询：在脚本内部直接将 $result 转为 UTF-8 Base64 输出，避免写磁盘文件
 */
export async function runPSJson<T = any>(script: string, timeout = 60000): Promise<{ ok: boolean; data?: T; error?: string }> {
  const full =
    script +
    '\n$__j = ($result | ConvertTo-Json -Depth 6 -Compress)' +
    '\n$__b = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($__j))' +
    '\nWrite-Output ("B64_RESULT::" + $__b + "::B64_END")'

  const r = await executePowerShell(full, timeout)
  if (!r.stdout) {
    return { ok: false, error: (r.error || r.stderr || 'PowerShell 执行未返回输出').slice(0, 300) }
  }

  const match = /B64_RESULT::([A-Za-z0-9+/=]+)::B64_END/.exec(r.stdout)
  if (!match) {
    return { ok: false, error: (r.error || r.stderr || r.stdout || 'PowerShell 结果解析失败').slice(0, 300) }
  }

  try {
    const jsonStr = decodeBase64Utf8(match[1])
    const data = JSON.parse(jsonStr) as T
    return { ok: true, data }
  } catch (e: any) {
    return { ok: false, error: 'JSON 解码解析失败: ' + (e?.message || e) }
  }
}
