<script setup lang="ts">
import { computed } from 'vue';
import CoverImage from './CoverImage.vue';
import { formatCount } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    item: any;
    type?: 'album' | 'artist' | 'sheet' | 'toplist';
    platform?: string;
  }>(),
  { type: 'album' }
);

defineEmits<{ (e: 'open'): void }>();

const cover = computed(() => props.item?.artwork || props.item?.coverImg || props.item?.avatar || '');
const title = computed(() => props.item?.title || props.item?.name || '未命名');
const isArtist = computed(() => props.type === 'artist');
const sub = computed(() => {
  if (isArtist.value) {
    const n = props.item?.fans;
    return n ? `${formatCount(n)} 粉丝` : props.item?.description || '歌手';
  }
  const parts: string[] = [];
  const who = props.item?.artist || props.item?.creator;
  if (who) parts.push(who);
  const n = props.item?.worksNum || props.item?.musicList?.length || props.item?.playCount;
  if (n) parts.push(formatCount(n) + (props.item?.playCount ? ' 播放' : ' 首'));
  if (props.platform) parts.push(props.platform);
  if (parts.length) return parts.join(' · ');
  return props.type === 'sheet' ? '歌单' : props.type === 'toplist' ? '榜单' : '专辑';
});
</script>

<template>
  <div class="media-card" @click="$emit('open')">
    <div class="art" :class="{ round: isArtist }">
      <CoverImage :src="cover" size="100%" :radius="isArtist ? '50%' : '16px'" />
      <div class="glow"></div>
    </div>
    <div class="meta">
      <div class="title ellipsis">{{ title }}</div>
      <div class="sub ellipsis">{{ sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.media-card {
  cursor: pointer;
  min-width: 0;
}
.art {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.art.round {
  border-radius: 50%;
  padding: 0;
}
.media-card:hover .art {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
}
.art :deep(.cover) {
  width: 100% !important;
  height: 100% !important;
}
.glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.25));
  pointer-events: none;
}
.meta {
  padding: 10px 2px 4px;
}
.title {
  font-size: 13.5px;
  font-weight: 600;
}
.sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-2);
}
</style>
