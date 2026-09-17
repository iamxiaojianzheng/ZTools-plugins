/**
 * Todo-Neo Ruck 兼容垫片主装配入口
 */

import { services } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";

// 全局单例防重复挂载守卫
if (typeof window !== "undefined" && window.__RUCK_TODO_NEO_COMPAT_MOUNTED__) {
  console.log("[TodoNeo] Ruck compat already mounted, skipping duplicate execution.");
} else {
  if (typeof window !== "undefined") {
    window.__RUCK_TODO_NEO_COMPAT_MOUNTED__ = true;
  }

  // 1. 装配核心服务与宿主桥接
const bridge = createZtoolsBridge();
window.ztools = bridge;
window.utools = bridge;
window.services = services;

// 2. 全局 Escape 退出生命周期治理
function handleGlobalKeyDown(event) {
  if (event.key === "Escape" || event.code === "Escape") {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      if (activeEl.value) {
        return;
      }
    }

    // 若当前有打开的模态弹窗或设置菜单，优先让组件自身的关闭处理
    if (document.querySelector("[role='dialog'], .modal, .dialog, .settings-modal")) {
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

console.log("[TodoNeo] Ruck compatibility layer successfully mounted.");

}
