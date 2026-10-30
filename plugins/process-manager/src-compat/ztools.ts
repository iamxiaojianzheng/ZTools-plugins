/**
 * window.ztools / window.utools 宿主桥接器
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境与生命周期控制
 */

function getRuck() {
  return typeof window !== 'undefined' && (window as any).ruck ? (window as any).ruck : null
}

const KNOWN_CODES = ['process']

function normalizeAction(action: any) {
  const normalized = { ...(action || {}) }
  // 核心纠偏：杜绝 default / main 或未匹配 code 导致页面无响应或空白
  if (!normalized.code || normalized.code === 'default' || normalized.code === 'main' || !KNOWN_CODES.includes(normalized.code)) {
    normalized.code = 'process'
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
  let currentSubInputCallback: ((param: { text: string }) => void) | null = null
  let isHostEventsBound = false

  const dispatchEnter = (action: any) => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    hasReceivedRealEnter = true
    const normalized = normalizeAction(action)

    enterListeners.forEach(listener => {
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

    outListeners.forEach(listener => {
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

  // 立即尝试绑定宿主事件通道
  bindHostEventsOnce()

  const bridge = {
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

      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        return true
      } catch (e) {
        console.error('[ztools] copyText failed:', e)
        return false
      }
    },

    /**
     * 子输入框适配
     */
    setSubInput(onChange: (input: { text: string }) => void, placeholder = '', isFocus = true) {
      currentSubInputCallback = onChange
      const wrappedOnChange = (val: any) => {
        if (typeof onChange === 'function') {
          const text = typeof val === 'object' && val !== null ? (val.text || '') : String(val || '')
          onChange({ text })
        }
      }

      const ruck = getRuck()
      if (ruck?.ui?.setSubInput) {
        return ruck.ui.setSubInput(wrappedOnChange, placeholder, isFocus)
      }
      if (ruck?.setSubInput) {
        return ruck.setSubInput(wrappedOnChange, placeholder, isFocus)
      }
    },

    removeSubInput() {
      currentSubInputCallback = null
      const ruck = getRuck()
      if (ruck?.ui?.removeSubInput) {
        return ruck.ui.removeSubInput()
      }
      if (ruck?.removeSubInput) {
        return ruck.removeSubInput()
      }
    },

    setSubInputValue(value: string) {
      const text = typeof value === 'string' ? value : String(value || '')
      const ruck = getRuck()
      if (ruck?.ui?.setSubInputValue) {
        ruck.ui.setSubInputValue(text)
      } else if (ruck?.setSubInputValue) {
        ruck.setSubInputValue(text)
      }

      // 主动反向触发插件注册的搜索回调以刷新列表
      if (typeof currentSubInputCallback === 'function') {
        try {
          currentSubInputCallback({ text })
        } catch (e) {
          console.error('[ztools] subInputCallback error on setSubInputValue:', e)
        }
      }
    },

    subInputFocus() {
      const ruck = getRuck()
      if (ruck?.ui?.subInputFocus) {
        return ruck.ui.subInputFocus()
      }
      if (ruck?.subInputFocus) {
        return ruck.subInputFocus()
      }
    },

    /**
     * 窗口控制
     */
    setExpendHeight(height = 560) {
      const ruck = getRuck()
      if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === 'function') {
        ruck.window.setExpendHeight(height)
      } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === 'function') {
        ruck.setExpendHeight(height)
      }
    },

    setExpandHeight(height = 560) {
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

    showMainWindow() {
      const ruck = getRuck()
      if (ruck?.window?.showMainWindow) {
        return ruck.window.showMainWindow()
      }
      if (ruck?.showMainWindow) {
        return ruck.showMainWindow()
      }
    },

    /**
     * 生命周期管理
     */
    onPluginEnter(callback: (action: any) => void) {
      if (typeof callback !== 'function') return () => {}

      // 确保宿主事件监听已连接
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
            dispatchEnter({ code: 'process', type: 'text', payload: '' })
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
