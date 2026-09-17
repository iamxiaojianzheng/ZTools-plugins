/**
 * 待办日历 (todos) Ruck 兼容垫片主装配入口
 */
import { services } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";
import { setupQuickAddEngine } from "./quick-add.js";
import { persistTodosData } from "./database.js";

// 全局单例防重复挂载守卫
if (typeof window !== "undefined" && window.__RUCK_TODOS_COMPAT_MOUNTED__) {
  console.log("[Todos] Ruck compat already mounted, skipping duplicate execution.");
} else {
  if (typeof window !== "undefined") {
    window.__RUCK_TODOS_COMPAT_MOUNTED__ = true;
  }

  // 1. 装配核心服务与宿主桥接
  const bridge = createZtoolsBridge();
  window.ztools = bridge;
  window.utools = bridge;
  window.services = services;

  // 2. 装配 onMainPush 快捷添加待办引擎
  setupQuickAddEngine(bridge);

  // 3. 安装 localStorage.setItem('todos-data') 透明落盘守卫，直通 ruck.db
  try {
    if (typeof localStorage !== "undefined") {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (key, value) {
        originalSetItem(key, value);
        if (key === "todos-data") {
          try {
            const parsed = JSON.parse(value);
            persistTodosData(parsed);
          } catch (err) {
            console.warn("[Todos] Failed to auto-persist todos-data:", err);
          }
        }
      };
    }
  } catch (e) {
    console.warn("[Todos] Failed to setup localStorage hook:", e);
  }

  // 2. 全局 Escape 退出生命周期治理
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (activeEl.value) {
          return;
        }
      }

      if (document.querySelector("[role='dialog'], .modal, .dialog")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      try {
        window.ztools.outPlugin();
      } catch {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      }
    }
  }

  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("keydown", handleGlobalKeyDown, true);

  console.log("[Todos] Ruck compatibility layer successfully mounted.");
}
