<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const CHANNEL = 'wm-desktop-lyrics';
const STATE_KEY = 'wm:lyrics:state';
const FONT_KEY = 'wm:lyrics:font';

const state = ref<any>(null);

function initialFont(): number {
  try {
    return Number(localStorage.getItem(FONT_KEY) || 32);
  } catch (e) {
    return 32;
  }
}
const fontSize = ref(initialFont());

const syncInfo = (() => {
  try {
    const p = new URLSearchParams(location.search);
    return { port: p.get('port') || '', token: p.get('token') || '' };
  } catch (e) {
    return { port: '', token: '' };
  }
})();

const text = computed(() => state.value?.text || '');
const translation = computed(() => state.value?.translation || '');
const pct = computed(() => Math.max(0, Math.min(1, state.value?.progress || 0)) * 100);
const hasText = computed(() => !!text.value);

let channel: BroadcastChannel | null = null;
let pollTimer: any = null;
let syncTimer: any = null;
let fetching = false;

function apply(payload: any) {
  if (payload && payload.type === 'state' && payload.state) state.value = payload.state;
  else if (payload && payload.text !== undefined) state.value = payload;
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.state) state.value = data.state;
  } catch (e) {
    /* ignore */
  }
}

/** 通过本地同步接口拉取（file:// 窗口下最可靠的通道） */
async function pollSync() {
  if (!syncInfo.port || fetching) return;
  fetching = true;
  try {
    const res = await fetch(
      `http://127.0.0.1:${syncInfo.port}/lyrics?token=${encodeURIComponent(syncInfo.token)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.state) state.value = data.state;
    }
  } catch (e) {
    /* ignore */
  } finally {
    fetching = false;
  }
}

function changeFont(delta: number) {
  fontSize.value = Math.max(18, Math.min(64, fontSize.value + delta));
  try {
    localStorage.setItem(FONT_KEY, String(fontSize.value));
  } catch (e) {
    /* ignore */
  }
}

function close() {
  window.close();
}

function onStorage(e: StorageEvent) {
  if (e.key === STATE_KEY) readStorage();
}

onMounted(() => {
  readStorage();
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      if (e.data?.type === 'cmd' && e.data.cmd === 'close') window.close();
      else apply(e.data);
    };
  } catch (e) {
    channel = null;
  }
  window.addEventListener('storage', onStorage);
  // localStorage 兜底轮询（跨窗口事件不可用时）
  pollTimer = setInterval(readStorage, 800);
  // 本地同步接口轮询
  if (syncInfo.port) {
    pollSync();
    syncTimer = setInterval(pollSync, 300);
  }
});

onUnmounted(() => {
  window.removeEventListener('storage', onStorage);
  if (pollTimer) clearInterval(pollTimer);
  if (syncTimer) clearInterval(syncTimer);
  try {
    channel?.close();
  } catch (e) {
    /* ignore */
  }
});
</script>

<template>
  <div class="root">
    <div class="win" :class="{ paused: state && !state.playing }">
      <div class="bar">
        <span class="dot" :class="{ playing: state?.playing }"></span>
        <span class="meta ellipsis">
          {{ state?.title || 'Worldme 音乐' }}
          <template v-if="state?.artist"> · {{ state.artist }}</template>
        </span>
        <div class="tools">
          <button class="tool" title="缩小字号" @click="changeFont(-2)">A-</button>
          <button class="tool" title="放大字号" @click="changeFont(2)">A+</button>
          <button class="tool close" title="关闭" @click="close">✕</button>
        </div>
      </div>

      <div class="line-wrap">
        <div v-if="hasText" class="line" :style="{ fontSize: fontSize + 'px' }">{{ text }}</div>
        <div v-else class="line placeholder" :style="{ fontSize: Math.max(16, fontSize - 10) + 'px' }">
          {{ state?.hasLyric ? '♪' : state?.title || 'Worldme 音乐 · 桌面歌词' }}
        </div>
        <div v-if="translation" class="trans" :style="{ fontSize: Math.max(13, fontSize - 14) + 'px' }">
          {{ translation }}
        </div>
      </div>

      <div class="progress"><div class="fill" :style="{ width: pct + '%' }"></div></div>
    </div>
  </div>
</template>

<style>
html,
body,
#lyrics {
  height: 100%;
  margin: 0;
  background: transparent;
  overflow: hidden;
}
* {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>

<style scoped>
.root {
  width: 100%;
  height: 100%;
  padding: 8px;
  display: flex;
}
.win {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  padding: 10px 26px 18px;
  border-radius: 22px;
  background: rgba(12, 12, 20, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(28px) saturate(1.6);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
  overflow: hidden;
  -webkit-app-region: drag;
  transition: opacity 0.25s ease;
}
.win.paused {
  opacity: 0.78;
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  height: 22px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  flex: none;
}
.dot.playing {
  background: #ec4899;
  box-shadow: 0 0 10px rgba(236, 72, 153, 0.8);
}
.meta {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.2px;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tools {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  -webkit-app-region: no-drag;
}
.win:hover .tools {
  opacity: 1;
}
.tool {
  height: 22px;
  min-width: 24px;
  padding: 0 6px;
  border-radius: 7px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
  border: none;
  cursor: pointer;
  transition: all 0.16s ease;
}
.tool:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
.tool.close:hover {
  background: rgba(248, 113, 113, 0.85);
}
.line-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 0;
}
.line {
  max-width: 100%;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
  background: linear-gradient(100deg, #ffffff 10%, #fbcfe8 50%, #a5f3fc 95%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 14px rgba(236, 72, 153, 0.35));
}
.line.placeholder {
  color: rgba(255, 255, 255, 0.5);
  -webkit-text-fill-color: rgba(255, 255, 255, 0.5);
  background: none;
  font-weight: 600;
  filter: none;
}
.trans {
  margin-top: 4px;
  max-width: 100%;
  color: rgba(255, 255, 255, 0.68);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.progress {
  position: absolute;
  left: 26px;
  right: 26px;
  bottom: 9px;
  height: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
  transition: width 0.3s linear;
}
</style>
