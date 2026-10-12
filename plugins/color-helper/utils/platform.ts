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

  put(doc: any): { ok: boolean; id: string; rev?: string; error?: unknown } {
    const platform = getPlatform();
    if (platform?.db) {
      // 平台分支返回 DbReturn(ok 可选、error 是布尔), 归一化成与降级分支一致的形状
      const r = platform.db.put(doc);
      return {
        ok: r.ok !== false && !r.error,
        id: r.id,
        rev: r.rev,
        error: r.error ? (r.message ?? r.name ?? 'db.put failed') : undefined,
      };
    }
    try {
      const id = doc._id;
      const existing = db.get(id);
      const rev = existing?._rev ? String(parseInt(existing._rev || '0') + 1) : '1';
      const toSave = { ...doc, _rev: rev };
      localStorage.setItem(`${STORAGE_PREFIX}db_${id}`, JSON.stringify(toSave));
      return { ok: true, id, rev, error: undefined };
    } catch (e: any) {
      return { ok: false, id: doc?._id, error: e?.message ?? e };
    }
  },

  remove(doc: any): { ok: boolean; error?: unknown } {
    const platform = getPlatform();
    if (platform?.db) {
      const r = platform.db.remove(doc);
      return {
        ok: r.ok !== false && !r.error,
        error: r.error ? (r.message ?? r.name ?? 'db.remove failed') : undefined,
      };
    }
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}db_${doc._id}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  },

  allDocs(key?: string): any[] {
    const platform = getPlatform();
    if (platform?.db) {
      try {
        return platform.db.allDocs(key) ?? [];
      } catch {
        return [];
      }
    }
    const results: any[] = [];
    try {
      const prefix = `${STORAGE_PREFIX}db_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) {
          const doc = JSON.parse(localStorage.getItem(k) || '{}');
          if (!key || doc._id?.startsWith(key)) {
            results.push(doc);
          }
        }
      }
    } catch { /* ignore */ }
    return results;
  },
};

// 剪贴板

/** execCommand 回退: 非安全上下文(非 https / file)或 clipboard API 被拒时使用 */
function copyTextFallback(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function copyText(text: string): void {
  const platform = getPlatform();
  if (platform?.copyText) {
    platform.copyText(text);
    return;
  }
  // navigator.clipboard.writeText() 返回 Promise: API 不存在时同步抛、
  // 权限被拒时异步 reject —— 同步 try/catch 只接得住前者,
  // 两处都要落到 copyTextFallback 才算覆盖完整。
  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) {
    copyTextFallback(text);
    return;
  }
  try {
    clipboard.writeText(text).catch(() => copyTextFallback(text));
  } catch {
    copyTextFallback(text);
  }
}

/** 复制图片到剪贴板(仅平台支持); 浏览器无对等 API, 降级为下载
 *  浏览器不静默丢弃, 否则按钮点击后毫无反应 */
export function copyImage(dataUrl: string, filename = 'image.png'): void {
  const platform = getPlatform();
  if (platform?.copyImage) {
    platform.copyImage(dataUrl);
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// 屏幕截图
// 回调第二参 bounds 仅 Windows / Linux 有值(macOS 为 undefined)
export function screenCapture(
  callback: (imgBase64: string, bounds?: { x: number; y: number; width: number; height: number }) => void,
): void {
  const platform = getPlatform();
  if (platform?.screenCapture) {
    platform.screenCapture(callback);
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
  return !!(ruck?.ai?.chat || (platform?.ai && typeof platform.ai === 'function'));
}

/**
 * @param model 留空时宿主会选用用户已配置的默认模型(本地供应商优先)。
 *   传了宿主解析不出来的 ID 会直接报「未找到 AI 模型配置」, 所以一般不要传。
 *   确需指定时, 用 `allAiModels()` 取列表并回传其中的 id / value。
 */
export async function aiChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model?: string,
): Promise<{ role?: string; content?: string }> {
  if (!isAIAvailable()) {
    throw new Error('当前版本不支持 AI 功能');
  }
  const platform = getPlatform();
  if (platform?.ai && typeof platform.ai === 'function') {
    return platform.ai({ model, messages });
  }
  const ruck = typeof window !== 'undefined' ? (window as any).ruck : null;
  if (ruck?.ai?.chat) {
    const rawModel = (model && (model.startsWith('doubao-') || !model.trim())) ? '' : (model?.trim() || '');
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
// 宿主侧弹窗是异步的, 返回值可能是 undefined, 调用方必须容错。
export function showOpenDialog(options: any): string[] | undefined {
  const platform = getPlatform();
  if (platform?.showOpenDialog) {
    return platform.showOpenDialog(options);
  }
  return undefined;
}
