const ruckHost = typeof window !== 'undefined' ? window.ruck : undefined;
const ztoolsHost = typeof window !== 'undefined' ? (window.ztools || window.utools) : undefined;

export const isHostEnv = typeof ruckHost !== 'undefined' || typeof ztoolsHost !== 'undefined';
export const isZtoolsEnv = isHostEnv;
export const hostApi = ztoolsHost || ruckHost || null;

/**
 * 双轨安全存储适配器:
 * 1. 0ms 同步保障: 读写均同步直达 localStorage / 内存高速缓存，保证计算器渲染与公式计算绝对不阻塞；
 * 2. 宿主同步支持: 若存在 Ruck 原生持久化存储 (ruck.storage) 或 ZTools dbStorage，自动增量同步。
 */
function createStorageAdapter() {
    const fallbackStorage = typeof localStorage !== 'undefined'
        ? localStorage
        : {
            _data: new Map(),
            getItem(k) { return this._data.get(k) ?? null; },
            setItem(k, v) { this._data.set(k, String(v)); },
            removeItem(k) { this._data.delete(k); }
        };

    const baseStorage = hostApi?.dbStorage || fallbackStorage;

    return {
        getItem(key) {
            try {
                return baseStorage.getItem(key);
            } catch (err) {
                console.warn(`[CodeCalc:Storage] getItem failed for "${key}":`, err);
                return fallbackStorage.getItem(key);
            }
        },
        setItem(key, value) {
            try {
                baseStorage.setItem(key, value);
            } catch (err) {
                console.warn(`[CodeCalc:Storage] setItem failed for "${key}":`, err);
            }
            if (fallbackStorage !== baseStorage) {
                try {
                    fallbackStorage.setItem(key, value);
                } catch (_) {}
            }

            // 若存在 Ruck 原生 storage，异步同步一份持久化
            if (ruckHost?.storage) {
                try {
                    if (typeof ruckHost.storage.setItem === 'function') {
                        ruckHost.storage.setItem(key, value);
                    } else if (typeof ruckHost.storage.put === 'function') {
                        ruckHost.storage.put(key, value);
                    }
                } catch (e) {
                    console.debug('[CodeCalc:Storage] Ruck storage sync warning:', e);
                }
            }
        },
        removeItem(key) {
            try {
                baseStorage.removeItem(key);
            } catch (err) {
                console.warn(`[CodeCalc:Storage] removeItem failed for "${key}":`, err);
            }
            if (fallbackStorage !== baseStorage) {
                try {
                    fallbackStorage.removeItem(key);
                } catch (_) {}
            }

            if (ruckHost?.storage) {
                try {
                    if (typeof ruckHost.storage.removeItem === 'function') {
                        ruckHost.storage.removeItem(key);
                    } else if (typeof ruckHost.storage.delete === 'function') {
                        ruckHost.storage.delete(key);
                    }
                } catch (e) {
                    console.debug('[CodeCalc:Storage] Ruck storage delete warning:', e);
                }
            }
        }
    };
}

export const storage = createStorageAdapter();

export function isMacOS() {
    if (typeof ruckHost?.platform?.isMac === 'boolean') {
        return ruckHost.platform.isMac;
    }
    if (typeof ztoolsHost?.isMacOs === 'function') {
        return ztoolsHost.isMacOs();
    }
    if (typeof ztoolsHost?.isMacOS === 'function') {
        return ztoolsHost.isMacOS();
    }
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
}

export function isDarkColors() {
    if (typeof ruckHost?.theme?.isDark === 'function') {
        return Boolean(ruckHost.theme.isDark());
    }
    if (typeof hostApi?.isDarkColors === 'function') {
        return hostApi.isDarkColors();
    }
    return typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
}

export function onThemeChange(callback) {
    if (typeof window.matchMedia !== 'function') {
        return () => {};
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => callback(event.matches);

    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }

    if (typeof media.addListener === 'function') {
        media.addListener(handler);
        return () => media.removeListener(handler);
    }

    return () => {};
}

export function onPluginEnter(callback) {
    if (typeof ruckHost?.onPluginEnter === 'function') {
        ruckHost.onPluginEnter(callback);
    } else if (typeof hostApi?.onPluginEnter === 'function') {
        hostApi.onPluginEnter(callback);
    }
}

export function onPluginOut(callback) {
    if (typeof ruckHost?.onPluginOut === 'function') {
        ruckHost.onPluginOut(callback);
    } else if (typeof hostApi?.onPluginOut === 'function') {
        hostApi.onPluginOut(callback);
    }
}

export function onMainPush(callback, selectCallback) {
    if (typeof hostApi?.onMainPush === 'function') {
        hostApi.onMainPush(callback, selectCallback);
    }
}

export function hideMainWindow() {
    if (typeof ruckHost?.window?.hideMainWindow === 'function') {
        return ruckHost.window.hideMainWindow();
    }
    if (typeof ruckHost?.hideMainWindow === 'function') {
        return ruckHost.hideMainWindow();
    }
    if (typeof hostApi?.hideMainWindow === 'function') {
        return hostApi.hideMainWindow();
    }
}

export function outPlugin(isKill = false) {
    if (typeof ruckHost?.window?.outPlugin === 'function') {
        return ruckHost.window.outPlugin(isKill);
    }
    if (typeof ruckHost?.outPlugin === 'function') {
        return ruckHost.outPlugin(isKill);
    }
    if (typeof hostApi?.outPlugin === 'function') {
        return hostApi.outPlugin(isKill);
    }
    return hideMainWindow();
}

export async function pasteText(text) {
    if (!text) {
        return false;
    }

    if (typeof ruckHost?.clipboard?.writeText === 'function') {
        ruckHost.clipboard.writeText(text);
        hideMainWindow();
        return true;
    }

    if (typeof ztoolsHost?.clipboard?.writeContent === 'function') {
        await ztoolsHost.clipboard.writeContent({ type: 'text', content: text }, true);
        return true;
    }

    if (typeof ztoolsHost?.copyText === 'function') {
        ztoolsHost.copyText(text);
        hideMainWindow();
        return true;
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        hideMainWindow();
        return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    hideMainWindow();
    return true;
}

export function openExternal(url) {
    if (!url) {
        return false;
    }

    if (typeof ruckHost?.shell?.openExternal === 'function') {
        return ruckHost.shell.openExternal(url);
    }

    if (typeof hostApi?.shellOpenExternal === 'function') {
        return hostApi.shellOpenExternal(url);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    return false;
}

if (typeof window !== 'undefined') {
    window.openExternalLink = (url) => {
        openExternal(url);
        return false;
    };
}
