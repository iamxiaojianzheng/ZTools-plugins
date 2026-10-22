import { defineStore } from 'pinia';
import type { MusicItem, LyricData, QualityKey } from '@/types';
import { services } from '@/api/services';
import { useSourceStore } from './sources';
import { useLibraryStore } from './library';
import { useSettingsStore } from './settings';
import { loadState, saveState } from './persist';
import { buildLyrics } from '@/utils/lrc';
import { qualityOrder, trackKey } from '@/utils/format';

let audio: HTMLAudioElement | null = null;
let hls: any = null;
let loadingPhase = false;

const PLAYER_KEY = 'player';

export type PlayMode = 'order' | 'all' | 'one' | 'shuffle';

interface PlayerState {
  current: MusicItem | null;
  queue: MusicItem[];
  index: number;
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  mode: PlayMode;
  usedQuality: QualityKey | '';
  lyric: LyricData;
  lyricLoading: boolean;
  srcError: string;
  showNowPlaying: boolean;
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({
    current: null,
    queue: [],
    index: -1,
    playing: false,
    buffering: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    mode: 'all',
    usedQuality: '',
    lyric: { rawLrc: '', translation: '', lines: [] },
    lyricLoading: false,
    srcError: '',
    showNowPlaying: false,
  }),
  getters: {
    progress(state): number {
      return state.duration ? state.position / state.duration : 0;
    },
    canPrev(state): boolean {
      return state.queue.length > 1 || state.position > 3;
    },
    canNext(state): boolean {
      return state.queue.length > 1;
    },
    modeLabel(state): string {
      return (
        {
          order: '顺序播放',
          all: '列表循环',
          one: '单曲循环',
          shuffle: '随机播放',
        } as Record<PlayMode, string>
      )[state.mode];
    },
    modeIcon(state): string {
      return (
        {
          order: 'list',
          all: 'loop',
          one: 'loop-one',
          shuffle: 'shuffle',
        } as Record<PlayMode, string>
      )[state.mode];
    },
  },
  actions: {
    hydrate() {
      const saved = loadState<any>(PLAYER_KEY, null);
      if (saved) {
        this.queue = saved.queue || [];
        this.current = saved.current || null;
        this.index = typeof saved.index === 'number' ? saved.index : -1;
        this.volume = typeof saved.volume === 'number' ? saved.volume : 0.8;
        this.muted = !!saved.muted;
        // 兼容旧版 repeat + shuffle 两个字段
        if (['order', 'all', 'one', 'shuffle'].includes(saved.mode)) {
          this.mode = saved.mode;
        } else if (saved.shuffle) {
          this.mode = 'shuffle';
        } else if (saved.repeat === 'one') {
          this.mode = 'one';
        } else if (saved.repeat === 'off') {
          this.mode = 'order';
        } else {
          this.mode = 'all';
        }
      }
    },
    persist() {
      saveState(PLAYER_KEY, {
        queue: this.queue,
        current: this.current,
        index: this.index,
        volume: this.volume,
        muted: this.muted,
        mode: this.mode,
        // 兼容旧版本读取
        repeat: this.mode === 'one' ? 'one' : this.mode === 'order' ? 'off' : 'all',
        shuffle: this.mode === 'shuffle',
      });
    },
    initAudio() {
      if (audio) return;
      audio = new Audio();
      audio.preload = 'auto';
      audio.volume = this.muted ? 0 : this.volume;
      audio.addEventListener('play', () => (this.playing = true));
      audio.addEventListener('pause', () => (this.playing = false));
      audio.addEventListener('waiting', () => (this.buffering = true));
      audio.addEventListener('playing', () => (this.buffering = false));
      audio.addEventListener('canplay', () => (this.buffering = false));
      audio.addEventListener('timeupdate', () => {
        this.position = audio!.currentTime || 0;
      });
      audio.addEventListener('loadedmetadata', () => {
        if (audio && isFinite(audio.duration)) this.duration = audio.duration;
      });
      audio.addEventListener('ended', () => this.onEnded());
      audio.addEventListener('error', () => {
        if (!loadingPhase) this.onFatalError();
      });
    },

    /* ---------------- 队列与切换 ---------------- */

    playTrack(track: MusicItem, list?: MusicItem[]) {
      if (list && list.length) {
        this.queue = list.slice();
        this.index = this.queue.findIndex((t) => trackKey(t) === trackKey(track));
        if (this.index < 0) {
          this.queue.unshift(track);
          this.index = 0;
        }
      } else if (!this.queue.length) {
        this.queue = [track];
        this.index = 0;
      } else if (!this.queue.some((t) => trackKey(t) === trackKey(track))) {
        this.queue.push(track);
      }
      if (!list) {
        const i = this.queue.findIndex((t) => trackKey(t) === trackKey(track));
        if (i >= 0) this.index = i;
      }
      this.current = track;
      this.position = 0;
      this.duration = track.duration || 0;
      this.srcError = '';
      this.persist();
      this.loadCurrent();
      this.loadLyric();
      useLibraryStore().pushHistory(track);
    },

    addToQueue(track: MusicItem, immediately = false) {
      this.queue.push(track);
      this.persist();
      if (immediately) this.playAt(this.queue.length - 1);
    },

    async playAt(i: number) {
      if (i < 0 || i >= this.queue.length) return;
      this.index = i;
      this.current = this.queue[i];
      this.position = 0;
      this.duration = this.current.duration || 0;
      this.srcError = '';
      this.persist();
      await this.loadCurrent();
      this.loadLyric();
      useLibraryStore().pushHistory(this.current);
    },

    removeAt(i: number) {
      if (i < 0 || i >= this.queue.length) return;
      const wasCurrent = i === this.index;
      this.queue.splice(i, 1);
      if (i < this.index) this.index--;
      else if (wasCurrent) {
        if (this.index >= this.queue.length) this.index = this.queue.length - 1;
        if (this.queue.length) this.playAt(this.index);
        else this.stop();
      }
      this.persist();
    },

    clearQueue() {
      this.queue = this.current ? [this.current] : [];
      this.index = this.current ? 0 : -1;
      this.persist();
    },

    stop() {
      audio?.pause();
      if (audio) audio.removeAttribute('src');
      this.playing = false;
      this.current = null;
      this.position = 0;
      this.duration = 0;
      this.lyric = { rawLrc: '', translation: '', lines: [] };
      this.persist();
    },

    toggle() {
      if (!this.current) return;
      this.initAudio();
      if (this.playing) {
        audio!.pause();
      } else {
        if (!audio!.src) this.loadCurrent();
        else audio!.play().catch(() => {});
      }
    },

    next(auto = false) {
      if (!this.queue.length) return;
      if (this.mode === 'one' && auto) {
        this.seek(0);
        audio?.play().catch(() => {});
        return;
      }
      let nextIndex: number;
      if (this.mode === 'shuffle') {
        if (this.queue.length === 1) nextIndex = 0;
        else {
          do {
            nextIndex = Math.floor(Math.random() * this.queue.length);
          } while (nextIndex === this.index);
        }
      } else {
        nextIndex = this.index + 1;
        if (nextIndex >= this.queue.length) {
          if (this.mode === 'all') nextIndex = 0;
          else {
            this.playing = false;
            return;
          }
        }
      }
      this.playAt(nextIndex);
    },

    prev() {
      if (this.position > 3 || this.queue.length <= 1) {
        this.seek(0);
        return;
      }
      if (this.mode === 'shuffle') {
        let prevIndex: number;
        do {
          prevIndex = Math.floor(Math.random() * this.queue.length);
        } while (prevIndex === this.index);
        this.playAt(prevIndex);
        return;
      }
      let prevIndex = this.index - 1;
      if (prevIndex < 0) prevIndex = this.mode === 'all' ? this.queue.length - 1 : 0;
      this.playAt(prevIndex);
    },

    onEnded() {
      const settings = useSettingsStore();
      if (settings.autoNext) this.next(true);
      else this.playing = false;
    },

    onFatalError() {
      if (!this.current) return;
      this.srcError = '播放失败，已尝试所有音质';
      if (this.queue.length > 1) this.next(true);
      else this.playing = false;
    },

    /* ---------------- 播放源 ---------------- */

    async loadCurrent() {
      if (!this.current) return;
      this.initAudio();
      const settings = useSettingsStore();
      const sourceStore = useSourceStore();
      const track = this.current;
      const hash = sourceStore.hashOf(track.platform) || track.$$hash;
      if (!hash) {
        this.srcError = '未找到对应音源，请先在音源管理中启用';
        return;
      }
      const qualities = qualityOrder(settings.quality);
      loadingPhase = true;
      this.buffering = true;
      try {
        for (const q of qualities) {
          try {
            const { url, headers } = await services().music.getMediaSource(hash, track, q);
            if (!url) continue;
            const streamUrl = await services().media.getStreamUrl(url, headers || {});
            const ok = await this.tryLoad(streamUrl, url);
            if (ok) {
              this.usedQuality = q as QualityKey;
              this.srcError = '';
              await audio!.play().catch(() => {});
              return;
            }
          } catch (e) {
            /* 尝试下一音质 */
          }
        }
        this.srcError = '无法获取播放地址';
        this.buffering = false;
        if (this.queue.length > 1) this.next(true);
      } finally {
        loadingPhase = false;
      }
    },

    tryLoad(streamUrl: string, originalUrl: string): Promise<boolean> {
      return new Promise((resolve) => {
        const el = audio!;
        const isHls = /\.m3u8(\?|$)/i.test(originalUrl);
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          el.removeEventListener('canplay', onCanPlay);
          el.removeEventListener('error', onError);
          resolve(ok);
        };
        const onCanPlay = () => done(true);
        const onError = () => done(false);
        const timer = setTimeout(() => done(false), 15000);
        el.addEventListener('canplay', onCanPlay);
        el.addEventListener('error', onError);

        if (hls) {
          try {
            hls.destroy();
          } catch (e) {
            /* ignore */
          }
          hls = null;
        }
        if (isHls) {
          import('hls.js').then((mod: any) => {
            const Hls = mod.default || mod;
            if (Hls.isSupported()) {
              hls = new Hls({ enableWorker: true });
              hls.loadSource(streamUrl);
              hls.attachMedia(el);
            } else {
              el.src = streamUrl;
            }
          });
        } else {
          el.src = streamUrl;
          el.load();
        }
      });
    },

    seek(seconds: number) {
      if (!audio || !isFinite(seconds)) return;
      audio.currentTime = Math.max(0, Math.min(seconds, this.duration || seconds));
      this.position = audio.currentTime;
    },

    seekRatio(ratio: number) {
      if (!this.duration) return;
      this.seek(ratio * this.duration);
    },

    /* ---------------- 音量 / 模式 ---------------- */

    setVolume(v: number) {
      this.volume = Math.max(0, Math.min(1, v));
      this.muted = this.volume === 0 ? this.muted : false;
      if (audio) audio.volume = this.muted ? 0 : this.volume;
      this.persist();
    },
    toggleMute() {
      this.muted = !this.muted;
      if (audio) audio.volume = this.muted ? 0 : this.volume;
      this.persist();
    },
    cycleMode() {
      const order: PlayMode[] = ['order', 'all', 'one', 'shuffle'];
      const i = order.indexOf(this.mode);
      this.mode = order[(i + 1) % order.length];
      this.persist();
    },
    setMode(mode: PlayMode) {
      if (mode !== 'order' && mode !== 'all' && mode !== 'one' && mode !== 'shuffle') return;
      this.mode = mode;
      this.persist();
    },

    /* ---------------- 歌词 ---------------- */

    async loadLyric() {
      if (!this.current) return;
      const track = this.current;
      if (track.rawLrc) {
        this.lyric = {
          rawLrc: track.rawLrc,
          translation: track.translation || '',
          lines: buildLyrics(track.rawLrc, track.translation || ''),
        };
        return;
      }
      const sourceStore = useSourceStore();
      const hash = sourceStore.hashOf(track.platform) || track.$$hash;
      if (!hash) return;
      this.lyricLoading = true;
      try {
        const res = await services().music.getLyric(hash, track);
        if (this.current && trackKey(this.current) === trackKey(track)) {
          this.lyric = {
            rawLrc: res?.rawLrc || '',
            translation: res?.translation || '',
            lines: buildLyrics(res?.rawLrc || '', res?.translation || ''),
          };
        }
      } catch (e) {
        /* ignore */
      } finally {
        this.lyricLoading = false;
      }
    },
  },
});
