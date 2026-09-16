/**
 * 基于 IndexedDB + 内存缓存的 PouchDB 规范数据库兼容层
 * 完美支持 memo-quick-paste 的同步与异步数据/附件操作
 */

const DB_NAME = "ruck_memo_quick_paste_db";
const DB_VERSION = 1;
const STORE_DOCS = "docs";
const STORE_ATTACHMENTS = "attachments";

// 内存高速缓存，用于即时同步读取 (如 getAttachment / get)
const docsMap = new Map();
const attachmentsMap = new Map();

let dbInstance = null;
let initPromise = null;

// 冷启动 0 毫秒同步持久化恢复层 (localStorage 双轨机制)
function loadFromLocalStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("ruck_memo_docs");
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const doc of list) {
            if (doc && doc._id) {
              docsMap.set(doc._id, doc);
            }
          }
          console.log(`[MemoDB] Synced ${docsMap.size} docs from localStorage on boot.`);
        }
      }
    }
  } catch (err) {
    console.error("[MemoDB] loadFromLocalStorage failed:", err);
  }
}

function syncToLocalStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const all = Array.from(docsMap.values());
      localStorage.setItem("ruck_memo_docs", JSON.stringify(all));
    }
  } catch (err) {
    console.error("[MemoDB] syncToLocalStorage failed:", err);
  }
}

// 模块加载瞬间同步恢复
loadFromLocalStorage();

function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      console.warn("[MemoDB] indexedDB is not supported in current environment");
      return resolve(null);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        db.createObjectStore(STORE_ATTACHMENTS, { keyPath: "id" });
      }
    };
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      console.error("[MemoDB] Failed to open IndexedDB:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * 初始化并预加载所有数据至内存
 */
export function initDatabase() {
  if (!initPromise) {
    const loader = (async () => {
      try {
        dbInstance = await openIDB();
        if (!dbInstance) return;

        // 加载所有文档
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

        // 加载所有附件
        await new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_ATTACHMENTS, "readonly");
          const store = tx.objectStore(STORE_ATTACHMENTS);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            for (const item of list) {
              attachmentsMap.set(item.id, item.data);
            }
            resolve();
          };
          req.onerror = () => resolve();
        });

        console.log(`[MemoDB] Preloaded ${docsMap.size} docs and ${attachmentsMap.size} attachments.`);
      } catch (err) {
        console.error("[MemoDB] Init error:", err);
      }
    })();

    // 200ms 超时保底，防止由于事务锁卡死阻塞前端渲染（内存已由 localStorage 优先恢复）
    initPromise = Promise.race([
      loader,
      new Promise((resolve) => setTimeout(resolve, 200))
    ]);
  }
  return initPromise;
}

// 自动在模块加载时启动初始化
if (typeof window !== "undefined") {
  initDatabase();
}

function persistDoc(doc) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).put(doc);
  } catch (err) {
    console.error("[MemoDB] persistDoc failed:", err);
  }
}

function removePersistDoc(id) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
    tx.objectStore(STORE_DOCS).delete(id);
  } catch (err) {
    console.error("[MemoDB] removePersistDoc failed:", err);
  }
}

function persistAttachment(id, data, contentType) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_ATTACHMENTS, "readwrite");
    tx.objectStore(STORE_ATTACHMENTS).put({ id, data, contentType });
  } catch (err) {
    console.error("[MemoDB] persistAttachment failed:", err);
  }
}

function removePersistAttachment(id) {
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(STORE_ATTACHMENTS, "readwrite");
    tx.objectStore(STORE_ATTACHMENTS).delete(id);
  } catch (err) {
    console.error("[MemoDB] removePersistAttachment failed:", err);
  }
}

function generateRev() {
  return "1-" + Math.random().toString(36).substring(2, 12);
}

export const db = {
  get(id) {
    if (!id) return null;
    const doc = docsMap.get(id);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },

  put(doc) {
    if (!doc || typeof doc !== "object") {
      return { error: true, message: "Invalid document" };
    }
    if (!doc._id) {
      doc._id = "collect/" + Date.now();
    }
    doc._rev = generateRev();
    const cloned = JSON.parse(JSON.stringify(doc));
    docsMap.set(doc._id, cloned);
    syncToLocalStorage();
    persistDoc(cloned);
    return { id: doc._id, ok: true, rev: doc._rev };
  },

  remove(docOrId) {
    const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
    if (!id) return { error: true, message: "Missing id" };
    const existed = docsMap.get(id);
    docsMap.delete(id);
    syncToLocalStorage();
    removePersistDoc(id);
    return { id, ok: true, rev: existed?._rev || generateRev() };
  },

  allDocs(prefix) {
    const all = Array.from(docsMap.values()).map((d) => JSON.parse(JSON.stringify(d)));
    if (typeof prefix === "string" && prefix.length > 0) {
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

  getAttachment(docId) {
    if (!docId) return null;
    const data = attachmentsMap.get(docId);
    if (!data) return null;
    if (data instanceof Uint8Array) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    return data;
  },

  postAttachment(docId, data, contentType = "image/png") {
    if (!docId) return { error: true, message: "Missing docId" };
    let bufferData = data;
    if (data instanceof ArrayBuffer) {
      bufferData = new Uint8Array(data);
    }
    attachmentsMap.set(docId, bufferData);
    persistAttachment(docId, bufferData, contentType);
    return { ok: true, id: docId, rev: generateRev() };
  },

  removeAttachment(docId) {
    if (!docId) return { error: true, message: "Missing docId" };
    attachmentsMap.delete(docId);
    removePersistAttachment(docId);
    return { ok: true, id: docId, rev: generateRev() };
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
    async getAttachment(docId) {
      await initDatabase();
      return db.getAttachment(docId);
    },
    async postAttachment(docId, data, contentType) {
      await initDatabase();
      return db.postAttachment(docId, data, contentType);
    },
    async removeAttachment(docId) {
      await initDatabase();
      return db.removeAttachment(docId);
    },
  },
};
