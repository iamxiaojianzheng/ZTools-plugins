/**
 * 跨平台 / 跨运行时命令执行器抽象
 * 优先调用 Ruck 宿主 shell.execute 安全沙箱 IPC 接口，兼顾 Node.js child_process 兜底
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
            maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
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
 * 执行 PowerShell 命令
 */
export async function executePowerShell(args: string[], timeout = 10000): Promise<ShellResult> {
  return executeCommand('powershell.exe', args, { timeout })
}

/**
 * 执行 taskkill 强杀指定进程
 */
export async function executeTaskkill(pid: number, force = true): Promise<ShellResult> {
  const args = force ? ['/F', '/T', '/PID', String(pid)] : ['/PID', String(pid)]
  return executeCommand('taskkill.exe', args, { timeout: 4000 })
}

/**
 * 执行内置 win-file-lock-detector.exe
 */
export async function executeDetector(args: string[], timeout = 30000): Promise<ShellResult> {
  const ruck = getRuck()

  // Ruck 沙箱调用私有相对路径
  if (ruck?.shell?.execute && typeof ruck.shell.execute === 'function') {
    // 依次尝试相对路径与文件名
    const candidates = [
      'win-file-lock-detector.exe',
      'bin/win-file-lock-detector.exe',
      'bin\\win-file-lock-detector.exe'
    ]
    for (const exe of candidates) {
      try {
        const result = await ruck.shell.execute(exe, args, { timeout })
        if (result && typeof result === 'object') {
          return {
            stdout: (result.stdout || '').replace(/^\uFEFF/, ''),
            stderr: result.stderr || '',
            exitCode: result.exitCode ?? 0
          }
        }
      } catch (e: any) {
        // 如果是文件找不到继续尝试下一个 candidate
        continue
      }
    }
    // 兜底直接使用首选
    return executeCommand('win-file-lock-detector.exe', args, { timeout })
  }

  // Node.js 回退定位文件
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const pathModule = await import('node:path')
      const fsModule = await import('node:fs')
      const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd()
      const candidates = [
        pathModule.join(baseDir, 'win-file-lock-detector.exe'),
        pathModule.join(baseDir, '..', 'win-file-lock-detector.exe'),
        pathModule.join(baseDir, 'public', 'win-file-lock-detector.exe'),
        pathModule.join(process.cwd(), 'public', 'win-file-lock-detector.exe'),
        pathModule.join(process.cwd(), 'win-file-lock-detector.exe')
      ]
      let foundPath = 'win-file-lock-detector.exe'
      for (const p of candidates) {
        if (fsModule.existsSync(p)) {
          foundPath = p
          break
        }
      }
      return executeCommand(foundPath, args, { timeout, maxBuffer: 64 * 1024 * 1024 })
    } catch (e) {}
  }

  return executeCommand('win-file-lock-detector.exe', args, { timeout })
}
