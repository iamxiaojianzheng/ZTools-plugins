/**
 * 仅开发预览用的 mock 服务
 * 当直接在浏览器（npm run dev）打开界面、且没有 preload 注入时启用，
 * 让 UI 可以在没有 ZTools 宿主的情况下完整预览（含播放、歌词、榜单、下载等）。
 */
import type { MusicItem, SourceMeta } from '@/types';

const MP3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

const LRC = `[00:00.00]Worldme Music
[00:03.00]这是一个示例歌词
[00:07.00]用于预览播放器的界面效果
[00:11.50]玻璃拟态 · 渐变 · 专辑封面背景
[00:16.00]拖动进度条可以定位歌词
[00:20.00]点击歌词行也可以跳转
[00:25.00]Playing preview track
[00:30.00]Lyrics scroll automatically
[00:35.00]支持原文与翻译双行显示
[00:40.00]翻译行会显示在下方
[00:46.00]祝使用愉快
[00:52.00]Worldme Music
[00:58.00]享受你的音乐
`;

const TRANS = `[00:35.00]translation line supported
[00:40.00]shown below the original
[00:46.00]Have a nice day
`;

const fakeSources: SourceMeta[] = [
  {
    hash: 'mockA',
    platform: '示例音源 A',
    version: '1.2.0',
    author: 'Worldme',
    enabled: true,
    order: 0,
    srcUrl: 'https://example.com/a.js',
    supportedSearchType: ['music', 'album', 'artist', 'sheet'],
  },
  {
    hash: 'mockB',
    platform: '示例音源 B',
    version: '0.9.1',
    author: 'Worldme',
    enabled: true,
    order: 1,
    supportedSearchType: ['music', 'album', 'artist', 'sheet'],
    userVariables: [{ key: 'cookie', title: 'Cookie' }],
  },
];

const ARTISTS = ['周杰伦', '林俊杰', '陈奕迅', 'Taylor Swift'];

function makeTracks(hash: string, platform: string, query: string, page: number): MusicItem[] {
  const out: MusicItem[] = [];
  for (let i = 0; i < 12; i++) {
    const n = (page - 1) * 12 + i + 1;
    out.push({
      platform,
      id: `${hash}-${n}`,
      title: `${query} · 示例曲目 ${n}`,
      artist: ARTISTS[n % 4],
      album: '示例专辑 Vol.' + (1 + (n % 3)),
      artwork: `https://picsum.photos/seed/wm${hash}${n}/300/300`,
      duration: 180 + ((n * 7) % 90),
      $$hash: hash,
    });
  }
  return out;
}

function makeAlbums(hash: string, platform: string, query: string, page: number): any[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = (page - 1) * 12 + i + 1;
    return {
      platform,
      id: `alb-${hash}-${n}`,
      title: `${query} · 示例专辑 ${n}`,
      artist: ARTISTS[n % 4],
      artwork: `https://picsum.photos/seed/alb${hash}${n}/300/300`,
      worksNum: 8 + (n % 7),
      description: '这是一张用于预览界面效果的示例专辑。',
      $$hash: hash,
    };
  });
}

function makeSheets(hash: string, platform: string, query: string, page: number): any[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = (page - 1) * 12 + i + 1;
    return {
      platform,
      id: `sheet-${hash}-${n}`,
      title: `${query} · 精选歌单 ${n}`,
      artist: 'Worldme 编辑部',
      artwork: `https://picsum.photos/seed/sheet${hash}${n}/300/300`,
      worksNum: 20 + (n % 30),
      description: '示例歌单简介：适合工作、通勤与夜晚聆听。',
      $$hash: hash,
    };
  });
}

function makeArtists(hash: string, platform: string, query: string, page: number): any[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = (page - 1) * 12 + i + 1;
    return {
      platform,
      id: `artist-${hash}-${n}`,
      name: `${query} 歌手 ${n}`,
      artist: `${query} 歌手 ${n}`,
      avatar: `https://picsum.photos/seed/artist${hash}${n}/300/300`,
      artwork: `https://picsum.photos/seed/artist${hash}${n}/300/300`,
      fans: 12000 * n,
      description: '示例歌手简介：代表作品若干，风格多变。',
      $$hash: hash,
    };
  });
}

function readKV(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('wm-mock') || '{}');
  } catch (e) {
    return {};
  }
}
function writeKV(d: Record<string, any>) {
  localStorage.setItem('wm-mock', JSON.stringify(d));
}

export function setupMock() {
  if ((window as any).services) return;
  const sources = fakeSources;
  const platformOf = (hash: string) => sources.find((s) => s.hash === hash)?.platform || '示例音源';

  // ?demo=1 时预置一首正在播放的歌曲，便于检查带播放条时的布局
  if (new URLSearchParams(location.search).has('demo')) {
    const d = readKV();
    if (!d.player || !d.player.current) {
      const track = makeTracks('mockA', '示例音源 A', '演示曲目', 1)[0];
      d.player = {
        current: track,
        queue: [track],
        index: 0,
        volume: 0.8,
        muted: false,
        mode: 'all',
      };
      writeKV(d);
    }
  }

  const services = {
    version: '0.1.0-dev',
    ready: async () => ({ version: '0.1.0-dev', mediaPort: 0 }),
    plugins: {
      list: async () => sources,
      installFromUrl: async (url: string) => {
        const meta: SourceMeta = {
          hash: 'mock-' + sources.length,
          platform: '新音源 ' + (sources.length + 1),
          version: '0.0.1',
          enabled: true,
          order: sources.length,
          srcUrl: url,
          supportedSearchType: ['music', 'album', 'artist', 'sheet'],
        };
        sources.push(meta);
        return meta;
      },
      installFromCode: async () => fakeSources[0],
      installFromJsonCode: async () => [],
      installFromLocalFile: async () => fakeSources[0],
      pickAndInstallLocalFile: async () => fakeSources[0],
      uninstall: async (hash: string) => {
        const i = sources.findIndex((s) => s.hash === hash);
        if (i >= 0) sources.splice(i, 1);
        return true;
      },
      setEnabled: async (hash: string, enabled: boolean) => {
        const s = sources.find((x) => x.hash === hash);
        if (s) s.enabled = enabled;
        return s;
      },
      setOrder: async () => null,
      update: async () => fakeSources[0],
      setUserVariables: async () => fakeSources[0],
      fetchSubscription: async () => ({
        desc: '开发预览示例订阅',
        plugins: [
          { name: '示例音源 A', url: 'https://example.com/a.js', version: '1.2.0' },
          { name: '示例音源 B', url: 'https://example.com/b.js', version: '0.9.1' },
          { name: '示例音源 C', url: 'https://example.com/c.js', version: '2.0.0' },
        ],
      }),
      installFromSubscription: async (entries: any[], onProgress?: any) => {
        const total = entries.length;
        const results: any[] = [];
        let ok = 0;
        let failed = 0;
        for (let i = 0; i < total; i++) {
          const e = entries[i];
          if (onProgress) onProgress({ phase: 'install', done: i, total, current: e.name, status: 'running' });
          await new Promise((r) => setTimeout(r, 220));
          const item = { name: e.name, url: e.url, ok: true, platform: e.name, version: e.version };
          results.push(item);
          ok++;
          if (onProgress) onProgress({ phase: 'install', done: i + 1, total, current: e.name, status: 'ok' });
        }
        return { ok, failed, total, results };
      },
      installFromJsonUrl: async (url: string, onProgress?: any) => {
        const entries = [
          { name: '示例音源 A', url, version: '1.2.0' },
          { name: '示例音源 B', url, version: '0.9.1' },
        ];
        return (window as any).services.plugins.installFromSubscription(entries, onProgress);
      },
    },
    music: {
      search: async (hash: string, query: string, page = 1, type = 'music') => {
        const platform = platformOf(hash);
        await new Promise((r) => setTimeout(r, 320 + Math.random() * 300));
        let data: any[];
        if (type === 'album') data = makeAlbums(hash, platform, query, page);
        else if (type === 'sheet') data = makeSheets(hash, platform, query, page);
        else if (type === 'artist') data = makeArtists(hash, platform, query, page);
        else data = makeTracks(hash, platform, query, page);
        return { isEnd: page >= 3, data };
      },
      getMediaSource: async () => ({ url: MP3, headers: {} }),
      getMusicInfo: async () => null,
      getLyric: async () => ({ rawLrc: LRC, translation: TRANS }),
      getAlbumInfo: async (hash: string, item: any, page = 1) => ({
        isEnd: page >= 2,
        albumItem: item,
        musicList: makeTracks(hash, platformOf(hash), item?.title || '专辑', page),
      }),
      getMusicSheetInfo: async (hash: string, item: any, page = 1) => ({
        isEnd: page >= 2,
        sheetItem: item,
        musicList: makeTracks(hash, platformOf(hash), item?.title || '歌单', page),
      }),
      getArtistWorks: async (hash: string, item: any, page = 1, type = 'music') => {
        const name = item?.name || item?.title || '歌手';
        if (type === 'album') return { isEnd: page >= 2, data: makeAlbums(hash, platformOf(hash), name, page) };
        return { isEnd: page >= 2, data: makeTracks(hash, platformOf(hash), name, page) };
      },
      getTopLists: async (hash: string) => {
        const platform = platformOf(hash);
        const mk = (n: number, title: string) => ({
          platform,
          id: `top-${hash}-${n}`,
          title,
          artwork: `https://picsum.photos/seed/top${hash}${n}/300/300`,
          description: '示例榜单',
          $$hash: hash,
        });
        return [
          { title: '热门榜单', data: [mk(1, '飙升榜'), mk(2, '热歌榜'), mk(3, '新歌榜'), mk(4, '原创榜')] },
          { title: '风格榜单', data: [mk(5, '华语流行'), mk(6, '欧美热歌'), mk(7, '电子音乐'), mk(8, '民谣')] },
        ];
      },
      getTopListDetail: async (hash: string, item: any, page = 1) => ({
        isEnd: page >= 2,
        topListItem: item,
        musicList: makeTracks(hash, platformOf(hash), item?.title || '榜单', page),
      }),
      getRecommendSheetTags: async () => ({ data: [] }),
      getRecommendSheetsByTag: async () => ({ isEnd: true, data: [] }),
      importMusicItem: async (hash: string, urlLike: string) =>
        makeTracks(hash, platformOf(hash), '导入单曲 ' + urlLike.slice(0, 12), 1)[0],
      importMusicSheet: async (hash: string, urlLike: string) =>
        makeTracks(hash, platformOf(hash), '导入歌单 ' + urlLike.slice(0, 12), 1),
      getMusicComments: async () => ({ isEnd: true, data: [] }),
    },
    media: {
      // 浏览器直连，无需本地代理
      getStreamUrl: async (url: string) => url,
      getPort: async () => 0,
      download: async (url: string, headers: any, filename: string, onProgress?: any) => {
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 120));
          if (typeof onProgress === 'function') onProgress((i + 1) / 12, (i + 1) * 800000, 9600000);
        }
        return { canceled: false, path: '（开发预览）' + filename, size: 9600000 };
      },
      setLyricsState: () => true,
      getLyricsSync: async () => ({ port: 0, token: '' }),
    },
    network: {
      get: () => ({ config: { mode: 'off', url: '', mirror: true }, active: null, platform: 'web' }),
      set: (config: any) => ({ config: { mode: 'off', url: '', mirror: true, ...config }, active: null, platform: 'web' }),
      detect: () => null,
      test: async () => ({ ok: true, status: 200, ms: 1, viaProxy: false, proxy: '', target: '开发预览' }),
      mirrorList: () => [],
    },
    storage: {
      get: (key: string) => {
        const v = readKV()[key];
        return v == null ? null : v;
      },
      set: (key: string, value: any) => {
        const d = readKV();
        d[key] = value;
        writeKV(d);
        return true;
      },
      remove: (key: string) => {
        const d = readKV();
        delete d[key];
        writeKV(d);
        return true;
      },
      all: () => readKV(),
      kind: () => 'memory' as const,
    },
  };

  (window as any).services = services;
  // eslint-disable-next-line no-console
  console.info('[Worldme] 开发预览模式：已注入 mock 服务');
}
