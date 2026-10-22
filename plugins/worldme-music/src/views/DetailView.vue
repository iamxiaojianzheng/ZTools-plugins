<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import CoverImage from '@/components/CoverImage.vue';
import TrackRow from '@/components/TrackRow.vue';
import MediaCard from '@/components/MediaCard.vue';
import { useDetailStore } from '@/stores/detail';
import { usePlayerStore } from '@/stores/player';
import { useDownloadStore } from '@/stores/downloads';
import { useSourceStore } from '@/stores/sources';
import { toast } from '@/composables/toast';
import { formatCount } from '@/utils/format';

const detail = useDetailStore();
const player = usePlayerStore();
const downloads = useDownloadStore();
const sources = useSourceStore();

const typeLabel = computed(
  () => ({ album: '专辑', artist: '歌手', sheet: '歌单', toplist: '榜单' } as Record<string, string>)[detail.type || ''] || ''
);

const songs = computed(() => (detail.type === 'artist' ? detail.artistMusic : detail.musicList));
const albums = computed(() => detail.artistAlbums);
const isArtist = computed(() => detail.type === 'artist');

const metaLine = computed(() => {
  if (detail.type === 'artist') {
    const fans = detail.item?.fans;
    return fans ? formatCount(fans) + ' 粉丝' : detail.item?.description || '';
  }
  const parts: string[] = [];
  if (detail.subtitle) parts.push(detail.subtitle);
  const n = detail.item?.worksNum || songs.value.length;
  if (n) parts.push(n + ' 首');
  const pc = detail.item?.playCount;
  if (pc) parts.push(formatCount(pc) + ' 播放');
  if (detail.item?.updateTime) parts.push(String(detail.item.updateTime));
  return parts.join(' · ');
});

const description = computed(() => {
  if (detail.type === 'artist') return detail.item?.description || '';
  return detail.item?.description || '';
});

const sourceName = computed(() => detail.item?.platform || detail.platform);

function playAll() {
  if (!songs.value.length) return;
  player.playTrack(songs.value[0], songs.value);
}

function addAll() {
  songs.value.forEach((t) => player.addToQueue(t));
  toast('已加入播放列表', 'success');
}

function download(track: any) {
  downloads.download(track);
  toast('已开始下载', 'success');
}

function openAlbum(item: any) {
  detail.openDetail('album', item, detail.hash);
}
</script>

<template>
  <div v-if="detail.type" class="view">
    <div class="topline">
      <button class="btn ghost" @click="detail.close()"><Icon name="chevron-right" :size="16" class="back" />返回</button>
      <span class="text-3">{{ typeLabel }}</span>
    </div>

    <div class="hero">
      <CoverImage :src="detail.cover" :size="168" :radius="isArtist ? '50%' : '22px'" class="hero-cover" />
      <div class="hero-info">
        <div class="kind">{{ typeLabel }}</div>
        <h1 class="ellipsis">{{ detail.title }}</h1>
        <div class="meta text-2">{{ metaLine }}</div>
        <p v-if="description" class="desc text-2">{{ description }}</p>
        <div class="actions">
          <button class="btn primary" :disabled="!songs.length" @click="playAll">
            <Icon name="play" :size="15" />播放全部
          </button>
          <button class="btn" :disabled="!songs.length" @click="addAll">
            <Icon name="plus" :size="15" />加入列表
          </button>
          <span class="tag">{{ sourceName }}</span>
        </div>
      </div>
    </div>

    <div v-if="isArtist" class="artist-tabs">
      <button :class="{ on: detail.artistTab === 'music' }" @click="detail.setArtistTab('music')">
        <Icon name="music" :size="15" />单曲
      </button>
      <button :class="{ on: detail.artistTab === 'album' }" @click="detail.setArtistTab('album')">
        <Icon name="disc" :size="15" />专辑
      </button>
    </div>

    <div class="content">
      <div v-if="detail.loading && !songs.length && !albums.length" class="loading">
        <div v-for="i in 6" :key="i" class="sk-row">
          <div class="skeleton" style="width: 42px; height: 42px; border-radius: 10px"></div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <div class="skeleton" style="width: 42%; height: 12px"></div>
            <div class="skeleton" style="width: 20%; height: 10px"></div>
          </div>
        </div>
      </div>

      <div v-else-if="detail.error" class="state card">
        <Icon name="info" :size="22" />
        <span>{{ detail.error }}</span>
      </div>

      <template v-else-if="!isArtist || detail.artistTab === 'music'">
        <div v-if="!songs.length" class="state card">暂无歌曲</div>
        <div v-else class="song-list">
          <TrackRow
            v-for="(t, i) in songs"
            :key="(t.platform || '') + t.id + i"
            :track="t"
            :index="i + 1"
            :source-name="t.platform"
            :active="!!(player.current && player.current.id === t.id && player.current.platform === t.platform)"
            :playing="player.playing"
            @play="player.playTrack(t, songs)"
            @add="player.addToQueue(t); toast('已加入播放列表', 'success')"
            @download="download(t)"
          />
        </div>
      </template>

      <template v-else>
        <div v-if="!albums.length" class="state card">暂无专辑</div>
        <div v-else class="album-grid">
          <MediaCard v-for="(a, i) in albums" :key="(a.platform || '') + a.id + i" :item="a" type="album" :platform="a.platform" @open="openAlbum(a)" />
        </div>
      </template>

      <div class="more">
        <button v-if="detail.canLoadMore" class="btn" :disabled="detail.loading" @click="detail.loadMore()">
          {{ detail.loading ? '加载中…' : '加载更多' }}
        </button>
        <span v-else-if="songs.length || albums.length" class="text-3">没有更多了</span>
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
.topline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0 12px;
}
.topline .btn {
  gap: 2px;
  padding-left: 10px;
}
.back {
  transform: rotate(180deg);
}
.hero {
  display: flex;
  gap: 26px;
  align-items: flex-end;
  padding-bottom: 22px;
}
.hero-cover {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
}
.hero-info {
  flex: 1;
  min-width: 0;
  padding-bottom: 6px;
}
.kind {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--accent-2);
  margin-bottom: 8px;
}
.hero h1 {
  margin: 0 0 10px;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: 0.3px;
}
.meta {
  font-size: 13px;
}
.desc {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  max-height: 3.2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}
.artist-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.artist-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--panel);
  border: 1px solid var(--border);
  transition: all 0.16s ease;
}
.artist-tabs button.on {
  color: #fff;
  background: var(--accent-grad);
  border-color: transparent;
}
.content {
  min-height: 120px;
}
.song-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 22px 18px;
}
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-2);
  font-size: 13px;
}
.more {
  display: flex;
  justify-content: center;
  padding: 18px 0 10px;
}
.sk-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
}
.loading {
  padding-top: 6px;
}
</style>
