import { defineStore } from 'pinia';
import type { MusicItem } from '@/types';
import { loadState, saveState } from './persist';
import { trackKey } from '@/utils/format';

const FAV_KEY = 'favorites';
const HIS_KEY = 'history';
const MAX_HISTORY = 200;

export const useLibraryStore = defineStore('library', {
  state: () => ({
    favorites: [] as MusicItem[],
    history: [] as MusicItem[],
  }),
  getters: {
    favoriteKeys(state): Set<string> {
      return new Set(state.favorites.map((t) => trackKey(t)));
    },
  },
  actions: {
    hydrate() {
      this.favorites = loadState<MusicItem[]>(FAV_KEY, []);
      this.history = loadState<MusicItem[]>(HIS_KEY, []);
    },
    isFavorite(track: MusicItem): boolean {
      return this.favorites.some((t) => trackKey(t) === trackKey(track));
    },
    toggleFavorite(track: MusicItem): boolean {
      const i = this.favorites.findIndex((t) => trackKey(t) === trackKey(track));
      if (i >= 0) {
        this.favorites.splice(i, 1);
        saveState(FAV_KEY, this.favorites);
        return false;
      }
      this.favorites.unshift({ ...track, $$addedAt: Date.now() });
      saveState(FAV_KEY, this.favorites);
      return true;
    },
    pushHistory(track: MusicItem) {
      const i = this.history.findIndex((t) => trackKey(t) === trackKey(track));
      if (i >= 0) this.history.splice(i, 1);
      this.history.unshift({ ...track, $$addedAt: Date.now() });
      if (this.history.length > MAX_HISTORY) this.history.length = MAX_HISTORY;
      saveState(HIS_KEY, this.history);
    },
    clearHistory() {
      this.history = [];
      saveState(HIS_KEY, this.history);
    },
    removeFavorite(key: string) {
      this.favorites = this.favorites.filter((t) => trackKey(t) !== key);
      saveState(FAV_KEY, this.favorites);
    },
  },
});
