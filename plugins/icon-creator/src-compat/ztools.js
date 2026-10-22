/**
 * ztools 纯 Web 标准兼容垫片
 * 提供 window.ztools 宿主接口实现，平滑桥接至 window.ruck 运行时。
 */

function getRuck() {
  if (typeof window !== 'undefined' && window.ruck) {
    return window.ruck
  }
  return null
}

export function createZtoolsShim() {
  let enterCallback = null
  let outCallback = null
  let enterTriggered = false

  // 监听 Ruck 宿主生命周期事件
  const ruck = getRuck()
  if (ruck?.onPluginEnter) {
    try {
      ruck.onPluginEnter((action) => {
        enterTriggered = true
        if (typeof enterCallback === 'function') {
          enterCallback(action || { code: 'icon-creator', type: 'text' })
        }
      })
    } catch (e) {
      console.warn('[ztools-shim] 挂载 ruck.onPluginEnter 失败:', e)
    }
  }

  if (ruck?.onPluginOut) {
    try {
      ruck.onPluginOut((exit) => {
        if (typeof outCallback === 'function') {
          outCallback(exit)
        }
      })
    } catch (e) {
      console.warn('[ztools-shim] 挂载 ruck.onPluginOut 失败:', e)
    }
  }

  // 同步数据库存储（使用 localStorage 模拟 dbStorage，0ms 同步无阻塞）
  const dbStorageShim = {
    getItem(key) {
      try {
        const raw = window.localStorage.getItem(`ztools_db_${key}`)
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
    setItem(key, value) {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)
        window.localStorage.setItem(`ztools_db_${key}`, serialized)
      } catch (e) {
        console.warn('[ztools-shim] dbStorage setItem 失败:', e)
      }
    },
    removeItem(key) {
      try {
        window.localStorage.removeItem(`ztools_db_${key}`)
      } catch (e) {
        console.warn('[ztools-shim] dbStorage removeItem 失败:', e)
      }
    }
  }

  return {
    isRuck: true,

    onPluginEnter(callback) {
      enterCallback = callback
      // 80ms 冷启动保底：若宿主无消息派发，以默认指令触发一次，杜绝白屏
      setTimeout(() => {
        if (!enterTriggered && typeof enterCallback === 'function') {
          enterTriggered = true
          enterCallback({ code: 'icon-creator', type: 'text', data: '' })
        }
      }, 80)
    },

    onPluginOut(callback) {
      outCallback = callback
    },

    dbStorage: dbStorageShim,

    getPath(name) {
      if (name === 'downloads') return 'downloads'
      return ''
    },

    showSaveDialog(options = {}) {
      const currentRuck = getRuck()
      if (typeof currentRuck?.showSaveDialog === 'function') {
        try {
          return currentRuck.showSaveDialog(options)
        } catch {
          return ''
        }
      }
      return ''
    },

    copyText(text) {
      const currentRuck = getRuck()
      if (currentRuck?.clipboard?.writeText) {
        return currentRuck.clipboard.writeText(text)
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text)
      }
      return Promise.resolve()
    },

    outPlugin() {
      const currentRuck = getRuck()
      if (currentRuck?.window?.outPlugin) {
        currentRuck.window.outPlugin()
      } else if (currentRuck?.window?.hideMainWindow) {
        currentRuck.window.hideMainWindow()
      }
    },

    hideMainWindow() {
      const currentRuck = getRuck()
      if (currentRuck?.window?.hideMainWindow) {
        currentRuck.window.hideMainWindow()
      }
    },

    isDark() {
      const currentRuck = getRuck()
      if (typeof currentRuck?.theme?.isDark === 'function') {
        return currentRuck.theme.isDark()
      }
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return false
    }
  }
}
