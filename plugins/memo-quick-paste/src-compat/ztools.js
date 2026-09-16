/**
 * window.ztools / window.utools 宿主适配器
 * 连接前端业务与 Ruck 运行时
 */
import { db } from "./database.js";
import { handleShowOpenDialog } from "./image-picker.js";

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

let currentSubInputCallback = null;

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

export function createZtoolsBridge() {
  const bridge = {
    db,

    // 平台识别
    isMacOs() {
      return isMac;
    },

    // 路径管理
    getPath(name) {
      if (name === "temp") {
        return "temp";
      }
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
      return false;
    },

    copyImage(imageData) {
      const ruck = getRuck();
      if (ruck?.clipboard?.writeImage) {
        ruck.clipboard.writeImage(imageData);
        return true;
      }
      return false;
    },

    // 快捷模拟按键粘贴
    simulateKeyboardTap(key, modifier) {
      const ruck = getRuck();
      const lowerKey = String(key || "").toLowerCase();
      if (lowerKey === "v") {
        // 调用 Ruck 原生 paste
        if (ruck?.clipboard?.paste) {
          ruck.clipboard.paste("ctrl_v");
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

    showOpenDialog(options = {}) {
      const handled = handleShowOpenDialog(options);
      if (handled !== undefined) {
        return handled;
      }
      const ruck = getRuck();
      if (ruck?.window?.showOpenDialog) {
        return ruck.window.showOpenDialog(options);
      }
      if (ruck?.showOpenDialog) {
        return ruck.showOpenDialog(options);
      }
      return null;
    },

    startDrag(filePath) {
      const ruck = getRuck();
      if (ruck?.window?.startDrag) {
        return ruck.window.startDrag(filePath);
      }
      if (ruck?.startDrag) {
        return ruck.startDrag(filePath);
      }
    },

    // 子输入框
    setSubInput(onChange, placeholder = "", isFocus = true) {
      currentSubInputCallback = onChange;
      const wrappedOnChange = (val) => {
        if (typeof onChange === "function") {
          const text = typeof val === "object" && val !== null ? (val.text || "") : String(val || "");
          onChange({ text });
        }
      };
      const ruck = getRuck();
      if (ruck?.ui?.setSubInput) {
        return ruck.ui.setSubInput(wrappedOnChange, placeholder, isFocus);
      }
      if (ruck?.setSubInput) {
        return ruck.setSubInput(wrappedOnChange, placeholder, isFocus);
      }
    },

    removeSubInput() {
      currentSubInputCallback = null;
      const ruck = getRuck();
      if (ruck?.ui?.removeSubInput) {
        return ruck.ui.removeSubInput();
      }
      if (ruck?.removeSubInput) {
        return ruck.removeSubInput();
      }
    },

    setSubInputValue(value) {
      const text = typeof value === "string" ? value : String(value || "");
      const ruck = getRuck();
      if (ruck?.ui?.setSubInputValue) {
        ruck.ui.setSubInputValue(text);
      } else if (ruck?.setSubInputValue) {
        ruck.setSubInputValue(text);
      }
      // 关键驱动：主动反向触发插件注册的 handleSearch 回调以刷新列表与分页！
      if (typeof currentSubInputCallback === "function") {
        try {
          currentSubInputCallback({ text });
        } catch (e) {
          console.error("[ztools] subInputCallback error on setSubInputValue:", e);
        }
      }
    },

    subInputFocus() {
      const ruck = getRuck();
      if (ruck?.ui?.subInputFocus) {
        return ruck.ui.subInputFocus();
      }
      if (ruck?.subInputFocus) {
        return ruck.subInputFocus();
      }
    },

    subInputBlur() {
      const ruck = getRuck();
      if (ruck?.ui?.subInputBlur) {
        return ruck.ui.subInputBlur();
      }
      if (ruck?.subInputBlur) {
        return ruck.subInputBlur();
      }
    },

    // 生命周期回调
    onPluginEnter(callback) {
      let enterTriggered = false;
      const wrappedCallback = (action = {}) => {
        enterTriggered = true;
        const normalized = { ...action };
        // 核心纠偏：获取用户现存的所有标签 feature codes
        const existingTags = bridge.getFeatures().map((f) => f.code);
        // 若 code 为 default、main、空、插件标识符或未知非标签字符串，统一智能降级为 collection 主界面模式
        if (
          !normalized.code ||
          normalized.code === "default" ||
          normalized.code === "main" ||
          (!["collection", "record", "search"].includes(normalized.code) && !existingTags.includes(normalized.code))
        ) {
          normalized.code = "collection";
        }
        if (!normalized.type) {
          normalized.type = "text";
        }
        console.log("[ztools] onPluginEnter executed with:", normalized);
        if (typeof callback === "function") {
          try {
            callback(normalized);
          } catch (e) {
            console.error("[ztools] callback in onPluginEnter failed:", e);
          }
        }
      };

      const ruck = getRuck();
      if (ruck?.onPluginEnter) {
        ruck.onPluginEnter(wrappedCallback);
      } else if (ruck?.lifecycle?.onPluginEnter) {
        ruck.lifecycle.onPluginEnter(wrappedCallback);
      }

      // 80ms 智能自愈保底：若宿主因冷启动或时序原因未派发 plugin-enter，主动触发 collection 兜底，防止挂在空白加载态
      setTimeout(() => {
        if (!enterTriggered) {
          console.log("[ztools] Auto-fallback triggering onPluginEnter for collection view");
          wrappedCallback({ code: "collection", type: "text" });
        }
      }, 80);
    },

    onPluginOut(callback) {
      const ruck = getRuck();
      if (ruck?.onPluginOut) {
        ruck.onPluginOut(callback);
      } else if (ruck?.lifecycle?.onPluginOut) {
        ruck.lifecycle.onPluginOut(callback);
      }
    },

    onMainPush(callback, onSelect) {
      const ruck = getRuck();
      if (ruck?.onMainPush) {
        ruck.onMainPush(callback, onSelect);
      } else if (ruck?.lifecycle?.onMainPush) {
        ruck.lifecycle.onMainPush(callback, onSelect);
      }
    },

    onDbPull(callback) {
      // 云同步回调兜底
      console.log("[MemoQuickPaste] onDbPull registered");
    },

    // 页面搜索
    findInPage(text, options) {
      const ruck = getRuck();
      if (ruck?.window?.findInPage) {
        return ruck.window.findInPage(text, options);
      }
    },

    stopFindInPage(action) {
      const ruck = getRuck();
      if (ruck?.window?.stopFindInPage) {
        return ruck.window.stopFindInPage(action);
      }
    },

    // 动态 Feature 管理 (备忘快贴标签 Tags 存储系统)
    getFeatures() {
      try {
        const raw = localStorage.getItem("ruck_memo_features");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) return list;
        }
      } catch (e) {
        console.error("[ztools] getFeatures parse error:", e);
      }
      return [];
    },

    setFeature(feature) {
      if (!feature || !feature.code) return false;
      try {
        const list = this.getFeatures();
        const idx = list.findIndex((item) => item.code === feature.code);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...feature };
        } else {
          list.push(feature);
        }
        localStorage.setItem("ruck_memo_features", JSON.stringify(list));
        return true;
      } catch (e) {
        console.error("[ztools] setFeature error:", e);
        return false;
      }
    },

    removeFeature(code) {
      if (!code) return false;
      try {
        const list = this.getFeatures();
        const filtered = list.filter((item) => item.code !== code);
        localStorage.setItem("ruck_memo_features", JSON.stringify(filtered));
        return true;
      } catch (e) {
        console.error("[ztools] removeFeature error:", e);
        return false;
      }
    },

    // 系统文件与路径打开
    shellOpenPath(filePath) {
      const ruck = getRuck();
      if (ruck?.shell?.openPath) {
        return ruck.shell.openPath(filePath);
      }
      if (ruck?.shell?.open) {
        return ruck.shell.open(filePath);
      }
      return false;
    },

    // 屏幕截图回退增强
    screenCapture(callback) {
      const ruck = getRuck();
      if (ruck?.notification?.message) {
        ruck.notification.message({
          content: "请使用系统快捷键截图后在窗口中直接粘贴图片",
          type: "info"
        });
      }
      // 监听下一次剪贴板是否有图片
      if (ruck?.clipboard?.readImage) {
        setTimeout(async () => {
          try {
            const imgB64 = await ruck.clipboard.readImage();
            if (imgB64 && typeof callback === "function") {
              callback(imgB64);
            }
          } catch (e) {}
        }, 1000);
      }
    }
  };

  return bridge;
}
