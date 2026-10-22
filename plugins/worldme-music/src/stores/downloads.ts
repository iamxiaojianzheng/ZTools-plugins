import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { services } from '@/api/services';
import { useSourceStore } from './sources';
import { useSettingsStore } from './settings';
import { qualityOrder, trackKey } from '@/utils/format';
import type { MusicItem } from '@/types';

export interface DownloadTask {
  id: string;
  key: string;
  track: MusicItem;
  status: 'waiting' | 'downloading' | 'done' | 'error' | 'canceled';
  progress: number;
  received: number;
  total: number;
  path?: string;
  error?: string;
  createdAt: number;
}

let seed = 0;

export const useDownloadStore = defineStore('downloads', {
  state: () => ({
    tasks: [] as DownloadTask[],
  }),
  getters: {
    activeCount(state): number {
      return state.tasks.filter((t) => t.status === 'downloading' || t.status === 'waiting').length;
    },
  },
  actions: {
    async download(track: MusicItem) {
      const key = trackKey(track);
      const existing = this.tasks.find((t) => t.key === key && (t.status === 'downloading' || t.status === 'waiting'));
      if (existing) return existing;

      const task: DownloadTask = reactive({
        id: String(++seed) + '-' + Date.now(),
        key,
        track: { ...track },
        status: 'waiting',
        progress: 0,
        received: 0,
        total: 0,
        createdAt: Date.now(),
      });
      this.tasks.unshift(task);

      try {
        const sourceStore = useSourceStore();
        const hash = sourceStore.hashOf(track.platform) || track.$$hash;
        if (!hash) throw new Error('未找到对应音源');

        let source: any = null;
        for (const q of qualityOrder(useSettingsStore().quality)) {
          try {
            const s = await services().music.getMediaSource(hash, track, q);
            if (s?.url) {
              source = s;
              break;
            }
          } catch (e) {
            /* 尝试下一音质 */
          }
        }
        if (!source) throw new Error('无法获取下载地址');

        task.status = 'downloading';
        const filename = `${track.artist || '未知歌手'} - ${track.title || '未知歌曲'}`;
        const res = await services().media.download(source.url, source.headers || {}, filename, (ratio, received, total) => {
          task.status = 'downloading';
          task.progress = ratio || 0;
          task.received = received;
          task.total = total;
        });

        if (res?.canceled) {
          this.tasks = this.tasks.filter((t) => t.id !== task.id);
          return null;
        }
        task.status = 'done';
        task.progress = 1;
        task.path = res?.path;
        return task;
      } catch (e: any) {
        task.status = 'error';
        task.error = e?.message || '下载失败';
        return task;
      }
    },
    remove(id: string) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
    },
    clearDone() {
      this.tasks = this.tasks.filter((t) => t.status !== 'done' && t.status !== 'canceled');
    },
  },
});
