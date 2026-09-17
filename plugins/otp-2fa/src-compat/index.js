/**
 * src-compat/index.js
 * otp-2fa 兼容层装配入口，挂载全局对象与生命周期保底
 */

import { createZtoolsBridge } from "./ztools.js";
import { services } from "./services.js";
import { initDatabase } from "./database.js";
import { setupMainPushEngine } from "./main-push.js";

const bridge = createZtoolsBridge();

if (typeof window !== "undefined") {
  // 注入宿主 API 命名空间
  window.ztools = bridge;
  window.utools = bridge;
  window.services = services;
  window.platform = {
    isMac: bridge.isMacOs(),
    isWindows: bridge.isWindows()
  };

  // 装配 onMainPush 即时搜索与自动粘贴引擎
  setupMainPushEngine(bridge);

  // 全局 Escape 键安全退出插件监听
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
          activeEl.value
        ) {
          // 当前输入框有内容，优先让原生交互清空内容，避免意外关闭
          return;
        }
        event.preventDefault();
        window.ztools.outPlugin();
      }
    },
    true
  );

  // 初始化异步 IndexedDB 增量同步
  initDatabase().catch((err) => {
    console.warn("[OTP-2FA] Database init warning:", err);
  });
}
