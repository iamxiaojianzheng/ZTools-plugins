/**
 * 音源运行时
 * 加载并执行 MusicFree 协议的音源插件（CommonJS 单文件），并提供统一的调用入口。
 * 加载方式与 MusicFree 桌面端保持一致：Function(require, __musicfree_require, module, exports, console, env, process)
 */
const crypto = require('crypto');
const store = require('./store');
const net = require('./net');
const _require = require('./require-shim');

const APP_VERSION = '1.1.1';

/** hash -> { meta, instance } */
const plugins = new Map();
let loaded = false;

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseVersion(v) {
  return String(v || '0.0.0')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
}

/** a > b 返回 1，a < b 返回 -1，相等返回 0 */
function compareVersion(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const x = av[i] || 0;
    const y = bv[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function getUserVariables(platform) {
  const meta = findMetaByPlatform(platform);
  return normalizeValues(meta);
}

/** 取出音源的用户变量值（兼容旧版把值直接存在 userVariables 的数据） */
function normalizeValues(meta) {
  if (!meta) return {};
  if (meta.userVariableValues && typeof meta.userVariableValues === 'object' && !Array.isArray(meta.userVariableValues)) {
    return Object.assign({}, meta.userVariableValues);
  }
  if (meta.userVariables && !Array.isArray(meta.userVariables) && typeof meta.userVariables === 'object') {
    return Object.assign({}, meta.userVariables);
  }
  return {};
}

function describeCompileError(err) {
  const msg = (err && err.message) || String(err);
  const dup = msg.match(/Identifier '([^']+)' has already been declared/);
  if (dup) {
    return `音源文件存在语法错误：标识符 “${dup[1]}” 被重复声明（属于音源自身代码问题）`;
  }
  return `音源文件存在语法错误：${msg}`;
}

/** 将插件代码实例化为插件对象 */
function instantiate(code) {
  const module = { exports: {}, loaded: false };
  const holder = { platform: '' };

  const env = {
    getUserVariables: () => getUserVariables(holder.platform),
    os: process.platform,
    appVersion: APP_VERSION,
    lang: 'zh-CN',
  };

  const processShim = {
    platform: process.platform,
    version: process.version,
    env: Object.assign({ NODE_ENV: 'production' }, env),
    ensurePluginInitialized: Promise.resolve(),
  };

  // 额外包一层块级作用域：允许插件在顶层声明 const/let/class env（或 module/process/console），
  // 从而遮蔽同名注入参数，避免 “Identifier 'env' has already been declared”。
  let factory;
  try {
    factory = Function(
      "'use strict';" +
        'return function(require, __musicfree_require, module, exports, console, env, process) {\n{\n' +
        code +
        '\n}\n};'
    );
  } catch (e) {
    throw new Error(describeCompileError(e));
  }

  try {
    factory()(_require, _require, module, module.exports, console, env, processShim);
  } catch (e) {
    throw new Error('音源初始化失败：' + ((e && e.message) || e));
  }

  let instance = module.exports && module.exports.default ? module.exports.default : module.exports;
  if (!instance || typeof instance !== 'object') {
    throw new Error('插件未导出有效的对象');
  }
  module.loaded = true;
  holder.platform = instance.platform;
  return instance;
}

function buildMetaFromInstance(instance, extra) {
  const code = extra.code;
  const meta = {
    hash: sha256(code),
    platform: instance.platform,
    title: instance.platform,
    author: instance.author || '',
    version: instance.version || '0.0.0',
    srcUrl: instance.srcUrl || '',
    primaryKey: instance.primaryKey || ['id'],
    cacheControl: instance.cacheControl || 'no-cache',
    supportedSearchType: instance.supportedSearchType || ['music', 'album', 'artist', 'sheet', 'lyric'],
    hints: instance.hints || {},
    // 用户变量声明（schema）
    userVariables: (Array.isArray(instance.userVariables) ? instance.userVariables : []).filter((it) => it && it.key),
    // 用户变量值（值对象，按 key 存储）
    userVariableValues: {},
    enabled: true,
    order: 0,
    stateCode: '',
    installedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const patch = extra.metaPatch || {};
  Object.keys(patch).forEach((key) => {
    if (patch[key] !== undefined) meta[key] = patch[key];
  });
  return meta;
}

function findMeta(hash) {
  const rec = plugins.get(hash);
  return rec ? rec.meta : null;
}

function findMetaByPlatform(platform) {
  for (const rec of plugins.values()) {
    if (rec.meta.platform === platform) return rec.meta;
  }
  return null;
}

/** 把磁盘上保存的元数据与插件实例同步进内存 */
function register(code, metaPatch) {
  const instance = instantiate(code);
  if (!instance.platform) throw new Error('插件缺少 platform 字段');
  const meta = buildMetaFromInstance(instance, { code, metaPatch });
  plugins.set(meta.hash, { meta, instance });
  return meta;
}

function loadFromDisk() {
  if (loaded) return;
  const metas = store.readSourcesMeta();
  const kept = [];
  metas.forEach((meta) => {
    const code = store.readSourceCode(meta.hash);
    if (!code) return;
    try {
      const instance = instantiate(code);
      if (!instance.platform) throw new Error('missing platform');
      const fresh = buildMetaFromInstance(instance, { code });
      const merged = Object.assign({}, fresh, meta);
      // schema 始终以当前音源代码为准；值单独保存，并兼容旧版把值写进 userVariables 的数据
      merged.userVariables = fresh.userVariables;
      merged.userVariableValues = normalizeValues(meta);
      merged.stateCode = '';
      merged.version = meta.version || instance.version || '0.0.0';
      plugins.set(merged.hash, { meta: merged, instance });
      kept.push(merged);
    } catch (e) {
      const broken = Object.assign({}, meta, {
        stateCode: 'CANNOT_PARSE',
        errorMessage: (e && e.message) || '加载失败',
        userVariableValues: normalizeValues(meta),
      });
      if (!Array.isArray(broken.userVariables)) broken.userVariables = [];
      plugins.set(broken.hash, { meta: broken, instance: null });
      kept.push(broken);
    }
  });
  store.writeSourcesMeta(kept);
  loaded = true;
}

function persist() {
  const list = [];
  plugins.forEach((rec) => list.push(rec.meta));
  store.writeSourcesMeta(list);
}

function publicMeta(meta) {
  if (!meta) return null;
  return Object.assign({}, meta);
}

function list() {
  const arr = [];
  plugins.forEach((rec) => arr.push(publicMeta(rec.meta)));
  arr.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.platform > b.platform ? 1 : -1));
  return arr;
}

async function installFromCode(code, options) {
  options = options || {};
  if (typeof code !== 'string' || !code.trim()) throw new Error('插件内容为空');
  const instance = instantiate(code);
  if (!instance.platform) throw new Error('插件缺少 platform 字段');
  if (instance.platform === '本地') throw new Error('插件名 “本地” 被保留，无法安装');

  const hash = sha256(code);
  const existingSameHash = plugins.get(hash);
  if (existingSameHash && !options.force) {
    return publicMeta(existingSameHash.meta);
  }

  const byPlatform = findMetaByPlatform(instance.platform);
  if (byPlatform && !options.force) {
    if (compareVersion(byPlatform.version || '0', instance.version || '0') > 0) {
      throw new Error('已安装更高版本的插件（' + byPlatform.version + '）');
    }
  }

  const meta = buildMetaFromInstance(instance, {
    code,
    metaPatch: {
      srcUrl: options.srcUrl || instance.srcUrl || (byPlatform && byPlatform.srcUrl) || '',
      enabled: byPlatform ? byPlatform.enabled !== false : true,
      order: byPlatform ? byPlatform.order || 0 : plugins.size,
      // 保留同名音源已填写的用户变量值；声明由新代码决定
      userVariableValues: normalizeValues(byPlatform),
    },
  });

  store.writeSourceCode(meta.hash, code);
  if (byPlatform && byPlatform.hash !== meta.hash) {
    plugins.delete(byPlatform.hash);
    store.removeSourceCode(byPlatform.hash);
  }
  plugins.set(meta.hash, { meta, instance });
  persist();
  return publicMeta(meta);
}

async function installFromUrl(url, options) {
  const original = String(url).trim();
  if (!original) throw new Error('音源地址为空');
  const code = await net.fetchText(net.addRandomHash(original), { timeout: 30000, retries: 2 });
  if (!code || code.trim().length < 10) throw new Error('下载音源失败：内容为空');
  return installFromCode(code, Object.assign({}, options, { srcUrl: original }));
}

/** 拉取订阅列表（不安装），供 UI 勾选 */
async function fetchSubscription(url) {
  const original = String(url).trim();
  if (!original) throw new Error('订阅地址为空');
  const json = await net.fetchJSON(net.addRandomHash(original), { timeout: 30000, retries: 2 });
  const list = Array.isArray(json && json.plugins) ? json.plugins : [];
  return {
    desc: (json && json.desc) || '',
    plugins: list
      .filter((p) => p && p.url)
      .map((p) => ({ name: p.name || '', url: p.url, version: p.version || '' })),
  };
}

/**
 * 安装订阅中选中的音源
 * @param {Array<{name:string,url:string,version?:string}>} entries
 * @param {{onProgress?:Function, concurrency?:number}} options
 */
async function installFromSubscription(entries, options) {
  options = options || {};
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && e.url);
  const total = list.length;
  const results = [];
  let done = 0;
  let ok = 0;
  let failed = 0;
  const concurrency = Math.max(1, Math.min(5, options.concurrency || 3));

  const emit = (payload) => {
    try {
      if (typeof options.onProgress === 'function') options.onProgress(payload);
    } catch (e) {
      /* ignore */
    }
  };

  emit({ phase: 'install', done: 0, total, current: '', status: 'start' });

  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= list.length) return;
      const entry = list[i];
      emit({ phase: 'install', done, total, current: entry.name || entry.url, status: 'running' });
      let item;
      try {
        const meta = await installFromUrl(entry.url);
        item = {
          name: entry.name || meta.platform,
          url: entry.url,
          ok: true,
          platform: meta.platform,
          version: meta.version,
        };
        ok++;
      } catch (e) {
        item = { name: entry.name || '', url: entry.url, ok: false, error: (e && e.message) || '安装失败' };
        failed++;
      }
      results.push(item);
      done++;
      emit({
        phase: 'install',
        done,
        total,
        current: entry.name || entry.url,
        status: item.ok ? 'ok' : 'fail',
        error: item.error || '',
        platform: item.platform || '',
        version: item.version || '',
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, total)) }, () => worker());
  await Promise.all(workers);
  return { ok, failed, total, results };
}

/** 兼容旧接口：拉取订阅并安装全部 */
async function installFromJsonUrl(url, onProgress) {
  const sub = await fetchSubscription(url);
  return installFromSubscription(sub.plugins, { onProgress });
}

function uninstall(hash) {
  const rec = plugins.get(hash);
  if (!rec) return false;
  plugins.delete(hash);
  store.removeSourceCode(hash);
  persist();
  return true;
}

function setEnabled(hash, enabled) {
  const rec = plugins.get(hash);
  if (!rec) return null;
  rec.meta.enabled = !!enabled;
  persist();
  return publicMeta(rec.meta);
}

function setOrder(hash, order) {
  const rec = plugins.get(hash);
  if (!rec) return null;
  rec.meta.order = order;
  persist();
  return publicMeta(rec.meta);
}

async function update(hash) {
  const rec = plugins.get(hash);
  if (!rec) throw new Error('插件不存在');
  if (!rec.meta.srcUrl) throw new Error('该插件没有提供更新地址');
  return installFromUrl(rec.meta.srcUrl, { force: true });
}

function setUserVariables(hash, vars) {
  const rec = plugins.get(hash);
  if (!rec) return null;
  rec.meta.userVariableValues = Object.assign({}, normalizeValues(rec.meta), vars || {});
  persist();
  return publicMeta(rec.meta);
}

function getInstance(hash) {
  const rec = plugins.get(hash);
  return rec && rec.instance ? rec.instance : null;
}

function resetItem(item, platform) {
  if (!item || typeof item !== 'object') return item;
  if (platform) item.platform = platform;
  if (item.id == null && item.songmid != null) item.id = item.songmid;
  return item;
}

/* ---------------- 统一调用入口 ---------------- */

async function search(hash, query, page, type) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.search !== 'function') return { isEnd: true, data: [] };
  const res = await instance.search(query, page || 1, type || 'music');
  const data = Array.isArray(res && res.data) ? res.data : [];
  data.forEach((it) => resetItem(it, instance.platform));
  return { isEnd: res && res.isEnd === false ? false : true, data };
}

async function getMediaSource(hash, musicItem, quality) {
  const instance = getInstance(hash);
  quality = quality || 'standard';
  if (!instance) throw new Error('插件不存在或未加载');
  if (typeof instance.getMediaSource !== 'function') {
    const url = (musicItem && musicItem.url) || (musicItem && musicItem.qualities && musicItem.qualities[quality] && musicItem.qualities[quality].url);
    if (!url) throw new Error('NO_SOURCE');
    return { url, headers: {} };
  }
  const raw = (await instance.getMediaSource(resetItem(Object.assign({}, musicItem), instance.platform), quality)) || {};
  const url = raw.url || (musicItem && musicItem.url);
  if (!url) throw new Error('NO_SOURCE');
  const headers = raw.headers || {};
  return { url, headers, userAgent: headers['user-agent'] || headers['User-Agent'] || raw.userAgent };
}

async function getMusicInfo(hash, musicItem) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getMusicInfo !== 'function') return null;
  try {
    return (await instance.getMusicInfo(resetItem(Object.assign({}, musicItem), instance.platform))) || null;
  } catch (e) {
    return null;
  }
}

async function getLyric(hash, musicItem) {
  const instance = getInstance(hash);
  if (musicItem && musicItem.rawLrc) return { rawLrc: musicItem.rawLrc, translation: musicItem.translation };
  let rawLrc = '';
  let translation = '';
  let lrcUrl = (musicItem && musicItem.lrc) || '';
  if (instance && typeof instance.getLyric === 'function') {
    try {
      const src = (await instance.getLyric(resetItem(Object.assign({}, musicItem), instance.platform))) || {};
      rawLrc = src.rawLrc || '';
      translation = src.translation || '';
      lrcUrl = src.lrc || lrcUrl;
    } catch (e) {
      /* ignore */
    }
  }
  if (!rawLrc && lrcUrl) {
    try {
      rawLrc = await net.fetchText(lrcUrl, { timeout: 8000 });
    } catch (e) {
      rawLrc = '';
    }
  }
  return { rawLrc: rawLrc || '', translation: translation || '' };
}

async function getAlbumInfo(hash, albumItem, page) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getAlbumInfo !== 'function') {
    return { isEnd: true, albumItem, musicList: (albumItem && albumItem.musicList) || [] };
  }
  try {
    const res = (await instance.getAlbumInfo(resetItem(Object.assign({}, albumItem), instance.platform), page || 1)) || {};
    (res.musicList || []).forEach((it) => resetItem(it, instance.platform));
    return { isEnd: res.isEnd !== false, albumItem: res.albumItem || albumItem, musicList: res.musicList || [] };
  } catch (e) {
    return { isEnd: true, musicList: [] };
  }
}

async function getMusicSheetInfo(hash, sheetItem, page) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getMusicSheetInfo !== 'function') {
    return { isEnd: true, sheetItem, musicList: (sheetItem && sheetItem.musicList) || [] };
  }
  try {
    const res = (await instance.getMusicSheetInfo(resetItem(Object.assign({}, sheetItem), instance.platform), page || 1)) || {};
    (res.musicList || []).forEach((it) => resetItem(it, instance.platform));
    return { isEnd: res.isEnd !== false, sheetItem: res.sheetItem || sheetItem, musicList: res.musicList || [] };
  } catch (e) {
    return { isEnd: true, musicList: [] };
  }
}

async function getArtistWorks(hash, artistItem, page, type) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getArtistWorks !== 'function') return { isEnd: true, data: [] };
  try {
    const res = (await instance.getArtistWorks(resetItem(Object.assign({}, artistItem), instance.platform), page || 1, type || 'music')) || {};
    const data = Array.isArray(res.data) ? res.data : [];
    data.forEach((it) => resetItem(it, instance.platform));
    return { isEnd: res.isEnd !== false, data };
  } catch (e) {
    return { isEnd: true, data: [] };
  }
}

async function getTopLists(hash) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getTopLists !== 'function') return [];
  try {
    const res = await instance.getTopLists();
    return Array.isArray(res) ? res : [];
  } catch (e) {
    return [];
  }
}

async function getTopListDetail(hash, topListItem, page) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getTopListDetail !== 'function') return { isEnd: true, musicList: [] };
  try {
    const res = (await instance.getTopListDetail(resetItem(Object.assign({}, topListItem), instance.platform), page || 1)) || {};
    (res.musicList || []).forEach((it) => resetItem(it, instance.platform));
    return { isEnd: res.isEnd !== false, topListItem: res.topListItem || topListItem, musicList: res.musicList || [] };
  } catch (e) {
    return { isEnd: true, musicList: [] };
  }
}

async function getRecommendSheetTags(hash) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getRecommendSheetTags !== 'function') return { data: [] };
  try {
    return (await instance.getRecommendSheetTags()) || { data: [] };
  } catch (e) {
    return { data: [] };
  }
}

async function getRecommendSheetsByTag(hash, tag, page) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getRecommendSheetsByTag !== 'function') return { isEnd: true, data: [] };
  try {
    const res = (await instance.getRecommendSheetsByTag(tag, page || 1)) || {};
    (res.data || []).forEach((it) => resetItem(it, instance.platform));
    return { isEnd: res.isEnd !== false, data: res.data || [] };
  } catch (e) {
    return { isEnd: true, data: [] };
  }
}

async function importMusicItem(hash, urlLike) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.importMusicItem !== 'function') return null;
  try {
    const res = await instance.importMusicItem(urlLike);
    return res ? resetItem(res, instance.platform) : null;
  } catch (e) {
    return null;
  }
}

async function importMusicSheet(hash, urlLike) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.importMusicSheet !== 'function') return [];
  try {
    const res = (await instance.importMusicSheet(urlLike)) || [];
    res.forEach((it) => resetItem(it, instance.platform));
    return res;
  } catch (e) {
    return [];
  }
}

async function getMusicComments(hash, musicItem, page) {
  const instance = getInstance(hash);
  if (!instance || typeof instance.getMusicComments !== 'function') return { isEnd: true, data: [] };
  try {
    return (await instance.getMusicComments(musicItem, page || 1)) || { isEnd: true, data: [] };
  } catch (e) {
    return { isEnd: true, data: [] };
  }
}

module.exports = {
  loadFromDisk,
  list,
  installFromCode,
  installFromUrl,
  installFromJsonUrl,
  fetchSubscription,
  installFromSubscription,
  uninstall,
  setEnabled,
  setOrder,
  update,
  setUserVariables,
  search,
  getMediaSource,
  getMusicInfo,
  getLyric,
  getAlbumInfo,
  getMusicSheetInfo,
  getArtistWorks,
  getTopLists,
  getTopListDetail,
  getRecommendSheetTags,
  getRecommendSheetsByTag,
  importMusicItem,
  importMusicSheet,
  getMusicComments,
  compareVersion,
};

