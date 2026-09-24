/**
 * WiFi 导出工具 - Ruck 兼容垫片主装配入口
 */
import { wifiService } from "./wifi/wifi-service.js";
import { createZtoolsBridge } from "./ztools.js";

// 1. 创建并挂载全局宿主 API
const ztoolsBridge = createZtoolsBridge();

if (typeof window !== "undefined") {
  window.wifiApi = wifiService;
  window.ztools = ztoolsBridge;
  window.utools = ztoolsBridge;
}

if (typeof globalThis !== "undefined") {
  globalThis.wifiApi = wifiService;
  globalThis.ztools = ztoolsBridge;
  globalThis.utools = ztoolsBridge;
}

// 2. 全局 Escape 快捷退出与模态弹窗拦截治理
function handleGlobalKeyDown(event) {
  if (event.key === "Escape" || event.code === "Escape") {
    // 若当前密码弹窗处于打开状态，由 index.js 的弹窗自身逻辑优先关闭
    const modal = document.getElementById("wifiModal");
    if (modal && modal.classList.contains("active")) {
      modal.classList.remove("active");
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // 若搜索输入框有输入内容，优先清空输入内容
    const searchInput = document.getElementById("searchInput");
    if (searchInput && document.activeElement === searchInput && searchInput.value) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      event.preventDefault();
      return;
    }

    // 默认行为：退出/隐藏插件
    event.preventDefault();
    event.stopPropagation();
    try {
      ztoolsBridge.outPlugin();
    } catch (e) {
      console.warn("[Ruck Compat] outPlugin 退出失败:", e);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", handleGlobalKeyDown, true);
}

console.log("[Ruck WiFi Compat] WiFi 兼容层与 API 挂载完成");
