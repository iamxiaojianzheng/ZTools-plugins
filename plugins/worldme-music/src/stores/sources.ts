import { defineStore } from 'pinia';
import type { SourceMeta, SubscriptionEntry, InstallProgress, InstallSummary } from '@/types';
import { services } from '@/api/services';
import { toast } from '@/api/ztools';

export const useSourceStore = defineStore('sources', {
  state: () => ({
    list: [] as SourceMeta[],
    loading: false,
    installing: false,
  }),
  getters: {
    enabled(state): SourceMeta[] {
      return state.list.filter((s) => s.enabled && !s.stateCode);
    },
    platformMap(state): Record<string, string> {
      const map: Record<string, string> = {};
      state.list.forEach((s) => (map[s.platform] = s.hash));
      return map;
    },
  },
  actions: {
    hashOf(platform: string): string | undefined {
      return this.list.find((s) => s.platform === platform)?.hash;
    },
    async refresh() {
      this.loading = true;
      try {
        this.list = await services().plugins.list();
      } finally {
        this.loading = false;
      }
    },
    async installFromUrl(url: string) {
      this.installing = true;
      try {
        const meta = await services().plugins.installFromUrl(url.trim());
        await this.refresh();
        toast('已安装音源：' + (meta?.platform || url));
        return meta;
      } finally {
        this.installing = false;
      }
    },
    async installFromCode(code: string) {
      this.installing = true;
      try {
        const meta = await services().plugins.installFromCode(code);
        await this.refresh();
        toast('已安装音源：' + (meta?.platform || '未知'));
        return meta;
      } finally {
        this.installing = false;
      }
    },
    async installFromJsonUrl(url: string, onProgress?: (p: InstallProgress) => void) {
      this.installing = true;
      try {
        const result = (await services().plugins.installFromJsonUrl(url.trim(), onProgress)) as InstallSummary;
        await this.refresh();
        toast(`订阅导入完成：成功 ${result.ok} 个，失败 ${result.failed} 个`);
        return result;
      } finally {
        this.installing = false;
      }
    },
    async fetchSubscription(url: string): Promise<{ desc: string; plugins: SubscriptionEntry[] }> {
      return services().plugins.fetchSubscription(url.trim());
    },
    async installSelected(entries: SubscriptionEntry[], onProgress?: (p: InstallProgress) => void) {
      this.installing = true;
      try {
        const result = (await services().plugins.installFromSubscription(entries, onProgress)) as InstallSummary;
        await this.refresh();
        return result;
      } finally {
        this.installing = false;
      }
    },
    async installFromFile() {
      this.installing = true;
      try {
        const res = await services().plugins.pickAndInstallLocalFile();
        await this.refresh();
        if (res) {
          if (res.results) toast(`导入完成：成功 ${res.ok} 个，失败 ${res.failed} 个`);
          else toast('已安装音源');
        }
        return res;
      } finally {
        this.installing = false;
      }
    },
    async uninstall(hash: string) {
      await services().plugins.uninstall(hash);
      await this.refresh();
    },
    async setEnabled(hash: string, enabled: boolean) {
      await services().plugins.setEnabled(hash, enabled);
      const item = this.list.find((s) => s.hash === hash);
      if (item) item.enabled = enabled;
    },
    async update(hash: string) {
      try {
        await services().plugins.update(hash);
        await this.refresh();
        toast('音源已更新');
      } catch (e: any) {
        toast('更新失败：' + e.message);
      }
    },
    async setUserVariables(hash: string, vars: Record<string, string>) {
      await services().plugins.setUserVariables(hash, vars);
      await this.refresh();
    },
  },
});
