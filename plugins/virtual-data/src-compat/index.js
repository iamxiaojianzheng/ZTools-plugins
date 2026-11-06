/**
 * src-compat/index.js
 * Virtual-Data Ruck 兼容垫片主装配入口
 */
import { services } from './services.js';
import { createZtoolsBridge } from './ztools.js';
import { initDatabase } from './database.js';

// 1. 初始化数据库
initDatabase();

// 2. 挂载环境特征标志
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
window.IS_APP_VERSION4 = true;
window.isMacOs = isMac;

// 3. 挂载核心服务与宿主桥接
window.services = services;
window.ztools = createZtoolsBridge();
window.utools = window.ztools;

// 4. 全局 Escape 退出生命周期治理
function handleGlobalKeyDown(event) {
  if (event.key === 'Escape' || event.code === 'Escape') {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (activeEl.value) {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      window.ztools.outPlugin();
    } catch (e) {
      window.location.href = 'ruck://action/close-plugin';
    }
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', handleGlobalKeyDown, true);
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', handleGlobalKeyDown, true);
}

console.log('[VirtualData] Ruck 兼容层装配完成.');
