<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import CoverImage from '@/components/CoverImage.vue';
import { useSourceStore } from '@/stores/sources';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { services } from '@/api/services';
import { toast } from '@/composables/toast';

const emit = defineEmits<{ (e: 'close'): void }>();

const sources = useSourceStore();
const player = usePlayerStore();
const library = useLibraryStore();

const mode = ref<'item' | 'sheet'>('item');
const hash = ref(sources.enabled[0]?.hash || '');
const text = ref('');
const loading = ref(false);
const error = ref('');
const result = ref<any[]>([]);

const source = computed(() => sources.list.find((s) => s.hash === hash.value));
const hints = computed(() => {
  const h = source.value?.hints || {};
  const list = mode.value === 'item' ? h.importMusicItem : h.importMusicSheet;
  return Array.isArray(list) ? list : [];
});

function switchMode(m: 'item' | 'sheet') {
  mode.value = m;
  result.value = [];
  error.value = '';
}

async function submit() {
  const q = text.value.trim();
  if (!hash.value) return (error.value = '请选择音源');
  if (!q) return (error.value = mode.value === 'item' ? '请输入单曲链接或 ID' : '请输入歌单链接或 ID');
  loading.value = true;
  error.value = '';
  result.value = [];
  try {
    if (mode.value === 'item') {
      const item = await services().music.importMusicItem(hash.value, q);
      if (!item) throw new Error('导入失败，请检查链接或音源参数');
      result.value = [item];
      toast('导入成功', 'success');
    } else {
      const list = await services().music.importMusicSheet(hash.value, q);
      if (!list || !list.length) throw new Error('导入失败，请检查链接或音源参数');
      result.value = list;
      toast(`导入成功，共 ${list.length} 首`, 'success');
    }
  } catch (e: any) {
    error.value = e?.message || '导入失败';
  } finally {
    loading.value = false;
  }
}

function playAll() {
  if (!result.value.length) return;
  player.playTrack(result.value[0], result.value);
}
function addAll() {
  result.value.forEach((t) => player.addToQueue(t));
  toast('已加入播放列表', 'success');
}
function favAll() {
  result.value.forEach((t) => {
    if (!library.isFavorite(t)) library.toggleFavorite(t);
  });
  toast('已收藏', 'success');
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal card">
      <div class="head">
        <div>
          <h3>导入单曲 / 歌单</h3>
          <p class="text-2">通过音源解析链接或 ID，导入到本地播放器</p>
        </div>
        <button class="icon-btn" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </div>

      <div class="row">
        <select v-model="hash" class="field select">
          <option v-for="s in sources.enabled" :key="s.hash" :value="s.hash">{{ s.platform }}</option>
        </select>
        <div class="seg">
          <button :class="{ on: mode === 'item' }" @click="switchMode('item')">单曲</button>
          <button :class="{ on: mode === 'sheet' }" @click="switchMode('sheet')">歌单</button>
        </div>
      </div>

      <textarea
        v-model="text"
        class="field code"
        rows="3"
        :placeholder="mode === 'item' ? '粘贴歌曲链接或 ID' : '粘贴歌单链接或 ID'"
        spellcheck="false"
      ></textarea>

      <ul v-if="hints.length" class="hints">
        <li v-for="(h, i) in hints" :key="i" class="text-3">{{ h }}</li>
      </ul>

      <div v-if="error" class="err"><Icon name="info" :size="15" />{{ error }}</div>

      <div v-if="result.length" class="result">
        <div class="result-head">
          <span class="text-2">解析到 {{ result.length }} 首</span>
          <div class="result-ops">
            <button class="btn" @click="playAll"><Icon name="play" :size="14" />播放</button>
            <button class="btn" @click="addAll"><Icon name="plus" :size="14" />加入列表</button>
            <button class="btn" @click="favAll"><Icon name="heart" :size="14" />收藏</button>
          </div>
        </div>
        <div class="tracks">
          <div v-for="(t, i) in result" :key="i" class="track">
            <CoverImage :src="t.artwork" :size="38" :radius="9" />
            <div class="t-meta">
              <div class="ellipsis">{{ t.title }}</div>
              <div class="ellipsis text-3">{{ t.artist }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="foot">
        <button class="btn ghost" @click="emit('close')">关闭</button>
        <button class="btn primary" :disabled="loading || !hash" @click="submit">
          <Icon v-if="loading" name="refresh" :size="15" class="spin" />
          {{ loading ? '解析中…' : '开始导入' }}
        </button>
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
}
.modal {
  width: min(600px, 92vw);
  max-height: 86vh;
  overflow-y: auto;
  padding: 22px;
  box-shadow: var(--shadow);
  animation: floatUp 0.22s ease;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.head h3 {
  margin: 0 0 4px;
  font-size: 18px;
}
.head p {
  margin: 0;
  font-size: 12px;
}
.row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.field {
  width: 100%;
  border-radius: 12px;
  background: var(--panel-hover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.select {
  height: 42px;
  padding: 0 12px;
}
.select option {
  background: var(--panel-solid);
  color: var(--text);
}
textarea.field {
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.5;
  font-family: inherit;
}
.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--panel-hover);
  border-radius: 11px;
  flex-shrink: 0;
}
.seg button {
  padding: 0 16px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text-2);
  transition: all 0.16s ease;
}
.seg button.on {
  background: var(--accent-grad);
  color: #fff;
}
.hints {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.6;
}
.err {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #f87171;
  font-size: 12.5px;
}
.result {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  margin-bottom: 10px;
}
.result-ops {
  display: flex;
  gap: 6px;
}
.result-ops .btn {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.tracks {
  max-height: 30vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.track {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--panel-hover);
}
.t-meta {
  min-width: 0;
  flex: 1;
  font-size: 12.5px;
}
.t-meta .text-3 {
  font-size: 11.5px;
  margin-top: 2px;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
</style>
