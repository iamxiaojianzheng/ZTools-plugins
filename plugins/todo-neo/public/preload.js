(() => {
  // src-compat/services.js
  var FEATURE_FLAGS = {
    noteWindow: false,
    tomatoWindow: false
  };
  var services = {
    featureFlags: FEATURE_FLAGS,
    openNote(_params = {}) {
      console.info("[TodoNeo] openNote called (feature disabled in standard Ruck UI mode)");
      return null;
    },
    openTomato(_taskId) {
      console.info("[TodoNeo] openTomato called (feature disabled in standard Ruck UI mode)");
      return null;
    },
    async pinToScreen(_args = {}) {
      return { pinned: false };
    },
    closeWindow() {
      if (typeof window !== "undefined" && window.ruck?.window?.outPlugin) {
        window.ruck.window.outPlugin();
        return;
      }
      window.close();
    }
  };

  // src-compat/database.js
  var CONFIG_PREFIX = "config:";
  var LEGACY_STORAGE_DOCS_KEY = "ruck_todo_neo_docs";
  var LEGACY_STORAGE_PREFIX = "ruck_todo_neo_storage_";
  var docsMap = /* @__PURE__ */ new Map();
  var storageMap = /* @__PURE__ */ new Map();
  var pendingWrites = /* @__PURE__ */ new Map();
  var PENDING_WINDOW_MS = 3e3;
  var initPromise = null;
  var changeListeners = /* @__PURE__ */ new Set();
  function getRuckStorage() {
    if (typeof window !== "undefined" && window.ruck?.storage) {
      return window.ruck.storage;
    }
    return null;
  }
  function cleanupPendingWrites() {
    const now = Date.now();
    for (const [id, ts] of pendingWrites.entries()) {
      if (now - ts > PENDING_WINDOW_MS) {
        pendingWrites.delete(id);
      }
    }
  }
  function onDataChange(callback) {
    if (typeof callback !== "function") return () => {
    };
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
  function migrateFromLegacyStorage(storage) {
    try {
      if (typeof localStorage === "undefined") return;
      const legacyDocsRaw = localStorage.getItem(LEGACY_STORAGE_DOCS_KEY);
      if (legacyDocsRaw) {
        const list = JSON.parse(legacyDocsRaw);
        if (Array.isArray(list) && list.length > 0) {
          console.log(`[TodoNeoDB] Migrating ${list.length} legacy docs to ruck.db...`);
          for (const doc of list) {
            if (doc && doc._id) {
              docsMap.set(doc._id, doc);
              if (storage?.set) {
                storage.set(doc._id, doc).catch(() => {
                });
              }
            }
          }
        }
      }
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
                storage.set(`${CONFIG_PREFIX}${subKey}`, parsed).catch(() => {
                });
              }
            } catch {
              storageMap.set(subKey, valRaw);
              if (storage?.set) {
                storage.set(`${CONFIG_PREFIX}${subKey}`, valRaw).catch(() => {
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[TodoNeoDB] migrateFromLegacyStorage failed:", err);
    }
  }
  async function initDatabase(forceRefresh = false) {
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
            const remoteKeys = /* @__PURE__ */ new Set();
            for (const item of allRecords) {
              if (!item || !item.key) continue;
              remoteKeys.add(item.key);
              if (item.key.startsWith(CONFIG_PREFIX)) {
                const cfgKey = item.key.slice(CONFIG_PREFIX.length);
                storageMap.set(cfgKey, item.value);
              } else {
                if (pendingWrites.has(item.key)) {
                  continue;
                }
                const doc = item.value && item.value._id ? item.value : { ...item.value, _id: item.key };
                docsMap.set(item.key, doc);
              }
            }
            for (const localId of Array.from(docsMap.keys())) {
              if (!remoteKeys.has(localId) && !pendingWrites.has(localId)) {
                docsMap.delete(localId);
              }
            }
            console.log(`[TodoNeoDB] Synced ${docsMap.size} docs and ${storageMap.size} configs from ruck.db`);
          } else {
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
  function reloadFromStorage() {
    return initDatabase(true).then((size) => {
      notifyDataChange("reload", null);
      return size;
    });
  }
  if (typeof window !== "undefined") {
    initDatabase();
  }
  var db = {
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
      pendingWrites.set(doc._id, Date.now());
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
  var dbStorage = {
    getItem(key) {
      try {
        if (storageMap.has(key)) {
          return JSON.parse(JSON.stringify(storageMap.get(key)));
        }
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
        const storage = getRuckStorage();
        if (storage?.set) {
          storage.set(`${CONFIG_PREFIX}${key}`, value).catch((err) => {
            console.error(`[TodoNeoDB] Failed to persist config ${key} to ruck.db:`, err);
          });
        }
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
          storage.delete(`${CONFIG_PREFIX}${key}`).catch(() => {
          });
        } else if (storage?.remove) {
          storage.remove(`${CONFIG_PREFIX}${key}`).catch(() => {
          });
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

  // src-compat/tools.js
  var TASKS_PREFIX = "todo-tasks/";
  var GROUPS_PREFIX = "todo-group/";
  var NEXT_TASK_SORT_KEY = "mcp-next-task-sort";
  var NEXT_GROUP_SORT_KEY = "mcp-next-group-sort";
  function getDbDocValue(doc) {
    return doc && (doc.value || doc);
  }
  function getAllTasks() {
    const docs = db.allDocs(TASKS_PREFIX) || [];
    return docs.filter((doc) => doc._id?.startsWith(TASKS_PREFIX) && !doc.$deprecated).map((doc) => ({ _id: doc._id, ...getDbDocValue(doc) }));
  }
  function getAllGroups() {
    const docs = db.allDocs(GROUPS_PREFIX) || [];
    return docs.filter((doc) => doc._id?.startsWith(GROUPS_PREFIX) && !doc.$deprecated).map((doc) => ({ _id: doc._id, ...getDbDocValue(doc) })).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  function getTaskById(id) {
    const fullId = id.startsWith(TASKS_PREFIX) ? id : `${TASKS_PREFIX}${id}`;
    const doc = db.get(fullId);
    if (!doc || doc.$deprecated) return null;
    return { _id: doc._id, ...getDbDocValue(doc) };
  }
  function putDoc(id, value) {
    dbStorage.setItem(id, value);
    return db.put({ _id: id, value });
  }
  function nextSort(key) {
    const current = dbStorage.getItem(key) || 0;
    const next = Number(current) + 1;
    dbStorage.setItem(key, next);
    return next;
  }
  function getGroupNameById(id) {
    return getAllGroups().find((group) => group._id === id)?.title || "";
  }
  function getGroupIdByName(name) {
    return getAllGroups().find((group) => group.title === name)?._id || null;
  }
  function getOrCreateGroup(name) {
    const existing = getGroupIdByName(name);
    if (existing) return existing;
    const now = Date.now();
    const id = `${GROUPS_PREFIX}${now}`;
    putDoc(id, {
      title: name,
      sort: nextSort(NEXT_GROUP_SORT_KEY),
      created_at: now
    });
    return id;
  }
  function formatDateTime(timestamp) {
    if (!timestamp) return void 0;
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  function parseDueAt(value) {
    if (!value) return void 0;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return void 0;
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (Number.isNaN(date.getTime())) return void 0;
    return date.getTime();
  }
  async function todoGroupList() {
    return {
      groups: getAllGroups().map((group) => ({ name: group.title }))
    };
  }
  async function todoSearch({ query, group, status, dueAt } = {}) {
    let tasks = getAllTasks();
    if (query) {
      const keyword = query.toLowerCase();
      tasks = tasks.filter((task) => task.text?.toLowerCase().includes(keyword));
    }
    if (group) {
      const groupId = getGroupIdByName(group);
      tasks = groupId ? tasks.filter((task) => task.groupId === groupId) : [];
    }
    if (status === "done") tasks = tasks.filter((task) => task.completed);
    if (status === "pending") tasks = tasks.filter((task) => !task.completed);
    if (dueAt) {
      const due = parseDueAt(dueAt);
      tasks = tasks.filter((task) => task.dueAt && task.dueAt <= due);
    }
    return {
      tasks: tasks.sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((task) => ({
        id: task._id,
        text: task.text,
        group: getGroupNameById(task.groupId),
        completed: Boolean(task.completed),
        dueAt: formatDateTime(task.dueAt),
        completed_at: formatDateTime(task.completed_at),
        created_at: formatDateTime(task.created_at)
      }))
    };
  }
  async function todoCreate({ content, dueAt, group }) {
    const now = Date.now();
    const id = `${TASKS_PREFIX}${now}`;
    const groupId = group ? getOrCreateGroup(group) : `${GROUPS_PREFIX}pending`;
    const task = {
      text: content,
      groupId,
      completed: false,
      created_at: now,
      sort: nextSort(NEXT_TASK_SORT_KEY),
      dueAt: parseDueAt(dueAt)
    };
    putDoc(id, task);
    return {
      id,
      text: task.text,
      group: group || "\u5F85\u5904\u7406",
      dueAt: formatDateTime(task.dueAt),
      created_at: formatDateTime(task.created_at)
    };
  }
  async function todoUpdate({ id, patch }) {
    const task = getTaskById(id);
    if (!task) throw new Error(`\u5F85\u529E\u4E8B\u9879\u4E0D\u5B58\u5728: ${id}`);
    const updated = { ...task };
    delete updated._id;
    if (patch.content !== void 0) updated.text = patch.content;
    if (patch.status === "done") {
      updated.completed = true;
      updated.completed_at = Date.now();
      if (!updated.first_completed_at) updated.first_completed_at = updated.completed_at;
    }
    if (patch.status === "pending") {
      updated.completed = false;
      delete updated.completed_at;
    }
    if (patch.dueAt !== void 0) {
      const due = parseDueAt(patch.dueAt);
      if (due) updated.dueAt = due;
      else delete updated.dueAt;
    }
    if (patch.group !== void 0) updated.groupId = getOrCreateGroup(patch.group);
    putDoc(task._id, updated);
    return {
      id: task._id,
      text: updated.text,
      group: getGroupNameById(updated.groupId),
      completed: Boolean(updated.completed),
      dueAt: formatDateTime(updated.dueAt),
      updated: true
    };
  }
  var toolHandlers = {
    todo_group_list: todoGroupList,
    todo_search: todoSearch,
    todo_create: todoCreate,
    todo_update: todoUpdate
  };

  // src-compat/ztools.js
  onDataChange(() => {
    emitDbPull();
  });
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var enterListeners = /* @__PURE__ */ new Set();
  var outListeners = /* @__PURE__ */ new Set();
  var dbPullListeners = /* @__PURE__ */ new Set();
  var lastAction = null;
  var lastActionFingerprint = "";
  var lastActionTime = 0;
  var hostEventsInstalled = false;
  var fallbackTimer = null;
  function emitDbPull() {
    console.log("[TodoNeo] emitDbPull triggered, notifying listeners:", dbPullListeners.size);
    for (const listener of dbPullListeners) {
      try {
        listener();
      } catch (err) {
        console.error("[TodoNeo] Error in onDbPull listener:", err);
      }
    }
  }
  function normalizeAction(rawAction = {}) {
    const normalized = { ...rawAction };
    const rawCode = String(normalized.code || "").trim();
    if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "todo-neo" || rawCode === "@ruck-plugins/todo-neo") {
      normalized.code = "todo";
    } else {
      normalized.code = rawCode;
    }
    if (!normalized.type) {
      normalized.type = "text";
    }
    if (normalized.payload === void 0) {
      normalized.payload = "";
    }
    return normalized;
  }
  async function dispatchPluginEnter(rawAction) {
    const normalized = normalizeAction(rawAction);
    const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
    const now = Date.now();
    if (fingerprint === lastActionFingerprint && now - lastActionTime < 350) {
      console.log(`[TodoNeo] Ignored duplicate plugin-enter event: ${fingerprint}`);
      return;
    }
    lastActionFingerprint = fingerprint;
    lastActionTime = now;
    lastAction = normalized;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    try {
      await initDatabase(true);
    } catch (err) {
      console.error("[TodoNeo] initDatabase error before dispatch:", err);
    }
    console.log(`[TodoNeo] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}", payload=`, normalized.payload);
    for (const listener of enterListeners) {
      try {
        listener(normalized);
      } catch (err) {
        console.error("[TodoNeo] Error in onPluginEnter listener:", err);
      }
    }
  }
  function dispatchPluginOut(processExit = false) {
    console.log("[TodoNeo] dispatchPluginOut: processExit =", processExit);
    for (const listener of outListeners) {
      try {
        listener(processExit);
      } catch (err) {
        console.error("[TodoNeo] Error in onPluginOut listener:", err);
      }
    }
  }
  function setupHostEventListeners() {
    if (hostEventsInstalled) return;
    hostEventsInstalled = true;
    const ruck = getRuck();
    if (typeof ruck?.onPluginEnter === "function") {
      ruck.onPluginEnter(async (action) => {
        await dispatchPluginEnter(action);
      });
    }
    if (typeof ruck?.onPluginOut === "function") {
      ruck.onPluginOut((exit) => {
        dispatchPluginOut(exit);
      });
    }
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          console.log("[TodoNeo] Window became visible, reloading storage...");
          reloadFromStorage();
          emitDbPull();
        }
      });
    }
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("focus", () => {
        console.log("[TodoNeo] Window focused, reloading storage...");
        reloadFromStorage();
        emitDbPull();
      });
    }
    fallbackTimer = setTimeout(() => {
      if (!lastAction && enterListeners.size > 0) {
        console.log("[TodoNeo] 300ms auto-fallback triggering default onPluginEnter");
        dispatchPluginEnter({ code: "todo", type: "text", payload: "" });
      }
    }, 300);
  }
  function createZtoolsBridge() {
    const registeredTools = /* @__PURE__ */ new Map();
    Object.entries(toolHandlers).forEach(([name, handler]) => {
      registeredTools.set(name, handler);
    });
    setupHostEventListeners();
    const bridge = {
      db,
      dbStorage,
      // 工具注册能力 (支持 MCP / AI 宿主调度)
      registerTool(name, handler) {
        registeredTools.set(name, handler);
        const ruck = getRuck();
        if (typeof ruck?.tool?.register === "function") {
          ruck.tool.register(name, handler);
        }
        return true;
      },
      getRegisteredTools() {
        return registeredTools;
      },
      // 复制纯文本
      copyText(text) {
        const ruck = getRuck();
        if (ruck?.clipboard?.writeText) {
          ruck.clipboard.writeText(text);
          return true;
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text);
          return true;
        }
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          return true;
        } catch {
          return false;
        }
      },
      // 注册生命周期回调：由宿主事件和统一总线驱动，不再做无脑二次回放
      onPluginEnter(cb) {
        if (typeof cb !== "function") return () => {
        };
        enterListeners.add(cb);
        return () => {
          enterListeners.delete(cb);
        };
      },
      onPluginOut(cb) {
        if (typeof cb !== "function") return () => {
        };
        outListeners.add(cb);
        return () => {
          outListeners.delete(cb);
        };
      },
      onDbPull(cb) {
        if (typeof cb !== "function") return () => {
        };
        dbPullListeners.add(cb);
        const ruck = getRuck();
        if (ruck?.database?.onDbPull) {
          ruck.database.onDbPull(cb);
        }
        return () => {
          dbPullListeners.delete(cb);
        };
      },
      outPlugin() {
        const ruck = getRuck();
        if (ruck?.window?.outPlugin) {
          ruck.window.outPlugin();
          return;
        }
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      },
      hideMainWindow() {
        const ruck = getRuck();
        if (ruck?.window?.hide) {
          ruck.window.hide();
          return;
        }
        bridge.outPlugin();
      },
      showMainWindow() {
        const ruck = getRuck();
        if (ruck?.window?.show) {
          ruck.window.show();
        }
      },
      setExpendHeight(height) {
        const ruck = getRuck();
        if (ruck?.window?.setExpendHeight) {
          ruck.window.setExpendHeight(height);
        }
      },
      showNotification(body) {
        const ruck = getRuck();
        if (ruck?.notification?.show) {
          ruck.notification.show({ body });
          return;
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Todo \u5F85\u529E", { body });
        } else if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") new Notification("Todo \u5F85\u529E", { body });
          });
        }
      },
      // AI 大模型能力桥接
      async ai(options = {}) {
        const ruck = getRuck();
        if (ruck?.ai?.chat) {
          const request = {
            model: options.model && !options.model.startsWith("doubao-") ? options.model : "",
            messages: (options.messages || []).map((m) => ({
              role: m.role || "user",
              content: String(m.content || "")
            })),
            temperature: options.temperature,
            max_tokens: options.max_tokens
          };
          let result;
          try {
            result = await ruck.ai.chat({}, request);
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
              result = await ruck.ai.chat(request, {});
            } else {
              throw err;
            }
          }
          const content = typeof result === "string" ? result : result?.content || String(result || "");
          return { content };
        }
        throw new Error("\u5F53\u524D\u73AF\u5883\u672A\u914D\u7F6E AI \u80FD\u529B\u652F\u6301");
      }
    };
    return bridge;
  }

  // src-compat/index.js
  if (typeof window !== "undefined" && window.__RUCK_TODO_NEO_COMPAT_MOUNTED__) {
    console.log("[TodoNeo] Ruck compat already mounted, skipping duplicate execution.");
  } else {
    let handleGlobalKeyDown = function(event) {
      if (event.key === "Escape" || event.code === "Escape") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          if (activeEl.value) {
            return;
          }
        }
        if (document.querySelector("[role='dialog'], .modal, .dialog, .settings-modal")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
          window.ztools.outPlugin();
        } catch {
          if (typeof window !== "undefined" && window.location) {
            window.location.href = "ruck://action/close-plugin";
          }
        }
      }
    };
    if (typeof window !== "undefined") {
      window.__RUCK_TODO_NEO_COMPAT_MOUNTED__ = true;
    }
    const bridge = createZtoolsBridge();
    window.ztools = bridge;
    window.utools = bridge;
    window.services = services;
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    document.addEventListener("keydown", handleGlobalKeyDown, true);
    console.log("[TodoNeo] Ruck compatibility layer successfully mounted.");
  }
})();
