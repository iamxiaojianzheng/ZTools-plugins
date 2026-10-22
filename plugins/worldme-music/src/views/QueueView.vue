<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import TrackRow from '@/components/TrackRow.vue';
import { usePlayerStore } from '@/stores/player';
import { useDownloadStore } from '@/stores/downloads';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/composables/toast';

const player = usePlayerStore();
const downloads = useDownloadStore();
const ui = useUiStore();
</script>

<template>
  <div class="view">
    <div class="head">
      <div>
        <h2>播放列表</h2>
        <p class="text-2">{{ player.queue.length }} 首歌曲</p>
      </div>
      <button class="btn ghost danger" :disabled="!player.queue.length" @click="player.clearQueue()">
        <Icon name="trash" :size="15" />清空列表
      </button>
    </div>

    <div v-if="!player.queue.length" class="empty card">
      <div class="empty-art"><Icon name="list" :size="40" /></div>
      <h3>播放列表是空的</h3>
      <p class="text-2">去搜索并添加喜欢的歌曲吧</p>
      <button class="btn primary" @click="ui.setView('search')"><Icon name="search" :size="15" />去搜索</button>
    </div>

    <div v-else class="list">
      <TrackRow
        v-for="(t, i) in player.queue"
        :key="(t.platform || '') + t.id + i"
        :track="t"
        :index="i + 1"
        :active="player.index === i"
        :playing="player.playing"
        removable
        @play="player.playAt(i)"
        @add="player.addToQueue(t); toast('已加入播放列表', 'success')"
        @download="downloads.download(t); toast('已开始下载', 'success')"
        @remove="player.removeAt(i)"
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
