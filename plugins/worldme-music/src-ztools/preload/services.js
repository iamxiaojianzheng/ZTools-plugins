/**
 * Worldme Music · preload 入口
 * 遵循 CommonJS 规范，向渲染层暴露 window.services。
 * 负责：音源插件加载与调用、媒体代理、本地存储、网络代理。
 */
const fs = require('fs');
const path = require('path');
const store = require('./src/store');
const runtime = require('./src/runtime');
const mediaServer = require('./src/media-server');
const downloader = require('./src/download');
const net = require('./src/net');

const VERSION = '1.1.1';

function ztools() {
  try {
    return (typeof window !== 'undefined' && window.ztools) || null;
  } catch (e) {
    return null;
  }
}

/* ---------------- 音源管理 ---------------- */

async function installFromLocalFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js') {
    const code = fs.readFileSync(filePath, 'utf8');
    return runtime.installFromCode(code);
  }
  if (ext === '.json') {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = (json && json.plugins) || [];
    return runtime.installFromSubscription(entries);
  }
  throw new Error('仅支持 .js 或 .json 文件');
}

async function pickAndInstallLocalFile() {
  const zt = ztools();
  if (!zt || typeof zt.showOpenDialog !== 'function') throw new Error('无法打开文件选择框');
  const files = zt.showOpenDialog({
    title: '选择音源插件文件',
    properties: ['openFile'],
    filters: [{ name: '音源插件', extensions: ['js', 'json'] }],
  });
  if (!files || !files.length) return null;
  return installFromLocalFile(files[0]);
}

/* ---------------- 对外服务 ---------------- */

window.services = {
  version: VERSION,

  /** 初始化：加载磁盘上的音源 + 启动媒体代理 + 应用代理配置 */
  ready: async () => {
    try {
      net.applyDefaults();
    } catch (e) {
      /* ignore */
    }
    runtime.loadFromDisk();
    let port = 0;
    try {
      port = await mediaServer.getPort();
    } catch (e) {
      console.warn('媒体代理启动失败', e);
    }
    return { version: VERSION, mediaPort: port, network: net.getProxyInfo() };
  },

  plugins: {
    list: () => runtime.list(),
    installFromUrl: (url) => runtime.installFromUrl(url),
    installFromCode: (code, options) => runtime.installFromCode(code, options),
    fetchSubscription: (url) => runtime.fetchSubscription(url),
    installFromSubscription: (entries, onProgress) =>
      runtime.installFromSubscription(entries, { onProgress }),
    installFromJsonUrl: (url, onProgress) => runtime.installFromJsonUrl(url, onProgress),
    installFromJsonCode: async (text, onProgress) => {
      const json = JSON.parse(text);
      return runtime.installFromSubscription((json && json.plugins) || [], { onProgress });
    },
    installFromLocalFile,
    pickAndInstallLocalFile,
    uninstall: (hash) => runtime.uninstall(hash),
    setEnabled: (hash, enabled) => runtime.setEnabled(hash, enabled),
    setOrder: (hash, order) => runtime.setOrder(hash, order),
    update: (hash) => runtime.update(hash),
    setUserVariables: (hash, vars) => runtime.setUserVariables(hash, vars),
  },

  music: {
    search: (hash, query, page, type) => runtime.search(hash, query, page, type),
    getMediaSource: (hash, item, quality) => runtime.getMediaSource(hash, item, quality),
    getMusicInfo: (hash, item) => runtime.getMusicInfo(hash, item),
    getLyric: (hash, item) => runtime.getLyric(hash, item),
    getAlbumInfo: (hash, item, page) => runtime.getAlbumInfo(hash, item, page),
    getMusicSheetInfo: (hash, item, page) => runtime.getMusicSheetInfo(hash, item, page),
    getArtistWorks: (hash, item, page, type) => runtime.getArtistWorks(hash, item, page, type),
    getTopLists: (hash) => runtime.getTopLists(hash),
    getTopListDetail: (hash, item, page) => runtime.getTopListDetail(hash, item, page),
    getRecommendSheetTags: (hash) => runtime.getRecommendSheetTags(hash),
    getRecommendSheetsByTag: (hash, tag, page) => runtime.getRecommendSheetsByTag(hash, tag, page),
    importMusicItem: (hash, urlLike) => runtime.importMusicItem(hash, urlLike),
    importMusicSheet: (hash, urlLike) => runtime.importMusicSheet(hash, urlLike),
    getMusicComments: (hash, item, page) => runtime.getMusicComments(hash, item, page),
  },

  media: {
    getStreamUrl: (url, headers) => mediaServer.getStreamUrl(url, headers),
    getPort: () => mediaServer.getPort(),
    download: (url, headers, filename, onProgress) => downloader.download(url, headers, filename, onProgress),
    setLyricsState: (state) => mediaServer.setLyricsState(state),
    getLyricsSync: () => mediaServer.getSyncInfo(),
  },

  network: {
    get: () => net.getProxyInfo(),
    set: (config) => net.setProxyConfig(config),
    detect: () => net.proxies.detectSystemProxy(true),
    test: (url) => net.testConnection(url),
    mirrorList: (url) => net.mirrorList(url),
  },

  storage: {
    get: (key) => store.storageGet(key),
    set: (key, value) => store.storageSet(key, value),
    remove: (key) => store.storageRemove(key),
    all: () => store.storageAll(),
    kind: () => store.kind(),
  },
};

/* 页面隐藏前关闭媒体代理 */
window.addEventListener('beforeunload', () => {
  /* 交由进程退出回收 */
});

console.log('🎵 Worldme Music preload loaded (v' + VERSION + ')');
