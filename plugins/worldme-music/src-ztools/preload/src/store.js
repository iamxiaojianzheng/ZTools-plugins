/**
 * 数据存储层
 *
 * 使用 ZTools 提供的数据库存储（window.ztools.dbStorage），以便接入官方数据同步。
 * 当不在 ZTools 宿主环境（开发预览 / 单元测试）时，自动退化为 localStorage / 内存，
 * 不再写任何本地文件。
 *
 * 数据命名空间统一使用前缀 `worldme:`：
 *   worldme:sources             音源元数据（数组）
 *   worldme:source:<hash>       单个音源代码（js 文本）
 *   worldme:data                播放器数据（设置 / 播放列表 / 收藏 / 历史）
 */

const PREFIX = 'worldme:';

function ztools() {
  try {
    return (typeof window !== 'undefined' && window.ztools) || null;
  } catch (e) {
    return null;
  }
}

function dbStorage() {
  const z = ztools();
  if (z && z.dbStorage && typeof z.dbStorage.getItem === 'function' && typeof z.dbStorage.setItem === 'function') {
    return z.dbStorage;
  }
  return null;
}

const memory = new Map();

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (e) {
    return false;
  }
}

function rawGet(key) {
  const db = dbStorage();
  if (db) {
    try {
      const v = db.getItem(PREFIX + key);
      if (v != null) return v;
    } catch (e) {
      /* fallthrough */
    }
  }
  if (hasLocalStorage()) {
    try {
      const s = localStorage.getItem(PREFIX + key);
      if (s != null) return JSON.parse(s);
    } catch (e) {
      /* fallthrough */
    }
  }
  return memory.has(key) ? memory.get(key) : null;
}

function rawSet(key, value) {
  const db = dbStorage();
  if (db) {
    try {
      db.setItem(PREFIX + key, value);
      return true;
    } catch (e) {
      /* fallthrough */
    }
  }
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      /* fallthrough */
    }
  }
  memory.set(key, value);
  return true;
}

function rawRemove(key) {
  const db = dbStorage();
  if (db) {
    try {
      db.removeItem(PREFIX + key);
    } catch (e) {
      /* ignore */
    }
  }
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* ignore */
    }
  }
  memory.delete(key);
  return true;
}

/** 当前实际使用的存储类型：'ztools' 表示 ZTools 数据库 */
function kind() {
  return dbStorage() ? 'ztools' : hasLocalStorage() ? 'local' : 'memory';
}

/* ---------------- 音源代码 ---------------- */

function readSourceCode(hash) {
  const v = rawGet('source:' + hash);
  return typeof v === 'string' ? v : null;
}

function writeSourceCode(hash, code) {
  rawSet('source:' + hash, code);
  return true;
}

function removeSourceCode(hash) {
  rawRemove('source:' + hash);
}

/* ---------------- 音源元数据 ---------------- */

function readSourcesMeta() {
  const list = rawGet('sources');
  return Array.isArray(list) ? list : [];
}

function writeSourcesMeta(list) {
  rawSet('sources', Array.isArray(list) ? list : []);
  return list;
}

/* ---------------- 播放器数据 ---------------- */

function readData() {
  const d = rawGet('data');
  return d && typeof d === 'object' ? d : {};
}

function writeData(data) {
  rawSet('data', data && typeof data === 'object' ? data : {});
  return readData();
}

function storageGet(key) {
  const data = readData();
  return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
}

function storageSet(key, value) {
  const data = Object.assign({}, readData());
  data[key] = value;
  writeData(data);
  return true;
}

function storageRemove(key) {
  const data = Object.assign({}, readData());
  delete data[key];
  writeData(data);
  return true;
}

function storageAll() {
  return readData();
}

module.exports = {
  kind,
  readSourceCode,
  writeSourceCode,
  removeSourceCode,
  readSourcesMeta,
  writeSourcesMeta,
  readData,
  writeData,
  storageGet,
  storageSet,
  storageRemove,
  storageAll,
};
