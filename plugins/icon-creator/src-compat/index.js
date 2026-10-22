/**
 * Ruck 兼容垫片装配入口
 * 负责在全局 window 上挂载 services 与 ztools，并提供 Escape 安全退出机制。
 */
import { createServices } from './services.js'
import { createZtoolsShim } from './ztools.js'

if (typeof window !== 'undefined') {
  // 注入 window.services (若未被宿主定义)
  if (!window.services) {
    window.services = createServices()
  }

  // 注入 window.ztools / window.utools (若未被宿主定义)
  if (!window.ztools) {
    const shim = createZtoolsShim()
    window.ztools = shim
    if (!window.utools) {
      window.utools = shim
    }
  }

  // 全局 Escape 键退出拦截（优先清空当前聚焦的输入框，空输入时退出插件）
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          if ('value' in active && active.value) {
            return
          }
        }
        if (window.ztools?.outPlugin) {
          window.ztools.outPlugin()
        }
      }
    },
    true
  )

  console.log('✅ [icon-creator] Ruck / Webview compatibility shim initialized.')
}
