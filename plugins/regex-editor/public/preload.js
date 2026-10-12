(() => {
  // src-compat/services.js
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  var services = {
    // 读文件 (纯浏览器沙箱安全兜底)
    readFile(file) {
      console.warn("[services] readFile is restricted in browser sandbox:", file);
      return "";
    },
    // 文本写入并触发下载
    writeTextFile(text) {
      try {
        const filename = `${Date.now()}.txt`;
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        downloadBlob(blob, filename);
        return filename;
      } catch (err) {
        console.error("[regex-editor] writeTextFile failed:", err);
        return void 0;
      }
    },
    // Base64 图片写入并触发下载
    writeImageFile(base64Url) {
      try {
        const match = /^data:image\/([a-z0-9]+);base64,(.+)$/i.exec(base64Url);
        if (!match) return;
        const ext = match[1] || "png";
        const b64Data = match[2];
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${ext}` });
        const filename = `${Date.now()}.${ext}`;
        downloadBlob(blob, filename);
        return filename;
      } catch (err) {
        console.error("[regex-editor] writeImageFile failed:", err);
        return void 0;
      }
    }
  };

  // src-compat/ztools.js
  var isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  var isWin = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN");
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var KNOWN_CODES = ["editor"];
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
  function createZtoolsBridge() {
    const bridge2 = {
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
            new Notification("\u6B63\u5219\u53EF\u89C6\u7F16\u8F91\u5668", { body: String(body || "") });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                new Notification("\u6B63\u5219\u53EF\u89C6\u7F16\u8F91\u5668", { body: String(body || "") });
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
        if (bridge2.isAIAvailable()) {
          return [{ id: "", label: "\u9ED8\u8BA4\u914D\u7F6E\u6A21\u578B", description: "\u4F7F\u7528 Ruck \u8BBE\u7F6E\u4E2D\u7684\u5168\u5C40\u9ED8\u8BA4\u6A21\u578B" }];
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
        bridge2.showNotification("\u8BF7\u5728 Ruck \u8BBE\u7F6E\u4E2D\u5FC3\u914D\u7F6E AI \u63D0\u4F9B\u5546\u53CA\u9ED8\u8BA4\u6A21\u578B");
      },
      // 判定 AI 能力是否可用
      isAIAvailable() {
        const ruck = getRuck();
        return !!(ruck?.ai?.chat || typeof ruck?.ai === "function");
      },
      // AI 对话与生成（支持普通 Promise 和带有 (chunk) => void 的流式）
      ai(options = {}, onChunk) {
        const ruck = getRuck();
        if (!bridge2.isAIAvailable()) {
          const errorPromise = Promise.reject(new Error("\u5F53\u524D\u73AF\u5883\u672A\u914D\u7F6E AI \u80FD\u529B\u652F\u6301"));
          errorPromise.abort = () => {
          };
          return errorPromise;
        }
        const rawModel = options.model || "";
        const model = rawModel.startsWith("doubao-") || !rawModel.trim() ? "" : rawModel.trim();
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
        if (typeof onChunk === "function") {
          const promise2 = (async () => {
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
            const res = await invokeRuckAiChat(ruck, request);
            if (isAborted) throw new Error("Aborted");
            const text = typeof res === "string" ? res : res?.content || String(res || "");
            onChunk({ content: text });
            return { content: text };
          })();
          promise2.abort = abortFn;
          return promise2;
        }
        const promise = (async () => {
          if (ruck?.ai?.chat) {
            const res = await invokeRuckAiChat(ruck, request);
            if (isAborted) throw new Error("Aborted");
            const content = typeof res === "string" ? res : res?.content || String(res || "");
            return { content };
          }
          if (typeof ruck?.ai === "function") {
            const res = await ruck.ai(options);
            if (isAborted) throw new Error("Aborted");
            const content = typeof res === "string" ? res : res?.content || String(res || "");
            return { content };
          }
          throw new Error("\u5F53\u524D\u73AF\u5883\u672A\u914D\u7F6E AI \u80FD\u529B\u652F\u6301");
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
          if (!normalized.code || normalized.code === "default" || normalized.code === "main" || !KNOWN_CODES.includes(normalized.code)) {
            normalized.code = "editor";
          }
          if (!normalized.type) {
            normalized.type = "text";
          }
          if (normalized.payload === void 0) {
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
    return bridge2;
  }

  // src-compat/index.js
  var bridge = createZtoolsBridge();
  window.ztools = bridge;
  window.utools = bridge;
  window.platform = bridge;
  window.services = services;
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (activeEl.value) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        window.ztools.outPlugin();
      } catch (e) {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      }
    }
  }
  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("keydown", handleGlobalKeyDown, true);
  console.log("[RegexEditor] Ruck compatibility layer successfully mounted.");
})();
