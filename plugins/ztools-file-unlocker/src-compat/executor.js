/**
 * 跨平台/跨运行时命令执行器抽象
 * 优先调用 Ruck 宿主 shell.execute 接口，兼顾 Node.js child_process 兜底与路径自适应
 */

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

/**
 * 检查当前宿主是否为 Ruck 运行时
 */
export function isRuckAvailable() {
  const ruck = getRuck();
  return Boolean(ruck?.shell?.execute && typeof ruck.shell.execute === "function");
}

/**
 * 执行底层原生 unlocker-helper.exe
 * @param {string[]} args 命令行参数
 * @param {object} options 执行选项
 * @returns {Promise<{ stdout: string, stderr?: string, error?: string, exitCode?: number }>}
 */
export async function executeHelper(args = [], options = {}) {
  const ruck = getRuck();

  // 1. 优先调用 Ruck 安全沙箱 Shell API (Tauri 2.0 Webview2)
  if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
    try {
      // 传递相对路径 "bin/unlocker-helper.exe"，由 Ruck 内核自动定位至插件私有目录
      const result = await ruck.shell.execute("bin/unlocker-helper.exe", args, options);
      if (result && typeof result === "object") {
        return {
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode ?? 0
        };
      }
      return { stdout: String(result || ""), exitCode: 0 };
    } catch (err) {
      console.warn("[Ruck Shell] executeHelper error:", err);
      return { stdout: "", error: err.message || String(err), exitCode: -1 };
    }
  }

  // 2. 回退兼容 Node.js / Electron 原生环境
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const childProcess = (await import("node:child_process")).default || (await import("node:child_process"));
      const pathModule = (await import("node:path")).default || (await import("node:path"));
      const fsModule = (await import("node:fs")).default || (await import("node:fs"));

      const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
      const candidates = [
        pathModule.join(baseDir, "bin", "unlocker-helper.exe"),
        pathModule.join(baseDir, "unlocker-helper.exe"),
        pathModule.join(process.cwd(), "bin", "unlocker-helper.exe"),
        pathModule.join(process.cwd(), "unlocker-helper.exe")
      ];

      let helperPath = candidates[0];
      for (const p of candidates) {
        if (fsModule.existsSync(p)) {
          helperPath = p;
          break;
        }
      }

      return await new Promise((resolve) => {
        childProcess.execFile(
          helperPath,
          args,
          { encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024, ...options },
          (err, stdout, stderr) => {
            if (err && !stdout) {
              return resolve({ stdout: "", stderr: stderr || "", error: err.message || "执行失败", exitCode: err.code || -1 });
            }
            resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
          }
        );
      });
    } catch (nodeErr) {
      console.warn("[Node Helper Fallback Error]", nodeErr);
      return { stdout: "", error: nodeErr.message || String(nodeErr), exitCode: -1 };
    }
  }

  return { stdout: "", error: "当前运行环境不支持调用底层 Native Helper", exitCode: -1 };
}

/**
 * 执行 taskkill 命令强制兜底结束进程
 */
export async function executeTaskkill(pid, force = true) {
  const ruck = getRuck();
  const args = force ? ["/F", "/T", "/PID", String(pid)] : ["/PID", String(pid)];

  if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
    try {
      const result = await ruck.shell.execute("taskkill.exe", args);
      return {
        ok: result?.exitCode === 0,
        stdout: result?.stdout || "",
        stderr: result?.stderr || "",
        exitCode: result?.exitCode ?? 0
      };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const childProcess = (await import("node:child_process")).default || (await import("node:child_process"));
      return await new Promise((resolve) => {
        childProcess.execFile("taskkill.exe", args, { encoding: "utf8", windowsHide: true }, (err, stdout, stderr) => {
          if (!err) {
            resolve({ ok: true, stdout: stdout || "", exitCode: 0 });
          } else {
            resolve({ ok: false, stderr: stderr || "", error: err.message || "结束进程失败", exitCode: -1 });
          }
        });
      });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: "环境不支持 taskkill" };
}

/**
 * 唤起 explorer.exe 浏览指定路径或定位文件
 */
export async function executeExplorer(targetPath) {
  const ruck = getRuck();

  // 优先使用 Ruck 内置 showInFolder API
  if (ruck?.shell?.showInFolder && typeof ruck.shell.showInFolder === "function") {
    try {
      await ruck.shell.showInFolder(targetPath);
      return true;
    } catch (e) {
      console.warn("[Ruck Shell] showInFolder failed, fallback to explorer.exe:", e);
    }
  }

  if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
    try {
      await ruck.shell.execute("explorer.exe", ["/select,", targetPath]);
      return true;
    } catch (e) {
      console.warn("[Ruck Shell] execute explorer.exe failed:", e);
    }
  }

  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const childProcess = (await import("node:child_process")).default || (await import("node:child_process"));
      childProcess.spawn("explorer.exe", ["/select," + targetPath], { windowsHide: true });
      return true;
    } catch (e) {}
  }

  return false;
}
