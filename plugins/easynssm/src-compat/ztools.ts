/**
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境与生命周期控制
 */

function getRuck() {
  return typeof window !== 'undefined' && (window as any).ruck ? (window as any).ruck : null
}

const KNOWN_CODES = ['main']

function normalizeAction(action: any) {
  const normalized = { ...(action || {}) }
  // 核心纠偏：杜绝 default 或未匹配 code 导致页面无响应或空白
  if (!normalized.code || normalized.code === 'default' || !KNOWN_CODES.includes(normalized.code)) {
    normalized.code = 'main'
  }
  if (!normalized.type) normalized.type = 'text'
  if (normalized.payload === undefined) normalized.payload = ''
  return normalized
}

export function createZtoolsBridge() {
  const enterListeners = new Set<(action: any) => void>()
  const outListeners = new Set<() => void>()
  let fallbackTimer: any = null
  let hasReceivedRealEnter = false
  let isHostEventsBound = false

  const dispatchEnter = (action: any) => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    hasReceivedRealEnter = true
    const normalized = normalizeAction(action)

    enterListeners.forEach((listener) => {
      try {
        listener(normalized)
      } catch (e) {
        console.error('[ztools] onPluginEnter callback error:', e)
      }
    })
  }

  const dispatchOut = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }

    outListeners.forEach((listener) => {
      try {
        listener()
      } catch (e) {
        console.error('[ztools] onPluginOut callback error:', e)
      }
    })
  }

  // 绑定宿主级双轨事件通道 (仅绑定一次)
  const bindHostEventsOnce = () => {
    if (isHostEventsBound) return
    isHostEventsBound = true

    const ruck = getRuck()
    if (ruck?.onPluginEnter) {
      ruck.onPluginEnter(dispatchEnter)
    } else if (ruck?.on) {
      ruck.on('plugin-enter', dispatchEnter)
    }

    if (ruck?.onPluginOut) {
      ruck.onPluginOut(dispatchOut)
    } else if (ruck?.on) {
      ruck.on('plugin-out', dispatchOut)
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('ruck://plugin-enter', (event: any) => {
        dispatchEnter(event?.detail)
      })
      window.addEventListener('ruck://plugin-out', () => {
        dispatchOut()
      })
    }
  }

  bindHostEventsOnce()

  // 同步数据库存储（使用 localStorage 模拟 dbStorage，0ms 同步无阻塞）
  const dbStorageShim = {
    getItem(key: string): any {
      try {
        const raw = window.localStorage.getItem(`easynssm_db_${key}`)
        if (raw === null) return null
        try {
          return JSON.parse(raw)
        } catch {
          return raw
        }
      } catch {
        return null
      }
    },
    setItem(key: string, value: any) {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)
        window.localStorage.setItem(`easynssm_db_${key}`, serialized)
      } catch (e) {
        console.warn('[ztools] dbStorage setItem error:', e)
      }
    },
    removeItem(key: string) {
      try {
        window.localStorage.removeItem(`easynssm_db_${key}`)
      } catch (e) {
        console.warn('[ztools] dbStorage removeItem error:', e)
      }
    }
  }

  const bridge = {
    isRuck: true,

    dbStorage: dbStorageShim,

    /**
     * 写入剪贴板文本
     */
    copyText(text: string): boolean {
      const ruck = getRuck()
      if (ruck?.clipboard?.writeText && typeof ruck.clipboard.writeText === 'function') {
        try {
          ruck.clipboard.writeText(text)
          return true
        } catch (e) {
          console.warn('[ztools] ruck.clipboard.writeText error:', e)
        }
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
        return true
      }

      return false
    },

    /**
     * 窗口高度调整
     */
    setExpendHeight(height = 640) {
      const ruck = getRuck()
      if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === 'function') {
        ruck.window.setExpendHeight(height)
      } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === 'function') {
        ruck.setExpendHeight(height)
      }
    },

    setExpandHeight(height = 640) {
      bridge.setExpendHeight(height)
    },

    outPlugin(isKill = false) {
      const ruck = getRuck()
      if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === 'function') {
        ruck.window.outPlugin(isKill)
      } else if (ruck?.outPlugin && typeof ruck.outPlugin === 'function') {
        ruck.outPlugin(isKill)
      } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === 'function') {
        ruck.window.hideMainWindow()
      }
    },

    hideMainWindow(restorePreWindow = true) {
      const ruck = getRuck()
      if (ruck?.window?.hideMainWindow) {
        return ruck.window.hideMainWindow(restorePreWindow)
      }
      if (ruck?.hideMainWindow) {
        return ruck.hideMainWindow(restorePreWindow)
      }
      bridge.outPlugin()
    },

    shellOpenExternal(url: string) {
      const ruck = getRuck()
      if (ruck?.shell?.openExternal && typeof ruck.shell.openExternal === 'function') {
        ruck.shell.openExternal(url)
      } else if (ruck?.openExternal && typeof ruck.openExternal === 'function') {
        ruck.openExternal(url)
      } else if (typeof window !== 'undefined') {
        window.open(url, '_blank')
      }
    },

    /**
     * 文件/目录选择框（适配 Ruck 宿主对话框）
     */
    async showOpenDialog(options: any = {}): Promise<string[]> {
      const ruck = getRuck()
      const isDir = Boolean(
        options.directory ||
        (Array.isArray(options.properties) && (options.properties.includes('openDirectory') || options.properties.includes('directory')))
      )

      if (ruck?.window?.showOpenDialog && typeof ruck.window.showOpenDialog === 'function') {
        try {
          const res = await ruck.window.showOpenDialog({
            title: options.title,
            directory: isDir,
            multiple: Boolean(options.properties?.includes('multiSelections')),
            filters: options.filters
          })
          if (Array.isArray(res)) return res
          if (typeof res === 'string' && res) return [res]
          return []
        } catch (e) {
          console.warn('[ztools] ruck.window.showOpenDialog error:', e)
        }
      }

      if (ruck?.showOpenDialog && typeof ruck.showOpenDialog === 'function') {
        try {
          const res = await ruck.showOpenDialog({
            title: options.title,
            directory: isDir,
            multiple: Boolean(options.properties?.includes('multiSelections')),
            filters: options.filters
          })
          if (Array.isArray(res)) return res
          if (typeof res === 'string' && res) return [res]
          return []
        } catch (e) {
          console.warn('[ztools] ruck.showOpenDialog error:', e)
        }
      }

      return []
    },

    /**
     * 生命周期管理
     */
    onPluginEnter(callback: (action: any) => void) {
      if (typeof callback !== 'function') return () => {}

      bindHostEventsOnce()
      enterListeners.add(callback)

      // 1. 若宿主预先注入了 __ruck_enter_payload，在微任务中安全补发一次
      if (typeof window !== 'undefined' && (window as any).__ruck_enter_payload) {
        const initialPayload = (window as any).__ruck_enter_payload
        setTimeout(() => {
          if (enterListeners.has(callback)) {
            try {
              callback(normalizeAction(initialPayload))
            } catch (e) {
              console.error('[ztools] initial enter dispatch error:', e)
            }
          }
        }, 0)
      }

      // 2. 80ms 冷启动保底触发，防止某些环境事件被吞
      if (!hasReceivedRealEnter && !fallbackTimer) {
        fallbackTimer = setTimeout(() => {
          fallbackTimer = null
          if (!hasReceivedRealEnter) {
            dispatchEnter({ code: 'main', type: 'text', payload: '' })
          }
        }, 80)
      }

      return () => {
        enterListeners.delete(callback)
      }
    },

    onPluginOut(callback: () => void) {
      if (typeof callback !== 'function') return () => {}

      bindHostEventsOnce()
      outListeners.add(callback)

      return () => {
        outListeners.delete(callback)
      }
    }
  }

  return bridge
}
