(() => {
  // src-compat/services.js
  var services = {
    // 读取文本文件（Web 标准通过 FileReader 或 fetch 桥接）
    async readFile(file) {
      if (typeof window !== "undefined" && window.ruck?.fs?.readTextFile) {
        return await window.ruck.fs.readTextFile(file);
      }
      throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76F4\u63A5\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u8DEF\u5F84");
    },
    // 写入文本文件
    async writeTextFile(text) {
      if (typeof window !== "undefined" && window.ruck?.fs?.writeTextFile) {
        const filename = `todos_${Date.now()}.txt`;
        return await window.ruck.fs.writeTextFile(filename, text);
      }
      try {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `todos_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        return "downloaded";
      } catch (e) {
        console.warn("[Todos] writeTextFile fallback failed:", e);
        return void 0;
      }
    },
    // 写入图片文件
    async writeImageFile(base64Url) {
      if (typeof window !== "undefined" && window.ruck?.fs?.writeImageFile) {
        return await window.ruck.fs.writeImageFile(base64Url);
      }
      try {
        const a = document.createElement("a");
        a.href = base64Url;
        a.download = `todos_${Date.now()}.png`;
        a.click();
        return "downloaded";
      } catch (e) {
        console.warn("[Todos] writeImageFile fallback failed:", e);
        return void 0;
      }
    }
  };

  // src-compat/database.js
  var STORAGE_KEY = "todos-data";
  var WORKSPACE_CONFIG_KEY = "workspace-configs";
  var TASKS_PREFIX = "todo-tasks/";
  var CONFIG_PREFIX = "config:";
  var LEGACY_STORAGE_PREFIX = "ruck_todos_db_";
  var initPromise = null;
  var lastKnownTaskIds = /* @__PURE__ */ new Set();
  var storageMap = /* @__PURE__ */ new Map();
  var lastLocalPersistTime = 0;
  var pendingTaskWrites = /* @__PURE__ */ new Map();
  function cleanupPendingWrites() {
    const now = Date.now();
    for (const [id, time] of pendingTaskWrites.entries()) {
      if (now - time > 3e3) {
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
  function getDefaultTodosData() {
    return {
      version: "1.0.0",
      workspaces: { work: [], life: [], study: [] },
      currentWorkspace: "work"
    };
  }
  function getTodosData() {
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
  function persistTodosData(data) {
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
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.error("[TodosDB] Failed to save localStorage:", e);
    }
    const storage = getRuckStorage();
    if (!storage) return;
    if (storage.set) {
      storage.set(STORAGE_KEY, data).catch((err) => {
        console.error("[TodosDB] Failed to persist todos-data to ruck.db:", err);
      });
    }
    try {
      const currentTaskIds = /* @__PURE__ */ new Set();
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
              storage.set(`${TASKS_PREFIX}${task.id}`, taskDoc).catch(() => {
              });
            }
          }
        }
      }
      for (const oldId of lastKnownTaskIds) {
        if (!currentTaskIds.has(oldId)) {
          if (storage.delete) {
            storage.delete(`${TASKS_PREFIX}${oldId}`).catch(() => {
            });
          } else if (storage.remove) {
            storage.remove(`${TASKS_PREFIX}${oldId}`).catch(() => {
            });
          }
        }
      }
      lastKnownTaskIds = currentTaskIds;
    } catch (err) {
      console.warn("[TodosDB] Failed to persist atom tasks:", err);
    }
  }
  function migrateFromLegacyStorage(storage) {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.workspaces) {
          console.log("[TodosDB] Migrating legacy todos-data to ruck.db...");
          persistTodosData(parsed);
        }
      }
      const cfgRaw = localStorage.getItem(WORKSPACE_CONFIG_KEY) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
      if (cfgRaw && storage?.set) {
        try {
          const cfgs = JSON.parse(cfgRaw);
          storage.set(WORKSPACE_CONFIG_KEY, cfgs).catch(() => {
          });
        } catch {
          storage.set(WORKSPACE_CONFIG_KEY, cfgRaw).catch(() => {
          });
        }
      }
    } catch (err) {
      console.warn("[TodosDB] migrateFromLegacyStorage failed:", err);
    }
  }
  async function initDatabase(forceRefresh = false) {
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
                  if (now - lastLocalPersistTime < 2e3) {
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
                            if (writeTime && now - writeTime < 2500) {
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
  if (typeof window !== "undefined") {
    initDatabase();
  }
  var dbStorage = {
    getItem(key) {
      try {
        if (key === WORKSPACE_CONFIG_KEY) {
          const raw = localStorage.getItem(WORKSPACE_CONFIG_KEY) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
          if (raw !== null) {
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          }
        }
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
            storage.set(WORKSPACE_CONFIG_KEY, value).catch(() => {
            });
          }
          if (typeof localStorage !== "undefined") {
            const str = typeof value === "string" ? value : JSON.stringify(value);
            localStorage.setItem(WORKSPACE_CONFIG_KEY, str);
            localStorage.setItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`, str);
          }
        } else {
          if (storage?.set) {
            storage.set(`${CONFIG_PREFIX}${key}`, value).catch(() => {
            });
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
          if (storage?.delete) storage.delete(WORKSPACE_CONFIG_KEY).catch(() => {
          });
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(WORKSPACE_CONFIG_KEY);
            localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${WORKSPACE_CONFIG_KEY}`);
          }
        } else {
          if (storage?.delete) storage.delete(`${CONFIG_PREFIX}${key}`).catch(() => {
          });
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

  // src-compat/quick-add.js
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
  }
  function stripPrefix(text = "") {
    return String(text).replace(/^(todo|待办|\+)\s*/i, "").trim();
  }
  function getStorageData() {
    return getTodosData();
  }
  function saveStorageData(data) {
    persistTodosData(data);
  }
  function quickAddTask(rawTitle, bridge, notify = true) {
    const title = stripPrefix(rawTitle);
    if (!title) return null;
    const data = getStorageData();
    const wsKey = data.currentWorkspace || "work";
    if (!Array.isArray(data.workspaces[wsKey])) {
      data.workspaces[wsKey] = [];
    }
    const today = formatDate(/* @__PURE__ */ new Date());
    const newTask = {
      id: generateId(),
      title,
      description: "",
      priority: "medium",
      dates: [],
      status: "todo",
      createdAt: today,
      updatedAt: today
    };
    data.workspaces[wsKey].push(newTask);
    saveStorageData(data);
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        let evt = null;
        if (typeof CustomEvent === "function") {
          evt = new CustomEvent("todos-external-task-added", {
            detail: { workspace: wsKey, task: newTask }
          });
        } else if (typeof Event === "function") {
          evt = new Event("todos-external-task-added");
          evt.detail = { workspace: wsKey, task: newTask };
        }
        if (evt) {
          window.dispatchEvent(evt);
        }
      }
    } catch (err) {
      console.error("[TodosQuickAdd] Failed to dispatch custom event:", err);
    }
    if (notify && bridge?.showNotification) {
      bridge.showNotification(`\u5DF2\u6DFB\u52A0\u5F85\u529E: ${title}`);
    }
    return newTask;
  }
  function setupQuickAddEngine(bridge) {
    const ruck = typeof window !== "undefined" && window.ruck ? window.ruck : null;
    if (!ruck || typeof ruck.onMainPush !== "function") {
      console.warn("[TodosQuickAdd] window.ruck.onMainPush not found, skipping hook.");
      return;
    }
    ruck.onMainPush(
      async ({ code, type, payload, searchWord }) => {
        try {
          const rawText = typeof searchWord === "string" && searchWord !== "" ? searchWord : typeof payload === "string" ? payload : "";
          const queryText = stripPrefix(rawText);
          const data = getStorageData();
          const wsKey = data.currentWorkspace || "work";
          const currentTasks = Array.isArray(data.workspaces[wsKey]) ? data.workspaces[wsKey] : [];
          if (!queryText) {
            const results2 = [
              {
                id: "quick-add-hint",
                title: "\u2795 \u5FEB\u6377\u6DFB\u52A0\u5F85\u529E",
                description: "\u8F93\u5165\u5F85\u529E\u5185\u5BB9\u540E\u56DE\u8F66\u76F4\u63A5\u6DFB\u52A0\uFF0C\u6216\u56DE\u8F66\u6253\u5F00\u5F85\u529E\u65E5\u5386",
                icon: "logo.svg",
                payload: { action: "open" }
              }
            ];
            const uncompleted = currentTasks.filter((t) => t.status !== "done").slice(-3).reverse();
            for (const task of uncompleted) {
              results2.push({
                id: `preview-${task.id}`,
                title: `\u{1F4CB} ${task.title}`,
                description: `\u5F85\u529E\u4E8B\u9879 \xB7 \u521B\u5EFA\u4E8E ${task.createdAt}`,
                icon: "logo.svg",
                payload: { action: "open", taskId: task.id }
              });
            }
            return results2;
          }
          const results = [
            {
              id: "quick-add-task-silent",
              title: `\u2795 \u6DFB\u52A0\u5F85\u529E: ${queryText}`,
              description: "\u6309\u56DE\u8F66\u5FEB\u901F\u6DFB\u52A0\u81F3\u5F85\u529E\u6C60\uFF08\u9759\u9ED8\u5B8C\u6210\uFF09",
              icon: "logo.svg",
              payload: { action: "add", title: queryText, open: false }
            },
            {
              id: "quick-add-task-and-open",
              title: `\u{1F680} \u6DFB\u52A0\u5E76\u6253\u5F00: ${queryText}`,
              description: "\u6DFB\u52A0\u81F3\u5F85\u529E\u6C60\u5E76\u8FDB\u5165\u5F85\u529E\u65E5\u5386\u4E3B\u754C\u9762",
              icon: "logo.svg",
              payload: { action: "add", title: queryText, open: true }
            }
          ];
          const lowerQ = queryText.toLowerCase();
          const matched = currentTasks.filter((t) => (t.title || "").toLowerCase().includes(lowerQ)).slice(0, 3);
          for (const task of matched) {
            results.push({
              id: `existing-${task.id}`,
              title: `\u{1F4CB} [\u5DF2\u5B58\u5728] ${task.title}`,
              description: `${task.status === "done" ? "\u5DF2\u5B8C\u6210" : "\u5F85\u529E"} \xB7 \u521B\u5EFA\u4E8E ${task.createdAt}`,
              icon: "logo.svg",
              payload: { action: "open", taskId: task.id }
            });
          }
          return results;
        } catch (err) {
          console.error("[TodosQuickAdd] Error in onMainPush query:", err);
          return [];
        }
      },
      async ({ code, type, payload, option }) => {
        console.log("[TodosQuickAdd] onMainPush item selected:", option);
        const actionPayload = option?.payload || {};
        if (actionPayload.action === "add") {
          quickAddTask(actionPayload.title, bridge, true);
          return Boolean(actionPayload.open);
        }
        if (actionPayload.action === "open") {
          return true;
        }
        return false;
      }
    );
    console.log("[TodosQuickAdd] onMainPush search & add engine registered successfully.");
  }

  // src-compat/ztools.js
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var enterListeners = /* @__PURE__ */ new Set();
  var outListeners = /* @__PURE__ */ new Set();
  var lastAction = null;
  var lastActionFingerprint = "";
  var lastActionTime = 0;
  var hostEventsInstalled = false;
  var fallbackTimer = null;
  function normalizeAction(rawAction = {}) {
    const normalized = { ...rawAction };
    const rawCode = String(normalized.code || "").trim();
    if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "todos" || rawCode === "@ruck-plugins/todos") {
      normalized.code = "Todos";
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
  var currentBridgeInstance = null;
  async function dispatchPluginEnter(rawAction) {
    const normalized = normalizeAction(rawAction);
    const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
    const now = Date.now();
    if (fingerprint === lastActionFingerprint && now - lastActionTime < 350) {
      console.log(`[Todos] Ignored duplicate plugin-enter event: ${fingerprint}`);
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
      console.warn("[Todos] initDatabase refresh error on enter:", err);
    }
    console.log(`[Todos] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);
    if (normalized.code === "add" && normalized.payload) {
      try {
        console.log(`[Todos] Quick adding task via enter action: "${normalized.payload}"`);
        quickAddTask(normalized.payload, currentBridgeInstance, true);
      } catch (err) {
        console.error("[Todos] Failed to quick add task via enter action:", err);
      }
    }
    for (const listener of enterListeners) {
      try {
        listener(normalized);
      } catch (err) {
        console.error("[Todos] Error in onPluginEnter listener:", err);
      }
    }
  }
  function dispatchPluginOut(processExit = false) {
    console.log("[Todos] dispatchPluginOut: processExit =", processExit);
    for (const listener of outListeners) {
      try {
        listener(processExit);
      } catch (err) {
        console.error("[Todos] Error in onPluginOut listener:", err);
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
          initDatabase(true);
        }
      });
    }
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("focus", () => {
        initDatabase(true);
      });
    }
    fallbackTimer = setTimeout(() => {
      if (!lastAction && enterListeners.size > 0) {
        console.log("[Todos] 300ms auto-fallback triggering default onPluginEnter");
        dispatchPluginEnter({ code: "Todos", type: "text", payload: "" });
      }
    }, 300);
  }
  function createZtoolsBridge() {
    setupHostEventListeners();
    const bridge = {
      dbStorage,
      isDarkColors() {
        const ruck = getRuck();
        if (typeof ruck?.theme?.isDark === "function") {
          return Boolean(ruck.theme.isDark());
        }
        if (typeof window !== "undefined" && window.matchMedia) {
          return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
      },
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
      onMainPush(callback, onSelect) {
        const ruck = getRuck();
        if (typeof ruck?.onMainPush === "function") {
          ruck.onMainPush(callback, onSelect);
        }
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
      showNotification(body, clickFeatureCode) {
        const ruck = getRuck();
        if (ruck?.notification?.show) {
          ruck.notification.show({ body, clickFeatureCode });
          return;
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("\u5F85\u529E\u4E8B\u9879", { body });
        } else if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") new Notification("\u5F85\u529E\u4E8B\u9879", { body });
          });
        }
      }
    };
    currentBridgeInstance = bridge;
    return bridge;
  }

  // src-compat/index.js
  if (typeof window !== "undefined" && window.__RUCK_TODOS_COMPAT_MOUNTED__) {
    console.log("[Todos] Ruck compat already mounted, skipping duplicate execution.");
  } else {
    let handleGlobalKeyDown = function(event) {
      if (event.key === "Escape" || event.code === "Escape") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          if (activeEl.value) {
            return;
          }
        }
        if (document.querySelector("[role='dialog'], .modal, .dialog")) {
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
      window.__RUCK_TODOS_COMPAT_MOUNTED__ = true;
    }
    const bridge = createZtoolsBridge();
    window.ztools = bridge;
    window.utools = bridge;
    window.services = services;
    setupQuickAddEngine(bridge);
    try {
      if (typeof localStorage !== "undefined") {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, value) {
          originalSetItem(key, value);
          if (key === "todos-data") {
            try {
              const parsed = JSON.parse(value);
              persistTodosData(parsed);
            } catch (err) {
              console.warn("[Todos] Failed to auto-persist todos-data:", err);
            }
          }
        };
      }
    } catch (e) {
      console.warn("[Todos] Failed to setup localStorage hook:", e);
    }
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    document.addEventListener("keydown", handleGlobalKeyDown, true);
    console.log("[Todos] Ruck compatibility layer successfully mounted.");
  }
})();
