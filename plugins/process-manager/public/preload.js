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

  // src-compat/ztools.ts
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var KNOWN_CODES = ["process"];
  function normalizeAction(action) {
    const normalized = { ...action || {} };
    if (!normalized.code || normalized.code === "default" || normalized.code === "main" || !KNOWN_CODES.includes(normalized.code)) {
      normalized.code = "process";
    }
    if (!normalized.type) normalized.type = "text";
    if (normalized.payload === void 0) normalized.payload = "";
    return normalized;
  }
  function createZtoolsBridge() {
    const enterListeners = /* @__PURE__ */ new Set();
    const outListeners = /* @__PURE__ */ new Set();
    let fallbackTimer = null;
    let hasReceivedRealEnter = false;
    let currentSubInputCallback = null;
    let isHostEventsBound = false;
    const dispatchEnter = (action) => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      hasReceivedRealEnter = true;
      const normalized = normalizeAction(action);
      enterListeners.forEach((listener) => {
        try {
          listener(normalized);
        } catch (e) {
          console.error("[ztools] onPluginEnter callback error:", e);
        }
      });
    };
    const dispatchOut = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      outListeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error("[ztools] onPluginOut callback error:", e);
        }
      });
    };
    const bindHostEventsOnce = () => {
      if (isHostEventsBound) return;
      isHostEventsBound = true;
      const ruck = getRuck();
      if (ruck?.onPluginEnter) {
        ruck.onPluginEnter(dispatchEnter);
      } else if (ruck?.on) {
        ruck.on("plugin-enter", dispatchEnter);
      }
      if (ruck?.onPluginOut) {
        ruck.onPluginOut(dispatchOut);
      } else if (ruck?.on) {
        ruck.on("plugin-out", dispatchOut);
      }
      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("ruck://plugin-enter", (event) => {
          dispatchEnter(event?.detail);
        });
        window.addEventListener("ruck://plugin-out", () => {
          dispatchOut();
        });
      }
    };
    bindHostEventsOnce();
    const bridge = {
      /**
       * 写入剪贴板文本
       */
      copyText(text) {
        const ruck = getRuck();
        if (ruck?.clipboard?.writeText && typeof ruck.clipboard.writeText === "function") {
          try {
            ruck.clipboard.writeText(text);
            return true;
          } catch (e) {
            console.warn("[ztools] ruck.clipboard.writeText error:", e);
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
          console.error("[ztools] copyText failed:", e);
          return false;
        }
      },
      /**
       * 子输入框适配
       */
      setSubInput(onChange, placeholder = "", isFocus = true) {
        currentSubInputCallback = onChange;
        const wrappedOnChange = (val) => {
          if (typeof onChange === "function") {
            const text = typeof val === "object" && val !== null ? val.text || "" : String(val || "");
            onChange({ text });
          }
        };
        const ruck = getRuck();
        if (ruck?.ui?.setSubInput) {
          return ruck.ui.setSubInput(wrappedOnChange, placeholder, isFocus);
        }
        if (ruck?.setSubInput) {
          return ruck.setSubInput(wrappedOnChange, placeholder, isFocus);
        }
      },
      removeSubInput() {
        currentSubInputCallback = null;
        const ruck = getRuck();
        if (ruck?.ui?.removeSubInput) {
          return ruck.ui.removeSubInput();
        }
        if (ruck?.removeSubInput) {
          return ruck.removeSubInput();
        }
      },
      setSubInputValue(value) {
        const text = typeof value === "string" ? value : String(value || "");
        const ruck = getRuck();
        if (ruck?.ui?.setSubInputValue) {
          ruck.ui.setSubInputValue(text);
        } else if (ruck?.setSubInputValue) {
          ruck.setSubInputValue(text);
        }
        if (typeof currentSubInputCallback === "function") {
          try {
            currentSubInputCallback({ text });
          } catch (e) {
            console.error("[ztools] subInputCallback error on setSubInputValue:", e);
          }
        }
      },
      subInputFocus() {
        const ruck = getRuck();
        if (ruck?.ui?.subInputFocus) {
          return ruck.ui.subInputFocus();
        }
        if (ruck?.subInputFocus) {
          return ruck.subInputFocus();
        }
      },
      /**
       * 窗口控制
       */
      setExpendHeight(height = 560) {
        const ruck = getRuck();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      setExpandHeight(height = 560) {
        bridge.setExpendHeight(height);
      },
      outPlugin(isKill = false) {
        const ruck = getRuck();
        if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === "function") {
          ruck.window.outPlugin(isKill);
        } else if (ruck?.outPlugin && typeof ruck.outPlugin === "function") {
          ruck.outPlugin(isKill);
        } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === "function") {
          ruck.window.hideMainWindow();
        }
      },
      hideMainWindow(restorePreWindow = true) {
        const ruck = getRuck();
        if (ruck?.window?.hideMainWindow) {
          return ruck.window.hideMainWindow(restorePreWindow);
        }
        if (ruck?.hideMainWindow) {
          return ruck.hideMainWindow(restorePreWindow);
        }
        bridge.outPlugin();
      },
      showMainWindow() {
        const ruck = getRuck();
        if (ruck?.window?.showMainWindow) {
          return ruck.window.showMainWindow();
        }
        if (ruck?.showMainWindow) {
          return ruck.showMainWindow();
        }
      },
      /**
       * 生命周期管理
       */
      onPluginEnter(callback) {
        if (typeof callback !== "function") return () => {
        };
        bindHostEventsOnce();
        enterListeners.add(callback);
        if (typeof window !== "undefined" && window.__ruck_enter_payload) {
          const initialPayload = window.__ruck_enter_payload;
          setTimeout(() => {
            if (enterListeners.has(callback)) {
              try {
                callback(normalizeAction(initialPayload));
              } catch (e) {
                console.error("[ztools] initial enter dispatch error:", e);
              }
            }
          }, 0);
        }
        if (!hasReceivedRealEnter && !fallbackTimer) {
          fallbackTimer = setTimeout(() => {
            fallbackTimer = null;
            if (!hasReceivedRealEnter) {
              dispatchEnter({ code: "process", type: "text", payload: "" });
            }
          }, 80);
        }
        return () => {
          enterListeners.delete(callback);
        };
      },
      onPluginOut(callback) {
        if (typeof callback !== "function") return () => {
        };
        bindHostEventsOnce();
        outListeners.add(callback);
        return () => {
          outListeners.delete(callback);
        };
      }
    };
    return bridge;
  }

  // src-compat/executor.ts
  function getRuck2() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  async function executeCommand(program, args = [], options = {}) {
    const ruck = getRuck2();
    if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
      try {
        const result = await ruck.shell.execute(program, args, options);
        if (result && typeof result === "object") {
          return {
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            exitCode: result.exitCode ?? 0
          };
        }
        return { stdout: String(result || ""), exitCode: 0 };
      } catch (err) {
        console.warn(`[Ruck Shell] execute "${program}" error:`, err);
        return { stdout: "", stderr: "", error: err?.message || String(err), exitCode: -1 };
      }
    }
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const childProcess = await import("node:child_process");
        return await new Promise((resolve) => {
          childProcess.execFile(
            program,
            args,
            {
              timeout: options.timeout,
              windowsHide: true,
              encoding: "utf8",
              maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
              ...options
            },
            (err, stdout, stderr) => {
              const exitCode = typeof err?.code === "number" ? err.code : err ? -1 : 0;
              const timedOut = Boolean(err?.killed);
              resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                exitCode,
                error: typeof err?.code !== "number" && err ? err.message : void 0,
                timedOut
              });
            }
          );
        });
      } catch (nodeErr) {
        console.warn(`[Node Shell Fallback] execute "${program}" error:`, nodeErr);
        return { stdout: "", stderr: "", error: nodeErr?.message || String(nodeErr), exitCode: -1 };
      }
    }
    return { stdout: "", stderr: "", error: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u8C03\u7528\u7CFB\u7EDF\u5916\u90E8\u547D\u4EE4", exitCode: -1 };
  }
  async function executePowerShell(args, timeout = 1e4) {
    return executeCommand("powershell.exe", args, { timeout });
  }
  async function executeTaskkill(pid, force = true) {
    const args = force ? ["/F", "/T", "/PID", String(pid)] : ["/PID", String(pid)];
    return executeCommand("taskkill.exe", args, { timeout: 4e3 });
  }
  async function executeDetector(args, timeout = 3e4) {
    const ruck = getRuck2();
    if (ruck?.shell?.execute && typeof ruck.shell.execute === "function") {
      const candidates = [
        "win-file-lock-detector.exe",
        "bin/win-file-lock-detector.exe",
        "bin\\win-file-lock-detector.exe"
      ];
      for (const exe of candidates) {
        try {
          const result = await ruck.shell.execute(exe, args, { timeout });
          if (result && typeof result === "object") {
            return {
              stdout: (result.stdout || "").replace(/^\uFEFF/, ""),
              stderr: result.stderr || "",
              exitCode: result.exitCode ?? 0
            };
          }
        } catch (e) {
          continue;
        }
      }
      return executeCommand("win-file-lock-detector.exe", args, { timeout });
    }
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const pathModule = await import("node:path");
        const fsModule = await import("node:fs");
        const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
        const candidates = [
          pathModule.join(baseDir, "win-file-lock-detector.exe"),
          pathModule.join(baseDir, "..", "win-file-lock-detector.exe"),
          pathModule.join(baseDir, "public", "win-file-lock-detector.exe"),
          pathModule.join(process.cwd(), "public", "win-file-lock-detector.exe"),
          pathModule.join(process.cwd(), "win-file-lock-detector.exe")
        ];
        let foundPath = "win-file-lock-detector.exe";
        for (const p of candidates) {
          if (fsModule.existsSync(p)) {
            foundPath = p;
            break;
          }
        }
        return executeCommand(foundPath, args, { timeout, maxBuffer: 64 * 1024 * 1024 });
      } catch (e) {
      }
    }
    return executeCommand("win-file-lock-detector.exe", args, { timeout });
  }

  // src-compat/services.ts
  function parseCsvLine(line) {
    const fields = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch !== '"') {
          field += ch;
        } else if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  }
  function parseProcessCsv(output) {
    const lines = output.replace(/^\uFEFF/, "").trim().replace(/\r/g, "").split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const pidIdx = header.indexOf("processid");
    const pathIdx = header.indexOf("executablepath");
    if (nameIdx === -1 || pidIdx === -1) return [];
    return lines.slice(1).map((line) => {
      const parts = parseCsvLine(line);
      return {
        name: (parts[nameIdx] || "").trim(),
        pid: parseInt(parts[pidIdx], 10) || 0,
        path: (parts[pathIdx] || "").trim()
      };
    }).filter((p) => p.pid > 0);
  }
  function parseNetstat(output) {
    const lines = output.trim().replace(/\r/g, "").split("\n").filter(Boolean);
    const ports = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const addr = parts[1];
      const pid = parseInt(parts[4], 10);
      if (!addr || isNaN(pid)) continue;
      const portMatch = addr.match(/:(\d+)$/);
      if (portMatch) {
        ports.push({ port: parseInt(portMatch[1], 10), pid, protocol: parts[0] });
      }
    }
    return ports;
  }
  function groupHandles(handles) {
    const byPid = /* @__PURE__ */ new Map();
    for (const handle of handles) {
      if (!Number.isInteger(handle.pid) || handle.pid <= 0) continue;
      let entry = byPid.get(handle.pid);
      if (!entry) {
        entry = {
          pid: handle.pid,
          name: handle.name || "",
          handleCount: 0,
          handlePath: "",
          handlePaths: []
        };
        byPid.set(handle.pid, entry);
      }
      entry.handleCount = (entry.handleCount || 0) + 1;
      const handlePath = handle.path || "";
      if (handlePath && entry.handlePaths && !entry.handlePaths.includes(handlePath)) {
        entry.handlePaths.push(handlePath);
        if (!entry.handlePath) entry.handlePath = handlePath;
      }
    }
    return Array.from(byPid.values()).sort(
      (a, b) => a.name.localeCompare(b.name) || a.pid - b.pid
    );
  }
  function firstLine(text) {
    return (text || "").trim().split(/\r?\n/)[0] || "";
  }
  var PS_LIST_PROCESSES_ARGS = [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath | ConvertTo-Csv -NoTypeInformation"
  ];
  var services = {
    /**
     * 枚举系统进程列表
     */
    async listProcesses() {
      const ps = await executePowerShell(PS_LIST_PROCESSES_ARGS, 8e3);
      if (ps.stdout) {
        const psList = parseProcessCsv(ps.stdout);
        if (psList.length) return psList;
      }
      const wmic = await executeCommand("wmic.exe", ["process", "get", "ProcessId,Name,ExecutablePath", "/FORMAT:CSV"], { timeout: 8e3 });
      if (wmic.stdout) {
        const wmicList = parseProcessCsv(wmic.stdout);
        if (wmicList.length) return wmicList;
      }
      const tasklist = await executeCommand("tasklist.exe", ["/FO", "CSV", "/NH"], { timeout: 5e3 });
      if (tasklist.stdout) {
        return tasklist.stdout.trim().replace(/\r/g, "").split("\n").filter(Boolean).map((line) => {
          const parts = parseCsvLine(line);
          return { name: parts[0] || "", pid: parseInt(parts[1], 10) || 0, path: "" };
        }).filter((p) => p.pid > 0);
      }
      return [];
    },
    /**
     * 扫描系统端口与 PID 绑定
     */
    async scanPorts() {
      const res = await executeCommand("netstat.exe", ["-ano"], { timeout: 5e3 });
      return res.stdout ? parseNetstat(res.stdout) : [];
    },
    /**
     * 获取文件/文件夹属性与存在性
     */
    async pathInfo(filePath) {
      if (typeof filePath !== "string" || !filePath.trim()) {
        return { success: false, exists: false, isFile: false, isDirectory: false, path: "" };
      }
      const target = filePath.trim();
      try {
        const res = await executeDetector([target, "--json"], 6e3);
        if (res.stdout) {
          try {
            const data = JSON.parse(res.stdout);
            if (data && typeof data.type === "string") {
              const isDir = data.type === "directory";
              return {
                success: true,
                exists: true,
                isFile: !isDir,
                isDirectory: isDir,
                path: data.path || target
              };
            }
          } catch (e) {
          }
        }
        if (res.stderr && /does not exist/i.test(res.stderr)) {
          return { success: true, exists: false, isFile: false, isDirectory: false, path: target };
        }
      } catch (e) {
      }
      try {
        const psCmd = `if (Test-Path -LiteralPath '${target.replace(/'/g, "''")}') { $item = Get-Item -LiteralPath '${target.replace(/'/g, "''")}'; if ($item.PSIsContainer) { 'DIR' } else { 'FILE' } } else { 'NONE' }`;
        const psRes = await executePowerShell(["-NoProfile", "-Command", psCmd], 4e3);
        const out = (psRes.stdout || "").trim();
        if (out === "DIR") {
          return { success: true, exists: true, isFile: false, isDirectory: true, path: target };
        } else if (out === "FILE") {
          return { success: true, exists: true, isFile: true, isDirectory: false, path: target };
        } else if (out === "NONE") {
          return { success: true, exists: false, isFile: false, isDirectory: false, path: target };
        }
      } catch (e) {
      }
      return { success: false, exists: false, isFile: false, isDirectory: false, path: target };
    },
    /**
     * 查询指定文件或目录的占用进程
     */
    async whoLocks(filePath, options = {}) {
      if (typeof filePath !== "string" || !filePath.trim()) {
        return { success: false, error: "\u65E0\u6548\u7684\u6587\u4EF6\u8DEF\u5F84" };
      }
      const target = filePath.trim();
      const info = await services.pathInfo(target);
      if (!info.exists) {
        return { success: false, error: `\u6587\u4EF6\u6216\u76EE\u5F55\u4E0D\u5B58\u5728: ${target}` };
      }
      const isDirectory = info.isDirectory;
      const mode = options.mode === "handles" || options.mode === "files" ? options.mode : isDirectory ? "handles" : "files";
      const useRestartManager = !isDirectory && mode === "files";
      const args = [target, "--json"];
      if (!useRestartManager) {
        args.push("--handles");
      }
      const timeout = useRestartManager ? 2e4 : 12e4;
      const scan = await executeDetector(args, timeout);
      if (scan.timedOut) {
        return { success: false, error: "\u68C0\u6D4B\u8D85\u65F6\uFF0C\u8FDB\u7A0B\u53E5\u67C4\u8F83\u591A\u65F6\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      }
      if (scan.exitCode !== 0 && scan.exitCode !== 1) {
        return {
          success: false,
          error: firstLine(scan.stderr || "") || firstLine(scan.error || "") || "\u68C0\u6D4B\u5931\u8D25"
        };
      }
      let data;
      try {
        data = JSON.parse(scan.stdout);
      } catch {
        return { success: false, error: firstLine(scan.stderr || "") || "\u65E0\u6CD5\u89E3\u6790\u68C0\u6D4B\u7ED3\u679C" };
      }
      if (data.method === "restart-manager") {
        const holders = (Array.isArray(data.processes) ? data.processes : []).filter((proc) => Number.isInteger(proc.pid) && proc.pid > 0).map((proc) => ({
          pid: proc.pid,
          name: proc.app_name || proc.name || "",
          service: proc.service || void 0,
          type: proc.type || void 0
        }));
        return {
          success: true,
          mode: "files",
          kind: "file",
          method: "restart-manager",
          holders
        };
      }
      const skipped = Array.isArray(data.skipped_processes) ? data.skipped_processes : [];
      const timedOut = Array.isArray(data.timed_out_processes) ? data.timed_out_processes : [];
      let handles = Array.isArray(data.handles) ? data.handles : [];
      if (isDirectory) {
        const objectKind = mode === "handles" ? "directory" : "file";
        handles = handles.filter((h) => h.object === objectKind);
      }
      return {
        success: true,
        mode,
        kind: isDirectory ? "directory" : "file",
        method: "handle-scan",
        holders: groupHandles(handles),
        partial: skipped.length > 0 || timedOut.length > 0,
        skipped: skipped.length,
        timedOut: timedOut.length,
        examined: data.examined_handles || 0
      };
    },
    /**
     * 终止指定 PID 进程
     */
    async killProcess(pid) {
      if (!Number.isInteger(pid) || pid <= 0) {
        return { success: false, error: "\u65E0\u6548\u7684 PID" };
      }
      const res = await executeTaskkill(pid, true);
      if (res.exitCode === 0) {
        return { success: true };
      }
      return { success: false, error: res.stderr || res.error || "Kill \u5931\u8D25" };
    }
  };

  // src-compat/index.ts
  function initCompatLayer() {
    if (typeof window === "undefined") return;
    const ztoolsBridge = createZtoolsBridge();
    window.ztools = ztoolsBridge;
    window.utools = ztoolsBridge;
    window.services = services;
    if (typeof window.addEventListener === "function") {
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            const activeEl = document?.activeElement;
            if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") && activeEl.value) {
              return;
            }
            const modal = typeof document?.querySelector === "function" && document.querySelector(".pm-modal-overlay");
            if (modal) {
              return;
            }
            event.preventDefault();
            ztoolsBridge.outPlugin();
          }
        },
        true
      );
    }
    console.log("\u2705 [@ruck-plugins/process-manager] Compat layer successfully initialized");
  }
  initCompatLayer();
})();
