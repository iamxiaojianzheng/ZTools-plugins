/**
 * window.ztools / window.utools / window.platform 宿主桥接器
 * 连接 color-helper 前端与 Ruck (Tauri 2.0 / Webview2) 运行时
 */
import { db } from "./database.js";

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const STORAGE_PREFIX = "color_helper_";

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 已知合法业务 Feature Codes
const KNOWN_CODES = [
  "color",
  "ai",
  "ui",
  "traditional",
  "gradient",
  "image",
  "collect",
  "pickercolor"
];

/**
 * 稳健调用 Ruck 宿主 ai.chat
 * 宿主 Webview 注入签名: chat(providerConfig, request)
 * 独立 SDK 包可能签名: chat(request, providerConfig)
 */
async function invokeRuckAiChat(ruck, request) {
  try {
    // 优先采用 Webview 宿主 preload 注入签名: chat(providerConfig, request)
    return await ruck.ai.chat({}, request);
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
      // 容错降级：若宿主为独立包形式的 chat(request, providerConfig)
      return await ruck.ai.chat(request, {});
    }
    throw err;
  }
}

export function createZtoolsBridge() {
  const bridge = {
    db,

    // dbStorage 同步 K-V 存储
    dbStorage: {
      getItem(key) {
        try {
          if (typeof localStorage === "undefined") return null;
          const v = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
          return v ? JSON.parse(v) : null;
        } catch {
          return null;
        }
      },
      setItem(key, value) {
        try {
          if (typeof localStorage === "undefined") return;
          localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
        } catch (e) {}
      },
      removeItem(key) {
        try {
          if (typeof localStorage === "undefined") return;
          localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        } catch (e) {}
      }
    },

    // 平台特征
    isMacOs() {
      return isMac;
    },

    getPath(name) {
      if (name === "downloads") return "downloads";
      if (name === "temp") return "temp";
      return "";
    },

    // 剪贴板
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
      // fallback
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
      } catch (e) {
        return false;
      }
    },

    copyImage(imageData) {
      const ruck = getRuck();
      if (ruck?.clipboard?.writeImage) {
        ruck.clipboard.writeImage(imageData);
        return true;
      }
      return false;
    },

    // 屏幕取色
    screenColorPick(callback) {
      const ruck = getRuck();
      if (ruck?.screenColorPick) {
        ruck.screenColorPick(callback);
        return;
      }
      if (ruck?.screen?.colorPick) {
        ruck.screen.colorPick(callback);
        return;
      }
      // 现代浏览器 EyeDropper API (Chrome 95+ / Webview2)
      if (typeof window !== "undefined" && window.EyeDropper) {
        const dropper = new window.EyeDropper();
        dropper
          .open()
          .then((result) => {
            if (typeof callback === "function") {
              callback({ hex: result.sRGBHex, rgb: "" });
            }
          })
          .catch(() => {
            /* 用户取消取色 */
          });
        return;
      }
      console.warn("[ColorHelper] screenColorPick is not supported in this environment");
    },

    // 屏幕截图
    screenCapture(callback) {
      const ruck = getRuck();
      if (ruck?.screenCapture) {
        ruck.screenCapture(callback);
        return;
      }
      if (ruck?.screen?.capture) {
        ruck.screen.capture(callback);
        return;
      }
      console.warn("[ColorHelper] screenCapture is not supported in this environment");
    },

    // 窗口控制
    hideMainWindow(restorePreWindow = true) {
      const ruck = getRuck();
      if (ruck?.window?.hideMainWindow) {
        return ruck.window.hideMainWindow(restorePreWindow);
      }
      if (ruck?.hideMainWindow) {
        return ruck.hideMainWindow(restorePreWindow);
      }
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

    outPlugin(isKill = false) {
      const ruck = getRuck();
      if (ruck?.window?.outPlugin) {
        return ruck.window.outPlugin(isKill);
      }
      if (ruck?.outPlugin) {
        return ruck.outPlugin(isKill);
      }
    },

    // 判定 AI 能力是否可用
    isAIAvailable() {
      const ruck = getRuck();
      return !!(ruck?.ai?.chat || typeof ruck?.ai === "function");
    },

    // AI 配色与命名桥接 (对齐 uTools/ZTools 的 { content: string } 契约)
    async ai(options = {}) {
      const ruck = getRuck();
      if (ruck?.ai?.chat) {
        const rawModel = options.model || "";
        // 智能缺省：若为旧平台豆包等写死模型名或为空，置空以自动选用用户在 Ruck 设置中心激活的模型
        const model = (rawModel.startsWith("doubao-") || !rawModel.trim()) ? "" : rawModel.trim();

        const request = {
          model,
          messages: (options.messages || []).map((m) => ({
            role: m.role || "user",
            content: String(m.content || "")
          })),
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          think: options.think
        };

        const res = await invokeRuckAiChat(ruck, request);
        // Ruck 返回纯文本字符串，规范包装为 { content: string }
        const content = typeof res === "string" ? res : (res?.content || String(res || ""));
        return { content };
      }
      if (typeof ruck?.ai === "function") {
        const res = await ruck.ai(options);
        const content = typeof res === "string" ? res : (res?.content || String(res || ""));
        return { content };
      }
      throw new Error("当前环境未配置 AI 能力支持");
    },

    // 文件选择对话框
    showOpenDialog(options = {}) {
      const ruck = getRuck();
      if (ruck?.window?.showOpenDialog) {
        return ruck.window.showOpenDialog(options);
      }
      if (ruck?.showOpenDialog) {
        return ruck.showOpenDialog(options);
      }
      return null;
    },

    // 生命周期与 Action 智能纠偏
    onPluginEnter(callback) {
      let enterTriggered = false;

      const wrappedCallback = (action = {}) => {
        enterTriggered = true;
        const normalized = { ...action };

        // 核心纠偏：杜绝 default / main 或未匹配 code 导致页面白屏
        if (
          !normalized.code ||
          normalized.code === "default" ||
          normalized.code === "main" ||
          !KNOWN_CODES.includes(normalized.code)
        ) {
          normalized.code = "color";
        }

        if (!normalized.type) {
          normalized.type = "text";
        }
        if (normalized.payload === undefined) {
          normalized.payload = "";
        }

        console.log(`[ColorHelper] onPluginEnter dispatching code: "${normalized.code}", type: "${normalized.type}"`);
        if (typeof callback === "function") {
          callback(normalized);
        }
      };

      const ruck = getRuck();
      if (ruck?.onPluginEnter) {
        ruck.onPluginEnter(wrappedCallback);
      } else if (ruck?.on) {
        ruck.on("plugin-enter", wrappedCallback);
      }

      // 80ms 冷启动保底：若无宿主事件投递，自动触发默认主视图
      setTimeout(() => {
        if (!enterTriggered) {
          wrappedCallback({ code: "color", type: "text", payload: "" });
        }
      }, 80);
    },

    onPluginOut(callback) {
      const ruck = getRuck();
      if (ruck?.onPluginOut) {
        ruck.onPluginOut(callback);
      } else if (ruck?.on) {
        ruck.on("plugin-out", callback);
      }
    }
  };

  return bridge;
}
