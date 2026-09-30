/**
 * 文件解锁器 - Ruck 兼容垫片主装配入口
 */

import { services } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";

// 1. 初始化待处理动作队列
if (typeof window !== "undefined") {
  window._utoolsPendingActions = window._utoolsPendingActions || [];
}

// 2. 创建并挂载全局宿主 API
const ztoolsBridge = createZtoolsBridge();

if (typeof window !== "undefined") {
  window.services = services;
  window.ztools = ztoolsBridge;
  window.utools = ztoolsBridge;
}

if (typeof globalThis !== "undefined") {
  globalThis.services = services;
  globalThis.ztools = ztoolsBridge;
  globalThis.utools = ztoolsBridge;
}

// 3. 拦截插件进入事件并存入队列，通知前端
ztoolsBridge.onPluginEnter((action) => {
  if (typeof window !== "undefined") {
    window._utoolsPendingActions.push(action);
    if (typeof window.onPluginEnter === "function") {
      try {
        window.onPluginEnter(action);
      } catch (e) {
        console.error("[Preload] onPluginEnter error:", e);
      }
    }
  }
});

// 4. 全局 Escape 快捷键退出与模态弹窗拦截治理
function handleGlobalKeyDown(event) {
  if (event.key === "Escape" || event.code === "Escape") {
    // 若当前有打开的模态框或右键菜单，让前端组件自带的 Esc 逻辑优先关闭
    const activeModal = typeof document !== "undefined" && typeof document.querySelector === "function"
      ? document.querySelector(".modal-overlay.show")
      : null;
    const contextMenu = typeof document !== "undefined" && typeof document.getElementById === "function"
      ? document.getElementById("contextMenu")
      : null;
    const isMenuOpen = contextMenu && contextMenu.style.display !== "none" && contextMenu.style.display !== "";

    if (activeModal || isMenuOpen) {
      // 允许事件冒泡给 app.js 处理关闭
      return;
    }

    // 若当前焦点在输入框且有内容，优先让输入框清空
    const activeEl = typeof document !== "undefined" ? document.activeElement : null;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") && activeEl.value) {
      return;
    }

    // 默认行为：退出插件
    event.preventDefault();
    event.stopPropagation();
    try {
      ztoolsBridge.outPlugin();
    } catch (e) {
      console.warn("[Preload] outPlugin failed:", e);
    }
  }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("keydown", handleGlobalKeyDown, true);
}

console.log("[Ruck FileUnlocker Compat] Preload 垫片层与 API 装配完成");
