<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import TrackRow from '@/components/TrackRow.vue';
import MediaCard from '@/components/MediaCard.vue';
import { useSearchStore } from '@/stores/search';
import { useSourceStore } from '@/stores/sources';
import { usePlayerStore } from '@/stores/player';
import { useDownloadStore } from '@/stores/downloads';
import { useDetailStore } from '@/stores/detail';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/composables/toast';
import type { SearchType } from '@/types';

const search = useSearchStore();
const sources = useSourceStore();
const player = usePlayerStore();
const downloads = useDownloadStore();
const detail = useDetailStore();
const ui = useUiStore();

const keyword = ref(search.query || '');

const TYPES: Array<{ value: SearchType; label: string }> = [
  { value: 'music', label: '歌曲' },
  { value: 'album', label: '专辑' },
  { value: 'artist', label: '歌手' },
  { value: 'sheet', label: '歌单' },
];

const isMusic = computed(() => search.type === 'music' || search.type === 'lyric');

const tabs = computed(() => {
  const list = sources.enabled.map((s) => ({
    hash: s.hash,
    label: s.platform,
    count: search.perSource[s.hash]?.data.length || 0,
    loading: search.perSource[s.hash]?.loading,
  }));
  return [{ hash: 'all', label: '全部', count: search.totalCount, loading: search.anyLoading }, ...list];
});

const list = computed(() => {
  if (search.activeHash === 'all') return search.allResults;
  return search.perSource[search.activeHash]?.data || [];
});

const currentTab = computed(() => tabs.value.find((t) => t.hash === search.activeHash));

function submit() {
  const q = keyword.value.trim();
  if (!q) return;
  if (!sources.enabled.length) {
    toast('请先添加音源', 'error');
    ui.setView('sources');
    return;
  }
  search.run(q, search.type);
}

function changeType(t: SearchType) {
  if (search.type === t) return;
  search.type = t;
  if (search.query) search.run(search.query, t);
}

async function loadMore() {
  if (search.activeHash === 'all') {
    await Promise.all(
      sources.enabled
        .filter((s) => !search.perSource[s.hash]?.isEnd && !search.perSource[s.hash]?.loading)
        .map((s) => search.loadMore(s.hash))
    );
  } else {
    await search.loadMore(search.activeHash);
  }
}

function play(track: any) {
  player.playTrack(track, list.value);
}

function add(track: any) {
  player.addToQueue(track);
  toast('已加入播放列表', 'success');
}

function download(track: any) {
  downloads.download(track);
  toast('已开始下载', 'success');
  ui.setView('downloads');
}

function openDetail(item: any) {
  const hash = item.$$hash || sources.hashOf(item.platform);
  if (!hash) {
    toast('未找到对应音源', 'error');
    return;
  }
  if (search.type === 'artist') detail.openDetail('artist', item, hash);
  else if (search.type === 'sheet') detail.openDetail('sheet', item, hash);
  else detail.openDetail('album', item, hash);
}
</script>

<template>
  <div class="view">
    <div class="searchbar card">
      <Icon name="search" :size="20" class="ic" />
      <input
        v-model="keyword"
        class="input"
        placeholder="搜索歌曲、专辑、歌手、歌单…"
        spellcheck="false"
        @keydown.enter="submit"
      />
      <button v-if="keyword" class="icon-btn" @click="keyword = ''"><Icon name="close" :size="16" /></button>
      <button class="btn primary" @click="submit"><Icon name="search" :size="15" />搜索</button>
    </div>

    <div class="typebar">
      <button
        v-for="t in TYPES"
        :key="t.value"
        class="type-tab"
        :class="{ on: search.type === t.value }"
        @click="changeType(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="!sources.enabled.length" class="empty card">
      <div class="empty-art"><Icon name="music" :size="42" /></div>
      <h3>开始你的音乐之旅</h3>
      <p class="text-2">添加音源插件后即可搜索和播放在线音乐。</p>
      <button class="btn primary" @click="ui.setView('sources')"><Icon name="plus" :size="16" />添加音源</button>
    </div>

    <template v-else>
      <div v-if="Object.keys(search.perSource).length" class="tabs">
        <button
          v-for="t in tabs"
          :key="t.hash"
          class="tab"
          :class="{ on: search.activeHash === t.hash }"
          @click="search.activeHash = t.hash"
        >
          {{ t.label }}
          <span class="count">{{ t.count }}</span>
          <span v-if="t.loading" class="dot"></span>
        </button>
      </div>

      <div class="results" :class="{ grid: !isMusic }">
        <div v-if="search.anyLoading && !list.length" class="loading">
          <div v-for="i in 8" :key="i" class="sk-row">
            <div class="skeleton" style="width: 42px; height: 42px; border-radius: 10px"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
              <div class="skeleton" style="width: 40%; height: 12px"></div>
              <div class="skeleton" style="width: 24%; height: 10px"></div>
            </div>
          </div>
        </div>

        <template v-else-if="list.length">
          <template v-if="isMusic">
            <TrackRow
              v-for="(track, i) in list"
              :key="track.platform + track.id + i"
              :track="track"
              :index="i + 1"
              :source-name="track.platform"
              :active="!!(player.current && player.current.id === track.id && player.current.platform === track.platform)"
              :playing="player.playing"
              @play="play(track)"
              @add="add(track)"
              @download="download(track)"
            />
          </template>
          <template v-else>
            <MediaCard
              v-for="(item, i) in list"
              :key="(item.platform || '') + item.id + i"
              :item="item"
              :type="search.type === 'artist' ? 'artist' : search.type === 'sheet' ? 'sheet' : 'album'"
              :platform="item.platform"
              @open="openDetail(item)"
            />
          </template>

          <div class="more" :class="{ full: !isMusic }">
            <button v-if="currentTab && !currentTab.loading" class="btn" @click="loadMore">加载更多</button>
            <span v-else class="text-3">没有更多了</span>
          </div>
        </template>

        <div v-else-if="search.query && !search.anyLoading" class="noresult">
          <Icon name="search" :size="34" class="text-3" />
          <p class="text-2">没有找到 “{{ search.query }}” 相关内容</p>
        </div>

        <div v-else-if="!search.query" class="hint-home">
          <div class="discover card">
            <Icon name="sparkles" :size="22" />
            <div>
              <h4>输入关键词开始搜索</h4>
              <p class="text-2">当前已启用 {{ sources.enabled.length }} 个音源</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 26px 0;
  overflow: hidden;
}
.searchbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 18px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.searchbar .ic {
  color: var(--text-3);
}
.input {
  flex: 1;
  height: 40px;
  font-size: 15px;
}
.typebar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: fit-content;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.type-tab {
  height: 30px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-2);
  transition: all 0.16s ease;
}
.type-tab:hover {
  color: var(--text);
}
.type-tab.on {
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}
.tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
  overflow-x: auto;
  flex-shrink: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--panel);
  border: 1px solid var(--border);
  white-space: nowrap;
  transition: all 0.16s ease;
}
.tab:hover {
  color: var(--text);
}
.tab.on {
  color: #fff;
  background: var(--accent-grad);
  border-color: transparent;
}
.count {
  font-size: 11px;
  opacity: 0.75;
  background: rgba(255, 255, 255, 0.18);
  padding: 1px 6px;
  border-radius: 6px;
}
.tab.on .count {
  background: rgba(255, 255, 255, 0.25);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1s ease infinite;
}
.results {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
}
.results.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 22px 18px;
  align-content: start;
}
.results.grid.loading {
  display: block;
}
.sk-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
}
.more {
  display: flex;
  justify-content: center;
  padding: 18px 0 28px;
}
.more.full {
  grid-column: 1 / -1;
}
.noresult {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 70px 0;
  grid-column: 1 / -1;
}
.hint-home {
  grid-column: 1 / -1;
  padding-top: 10px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 30px;
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
}
.empty p {
  margin: 0;
  font-size: 13px;
}
.discover {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px;
  color: var(--accent-2);
}
.discover h4 {
  margin: 0 0 4px;
  color: var(--text);
  font-size: 15px;
}
.discover p {
  margin: 0;
  font-size: 12.5px;
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
