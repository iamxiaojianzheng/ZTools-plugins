/**
 * MusicFree 内置包的 polyfill
 *  - musicfree/storage      -> 基于本地文件的持久化存储
 *  - @react-native-cookies/cookies -> 内存 Cookie Jar（ZTools preload 无法直接访问 Electron session）
 */
const store = require('./store');

/* ---------------- musicfree/storage ---------------- */

const STORAGE_PREFIX = 'pluginstorage:';

function pluginStorageSetItem(key, value) {
  try {
    store.storageSet(STORAGE_PREFIX + key, typeof value === 'string' ? value : String(value == null ? '' : value));
  } catch (e) {
    /* ignore */
  }
}

function pluginStorageGetItem(key) {
  return store.storageGet(STORAGE_PREFIX + key);
}

function pluginStorageRemoveItem(key) {
  store.storageRemove(STORAGE_PREFIX + key);
}

const pluginStorage = {
  setItem: pluginStorageSetItem,
  getItem: pluginStorageGetItem,
  removeItem: pluginStorageRemoveItem,
};

/* ---------------- @react-native-cookies/cookies ---------------- */

const COOKIE_KEY = 'cookies:jar';

function loadJar() {
  const jar = store.storageGet(COOKIE_KEY);
  return jar && typeof jar === 'object' ? jar : {};
}

function saveJar(jar) {
  store.storageSet(COOKIE_KEY, jar);
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return null;
  }
}

const reactNativeCookies = {
  async set(url, cookie) {
    try {
      const host = hostOf(url);
      if (!host || !cookie || !cookie.name) return false;
      const jar = loadJar();
      jar[host] = jar[host] || {};
      jar[host][cookie.name] = Object.assign({}, cookie, { domain: cookie.domain || host });
      saveJar(jar);
      return true;
    } catch (e) {
      return false;
    }
  },
  async get(url) {
    try {
      const host = hostOf(url);
      const jar = loadJar();
      if (!host) return jar;
      // 合并父域 cookie
      const result = {};
      Object.keys(jar).forEach((domain) => {
        if (host === domain || host.endsWith('.' + domain)) {
          Object.assign(result, jar[domain]);
        }
      });
      return result;
    } catch (e) {
      return {};
    }
  },
  async clearAll() {
    saveJar({});
    return true;
  },
  async flush() {
    return true;
  },
};

module.exports = { pluginStorage, reactNativeCookies };
