/**
 * 基于 IndexedDB + localStorage + 内存高速缓存的双轨持久化数据库
 * 遵循 uTools / ZTools db 规范，为 color-helper 提供同步与异步无感存储支持
 */

const DB_NAME = "ruck_color_helper_db";
const DB_VERSION = 1;
const STORE_DOCS = "docs";
const STORAGE_PREFIX = "color_helper_db_";

// 内存高速缓存 (保证 0ms 同步读取)
const docsMap = new Map();

let dbInstance = null;
let initPromise = null;

// 冷启动 0ms 恢复
function loadFromLocalStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const id = key.slice(STORAGE_PREFIX.length);
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const doc = JSON.parse(val);
            if (doc && doc._id) {
              docsMap.set(doc._id, doc);
            } else if (doc) {
              docsMap.set(id, { ...doc, _id: id });
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error("[ColorHelperDB] loadFromLocalStorage failed:", err);
  }
}

// 模块加载瞬间同步恢复
loadFromLocalStorage();

function syncDocToLocalStorage(doc) {
  try {
    if (typeof localStorage === "undefined") return;
    if (doc && doc._id) {
      localStorage.setItem(`${STORAGE_PREFIX}${doc._id}`, JSON.stringify(doc));
    }
  } catch (err) {
    console.error("[ColorHelperDB] syncDocToLocalStorage failed:", err);
  }
}

function removeDocFromLocalStorage(id) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch (err) {
    console.error("[ColorHelperDB] removeDocFromLocalStorage failed:", err);
  }
}

function openIDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      return resolve(null);
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(STORE_DOCS)) {
          idb.createObjectStore(STORE_DOCS, { keyPath: "_id" });
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => {
        console.warn("[ColorHelperDB] Failed to open IndexedDB:", event.target.error);
        resolve(null);
      };
    } catch (e) {
      console.warn("[ColorHelperDB] openIDB exception:", e);
      resolve(null);
    }
  });
}

export function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        dbInstance = await openIDB();
        if (!dbInstance) return;

        // 从 IndexedDB 同步增量恢复到内存 Map
        await new Promise((resolve) => {
          try {
            const tx = dbInstance.transaction(STORE_DOCS, "readonly");
            const store = tx.objectStore(STORE_DOCS);
            const req = store.getAll();
            req.onsuccess = () => {
              const list = req.result || [];
              for (const doc of list) {
                if (doc && doc._id && !docsMap.has(doc._id)) {
                  docsMap.set(doc._id, doc);
                  syncDocToLocalStorage(doc);
                }
              }
              resolve();
            };
            req.onerror = () => resolve();
          } catch (e) {
            resolve();
          }
        });
      } catch (e) {
        console.warn("[ColorHelperDB] initDatabase error:", e);
      }
    })();
  }
  return initPromise;
}

// 异步持久化至 IndexedDB
async function persistDocToIDB(doc) {
  try {
    if (!dbInstance) await initDatabase();
    if (!dbInstance) return;
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).put(doc);
  } catch (e) {}
}

async function removeDocFromIDB(id) {
  try {
    if (!dbInstance) await initDatabase();
    if (!dbInstance) return;
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).delete(id);
  } catch (e) {}
}

export const db = {
  get(id) {
    if (!id) return null;
    const doc = docsMap.get(id);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },

  put(doc) {
    if (!doc || !doc._id) {
      return { ok: false, error: "Missing _id" };
    }
    const id = doc._id;
    const existing = docsMap.get(id);
    const rev = existing?._rev ? String(parseInt(existing._rev, 10) + 1) : "1";
    const toSave = { ...doc, _rev: rev };

    // 同步写内存与 localStorage
    docsMap.set(id, toSave);
    syncDocToLocalStorage(toSave);

    // 异步双写 IDB
    persistDocToIDB(toSave);

    return { ok: true, id, rev };
  },

  remove(docOrId) {
    const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
    if (!id) return { ok: false, error: "Missing _id" };

    docsMap.delete(id);
    removeDocFromLocalStorage(id);
    removeDocFromIDB(id);

    return { ok: true, id };
  },

  allDocs(key) {
    const results = [];
    for (const [id, doc] of docsMap.entries()) {
      if (!key || id.startsWith(key)) {
        results.push(JSON.parse(JSON.stringify(doc)));
      }
    }
    return results;
  },

  promises: {
    async get(id) {
      return db.get(id);
    },
    async put(doc) {
      return db.put(doc);
    },
    async remove(docOrId) {
      return db.remove(docOrId);
    },
    async allDocs(key) {
      return db.allDocs(key);
    }
  }
};
