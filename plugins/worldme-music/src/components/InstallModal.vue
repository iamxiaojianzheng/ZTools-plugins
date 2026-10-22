<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { useSourceStore } from '@/stores/sources';
import type { InstallProgress, InstallSummary, SubscriptionEntry } from '@/types';

const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>();

const store = useSourceStore();

const tab = ref<'url' | 'sub' | 'file' | 'code'>('url');
const url = ref('');
const subUrl = ref('');
const code = ref('');
const agreed = ref(false);
const error = ref('');

/* ---------------- 订阅导入状态 ---------------- */
const subStep = ref<'input' | 'select' | 'installing' | 'done'>('input');
const subDesc = ref('');
const subEntries = ref<SubscriptionEntry[]>([]);
const selected = ref<boolean[]>([]);
const progress = ref<{ done: number; total: number; current: string; status: string }>({
  done: 0,
  total: 0,
  current: '',
  status: '',
});
const progressLog = ref<Array<{ name: string; ok: boolean; error?: string }>>([]);
const summary = ref<InstallSummary | null>(null);
const busy = ref(false);

const selectedCount = computed(() => selected.value.filter(Boolean).length);
const allSelected = computed(
  () => subEntries.value.length > 0 && selectedCount.value === subEntries.value.length
);
const progressPercent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0
);
const failedResults = computed(() => (summary.value?.results || []).filter((r) => !r.ok));

function switchTab(next: 'url' | 'sub' | 'file' | 'code') {
  if (busy.value) return;
  tab.value = next;
  error.value = '';
}

function toggleAll(value: boolean) {
  selected.value = subEntries.value.map(() => value);
}

function toggle(i: number) {
  selected.value = selected.value.map((v, idx) => (idx === i ? !v : v));
}

async function fetchSub() {
  error.value = '';
  if (!subUrl.value.trim()) {
    error.value = '请输入订阅链接';
    return;
  }
  busy.value = true;
  try {
    const res = await store.fetchSubscription(subUrl.value.trim());
    subDesc.value = res.desc || '';
    subEntries.value = res.plugins;
    selected.value = res.plugins.map(() => true);
    if (!res.plugins.length) {
      error.value = '订阅中没有可用的音源';
      return;
    }
    subStep.value = 'select';
  } catch (e: any) {
    error.value = e?.message || '解析订阅失败';
  } finally {
    busy.value = false;
  }
}

function onProgress(p: InstallProgress) {
  progress.value = { done: p.done, total: p.total, current: p.current, status: p.status };
  if (p.status === 'ok' || p.status === 'fail') {
    progressLog.value = progressLog.value.concat({
      name: p.current,
      ok: p.status === 'ok',
      error: p.error,
    });
  }
}

async function installEntries(entries: SubscriptionEntry[], append: boolean) {
  if (!entries.length) return;
  error.value = '';
  busy.value = true;
  if (!append) {
    progress.value = { done: 0, total: entries.length, current: '', status: 'start' };
    progressLog.value = [];
    summary.value = null;
    subStep.value = 'installing';
  }
  try {
    const res = await store.installSelected(entries, onProgress);
    if (append && summary.value) {
      summary.value = {
        ok: summary.value.ok + res.ok,
        failed: summary.value.failed + res.failed,
        total: summary.value.total + res.total,
        results: summary.value.results.concat(res.results),
      };
    } else {
      summary.value = res;
    }
    subStep.value = 'done';
  } catch (e: any) {
    error.value = e?.message || '安装失败';
    if (!summary.value) subStep.value = 'select';
  } finally {
    busy.value = false;
  }
}

function startInstall() {
  const entries = subEntries.value.filter((_, i) => selected.value[i]);
  installEntries(entries, false);
}

function retryFailed() {
  const entries = failedResults.value.map((r) => ({ name: r.name, url: r.url }));
  installEntries(entries, true);
}

function backToInput() {
  subStep.value = 'input';
  error.value = '';
  summary.value = null;
  progressLog.value = [];
}

async function submit() {
  error.value = '';
  if (busy.value) return;
  busy.value = true;
  try {
    if (tab.value === 'url') {
      if (!url.value.trim()) throw new Error('请输入音源链接');
      await store.installFromUrl(url.value.trim());
    } else if (tab.value === 'file') {
      const res = await store.installFromFile();
      if (!res) return;
    } else if (tab.value === 'code') {
      if (!code.value.trim()) throw new Error('请粘贴音源代码');
      if (!agreed.value) throw new Error('请先确认音源安全须知');
      await store.installFromCode(code.value);
    }
    emit('done');
    emit('close');
  } catch (e: any) {
    error.value = e?.message || '安装失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mask" @click.self="!busy && emit('close')">
    <div class="modal card">
      <div class="head">
        <div>
          <h3>添加音源</h3>
          <p class="text-2">兼容 MusicFree 协议的音源插件（.js 单文件）</p>
        </div>
        <button class="icon-btn" :disabled="busy" @click="emit('close')">
          <Icon name="close" :size="18" />
        </button>
      </div>

      <div class="tabs">
        <button :class="{ on: tab === 'url' }" :disabled="busy" @click="switchTab('url')">
          <Icon name="link" :size="15" />链接安装
        </button>
        <button :class="{ on: tab === 'sub' }" :disabled="busy" @click="switchTab('sub')">
          <Icon name="cloud" :size="15" />订阅导入
        </button>
        <button :class="{ on: tab === 'file' }" :disabled="busy" @click="switchTab('file')">
          <Icon name="folder" :size="15" />本地文件
        </button>
        <button :class="{ on: tab === 'code' }" :disabled="busy" @click="switchTab('code')">
          <Icon name="code" :size="15" />粘贴代码
        </button>
      </div>

      <div class="body">
        <template v-if="tab === 'url'">
          <input v-model="url" class="field" placeholder="https://example.com/plugin.js" spellcheck="false" />
          <p class="hint">支持以 <code>.js</code> 结尾的音源直链，GitHub Raw / jsDelivr 会自动尝试镜像。</p>
        </template>

        <template v-else-if="tab === 'sub'">
          <template v-if="subStep === 'input'">
            <input v-model="subUrl" class="field" placeholder="https://example.com/plugins.json" spellcheck="false" />
            <p class="hint">
              订阅格式：<code>{ "plugins": [{ "name": "...", "url": "....js" }] }</code>。解析后可勾选要安装的音源。
            </p>
          </template>

          <template v-else-if="subStep === 'select'">
            <div class="sub-head">
              <div class="text-2">
                共 <b>{{ subEntries.length }}</b> 个音源，已选 <b>{{ selectedCount }}</b> 个
                <span v-if="subDesc" class="text-3"> · {{ subDesc }}</span>
              </div>
              <div class="sub-ops">
                <button class="btn ghost" @click="toggleAll(!allSelected)">
                  {{ allSelected ? '全不选' : '全选' }}
                </button>
              </div>
            </div>
            <div class="sub-list">
              <label v-for="(item, i) in subEntries" :key="item.url + i" class="sub-item">
                <input type="checkbox" :checked="selected[i]" @change="toggle(i)" />
                <div class="sub-meta">
                  <div class="sub-name ellipsis">{{ item.name || '未命名音源' }}</div>
                  <div class="sub-url ellipsis text-3">{{ item.url }}</div>
                </div>
                <span v-if="item.version" class="tag">v{{ item.version }}</span>
              </label>
            </div>
          </template>

          <template v-else-if="subStep === 'installing'">
            <div class="progress-info">
              <div class="progress-title">
                正在安装 {{ progress.done }} / {{ progress.total }}
                <span class="text-3">{{ progressPercent }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <div class="progress-current text-3 ellipsis">{{ progress.current || '准备中…' }}</div>
            </div>
            <div class="log-list">
              <div v-for="(l, i) in progressLog.slice(-8)" :key="i" class="log-item" :class="{ fail: !l.ok }">
                <Icon :name="l.ok ? 'check' : 'close'" :size="14" />
                <span class="ellipsis">{{ l.name }}</span>
                <span v-if="!l.ok" class="log-error ellipsis">{{ l.error }}</span>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="summary card-inset">
              <div class="summary-line">
                <span class="ok">成功 {{ summary?.ok || 0 }}</span>
                <span class="fail">失败 {{ summary?.failed || 0 }}</span>
                <span class="text-3">共 {{ summary?.total || 0 }}</span>
              </div>
              <div v-if="failedResults.length" class="failed-list">
                <div v-for="(r, i) in failedResults" :key="i" class="failed-item">
                  <div class="failed-name ellipsis">{{ r.name || r.url }}</div>
                  <div class="failed-error">{{ r.error }}</div>
                </div>
              </div>
              <div v-else class="all-ok"><Icon name="check" :size="16" />全部安装成功</div>
            </div>
          </template>
        </template>

        <template v-else-if="tab === 'file'">
          <button class="file-drop card" :disabled="busy" @click="submit">
            <Icon name="upload" :size="28" />
            <span>点击选择本地音源文件</span>
            <small class="text-3">支持 .js 与 .json 订阅</small>
          </button>
        </template>

        <template v-else>
          <textarea
            v-model="code"
            class="field code"
            rows="8"
            placeholder="// 粘贴 MusicFree 音源代码"
            spellcheck="false"
          ></textarea>
          <label class="agree">
            <input v-model="agreed" type="checkbox" />
            <span>我了解音源为第三方代码，将以本地权限运行，仅加载可信来源</span>
          </label>
        </template>

        <div v-if="error" class="err"><Icon name="info" :size="15" />{{ error }}</div>
      </div>

      <div class="foot">
        <template v-if="tab === 'sub' && subStep === 'select'">
          <button class="btn ghost" @click="backToInput">返回</button>
          <button class="btn primary" :disabled="busy || !selectedCount" @click="startInstall">
            安装所选（{{ selectedCount }}）
          </button>
        </template>
        <template v-else-if="tab === 'sub' && subStep === 'done'">
          <button v-if="failedResults.length" class="btn" :disabled="busy" @click="retryFailed">
            <Icon name="refresh" :size="15" />重试失败项
          </button>
          <button class="btn primary" @click="emit('done'); emit('close')">完成</button>
        </template>
        <template v-else-if="tab === 'sub' && subStep === 'installing'">
          <button class="btn" disabled>安装中…</button>
        </template>
        <template v-else>
          <button class="btn ghost" :disabled="busy" @click="emit('close')">取消</button>
          <button
            v-if="tab !== 'file'"
            class="btn primary"
            :disabled="busy"
            @click="tab === 'sub' ? fetchSub() : submit()"
          >
            <Icon v-if="busy" name="refresh" :size="15" class="spin" />
            {{ busy ? '处理中…' : tab === 'sub' ? '解析订阅' : '安装' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.2s ease;
}
.modal {
  width: min(620px, 92vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  padding: 22px;
  box-shadow: var(--shadow);
  animation: floatUp 0.22s ease;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.head h3 {
  margin: 0 0 4px;
  font-size: 18px;
}
.head p {
  margin: 0;
  font-size: 12px;
}
.tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--panel-hover);
  border-radius: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.tabs button {
  flex: 1;
  height: 34px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
  transition: all 0.16s ease;
}
.tabs button.on {
  background: var(--panel-solid);
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.body {
  min-height: 150px;
  overflow-y: auto;
  flex: 1;
}
.field {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: var(--panel-hover);
  border: 1px solid var(--border);
  font-size: 14px;
  transition: border-color 0.16s ease;
}
.field:focus {
  border-color: var(--accent-1);
}
textarea.field {
  height: auto;
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.5;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 12.5px;
}
.hint {
  font-size: 12px;
  color: var(--text-3);
  margin: 10px 2px 0;
}
.hint code,
code {
  background: var(--panel-hover);
  padding: 1px 5px;
  border-radius: 5px;
}
.agree {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  font-size: 12.5px;
  color: var(--text-2);
  cursor: pointer;
}
.agree input {
  margin-top: 2px;
}
.file-drop {
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-2);
  transition: all 0.16s ease;
}
.file-drop:hover {
  border-color: var(--accent-1);
  color: var(--text);
}
.err {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #f87171;
  font-size: 12.5px;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  flex-shrink: 0;
}
.spin {
  animation: spin 0.8s linear infinite;
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  margin-bottom: 10px;
}
.sub-head b {
  color: var(--accent-2);
}
.sub-ops .btn {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.sub-list {
  max-height: 42vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}
.sub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.16s ease;
}
.sub-item:hover {
  background: var(--panel-hover);
}
.sub-item input {
  margin: 0;
  flex-shrink: 0;
}
.sub-meta {
  flex: 1;
  min-width: 0;
}
.sub-name {
  font-size: 13px;
  font-weight: 500;
}
.sub-url {
  font-size: 11px;
  margin-top: 2px;
}
.progress-info {
  padding: 4px 2px 10px;
}
.progress-title {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}
.progress-track {
  height: 6px;
  border-radius: 6px;
  background: var(--panel-hover);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 6px;
  background: var(--accent-grad);
  transition: width 0.25s ease;
}
.progress-current {
  margin-top: 8px;
  font-size: 12px;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 26vh;
  overflow-y: auto;
}
.log-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  padding: 2px 4px;
}
.log-item.fail {
  color: #f87171;
}
.log-error {
  margin-left: auto;
  max-width: 55%;
  font-size: 11px;
  opacity: 0.85;
}
.card-inset {
  background: var(--panel-hover);
  border-radius: 12px;
  padding: 14px;
}
.summary-line {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
}
.summary-line .ok {
  color: #34d399;
  font-weight: 600;
}
.summary-line .fail {
  color: #f87171;
  font-weight: 600;
}
.failed-list {
  margin-top: 12px;
  max-height: 30vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.failed-item {
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.18);
}
.failed-name {
  font-size: 12.5px;
  font-weight: 500;
}
.failed-error {
  margin-top: 3px;
  font-size: 11.5px;
  color: #f87171;
  word-break: break-all;
}
.all-ok {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #34d399;
  font-size: 13px;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
}
</style>
