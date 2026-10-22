<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import Icon from '@/components/Icon.vue';
import PlayerBar from '@/components/PlayerBar.vue';
import NowPlaying from '@/components/NowPlaying.vue';
import ToastHost from '@/components/ToastHost.vue';
import SearchView from '@/views/SearchView.vue';
import LibraryView from '@/views/LibraryView.vue';
import QueueView from '@/views/QueueView.vue';
import SourceManager from '@/views/SourceManager.vue';
import SettingsView from '@/views/SettingsView.vue';
import TopListView from '@/views/TopListView.vue';
import DownloadsView from '@/views/DownloadsView.vue';
import DetailView from '@/views/DetailView.vue';
import { useUiStore, type ViewKey } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useSourceStore } from '@/stores/sources';
import { useSearchStore } from '@/stores/search';
import { useDetailStore } from '@/stores/detail';
import { useDownloadStore } from '@/stores/downloads';
import { waitForServices, hasServices } from '@/api/services';
import { isDark, onThemeChange, onPluginEnter } from '@/api/ztools';
import { startLyricsBridge } from '@/composables/desktopLyrics';
import { toast } from '@/composables/toast';

const ui = useUiStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const library = useLibraryStore();
const sources = useSourceStore();
const search = useSearchStore();
const detail = useDetailStore();
const downloads = useDownloadStore();

const systemDark = ref(isDark());
const dark = computed(() => (settings.theme === 'auto' ? systemDark.value : settings.theme === 'dark'));
watchEffect(() => document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : 'light'));

const nav: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: 'search', label: '搜索', icon: 'search' },
  { key: 'toplist', label: '排行榜', icon: 'disc' },
  { key: 'queue', label: '播放列表', icon: 'list' },
  { key: 'favorites', label: '我的收藏', icon: 'heart' },
  { key: 'history', label: '最近播放', icon: 'history' },
  { key: 'downloads', label: '下载', icon: 'download' },
  { key: 'sources', label: '音源管理', icon: 'sparkles' },
  { key: 'settings', label: '设置', icon: 'settings' },
];

const viewComponent = computed(() => {
  switch (ui.view) {
    case 'toplist':
      return TopListView;
    case 'queue':
      return QueueView;
    case 'favorites':
      return () => h(LibraryView, { kind: 'favorites' });
    case 'history':
      return () => h(LibraryView, { kind: 'history' });
    case 'downloads':
      return DownloadsView;
    case 'sources':
      return SourceManager;
    case 'settings':
      return SettingsView;
    default:
      return SearchView;
  }
});

const ambient = computed(() => {
  const art = player.current?.artwork;
  return art ? { backgroundImage: `url("${art}")` } : {};
});

function badge(key: ViewKey): number {
  if (key === 'queue') return player.queue.length;
  if (key === 'favorites') return library.favorites.length;
  if (key === 'history') return library.history.length;
  if (key === 'downloads') return downloads.activeCount;
  if (key === 'sources') return sources.enabled.length;
  return 0;
}

let stopLyricsBridge: (() => void) | null = null;

onMounted(async () => {
  try {
    await waitForServices();
    await window.services!.ready();
  } catch (e: any) {
    toast('初始化失败：' + (e?.message || e), 'error');
  }

  settings.hydrate();
  player.hydrate();
  library.hydrate();
  player.initAudio();

  onThemeChange((d) => (systemDark.value = d));

  if (hasServices()) {
    try {
      await sources.refresh();
    } catch (e) {
      /* ignore */
    }
  }

  onPluginEnter((payload) => {
    if (payload) {
      detail.close();
      ui.setView('search');
      search.run(payload);
    }
  });

  // 开发预览：支持通过 URL 参数直达指定页面，便于截图与调试
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search);
    const view = params.get('view') as ViewKey | null;
    if (view) ui.setView(view);
    const q = params.get('q');
    if (q) {
      ui.setView('search');
      search.run(q);
    }
    if (params.has('np')) {
      player.showNowPlaying = true;
      player.loadLyric();
    }
  }

  stopLyricsBridge = startLyricsBridge();
});

onUnmounted(() => {
  stopLyricsBridge?.();
});
</script>

<template>
  <div class="app">
    <div class="ambient" :style="ambient"></div>
    <div class="ambient-mask"></div>

    <div class="shell">
      <aside class="sidebar">
        <div class="brand" @click="detail.close(); ui.setView('search')">
          <div class="brand-logo"><Icon name="music" :size="22" /></div>
          <div class="brand-text">
            <strong>Worldme</strong>
            <span class="text-3">音乐</span>
          </div>
        </div>

        <nav class="nav">
          <button
            v-for="item in nav"
            :key="item.key"
            class="nav-item"
            :class="{ on: !detail.open && ui.view === item.key }"
            @click="detail.close(); ui.setView(item.key)"
          >
            <Icon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
            <span v-if="badge(item.key)" class="badge">{{ badge(item.key) }}</span>
          </button>
        </nav>

        <div class="sidebar-foot">
          <button class="nav-item" @click="detail.close(); ui.setView('sources'); ui.installOpen = true">
            <Icon name="plus" :size="18" />
            <span>添加音源</span>
          </button>
        </div>
      </aside>

      <main class="main">
        <DetailView v-if="detail.open" />
        <component :is="viewComponent" v-else />
      </main>
    </div>

    <PlayerBar v-if="player.current" />

    <Transition name="fade">
      <NowPlaying v-if="player.showNowPlaying" />
    </Transition>

    <ToastHost />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.ambient {
  position: absolute;
  inset: -10% -10% 0;
  background-size: cover;
  background-position: center 20%;
  filter: blur(90px) saturate(1.7);
  opacity: 0.22;
  transition: background-image 0.8s ease;
  z-index: 0;
}
.ambient-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent, var(--bg) 92%);
  z-index: 0;
}
.shell {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.sidebar {
  width: 224px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 14px 10px;
  gap: 6px;
  min-height: 0;
  overflow: hidden;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 4px 8px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
}
.brand-logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 10px 24px rgba(139, 92, 246, 0.4);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.brand-text strong {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.brand-text span {
  font-size: 11px;
  margin-top: 2px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.nav::-webkit-scrollbar {
  width: 0;
}
.nav-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 13.5px;
  color: var(--text-2);
  transition: all 0.16s ease;
  text-align: left;
}
.nav-item:hover {
  background: var(--panel-hover);
  color: var(--text);
}
.nav-item.on {
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 8px 20px rgba(139, 92, 246, 0.32);
}
.nav-item span:first-of-type {
  flex: 1;
}
.badge {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--panel-hover);
  color: var(--text-2);
}
.nav-item.on .badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.sidebar-foot {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding-top: 16px;
  overflow: hidden;
}

/* 窗口较矮时适度收紧，保持菜单大气且不与播放器挤压 */
@media (max-height: 600px) {
  .sidebar {
    padding: 10px 12px 2px;
    gap: 3px;
  }
  .brand {
    padding: 4px 8px 10px;
    gap: 10px;
  }
  .brand-logo {
    width: 42px;
    height: 42px;
    border-radius: 14px;
  }
  .brand-text strong {
    font-size: 16.5px;
  }
  .brand-text span {
    font-size: 10.5px;
  }
  .nav {
    gap: 2px;
  }
  .nav-item {
    height: 37px;
    padding: 0 13px;
    border-radius: 10px;
    font-size: 13px;
    gap: 11px;
  }
  /* 矮窗口下用标题栏的 + 快捷入口替代底部入口，给菜单留出空间 */
  .sidebar-foot {
    display: none;
  }
}

/* 极矮窗口下给可滚动导航一个渐隐提示 */
@media (max-height: 440px) {
  .nav {
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent);
  }
}
</style>
