/**
 * 待办日历 (todos) 宿主 API 桥接层
 * 连接 todos 前端与 Ruck (Tauri 2.0 Webview2) 运行时
 */

import { quickAddTask } from "./quick-add.js";

const STORAGE_PREFIX = "ruck_todos_db_";

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 多监听器集合
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

  if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "todos" || rawCode === "@ruck-plugins/todos") {
    normalized.code = "Todos";
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

let currentBridgeInstance = null;

function dispatchPluginEnter(rawAction) {
  const normalized = normalizeAction(rawAction);
  const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
  const now = Date.now();

  // 350ms 内完全相同的事件视为重复派发，予以过滤
  if (fingerprint === lastActionFingerprint && now - lastActionTime < 350) {
    console.log(`[Todos] Ignored duplicate plugin-enter event: ${fingerprint}`);
    return;
  }

  lastActionFingerprint = fingerprint;
  lastActionTime = now;
  lastAction = normalized;

  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  console.log(`[Todos] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);

  // 若为 add 指令进入（划词直达或正则），直接落盘待办
  if (normalized.code === "add" && normalized.payload) {
    try {
      console.log(`[Todos] Quick adding task via enter action: "${normalized.payload}"`);
      quickAddTask(normalized.payload, currentBridgeInstance, true);
    } catch (err) {
      console.error("[Todos] Failed to quick add task via enter action:", err);
    }
  }

  for (const listener of enterListeners) {
    try {
      listener(normalized);
    } catch (err) {
      console.error("[Todos] Error in onPluginEnter listener:", err);
    }
  }
}

function dispatchPluginOut(processExit = false) {
  console.log("[Todos] dispatchPluginOut: processExit =", processExit);
  for (const listener of outListeners) {
    try {
      listener(processExit);
    } catch (err) {
      console.error("[Todos] Error in onPluginOut listener:", err);
    }
  }
}

function setupHostEventListeners() {
  if (hostEventsInstalled) return;
  hostEventsInstalled = true;

  const ruck = getRuck();

  // 1. 唯一权威契约：直连 Ruck 宿主官方生命周期 API (内置插件隔离与事件缓冲)
  if (typeof ruck?.onPluginEnter === "function") {
    ruck.onPluginEnter((action) => {
      dispatchPluginEnter(action);
    });
  }

  // 2. 唯一权威契约：直连 Ruck 宿主官方切出 API
  if (typeof ruck?.onPluginOut === "function") {
    ruck.onPluginOut((exit) => {
      dispatchPluginOut(exit);
    });
  }

  // 3. 300ms 冷启动保底
  fallbackTimer = setTimeout(() => {
    if (!lastAction && enterListeners.size > 0) {
      console.log("[Todos] 300ms auto-fallback triggering default onPluginEnter");
      dispatchPluginEnter({ code: "Todos", type: "text", payload: "" });
    }
  }, 300);
}

export function createZtoolsBridge() {
  setupHostEventListeners();

  // 1. dbStorage 命名空间存储映射
  const dbStorage = {
    getItem(key) {
      try {
        const fullKey = `${STORAGE_PREFIX}${key}`;
        const val = localStorage.getItem(fullKey);
        if (val === null) {
          return localStorage.getItem(key);
        }
        return val;
      } catch (err) {
        console.error("[Todos] dbStorage.getItem failed:", err);
        return null;
      }
    },
    setItem(key, value) {
      try {
        const fullKey = `${STORAGE_PREFIX}${key}`;
        const strVal = typeof value === "string" ? value : JSON.stringify(value);
        localStorage.setItem(fullKey, strVal);
        localStorage.setItem(key, strVal);
      } catch (err) {
        console.error("[Todos] dbStorage.setItem failed:", err);
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        localStorage.removeItem(key);
      } catch (err) {
        console.error("[Todos] dbStorage.removeItem failed:", err);
      }
    }
  };

  const bridge = {
    dbStorage,

    isDarkColors() {
      const ruck = getRuck();
      if (typeof ruck?.theme?.isDark === "function") {
        return Boolean(ruck.theme.isDark());
      }
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return false;
    },

    copyText(text) {
      const ruck = getRuck();
      if (ruck?.clipboard?.writeText) {
        ruck.clipboard.writeText(text);
        return true;
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    },

    onPluginEnter(cb) {
      if (typeof cb !== "function") return () => {};
      enterListeners.add(cb);
      return () => {
        enterListeners.delete(cb);
      };
    },

    onPluginOut(cb) {
      if (typeof cb !== "function") return () => {};
      outListeners.add(cb);
      return () => {
        outListeners.delete(cb);
      };
    },

    onMainPush(callback, onSelect) {
      const ruck = getRuck();
      if (typeof ruck?.onMainPush === "function") {
        ruck.onMainPush(callback, onSelect);
      }
    },

    outPlugin() {
      const ruck = getRuck();
      if (ruck?.window?.outPlugin) {
        ruck.window.outPlugin();
        return;
      }
      if (typeof window !== "undefined" && window.location) {
        window.location.href = "ruck://action/close-plugin";
      }
    },

    hideMainWindow() {
      const ruck = getRuck();
      if (ruck?.window?.hide) {
        ruck.window.hide();
        return;
      }
      bridge.outPlugin();
    },

    showMainWindow() {
      const ruck = getRuck();
      if (ruck?.window?.show) {
        ruck.window.show();
      }
    },

    setExpendHeight(height) {
      const ruck = getRuck();
      if (ruck?.window?.setExpendHeight) {
        ruck.window.setExpendHeight(height);
      }
    },

    showNotification(body, clickFeatureCode) {
      const ruck = getRuck();
      if (ruck?.notification?.show) {
        ruck.notification.show({ body, clickFeatureCode });
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("待办事项", { body });
      } else if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") new Notification("待办事项", { body });
        });
      }
    }
  };

  currentBridgeInstance = bridge;
  return bridge;
}
