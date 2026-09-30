(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src-compat/executor.js
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  async function executeHelper(args = [], options = {}) {
    const ruck = getRuck();
    if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
      try {
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
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const childProcess = (await import("node:child_process")).default || await import("node:child_process");
        const pathModule = (await import("node:path")).default || await import("node:path");
        const fsModule = (await import("node:fs")).default || await import("node:fs");
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
                return resolve({ stdout: "", stderr: stderr || "", error: err.message || "\u6267\u884C\u5931\u8D25", exitCode: err.code || -1 });
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
    return { stdout: "", error: "\u5F53\u524D\u8FD0\u884C\u73AF\u5883\u4E0D\u652F\u6301\u8C03\u7528\u5E95\u5C42 Native Helper", exitCode: -1 };
  }
  async function executeTaskkill(pid, force = true) {
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
        const childProcess = (await import("node:child_process")).default || await import("node:child_process");
        return await new Promise((resolve) => {
          childProcess.execFile("taskkill.exe", args, { encoding: "utf8", windowsHide: true }, (err, stdout, stderr) => {
            if (!err) {
              resolve({ ok: true, stdout: stdout || "", exitCode: 0 });
            } else {
              resolve({ ok: false, stderr: stderr || "", error: err.message || "\u7ED3\u675F\u8FDB\u7A0B\u5931\u8D25", exitCode: -1 });
            }
          });
        });
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    return { ok: false, error: "\u73AF\u5883\u4E0D\u652F\u6301 taskkill" };
  }
  async function executeExplorer(targetPath) {
    const ruck = getRuck();
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
        const childProcess = (await import("node:child_process")).default || await import("node:child_process");
        childProcess.spawn("explorer.exe", ["/select," + targetPath], { windowsHide: true });
        return true;
      } catch (e) {
      }
    }
    return false;
  }

  // src-compat/services.js
  function getRuck2() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  function isExplorerProcess(s) {
    if (!s) return false;
    const l = String(s).toLowerCase();
    return l.includes("explorer.exe") || l === "explorer" || l.includes("\u8D44\u6E90\u7BA1\u7406\u5668");
  }
  var services = {
    /**
     * 动态设置窗口高度
     */
    expandWindow(h = 560) {
      const ruck = getRuck2();
      if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
        try {
          ruck.window.setExpendHeight(h);
        } catch (e) {
        }
      } else if (typeof window !== "undefined" && window.ztools?.setExpendHeight) {
        try {
          window.ztools.setExpendHeight(h);
        } catch (e) {
        }
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
      const ruck = getRuck2();
      if (ruck?.getPathForFile && typeof ruck.getPathForFile === "function") {
        try {
          const p = ruck.getPathForFile(file);
          if (p) return p;
        } catch (e) {
        }
      }
      if (typeof window !== "undefined" && window.ztools?.getPathForFile) {
        try {
          const p = window.ztools.getPathForFile(file);
          if (p) return p;
        } catch (e) {
        }
      }
      return file.path || file.webkitRelativePath || file.name || "";
    },
    /**
     * 打开「选择文件/文件夹」对话框
     */
    async selectPaths() {
      const ruck = getRuck2();
      if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
        try {
          const res = await ruck.window.showOpenDialog({
            title: "\u9009\u62E9\u6587\u4EF6\u6216\u6587\u4EF6\u5939",
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
            title: "\u9009\u62E9\u6587\u4EF6\u6216\u6587\u4EF6\u5939",
            properties: ["openFile", "openDirectory", "multiSelections"]
          });
          if (Array.isArray(res)) return res;
        } catch (e) {
        }
      }
      return [];
    },
    /**
     * 选择目标文件夹（用于移动）
     */
    async pickFolder() {
      const ruck = getRuck2();
      if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
        try {
          const res = await ruck.window.showOpenDialog({
            title: "\u9009\u62E9\u76EE\u6807\u6587\u4EF6\u5939",
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
            title: "\u9009\u62E9\u76EE\u6807\u6587\u4EF6\u5939",
            properties: ["openDirectory", "createDirectory"]
          });
          if (Array.isArray(res)) return res[0] || "";
          if (typeof res === "string") return res;
        } catch (e) {
        }
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
        return { holders: arr.filter((h) => h && h.pid > 0) };
      } catch (e) {
        return { error: "\u89E3\u6790\u8FDB\u7A0B\u5360\u7528\u6570\u636E\u5931\u8D25: " + e.message, holders: [] };
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
      const res = await executeHelper(["kill", String(pid)]);
      if (!res.error) {
        try {
          const data = JSON.parse((res.stdout || "").trim());
          if (data && data.ok) {
            const isExp = Boolean(data.restartedExplorer || isHintExp);
            if (isExp) {
              await services.restartExplorer();
            }
            return { ok: true, message: "\u5DF2\u7ED3\u675F\u8FDB\u7A0B", restartedExplorer: isExp };
          }
        } catch (e) {
        }
      }
      const tkRes = await executeTaskkill(pid, force);
      if (tkRes.ok) {
        if (isHintExp) {
          await services.restartExplorer();
        }
        return { ok: true, message: tkRes.stdout || "\u5DF2\u7ED3\u675F\u8FDB\u7A0B", restartedExplorer: isHintExp };
      }
      const msg = tkRes.stderr || tkRes.error || res.error || "\u7ED3\u675F\u8FDB\u7A0B\u5931\u8D25";
      return { ok: false, message: msg, restartedExplorer: false };
    },
    /**
     * 查找占用并直接杀掉所有占用进程以彻底解锁（若含资源管理器则自动重启）
     */
    async unlockPath(targetPath) {
      const res = await services.listHolders(targetPath);
      if (res.error) return { ok: false, message: res.error, killed: [], restartedExplorer: false };
      const holders = res.holders || [];
      if (!holders.length) return { ok: true, message: "\u672A\u53D1\u73B0\u5360\u7528", killed: [], restartedExplorer: false };
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
        message: failed.length ? `\u90E8\u5206\u8FDB\u7A0B (${failed.map((f) => f.name || f.pid).join(", ")}) \u65E0\u6CD5\u7ED3\u675F` : hadExplorer ? "\u5360\u7528\u8FDB\u7A0B\u5DF2\u7ED3\u675F\uFF08\u68C0\u6D4B\u5230\u8D44\u6E90\u7BA1\u7406\u5668\u5360\u7528\uFF0C\u5DF2\u81EA\u52A8\u91CD\u542F\u684C\u9762\uFF09" : "\u5360\u7528\u8FDB\u7A0B\u5DF2\u5168\u90E8\u7ED3\u675F\uFF0C\u6587\u4EF6\u5DF2\u89E3\u9501"
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
      if (!safe) return { ok: false, message: "\u6587\u4EF6\u540D\u4E0D\u80FD\u4E3A\u7A7A" };
      if (/[\\/:*?"<>|]/.test(safe)) return { ok: false, message: "\u6587\u4EF6\u540D\u5305\u542B\u975E\u6CD5\u5B57\u7B26" };
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
          sizeStr: data?.sizeStr || (data?.isDirectory ? "\u6587\u4EF6\u5939" : "0 B")
        };
      } catch (e) {
        return { ok: false };
      }
    }
  };

  // src-compat/ztools.js
  function getRuck3() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  function createZtoolsBridge() {
    let enterCallback = null;
    let enterTriggered = false;
    const bridge = {
      /**
       * 写入剪贴板文本
       */
      copyText(text) {
        const ruck = getRuck3();
        if (ruck?.clipboard?.writeText && typeof ruck.clipboard.writeText === "function") {
          try {
            ruck.clipboard.writeText(text);
            return true;
          } catch (e) {
            console.warn("[ZTools Bridge] ruck.clipboard.writeText \u5F02\u5E38:", e);
          }
        }
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => {
          });
          return true;
        }
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          return true;
        } catch (e) {
          console.error("[ZTools Bridge] \u526A\u8D34\u677F\u590D\u5236\u5931\u8D25:", e);
          return false;
        }
      },
      /**
       * 动态设置窗口高度
       */
      setExpendHeight(height = 560) {
        const ruck = getRuck3();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      setExpandHeight(height = 560) {
        bridge.setExpendHeight(height);
      },
      /**
       * 退出或切出插件
       */
      outPlugin() {
        const ruck = getRuck3();
        if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === "function") {
          ruck.window.outPlugin();
        } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === "function") {
          ruck.window.hideMainWindow();
        } else {
          console.log("[ZTools Bridge] outPlugin invoked");
        }
      },
      /**
       * 隐藏主窗口
       */
      hideMainWindow() {
        bridge.outPlugin();
      },
      /**
       * 显示主窗口
       */
      showMainWindow() {
        const ruck = getRuck3();
        if (ruck?.window?.showMainWindow && typeof ruck.window.showMainWindow === "function") {
          ruck.window.showMainWindow();
        }
      },
      /**
       * 调起系统原生打开文件对话框
       */
      async showOpenDialog(options = {}) {
        const ruck = getRuck3();
        if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
          return await ruck.window.showOpenDialog(options);
        }
        return [];
      },
      /**
       * 获取 File 本地路径
       */
      getPathForFile(file) {
        const ruck = getRuck3();
        if (ruck?.getPathForFile && typeof ruck.getPathForFile === "function") {
          return ruck.getPathForFile(file);
        }
        return file?.path || "";
      },
      /**
       * 监听插件激活/进入事件
       * 具备 80ms 冷启动保底与初始参数提取
       */
      onPluginEnter(callback) {
        if (typeof callback !== "function") return;
        enterCallback = callback;
        const triggerEnter = (action) => {
          if (enterTriggered) return;
          enterTriggered = true;
          const normalizedAction = action || {
            code: "file-unlocker",
            type: "text",
            payload: ""
          };
          try {
            enterCallback(normalizedAction);
          } catch (e) {
            console.error("[ZTools Bridge] onPluginEnter \u6267\u884C\u5F02\u5E38:", e);
          }
        };
        if (typeof window !== "undefined" && window.__ruck_enter_payload) {
          triggerEnter(window.__ruck_enter_payload);
          return;
        }
        const ruck = getRuck3();
        if (ruck?.onPluginEnter && typeof ruck.onPluginEnter === "function") {
          ruck.onPluginEnter((action) => {
            triggerEnter(action);
          });
        }
        setTimeout(() => {
          if (!enterTriggered) {
            triggerEnter({
              code: "file-unlocker",
              type: "text",
              payload: ""
            });
          }
        }, 80);
      },
      /**
       * 监听插件切出事件
       */
      onPluginOut(callback) {
        const ruck = getRuck3();
        if (ruck?.onPluginOut && typeof ruck.onPluginOut === "function") {
          ruck.onPluginOut(callback);
        }
      }
    };
    return bridge;
  }

  // src-compat/index.js
  if (typeof window !== "undefined") {
    window._utoolsPendingActions = window._utoolsPendingActions || [];
  }
  var ztoolsBridge = createZtoolsBridge();
  if (typeof window !== "undefined") {
    window.services = services;
    window.ztools = ztoolsBridge;
    window.utools = ztoolsBridge;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.services = services;
    globalThis.ztools = ztoolsBridge;
    globalThis.utools = ztoolsBridge;
  }
  ztoolsBridge.onPluginEnter((action) => {
    if (typeof window !== "undefined") {
      window._utoolsPendingActions.push(action);
      if (typeof window.onPluginEnter === "function") {
        try {
          window.onPluginEnter(action);
        } catch (e) {
          console.error("[Preload] onPluginEnter error:", e);
        }
      }
    }
  });
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeModal = typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(".modal-overlay.show") : null;
      const contextMenu = typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById("contextMenu") : null;
      const isMenuOpen = contextMenu && contextMenu.style.display !== "none" && contextMenu.style.display !== "";
      if (activeModal || isMenuOpen) {
        return;
      }
      const activeEl = typeof document !== "undefined" ? document.activeElement : null;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") && activeEl.value) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        ztoolsBridge.outPlugin();
      } catch (e) {
        console.warn("[Preload] outPlugin failed:", e);
      }
    }
  }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  }
  console.log("[Ruck FileUnlocker Compat] Preload \u57AB\u7247\u5C42\u4E0E API \u88C5\u914D\u5B8C\u6210");
})();
