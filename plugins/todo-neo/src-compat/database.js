/**
 * Todo-Neo 基于 Ruck 原生 SQLite (ruck.db -> plugin_storage) 的单真理源数据库垫片
 * 契约对齐：PouchDB 契约 (allDocs, get, put, remove) 与 dbStorage 契约 (getItem, setItem, removeItem)
 * 架构特性：
 * 1. 0ms 内存高速层：内存维护 docsMap 与 storageMap，满足 Vue 3 前端同步 0ms 读取需求；
 * 2. 宿主原生落盘：依托 window.ruck.storage (all, get, set, delete) 直接落盘 SQLite 数据库；
 * 3. 细粒度单行存储：每条任务与分组在 plugin_storage 表中作为独立原子行存在，方便审计与查看；
 * 4. 存量平滑迁移：首次启动自动检测并导入历史 localStorage 中的待办与分组数据。
 */

const CONFIG_PREFIX = "config:";
const LEGACY_STORAGE_DOCS_KEY = "ruck_todo_neo_docs";
const LEGACY_STORAGE_PREFIX = "ruck_todo_neo_storage_";

// 内存主缓存（保障 0ms 同步读取）
const docsMap = new Map();
const storageMap = new Map();
// 本地正在写入保护池 (id -> timestamp)，防止正在进行的写入被前序异步查询冲掉
const pendingWrites = new Map();
const PENDING_WINDOW_MS = 3000;

let initPromise = null;
const changeListeners = new Set();

function getRuckStorage() {
  if (typeof window !== "undefined" && window.ruck?.storage) {
    return window.ruck.storage;
  }
  return null;
}

/**
 * 清理过期的 pendingWrites
 */
function cleanupPendingWrites() {
  const now = Date.now();
  for (const [id, ts] of pendingWrites.entries()) {
    if (now - ts > PENDING_WINDOW_MS) {
      pendingWrites.delete(id);
    }
  }
}

/**
 * 监听数据变更回调
 */
export function onDataChange(callback) {
  if (typeof callback !== "function") return () => {};
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}

function notifyDataChange(action, doc) {
  for (const listener of changeListeners) {
    try {
      listener(action, doc);
    } catch (e) {
      console.error("[TodoNeoDB] Error in onDataChange listener:", e);
    }
  }
}

/**
 * 存量数据平滑迁移（从 localStorage 自动导入 ruck.db）
 */
function migrateFromLegacyStorage(storage) {
  try {
    if (typeof localStorage === "undefined") return;

    // 1. 迁移文档集合
    const legacyDocsRaw = localStorage.getItem(LEGACY_STORAGE_DOCS_KEY);
    if (legacyDocsRaw) {
      const list = JSON.parse(legacyDocsRaw);
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[TodoNeoDB] Migrating ${list.length} legacy docs to ruck.db...`);
        for (const doc of list) {
          if (doc && doc._id) {
            docsMap.set(doc._id, doc);
            if (storage?.set) {
              storage.set(doc._id, doc).catch(() => {});
            }
          }
        }
      }
    }

    // 2. 迁移 dbStorage 配置
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_STORAGE_PREFIX)) {
        const subKey = k.slice(LEGACY_STORAGE_PREFIX.length);
        const valRaw = localStorage.getItem(k);
        if (valRaw !== null) {
          try {
            const parsed = JSON.parse(valRaw);
            storageMap.set(subKey, parsed);
            if (storage?.set) {
              storage.set(`${CONFIG_PREFIX}${subKey}`, parsed).catch(() => {});
            }
          } catch {
            storageMap.set(subKey, valRaw);
            if (storage?.set) {
              storage.set(`${CONFIG_PREFIX}${subKey}`, valRaw).catch(() => {});
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[TodoNeoDB] migrateFromLegacyStorage failed:", err);
  }
}

/**
 * 从 Ruck 原生 SQLite (ruck.db) 初始化/全量重载数据
 * @param {boolean} forceRefresh 是否强制重新从数据库拉取
 */
export async function initDatabase(forceRefresh = false) {
  if (initPromise && !forceRefresh) return initPromise;

  initPromise = (async () => {
    const storage = getRuckStorage();
    if (!storage) {
      migrateFromLegacyStorage(null);
      return docsMap.size;
    }

    try {
      cleanupPendingWrites();

      if (typeof storage.all === "function") {
        const allRecords = await storage.all();
        if (Array.isArray(allRecords) && allRecords.length > 0) {
          const remoteKeys = new Set();

          for (const item of allRecords) {
            if (!item || !item.key) continue;
            remoteKeys.add(item.key);

            if (item.key.startsWith(CONFIG_PREFIX)) {
              const cfgKey = item.key.slice(CONFIG_PREFIX.length);
              storageMap.set(cfgKey, item.value);
            } else {
              // 乐观保护：若本地刚刚写入此条目，绝对不被尚未同步到旧记录覆盖
              if (pendingWrites.has(item.key)) {
                continue;
              }
              const doc = item.value && item.value._id ? item.value : { ...item.value, _id: item.key };
              docsMap.set(item.key, doc);
            }
          }

          // 保护性移除：仅清除既不在数据库中、又不在本地活跃写入保护池中的孤儿条目
          for (const localId of Array.from(docsMap.keys())) {
            if (!remoteKeys.has(localId) && !pendingWrites.has(localId)) {
              docsMap.delete(localId);
            }
          }

          console.log(`[TodoNeoDB] Synced ${docsMap.size} docs and ${storageMap.size} configs from ruck.db`);
        } else {
          // 若 ruck.db 中无数据，执行自动迁移
          migrateFromLegacyStorage(storage);
        }
      } else {
        migrateFromLegacyStorage(storage);
      }
    } catch (err) {
      console.error("[TodoNeoDB] initDatabase failed:", err);
      migrateFromLegacyStorage(storage);
    }
    return docsMap.size;
  })();

  return initPromise;
}

/**
 * 刷新重载接口 (返回 Promise 以便调用方精准等待)
 */
export function reloadFromStorage() {
  return initDatabase(true).then((size) => {
    notifyDataChange("reload", null);
    return size;
  });
}

// 模块加载瞬间立即启动后台初始化装载
if (typeof window !== "undefined") {
  initDatabase();
}

/**
 * PouchDB 契约兼容对象
 */
export const db = {
  allDocs(keyOrPrefix) {
    const results = [];
    const prefix = typeof keyOrPrefix === "string" ? keyOrPrefix : "";

    for (const [id, doc] of docsMap.entries()) {
      if (prefix ? id.startsWith(prefix) : true) {
        results.push(JSON.parse(JSON.stringify(doc)));
      }
    }
    return results;
  },

  get(id) {
    if (!id || !docsMap.has(id)) return null;
    return JSON.parse(JSON.stringify(docsMap.get(id)));
  },

  put(doc) {
    if (!doc || !doc._id) {
      return { ok: false, message: "Missing _id" };
    }
    const current = docsMap.get(doc._id);
    const rev = (current?._rev ? parseInt(current._rev, 10) + 1 : 1) + "-" + Date.now().toString(36);
    const newDoc = {
      ...JSON.parse(JSON.stringify(doc)),
      _rev: rev
    };

    // 写入内存并打上保护标记，防止前序拉取任务将刚写入的新任务覆盖抹除
    docsMap.set(doc._id, newDoc);
    pendingWrites.set(doc._id, Date.now());

    // 异步直存 Ruck 原生 SQLite ruck.db
    const storage = getRuckStorage();
    if (storage?.set) {
      storage.set(doc._id, newDoc).catch((err) => {
        console.error(`[TodoNeoDB] Failed to persist ${doc._id} to ruck.db:`, err);
      });
    }

    notifyDataChange("put", newDoc);
    return { ok: true, id: newDoc._id, rev: newDoc._rev };
  },

  remove(docOrId) {
    const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
    if (!id || !docsMap.has(id)) {
      return { ok: false, message: "Doc not found" };
    }

    docsMap.delete(id);
    pendingWrites.delete(id);

    // 异步直删 Ruck 原生 SQLite ruck.db
    const storage = getRuckStorage();
    if (storage?.delete) {
      storage.delete(id).catch((err) => {
        console.error(`[TodoNeoDB] Failed to delete ${id} from ruck.db:`, err);
      });
    } else if (storage?.remove) {
      storage.remove(id).catch((err) => {
        console.error(`[TodoNeoDB] Failed to delete ${id} from ruck.db:`, err);
      });
    }

    notifyDataChange("remove", { _id: id });
    return { ok: true, id };
  },

  promises: {
    async allDocs(keyOrPrefix) {
      await initDatabase();
      return db.allDocs(keyOrPrefix);
    },
    async get(id) {
      await initDatabase();
      return db.get(id);
    },
    async put(doc) {
      await initDatabase();
      return db.put(doc);
    },
    async remove(docOrId) {
      await initDatabase();
      return db.remove(docOrId);
    }
  }
};

/**
 * dbStorage 契约兼容对象
 */
export const dbStorage = {
  getItem(key) {
    try {
      if (storageMap.has(key)) {
        return JSON.parse(JSON.stringify(storageMap.get(key)));
      }
      // 0ms 本地 localStorage 兜底
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${key}`) ?? localStorage.getItem(key);
        if (raw !== null) {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        }
      }
      return null;
    } catch (err) {
      console.error("[TodoNeoDB] dbStorage.getItem failed:", err);
      return null;
    }
  },

  setItem(key, value) {
    try {
      storageMap.set(key, value);

      // 异步直存 Ruck 原生 SQLite
      const storage = getRuckStorage();
      if (storage?.set) {
        storage.set(`${CONFIG_PREFIX}${key}`, value).catch((err) => {
          console.error(`[TodoNeoDB] Failed to persist config ${key} to ruck.db:`, err);
        });
      }

      // 同步写入 localStorage 作为快速只读缓存
      if (typeof localStorage !== "undefined") {
        const serialized = JSON.stringify(value);
        localStorage.setItem(`${LEGACY_STORAGE_PREFIX}${key}`, serialized);
      }
    } catch (err) {
      console.error("[TodoNeoDB] dbStorage.setItem failed:", err);
    }
  },

  removeItem(key) {
    try {
      storageMap.delete(key);

      const storage = getRuckStorage();
      if (storage?.delete) {
        storage.delete(`${CONFIG_PREFIX}${key}`).catch(() => {});
      } else if (storage?.remove) {
        storage.remove(`${CONFIG_PREFIX}${key}`).catch(() => {});
      }

      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${key}`);
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.error("[TodoNeoDB] dbStorage.removeItem failed:", err);
    }
  }
};
