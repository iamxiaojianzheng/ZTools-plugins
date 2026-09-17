/**
 * src-compat/database.js
 * Todos 待办日历基于 Ruck 原生 SQLite (ruck.db -> plugin_storage) 的持久化模块
 * 
 * 架构特性：
 * 1. 0ms 同步保障：启动时从 ruck.db 预热反序列化至 localStorage 与内存，保障 React 19 渲染不发生空白或阻塞；
 * 2. 双重条目落盘：
 *    - key = "todos-data"：完整工作空间数据，保障 0ms 整库快速还原；
 *    - key = "todo-tasks/<id>"：每个待办项作为原子行独立落盘，方便在 SQLite 中直接筛选与查询；
 *    - key = "workspace-configs"：工作空间色彩与配置；
 * 3. 存量自动迁移：首次启动自动检测并导入存量 localStorage 数据。
 */

const STORAGE_KEY = "todos-data";
const WORKSPACE_CONFIG_KEY = "workspace-configs";
const TASKS_PREFIX = "todo-tasks/";
const CONFIG_PREFIX = "config:";
const LEGACY_STORAGE_PREFIX = "ruck_todos_db_";

let initPromise = null;
let lastKnownTaskIds = new Set();
const storageMap = new Map();

// 写入保护缓冲：记录最近 2000ms 内本地修改的任务，杜绝被旧的 remote 快照冲掉
let lastLocalPersistTime = 0;
const pendingTaskWrites = new Map(); // taskId -> timestamp

function cleanupPendingWrites() {
  const now = Date.now();
  for (const [id, time] of pendingTaskWrites.entries()) {
    if (now - time > 3000) {
      pendingTaskWrites.delete(id);
    }
  }
}

function getRuckStorage() {
  if (typeof window !== "undefined" && window.ruck?.storage) {
    return window.ruck.storage;
  }
  return null;
}

/**
 * 默认空工作空间数据
 */
export function getDefaultTodosData() {
  return {
    version: "1.0.0",
    workspaces: { work: [], life: [], study: [] },
    currentWorkspace: "work"
  };
}

/**
 * 从 localStorage 读取当前数据 (0ms 同步返回)
 */
export function getTodosData() {
  try {
    if (typeof localStorage === "undefined") return getDefaultTodosData();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultTodosData();
    const parsed = JSON.parse(raw);
    if (!parsed.workspaces) parsed.workspaces = { work: [], life: [], study: [] };
    if (!parsed.currentWorkspace) parsed.currentWorkspace = "work";
    return parsed;
  } catch (e) {
    console.error("[TodosDB] Failed to parse localStorage todos-data:", e);
    return getDefaultTodosData();
  }
}

/**
 * 持久化 todos 数据至 localStorage 及 Ruck 原生 SQLite
 * @param {object} data 全量 todos-data 对象
 */
export function persistTodosData(data) {
  if (!data || typeof data !== "object") return;

  lastLocalPersistTime = Date.now();
  if (data.workspaces) {
    for (const wsKey of ["work", "life", "study"]) {
      const list = Array.isArray(data.workspaces[wsKey]) ? data.workspaces[wsKey] : [];
      for (const t of list) {
        if (t && t.id) {
          pendingTaskWrites.set(t.id, Date.now());
        }
      }
    }
  }

  // 1. 同步保存至 localStorage 保障前端 React 0ms 同步读取
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error("[TodosDB] Failed to save localStorage:", e);
  }

  // 2. 异步直存 Ruck 原生 SQLite ruck.db
  const storage = getRuckStorage();
  if (!storage) return;

  // 2.1 保存全量工作空间快照
  if (storage.set) {
    storage.set(STORAGE_KEY, data).catch((err) => {
      console.error("[TodosDB] Failed to persist todos-data to ruck.db:", err);
    });
  }

  // 2.2 拆分写入原子 task 条目，便于直接在数据库中检索
  try {
    const currentTaskIds = new Set();
    const workspaces = data.workspaces || {};

    for (const wsKey of ["work", "life", "study"]) {
      const list = Array.isArray(workspaces[wsKey]) ? workspaces[wsKey] : [];
      for (const task of list) {
        if (task && task.id) {
          currentTaskIds.add(task.id);
          const taskDoc = {
            ...task,
            _workspace: wsKey,
            _updated_at: Date.now()
          };
          if (storage.set) {
            storage.set(`${TASKS_PREFIX}${task.id}`, taskDoc).catch(() => {});
          }
        }
      }
    }

    // 物理清理已在当前数据中删除的任务条目
    for (const oldId of lastKnownTaskIds) {
      if (!currentTaskIds.has(oldId)) {
        if (storage.delete) {
          storage.delete(`${TASKS_PREFIX}${oldId}`).catch(() => {});
        } else if (storage.remove) {
          storage.remove(`${TASKS_PREFIX}${oldId}`).catch(() => {});
        }
      }
    }

    lastKnownTaskIds = currentTaskIds;
  } catch (err) {
    console.warn("[TodosDB] Failed to persist atom tasks:", err);
  }
}

/**
 * 历史存量数据平滑迁移导入 ruck.db
 */
function migrateFromLegacyStorage(storage) {
  try {
    if (typeof localStorage === "undefined") return;

    // 1. 迁移 todos-data
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.workspaces) {
        console.log("[TodosDB] Migrating legacy todos-data to ruck.db...");
        persistTodosData(parsed);
      }
    }

    // 2. 迁移 workspace-configs
    const cfgRaw = localStorage.getItem(WORKSPACE_CONFIG_KEY) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
    if (cfgRaw && storage?.set) {
      try {
        const cfgs = JSON.parse(cfgRaw);
        storage.set(WORKSPACE_CONFIG_KEY, cfgs).catch(() => {});
      } catch {
        storage.set(WORKSPACE_CONFIG_KEY, cfgRaw).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[TodosDB] migrateFromLegacyStorage failed:", err);
  }
}

/**
 * 冷启动自 ruck.db 预热至内存与 localStorage
 * @param {boolean} forceRefresh 是否强制重新从数据库拉取
 */
export async function initDatabase(forceRefresh = false) {
  if (initPromise && !forceRefresh) return initPromise;

  initPromise = (async () => {
    const storage = getRuckStorage();
    if (!storage) {
      migrateFromLegacyStorage(null);
      return;
    }

    try {
      cleanupPendingWrites();

      if (typeof storage.all === "function") {
        const records = await storage.all();
        if (Array.isArray(records) && records.length > 0) {
          let foundTodosData = false;

          for (const item of records) {
            if (!item || !item.key) continue;

            if (item.key === STORAGE_KEY) {
              foundTodosData = true;
              let data = item.value;
              if (data && typeof data === "object") {
                const now = Date.now();
                // 写入保护：若本地在 2000ms 内存在在途写入，安全合并本地任务避免被旧快照冲掉
                if (now - lastLocalPersistTime < 2000) {
                  const localData = getTodosData();
                  if (localData && localData.workspaces) {
                    if (!data.workspaces) data.workspaces = {};
                    for (const ws of ["work", "life", "study"]) {
                      const localList = localData.workspaces[ws] || [];
                      const remoteList = data.workspaces[ws] || [];
                      const mergedMap = new Map(remoteList.map((t) => [t.id, t]));
                      for (const lt of localList) {
                        if (lt && lt.id) {
                          const writeTime = pendingTaskWrites.get(lt.id);
                          if (writeTime && (now - writeTime < 2500)) {
                            mergedMap.set(lt.id, lt);
                          }
                        }
                      }
                      data.workspaces[ws] = Array.from(mergedMap.values());
                    }
                  }
                }

                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                }
                // 初始化已知 task id 集合
                if (data.workspaces) {
                  lastKnownTaskIds.clear();
                  for (const ws of ["work", "life", "study"]) {
                    const list = data.workspaces[ws] || [];
                    list.forEach((t) => t?.id && lastKnownTaskIds.add(t.id));
                  }
                }
              }
            } else if (item.key === WORKSPACE_CONFIG_KEY) {
              if (typeof localStorage !== "undefined") {
                const str = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
                localStorage.setItem(WORKSPACE_CONFIG_KEY, str);
                localStorage.setItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`, str);
              }
            } else if (item.key.startsWith(CONFIG_PREFIX)) {
              const subKey = item.key.slice(CONFIG_PREFIX.length);
              storageMap.set(subKey, item.value);
            }
          }

          if (!foundTodosData) {
            migrateFromLegacyStorage(storage);
          }
          console.log("[TodosDB] Successfully initialized data from ruck.db");
        } else {
          migrateFromLegacyStorage(storage);
        }
      } else {
        migrateFromLegacyStorage(storage);
      }
    } catch (err) {
      console.error("[TodosDB] initDatabase error:", err);
      migrateFromLegacyStorage(storage);
    }
  })();

  return initPromise;
}

// 模块载入瞬间启动初始化
if (typeof window !== "undefined") {
  initDatabase();
}

/**
 * 兼容封装 dbStorage
 */
export const dbStorage = {
  getItem(key) {
    try {
      if (key === WORKSPACE_CONFIG_KEY) {
        const raw = localStorage.getItem(WORKSPACE_CONFIG_KEY) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
        if (raw !== null) {
          try { return JSON.parse(raw); } catch { return raw; }
        }
      }

      if (storageMap.has(key)) {
        return JSON.parse(JSON.stringify(storageMap.get(key)));
      }

      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${key}`) ?? localStorage.getItem(key);
        if (raw !== null) {
          try { return JSON.parse(raw); } catch { return raw; }
        }
      }
      return null;
    } catch (err) {
      console.error("[TodosDB] dbStorage.getItem failed:", err);
      return null;
    }
  },

  setItem(key, value) {
    try {
      storageMap.set(key, value);

      const storage = getRuckStorage();
      if (key === WORKSPACE_CONFIG_KEY) {
        if (storage?.set) {
          storage.set(WORKSPACE_CONFIG_KEY, value).catch(() => {});
        }
        if (typeof localStorage !== "undefined") {
          const str = typeof value === "string" ? value : JSON.stringify(value);
          localStorage.setItem(WORKSPACE_CONFIG_KEY, str);
          localStorage.setItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`, str);
        }
      } else {
        if (storage?.set) {
          storage.set(`${CONFIG_PREFIX}${key}`, value).catch(() => {});
        }
        if (typeof localStorage !== "undefined") {
          const str = typeof value === "string" ? value : JSON.stringify(value);
          localStorage.setItem(`${LEGACY_STORAGE_PREFIX}${key}`, str);
          localStorage.setItem(key, str);
        }
      }
    } catch (err) {
      console.error("[TodosDB] dbStorage.setItem failed:", err);
    }
  },

  removeItem(key) {
    try {
      storageMap.delete(key);
      const storage = getRuckStorage();

      if (key === WORKSPACE_CONFIG_KEY) {
        if (storage?.delete) storage.delete(WORKSPACE_CONFIG_KEY).catch(() => {});
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(WORKSPACE_CONFIG_KEY);
          localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
        }
      } else {
        if (storage?.delete) storage.delete(`${CONFIG_PREFIX}${key}`).catch(() => {});
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${key}`);
          localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.error("[TodosDB] dbStorage.removeItem failed:", err);
    }
  }
};
