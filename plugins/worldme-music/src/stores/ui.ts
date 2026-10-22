import { defineStore } from 'pinia';

export type ViewKey = 'search' | 'toplist' | 'queue' | 'favorites' | 'history' | 'downloads' | 'sources' | 'settings';

export const useUiStore = defineStore('ui', {
  state: () => ({
    view: 'search' as ViewKey,
    installOpen: false,
  }),
  actions: {
    setView(v: ViewKey) {
      this.view = v;
    },
  },
});
