/**
 * src-compat/database.js
 * 基于 Ruck 原生 SQLite 存储 (window.ruck.storage -> ruck.db) 的单真理源数据库垫片
 * 
 * 架构原则：
 * 1. 单真理源：持久化交互仅以 ruck.db (plugin_storage 表) 为准，不创建 IndexedDB，不使用 localStorage 冗余副本。
 * 2. 内存高速缓存：仅在内存中维持轻量 Map (docsMap)，用于满足 Vue 前端历史同步接口 z.db.get() 0ms 立即返回的需求。
 * 3. 异步直通：所有 put/remove 操作均直接落盘或清理 Ruck 原生数据库。
 */

const ACCOUNTS_KEY = "otp_accounts_v1";
const CONFIG_KEY = "otp_config_v1";

// 内存高速缓存 (仅用于保障前端 Vue 历史同步接口 z.db.get() 0ms 读取需求)
const docsMap = new Map();

let initPromise = null;

function getRuckStorage() {
  if (typeof window !== "undefined" && window.ruck?.storage) {
    return window.ruck.storage;
  }
  return null;
}

/**
 * 从 Ruck 原生 SQLite (ruck.db) 初始化/重载数据到内存 Map
 * @param {boolean} forceRefresh 是否强制重新从数据库拉取
 */
export async function initDatabase(forceRefresh = false) {
  if (initPromise && !forceRefresh) return initPromise;

  initPromise = (async () => {
    try {
      const storage = getRuckStorage();
      if (!storage) return;

      const [accountsDoc, configDoc] = await Promise.all([
        storage.get(ACCOUNTS_KEY).catch((err) => {
          console.warn(`[OTP2FADB] Failed to read ${ACCOUNTS_KEY} from ruck.db:`, err);
          return null;
        }),
        storage.get(CONFIG_KEY).catch((err) => {
          console.warn(`[OTP2FADB] Failed to read ${CONFIG_KEY} from ruck.db:`, err);
          return null;
        })
      ]);

      if (accountsDoc) {
        const doc = accountsDoc._id ? accountsDoc : { ...accountsDoc, _id: ACCOUNTS_KEY };
        docsMap.set(ACCOUNTS_KEY, doc);
      }
      if (configDoc) {
        const doc = configDoc._id ? configDoc : { ...configDoc, _id: CONFIG_KEY };
        docsMap.set(CONFIG_KEY, doc);
      }
    } catch (err) {
      console.error("[OTP2FADB] initDatabase failed:", err);
    }
  })();

  return initPromise;
}

// 导出与 uTools / ZTools 契约兼容的同步与异步数据库对象
export const db = {
  /**
   * 同步获取文档 (直接从内存缓存读取，0ms)
   */
  get(id) {
    if (!id) return null;
    const doc = docsMap.get(id);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },

  /**
   * 同步更新或新增文档 (更新内存缓存并直接异步持久化到 ruck.db)
   */
  put(doc) {
    if (!doc || !doc._id) {
      return { id: "", ok: false, error: true, message: "文档必须包含 _id 字段" };
    }

    const rev = `rev-${Date.now()}`;
    const toSave = { ...doc, _rev: rev };
    docsMap.set(doc._id, toSave);

    // 异步直存 Ruck 原生数据库 ruck.db
    const storage = getRuckStorage();
    if (storage?.set) {
      storage.set(doc._id, toSave).catch((err) => {
        console.error(`[OTP2FADB] Failed to persist ${doc._id} to ruck.db:`, err);
      });
    }

    return { id: doc._id, ok: true, rev };
  },

  /**
   * 同步删除文档 (从内存缓存移除并直接从 ruck.db 删除)
   */
  remove(docOrId) {
    const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
    if (!id) {
      return { id: "", ok: false, error: true, message: "缺少待删除文档 _id" };
    }

    docsMap.delete(id);

    // 异步从 Ruck 原生数据库 ruck.db 删除
    const storage = getRuckStorage();
    if (storage?.delete) {
      storage.delete(id).catch((err) => {
        console.error(`[OTP2FADB] Failed to delete ${id} from ruck.db:`, err);
      });
    } else if (storage?.remove) {
      storage.remove(id).catch((err) => {
        console.error(`[OTP2FADB] Failed to delete ${id} from ruck.db:`, err);
      });
    }

    return { id, ok: true };
  },

  /**
   * 同步查询指定前缀的全部文档
   */
  allDocs(keyPrefix) {
    const list = [];
    for (const [key, doc] of docsMap.entries()) {
      if (!keyPrefix || key.startsWith(keyPrefix)) {
        list.push(JSON.parse(JSON.stringify(doc)));
      }
    }
    return list;
  },

  /**
   * 批量保存
   */
  bulkDocs(docs) {
    if (!Array.isArray(docs)) return [];
    return docs.map((d) => this.put(d));
  },

  /**
   * 新增文档（自动分配 _id）
   */
  post(doc) {
    const _id = doc._id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.put({ ...doc, _id });
  },

  /**
   * 异步规范接口 (支持等待 ruck.db 完全写入或拉取)
   */
  promises: {
    async get(id) {
      await initDatabase();
      if (docsMap.has(id)) {
        return db.get(id);
      }
      const storage = getRuckStorage();
      if (storage?.get) {
        try {
          const val = await storage.get(id);
          if (val) {
            const doc = val._id ? val : { ...val, _id: id };
            docsMap.set(id, doc);
            return JSON.parse(JSON.stringify(doc));
          }
        } catch (e) {}
      }
      return null;
    },

    async put(doc) {
      await initDatabase();
      const res = db.put(doc);
      const storage = getRuckStorage();
      if (storage?.set && doc?._id) {
        await storage.set(doc._id, docsMap.get(doc._id));
      }
      return res;
    },

    async remove(docOrId) {
      await initDatabase();
      const id = typeof docOrId === "string" ? docOrId : docOrId?._id;
      const res = db.remove(docOrId);
      const storage = getRuckStorage();
      if (id) {
        if (storage?.delete) {
          await storage.delete(id);
        } else if (storage?.remove) {
          await storage.remove(id);
        }
      }
      return res;
    },

    async allDocs(keyPrefix) {
      await initDatabase();
      return db.allDocs(keyPrefix);
    },

    async bulkDocs(docs) {
      await initDatabase();
      return db.bulkDocs(docs);
    },

    async post(doc) {
      await initDatabase();
      return db.post(doc);
    }
  }
};
