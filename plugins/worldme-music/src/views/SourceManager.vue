<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import InstallModal from '@/components/InstallModal.vue';
import ImportModal from '@/components/ImportModal.vue';
import { useSourceStore } from '@/stores/sources';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/composables/toast';

const store = useSourceStore();
const ui = useUiStore();

const showInstall = computed({
  get: () => ui.installOpen,
  set: (v: boolean) => (ui.installOpen = v),
});

const editing = ref<any>(null);
const varsForm = ref<Record<string, string>>({});
const showImport = ref(false);

function openVars(src: any) {
  editing.value = src;
  varsForm.value = { ...(src.userVariableValues || {}) };
}

async function saveVars() {
  await store.setUserVariables(editing.value.hash, varsForm.value);
  toast('配置已保存');
  editing.value = null;
}

function hostOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch (e) {
    return url;
  }
}
</script>

<template>
  <div class="view">
    <div class="head">
      <div>
        <h2>音源管理</h2>
        <p class="text-2">加载 MusicFree 协议的音源插件，扩展搜索与播放能力</p>
      </div>
      <div class="head-actions">
        <button class="btn" :disabled="!store.enabled.length" @click="showImport = true">
          <Icon name="link" :size="16" />导入单曲/歌单
        </button>
        <button class="btn primary" @click="showInstall = true"><Icon name="plus" :size="16" />添加音源</button>
      </div>
    </div>

    <div v-if="!store.list.length" class="empty card">
      <div class="empty-art"><Icon name="sparkles" :size="42" /></div>
      <h3>还没有音源</h3>
      <p class="text-2">
        播放器本身不内置任何音源。添加一个音源插件后，即可搜索、播放并获取歌词。
      </p>
      <button class="btn primary" @click="showInstall = true"><Icon name="plus" :size="16" />立即添加</button>
      <p class="tip text-3">音源为第三方代码，请仅加载可信来源，风险自负。</p>
    </div>

    <div v-else class="grid">
      <div v-for="src in store.list" :key="src.hash" class="src card" :class="{ off: !src.enabled }">
        <div class="avatar">{{ (src.platform || '?').slice(0, 1).toUpperCase() }}</div>
        <div class="info">
          <div class="name">
            {{ src.platform }}
            <span class="tag">v{{ src.version || '0.0.0' }}</span>
            <span v-if="src.stateCode" class="tag err">加载失败</span>
          </div>
          <div class="desc text-2 ellipsis">
            {{ src.author || '未知作者' }}
            <template v-if="hostOf(src.srcUrl)"> · {{ hostOf(src.srcUrl) }}</template>
          </div>
          <div class="chips">
            <span v-for="t in src.supportedSearchType || ['music']" :key="t" class="chip">{{ t }}</span>
          </div>
        </div>
        <div class="ops">
          <button class="switch" :class="{ on: src.enabled }" title="启用/停用"
            @click="store.setEnabled(src.hash, !src.enabled)">
            <span></span>
          </button>
          <button v-if="src.userVariables && src.userVariables.length" class="icon-btn" title="配置" @click="openVars(src)">
            <Icon name="settings" :size="17" />
          </button>
          <button v-if="src.srcUrl" class="icon-btn" title="更新" @click="store.update(src.hash)">
            <Icon name="refresh" :size="17" />
          </button>
          <button class="icon-btn danger" title="卸载" @click="store.uninstall(src.hash)">
            <Icon name="trash" :size="17" />
          </button>
        </div>
      </div>
    </div>

    <InstallModal v-if="showInstall" @close="showInstall = false" @done="() => {}" />
    <ImportModal v-if="showImport" @close="showImport = false" />

    <div v-if="editing" class="mask" @click.self="editing = null">
      <div class="modal card">
        <h3>{{ editing.platform }} · 参数配置</h3>
        <p class="text-2">这些变量会通过 <code>env.getUserVariables()</code> 提供给音源。</p>
        <div class="vars">
          <label v-for="v in editing.userVariables" :key="v.key">
            <span>{{ v.title || v.key }}</span>
            <input v-model="varsForm[v.key]" class="field" :placeholder="v.hint || v.key" />
          </label>
        </div>
        <div class="foot">
          <button class="btn ghost" @click="editing = null">取消</button>
          <button class="btn primary" @click="saveVars">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  overflow-y: auto;
  padding: 4px 26px 26px;
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 6px 0 20px;
}
.head h2 {
  margin: 0 0 6px;
  font-size: 24px;
  letter-spacing: 0.3px;
}
.head p {
  margin: 0;
  font-size: 13px;
}
.head-actions {
  display: flex;
  gap: 10px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 56px 24px;
  text-align: center;
}
.empty-art {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 14px 34px rgba(139, 92, 246, 0.4);
}
.empty h3 {
  margin: 6px 0 0;
  font-size: 18px;
}
.empty p {
  max-width: 380px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.tip {
  font-size: 12px;
  margin-top: 6px;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.src {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  transition: all 0.18s ease;
}
.src:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.src.off {
  opacity: 0.55;
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  background: var(--accent-grad);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.tag.err {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.4);
}
.desc {
  font-size: 12.5px;
  margin-top: 4px;
}
.chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.chip {
  font-size: 11px;
  color: var(--text-3);
  background: var(--panel-hover);
  padding: 2px 8px;
  border-radius: 6px;
}
.ops {
  display: flex;
  align-items: center;
  gap: 6px;
}
.switch {
  width: 40px;
  height: 23px;
  border-radius: 999px;
  background: var(--border-strong);
  position: relative;
  transition: background 0.2s ease;
  margin-right: 6px;
}
.switch span {
  position: absolute;
  top: 2.5px;
  left: 2.5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.switch.on {
  background: var(--accent-grad);
}
.switch.on span {
  transform: translateX(17px);
}
.danger:hover {
  color: #f87171;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}
.modal {
  width: min(520px, 92vw);
  padding: 22px;
}
.modal h3 {
  margin: 0 0 6px;
  font-size: 17px;
}
.modal p {
  margin: 0 0 16px;
  font-size: 12.5px;
}
.vars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 46vh;
  overflow-y: auto;
}
.vars label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}
.field {
  height: 42px;
  padding: 0 12px;
  border-radius: 11px;
  background: var(--panel-hover);
  border: 1px solid var(--border);
  width: 100%;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
