/**
 * Todo-Neo window.services 视窗服务抽象垫片
 * 维持与前端的类型契约，在非独立窗口环境下平滑降级
 */

export const FEATURE_FLAGS = {
  noteWindow: false,
  tomatoWindow: false
};

export const services = {
  featureFlags: FEATURE_FLAGS,

  openNote(_params = {}) {
    console.info("[TodoNeo] openNote called (feature disabled in standard Ruck UI mode)");
    return null;
  },

  openTomato(_taskId) {
    console.info("[TodoNeo] openTomato called (feature disabled in standard Ruck UI mode)");
    return null;
  },

  async pinToScreen(_args = {}) {
    return { pinned: false };
  },

  closeWindow() {
    if (typeof window !== "undefined" && window.ruck?.window?.outPlugin) {
      window.ruck.window.outPlugin();
      return;
    }
    window.close();
  }
};
