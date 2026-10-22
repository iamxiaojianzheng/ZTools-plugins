<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import CoverImage from '@/components/CoverImage.vue';
import { useDownloadStore } from '@/stores/downloads';
import { useUiStore } from '@/stores/ui';

const downloads = useDownloadStore();
const ui = useUiStore();

function openFolder(path?: string) {
  if (!path) return;
  try {
    window.ztools?.shellShowItemInFolder?.(path);
  } catch (e) {
    /* ignore */
  }
}

function statusText(t: any): string {
  if (t.status === 'waiting') return '等待中';
  if (t.status === 'downloading') {
    if (t.total) return `${Math.round(t.progress * 100)}% · ${formatSize(t.received)} / ${formatSize(t.total)}`;
    return `${formatSize(t.received)}`;
  }
  if (t.status === 'done') return '已完成';
  if (t.status === 'error') return t.error || '下载失败';
  return '';
}

function formatSize(n?: number): string {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
</script>

<template>
  <div class="view">
    <div class="head">
      <div>
        <h2>下载</h2>
        <p class="text-2">{{ downloads.tasks.length }} 个任务</p>
      </div>
      <button class="btn ghost" :disabled="!downloads.tasks.length" @click="downloads.clearDone()">
        <Icon name="trash" :size="15" />清除已完成
      </button>
    </div>

    <div v-if="!downloads.tasks.length" class="empty card">
      <div class="empty-art"><Icon name="download" :size="40" /></div>
      <h3>暂无下载任务</h3>
      <p class="text-2">在歌曲列表点击下载按钮即可离线保存</p>
      <button class="btn primary" @click="ui.setView('search')"><Icon name="search" :size="15" />去搜索</button>
    </div>

    <div v-else class="list">
      <div v-for="t in downloads.tasks" :key="t.id" class="task card">
        <CoverImage :src="t.track.artwork" :size="48" :radius="12" />
        <div class="info">
          <div class="title ellipsis">{{ t.track.title }}</div>
          <div class="sub ellipsis text-2">
            {{ t.track.artist }}
            <span class="status" :class="t.status">{{ statusText(t) }}</span>
          </div>
          <div class="bar"><div class="fill" :style="{ width: Math.round((t.progress || 0) * 100) + '%' }"></div></div>
        </div>
        <div class="ops">
          <button v-if="t.status === 'done'" class="icon-btn" title="打开所在文件夹" @click="openFolder(t.path)">
            <Icon name="folder" :size="17" />
          </button>
          <button class="icon-btn" title="移除" @click="downloads.remove(t.id)">
            <Icon name="close" :size="16" />
          </button>
        </div>
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
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.task {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}
.info {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 13.5px;
  font-weight: 600;
}
.sub {
  font-size: 12px;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.status {
  font-size: 11.5px;
  color: var(--text-3);
}
.status.done {
  color: #34d399;
}
.status.error {
  color: #f87171;
}
.bar {
  height: 3px;
  margin-top: 8px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
  max-width: 420px;
}
.fill {
  height: 100%;
  background: var(--accent-grad);
  transition: width 0.25s ease;
}
.ops {
  display: flex;
  gap: 4px;
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
</style>
