/**
 * window.services 门面服务
 * 对齐原 Electron/Node.js 版文件解锁器服务契约，全面使用 Native Helper 与 Ruck IPC 实现
 */

import { executeHelper, executeTaskkill, executeExplorer } from "./executor.js";

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

function isExplorerProcess(s) {
  if (!s) return false;
  const l = String(s).toLowerCase();
  return l.includes("explorer.exe") || l === "explorer" || l.includes("资源管理器");
}

export const services = {
  /**
   * 动态设置窗口高度
   */
  expandWindow(h = 560) {
    const ruck = getRuck();
    if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
      try { ruck.window.setExpendHeight(h); } catch (e) {}
    } else if (typeof window !== "undefined" && window.ztools?.setExpendHeight) {
      try { window.ztools.setExpendHeight(h); } catch (e) {}
    }
  },

  /**
   * 提取所有未处理的进入事件 Action
   */
  getPendingActions() {
    const actions = window._utoolsPendingActions ? [...window._utoolsPendingActions] : [];
    window._utoolsPendingActions = [];
    return actions;
  },

  /**
   * 获取当前系统资源管理器或剪贴板中选中的文件/目录
   */
  async getSelectedFiles() {
    const res = await executeHelper(["get-selected"]);
    if (res.error) return [];
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * 安全获取 File 对象的本地绝对路径
   */
  getPathForFile(file) {
    if (!file) return "";
    if (typeof file === "string") return file;

    const ruck = getRuck();
    if (ruck?.getPathForFile && typeof ruck.getPathForFile === "function") {
      try {
        const p = ruck.getPathForFile(file);
        if (p) return p;
      } catch (e) {}
    }

    if (typeof window !== "undefined" && window.ztools?.getPathForFile) {
      try {
        const p = window.ztools.getPathForFile(file);
        if (p) return p;
      } catch (e) {}
    }

    return file.path || file.webkitRelativePath || file.name || "";
  },

  /**
   * 打开「选择文件/文件夹」对话框
   */
  async selectPaths() {
    const ruck = getRuck();

    // 优先使用 Ruck Window 对话框
    if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
      try {
        const res = await ruck.window.showOpenDialog({
          title: "选择文件或文件夹",
          multiple: true
        });
        if (Array.isArray(res)) return res;
        if (typeof res === "string" && res) return [res];
      } catch (e) {
        console.warn("[Services] ruck.window.showOpenDialog error:", e);
      }
    }

    if (typeof window !== "undefined" && window.ztools?.showOpenDialog) {
      try {
        const res = await window.ztools.showOpenDialog({
          title: "选择文件或文件夹",
          properties: ["openFile", "openDirectory", "multiSelections"]
        });
        if (Array.isArray(res)) return res;
      } catch (e) {}
    }

    return [];
  },

  /**
   * 选择目标文件夹（用于移动）
   */
  async pickFolder() {
    const ruck = getRuck();

    if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
      try {
        const res = await ruck.window.showOpenDialog({
          title: "选择目标文件夹",
          directory: true,
          multiple: false
        });
        if (Array.isArray(res) && res.length > 0) return res[0];
        if (typeof res === "string" && res) return res;
      } catch (e) {
        console.warn("[Services] ruck.window.showOpenDialog directory error:", e);
      }
    }

    if (typeof window !== "undefined" && window.ztools?.showOpenDialog) {
      try {
        const res = await window.ztools.showOpenDialog({
          title: "选择目标文件夹",
          properties: ["openDirectory", "createDirectory"]
        });
        if (Array.isArray(res)) return res[0] || "";
        if (typeof res === "string") return res;
      } catch (e) {}
    }

    return "";
  },

  /**
   * 列出占用该路径的所有进程（Restart Manager + 内核句柄枚举 + 映像扫描）
   */
  async listHolders(targetPath) {
    const res = await executeHelper(["list", targetPath]);
    if (res.error) return { error: res.error, holders: [] };
    try {
      const text = (res.stdout || "").trim();
      if (!text) return { holders: [] };
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      return { holders: arr.filter(h => h && h.pid > 0) };
    } catch (e) {
      return { error: "解析进程占用数据失败: " + e.message, holders: [] };
    }
  },

  /**
   * 批量极速列出占用进程（一次跨进程调用，底层流水线并行扫描）
   */
  async listHoldersBatch(targetPaths) {
    if (!targetPaths || !targetPaths.length) return {};
    const res = await executeHelper(["list-batch", ...targetPaths]);
    if (res.error) return {};
    try {
      const text = (res.stdout || "").trim();
      if (!text) return {};
      const data = JSON.parse(text);
      return typeof data === "object" && data ? data : {};
    } catch (e) {
      return {};
    }
  },

  /**
   * 关闭远程进程中的特定文件句柄（不杀进程解除占用）
   */
  async closeHandle(pid, handle) {
    const res = await executeHelper(["close-handle", String(pid), String(handle)]);
    if (res.error) return { ok: false, message: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return { ok: Boolean(data && data.ok) };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  },

  /**
   * 重启 Windows 资源管理器 (explorer.exe) 防止桌面异常或任务栏消失
   */
  async restartExplorer() {
    const res = await executeHelper(["restart-explorer"]);
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return Boolean(data && data.ok);
    } catch (e) {
      return false;
    }
  },

  /**
   * 结束单个进程（强制终止进程树，若为资源管理器则自动重启以防电脑异常）
   */
  async killProcess(pid, force = true, processHint = "") {
    const isHintExp = isExplorerProcess(processHint);

    // 优先调用底层 C++ 原生 kill（包含内部 QueryFullProcessImageName 校验与 ShellExecute 自动重启）
    const res = await executeHelper(["kill", String(pid)]);
    if (!res.error) {
      try {
        const data = JSON.parse((res.stdout || "").trim());
        if (data && data.ok) {
          const isExp = Boolean(data.restartedExplorer || isHintExp);
          if (isExp) {
            await services.restartExplorer();
          }
          return { ok: true, message: "已结束进程", restartedExplorer: isExp };
        }
      } catch (e) {}
    }

    // 兜底 taskkill
    const tkRes = await executeTaskkill(pid, force);
    if (tkRes.ok) {
      if (isHintExp) {
        await services.restartExplorer();
      }
      return { ok: true, message: tkRes.stdout || "已结束进程", restartedExplorer: isHintExp };
    }

    const msg = tkRes.stderr || tkRes.error || res.error || "结束进程失败";
    return { ok: false, message: msg, restartedExplorer: false };
  },

  /**
   * 查找占用并直接杀掉所有占用进程以彻底解锁（若含资源管理器则自动重启）
   */
  async unlockPath(targetPath) {
    const res = await services.listHolders(targetPath);
    if (res.error) return { ok: false, message: res.error, killed: [], restartedExplorer: false };
    const holders = res.holders || [];
    if (!holders.length) return { ok: true, message: "未发现占用", killed: [], restartedExplorer: false };

    const killed = [];
    const failed = [];
    let hadExplorer = false;

    for (const h of holders) {
      const isExp = isExplorerProcess(h.name) || isExplorerProcess(h.exe);
      const kRes = await services.killProcess(h.pid, true, h.name || h.exe);
      if (kRes.ok) {
        killed.push(h);
        if (isExp || kRes.restartedExplorer) hadExplorer = true;
      } else {
        if (h.handles && h.handles.length > 0) {
          let closed = true;
          for (const handleVal of h.handles) {
            const cRes = await services.closeHandle(h.pid, handleVal);
            if (!cRes.ok) closed = false;
          }
          if (closed) {
            killed.push(h);
          } else {
            failed.push(h);
          }
        } else {
          failed.push(h);
        }
      }
    }

    if (hadExplorer) {
      await services.restartExplorer();
    }

    return {
      ok: failed.length === 0,
      killed,
      failed,
      restartedExplorer: hadExplorer,
      message: failed.length
        ? `部分进程 (${failed.map(f => f.name || f.pid).join(", ")}) 无法结束`
        : (hadExplorer ? "占用进程已结束（检测到资源管理器占用，已自动重启桌面）" : "占用进程已全部结束，文件已解锁")
    };
  },

  /**
   * 删除文件/文件夹（移入回收站）
   */
  async deletePath(targetPath) {
    const res = await executeHelper(["delete", targetPath]);
    if (res.error) return { ok: false, message: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return { ok: Boolean(data && data.ok), message: data?.message || "" };
    } catch (e) {
      return { ok: res.exitCode === 0, message: res.stderr || "" };
    }
  },

  /**
   * 重命名文件/文件夹
   */
  async renamePath(targetPath, newName) {
    const safe = String(newName || "").trim();
    if (!safe) return { ok: false, message: "文件名不能为空" };
    if (/[\\/:*?"<>|]/.test(safe)) return { ok: false, message: "文件名包含非法字符" };

    const res = await executeHelper(["rename", targetPath, safe]);
    if (res.error) return { ok: false, message: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return { ok: Boolean(data && data.ok), dest: data?.dest || "" };
    } catch (e) {
      return { ok: res.exitCode === 0, message: res.stderr || "" };
    }
  },

  /**
   * 移动文件/文件夹至目标目录
   */
  async movePath(targetPath, destDir) {
    const res = await executeHelper(["move", targetPath, destDir]);
    if (res.error) return { ok: false, message: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return { ok: Boolean(data && data.ok), dest: data?.dest || "" };
    } catch (e) {
      return { ok: res.exitCode === 0, message: res.stderr || "" };
    }
  },

  /**
   * 在系统资源管理器中定位文件
   */
  async showInExplorer(targetPath) {
    return await executeExplorer(targetPath);
  },

  /**
   * 探测独占锁定状态
   */
  async probeLock(targetPath) {
    const res = await executeHelper(["probe-lock", targetPath]);
    if (res.error) return { locked: null, error: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return { locked: data.locked, code: data.code };
    } catch (e) {
      return { locked: null };
    }
  },

  /**
   * 获取文件/文件夹属性信息（大小、类型等）
   */
  async getPathInfo(targetPath) {
    const res = await executeHelper(["stat", targetPath]);
    if (res.error) return { ok: false, error: res.error };
    try {
      const data = JSON.parse((res.stdout || "").trim());
      return {
        ok: Boolean(data && data.ok),
        isDirectory: Boolean(data?.isDirectory),
        size: data?.size || 0,
        sizeStr: data?.sizeStr || (data?.isDirectory ? "文件夹" : "0 B")
      };
    } catch (e) {
      return { ok: false };
    }
  }
};
