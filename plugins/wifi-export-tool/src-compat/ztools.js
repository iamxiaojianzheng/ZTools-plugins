/**
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境
 */

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

export function createZtoolsBridge() {
  let enterCallback = null;
  let enterTriggered = false;

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
          console.warn("[ZTools Bridge] ruck.clipboard.writeText 异常:", e);
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      }

      // DOM fallback
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
        console.error("[ZTools Bridge] 剪贴板复制失败:", e);
        return false;
      }
    },

    /**
     * 动态设置窗口高度
     */
    setExpandHeight(height = 600) {
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
          console.error("[ZTools Bridge] onPluginEnter 执行异常:", e);
        }
      };

      const ruck = getRuck();
      if (ruck?.onPluginEnter && typeof ruck.onPluginEnter === "function") {
        ruck.onPluginEnter((action) => {
          triggerEnter(action);
        });
      }

      // 80ms 冷启动保底触发，防止 Webview2 事件丢失
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
      const ruck = getRuck();
      if (ruck?.onPluginOut && typeof ruck.onPluginOut === "function") {
        ruck.onPluginOut(callback);
      }
    }
  };

  return bridge;
}
