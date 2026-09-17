/**
 * Todo-Neo 双轨数据库与 dbStorage 兼容层
 * 支持 PouchDB 契约 (allDocs, get, put, remove) 与 dbStorage 契约 (getItem, setItem, removeItem)
 * 采用【内存 Map + localStorage 0ms 同步恢复/实时双写落盘 + IndexedDB 异步落盘】架构
 */

const DB_NAME = "ruck_todo_neo_db";
const DB_VERSION = 1;
const STORE_DOCS = "docs";
const LOCAL_STORAGE_KEY = "ruck_todo_neo_docs";
const STORAGE_PREFIX = "ruck_todo_neo_storage_";

// 内存主缓存（保障 0ms 同步读取）
const docsMap = new Map();
let dbInstance = null;
let initPromise = null;

// 1. 冷启动 0ms 同步持久化恢复与原子全量重载 (localStorage 双轨机制)
export function reloadFromStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          docsMap.clear();
          for (const doc of list) {
            if (doc && doc._id) {
              docsMap.set(doc._id, doc);
            }
          }
          return docsMap.size;
        }
      }
    }
  } catch (err) {
    console.error("[TodoNeoDB] reloadFromStorage failed:", err);
  }
  return docsMap.size;
}

// 同步落盘至 localStorage
function syncToLocalStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const all = Array.from(docsMap.values());
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.error("[TodoNeoDB] syncToLocalStorage failed:", err);
  }
}

// 模块载入时立即同步恢复
reloadFromStorage();

// 2. IndexedDB 异步持久化层
function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return resolve(null);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: "_id" });
      }
    };
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      console.error("[TodoNeoDB] Failed to open IndexedDB:", event.target.error);
      reject(event.target.error);
    };
  });
}

export function initDatabase() {
  if (!initPromise) {
    const loader = (async () => {
      try {
        dbInstance = await openIDB();
        if (!dbInstance) return;

        await new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_DOCS, "readonly");
          const store = tx.objectStore(STORE_DOCS);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            for (const doc of list) {
              docsMap.set(doc._id, doc);
            }
            resolve();
          };
          req.onerror = () => resolve();
        });
      } catch (err) {
        console.error("[TodoNeoDB] IndexedDB init error:", err);
      }
    })();

    const safeTimeout = typeof window !== "undefined" && window.setTimeout ? window.setTimeout : (typeof setTimeout !== "undefined" ? setTimeout : (fn) => fn());
    initPromise = Promise.race([
      loader,
      new Promise((res) => safeTimeout(res, 200))
    ]);
  }
  return initPromise;
}

// 异步落盘至 IndexedDB
async function persistDocToIDB(doc) {
  try {
    await initDatabase();
    if (!dbInstance) return;
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    const store = tx.objectStore(STORE_DOCS);
    store.put(doc);
  } catch (err) {
    console.error("[TodoNeoDB] persistDocToIDB error:", err);
  }
}

async function removeDocFromIDB(id) {
  try {
    await initDatabase();
    if (!dbInstance) return;
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    const store = tx.objectStore(STORE_DOCS);
    store.delete(id);
  } catch (err) {
    console.error("[TodoNeoDB] removeDocFromIDB error:", err);
  }
}

const changeListeners = new Set();

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

// 监听跨标签/跨上下文 storage 事件
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", (event) => {
    if (event.key === LOCAL_STORAGE_KEY) {
      console.log("[TodoNeoDB] storage event detected for docs, reloading...");
      reloadFromStorage();
      notifyDataChange("storage", null);
    }
  });
}

// 3. PouchDB 兼容层对象
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

    docsMap.set(doc._id, newDoc);
    syncToLocalStorage();
    persistDocToIDB(newDoc);
    notifyDataChange("put", newDoc);

    return { ok: true, id: newDoc._id, rev: newDoc._rev };
  },

  remove(docOrId) {
    const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
    if (!id || !docsMap.has(id)) {
      return { ok: false, message: "Doc not found" };
    }

    docsMap.delete(id);
    syncToLocalStorage();
    removeDocFromIDB(id);
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

// 4. dbStorage 兼容层
export const dbStorage = {
  getItem(key) {
    try {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      const val = localStorage.getItem(fullKey);
      if (val === null) {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    } catch (err) {
      console.error("[TodoNeo] dbStorage.getItem failed:", err);
      return null;
    }
  },

  setItem(key, value) {
    try {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      const serialized = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
      localStorage.setItem(fullKey, serialized);
      localStorage.setItem(key, serialized);
    } catch (err) {
      console.error("[TodoNeo] dbStorage.setItem failed:", err);
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      localStorage.removeItem(key);
    } catch (err) {
      console.error("[TodoNeo] dbStorage.removeItem failed:", err);
    }
  }
};
