import { defineStore } from 'pinia';
import type { SearchType } from '@/types';
import { services } from '@/api/services';
import { useSourceStore } from './sources';

interface SourceSearchState {
  hash: string;
  platform: string;
  data: any[];
  page: number;
  isEnd: boolean;
  loading: boolean;
  error: string;
}

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    type: 'music' as SearchType,
    activeHash: 'all',
    searching: false,
    perSource: {} as Record<string, SourceSearchState>,
  }),
  getters: {
    sourcesSearched(state): SourceSearchState[] {
      return Object.values(state.perSource);
    },
    totalCount(state): number {
      return Object.values(state.perSource).reduce((n, s) => n + s.data.length, 0);
    },
    allResults(state): any[] {
      return Object.values(state.perSource).flatMap((s) => s.data);
    },
    anyLoading(state): boolean {
      return Object.values(state.perSource).some((s) => s.loading);
    },
  },
  actions: {
    async run(query: string, type?: SearchType) {
      this.query = query;
      if (type) this.type = type;
      const sourceStore = useSourceStore();
      const targets = sourceStore.enabled.filter((s) =>
        (s.supportedSearchType || ['music']).includes(this.type)
      );
      this.activeHash = 'all';
      this.perSource = {};
      targets.forEach((s) => {
        this.perSource[s.hash] = {
          hash: s.hash,
          platform: s.platform,
          data: [],
          page: 0,
          isEnd: false,
          loading: true,
          error: '',
        };
      });
      if (!targets.length) return;
      this.searching = true;
      await Promise.all(targets.map((s) => this.loadMore(s.hash)));
      this.searching = false;
    },
    async loadMore(hash: string) {
      const st = this.perSource[hash];
      if (!st) return;
      if (st.loading && st.page > 0) return;
      const nextPage = st.page + 1;
      st.loading = true;
      st.error = '';
      try {
        const res = await services().music.search(hash, this.query, nextPage, this.type);
        const items = (res?.data || []) as any[];
        items.forEach((it) => {
          it.$$hash = hash;
          if (!it.platform) it.platform = st.platform;
        });
        st.data = st.data.concat(items);
        st.page = nextPage;
        st.isEnd = res?.isEnd !== false || items.length === 0;
      } catch (e: any) {
        st.error = e?.message || '搜索失败';
        st.isEnd = true;
      } finally {
        st.loading = false;
      }
    },
    reset() {
      this.query = '';
      this.perSource = {};
      this.activeHash = 'all';
    },
  },
});
