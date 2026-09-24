/**
 * 跨平台系统命令执行器抽象
 * 优先适配 Ruck 宿主 shell.execute 接口，兼顾 Node.js child_process 兜底与纯 Web 错误诊断
 */

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

/**
 * 检查当前宿主是否支持 Ruck 沙箱命令行执行
 */
export function isRuckShellAvailable() {
  const ruck = getRuck();
  return Boolean(ruck?.shell?.execute && typeof ruck.shell.execute === "function");
}

/**
 * 执行系统命令并返回 stdout 文本
 * @param {string} program 程序名称 (如 "netsh", "networksetup", "nmcli")
 * @param {string[]} args 参数列表 (如 ["wlan", "show", "profiles"])
 * @param {object} options 执行参数 (cwd, env 等)
 * @returns {Promise<string>}
 */
export async function executeCommand(program, args = [], options = {}) {
  const ruck = getRuck();

  // 1. 优先调用 Ruck 宿主安全沙箱 Shell API (Tauri 2.0 Webview2)
  if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
    try {
      const result = await ruck.shell.execute(program, args, options);
      if (result && typeof result === "object") {
        if (result.exitCode !== 0 && !result.stdout) {
          console.warn(`[Ruck Shell Warn] ${program} exited with code ${result.exitCode}: ${result.stderr}`);
        }
        return result.stdout || "";
      }
      return String(result || "");
    } catch (err) {
      console.warn(`[Ruck Shell Execute Error] ${program} failed:`, err);
      throw err;
    }
  }

  // 2. 回退兼容 Node.js 原生环境 (例如 Electron / 测试运行时)
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const nodeChildProcess = (await import("node:child_process")).default || (await import("node:child_process"));
      const fullCmd = [program, ...args.map(a => (a.includes(" ") ? `"${a}"` : a))].join(" ");
      return await new Promise((resolve) => {
        nodeChildProcess.exec(fullCmd, { encoding: "utf8", ...options }, (error, stdout) => {
          if (error) {
            console.warn(`[Node Exec Warn] ${fullCmd} exited with error:`, error);
          }
          resolve(stdout || "");
        });
      });
    } catch (nodeErr) {
      console.warn("[Node Fallback Error]", nodeErr);
    }
  }

  // 3. 纯浏览器静态预览环境无权限提示
  const errorMsg = `当前运行环境不支持调用系统底层命令 [${program}]。请在 Ruck 桌面端启动器中运行此插件。`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}
