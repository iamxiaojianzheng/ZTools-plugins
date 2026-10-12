/**
 * window.ztools / window.utools 宿主桥接器
 * 连接 regex-editor 前端与 Ruck (Tauri 2.0 / Webview2) 运行时
 */

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const isWin = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN");

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 已知合法业务 Feature Codes
const KNOWN_CODES = ["editor"];

/**
 * 稳健调用 Ruck 宿主 ai.chat
 * 宿主 Webview 注入签名优先: chat(providerConfig, request)
 * 备选签名: chat(request, providerConfig)
 */
async function invokeRuckAiChat(ruck, request) {
  try {
    return await ruck.ai.chat({}, request);
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
      return await ruck.ai.chat(request, {});
    }
    throw err;
  }
}

/**
 * 稳健调用 Ruck 宿主 ai.chatStream
 */
async function invokeRuckAiChatStream(ruck, request, onDelta) {
  try {
    return await ruck.ai.chatStream({}, request, onDelta);
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
      return await ruck.ai.chatStream(request, onDelta, {});
    }
    throw err;
  }
}

export function createZtoolsBridge() {
  const bridge = {
    // 平台识别
    isMacOs() {
      return isMac;
    },
    isWindows() {
      return isWin;
    },

    // 路径查询
    getPath(name) {
      if (name === "downloads") return "downloads";
      if (name === "temp") return "temp";
      return "";
    },

    // 剪贴板文本写入
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
      } catch (e) {
        return false;
      }
    },

    // 系统通知
    showNotification(body, clickFeatureCode) {
      const ruck = getRuck();
      if (ruck?.notification?.show) {
        ruck.notification.show({ body: String(body || ""), clickFeatureCode });
        return;
      }
      if (typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          new Notification("正则可视编辑器", { body: String(body || "") });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              new Notification("正则可视编辑器", { body: String(body || "") });
            }
          });
        }
      }
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

    // 获取 AI 模型列表
    async allAiModels() {
      const ruck = getRuck();
      const getModelsFn = ruck?.allAiModels || ruck?.ai?.allAiModels;
      if (typeof getModelsFn === "function") {
        try {
          const list = await getModelsFn.call(ruck?.allAiModels ? ruck : ruck.ai);
          if (Array.isArray(list) && list.length > 0) {
            return list.map((m) => {
              if (typeof m === "string") {
                return { id: m, label: m, description: m };
              }
              return {
                id: m.id || m.name || "",
                label: m.label || m.name || m.id || "",
                description: m.description || ""
              };
            });
          }
        } catch (e) {
          console.warn("[regex-editor] allAiModels failed:", e);
        }
      }
      // 若宿主支持 chat 但未提供 allAiModels 或返回空，提供默认配置项让用户自适应
      if (bridge.isAIAvailable()) {
        return [{ id: "", label: "默认配置模型", description: "使用 Ruck 设置中的全局默认模型" }];
      }
      return [];
    },

    // 跳转 AI 设置页面
    redirectAiModelsSetting() {
      const ruck = getRuck();
      if (ruck?.setting?.open) {
        ruck.setting.open("ai");
        return;
      }
      if (ruck?.window?.openSetting) {
        ruck.window.openSetting("ai");
        return;
      }
      bridge.showNotification("请在 Ruck 设置中心配置 AI 提供商及默认模型");
    },

    // 判定 AI 能力是否可用
    isAIAvailable() {
      const ruck = getRuck();
      return !!(ruck?.ai?.chat || typeof ruck?.ai === "function");
    },

    // AI 对话与生成（支持普通 Promise 和带有 (chunk) => void 的流式）
    ai(options = {}, onChunk) {
      const ruck = getRuck();
      if (!bridge.isAIAvailable()) {
        const errorPromise = Promise.reject(new Error("当前环境未配置 AI 能力支持"));
        errorPromise.abort = () => {};
        return errorPromise;
      }

      const rawModel = options.model || "";
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

      let isAborted = false;
      const abortFn = () => {
        isAborted = true;
      };

      // 1. 流式调用
      if (typeof onChunk === "function") {
        const promise = (async () => {
          if (ruck?.ai?.chatStream) {
            await invokeRuckAiChatStream(ruck, request, (delta) => {
              if (isAborted) return;
              if (delta) {
                onChunk({ content: delta });
              }
            });
            if (isAborted) throw new Error("Aborted");
            return { content: "" };
          }
          // 降级：宿主仅有普通 chat，模拟单次回调
          const res = await invokeRuckAiChat(ruck, request);
          if (isAborted) throw new Error("Aborted");
          const text = typeof res === "string" ? res : (res?.content || String(res || ""));
          onChunk({ content: text });
          return { content: text };
        })();

        promise.abort = abortFn;
        return promise;
      }

      // 2. 非流式调用
      const promise = (async () => {
        if (ruck?.ai?.chat) {
          const res = await invokeRuckAiChat(ruck, request);
          if (isAborted) throw new Error("Aborted");
          const content = typeof res === "string" ? res : (res?.content || String(res || ""));
          return { content };
        }
        if (typeof ruck?.ai === "function") {
          const res = await ruck.ai(options);
          if (isAborted) throw new Error("Aborted");
          const content = typeof res === "string" ? res : (res?.content || String(res || ""));
          return { content };
        }
        throw new Error("当前环境未配置 AI 能力支持");
      })();

      promise.abort = abortFn;
      return promise;
    },

    // 生命周期与 Action 智能纠偏
    onPluginEnter(callback) {
      let enterTriggered = false;

      const wrappedCallback = (action = {}) => {
        enterTriggered = true;
        const normalized = { ...action };

        // 核心纠偏：杜绝 default / main 或未匹配 code 导致无匹配逻辑
        if (
          !normalized.code ||
          normalized.code === "default" ||
          normalized.code === "main" ||
          !KNOWN_CODES.includes(normalized.code)
        ) {
          normalized.code = "editor";
        }

        if (!normalized.type) {
          normalized.type = "text";
        }
        if (normalized.payload === undefined) {
          normalized.payload = "";
        }

        console.log(`[regex-editor] onPluginEnter dispatching code: "${normalized.code}", type: "${normalized.type}"`);
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
          wrappedCallback({ code: "editor", type: "text", payload: "" });
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
