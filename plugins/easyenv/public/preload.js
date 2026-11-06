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
          const raw = window.localStorage.getItem(`easyenv_db_${key}`);
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
          window.localStorage.setItem(`easyenv_db_${key}`, serialized);
        } catch (e) {
          console.warn("[ztools] dbStorage setItem error:", e);
        }
      },
      removeItem(key) {
        try {
          window.localStorage.removeItem(`easyenv_db_${key}`);
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

  // src-compat/executor.ts
  function getRuck2() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
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

  // src-compat/services.ts
  var SHARED_DIR = "C:\\ProgramData\\easyenv";
  var SNAPSHOT_KEY = "easyenv_snapshots";
  var PRESET_KEY = "easyenv_presets";
  var MAX_SNAPSHOTS = 20;
  var SCOPES = {
    user: { hive: "CurrentUser", sub: "Environment" },
    machine: {
      hive: "LocalMachine",
      sub: "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
    }
  };
  var adminCache = null;
  async function isAdmin() {
    if (adminCache !== null) return adminCache;
    const script = "$r = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)\n$result = @{ isAdmin = $r }";
    const r = await runPSJson(script, 2e4);
    adminCache = !!(r.ok && r.data && r.data.isAdmin);
    return adminCache;
  }
  async function readScope(scope) {
    const s = SCOPES[scope];
    if (!s) return { ok: false, error: "\u672A\u77E5\u4F5C\u7528\u57DF\uFF1A" + scope, vars: [] };
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$result = @{ error = ''; vars = @() }",
      "try {",
      "  $key = [Microsoft.Win32.Registry]::" + s.hive + ".OpenSubKey(" + psq(s.sub) + ")",
      '  if ($key -eq $null) { throw "\u6CE8\u518C\u8868\u952E\u4E0D\u5B58\u5728\uFF1A" + ' + psq(s.sub) + " }",
      "  $list = New-Object System.Collections.ArrayList",
      "  foreach ($n in $key.GetValueNames()) {",
      "    $kind = $key.GetValueKind($n).ToString()",
      "    $raw = $key.GetValue($n, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)",
      "    $val = ''",
      `    if ($kind -eq 'MultiString') { $val = (@($raw) -join "\`n") } else { $val = [string]$raw }`,
      "    [void]$list.Add(@{ name = [string]$n; kind = $kind; value = $val })",
      "  }",
      "  $key.Close()",
      "  $result.vars = @($list)",
      "} catch { $result.error = $_.Exception.Message }"
    ].join("\n");
    const r = await runPSJson(script, 3e4);
    if (!r.ok) return { ok: false, error: r.error, vars: [] };
    let vars = r.data && r.data.vars || [];
    if (!Array.isArray(vars)) vars = [vars];
    const error = r.data && r.data.error || "";
    return { ok: !error, error, vars: vars.map((v) => ({ name: v.name, kind: v.kind, value: v.value })) };
  }
  async function listEnv(scope) {
    return readScope(scope);
  }
  function buildOpsScript(scope, opsJsonLiteral) {
    const s = SCOPES[scope];
    return [
      "$ErrorActionPreference = 'Stop'",
      "$result = @{ ok = $false; error = ''; applied = 0; failed = @() }",
      "try {",
      "  $ops = @(ConvertFrom-Json " + psq(opsJsonLiteral) + ")",
      "  $key = [Microsoft.Win32.Registry]::" + s.hive + ".OpenSubKey(" + psq(s.sub) + ", $true)",
      "  if ($key -eq $null) { throw '\u65E0\u6CD5\u4EE5\u5199\u6743\u9650\u6253\u5F00\u6CE8\u518C\u8868\u952E\uFF08\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650\uFF09' }",
      "  foreach ($o in $ops) {",
      "    $n = [string]$o.name",
      "    try {",
      "      if ($o.op -eq 'delete') {",
      "        $key.DeleteValue($n, $false)",
      "      } else {",
      "        $v = ''",
      "        if ($o.value -ne $null) { $v = [string]$o.value }",
      "        $k = [string]$o.kind",
      "        switch ($k) {",
      "          'ExpandString' { $key.SetValue($n, $v, [Microsoft.Win32.RegistryValueKind]::ExpandString) }",
      "          'DWord'        { $key.SetValue($n, [int]$v, [Microsoft.Win32.RegistryValueKind]::DWord) }",
      "          'QWord'        { $key.SetValue($n, [long]$v, [Microsoft.Win32.RegistryValueKind]::QWord) }",
      "          'MultiString'  { $key.SetValue($n, [string[]]($v -split \"`r?`n\"), [Microsoft.Win32.RegistryValueKind]::MultiString) }",
      "          default        { $key.SetValue($n, $v, [Microsoft.Win32.RegistryValueKind]::String) }",
      "        }",
      "      }",
      "      $result.applied = $result.applied + 1",
      '    } catch { $result.failed += ($n + ": " + $_.Exception.Message) }',
      "  }",
      "  $key.Close()",
      "  if (@($result.failed).Count -eq 0) { $result.ok = $true }",
      '  else { $result.error = (@($result.failed) -join "; ") }',
      "} catch { $result.error = $_.Exception.Message }"
    ].join("\n");
  }
  async function broadcastEnvChange() {
    const script = [
      "$src = @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class EnvBroadcast {",
      '  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]',
      "  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);",
      "}",
      "'@",
      "try {",
      "  Add-Type -TypeDefinition $src",
      "  $ptr = [UIntPtr]::Zero",
      '  [EnvBroadcast]::SendMessageTimeout([IntPtr]0xFFFF, 0x001A, [UIntPtr]::Zero, "Environment", 2, 5000, [ref]$ptr) | Out-Null',
      "$result = @{ ok = $true; error = '' }",
      "} catch { $result = @{ ok = $false; error = $_.Exception.Message } }"
    ].join("\n");
    const r = await runPSJson(script, 3e4);
    return r.ok && r.data ? r.data : { ok: false, error: r.error };
  }
  async function applyOps(scope, ops) {
    if (!Array.isArray(ops) || ops.length === 0) return { ok: true, error: "", applied: 0 };
    const elevated = scope === "machine";
    const admin = await isAdmin();
    const opsJson = JSON.stringify(ops);
    let r;
    if (!elevated || admin) {
      const script = buildOpsScript(scope, opsJson);
      r = await runPSJson(script, 12e4);
    } else {
      const filePrefix = "easyenv-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const outFile = `${SHARED_DIR}\\${filePrefix}-result.json`;
      const OUT = psq(outFile);
      const innerScript = buildOpsScript(scope, opsJson) + "\n[IO.File]::WriteAllText(" + OUT + ", ($result | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8)";
      const innerB64 = b64Utf16Le(innerScript);
      const outerScript = [
        "try {",
        "  New-Item -ItemType Directory -Force -Path " + psq(SHARED_DIR) + " | Out-Null",
        "  $p = Start-Process powershell.exe -Verb RunAs -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','" + innerB64 + "')",
        "  $sw = [Diagnostics.Stopwatch]::StartNew()",
        "  while (-not (Test-Path " + OUT + ") -and $sw.Elapsed.TotalSeconds -lt 120) { Start-Sleep -Milliseconds 400 }",
        "  if (-not (Test-Path " + OUT + ")) {",
        "    $alive = '?'",
        "    try { $alive = (-not $p.HasExited) } catch {}",
        "    $result = @{ ok = $false; error = ('\u7B49\u5F85\u63D0\u6743\u7ED3\u679C\u8D85\u65F6\uFF1APID=' + $p.Id + ' HasExited=' + $alive + '\u3002\u82E5\u672A\u770B\u5230 UAC \u5F39\u7A97\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u88AB\u906E\u6321'); applied = 0 }",
        "  } else {",
        "    $raw = [IO.File]::ReadAllText(" + OUT + ", [Text.Encoding]::UTF8)",
        "    $result = ConvertFrom-Json $raw",
        "  }",
        "} catch {",
        "  $msg = $_.Exception.Message",
        "  if ($msg -match 'cancel') { $msg = 'UAC \u786E\u8BA4\u88AB\u53D6\u6D88' }",
        "  $result = @{ ok = $false; error = $msg; applied = 0 }",
        "} finally {",
        "  Remove-Item -Force -Path " + OUT + " -ErrorAction SilentlyContinue",
        "}"
      ].join("\n");
      r = await runPSJson(outerScript, 18e4);
    }
    if (!r.ok || !r.data) {
      return { ok: false, error: r.error || "\u5199\u5165\u5931\u8D25", applied: 0 };
    }
    const result = r.data;
    if (result.ok) {
      await broadcastEnvChange();
    }
    return { ok: !!result.ok, error: result.error || "", applied: result.applied || 0 };
  }
  function readSnapshots() {
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function writeSnapshots(list) {
    try {
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }
  function normalizeChange(c) {
    return {
      scope: c.scope === "machine" ? "machine" : "user",
      name: String(c.name || ""),
      before: String(c.before == null ? "" : c.before),
      after: String(c.after == null ? "" : c.after),
      existed: !!c.existed,
      kindBefore: String(c.kindBefore || "String"),
      kindAfter: String(c.kindAfter || "String")
    };
  }
  async function takeSnapshot(reason, changes) {
    let snap;
    if (Array.isArray(changes) && changes.length) {
      snap = {
        id: "snap-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        ts: Date.now(),
        reason: reason || "\u4FEE\u6539\u524D\u81EA\u52A8\u5FEB\u7167",
        kind: "diff",
        changes: changes.map(normalizeChange)
      };
    } else {
      const [u, m] = await Promise.all([readScope("user"), readScope("machine")]);
      if (!u.ok && !m.ok) return { ok: false, error: u.error || m.error || "\u8BFB\u53D6\u5931\u8D25" };
      snap = {
        id: "snap-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        ts: Date.now(),
        reason: reason || "\u624B\u52A8\u5FEB\u7167",
        kind: "full",
        user: u.vars || [],
        machine: m.vars || []
      };
    }
    const list = readSnapshots();
    list.unshift(snap);
    writeSnapshots(list.slice(0, MAX_SNAPSHOTS));
    return { ok: true, snapshot: snap };
  }
  function listSnapshots() {
    return { ok: true, snapshots: readSnapshots() };
  }
  function deleteSnapshot(id) {
    const list = readSnapshots().filter((s) => s.id !== id);
    writeSnapshots(list);
    return { ok: true };
  }
  function buildRestoreOps(current, target) {
    const curMap = /* @__PURE__ */ new Map();
    for (const v of current) curMap.set(v.name.toUpperCase(), v);
    const tgtMap = /* @__PURE__ */ new Map();
    for (const v of target) tgtMap.set(v.name.toUpperCase(), v);
    const ops = [];
    for (const v of target) {
      const cur = curMap.get(v.name.toUpperCase());
      if (!cur || cur.value !== v.value || cur.kind !== v.kind) {
        ops.push({ op: "set", name: v.name, value: v.value, kind: v.kind });
      }
    }
    for (const v of current) {
      if (!tgtMap.has(v.name.toUpperCase())) ops.push({ op: "delete", name: v.name });
    }
    return ops;
  }
  async function restoreSnapshot(id) {
    const snap = readSnapshots().find((s) => s.id === id);
    if (!snap) return { ok: false, error: "\u5FEB\u7167\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\uFF09" };
    if (Array.isArray(snap.changes)) {
      const [u2, m2] = await Promise.all([readScope("user"), readScope("machine")]);
      if (!u2.ok) return { ok: false, error: "\u8BFB\u53D6\u7528\u6237\u53D8\u91CF\u5931\u8D25\uFF1A" + u2.error };
      if (!m2.ok) return { ok: false, error: "\u8BFB\u53D6\u7CFB\u7EDF\u53D8\u91CF\u5931\u8D25\uFF1A" + m2.error };
      const current = { user: u2.vars, machine: m2.vars };
      const findVar = (scope, name) => {
        const upper = String(name).toUpperCase();
        return (current[scope] || []).find((v) => v.name.toUpperCase() === upper);
      };
      const reverse = snap.changes.map((c) => {
        const cur = findVar(c.scope, c.name);
        return {
          scope: c.scope,
          name: c.name,
          before: cur ? cur.value : "",
          after: c.before,
          existed: !!cur,
          kindBefore: cur ? cur.kind : "String",
          kindAfter: c.kindBefore
        };
      });
      if (reverse.length) await takeSnapshot("\u56DE\u6EDA\u524D\u81EA\u52A8\u5FEB\u7167", reverse);
      const byScope = { user: [], machine: [] };
      for (const c of snap.changes) {
        if (c.existed) {
          byScope[c.scope].push({ op: "set", name: c.name, value: c.before, kind: c.kindBefore || "String" });
        } else {
          byScope[c.scope].push({ op: "delete", name: c.name });
        }
      }
      let userChanges = 0;
      let machineChanges = 0;
      if (byScope.user.length) {
        const r = await applyOps("user", byScope.user);
        if (!r.ok) return { ok: false, error: "\u6062\u590D\u7528\u6237\u53D8\u91CF\u5931\u8D25\uFF1A" + r.error };
        userChanges = byScope.user.length;
      }
      if (byScope.machine.length) {
        const r = await applyOps("machine", byScope.machine);
        if (!r.ok) return { ok: false, error: "\u6062\u590D\u7CFB\u7EDF\u53D8\u91CF\u5931\u8D25\uFF1A" + r.error };
        machineChanges = byScope.machine.length;
      }
      return { ok: true, userChanges, machineChanges };
    }
    await takeSnapshot("\u56DE\u6EDA\u524D\u81EA\u52A8\u5FEB\u7167");
    const [u, m] = await Promise.all([readScope("user"), readScope("machine")]);
    if (!u.ok) return { ok: false, error: "\u8BFB\u53D6\u7528\u6237\u53D8\u91CF\u5931\u8D25\uFF1A" + u.error };
    if (!m.ok) return { ok: false, error: "\u8BFB\u53D6\u7CFB\u7EDF\u53D8\u91CF\u5931\u8D25\uFF1A" + m.error };
    const userOps = buildRestoreOps(u.vars, snap.user || []);
    const machineOps = buildRestoreOps(m.vars, snap.machine || []);
    if (userOps.length) {
      const r = await applyOps("user", userOps);
      if (!r.ok) return { ok: false, error: "\u6062\u590D\u7528\u6237\u53D8\u91CF\u5931\u8D25\uFF1A" + r.error };
    }
    if (machineOps.length) {
      const r = await applyOps("machine", machineOps);
      if (!r.ok) return { ok: false, error: "\u6062\u590D\u7CFB\u7EDF\u53D8\u91CF\u5931\u8D25\uFF1A" + r.error };
    }
    return { ok: true, userChanges: userOps.length, machineChanges: machineOps.length };
  }
  function exportSnapshot(id) {
    const snap = readSnapshots().find((s) => s.id === id);
    if (!snap) return { ok: false, error: "\u5FEB\u7167\u4E0D\u5B58\u5728" };
    try {
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `easyenv-snapshot-${stamp}.json`;
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { ok: true, path: fileName };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
  function importSnapshot() {
    return new Promise((resolve) => {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.style.display = "none";
        let hasHandled = false;
        const finish = (result) => {
          if (hasHandled) return;
          hasHandled = true;
          if (input.parentNode) input.parentNode.removeChild(input);
          resolve(result);
        };
        input.onchange = (e) => {
          const file = e.target?.files?.[0];
          if (!file) {
            finish({ ok: false, error: "\u5DF2\u53D6\u6D88" });
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result);
              const isDiff = Array.isArray(data && data.changes) && data.changes.length > 0;
              const isFull = Array.isArray(data && data.user) && Array.isArray(data && data.machine);
              if (!isDiff && !isFull) {
                finish({ ok: false, error: "\u4E0D\u662F\u6709\u6548\u7684 easyenv \u5FEB\u7167\u6587\u4EF6" });
                return;
              }
              const base = {
                id: "snap-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                ts: data.ts || Date.now(),
                reason: (data.reason || "\u5BFC\u5165\u5FEB\u7167") + "\uFF08\u5BFC\u5165\uFF09"
              };
              const snap = isDiff ? Object.assign(base, { kind: "diff", changes: data.changes.map(normalizeChange) }) : Object.assign(base, { kind: "full", user: data.user, machine: data.machine });
              const list = readSnapshots();
              list.unshift(snap);
              writeSnapshots(list.slice(0, MAX_SNAPSHOTS));
              finish({ ok: true, snapshot: snap });
            } catch (err) {
              finish({ ok: false, error: "\u89E3\u6790\u5FEB\u7167 JSON \u5931\u8D25: " + (err?.message || err) });
            }
          };
          reader.onerror = () => {
            finish({ ok: false, error: "\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25" });
          };
          reader.readAsText(file, "utf8");
        };
        document.body.appendChild(input);
        input.click();
        setTimeout(() => {
          if (!hasHandled) finish({ ok: false, error: "\u5DF2\u53D6\u6D88" });
        }, 3e4);
      } catch (e) {
        resolve({ ok: false, error: e?.message || String(e) });
      }
    });
  }
  function expandValue(value, upperMap, depth = 0) {
    if (depth > 8) return String(value);
    return String(value).replace(/%([^%]+)%/g, (m, name) => {
      const hit = upperMap[String(name).toUpperCase()];
      if (hit == null) return m;
      return expandValue(hit, upperMap, depth + 1);
    });
  }
  function buildUpperEnvMap(envMap) {
    const upperMap = {};
    if (envMap) {
      for (const k of Object.keys(envMap)) {
        upperMap[k.toUpperCase()] = envMap[k];
      }
    }
    return upperMap;
  }
  function expandEnvValue(value, envMap) {
    return expandValue(String(value == null ? "" : value), buildUpperEnvMap(envMap), 0);
  }
  var pathExistsCache = /* @__PURE__ */ new Map();
  function checkPaths(entries, envMap) {
    const upperMap = buildUpperEnvMap(envMap);
    const uncached = [];
    const results = (entries || []).map((raw) => {
      const text = String(raw == null ? "" : raw);
      const clean = text.trim().replace(/^"(.*)"$/, "$1");
      const expanded = expandValue(clean, upperMap, 0);
      let exists = true;
      if (clean) {
        if (pathExistsCache.has(expanded)) {
          exists = pathExistsCache.get(expanded);
        } else {
          uncached.push(expanded);
        }
      }
      return { raw: text, expanded, exists };
    });
    if (uncached.length > 0) {
      checkPathsBatchAsync(uncached).catch(() => {
      });
    }
    return results;
  }
  async function checkPathsBatchAsync(paths) {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    if (!unique.length) return;
    const script = [
      "$paths = @(" + unique.map(psq).join(",") + ")",
      "$res = @{}",
      "foreach ($p in $paths) {",
      "  try {",
      "    $res[$p] = [bool](Test-Path -LiteralPath $p)",
      "  } catch {",
      "    $res[$p] = $false",
      "  }",
      "}",
      "$result = $res"
    ].join("\n");
    const r = await runPSJson(script, 15e3);
    if (r.ok && r.data) {
      for (const [p, exists] of Object.entries(r.data)) {
        pathExistsCache.set(p, Boolean(exists));
      }
    }
  }
  async function openPath(target, envMap) {
    const raw = String(target == null ? "" : target).trim().replace(/^"(.*)"$/, "$1");
    if (!raw) return { ok: false, error: "\u8DEF\u5F84\u4E3A\u7A7A" };
    if (raw.includes(";")) return { ok: false, error: "\u8FD9\u4E0D\u662F\u5355\u6761\u8DEF\u5F84\uFF08\u542B\u5206\u53F7\uFF09\uFF0C\u8BF7\u5230 PATH \u7F16\u8F91\u5668\u91CC\u9010\u6761\u6253\u5F00" };
    const resolved = expandEnvValue(raw, envMap);
    try {
      const checkScript = `$p = ${psq(resolved)}
if (Test-Path -LiteralPath $p) {
  $isDir = [bool](Test-Path -LiteralPath $p -PathType Container)
  $result = @{ ok = $true; isDir = $isDir }
} else {
  $result = @{ ok = $false; error = ('\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF1A' + $p) }
}`;
      const probe = await runPSJson(checkScript, 1e4);
      if (!probe.ok || !probe.data?.ok) {
        return { ok: false, error: probe.data?.error || probe.error || "\u8DEF\u5F84\u4E0D\u5B58\u5728" };
      }
      const isDir = Boolean(probe.data.isDir);
      const args = isDir ? [resolved] : ["/select," + resolved];
      await executeCommand("explorer.exe", args);
      return { ok: true, path: resolved, isDir };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
  function listPresets() {
    try {
      const raw = window.localStorage.getItem(PRESET_KEY);
      if (!raw) return { ok: true, presets: {} };
      const obj = JSON.parse(raw);
      return { ok: true, presets: obj && typeof obj === "object" ? obj : {} };
    } catch (e) {
      return { ok: true, presets: {} };
    }
  }
  function savePresets(presets) {
    try {
      const clean = {};
      const src = presets && typeof presets === "object" ? presets : {};
      for (const k of Object.keys(src)) {
        const arr = Array.isArray(src[k]) ? src[k] : [];
        const values = [];
        for (const v of arr) {
          const s = String(v == null ? "" : v).trim();
          if (s && !values.some((x) => x.toUpperCase() === s.toUpperCase())) values.push(s);
        }
        if (values.length) clean[k] = values;
      }
      window.localStorage.setItem(PRESET_KEY, JSON.stringify(clean));
      return { ok: true, presets: clean };
    } catch (e) {
      return { ok: false, error: e?.message || String(e), presets: {} };
    }
  }
  var services = {
    isAdmin,
    listEnv,
    applyOps,
    takeSnapshot,
    listSnapshots,
    deleteSnapshot,
    restoreSnapshot,
    exportSnapshot,
    importSnapshot,
    checkPaths,
    expandEnvValue,
    openPath,
    listPresets,
    savePresets
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
    console.log("\u2705 [@ruck-plugins/easyenv] Compat layer successfully initialized");
  }
  initCompatLayer();
})();
