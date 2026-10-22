import { defineStore } from 'pinia';
import { loadState, saveState } from './persist';

const KEY = 'settings';

interface SettingsState {
  quality: 'low' | 'standard' | 'high' | 'super';
  theme: 'auto' | 'dark' | 'light';
  showTranslation: boolean;
  autoNext: boolean;
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    quality: 'standard',
    theme: 'auto',
    showTranslation: true,
    autoNext: true,
  }),
  actions: {
    hydrate() {
      Object.assign(this, loadState<SettingsState>(KEY, { ...this.$state }));
    },
    patch(partial: Partial<SettingsState>) {
      Object.assign(this, partial);
      saveState(KEY, { ...this.$state });
    },
  },
});
