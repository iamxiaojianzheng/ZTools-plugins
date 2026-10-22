/** window.ztools 宿主能力的安全封装 */

export function ztools(): any {
  return (window as any).ztools || null;
}

export function isDark(): boolean {
  const zt = ztools();
  if (zt?.getThemeInfo) {
    try {
      const info = zt.getThemeInfo();
      if (info && typeof info.isDark === 'boolean') return info.isDark;
    } catch (e) {
      /* ignore */
    }
  }
  if (zt?.isDarkColors) {
    try {
      return !!zt.isDarkColors();
    } catch (e) {
      /* ignore */
    }
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

export function onThemeChange(cb: (dark: boolean) => void) {
  const zt = ztools();
  if (zt?.onThemeChange) {
    try {
      zt.onThemeChange((info: any) => cb(!!info?.isDark));
      return;
    } catch (e) {
      /* ignore */
    }
  }
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => cb(e.matches));
}

export function onPluginEnter(cb: (payload: string, code: string) => void) {
  const zt = ztools();
  if (!zt?.onPluginEnter) return;
  try {
    zt.onPluginEnter((param: any) => {
      const payload = typeof param?.payload === 'string' ? param.payload.trim() : '';
      cb(payload, param?.code || '');
    });
  } catch (e) {
    /* ignore */
  }
}

export function setSubInput(onChange: (text: string) => void, placeholder: string) {
  const zt = ztools();
  if (!zt?.setSubInput) return;
  try {
    zt.setSubInput((details: any) => onChange((details?.text || '').trim()), placeholder, true);
  } catch (e) {
    /* ignore */
  }
}

export function removeSubInput() {
  try {
    ztools()?.removeSubInput?.();
  } catch (e) {
    /* ignore */
  }
}

export function toast(message: string) {
  try {
    ztools()?.showToast?.(message);
  } catch (e) {
    /* ignore */
  }
}

export function openExternal(url: string) {
  try {
    ztools()?.shellOpenExternal?.(url);
  } catch (e) {
    window.open(url, '_blank');
  }
}
