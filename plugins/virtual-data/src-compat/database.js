/**
 * src-compat/database.js
 * 基于内存 Map + localStorage 同步双轨 + IndexedDB 异步落盘的持久化模块
 * 严格对齐 ztools.db 与 ztools.db.promises 规范
 */

const DB_NAME = 'ruck_virtual_data_db';
const DB_VERSION = 1;
const STORE_DOCS = 'docs';
const STORAGE_KEY = 'ruck_virtual_data_docs';

// 运行时内存高速缓存，保障 0ms 同步读取
const docsMap = new Map();
let dbInstance = null;
let initPromise = null;

/**
 * 0ms 冷启动：模块加载时立即从 localStorage 恢复数据至内存
 */
function loadFromLocalStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const doc of list) {
            if (doc && doc._id) {
              docsMap.set(doc._id, doc);
            }
          }
          console.log(`[VirtualDataDB] 启动时从 localStorage 同步恢复了 ${docsMap.size} 条记录`);
        }
      }
    }
  } catch (err) {
    console.error('[VirtualDataDB] loadFromLocalStorage 失败:', err);
  }
}

/**
 * 同步将内存缓存双写至 localStorage
 */
function syncToLocalStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const all = Array.from(docsMap.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.error('[VirtualDataDB] syncToLocalStorage 失败:', err);
  }
}

// 模块初始化瞬间执行同步恢复
loadFromLocalStorage();

/**
 * 打开 IndexedDB
 */
function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: '_id' });
      }
    };
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      console.warn('[VirtualDataDB] 打开 IndexedDB 异常:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * 初始化底层 IndexedDB 并进行双向对齐
 */
export function initDatabase() {
  if (!initPromise) {
    const loader = (async () => {
      try {
        dbInstance = await openIDB();
        if (!dbInstance) return;

        await new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_DOCS, 'readonly');
          const store = tx.objectStore(STORE_DOCS);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            // 若 IndexedDB 中有且内存中没有，进行补齐
            for (const doc of list) {
              if (doc && doc._id && !docsMap.has(doc._id)) {
                docsMap.set(doc._id, doc);
              }
            }
            resolve();
          };
          req.onerror = () => resolve();
        });
      } catch (err) {
        console.warn('[VirtualDataDB] IndexedDB 预热异常:', err);
      }
    })();

    // 150ms 超时保底，防止由于事务阻塞导致界面挂起（此时内存已由 localStorage 优先恢复）
    initPromise = Promise.race([
      loader,
      new Promise((resolve) => setTimeout(resolve, 150)),
    ]);
  }
  return initPromise;
}

// 立即尝试启动异步底座连接
if (typeof window !== 'undefined') {
  initDatabase();
}

function persistDoc(doc) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_DOCS, 'readwrite');
    tx.objectStore(STORE_DOCS).put(doc);
  } catch (err) {
    console.warn('[VirtualDataDB] persistDoc 失败:', err);
  }
}

function removePersistDoc(id) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_DOCS, 'readwrite');
    tx.objectStore(STORE_DOCS).delete(id);
  } catch (err) {
    console.warn('[VirtualDataDB] removePersistDoc 失败:', err);
  }
}

function generateRev() {
  return '1-' + Math.random().toString(36).substring(2, 12);
}

/**
 * PouchDB 契约核心实现
 */
export const db = {
  get(id) {
    if (!id) return null;
    const doc = docsMap.get(id);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },

  put(doc) {
    if (!doc || typeof doc !== 'object') {
      return { error: true, message: 'Invalid document' };
    }
    if (!doc._id) {
      doc._id = 'virtual-data-' + Date.now();
    }
    doc._rev = generateRev();
    const cloned = JSON.parse(JSON.stringify(doc));
    docsMap.set(doc._id, cloned);
    syncToLocalStorage();
    persistDoc(cloned);
    return { id: doc._id, ok: true, rev: doc._rev };
  },

  remove(docOrId) {
    const id = typeof docOrId === 'string' ? docOrId : docOrId?._id;
    if (!id) return { error: true, message: 'Missing id' };
    const existed = docsMap.get(id);
    docsMap.delete(id);
    syncToLocalStorage();
    removePersistDoc(id);
    return { id, ok: true, rev: existed?._rev || generateRev() };
  },

  allDocs(prefix) {
    const all = Array.from(docsMap.values()).map((d) => JSON.parse(JSON.stringify(d)));
    if (typeof prefix === 'string' && prefix.length > 0) {
      return all.filter((d) => d._id && d._id.startsWith(prefix));
    }
    return all;
  },

  bulkDocs(docs) {
    if (!Array.isArray(docs)) return [];
    const results = [];
    for (const doc of docs) {
      if (!doc || !doc._id) continue;
      if (doc._deleted) {
        docsMap.delete(doc._id);
        removePersistDoc(doc._id);
        results.push({ id: doc._id, ok: true });
      } else {
        doc._rev = generateRev();
        const cloned = JSON.parse(JSON.stringify(doc));
        docsMap.set(doc._id, cloned);
        persistDoc(cloned);
        results.push({ id: doc._id, ok: true, rev: doc._rev });
      }
    }
    syncToLocalStorage();
    return results;
  },

  promises: {
    async allDocs(prefix) {
      await initDatabase();
      return db.allDocs(prefix);
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
    },
    async bulkDocs(docs) {
      await initDatabase();
      return db.bulkDocs(docs);
    },
  },
};
