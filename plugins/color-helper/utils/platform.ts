/**
 * 平台 API 统一适配层
 * - 集中管理所有平台 API 调用
 * - 非平台环境提供 fallback
 * - 解耦业务代码与平台 API
 */

// 动态获取平台实例 (兼容 window.platform、window.ztools、window.utools)
export function getPlatform(): any {
  if (typeof window === 'undefined') return null;
  return window.platform || (window as any).ztools || (window as any).utools || null;
}

//  localStorage key 前缀 
const STORAGE_PREFIX = 'color_helper_';

// 环境检测
export const isPlatform = typeof window !== 'undefined' && !!(window.platform || (window as any).ztools || (window as any).utools);

//  dbStorage 适配 
export const dbStorage = {
  getItem(key: string): any {
    const platform = getPlatform();
    if (platform?.dbStorage) {
      return platform.dbStorage.getItem(key);
    }
    try {
      const v = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: any): void {
    const platform = getPlatform();
    if (platform?.dbStorage) {
      platform.dbStorage.setItem(key, value);
      return;
    }
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch { /* ignore */ }
  },

  removeItem(key: string): void {
    const platform = getPlatform();
    if (platform?.dbStorage) {
      platform.dbStorage.removeItem(key);
      return;
    }
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch { /* ignore */ }
  },
};

//  db 适配 
export const db = {
  get(id: string): any {
    const platform = getPlatform();
    if (platform?.db) {
      return platform.db.get(id);
    }
    try {
      const v = localStorage.getItem(`${STORAGE_PREFIX}db_${id}`);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },

  put(doc: any): { ok: boolean; id: string; rev?: string; error?: string } {
    const platform = getPlatform();
    if (platform?.db) {
      return platform.db.put(doc);
    }
    try {
      const id = doc._id;
      const existing = db.get(id);
      const rev = existing?._rev ? String(parseInt(existing._rev || '0') + 1) : '1';
      const toSave = { ...doc, _rev: rev };
      localStorage.setItem(`${STORAGE_PREFIX}db_${id}`, JSON.stringify(toSave));
      return { ok: true, id, rev };
    } catch (e: any) {
      return { ok: false, id: doc._id, error: e.message };
    }
  },

  remove(doc: any): { ok: boolean; error?: string } {
    const platform = getPlatform();
    if (platform?.db) {
      return platform.db.remove(doc);
    }
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}db_${doc._id}`);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },

  allDocs(key?: string): any[] {
    const platform = getPlatform();
    if (platform?.db) {
      return platform.db.allDocs(key);
    }
    try {
      const results: any[] = [];
      const prefix = `${STORAGE_PREFIX}db_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const v = localStorage.getItem(k);
          if (v) {
            const doc = JSON.parse(v);
            if (!key || doc._id.startsWith(key)) {
              results.push(doc);
            }
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  },
};

// 剪贴板
export function copyText(text: string): void {
  const platform = getPlatform();
  if (platform?.copyText) {
    platform.copyText(text);
    return;
  }
  try {
    navigator.clipboard.writeText(text);
  } catch {
    // fallback: textarea copy
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export function copyImage(dataUrl: string): void {
  const platform = getPlatform();
  if (platform?.copyImage) {
    platform.copyImage(dataUrl);
    return;
  }
  console.warn('[fallback] copyImage not supported in browser');
}

// 屏幕截图
export function screenCapture(callback: (imagePath: string) => void): void {
  const platform = getPlatform();
  if ((platform as any)?.screenCapture) {
    (platform as any).screenCapture(callback);
    return;
  }
  console.warn('[fallback] screenCapture not supported in browser');
}

// 屏幕取色
export function screenColorPick(callback: (result: { hex: string; rgb: string }) => void): void {
  const platform = getPlatform();
  if (platform?.screenColorPick) {
    platform.screenColorPick(callback);
    return;
  }
  // 非平台环境: 使用浏览器原生 EyeDropper API (Chrome 95+)
  if (typeof window !== 'undefined' && (window as any).EyeDropper) {
    const dropper = new (window as any).EyeDropper();
    dropper.open().then((result: any) => {
      callback({ hex: result.sRGBHex, rgb: '' });
    }).catch(() => { /* cancelled */ });
    return;
  }
  console.warn('[fallback] screenColorPick not supported');
}

// 窗口控制
export function hideMainWindow(): void {
  const platform = getPlatform();
  if (platform?.hideMainWindow) {
    platform.hideMainWindow();
    return;
  }
}

export function showMainWindow(): void {
  const platform = getPlatform();
  if (platform?.showMainWindow) {
    platform.showMainWindow();
    return;
  }
}

// 插件生命周期
export function onPluginEnter(callback: (action: { code: string; type: string; payload: string }) => void): void {
  const platform = getPlatform();
  if (platform?.onPluginEnter) {
    platform.onPluginEnter(callback);
    return;
  }
  // 非平台环境: 直接触发一次模拟进入
  setTimeout(() => callback({ code: 'color', type: 'text', payload: '' }), 100);
}

export function onPluginOut(callback: () => void): void {
  const platform = getPlatform();
  if (platform?.onPluginOut) {
    platform.onPluginOut(callback);
    return;
  }
}

//  AI API 
export function isAIAvailable(): boolean {
  const platform = getPlatform();
  const ruck = typeof window !== 'undefined' ? (window as any).ruck : null;
  return !!(ruck?.ai?.chat || ((platform as any)?.ai && typeof (platform as any).ai === 'function'));
}

export async function aiChat(messages: { role: string; content: string }[], model: string = 'doubao-1.5-pro-32k'): Promise<{ content: string }> {
  if (!isAIAvailable()) {
    throw new Error('当前版本不支持 AI 功能');
  }
  const platform = getPlatform();
  if ((platform as any)?.ai) {
    return (platform as any).ai({ model, messages });
  }
  const ruck = typeof window !== 'undefined' ? (window as any).ruck : null;
  if (ruck?.ai?.chat) {
    const rawModel = (model.startsWith('doubao-') || !model.trim()) ? '' : model.trim();
    const request = {
      model: rawModel,
      messages: messages.map(m => ({ role: m.role || 'user', content: String(m.content || '') }))
    };
    let res: any;
    try {
      res = await ruck.ai.chat({}, request);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (msg.includes('ChatRequestDto') || msg.includes('ProviderConfigDto')) {
        res = await ruck.ai.chat(request, {});
      } else {
        throw e;
      }
    }
    const content = typeof res === 'string' ? res : (res?.content || String(res || ''));
    return { content };
  }
  throw new Error('当前版本不支持 AI 功能');
}

// 文件对话框
export function showOpenDialog(options: any): string[] | undefined {
  const platform = getPlatform();
  if (platform?.showOpenDialog) {
    return platform.showOpenDialog(options);
  }
  return undefined;
}
