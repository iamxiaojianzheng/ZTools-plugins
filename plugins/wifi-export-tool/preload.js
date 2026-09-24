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

  // src-compat/wifi/strategies/base-strategy.js
  var BaseWifiStrategy = class {
    /**
     * 提取已保存的所有 WiFi 网络信息列表
     * @returns {Promise<Array<{ ssid: string, password?: string, securityType: string }>>}
     */
    async getWifiList() {
      throw new Error("Method getWifiList() must be implemented.");
    }
    /**
     * 按需获取指定 SSID 的密码明文
     * @param {string} ssid
     * @returns {Promise<string>}
     */
    async getWifiPassword(ssid) {
      throw new Error("Method getWifiPassword() must be implemented.");
    }
  };

  // src-compat/wifi/executor.js
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  async function executeCommand(program, args = [], options = {}) {
    const ruck = getRuck();
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
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const nodeChildProcess = (await import("node:child_process")).default || await import("node:child_process");
        const fullCmd = [program, ...args.map((a) => a.includes(" ") ? `"${a}"` : a)].join(" ");
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
    const errorMsg = `\u5F53\u524D\u8FD0\u884C\u73AF\u5883\u4E0D\u652F\u6301\u8C03\u7528\u7CFB\u7EDF\u5E95\u5C42\u547D\u4EE4 [${program}]\u3002\u8BF7\u5728 Ruck \u684C\u9762\u7AEF\u542F\u52A8\u5668\u4E2D\u8FD0\u884C\u6B64\u63D2\u4EF6\u3002`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // src-compat/wifi/strategies/windows-strategy.js
  var WindowsWifiStrategy = class extends BaseWifiStrategy {
    async getWifiList() {
      try {
        const profilesOutput = await executeCommand("netsh", ["wlan", "show", "profiles"]);
        const ssids = this.parseSsids(profilesOutput);
        const results = [];
        for (const ssid of ssids) {
          if (!ssid) continue;
          try {
            const profileOutput = await executeCommand("netsh", [
              "wlan",
              "show",
              "profile",
              `name=${ssid}`,
              "key=clear"
            ]);
            let password = "";
            let securityType = "\u5F00\u653E\u7F51\u7EDC";
            const pwdMatch = profileOutput.match(/(?:关键内容|Key Content|Key content)\s*:\s*(.*)/i);
            if (pwdMatch) {
              password = pwdMatch[1].trim();
            }
            const authMatch = profileOutput.match(/(?:身份验证|Authentication)\s*:\s*(.*)/i);
            if (authMatch) {
              securityType = authMatch[1].trim();
              if (securityType === "Open" || securityType.includes("\u5F00\u653E")) {
                securityType = "\u5F00\u653E\u7F51\u7EDC";
              }
            }
            results.push({
              ssid,
              password,
              securityType
            });
          } catch {
            results.push({
              ssid,
              password: "",
              securityType: "Unknown"
            });
          }
        }
        return results;
      } catch (err) {
        console.error("[WindowsWifiStrategy] \u8BFB\u53D6 WiFi \u5931\u8D25:", err);
        throw new Error(`Windows WiFi \u63D0\u53D6\u5931\u8D25: ${err.message || err}`);
      }
    }
    async getWifiPassword(ssid) {
      try {
        const profileOutput = await executeCommand("netsh", [
          "wlan",
          "show",
          "profile",
          `name=${ssid}`,
          "key=clear"
        ]);
        const pwdMatch = profileOutput.match(/(?:关键内容|Key Content|Key content)\s*:\s*(.*)/i);
        if (pwdMatch) {
          return pwdMatch[1].trim();
        }
      } catch (err) {
        console.error(`[WindowsWifiStrategy] \u83B7\u53D6 ${ssid} \u5BC6\u7801\u5931\u8D25:`, err);
      }
      return "";
    }
    /**
     * 从 netsh wlan show profiles 输出中健壮提取所有 SSID 列表
     */
    parseSsids(output) {
      const ssids = [];
      if (!output) return ssids;
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(":") && (line.includes("Profile") || line.includes("\u914D\u7F6E\u6587\u4EF6"))) {
          const parts = line.split(":");
          if (parts.length >= 2) {
            const ssid = parts.slice(1).join(":").trim();
            if (ssid && !ssids.includes(ssid)) {
              ssids.push(ssid);
            }
          }
        }
      }
      if (ssids.length === 0 && output.includes(":")) {
        const allRegex = /:\s+(.+)/g;
        let match;
        while ((match = allRegex.exec(output)) !== null) {
          const val = match[1].trim();
          if (val && !val.includes("---") && !val.startsWith("wlan") && !ssids.includes(val)) {
            ssids.push(val);
          }
        }
      }
      return ssids;
    }
  };

  // src-compat/wifi/strategies/mac-strategy.js
  var MacWifiStrategy = class extends BaseWifiStrategy {
    async getWifiList() {
      try {
        const output = await executeCommand("networksetup", ["-listpreferredwirelessnetworks", "en0"]);
        const lines = output.split("\n").map((l) => l.trim()).filter((l) => l && !l.includes("Preferred networks on"));
        const results = [];
        for (const ssid of lines) {
          results.push({
            ssid,
            password: void 0,
            securityType: "\u672A\u77E5/\u6309\u9700\u83B7\u53D6"
          });
        }
        return results;
      } catch (err) {
        console.error("[MacWifiStrategy] \u8BFB\u53D6 WiFi \u5931\u8D25:", err);
        throw new Error(`macOS WiFi \u63D0\u53D6\u5931\u8D25: ${err.message || err}`);
      }
    }
    async getWifiPassword(ssid) {
      try {
        const pwdOutput = await executeCommand("security", ["find-generic-password", "-wa", ssid]);
        return pwdOutput.trim();
      } catch (err) {
        console.error(`[MacWifiStrategy] \u83B7\u53D6 ${ssid} \u5BC6\u7801\u5931\u8D25:`, err);
      }
      return "";
    }
  };

  // src-compat/wifi/strategies/linux-strategy.js
  var LinuxWifiStrategy = class extends BaseWifiStrategy {
    async getWifiList() {
      try {
        const output = await executeCommand("nmcli", ["-t", "-f", "NAME,TYPE", "connection", "show"]);
        const lines = output.split("\n");
        const results = [];
        for (const line of lines) {
          if (!line || !line.includes("802-11-wireless")) continue;
          const ssid = line.split(":")[0];
          if (!ssid) continue;
          let password = "";
          let securityType = "\u5F00\u653E\u7F51\u7EDC";
          try {
            const detail = await executeCommand("nmcli", [
              "-s",
              "-g",
              "802-11-wireless-security.psk",
              "connection",
              "show",
              ssid
            ]);
            if (detail && detail.trim()) {
              password = detail.trim();
              securityType = "WPA/WPA2";
            }
          } catch {
          }
          results.push({ ssid, password, securityType });
        }
        return results;
      } catch (err) {
        console.error("[LinuxWifiStrategy] \u8BFB\u53D6 WiFi \u5931\u8D25:", err);
        throw new Error(`Linux WiFi \u63D0\u53D6\u5931\u8D25: ${err.message || err}`);
      }
    }
    async getWifiPassword(ssid) {
      try {
        const detail = await executeCommand("nmcli", [
          "-s",
          "-g",
          "802-11-wireless-security.psk",
          "connection",
          "show",
          ssid
        ]);
        if (detail && detail.trim()) {
          return detail.trim();
        }
      } catch (err) {
        console.error(`[LinuxWifiStrategy] \u83B7\u53D6 ${ssid} \u5BC6\u7801\u5931\u8D25:`, err);
      }
      return "";
    }
  };

  // src-compat/wifi/wifi-service.js
  var WifiService = class {
    constructor() {
      this.strategy = null;
      this.currentPlatform = null;
    }
    /**
     * 探测当前操作系统类型 ('windows' | 'macos' | 'linux')
     * @returns {Promise<string>}
     */
    async detectPlatform() {
      if (this.currentPlatform) {
        return this.currentPlatform;
      }
      if (window.ruck?.os?.platform && typeof window.ruck.os.platform === "function") {
        try {
          const plat = await window.ruck.os.platform();
          if (plat) {
            const lower = String(plat).toLowerCase();
            if (lower.includes("win")) this.currentPlatform = "windows";
            else if (lower.includes("mac") || lower.includes("darwin")) this.currentPlatform = "macos";
            else if (lower.includes("linux")) this.currentPlatform = "linux";
          }
        } catch (e) {
          console.warn("[WifiService] \u4ECE ruck.os.platform \u83B7\u53D6\u5E73\u53F0\u5931\u8D25:", e);
        }
      }
      if (!this.currentPlatform && typeof process !== "undefined" && process.platform) {
        const p = process.platform;
        if (p === "win32") this.currentPlatform = "windows";
        else if (p === "darwin") this.currentPlatform = "macos";
        else if (p === "linux") this.currentPlatform = "linux";
      }
      if (!this.currentPlatform && typeof navigator !== "undefined") {
        const ua = (navigator.userAgent || "").toLowerCase();
        const p = (navigator.platform || "").toLowerCase();
        if (p.includes("win") || ua.includes("windows")) {
          this.currentPlatform = "windows";
        } else if (p.includes("mac") || ua.includes("macintosh")) {
          this.currentPlatform = "macos";
        } else if (p.includes("linux") || ua.includes("linux")) {
          this.currentPlatform = "linux";
        }
      }
      if (!this.currentPlatform) {
        this.currentPlatform = "windows";
      }
      return this.currentPlatform;
    }
    /**
     * 延迟获取或初始化平台策略实例
     * @returns {Promise<BaseWifiStrategy>}
     */
    async getStrategy() {
      if (this.strategy) {
        return this.strategy;
      }
      const platform = await this.detectPlatform();
      switch (platform) {
        case "windows":
          this.strategy = new WindowsWifiStrategy();
          break;
        case "macos":
          this.strategy = new MacWifiStrategy();
          break;
        case "linux":
          this.strategy = new LinuxWifiStrategy();
          break;
        default:
          this.strategy = new WindowsWifiStrategy();
          break;
      }
      return this.strategy;
    }
    /**
     * 获取所有 WiFi 网络配置及密码
     */
    async getWifiList() {
      const strategy = await this.getStrategy();
      return await strategy.getWifiList();
    }
    /**
     * 按需获取指定 SSID 的密码明文
     * @param {string} ssid
     */
    async getWifiPassword(ssid) {
      if (!ssid) return "";
      const strategy = await this.getStrategy();
      return await strategy.getWifiPassword(ssid);
    }
  };
  var wifiService = new WifiService();

  // src-compat/ztools.js
  function getRuck2() {
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
        const ruck = getRuck2();
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
      setExpandHeight(height = 600) {
        const ruck = getRuck2();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      /**
       * 退出或切出插件
       */
      outPlugin() {
        const ruck = getRuck2();
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
       * 监听插件激活/进入事件
       * 针对 Webview2 冷启动时序设计 80ms 自愈防死锁机制
       */
      onPluginEnter(callback) {
        if (typeof callback !== "function") return;
        enterCallback = callback;
        const triggerEnter = (action) => {
          if (enterTriggered) return;
          enterTriggered = true;
          const normalizedAction = action || {
            code: "wifi-export-tool",
            type: "text",
            payload: ""
          };
          try {
            enterCallback(normalizedAction);
          } catch (e) {
            console.error("[ZTools Bridge] onPluginEnter \u6267\u884C\u5F02\u5E38:", e);
          }
        };
        const ruck = getRuck2();
        if (ruck?.onPluginEnter && typeof ruck.onPluginEnter === "function") {
          ruck.onPluginEnter((action) => {
            triggerEnter(action);
          });
        }
        setTimeout(() => {
          if (!enterTriggered) {
            triggerEnter({
              code: "wifi-export-tool",
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
        const ruck = getRuck2();
        if (ruck?.onPluginOut && typeof ruck.onPluginOut === "function") {
          ruck.onPluginOut(callback);
        }
      }
    };
    return bridge;
  }

  // src-compat/index.js
  var ztoolsBridge = createZtoolsBridge();
  if (typeof window !== "undefined") {
    window.wifiApi = wifiService;
    window.ztools = ztoolsBridge;
    window.utools = ztoolsBridge;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.wifiApi = wifiService;
    globalThis.ztools = ztoolsBridge;
    globalThis.utools = ztoolsBridge;
  }
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const modal = document.getElementById("wifiModal");
      if (modal && modal.classList.contains("active")) {
        modal.classList.remove("active");
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const searchInput = document.getElementById("searchInput");
      if (searchInput && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        ztoolsBridge.outPlugin();
      } catch (e) {
        console.warn("[Ruck Compat] outPlugin \u9000\u51FA\u5931\u8D25:", e);
      }
    }
  }
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  }
  console.log("[Ruck WiFi Compat] WiFi \u517C\u5BB9\u5C42\u4E0E API \u6302\u8F7D\u5B8C\u6210");
})();
