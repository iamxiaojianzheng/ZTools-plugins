/**
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境
 */

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 缓存系统临时路径
let cachedTempDir = "";

// 监听器集合
const enterListeners = new Set();
const outListeners = new Set();

let lastAction = null;
let lastActionFingerprint = "";
let lastActionTime = 0;
let hostEventsInstalled = false;
let fallbackTimer = null;

function normalizeAction(rawAction = {}) {
  const normalized = { ...rawAction };
  const rawCode = String(normalized.code || "").trim();

  if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "@ruck-plugins/tinypng") {
    normalized.code = "tinypng";
  } else {
    normalized.code = rawCode;
  }

  if (!normalized.type) {
    normalized.type = "text";
  }
  if (normalized.payload === undefined) {
    normalized.payload = "";
  }
  return normalized;
}

export async function dispatchPluginEnter(rawAction) {
  const normalized = normalizeAction(rawAction);
  const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
  const now = Date.now();

  // 350ms 内完全相同的事件视为重复派发，予以过滤
  if (fingerprint === lastActionFingerprint && now - lastActionTime < 350) {
    return;
  }

  lastActionFingerprint = fingerprint;
  lastActionTime = now;
  lastAction = normalized;

  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  console.log(`[TinyPNG] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);

  for (const listener of enterListeners) {
    try {
      listener(normalized);
    } catch (err) {
      console.error("[TinyPNG] Error in onPluginEnter listener:", err);
    }
  }
}

export function dispatchPluginOut(processExit = false) {
  console.log("[TinyPNG] dispatchPluginOut: processExit =", processExit);
  for (const listener of outListeners) {
    try {
      listener(processExit);
    } catch (err) {
      console.error("[TinyPNG] Error in onPluginOut listener:", err);
    }
  }
}

function setupHostEventListeners() {
  if (hostEventsInstalled) return;
  hostEventsInstalled = true;

  const ruck = getRuck();

  // 1. 预热系统临时目录路径
  if (ruck?.path?.tempDir && typeof ruck.path.tempDir === "function") {
    ruck.path.tempDir().then((d) => {
      if (d) cachedTempDir = d;
    }).catch(() => {});
  } else if (ruck?.os?.tmpdir && typeof ruck.os.tmpdir === "function") {
    ruck.os.tmpdir().then((d) => {
      if (d) cachedTempDir = d;
    }).catch(() => {});
  }

  // 2. 监听 Ruck 宿主官方进入事件
  if (typeof ruck?.onPluginEnter === "function") {
    ruck.onPluginEnter(async (action) => {
      await dispatchPluginEnter(action);
    });
  }

  // 3. 监听 Ruck 宿主官方切出事件
  if (typeof ruck?.onPluginOut === "function") {
    ruck.onPluginOut((exit) => {
      dispatchPluginOut(exit);
    });
  }

  // 4. 300ms 冷启动保底：若无外部进入事件且已挂载监听器，派发默认进入指令
  fallbackTimer = setTimeout(() => {
    if (!lastAction && enterListeners.size > 0) {
      console.log("[TinyPNG] 300ms auto-fallback triggering default onPluginEnter");
      dispatchPluginEnter({ code: "tinypng", type: "text", payload: "" });
    }
  }, 300);
}

export function createZtoolsBridge() {
  setupHostEventListeners();

  const bridge = {
    /**
     * 获取指定目录类型的本地路径
     * @param {'temp' | 'home' | 'appData' | 'userData'} name
     */
    getPath(name) {
      if (name === "temp") {
        if (cachedTempDir) return cachedTempDir;
        const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
        return isWin ? "C:\\Windows\\Temp" : "/tmp";
      }
      return "";
    },

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
          console.warn("[ZTools Bridge] ruck.clipboard.writeText 异常:", e);
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      }
      return false;
    },

    /**
     * 将文件复制到剪贴板中（支持单文件或文件列表）
     * @param {string | string[]} files
     */
    copyFile(files) {
      if (!files) return false;
      const fileList = Array.isArray(files) ? files : [files];
      if (fileList.length === 0) return false;

      const ruck = getRuck();
      if (ruck?.clipboard?.writeFiles && typeof ruck.clipboard.writeFiles === "function") {
        try {
          ruck.clipboard.writeFiles(fileList).catch((err) => {
            console.error("[ZTools Bridge] 写入剪贴板文件失败:", err);
          });
          return true;
        } catch (e) {
          console.error("[ZTools Bridge] copyFile 抛出异常:", e);
          return false;
        }
      }
      return false;
    },

    /**
     * 从拖拽或输入的 File 对象获取绝对路径
     */
    getPathForFile(file) {
      if (!file) return "";
      if (typeof file === "string") return file;
      if (file.path) return file.path;
      if (file.webkitRelativePath) return file.webkitRelativePath;
      return file.name || "";
    },

    /**
     * 弹出通知/轻提示
     */
    showNotification(body) {
      const ruck = getRuck();
      const content = String(body || "");
      if (ruck?.notification?.message && typeof ruck.notification.message === "function") {
        ruck.notification.message({ content, type: "info" });
        return;
      }
      if (ruck?.notification?.system && typeof ruck.notification.system === "function") {
        ruck.notification.system({ body: content });
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("TinyPNG", { body: content });
      }
    },

    /**
     * 动态设置窗口高度
     */
    setExpendHeight(height = 600) {
      const ruck = getRuck();
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
      const ruck = getRuck();
      if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === "function") {
        ruck.window.outPlugin();
      } else if (ruck?.outPlugin && typeof ruck.outPlugin === "function") {
        ruck.outPlugin();
      } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === "function") {
        ruck.window.hideMainWindow();
      } else if (typeof window !== "undefined" && window.location) {
        window.location.href = "ruck://action/close-plugin";
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
     */
    onPluginEnter(callback) {
      if (typeof callback !== "function") return () => {};
      enterListeners.add(callback);

      // 若已经有进入动作缓存，立即向新监听器回放
      if (lastAction) {
        try {
          callback(lastAction);
        } catch (e) {
          console.error("[ZTools Bridge] 回放进入事件异常:", e);
        }
      }

      return () => {
        enterListeners.delete(callback);
      };
    },

    /**
     * 监听插件切出事件
     */
    onPluginOut(callback) {
      if (typeof callback !== "function") return () => {};
      outListeners.add(callback);
      return () => {
        outListeners.delete(callback);
      };
    }
  };

  return bridge;
}
