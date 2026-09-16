/**
 * window.ztools / window.utools 宿主桥接器
 * 连接 devbox 前端与 Ruck (Tauri 2.0 / Webview2) 运行时
 */

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const isWin = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN");

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

// 开发百宝箱已知合法业务 Feature Codes
const KNOWN_CODES = [
  "identity",
  "password",
  "number",
  "uuid",
  "color",
  "signature",
  "base64",
  "urlcodec",
  "pinyin",
  "qrcode",
  "htmlpreview",
  "timeconvert",
  "textcompress",
  "texttransform",
  "jsontool"
];

export function createZtoolsBridge() {
  let lastAction = null;

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

    // 剪贴板文本
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
      } catch {
        return false;
      }
    },

    // 剪贴板图片
    copyImage(imageData) {
      const ruck = getRuck();
      if (ruck?.clipboard?.writeImage) {
        ruck.clipboard.writeImage(imageData);
        return true;
      }
      // 现代浏览器原生剪贴板写入图片
      if (typeof window !== "undefined" && navigator.clipboard?.write && window.ClipboardItem) {
        try {
          const parts = String(imageData).split(",");
          const base64 = parts.length > 1 ? parts[1] : parts[0];
          const mimeMatch = String(imageData).match(/^data:(image\/\w+);/);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mime });
          navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]).catch(() => {});
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },

    // 窗口尺寸
    setExpendHeight(height) {
      const ruck = getRuck();
      if (ruck?.window?.setExpendHeight) {
        return ruck.window.setExpendHeight(height);
      }
      if (ruck?.setExpendHeight) {
        return ruck.setExpendHeight(height);
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
      console.warn("[Devbox] screenCapture is not supported in this environment");
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

    // 获取启动 Action
    getLaunchAction() {
      return lastAction || { code: "identity", type: "text", payload: "" };
    },

    // 生命周期与 Action 智能纠偏
    onPluginEnter(callback) {
      let enterTriggered = false;

      const wrappedCallback = (action = {}) => {
        enterTriggered = true;
        const normalized = { ...action };

        // 核心纠偏：杜绝 default / main 或未匹配 code 导致页面无选定工具
        if (
          !normalized.code ||
          normalized.code === "default" ||
          normalized.code === "main" ||
          !KNOWN_CODES.includes(normalized.code)
        ) {
          normalized.code = "identity";
        }

        if (!normalized.type) {
          normalized.type = "text";
        }
        if (normalized.payload === undefined) {
          normalized.payload = "";
        }

        lastAction = normalized;
        console.log(`[Devbox] onPluginEnter dispatching code: "${normalized.code}", type: "${normalized.type}"`);
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
          wrappedCallback({ code: "identity", type: "text", payload: "" });
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
