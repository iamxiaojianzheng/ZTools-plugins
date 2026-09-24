/**
 * TinyPNG 图片压缩 Ruck 兼容垫片主装配入口
 */
import { services, cleanupTempPath } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";

// 全局单例防重复挂载守卫
if (typeof window !== "undefined" && window.__RUCK_TINYPNG_COMPAT_MOUNTED__) {
  console.log("[TinyPNG] Ruck compat already mounted, skipping duplicate execution.");
} else {
  if (typeof window !== "undefined") {
    window.__RUCK_TINYPNG_COMPAT_MOUNTED__ = true;
  }

  // 1. 装配核心服务与宿主桥接
  const bridge = createZtoolsBridge();
  window.ztools = bridge;
  window.utools = bridge;
  window.services = services;

  // 2. 桥接进入与退出生命周期到 services
  bridge.onPluginEnter((action) => {
    services.handlePluginEnter(action);
  });

  bridge.onPluginOut((exit) => {
    cleanupTempPath(exit);
  });

  // 3. 全局 Escape 退出生命周期治理
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (activeEl.value) {
          return;
        }
      }

      if (document.querySelector("[role='dialog'], .el-overlay, .el-message-box")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      try {
        window.ztools?.outPlugin?.();
      } catch {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      }
    }
  }

  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("keydown", handleGlobalKeyDown, true);

  console.log("[TinyPNG] Ruck compatibility layer successfully mounted.");
}
