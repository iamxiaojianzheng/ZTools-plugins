/**
 * 开发百宝箱 (devbox) Ruck 兼容垫片主装配入口
 */
import { services } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";

// 1. 装配核心服务与宿主桥接
const bridge = createZtoolsBridge();
window.ztools = bridge;
window.utools = bridge;
window.platform = bridge;
window.services = services;

// 2. 全局 Escape 退出生命周期治理
function handleGlobalKeyDown(event) {
  if (event.key === "Escape" || event.code === "Escape") {
    // 若当前输入框中有输入内容，优先让输入框原生逻辑处理
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      if (activeEl.value) {
        return;
      }
    }

    // 若当前有打开的 Element Plus 模态弹窗，优先由模态框的 onClose 处理
    if (document.querySelector(".el-overlay:not([style*='display: none'])")) {
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

console.log("[Devbox] Ruck compatibility layer successfully mounted.");
