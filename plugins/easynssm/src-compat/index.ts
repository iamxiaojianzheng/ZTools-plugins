/**
 * Ruck 兼容垫片装配入口
 * 注入 window.ztools / window.utools 与 window.services 契约，接管全局 Escape 退出机制
 */

import { createZtoolsBridge } from './ztools'
import { services } from './services'

function initCompatLayer() {
  if (typeof window === 'undefined') return

  const ztoolsBridge = createZtoolsBridge()

  // 挂载 ztools 与 utools 宿主接口
  ;(window as any).ztools = ztoolsBridge
  ;(window as any).utools = ztoolsBridge

  // 挂载 services 服务接口
  ;(window as any).services = services

  // 治理全局 Escape 退出事件
  if (typeof window.addEventListener === 'function') {
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // 若当前输入框中有内容，不退出，让输入框先响应清空
          const activeEl = document?.activeElement as HTMLInputElement | HTMLTextAreaElement
          if (
            activeEl &&
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
            activeEl.value
          ) {
            return
          }

          // 若当前存在活动弹窗（如 Element Plus 对话框/确认框），让弹窗自身先响应关闭
          const modal =
            typeof document?.querySelector === 'function' &&
            document.querySelector('.el-overlay:not([style*="display: none"])')
          if (modal) {
            return
          }

          event.preventDefault()
          ztoolsBridge.outPlugin()
        }
      },
      true
    )
  }

  console.log('✅ [@ruck-plugins/easynssm] Compat layer successfully initialized')
}

initCompatLayer()
