/**
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境与声明周期控制
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
    setExpendHeight(height = 560) {
      const ruck = getRuck();
      if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
        ruck.window.setExpendHeight(height);
      } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
        ruck.setExpendHeight(height);
      }
    },

    setExpandHeight(height = 560) {
      bridge.setExpendHeight(height);
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
     * 显示主窗口
     */
    showMainWindow() {
      const ruck = getRuck();
      if (ruck?.window?.showMainWindow && typeof ruck.window.showMainWindow === "function") {
        ruck.window.showMainWindow();
      }
    },

    /**
     * 调起系统原生打开文件对话框
     */
    async showOpenDialog(options = {}) {
      const ruck = getRuck();
      if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === "function") {
        return await ruck.window.showOpenDialog(options);
      }
      return [];
    },

    /**
     * 获取 File 本地路径
     */
    getPathForFile(file) {
      const ruck = getRuck();
      if (ruck?.getPathForFile && typeof ruck.getPathForFile === "function") {
        return ruck.getPathForFile(file);
      }
      return file?.path || "";
    },

    /**
     * 监听插件激活/进入事件
     * 具备 80ms 冷启动保底与初始参数提取
     */
    onPluginEnter(callback) {
      if (typeof callback !== "function") return;
      enterCallback = callback;

      const triggerEnter = (action) => {
        if (enterTriggered) return;
        enterTriggered = true;

        const normalizedAction = action || {
          code: "file-unlocker",
          type: "text",
          payload: ""
        };

        try {
          enterCallback(normalizedAction);
        } catch (e) {
          console.error("[ZTools Bridge] onPluginEnter 执行异常:", e);
        }
      };

      // 1. 若宿主注入了 __ruck_enter_payload，立即触发
      if (typeof window !== "undefined" && window.__ruck_enter_payload) {
        triggerEnter(window.__ruck_enter_payload);
        return;
      }

      // 2. 挂接 Ruck 宿主监听
      const ruck = getRuck();
      if (ruck?.onPluginEnter && typeof ruck.onPluginEnter === "function") {
        ruck.onPluginEnter((action) => {
          triggerEnter(action);
        });
      }

      // 3. 80ms 冷启动保底触发，防止 Webview2 事件丢失
      setTimeout(() => {
        if (!enterTriggered) {
          triggerEnter({
            code: "file-unlocker",
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
