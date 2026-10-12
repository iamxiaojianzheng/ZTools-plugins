<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import ToolboxLayout from './toolbox/ToolboxLayout.vue'
import HomePage from './toolbox/HomePage.vue'
import { toolMap, type Tool } from './toolbox/tools'

const route = ref('')
const isDev = ref(false)

// 多标签状态：已开 tab（按打开顺序）+ 当前激活 tab（空串 = 无激活 tab，显示首页）
const openTabCodes = ref<string[]>([])
const activeCode = ref('')

// 常用工具：按打开/激活次数自动统计，持久化到 ZTools dbStorage（无宿主环境时仅内存）
const USAGE_KEY = 'devbox.toolUsage'
const FREQ_LIMIT = 8
const usageCounts = ref<Record<string, number>>({})

function loadUsage() {
  try {
    const raw = (window as any).ztools?.dbStorage?.getItem?.(USAGE_KEY)
    if (raw) usageCounts.value = JSON.parse(raw) || {}
  } catch {
    // 存储损坏时按空数据重新统计
  }
}

function persistUsage() {
  try {
    ;(window as any).ztools?.dbStorage?.setItem?.(USAGE_KEY, JSON.stringify(usageCounts.value))
  } catch {
    // 存储失败不影响使用，下次再试
  }
}

watch(usageCounts, persistUsage, { deep: true })

// 注册顺序索引：次数相同时按工具注册顺序稳定排序
const toolOrder = new Map([...toolMap.keys()].map((code, i) => [code, i]))

const frequentTools = computed<Tool[]>(() =>
  Object.entries(usageCounts.value)
    .filter(([code, count]) => count > 0 && toolMap.has(code))
    .sort(
      (a, b) =>
        (b[1] as number) - (a[1] as number) ||
        (toolOrder.get(a[0]) ?? 0) - (toolOrder.get(b[0]) ?? 0)
    )
    .slice(0, FREQ_LIMIT)
    .map(([code]) => toolMap.get(code) as Tool)
)

const openTabs = computed(() =>
  openTabCodes.value
    .map((code) => toolMap.get(code))
    .filter((t) => !!t)
)

const activeTool = computed(() => toolMap.get(activeCode.value) ?? null)

function setActive(code: string) {
  activeCode.value = code
}

/** 打开工具：已开则激活，未开则新开 tab 并激活；同时计入常用统计 */
function openTab(code: string) {
  if (!toolMap.has(code)) return
  if (!openTabCodes.value.includes(code)) {
    openTabCodes.value.push(code)
  }
  setActive(code)
  usageCounts.value[code] = (usageCounts.value[code] || 0) + 1
}

/** 关闭 tab：若是激活 tab 则激活右侧邻 tab（末尾则左侧），全部关完显示首页 */
function closeTab(code: string) {
  const idx = openTabCodes.value.indexOf(code)
  if (idx === -1) return
  openTabCodes.value.splice(idx, 1)
  if (activeCode.value !== code) return
  const next = openTabCodes.value[idx] || openTabCodes.value[idx - 1]
  setActive(next ?? '')
}

// 宿主把各入口都包装成 feature 触发传给 onPluginEnter，图标点击伪装固定回传 plugin.json
// 第一位的 home feature 的 code。因此判定逻辑可以极简：action.code 命中工具注册表即切换，
// 否则（home / 未知 code）保持现状——真实工具的进入不再依赖 payload 与 cmds 的比对，
// 拼音/模糊搜索词（如「suiji」）也能正确切换。

function setRoute(action?: any) {
  route.value = 'toolbox'
  // 只有携带真实工具 code 的进入才切换标签；图标点击伪装（回传首位的 home feature）、
  // 无指令进入等非工具 code 一律保持现状（无已开标签时显示首页）
  const code = action?.code
  if (code && toolMap.has(code)) {
    openTab(code)
  }
}

/** enter 事件统一处理（注册可能因宿主重载 preload 而多次进行，处理逻辑必须稳定） */
function handlePluginEnter(action: any) {
  setRoute(action)
}

onMounted(async () => {
  const ztools = (window as any).ztools

  loadUsage()

  if (!ztools) {
    isDev.value = true
    setRoute()
    return
  }

  ztools.setExpendHeight(600)

  // 注册 enter 事件：Ruck SDK 会在挂载时自动回放启动事件
  const registerEnter = () => {
    ;(window as any).ztools?.onPluginEnter?.(handlePluginEnter)
  }

  registerEnter()

  // 页面重新可见时（如窗口再次唤醒）做幂等保底注册
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      registerEnter()
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  ztools.onPluginOut(() => {
    // 插件只是隐藏到后台：保留 route 与全部标签状态，下次进入无缝恢复
    // （清空 route 会卸载整个页面，重进时若 enter 时序异常会导致黑屏）
  })

  await nextTick()
  setTimeout(() => {
    if (!route.value) {
      try {
        const action = ztools.getLaunchAction?.()
        setRoute(action)
      } catch (e) {
        setRoute()
      }
    }
  }, 100)
})
</script>

<template>
  <!-- 主视图：route 为空（enter 未到达的时序异常）时同样渲染，保证不黑屏 -->
  <ToolboxLayout
    v-if="route === 'toolbox' || !route"
    :tabs="openTabs"
    :active-code="activeCode"
    @select="openTab"
    @close="closeTab"
  >
    <!-- KeepAlive 保证切换/重开 tab 时各工具状态保留；无激活 tab 时显示首页 -->
    <KeepAlive>
      <component
        v-if="activeTool"
        :is="activeTool.component"
        :key="activeCode"
      />
    </KeepAlive>
    <HomePage
      v-if="!activeTool"
      :frequent="frequentTools"
      @select="openTab"
    />
  </ToolboxLayout>

  <!-- 开发模式提示（无宿主环境且 route 为空） -->
  <div v-if="isDev && !route" class="dev-hint">
    <p>开发模式：请在 ZTools 中使用插件</p>
  </div>
</template>

<style scoped>
.dev-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #666;
  font-size: 14px;
}
</style>
