<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import TrackRow from '@/components/TrackRow.vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useDownloadStore } from '@/stores/downloads';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/composables/toast';

const props = defineProps<{ kind: 'favorites' | 'history' }>();

const library = useLibraryStore();
const player = usePlayerStore();
const downloads = useDownloadStore();
const ui = useUiStore();

const list = computed(() => (props.kind === 'favorites' ? library.favorites : library.history));
const title = computed(() => (props.kind === 'favorites' ? '我的收藏' : '最近播放'));

function playAll() {
  if (!list.value.length) return;
  player.playTrack(list.value[0], list.value);
}
</script>

<template>
  <div class="view">
    <div class="head">
      <div>
        <h2>{{ title }}</h2>
        <p class="text-2">{{ list.length }} 首歌曲</p>
      </div>
      <div class="ops">
        <button class="btn" :disabled="!list.length" @click="playAll"><Icon name="play" :size="15" />播放全部</button>
        <button v-if="kind === 'history'" class="btn ghost danger" :disabled="!list.length" @click="library.clearHistory()">
          <Icon name="trash" :size="15" />清空
        </button>
      </div>
    </div>

    <div v-if="!list.length" class="empty card">
      <div class="empty-art"><Icon :name="kind === 'favorites' ? 'heart' : 'history'" :size="40" /></div>
      <h3>{{ kind === 'favorites' ? '还没有收藏歌曲' : '暂无播放记录' }}</h3>
      <p class="text-2">{{ kind === 'favorites' ? '在歌曲列表点击 ♥ 即可收藏' : '播放歌曲后会自动记录在这里' }}</p>
      <button class="btn primary" @click="ui.setView('search')"><Icon name="search" :size="15" />去搜索</button>
    </div>

    <div v-else class="list">
      <TrackRow
        v-for="(t, i) in list"
        :key="(t.platform || '') + t.id + i"
        :track="t"
        :index="i + 1"
        :active="!!(player.current && player.current.id === t.id && player.current.platform === t.platform)"
        :playing="player.playing"
        @play="player.playTrack(t, list)"
        @add="player.addToQueue(t); toast('已加入播放列表', 'success')"
        @download="downloads.download(t); toast('已开始下载', 'success')"
        @remove="library.removeFavorite((t.platform || '') + '::' + t.id)"
      />
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
  margin: 6px 0 18px;
}
.head h2 {
  margin: 0 0 6px;
  font-size: 24px;
}
.head p {
  margin: 0;
  font-size: 13px;
}
.ops {
  display: flex;
  gap: 10px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
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
  box-shadow: 0 14px 34px rgba(236, 72, 153, 0.35);
}
.empty h3 {
  margin: 6px 0 0;
}
.empty p {
  margin: 0;
  font-size: 13px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
