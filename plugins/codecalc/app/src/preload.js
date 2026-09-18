/**
 * CodeCalc Preload 独立自包含入口脚本
 * 负责:
 * 1. 核心计算引擎自包含装配与全局 CodeCalcCore 注入
 * 2. 启动时同步加载自定义函数/常数
 * 3. Ruck / ZTools / uTools 多宿主统一桥接
 * 4. onMainPush 搜索框即时计算与回车自动粘贴引擎 (参考 otp-2fa 规范)
 */

import {
  Calculator,
  OPERATORS,
  FUNCTIONS,
  CONSTANTS,
  updateCustomFromStorage,
  isFunctionDefinition,
  isConstantDefinition,
} from "../../core/calculator.js";

// 1. 全局挂载 CodeCalcCore 契约对象
const CodeCalcCore = {
  Calculator,
  OPERATORS,
  FUNCTIONS,
  CONSTANTS,
  updateCustomFromStorage,
  isFunctionDefinition,
  isConstantDefinition,
};

if (typeof window !== "undefined") {
  window.CodeCalcCore = CodeCalcCore;
}

// 2. 启动预热并同步自定义函数与常数
try {
  updateCustomFromStorage(Calculator, FUNCTIONS, CONSTANTS);
} catch (e) {
  console.warn("[CodeCalc:Preload] updateCustomFromStorage error:", e);
}

// 3. 多宿主统一桥接层 (若处于 Ruck 环境且未注入 ztools/utools，自动补齐)
function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

if (typeof window !== "undefined") {
  const ruck = getRuck();
  if (ruck && !window.ztools) {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/i.test(
        navigator.platform || navigator.userAgent || "",
      );
    const isWin =
      typeof navigator !== "undefined" &&
      /Win/i.test(navigator.platform || navigator.userAgent || "");

    const bridge = {
      isMacOs() {
        return isMac;
      },
      isMacOS() {
        return isMac;
      },
      isWindows() {
        return isWin;
      },
      isDarkColors() {
        if (typeof ruck.theme?.isDark === "function") {
          return Boolean(ruck.theme.isDark());
        }
        if (typeof window.matchMedia === "function") {
          return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
      },
      copyText(text) {
        if (ruck.clipboard?.writeText) {
          ruck.clipboard.writeText(text);
          return true;
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text);
          return true;
        }
        return false;
      },
      simulateKeyboardTap(key, modifier) {
        const lowerKey = String(key || "").toLowerCase();
        if (lowerKey === "v" && ruck?.clipboard?.paste) {
          ruck.clipboard.paste("ctrl_v");
        }
      },
      hideMainWindow(isRestorePreWindow = true) {
        if (ruck.window?.hideMainWindow)
          return ruck.window.hideMainWindow(isRestorePreWindow);
        if (ruck.hideMainWindow) return ruck.hideMainWindow(isRestorePreWindow);
      },
      showMainWindow() {
        if (ruck.window?.showMainWindow) return ruck.window.showMainWindow();
        if (ruck.showMainWindow) return ruck.showMainWindow();
      },
      outPlugin(isKill = false) {
        if (ruck.window?.outPlugin) return ruck.window.outPlugin(isKill);
        if (ruck.outPlugin) return ruck.outPlugin(isKill);
      },
      shellOpenExternal(url) {
        if (ruck.shell?.openExternal) return ruck.shell.openExternal(url);
        return window.open(url, "_blank", "noopener,noreferrer");
      },
      onPluginEnter(cb) {
        if (typeof cb !== "function") return;
        if (typeof ruck.onPluginEnter === "function") {
          ruck.onPluginEnter(cb);
        }
      },
      onPluginOut(cb) {
        if (typeof cb !== "function") return;
        if (typeof ruck.onPluginOut === "function") {
          ruck.onPluginOut(cb);
        }
      },
      onMainPush(callback, onSelect) {
        if (typeof ruck.onMainPush === "function") {
          return ruck.onMainPush(callback, onSelect);
        }
        if (typeof ruck.lifecycle?.onMainPush === "function") {
          return ruck.lifecycle.onMainPush(callback, onSelect);
        }
      },
      dbStorage:
        typeof localStorage !== "undefined"
          ? localStorage
          : typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : undefined,
    };

    window.ztools = bridge;
    window.utools = bridge;
  }
}

// 4. onMainPush 搜索框即时计算与回车自动粘贴引擎
function extractSearchQuery(payload) {
  let text = "";
  if (typeof payload === "string") {
    text = payload;
  } else if (payload && typeof payload === "object") {
    text =
      payload.searchWord ||
      payload.text ||
      payload.rawText ||
      payload.payload ||
      "";
  }
  return String(text || "").trim();
}

function isBase64(str) {
  str = str.trim();
  return /^(?=(?:.*[A-Za-z]){3,})(?:[A-Za-z0-9+\/]{4}){3,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(
    str,
  );
}

function handleRegexInput(code, rawQuery) {
  let expr = rawQuery.trim();
  if (!expr) return "";

  if (code === "quickcalc") {
    if (isBase64(expr)) {
      expr = "str(" + expr + ").unbase64";
    } else if (expr.endsWith("=")) {
      expr = expr.substring(0, expr.length - 1).trim();
    }
  } else if (code === "timestamp") {
    if (!expr.startsWith("@")) {
      expr = "@" + expr;
    }
    expr = expr.replace(/\//g, "-");
  }

  return expr;
}

function mainPushCallback(action) {
  try {
    const code = action?.code || "quickcalc";
    const rawQuery = extractSearchQuery(
      action?.payload !== undefined ? action.payload : action,
    );
    if (!rawQuery) return [];

    const expr = handleRegexInput(code, rawQuery);
    if (!expr) return [];

    const rslt = Calculator.calculate(expr);
    if (!rslt || rslt.value === undefined || rslt.value === null) {
      return [];
    }

    const valStr = String(rslt.value);
    let title = "点击回车直接复制并粘贴";
    if (code === "timestamp" && rslt.info) {
      const infoStr = Array.isArray(rslt.info)
        ? rslt.info.join(" ")
        : String(rslt.info);
      title = `${infoStr} (回车直接粘贴)`;
    } else if (code === "ts2date") {
      title = `时间戳转日期: ${valStr} (回车直接粘贴)`;
    } else {
      title = `${rawQuery} = ${valStr} (回车直接粘贴)`;
    }

    return [
      {
        text: valStr,
        title: title,
        description: "代码计算器即时结果",
        payload: {
          action: "paste",
          text: valStr,
          expr: rawQuery,
        },
      },
    ];
  } catch (err) {
    // 无法计算时静默返回空数组，不打扰搜索框
    return [];
  }
}

function mainPushSelect(action) {
  try {
    const option = action && (action.option || action);
    const text =
      option?.payload?.text ||
      option?.text ||
      (typeof action === "string" ? action : "");
    if (text) {
      const host =
        typeof window !== "undefined"
          ? window.ztools || window.utools || window.ruck
          : null;

      // 1. 优先调用 ZTools / uTools 官方无界面直接粘贴 API
      if (typeof host?.hideMainWindowPasteText === "function") {
        host.hideMainWindowPasteText(text);
        return false;
      }

      // 2. 写入剪贴板
      if (host?.clipboard?.writeText) {
        host.clipboard.writeText(text);
      } else if (typeof host?.copyText === "function") {
        host.copyText(text);
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        navigator.clipboard.writeText(text);
      }

      // 3. 隐藏主窗口
      if (typeof host?.hideMainWindow === "function") {
        host.hideMainWindow(true);
      } else if (typeof host?.window?.hideMainWindow === "function") {
        host.window.hideMainWindow(true);
      }

      // 4. 触发系统原生粘贴
      const ruck = getRuck();
      if (ruck?.clipboard?.paste) {
        ruck.clipboard.paste("ctrl_v");
      } else if (typeof host?.simulateKeyboardTap === "function") {
        const isMac =
          typeof host.isMacOs === "function"
            ? host.isMacOs()
            : /Mac/i.test(navigator.platform || "");
        host.simulateKeyboardTap("v", isMac ? "command" : "ctrl");
      }
    }
  } catch (err) {
    console.warn("[CodeCalc:Preload] mainPush onSelect error:", err);
  }
  return false; // 静默完成，不展开大窗口
}

// 统一注册入口
if (typeof window !== "undefined") {
  const host = window.ztools || window.utools || window.ruck;
  if (host && typeof host.onMainPush === "function") {
    try {
      host.onMainPush(mainPushCallback, mainPushSelect);
      console.log(
        "[CodeCalc:Preload] onMainPush engine registered successfully.",
      );
    } catch (e) {
      console.warn("[CodeCalc:Preload] Failed to register onMainPush:", e);
    }
  }
}
