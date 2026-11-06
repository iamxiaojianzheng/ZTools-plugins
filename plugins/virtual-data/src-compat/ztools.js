/**
 * src-compat/ztools.js
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境
 */
import { db } from './database.js';

function getRuck() {
  return typeof window !== 'undefined' && window.ruck ? window.ruck : null;
}

const enterListeners = new Set();
const outListeners = new Set();

let lastAction = null;
let lastActionFingerprint = '';
let lastActionTime = 0;
let hostEventsInstalled = false;
let fallbackTimer = null;

/**
 * 规范化进入动作参数，将 Ruck 默认动作映射至业务入口
 */
function normalizeAction(rawAction = {}) {
  const normalized = { ...rawAction };
  const rawCode = String(normalized.code || '').trim();

  // 若传入 default/main 或包名，自动映射为虚拟数据的默认 code "xn"
  if (
    !rawCode ||
    rawCode === 'default' ||
    rawCode === 'main' ||
    rawCode === '@ruck-plugins/virtual-data' ||
    rawCode === 'virtual-data'
  ) {
    normalized.code = 'xn';
  } else {
    normalized.code = rawCode;
  }

  if (!normalized.type) {
    normalized.type = 'text';
  }
  if (normalized.payload === undefined) {
    normalized.payload = '';
  }
  return normalized;
}

export function dispatchPluginEnter(rawAction) {
  const normalized = normalizeAction(rawAction);
  const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
  const now = Date.now();

  // 300ms 内完全相同的事件视为重复派发，过滤防抖
  if (fingerprint === lastActionFingerprint && now - lastActionTime < 300) {
    return;
  }

  lastActionFingerprint = fingerprint;
  lastActionTime = now;
  lastAction = normalized;

  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  console.log(`[VirtualData] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);

  for (const listener of enterListeners) {
    try {
      listener(normalized);
    } catch (err) {
      console.error('[VirtualData] Error in onPluginEnter listener:', err);
    }
  }
}

export function dispatchPluginOut(processExit = false) {
  console.log('[VirtualData] dispatchPluginOut: processExit =', processExit);
  for (const listener of outListeners) {
    try {
      listener(processExit);
    } catch (err) {
      console.error('[VirtualData] Error in onPluginOut listener:', err);
    }
  }
}

function setupHostEventListeners() {
  if (hostEventsInstalled) return;
  hostEventsInstalled = true;

  const ruck = getRuck();

  // 1. 监听 Ruck 宿主官方进入事件
  if (typeof ruck?.onPluginEnter === 'function') {
    ruck.onPluginEnter((action) => {
      dispatchPluginEnter(action);
    });
  }

  // 2. 监听 Ruck 宿主官方切出事件
  if (typeof ruck?.onPluginOut === 'function') {
    ruck.onPluginOut((exit) => {
      dispatchPluginOut(exit);
    });
  }

  // 3. 150ms 冷启动保底：若无外部进入事件且已挂载监听器，派发默认进入指令
  fallbackTimer = setTimeout(() => {
    if (!lastAction && enterListeners.size > 0) {
      console.log('[VirtualData] 150ms auto-fallback triggering default onPluginEnter');
      dispatchPluginEnter({ code: 'xn', type: 'text', payload: '' });
    }
  }, 150);
}

export function createZtoolsBridge() {
  setupHostEventListeners();

  const bridge = {
    db,

    /**
     * 写入剪贴板文本
     */
    copyText(text) {
      const ruck = getRuck();
      if (ruck?.clipboard?.writeText && typeof ruck.clipboard.writeText === 'function') {
        try {
          ruck.clipboard.writeText(text);
          return true;
        } catch (e) {
          console.warn('[ZTools Bridge] ruck.clipboard.writeText 异常:', e);
        }
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      }
      return false;
    },

    /**
     * 弹出通知/轻提示
     */
    showNotification(body) {
      const ruck = getRuck();
      const content = String(body || '');
      if (ruck?.notification?.message && typeof ruck.notification.message === 'function') {
        ruck.notification.message({ content, type: 'info' });
        return;
      }
      if (ruck?.notification?.system && typeof ruck.notification.system === 'function') {
        ruck.notification.system({ body: content });
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('虚拟数据', { body: content });
      }
    },

    /**
     * 动态设置窗口高度
     */
    setExpendHeight(height = 600) {
      const ruck = getRuck();
      if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === 'function') {
        ruck.window.setExpendHeight(height);
      } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === 'function') {
        ruck.setExpendHeight(height);
      }
    },

    /**
     * 退出或切出插件
     */
    outPlugin(exit = false) {
      const ruck = getRuck();
      if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === 'function') {
        ruck.window.outPlugin();
      } else if (ruck?.outPlugin && typeof ruck.outPlugin === 'function') {
        ruck.outPlugin();
      } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === 'function') {
        ruck.window.hideMainWindow();
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.href = 'ruck://action/close-plugin';
      }
    },

    /**
     * 隐藏主窗口
     */
    hideMainWindow() {
      bridge.outPlugin();
    },

    /**
     * 监听插件激活/进入事件
     */
    onPluginEnter(callback) {
      if (typeof callback !== 'function') return () => {};
      enterListeners.add(callback);

      // 若已经有进入动作缓存，立即向新监听器回放
      if (lastAction) {
        try {
          callback(lastAction);
        } catch (e) {
          console.error('[ZTools Bridge] 回放进入事件异常:', e);
        }
      }

      return () => {
        enterListeners.delete(callback);
      };
    },

    /**
     * 监听插件切出事件
     */
    onPluginOut(callback) {
      if (typeof callback !== 'function') return () => {};
      outListeners.add(callback);
      return () => {
        outListeners.delete(callback);
      };
    },
  };

  return bridge;
}
