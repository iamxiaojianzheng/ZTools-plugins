<script setup lang="ts">
import { computed } from 'vue';
import type { MusicItem } from '@/types';
import Icon from './Icon.vue';
import CoverImage from './CoverImage.vue';
import { useLibraryStore } from '@/stores/library';
import { formatTime } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    track: MusicItem;
    index?: number;
    active?: boolean;
    playing?: boolean;
    sourceName?: string;
    removable?: boolean;
  }>(),
  { index: 1, active: false, playing: false, removable: false }
);

const emit = defineEmits<{
  (e: 'play'): void;
  (e: 'add'): void;
  (e: 'remove'): void;
  (e: 'download'): void;
}>();

const library = useLibraryStore();
const isFav = computed(() => library.isFavorite(props.track));

function toggleFav() {
  library.toggleFavorite(props.track);
}
</script>

<template>
  <div class="track-row" :class="{ active, playing }" @dblclick="emit('play')">
    <div class="idx">
      <span v-if="!active" class="num">{{ index }}</span>
      <div v-else-if="playing" class="eq"><span /><span /><span /></div>
      <Icon v-else name="play" :size="14" />
      <button class="play-mini" title="播放" @click.stop="emit('play')">
        <Icon :name="active && playing ? 'pause' : 'play'" :size="16" />
      </button>
    </div>
    <CoverImage :src="track.artwork" :size="42" :radius="10" />
    <div class="meta">
      <div class="title ellipsis">
        {{ track.title || '未知歌曲' }}
        <span v-if="sourceName" class="tag src-tag">{{ sourceName }}</span>
      </div>
      <div class="sub ellipsis">
        {{ track.artist || '未知歌手' }}<template v-if="track.album"> · {{ track.album }}</template>
      </div>
    </div>
    <div class="actions">
      <button class="icon-btn" :class="{ active: isFav }" title="收藏" @click.stop="toggleFav">
        <Icon :name="isFav ? 'heart-fill' : 'heart'" :size="17" />
      </button>
      <button class="icon-btn" title="加入播放列表" @click.stop="emit('add')">
        <Icon name="plus" :size="17" />
      </button>
      <button class="icon-btn" title="下载" @click.stop="emit('download')">
        <Icon name="download" :size="17" />
      </button>
      <button v-if="removable" class="icon-btn" title="移除" @click.stop="emit('remove')">
        <Icon name="trash" :size="16" />
      </button>
      <span class="dur">{{ formatTime(track.duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.track-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  transition: background 0.16s ease;
  user-select: none;
  cursor: default;
}
.track-row:hover {
  background: var(--panel-hover);
}
.track-row.active {
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.18), rgba(236, 72, 153, 0.08));
}
.track-row.active .title {
  color: var(--accent-2);
}
.idx {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: var(--text-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.play-mini {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: none;
  align-items: center;
  justify-content: center;
  background: var(--accent-grad);
  color: #fff;
}
.track-row:hover .play-mini {
  display: flex;
}
.track-row:hover .num,
.track-row:hover .eq {
  visibility: hidden;
}
.meta {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.src-tag {
  flex-shrink: 0;
  font-size: 10px;
  height: 17px;
  padding: 0 6px;
  color: var(--text-3);
}
.sub {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 3px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.16s ease;
}
.track-row:hover .actions {
  opacity: 1;
}
.dur {
  color: var(--text-3);
  font-size: 12px;
  width: 44px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
}
</style>
