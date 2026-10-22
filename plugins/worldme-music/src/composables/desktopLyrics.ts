import { ref } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { activeLineIndex } from '@/utils/lrc';
import { services, hasServices } from '@/api/services';

const CHANNEL = 'wm-desktop-lyrics';
const STATE_KEY = 'wm:lyrics:state';

export const lyricsWindowOpen = ref(false);

let win: any = null;
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch (e) {
    channel = null;
  }
  return channel;
}

function lyricsUrl(): string {
  return new URL('lyrics.html', location.href).href;
}

function broadcastRaw(payload: any) {
  // 通过本地同步接口推送给独立歌词窗口（对 file:// 窗口也可靠）
  if (payload && payload.type === 'state' && hasServices()) {
    try {
      services().media.setLyricsState?.(payload.state);
    } catch (e) {
      /* ignore */
    }
  }
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
  } catch (e) {
    /* ignore */
  }
  try {
    getChannel()?.postMessage(payload);
  } catch (e) {
    /* ignore */
  }
}

export function broadcastLyrics(state: any) {
  broadcastRaw({ type: 'state', state });
}

export async function openDesktopLyrics() {
  let url = lyricsUrl();
  try {
    if (hasServices()) {
      const sync = await services().media.getLyricsSync?.();
      if (sync?.port) url += `?port=${sync.port}&token=${encodeURIComponent(sync.token)}`;
    }
  } catch (e) {
    /* ignore */
  }

  if (window.ztools && typeof window.ztools.createBrowserWindow === 'function') {
    win = window.ztools.createBrowserWindow(
      url,
      {
        width: 860,
        height: 190,
        frame: false,
        transparent: true,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          zoomFactor: 1,
        },
      },
      () => {}
    );
  } else {
    win = window.open(url, 'wm-desktop-lyrics', 'width=860,height=190');
  }
  lyricsWindowOpen.value = true;
  // 给窗口一点时间加载，再推送一次当前状态
  setTimeout(() => broadcastLyrics(currentState()), 500);
}

export function closeDesktopLyrics() {
  broadcastRaw({ type: 'cmd', cmd: 'close' });
  try {
    win?.close?.();
    win?.destroy?.();
  } catch (e) {
    /* ignore */
  }
  win = null;
  lyricsWindowOpen.value = false;
}

export function toggleDesktopLyrics() {
  if (lyricsWindowOpen.value) closeDesktopLyrics();
  else openDesktopLyrics();
}

export function currentState() {
  const player = usePlayerStore();
  const settings = useSettingsStore();
  const lines = player.lyric?.lines || [];
  const idx = activeLineIndex(lines, player.position);
  const cur = lines[idx];
  const next = lines[idx + 1];
  return {
    title: player.current?.title || '',
    artist: player.current?.artist || '',
    artwork: player.current?.artwork || '',
    playing: player.playing,
    text: cur?.text || '',
    translation: settings.showTranslation ? cur?.translation || '' : '',
    next: next?.text || '',
    progress: player.duration ? player.position / player.duration : 0,
    hasLyric: lines.length > 0,
  };
}

/** 在插件主窗口内启动桌面歌词桥接（定时推送当前歌词状态） */
export function startLyricsBridge(): () => void {
  const timer = setInterval(() => {
    if (lyricsWindowOpen.value) broadcastLyrics(currentState());
  }, 300);
  return () => clearInterval(timer);
}
