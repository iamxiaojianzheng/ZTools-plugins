import { defineStore } from 'pinia';
import { services } from '@/api/services';
import type { MusicItem } from '@/types';

export type DetailType = 'album' | 'artist' | 'sheet' | 'toplist';

interface DetailState {
  type: DetailType | null;
  hash: string;
  platform: string;
  item: any;
  loading: boolean;
  error: string;
  page: number;
  isEnd: boolean;
  musicList: MusicItem[];
  artistTab: 'music' | 'album';
  artistMusic: MusicItem[];
  artistMusicPage: number;
  artistMusicEnd: boolean;
  artistAlbums: any[];
  artistAlbumPage: number;
  artistAlbumEnd: boolean;
}

export const useDetailStore = defineStore('detail', {
  state: (): DetailState => ({
    type: null,
    hash: '',
    platform: '',
    item: null,
    loading: false,
    error: '',
    page: 0,
    isEnd: false,
    musicList: [],
    artistTab: 'music',
    artistMusic: [],
    artistMusicPage: 0,
    artistMusicEnd: false,
    artistAlbums: [],
    artistAlbumPage: 0,
    artistAlbumEnd: false,
  }),
  getters: {
    open(state): boolean {
      return !!state.type;
    },
    cover(state): string {
      return state.item?.artwork || state.item?.coverImg || state.item?.avatar || '';
    },
    title(state): string {
      return state.item?.title || state.item?.name || '未命名';
    },
    subtitle(state): string {
      if (state.type === 'artist') return state.item?.description || '';
      return state.item?.artist || state.item?.creator || '';
    },
    list(state): MusicItem[] {
      return state.type === 'artist' ? state.artistMusic : state.musicList;
    },
    albums(state): any[] {
      return state.artistAlbums;
    },
    canLoadMore(state): boolean {
      if (state.loading) return false;
      if (state.type === 'artist') {
        return state.artistTab === 'music' ? !state.artistMusicEnd : !state.artistAlbumEnd;
      }
      return !state.isEnd && !!state.type;
    },
  },
  actions: {
    openDetail(type: DetailType, item: any, hash: string) {
      this.$patch({
        type,
        hash,
        platform: item?.platform || '',
        item: item ? { ...item } : null,
        loading: false,
        error: '',
        page: 0,
        isEnd: false,
        musicList: [],
        artistTab: 'music',
        artistMusic: [],
        artistMusicPage: 0,
        artistMusicEnd: false,
        artistAlbums: [],
        artistAlbumPage: 0,
        artistAlbumEnd: false,
      });
      this.load();
    },
    close() {
      this.type = null;
      this.item = null;
      this.musicList = [];
      this.artistMusic = [];
      this.artistAlbums = [];
    },
    async load() {
      if (!this.type || !this.hash || !this.item) return;
      this.loading = true;
      this.error = '';
      const item = this.item;
      const hash = this.hash;
      try {
        if (this.type === 'artist') {
          this.artistMusic = [];
          this.artistAlbums = [];
          this.artistMusicPage = 0;
          this.artistMusicEnd = false;
          this.artistAlbumPage = 0;
          this.artistAlbumEnd = false;
          this.artistTab = 'music';
          await this.loadArtist('music', 1);
        } else if (this.type === 'album') {
          const r = await services().music.getAlbumInfo(hash, item, 1);
          this.item = { ...item, ...(r?.albumItem || {}) };
          this.musicList = r?.musicList || [];
          this.isEnd = r?.isEnd !== false || this.musicList.length === 0;
          this.page = 1;
        } else if (this.type === 'sheet') {
          const r = await services().music.getMusicSheetInfo(hash, item, 1);
          this.item = { ...item, ...(r?.sheetItem || {}) };
          this.musicList = r?.musicList || [];
          this.isEnd = r?.isEnd !== false || this.musicList.length === 0;
          this.page = 1;
        } else if (this.type === 'toplist') {
          const r = await services().music.getTopListDetail(hash, item, 1);
          this.item = { ...item, ...(r?.topListItem || {}) };
          this.musicList = r?.musicList || [];
          this.isEnd = r?.isEnd !== false || this.musicList.length === 0;
          this.page = 1;
        }
      } catch (e: any) {
        this.error = e?.message || '加载失败';
        this.isEnd = true;
      } finally {
        this.loading = false;
      }
    },
    async loadArtist(tab: 'music' | 'album', page: number) {
      if (!this.item || !this.hash) return;
      const r = await services().music.getArtistWorks(this.hash, this.item, page, tab);
      const data = r?.data || [];
      if (tab === 'music') {
        this.artistMusic = page === 1 ? data : this.artistMusic.concat(data);
        this.artistMusicPage = page;
        this.artistMusicEnd = r?.isEnd !== false || data.length === 0;
      } else {
        this.artistAlbums = page === 1 ? data : this.artistAlbums.concat(data);
        this.artistAlbumPage = page;
        this.artistAlbumEnd = r?.isEnd !== false || data.length === 0;
      }
    },
    async setArtistTab(tab: 'music' | 'album') {
      if (this.artistTab === tab) return;
      this.artistTab = tab;
      const empty = tab === 'music' ? !this.artistMusic.length : !this.artistAlbums.length;
      const ended = tab === 'music' ? this.artistMusicEnd : this.artistAlbumEnd;
      if (empty && !ended) {
        this.loading = true;
        try {
          await this.loadArtist(tab, 1);
        } finally {
          this.loading = false;
        }
      }
    },
    async loadMore() {
      if (this.loading) return;
      if (this.type === 'artist') {
        const tab = this.artistTab;
        if (tab === 'music' ? this.artistMusicEnd : this.artistAlbumEnd) return;
        const page = (tab === 'music' ? this.artistMusicPage : this.artistAlbumPage) + 1;
        this.loading = true;
        try {
          await this.loadArtist(tab, page);
        } catch (e: any) {
          this.error = e?.message || '加载失败';
        } finally {
          this.loading = false;
        }
        return;
      }
      if (this.isEnd || !this.type) return;
      const page = this.page + 1;
      this.loading = true;
      try {
        let list: MusicItem[] = [];
        let end = true;
        if (this.type === 'album') {
          const r = await services().music.getAlbumInfo(this.hash, this.item, page);
          list = r?.musicList || [];
          end = r?.isEnd !== false;
        } else if (this.type === 'sheet') {
          const r = await services().music.getMusicSheetInfo(this.hash, this.item, page);
          list = r?.musicList || [];
          end = r?.isEnd !== false;
        } else if (this.type === 'toplist') {
          const r = await services().music.getTopListDetail(this.hash, this.item, page);
          list = r?.musicList || [];
          end = r?.isEnd !== false;
        }
        this.musicList = this.musicList.concat(list);
        this.page = page;
        this.isEnd = end || list.length === 0;
      } catch (e: any) {
        this.error = e?.message || '加载失败';
      } finally {
        this.loading = false;
      }
    },
  },
});
