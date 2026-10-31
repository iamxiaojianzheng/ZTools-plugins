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
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
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

  // src-compat/executor.ts
  var executor_exports = {};
  __export(executor_exports, {
    b64Utf16Le: () => b64Utf16Le,
    decodeBase64Utf8: () => decodeBase64Utf8,
    executeCommand: () => executeCommand,
    executePowerShell: () => executePowerShell,
    isRuckAvailable: () => isRuckAvailable,
    psq: () => psq,
    runPSJson: () => runPSJson
  });
  function getRuck2() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  function isRuckAvailable() {
    const ruck = getRuck2();
    return Boolean(ruck?.shell?.execute && typeof ruck.shell.execute === "function");
  }
  function b64Utf16Le(str) {
    const codeUnits = new Uint16Array(str.length);
    for (let i = 0; i < str.length; i++) {
      codeUnits[i] = str.charCodeAt(i);
    }
    const bytes = new Uint8Array(codeUnits.buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  function decodeBase64Utf8(b64Str) {
    const cleanB64 = b64Str.trim().replace(/\s+/g, "");
    const binary = atob(cleanB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }
  function psq(s) {
    return "'" + String(s == null ? "" : s).replace(/'/g, "''") + "'";
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
              maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
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
  async function executePowerShell(script, timeout = 6e4) {
    return executeCommand(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", b64Utf16Le(script)],
      { timeout }
    );
  }
  async function runPSJson(script, timeout = 6e4) {
    const full = script + '\n$__j = ($result | ConvertTo-Json -Depth 6 -Compress)\n$__b = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($__j))\nWrite-Output ("B64_RESULT::" + $__b + "::B64_END")';
    const r = await executePowerShell(full, timeout);
    if (!r.stdout) {
      return { ok: false, error: (r.error || r.stderr || "PowerShell \u6267\u884C\u672A\u8FD4\u56DE\u8F93\u51FA").slice(0, 300) };
    }
    const match = /B64_RESULT::([A-Za-z0-9+/=]+)::B64_END/.exec(r.stdout);
    if (!match) {
      return { ok: false, error: (r.error || r.stderr || r.stdout || "PowerShell \u7ED3\u679C\u89E3\u6790\u5931\u8D25").slice(0, 300) };
    }
    try {
      const jsonStr = decodeBase64Utf8(match[1]);
      const data = JSON.parse(jsonStr);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: "JSON \u89E3\u7801\u89E3\u6790\u5931\u8D25: " + (e?.message || e) };
    }
  }
  var init_executor = __esm({
    "src-compat/executor.ts"() {
    }
  });

  // src-compat/ztools.ts
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var KNOWN_CODES = ["main"];
  function normalizeAction(action) {
    const normalized = { ...action || {} };
    if (!normalized.code || normalized.code === "default" || !KNOWN_CODES.includes(normalized.code)) {
      normalized.code = "main";
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
    const dbStorageShim = {
      getItem(key) {
        try {
          const raw = window.localStorage.getItem(`easynssm_db_${key}`);
          if (raw === null) return null;
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        } catch {
          return null;
        }
      },
      setItem(key, value) {
        try {
          const serialized = typeof value === "string" ? value : JSON.stringify(value);
          window.localStorage.setItem(`easynssm_db_${key}`, serialized);
        } catch (e) {
          console.warn("[ztools] dbStorage setItem error:", e);
        }
      },
      removeItem(key) {
        try {
          window.localStorage.removeItem(`easynssm_db_${key}`);
        } catch (e) {
          console.warn("[ztools] dbStorage removeItem error:", e);
        }
      }
    };
    const bridge = {
      isRuck: true,
      dbStorage: dbStorageShim,
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
        return false;
      },
      /**
       * 窗口高度调整
       */
      setExpendHeight(height = 640) {
        const ruck = getRuck();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      setExpandHeight(height = 640) {
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
      shellOpenExternal(url) {
        const ruck = getRuck();
        if (ruck?.shell?.openExternal && typeof ruck.shell.openExternal === "function") {
          ruck.shell.openExternal(url);
        } else if (ruck?.openExternal && typeof ruck.openExternal === "function") {
          ruck.openExternal(url);
        } else if (typeof window !== "undefined") {
          window.open(url, "_blank");
        }
      },
      /**
       * 文件/目录选择框（适配 Ruck 宿主对话框）
       */
      async showOpenDialog(options = {}) {
        const ruck = getRuck();
        const isDir = Boolean(
          options.directory || Array.isArray(options.properties) && (options.properties.includes("openDirectory") || options.properties.includes("directory"))
        );
        if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
          try {
            const res = await ruck.window.showOpenDialog({
              title: options.title,
              directory: isDir,
              multiple: Boolean(options.properties?.includes("multiSelections")),
              filters: options.filters
            });
            if (Array.isArray(res)) return res;
            if (typeof res === "string" && res) return [res];
            return [];
          } catch (e) {
            console.warn("[ztools] ruck.window.showOpenDialog error:", e);
          }
        }
        if (ruck?.showOpenDialog && typeof ruck.showOpenDialog === "function") {
          try {
            const res = await ruck.showOpenDialog({
              title: options.title,
              directory: isDir,
              multiple: Boolean(options.properties?.includes("multiSelections")),
              filters: options.filters
            });
            if (Array.isArray(res)) return res;
            if (typeof res === "string" && res) return [res];
            return [];
          } catch (e) {
            console.warn("[ztools] ruck.showOpenDialog error:", e);
          }
        }
        return [];
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
              dispatchEnter({ code: "main", type: "text", payload: "" });
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

  // src-compat/services.ts
  init_executor();
  var NSSM_PATH_KEY = "easynssm_nssm_path";
  var NSSM_PARAM_KEYS = [
    "AppDirectory",
    "AppApplication",
    "AppParameters",
    "AppStdout",
    "AppStderr",
    "AppRotateFiles",
    "AppRotateOnline",
    "AppRotateBytes",
    "AppRotateSeconds",
    "AppExit",
    "AppRestartDelay",
    "AppThrottle",
    "AppPriority",
    "AppStopMethodSkip",
    "AppStopMethodConsole",
    "AppEnvironment"
  ];
  var START_TYPE_SC = {
    auto: "auto",
    delayed: "delayed-auto",
    manual: "demand",
    disabled: "disabled"
  };
  async function isAdmin() {
    const script = "$r = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)\n$result = @{ isAdmin = $r }";
    const r = await runPSJson(script, 2e4);
    return !!(r.ok && r.data && r.data.isAdmin);
  }
  async function listServices() {
    const script = "$ErrorActionPreference = 'Stop'\ntry {\n  $list = Get-CimInstance Win32_Service | Select-Object Name,DisplayName,State,StartMode,PathName,StartName,Description,ProcessId,ExitCode\n  $result = @{ error = ''; services = @($list) }\n} catch { $result = @{ error = $_.Exception.Message; services = @() } }";
    const r = await runPSJson(script, 9e4);
    if (!r.ok) {
      return { ok: false, services: [], error: r.error || "\u83B7\u53D6\u670D\u52A1\u5217\u8868\u5931\u8D25" };
    }
    let svcs = r.data && r.data.services || [];
    if (!Array.isArray(svcs)) svcs = [svcs];
    return { ok: true, services: svcs, error: r.data && r.data.error || "" };
  }
  function getNssmPath() {
    try {
      const bridge = window.ztools;
      const v = bridge?.dbStorage?.getItem(NSSM_PATH_KEY);
      return v && String(v) || "";
    } catch (e) {
      return "";
    }
  }
  async function probeNssm(p) {
    if (!p) return "";
    try {
      const res = await executeCommand(p, ["version"], { timeout: 8e3 });
      const text = (res.stdout || "") + (res.stderr || "");
      if (/nssm\s+\d/i.test(text)) {
        return text.trim().split(/\r?\n/)[0];
      }
    } catch (e) {
    }
    try {
      const script = `$p = ${psq(p)}
if (Test-Path -LiteralPath $p) {
  $out = (& $p version) 2>&1 | Out-String
  $result = @{ text = ("" + $out).Trim() }
} else {
  $result = @{ text = '' }
}`;
      const r = await runPSJson(script, 1e4);
      const text = r.ok && r.data && r.data.text || "";
      if (/nssm\s+\d/i.test(text)) {
        return text.split(/\r?\n/)[0];
      }
    } catch (e) {
    }
    return "";
  }
  async function detectNssm() {
    const candidates = [];
    const saved = getNssmPath();
    if (saved) candidates.push(saved);
    try {
      const whereRes = await executeCommand("where.exe", ["nssm.exe"], { timeout: 8e3 });
      if (whereRes.stdout) {
        const line = whereRes.stdout.split(/\r?\n/)[0].trim();
        if (line) candidates.push(line);
      }
    } catch (e) {
    }
    try {
      const svcList = await listServices();
      if (svcList.ok) {
        for (const s of svcList.services) {
          const pn = String(s && s.PathName || "");
          if (!/nssm\.exe/i.test(pn)) continue;
          const m = /^"([^"]+nssm\.exe)"/i.exec(pn) || /^([^\s"]+nssm\.exe)/i.exec(pn);
          if (m) candidates.push(m[1]);
        }
      }
    } catch (e) {
    }
    candidates.push(
      "C:\\nssm\\nssm.exe",
      "C:\\nssm.exe",
      "C:\\Program Files\\nssm\\win64\\nssm.exe",
      "C:\\Program Files (x86)\\nssm\\win32\\nssm.exe",
      "C:\\ProgramData\\chocolatey\\bin\\nssm.exe"
    );
    const unique = Array.from(new Set(candidates));
    for (const c of unique) {
      const version = await probeNssm(c);
      if (version) {
        return { found: true, path: c, version };
      }
    }
    return { found: false, path: "", version: "" };
  }
  async function saveNssmPath(p) {
    const version = await probeNssm(p);
    if (!version) {
      return { ok: false, message: "\u8BE5\u8DEF\u5F84\u4E0D\u662F\u53EF\u7528\u7684 nssm.exe\uFF08version \u547D\u4EE4\u65E0\u54CD\u5E94\uFF09" };
    }
    try {
      const bridge = window.ztools;
      bridge?.dbStorage?.setItem(NSSM_PATH_KEY, String(p));
    } catch (e) {
      return { ok: false, message: "\u4FDD\u5B58\u5931\u8D25\uFF1A" + (e?.message || e) };
    }
    return { ok: true, message: "\u5DF2\u4FDD\u5B58\uFF1A" + version };
  }
  async function getNssmConfig(name) {
    const keys = NSSM_PARAM_KEYS.map(psq).join(",");
    const script = `$svc = ${psq(name)}
try {
  $p = Get-ItemProperty -Path ("HKLM:\\SYSTEM\\CurrentControlSet\\Services\\" + $svc + "\\Parameters") -ErrorAction Stop
  $c = @{}
  foreach ($k in @(` + keys + ")) {\n    if ($p.PSObject.Properties.Name -contains $k) { $c[$k] = $p.$k }\n  }\n  $result = @{ error = ''; config = $c }\n} catch { $result = @{ error = $_.Exception.Message; config = @{} } }";
    const r = await runPSJson(script, 3e4);
    if (!r.ok) return { ok: false, config: {}, error: r.error };
    const cfg = r.data && r.data.config || {};
    if (cfg.AppEnvironment != null && !Array.isArray(cfg.AppEnvironment)) {
      cfg.AppEnvironment = [cfg.AppEnvironment];
    }
    return { ok: true, config: cfg, error: r.data && r.data.error || "" };
  }
  async function runCommands(ops, timeout = 3e5) {
    const admin = await isAdmin();
    const SHARED_DIR = "C:\\ProgramData\\easynssm";
    const filePrefix = "easynssm-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const opsFile = `${SHARED_DIR}\\${filePrefix}-ops.json`;
    const outFile = `${SHARED_DIR}\\${filePrefix}-result.json`;
    const innerScript = "$ErrorActionPreference = 'Continue'\ntry {\n  New-Item -ItemType Directory -Force -Path " + psq(SHARED_DIR) + " | Out-Null\n  $ops = ConvertFrom-Json ([IO.File]::ReadAllText(" + psq(opsFile) + `))
  $results = New-Object System.Collections.ArrayList
  $fail = 0
  $lastErr = ''
  foreach ($op in $ops) {
    $o = ''
    $c = 0
    try {
      $o = (Invoke-Expression $op) 2>&1 | Out-String
      if ($LASTEXITCODE -ne $null) { $c = $LASTEXITCODE }
    } catch {
      $o = $_.Exception.Message
      $c = -1
    }
    if ($c -ne 0) { $fail = 1; $lastErr = $o }
    [void]$results.Add(@{ op = $op; code = $c; output = ("" + $o).Trim() })
  }
  $result = @{ exitCode = $fail; message = $lastErr; output = $results }
} catch {
  $result = @{ exitCode = -5; message = ("\u63D0\u6743\u811A\u672C\u5F02\u5E38: " + $_.Exception.Message); output = @() }
}
[IO.File]::WriteAllText(` + psq(outFile) + ", ($result | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8)";
    let executionScript = "";
    if (admin) {
      const opsJson = JSON.stringify(ops);
      executionScript = "New-Item -ItemType Directory -Force -Path " + psq(SHARED_DIR) + " | Out-Null\n[IO.File]::WriteAllText(" + psq(opsFile) + ", " + psq(opsJson) + ", [Text.Encoding]::UTF8)\n" + innerScript + "\nif (Test-Path " + psq(outFile) + ") {\n  $data = [IO.File]::ReadAllText(" + psq(outFile) + ", [Text.Encoding]::UTF8)\n  $result = ConvertFrom-Json $data\n} else {\n  $result = @{ exitCode = -99; message = '\u672A\u751F\u6210\u6267\u884C\u7ED3\u679C\u6587\u4EF6'; output = @() }\n}\nRemove-Item -Force -Path " + psq(opsFile) + " -ErrorAction SilentlyContinue\nRemove-Item -Force -Path " + psq(outFile) + " -ErrorAction SilentlyContinue";
    } else {
      const opsJson = JSON.stringify(ops);
      const { b64Utf16Le: b64Utf16Le2 } = await Promise.resolve().then(() => (init_executor(), executor_exports));
      const innerB64 = b64Utf16Le2(innerScript);
      executionScript = "New-Item -ItemType Directory -Force -Path " + psq(SHARED_DIR) + " | Out-Null\n[IO.File]::WriteAllText(" + psq(opsFile) + ", " + psq(opsJson) + ", [Text.Encoding]::UTF8)\ntry {\n  $p = Start-Process powershell.exe -Verb RunAs -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','" + innerB64 + "')\n  $sw = [Diagnostics.Stopwatch]::StartNew()\n  while (-not (Test-Path " + psq(outFile) + ") -and $sw.Elapsed.TotalSeconds -lt 120) { Start-Sleep -Milliseconds 500 }\n  if (-not (Test-Path " + psq(outFile) + ")) {\n    $alive = '?'\n    try { $alive = (-not $p.HasExited) } catch {}\n    $result = @{ exitCode = 2; message = ('\u7B49\u5F85\u63D0\u6743\u7ED3\u679C\u8D85\u65F6\uFF1APID=' + $p.Id + ' HasExited=' + $alive + '\u3002\u82E5\u65E0 UAC \u5F39\u7A97\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u88AB\u906E\u6321'); output = @() }\n  } else {\n    $data = [IO.File]::ReadAllText(" + psq(outFile) + ", [Text.Encoding]::UTF8)\n    $result = ConvertFrom-Json $data\n  }\n} catch {\n  $msg = $_.Exception.Message\n  if ($msg -match 'cancel') { $msg = 'UAC \u786E\u8BA4\u88AB\u53D6\u6D88' }\n  $result = @{ exitCode = 3; message = $msg; output = @() }\n}\nRemove-Item -Force -Path " + psq(opsFile) + " -ErrorAction SilentlyContinue\nRemove-Item -Force -Path " + psq(outFile) + " -ErrorAction SilentlyContinue";
    }
    const r = await runPSJson(executionScript, timeout);
    if (!r.ok || !r.data) {
      return { exitCode: -99, message: r.error || "\u6267\u884C\u63D0\u6743\u547D\u4EE4\u672A\u8FD4\u56DE\u6709\u6548\u7ED3\u679C", output: [] };
    }
    return r.data;
  }
  function buildNssmOps(payload) {
    const nssm = psq(payload.nssmPath);
    const name = payload.name;
    const ops = [];
    const set = function(...args) {
      const quoted = args.map(psq);
      ops.push("& " + nssm + " set " + psq(name) + " " + quoted.join(" "));
    };
    if (payload.mode === "install") {
      const installArgs = ["install", name, payload.application];
      if (payload.parameters) installArgs.push(payload.parameters);
      ops.push("& " + nssm + " " + installArgs.map(psq).join(" "));
    } else {
      if (payload.application) set("AppApplication", payload.application);
      if (payload.parameters) set("AppParameters", payload.parameters);
    }
    if (payload.appDirectory) set("AppDirectory", payload.appDirectory);
    if (payload.stdout) set("AppStdout", payload.stdout);
    if (payload.stderr) set("AppStderr", payload.stderr);
    if (payload.rotate) {
      set("AppRotateFiles", "1");
      if (payload.rotateOnline) set("AppRotateOnline", "1");
      if (payload.rotateBytes) set("AppRotateBytes", String(payload.rotateBytes));
    }
    if (payload.exitCode !== "" && payload.exitCode != null && payload.exitAction) {
      set("AppExit", String(payload.exitCode), payload.exitAction);
    }
    if (payload.restartDelay !== "" && payload.restartDelay != null) {
      set("AppRestartDelay", String(payload.restartDelay));
    }
    if (payload.throttle) set("AppThrottle", String(payload.throttle));
    if (payload.priority) set("AppPriority", payload.priority);
    if (payload.stopSkip) set("AppStopMethodSkip", String(payload.stopSkip));
    if (payload.environment && payload.environment.length) {
      ops.push("& " + nssm + " set " + psq(name) + " AppEnvironment " + payload.environment.map(psq).join(" "));
    }
    if (payload.startType && START_TYPE_SC[payload.startType]) {
      ops.push("& sc.exe config " + psq(name) + " start= " + START_TYPE_SC[payload.startType]);
    }
    return ops;
  }
  function buildRemoveOp(nssmPath, name) {
    return "& " + psq(nssmPath) + " remove " + psq(name) + " confirm";
  }
  function buildServiceActionOps(name, action) {
    const n = psq(name);
    if (action === "start") return ["& sc.exe start " + n];
    if (action === "stop") return ["& sc.exe stop " + n];
    if (action === "restart") {
      return [
        "& sc.exe stop " + n + " | Out-Null\n$d = (Get-Date).AddSeconds(20)\nwhile ((Get-Date) -lt $d) { $sv = Get-Service -Name " + n + " -ErrorAction SilentlyContinue; if ($sv -and $sv.Status -eq 'Stopped') { break }; Start-Sleep -Milliseconds 400 }\n& sc.exe start " + n
      ];
    }
    return [];
  }
  function buildStartTypeOp(name, startType) {
    const v = START_TYPE_SC[startType];
    if (!v) return [];
    return ["& sc.exe config " + psq(name) + " start= " + v];
  }
  async function readLogTail(p, maxLines = 200) {
    if (!p) {
      return { ok: false, error: "\u65E5\u5FD7\u6587\u4EF6\u672A\u914D\u7F6E" };
    }
    const script = `$p = ${psq(p)}
if (-not (Test-Path -LiteralPath $p)) {
  $result = @{ ok = $false; error = ('\u65E5\u5FD7\u6587\u4EF6\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u5C1A\u672A\u4EA7\u751F\u8F93\u51FA\uFF09\uFF1A' + $p); content = ''; truncated = $false }
} else {
  try {
    $lines = Get-Content -LiteralPath $p -Tail ${maxLines} -ErrorAction Stop
    $text = ($lines -join "\`r\`n")
    $result = @{ ok = $true; content = $text; truncated = $true; error = '' }
  } catch {
    $result = @{ ok = $false; error = ('\u8BFB\u53D6\u65E5\u5FD7\u5931\u8D25\uFF1A' + $_.Exception.Message); content = ''; truncated = $false }
  }
}`;
    const r = await runPSJson(script, 3e4);
    if (!r.ok || !r.data) {
      return { ok: false, error: r.error || "\u6267\u884C\u8BFB\u53D6\u65E5\u5FD7\u811A\u672C\u5931\u8D25" };
    }
    return r.data;
  }
  var services = {
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
            const modal = typeof document?.querySelector === "function" && document.querySelector('.el-overlay:not([style*="display: none"])');
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
    console.log("\u2705 [@ruck-plugins/easynssm] Compat layer successfully initialized");
  }
  initCompatLayer();
})();
