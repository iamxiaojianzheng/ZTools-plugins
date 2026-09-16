/**
 * Memo-Quick-Paste Ruck 兼容垫片主装配入口
 */
import { services } from "./services.js";
import { createZtoolsBridge } from "./ztools.js";
import { initDatabase } from "./database.js";
import { setupImageEnhancements } from "./image-picker.js";

// 1. 初始化数据库与图片增强能力
initDatabase();
setupImageEnhancements();

// 2. 挂载环境特征标志
const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
window.IS_APP_VERSION4 = true;
window.isMacOs = isMac;

// 3. 挂载核心服务与宿主桥接
window.services = services;
window.ztools = createZtoolsBridge();
window.utools = window.ztools;

// 4. 全局 Escape 退出生命周期治理
function handleGlobalKeyDown(event) {
  if (event.key === "Escape" || event.code === "Escape") {
    // 若当前无模态弹窗或特殊聚焦状态，触发退出
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      // 若输入框有内容则优先清空或允许默认行为
      if (activeEl.value) {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      window.ztools.outPlugin();
    } catch (e) {
      window.location.href = "ruck://action/close-plugin";
    }
  }
}

window.addEventListener("keydown", handleGlobalKeyDown, true);
document.addEventListener("keydown", handleGlobalKeyDown, true);

console.log("[MemoQuickPaste] Ruck compatibility layer successfully mounted.");
