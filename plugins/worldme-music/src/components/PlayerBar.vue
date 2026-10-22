<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import CoverImage from '@/components/CoverImage.vue';
import Slider from '@/components/Slider.vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { lyricsWindowOpen, toggleDesktopLyrics } from '@/composables/desktopLyrics';
import { formatTime, QUALITY_LABELS } from '@/utils/format';

const player = usePlayerStore();
const library = useLibraryStore();
const ui = useUiStore();

const dragging = ref(false);
const dragVal = ref(0);
const volLocal = ref(player.volume);

const displayPos = computed(() => (dragging.value ? dragVal.value : player.position));
const isFav = computed(() => (player.current ? library.isFavorite(player.current) : false));

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
function onVolumeUpdate(v: number) {
  volLocal.value = v;
}
function onVolumeEnd(v: number) {
  player.setVolume(v);
}
function toggleFav() {
  if (player.current) library.toggleFavorite(player.current);
}
</script>

<template>
  <div class="player-bar">
    <div class="progress-line">
      <Slider
        :model-value="displayPos"
        :max="player.duration || 1"
        :step="0.1"
        @update:model-value="onProgressUpdate"
        @dragstart="onProgressStart"
        @dragend="onProgressEnd"
      />
    </div>
    <div class="row">
      <div class="left">
        <CoverImage :src="player.current?.artwork" :size="52" :radius="12" class="thumb" @click="player.showNowPlaying = true" />
        <div class="meta">
          <div class="title ellipsis">{{ player.current?.title || '未播放' }}</div>
          <div class="artist ellipsis text-2">{{ player.current?.artist || '—' }}</div>
        </div>
        <button class="icon-btn" :class="{ active: isFav }" @click="toggleFav">
          <Icon :name="isFav ? 'heart-fill' : 'heart'" :size="18" />
        </button>
      </div>

      <div class="center">
        <div class="controls">
          <button class="icon-btn" title="上一首" :disabled="!player.canPrev" @click="player.prev()">
            <Icon name="prev" :size="20" />
          </button>
          <button class="play-btn" :class="{ buffering: player.buffering }" @click="player.toggle()">
            <Icon :name="player.playing ? 'pause' : 'play'" :size="22" />
          </button>
          <button class="icon-btn" title="下一首" :disabled="!player.canNext" @click="player.next()">
            <Icon name="next" :size="20" />
          </button>
          <button
            class="icon-btn"
            :class="{ active: player.mode !== 'order' }"
            :title="player.modeLabel"
            @click="player.cycleMode()"
          >
            <Icon :name="player.modeIcon" :size="18" />
          </button>
        </div>
        <div class="time text-3">
          <span>{{ formatTime(displayPos) }}</span>
          <span>/</span>
          <span>{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <div class="right">
        <span v-if="player.usedQuality" class="tag q">{{ QUALITY_LABELS[player.usedQuality] || player.usedQuality }}</span>
        <button class="icon-btn" title="歌词" @click="player.showNowPlaying = !player.showNowPlaying">
          <Icon name="disc" :size="18" />
        </button>
        <button
          class="icon-btn"
          :class="{ active: lyricsWindowOpen }"
          title="桌面歌词"
          @click="toggleDesktopLyrics"
        >
          <Icon name="expand" :size="18" />
        </button>
        <button class="icon-btn" title="播放列表" @click="ui.setView('queue')">
          <Icon name="list" :size="18" />
        </button>
        <button class="icon-btn" title="静音" @click="player.toggleMute()">
          <Icon :name="player.muted || player.volume === 0 ? 'volume-mute' : 'volume'" :size="18" />
        </button>
        <div class="vol">
          <Slider
            :model-value="player.muted ? 0 : volLocal"
            @update:model-value="onVolumeUpdate"
            @dragend="onVolumeEnd"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-bar {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  margin: 0 14px 14px;
  border-radius: var(--radius-lg);
  background: var(--panel);
  border: 1px solid var(--border);
  backdrop-filter: blur(26px) saturate(1.6);
  -webkit-backdrop-filter: blur(26px) saturate(1.6);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.progress-line {
  padding: 6px 16px 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 18px 12px;
}
.left {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 26%;
  min-width: 0;
}
.thumb {
  cursor: pointer;
}
.meta {
  min-width: 0;
  flex: 1;
}
.title {
  font-size: 13.5px;
  font-weight: 600;
}
.artist {
  font-size: 12px;
  margin-top: 3px;
}
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.play-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 8px 22px rgba(139, 92, 246, 0.4);
  transition: transform 0.16s ease;
}
.play-btn:hover {
  transform: scale(1.06);
}
.play-btn.buffering {
  animation: pulse 1s ease infinite;
}
.time {
  display: flex;
  gap: 6px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  width: 26%;
}
.q {
  color: var(--accent-2);
  border-color: rgba(236, 72, 153, 0.35);
  margin-right: 4px;
  flex: none;
}
.vol {
  width: 90px;
  display: flex;
  align-items: center;
  margin-left: 4px;
}
@media (max-height: 600px) {
  .player-bar {
    margin: 0 12px 10px;
  }
  .progress-line {
    padding: 2px 14px 0;
  }
  .row {
    padding: 2px 14px 8px;
    gap: 10px;
  }
  .thumb {
    width: 44px !important;
    height: 44px !important;
  }
  .controls {
    gap: 8px;
  }
  .center {
    flex-direction: row;
    gap: 12px;
  }
  .play-btn {
    width: 40px;
    height: 40px;
  }
  .time {
    font-size: 11px;
  }
  .vol {
    width: 74px;
  }
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
