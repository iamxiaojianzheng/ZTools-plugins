<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import CoverImage from '@/components/CoverImage.vue';
import Slider from '@/components/Slider.vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';
import { useDownloadStore } from '@/stores/downloads';
import { lyricsWindowOpen, toggleDesktopLyrics } from '@/composables/desktopLyrics';
import { toast } from '@/composables/toast';
import { activeLineIndex } from '@/utils/lrc';
import { formatTime, QUALITY_LABELS } from '@/utils/format';

const player = usePlayerStore();
const library = useLibraryStore();
const settings = useSettingsStore();
const downloads = useDownloadStore();

const lineEls = ref<HTMLElement[]>([]);
const dragging = ref(false);
const dragVal = ref(0);
const volLocal = ref(player.volume);

const lines = computed(() => player.lyric.lines);
const activeIdx = computed(() => activeLineIndex(lines.value, player.position));
const displayPos = computed(() => (dragging.value ? dragVal.value : player.position));
const isFav = computed(() => (player.current ? library.isFavorite(player.current) : false));

const bgStyle = computed(() => {
  const art = player.current?.artwork;
  return art ? { backgroundImage: `url("${art}")` } : {};
});

function setLine(el: any, i: number) {
  if (el) lineEls.value[i] = el as HTMLElement;
}

watch(activeIdx, async (i) => {
  if (i < 0) return;
  await nextTick();
  lineEls.value[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

watch(
  () => player.volume,
  (v) => (volLocal.value = v)
);

function onProgressUpdate(v: number) {
  if (dragging.value) dragVal.value = v;
}
function onProgressStart() {
  dragging.value = true;
  dragVal.value = player.position;
}
function onProgressEnd(v: number) {
  dragging.value = false;
  player.seek(v);
}
function onVolUpdate(v: number) {
  volLocal.value = v;
}
function onVolEnd(v: number) {
  player.setVolume(v);
}
function addCurrent() {
  if (player.current) player.addToQueue(player.current);
}
function downloadCurrent() {
  if (!player.current) return;
  downloads.download(player.current);
  toast('已开始下载', 'success');
}
function toggleFav() {
  if (player.current) library.toggleFavorite(player.current);
}
</script>

<template>
  <div class="np">
    <div class="np-bg" :style="bgStyle"></div>
    <div class="np-blur"></div>
    <div class="np-scrim"></div>

    <header class="np-top">
      <div class="crumb">
        <Icon name="disc" :size="18" />
        <span>正在播放</span>
      </div>
      <button class="icon-btn" title="收起" @click="player.showNowPlaying = false">
        <Icon name="compress" :size="20" />
      </button>
    </header>

    <div class="np-body">
      <div class="np-left">
        <div class="disc" :class="{ spin: player.playing }">
          <div class="disc-groove"></div>
          <CoverImage :src="player.current?.artwork" :size="260" radius="50%" />
          <div class="disc-hole"></div>
        </div>
        <div class="info">
          <h1 class="ellipsis">{{ player.current?.title || '未播放' }}</h1>
          <p class="artist text-2 ellipsis">{{ player.current?.artist || '—' }}</p>
          <div class="pills">
            <span v-if="player.current?.album" class="tag">{{ player.current.album }}</span>
            <span v-if="player.current?.platform" class="tag">{{ player.current.platform }}</span>
            <span v-if="player.usedQuality" class="tag q">{{ QUALITY_LABELS[player.usedQuality] || player.usedQuality }}</span>
          </div>
          <div class="actions">
            <button class="btn" :class="{ liked: isFav }" @click="toggleFav">
              <Icon :name="isFav ? 'heart-fill' : 'heart'" :size="16" />{{ isFav ? '已收藏' : '收藏' }}
            </button>
            <button class="btn ghost" @click="addCurrent">
              <Icon name="plus" :size="16" />加入列表
            </button>
            <button class="btn ghost" @click="downloadCurrent">
              <Icon name="download" :size="16" />下载
            </button>
            <button class="btn ghost" :class="{ liked: lyricsWindowOpen }" @click="toggleDesktopLyrics">
              <Icon name="expand" :size="16" />桌面歌词
            </button>
          </div>
          <div v-if="player.srcError" class="err"><Icon name="info" :size="15" />{{ player.srcError }}</div>
        </div>
      </div>

      <div class="np-lyric">
        <div v-if="player.lyricLoading && !lines.length" class="lyric-loading">
          <div v-for="i in 6" :key="i" class="skeleton" style="height: 14px; margin-bottom: 14px" :style="{ width: 40 + Math.random() * 40 + '%' }"></div>
        </div>
        <div v-else-if="!lines.length" class="lyric-empty">
          <Icon name="music" :size="30" />
          <p>暂无歌词</p>
        </div>
        <div v-else class="lyric-scroll">
          <p
            v-for="(l, i) in lines"
            :key="i"
            :ref="(el) => setLine(el, i)"
            class="lrc-line"
            :class="{ active: i === activeIdx }"
            @click="player.seek(l.time)"
          >
            <span class="lrc-text">{{ l.text || '♪' }}</span>
            <span v-if="settings.showTranslation && l.translation" class="lrc-trans">{{ l.translation }}</span>
          </p>
        </div>
      </div>
    </div>

    <footer class="np-foot">
      <div class="np-time text-3">{{ formatTime(displayPos) }}</div>
      <div class="np-progress">
        <Slider
          :model-value="displayPos"
          :max="player.duration || 1"
          :step="0.1"
          @update:model-value="onProgressUpdate"
          @dragstart="onProgressStart"
          @dragend="onProgressEnd"
        />
      </div>
      <div class="np-time text-3">{{ formatTime(player.duration) }}</div>

      <div class="np-controls">
        <button class="icon-btn" @click="player.prev()"><Icon name="prev" :size="22" /></button>
        <button class="play-btn" @click="player.toggle()">
          <Icon :name="player.playing ? 'pause' : 'play'" :size="24" />
        </button>
        <button class="icon-btn" @click="player.next()"><Icon name="next" :size="22" /></button>
        <button
          class="icon-btn"
          :class="{ active: player.mode !== 'order' }"
          :title="player.modeLabel"
          @click="player.cycleMode()"
        >
          <Icon :name="player.modeIcon" :size="18" />
        </button>
      </div>

      <div class="np-vol">
        <button class="icon-btn" @click="player.toggleMute()">
          <Icon :name="player.muted || player.volume === 0 ? 'volume-mute' : 'volume'" :size="18" />
        </button>
        <Slider
          :model-value="player.muted ? 0 : volLocal"
          @update:model-value="onVolUpdate"
          @dragend="onVolEnd"
        />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.np {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}
.np-bg {
  position: absolute;
  inset: -20%;
  background-size: cover;
  background-position: center;
  filter: blur(80px) saturate(1.6);
  opacity: 0.55;
  transform: scale(1.1);
}
.np-blur {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 80% at 20% 0%, rgba(139, 92, 246, 0.35), transparent 60%),
    radial-gradient(120% 80% at 100% 100%, rgba(236, 72, 153, 0.3), transparent 60%);
}
.np-scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(2px);
}
.np-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px 8px;
}
.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}
.np-body {
  position: relative;
  flex: 1;
  display: flex;
  gap: 40px;
  padding: 10px 60px 10px;
  min-height: 0;
}
.np-left {
  width: 40%;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
}
.disc {
  position: relative;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.35));
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), inset 0 0 0 12px rgba(255, 255, 255, 0.04);
}
.disc-groove {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.disc :deep(.cover) {
  position: relative;
  z-index: 1;
}
.disc-hole {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: inset 0 0 0 6px rgba(255, 255, 255, 0.08);
  z-index: 2;
}
.disc.spin {
  animation: spin 24s linear infinite;
}
.info {
  text-align: center;
  max-width: 420px;
}
.info h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.artist {
  margin: 0 0 14px;
  font-size: 14px;
}
.pills {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.pills .q {
  color: var(--accent-2);
  border-color: rgba(236, 72, 153, 0.35);
}
.actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.btn.liked {
  color: #ff5b8a;
}
.err {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
  color: #f87171;
  font-size: 12.5px;
}
.np-lyric {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
}
.lyric-scroll {
  max-height: 64vh;
  overflow-y: auto;
  padding: 30vh 0;
  scrollbar-width: none;
}
.lyric-scroll::-webkit-scrollbar {
  display: none;
}
.lrc-line {
  margin: 0;
  padding: 9px 4px;
  font-size: 17px;
  line-height: 1.5;
  color: var(--text-3);
  transition: all 0.28s ease;
  cursor: pointer;
  transform-origin: left center;
}
.lrc-line:hover {
  color: var(--text-2);
}
.lrc-line.active {
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  text-shadow: 0 2px 20px rgba(139, 92, 246, 0.35);
}
.lrc-line.active .lrc-text {
  background: var(--accent-grad);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.lrc-trans {
  display: block;
  font-size: 13px;
  color: var(--text-3);
  margin-top: 3px;
}
.lrc-line.active .lrc-trans {
  color: var(--text-2);
  font-weight: 500;
}
.lyric-empty,
.lyric-loading {
  width: 100%;
  color: var(--text-3);
  text-align: center;
}
.lyric-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.np-foot {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 48px 26px;
}
.np-progress {
  flex: 1;
  display: flex;
  align-items: center;
}
.np-time {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 46px;
  text-align: center;
}
.np-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 10px;
}
.play-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 10px 28px rgba(139, 92, 246, 0.45);
  transition: transform 0.16s ease;
}
.play-btn:hover {
  transform: scale(1.06);
}
.np-vol {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 150px;
}
@media (max-width: 900px) {
  .np-left {
    min-width: 220px;
  }
  .disc {
    width: 220px;
    height: 220px;
  }
  .disc :deep(.cover) {
    width: 220px !important;
    height: 220px !important;
  }
}
</style>
