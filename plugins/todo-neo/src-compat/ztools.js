/**
 * Todo-Neo window.ztools / window.utools 宿主桥接器
 * 连接 todo-neo 前端与 Ruck (Tauri 2.0 Webview2) 运行时
 */

import { db, dbStorage, onDataChange, reloadFromStorage } from "./database.js";
import { toolHandlers } from "./tools.js";

// 当数据库底层发生变更时自动广播 onDbPull
onDataChange(() => {
  emitDbPull();
});

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 事件总线多监听器集合
const enterListeners = new Set();
const outListeners = new Set();
const dbPullListeners = new Set();

let lastAction = null;
let lastActionFingerprint = "";
let lastActionTime = 0;
let hostEventsInstalled = false;
let fallbackTimer = null;

/**
 * 触发数据库外部变动广播 (供 tools.js 等内部或外部数据变动反向驱动)
 */
export function emitDbPull() {
  console.log("[TodoNeo] emitDbPull triggered, notifying listeners:", dbPullListeners.size);
  for (const listener of dbPullListeners) {
    try {
      listener();
    } catch (err) {
      console.error("[TodoNeo] Error in onDbPull listener:", err);
    }
  }
}

/**
 * 核心纠偏与 Action 归一化
 */
function normalizeAction(rawAction = {}) {
  const normalized = { ...rawAction };
  const rawCode = String(normalized.code || "").trim();

  // 若 code 为 default、main、空、插件名称标识符等，统统规整为默认主视图 todo
  if (
    !rawCode ||
    rawCode === "default" ||
    rawCode === "main" ||
    rawCode === "todo-neo" ||
    rawCode === "@ruck-plugins/todo-neo"
  ) {
    normalized.code = "todo";
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

/**
 * 统一分发 plugin-enter 事件 (包含 350ms 事件指纹去重)
 */
function dispatchPluginEnter(rawAction) {
  const normalized = normalizeAction(rawAction);
  const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
  const now = Date.now();

  // 350ms 内完全相同的事件视为重复派发，予以过滤
  if (fingerprint === lastActionFingerprint && now - lastActionTime < 350) {
    console.log(`[TodoNeo] Ignored duplicate plugin-enter event: ${fingerprint}`);
    return;
  }

  lastActionFingerprint = fingerprint;
  lastActionTime = now;
  lastAction = normalized;

  // 一旦有真实事件到达，清除冷启动保底定时器
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  // 每次进入插件（特别是第二次/多次进入），优先全量原子刷新底层存储
  try {
    reloadFromStorage();
  } catch (err) {
    console.error("[TodoNeo] reloadFromStorage error in dispatchPluginEnter:", err);
  }

  console.log(`[TodoNeo] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}", payload=`, normalized.payload);

  for (const listener of enterListeners) {
    try {
      listener(normalized);
    } catch (err) {
      console.error("[TodoNeo] Error in onPluginEnter listener:", err);
    }
  }
}

/**
 * 统一分发 plugin-out 事件
 */
function dispatchPluginOut(processExit = false) {
  console.log("[TodoNeo] dispatchPluginOut: processExit =", processExit);
  for (const listener of outListeners) {
    try {
      listener(processExit);
    } catch (err) {
      console.error("[TodoNeo] Error in onPluginOut listener:", err);
    }
  }
}

/**
 * 挂载高可靠【互斥级联】宿主事件监听器 (严格单通道，杜绝并列多重绑定)
 */
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

  // 3. 视窗可见性与聚焦兜底同步 (Webview 后台恢复秒开保障)
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        console.log("[TodoNeo] Window became visible, reloading storage...");
        reloadFromStorage();
        emitDbPull();
      }
    });
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("focus", () => {
      console.log("[TodoNeo] Window focused, reloading storage...");
      reloadFromStorage();
      emitDbPull();
    });
  }

  // 4. 300ms 冷启动保底：仅当无任何宿主事件到达时触发一次默认主视图
  fallbackTimer = setTimeout(() => {
    if (!lastAction && enterListeners.size > 0) {
      console.log("[TodoNeo] 300ms auto-fallback triggering default onPluginEnter");
      dispatchPluginEnter({ code: "todo", type: "text", payload: "" });
    }
  }, 300);
}

export function createZtoolsBridge() {
  const registeredTools = new Map();

  // 默认装配内置的待办 AI Tools
  Object.entries(toolHandlers).forEach(([name, handler]) => {
    registeredTools.set(name, handler);
  });

  // 安装宿主事件监听器
  setupHostEventListeners();

  const bridge = {
    db,
    dbStorage,

    // 工具注册能力 (支持 MCP / AI 宿主调度)
    registerTool(name, handler) {
      registeredTools.set(name, handler);
      const ruck = getRuck();
      if (typeof ruck?.tool?.register === "function") {
        ruck.tool.register(name, handler);
      }
      return true;
    },

    getRegisteredTools() {
      return registeredTools;
    },

    // 复制纯文本
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

    // 注册生命周期回调：由宿主事件和统一总线驱动，不再做无脑二次回放
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

    onDbPull(cb) {
      if (typeof cb !== "function") return () => {};
      dbPullListeners.add(cb);

      // 宿主外部多端同步监听
      const ruck = getRuck();
      if (ruck?.database?.onDbPull) {
        ruck.database.onDbPull(cb);
      }

      return () => {
        dbPullListeners.delete(cb);
      };
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

    showNotification(body) {
      const ruck = getRuck();
      if (ruck?.notification?.show) {
        ruck.notification.show({ body });
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Todo 待办", { body });
      } else if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") new Notification("Todo 待办", { body });
        });
      }
    },

    // AI 大模型能力桥接
    async ai(options = {}) {
      const ruck = getRuck();
      if (ruck?.ai?.chat) {
        const request = {
          model: options.model && !options.model.startsWith("doubao-") ? options.model : "",
          messages: (options.messages || []).map((m) => ({
            role: m.role || "user",
            content: String(m.content || "")
          })),
          temperature: options.temperature,
          max_tokens: options.max_tokens
        };

        let result;
        try {
          result = await ruck.ai.chat({}, request);
        } catch (err) {
          const msg = String(err?.message || err || "");
          if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
            result = await ruck.ai.chat(request, {});
          } else {
            throw err;
          }
        }

        const content = typeof result === "string" ? result : result?.content || String(result || "");
        return { content };
      }
      throw new Error("当前环境未配置 AI 能力支持");
    }
  };

  return bridge;
}
