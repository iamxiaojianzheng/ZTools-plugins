/**
 * window.ztools / window.utools 宿主桥接器
 * 连接 otp-2fa 前端与 Ruck (Tauri 2.0 / Webview2) 运行时
 */

import { db, initDatabase } from "./database.js";

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const isWin = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("WIN");

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

export function createZtoolsBridge() {
  let enterTriggered = false;
  let lastAction = null;
  let currentSubInputCallback = null;

  const bridge = {
    // 数据库集成
    db,

    // 同步 K-V 存储
    dbStorage: {
      getItem(key) {
        try {
          if (typeof localStorage === "undefined") return null;
          const v = localStorage.getItem(`otp_2fa_storage_${key}`);
          return v ? JSON.parse(v) : null;
        } catch {
          return null;
        }
      },
      setItem(key, value) {
        try {
          if (typeof localStorage === "undefined") return;
          localStorage.setItem(`otp_2fa_storage_${key}`, JSON.stringify(value));
        } catch {}
      },
      removeItem(key) {
        try {
          if (typeof localStorage === "undefined") return;
          localStorage.removeItem(`otp_2fa_storage_${key}`);
        } catch {}
      }
    },

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

    // 设备唯一标识 (保障硬件主密码自动解密在同一设备的一致性)
    getNativeId() {
      const ruck = getRuck();
      if (typeof ruck?.getNativeId === "function") {
        return String(ruck.getNativeId());
      }
      if (typeof ruck?.system?.getNativeId === "function") {
        return String(ruck.system.getNativeId());
      }
      const STORAGE_KEY_NATIVE_ID = "ruck_device_native_id";
      try {
        let id = localStorage.getItem(STORAGE_KEY_NATIVE_ID);
        if (!id) {
          id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `ruck_device_${Math.random().toString(36).substring(2)}`;
          localStorage.setItem(STORAGE_KEY_NATIVE_ID, id);
        }
        return id;
      } catch {
        return "ruck_default_device_id";
      }
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

    // 模拟键盘击键
    simulateKeyboardTap(key, modifier) {
      const ruck = getRuck();
      if (ruck?.system?.simulateKeyboardTap) {
        return ruck.system.simulateKeyboardTap(key, modifier);
      }
      const lowerKey = String(key || "").toLowerCase();
      if (lowerKey === "v") {
        if (ruck?.clipboard?.paste) {
          ruck.clipboard.paste("ctrl_v");
        }
      }
    },

    // 隐藏主窗并键入/粘贴字符串
    hideMainWindowTypeString(text) {
      const ruck = getRuck();
      this.copyText(String(text));
      this.hideMainWindow(true);
      if (ruck?.clipboard?.paste) {
        ruck.clipboard.paste("ctrl_v");
      } else {
        this.simulateKeyboardTap("v", this.isMacOs() ? "command" : "ctrl");
      }
      return true;
    },

    // 深色模式感知
    isDarkColors() {
      const ruck = getRuck();
      if (typeof ruck?.system?.isDark === "function") {
        return ruck.system.isDark();
      }
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return false;
    },

    // 外部链接打开
    shellOpenExternal(url) {
      const ruck = getRuck();
      if (ruck?.shell?.openExternal) {
        return ruck.shell.openExternal(url);
      }
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
        return true;
      }
      return false;
    },

    // 消息通知
    showNotification(body, clickFeatureCode) {
      const ruck = getRuck();
      if (ruck?.notification?.show) {
        return ruck.notification.show(body);
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("2FA动态验证码", { body });
          return true;
        } catch {}
      }
      console.log(`[Notification] ${body}`);
      return false;
    },

    // 子输入框驱动
    setSubInput(onChange, placeholder = "", isFocus = true) {
      currentSubInputCallback = onChange;
      const wrappedOnChange = (val) => {
        if (typeof onChange === "function") {
          const text =
            typeof val === "object" && val !== null ? val.text || "" : String(val || "");
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

    setSubInputValue(value) {
      const text = String(value || "");
      const ruck = getRuck();
      if (ruck?.ui?.setSubInputValue) {
        ruck.ui.setSubInputValue(text);
      } else if (ruck?.setSubInputValue) {
        ruck.setSubInputValue(text);
      }
      if (typeof currentSubInputCallback === "function") {
        currentSubInputCallback({ text });
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

    // 获取启动参数
    getLaunchAction() {
      return lastAction || { code: "otp-2fa", type: "text", payload: "" };
    },

    // 插件生命周期事件
    onPluginEnter(callback) {
      const ruck = getRuck();

      const trigger = async (action = {}) => {
        enterTriggered = true;
        try {
          await initDatabase(true);
        } catch (e) {
          console.warn("[OTP-2FA] initDatabase refresh failed on enter:", e);
        }
        const normalizedAction = {
          code: action.code || "otp-2fa",
          type: action.type || "text",
          payload: action.payload || ""
        };

        // 防御性归一化：若 Ruck 投递默认的 default/main，修正为合法的 otp-2fa
        if (
          !normalizedAction.code ||
          normalizedAction.code === "default" ||
          normalizedAction.code === "main"
        ) {
          normalizedAction.code = "otp-2fa";
        }

        lastAction = normalizedAction;
        try {
          callback(normalizedAction);
        } catch (err) {
          console.error("[OTP-2FA] onPluginEnter callback error:", err);
        }
      };

      if (ruck?.onPluginEnter) {
        ruck.onPluginEnter((action) => trigger(action));
      } else if (ruck?.on) {
        ruck.on("plugin-enter", (action) => trigger(action));
      }

      // 80ms 冷启动保底防假死
      setTimeout(() => {
        if (!enterTriggered) {
          trigger({ code: "otp-2fa" });
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
    },

    onMainPush(callback, onSelect) {
      const ruck = getRuck();
      if (typeof ruck?.onMainPush === "function") {
        return ruck.onMainPush(callback, onSelect);
      }
      if (typeof ruck?.lifecycle?.onMainPush === "function") {
        return ruck.lifecycle.onMainPush(callback, onSelect);
      }
    },

    // 功能特性配置
    getFeatures() {
      return [
        {
          code: "otp-2fa",
          explain: "管理和查看您的 2FA 动态验证码",
          icon: "logo.png",
          cmds: ["2fa", "otp", "验证码", "动态验证码", "otp-2fa", "yzm"]
        }
      ];
    },

    setFeature(feature) {
      return true;
    },

    removeFeature(code) {
      return true;
    }
  };

  return bridge;
}
