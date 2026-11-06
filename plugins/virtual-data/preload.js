(() => {
  // src-compat/services.js
  var services = {
    /**
     * 读取文件内容 (纯前端环境)
     */
    async readFile(file) {
      if (typeof file === "string") {
        return file;
      }
      if (file instanceof Blob || file instanceof File) {
        return await file.text();
      }
      return "";
    },
    /**
     * 将文本触发下载或作为本地文件存留
     */
    writeTextFile(text) {
      const filename = `virtual-data-${Date.now()}.txt`;
      if (typeof document !== "undefined") {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      return filename;
    },
    /**
     * 将图片 Base64 触发保存
     */
    writeImageFile(base64Url) {
      const filename = `virtual-data-${Date.now()}.png`;
      if (typeof document !== "undefined") {
        const a = document.createElement("a");
        a.href = base64Url;
        a.download = filename;
        a.click();
      }
      return filename;
    }
  };

  // src-compat/database.js
  var DB_NAME = "ruck_virtual_data_db";
  var DB_VERSION = 1;
  var STORE_DOCS = "docs";
  var STORAGE_KEY = "ruck_virtual_data_docs";
  var docsMap = /* @__PURE__ */ new Map();
  var dbInstance = null;
  var initPromise = null;
  function loadFromLocalStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const doc of list) {
              if (doc && doc._id) {
                docsMap.set(doc._id, doc);
              }
            }
            console.log(`[VirtualDataDB] \u542F\u52A8\u65F6\u4ECE localStorage \u540C\u6B65\u6062\u590D\u4E86 ${docsMap.size} \u6761\u8BB0\u5F55`);
          }
        }
      }
    } catch (err) {
      console.error("[VirtualDataDB] loadFromLocalStorage \u5931\u8D25:", err);
    }
  }
  function syncToLocalStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        const all = Array.from(docsMap.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    } catch (err) {
      console.error("[VirtualDataDB] syncToLocalStorage \u5931\u8D25:", err);
    }
  }
  loadFromLocalStorage();
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return resolve(null);
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db2 = event.target.result;
        if (!db2.objectStoreNames.contains(STORE_DOCS)) {
          db2.createObjectStore(STORE_DOCS, { keyPath: "_id" });
        }
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = (event) => {
        console.warn("[VirtualDataDB] \u6253\u5F00 IndexedDB \u5F02\u5E38:", event.target.error);
        resolve(null);
      };
    });
  }
  function initDatabase() {
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
                if (doc && doc._id && !docsMap.has(doc._id)) {
                  docsMap.set(doc._id, doc);
                }
              }
              resolve();
            };
            req.onerror = () => resolve();
          });
        } catch (err) {
          console.warn("[VirtualDataDB] IndexedDB \u9884\u70ED\u5F02\u5E38:", err);
        }
      })();
      initPromise = Promise.race([
        loader,
        new Promise((resolve) => setTimeout(resolve, 150))
      ]);
    }
    return initPromise;
  }
  if (typeof window !== "undefined") {
    initDatabase();
  }
  function persistDoc(doc) {
    if (!dbInstance) return;
    try {
      const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
      tx.objectStore(STORE_DOCS).put(doc);
    } catch (err) {
      console.warn("[VirtualDataDB] persistDoc \u5931\u8D25:", err);
    }
  }
  function removePersistDoc(id) {
    if (!dbInstance) return;
    try {
      const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
      tx.objectStore(STORE_DOCS).delete(id);
    } catch (err) {
      console.warn("[VirtualDataDB] removePersistDoc \u5931\u8D25:", err);
    }
  }
  function generateRev() {
    return "1-" + Math.random().toString(36).substring(2, 12);
  }
  var db = {
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
        doc._id = "virtual-data-" + Date.now();
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
      }
    }
  };

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
    if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "@ruck-plugins/virtual-data" || rawCode === "virtual-data") {
      normalized.code = "xn";
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
  function dispatchPluginEnter(rawAction) {
    const normalized = normalizeAction(rawAction);
    const fingerprint = `${normalized.code}:${normalized.type}:${JSON.stringify(normalized.payload)}`;
    const now = Date.now();
    if (fingerprint === lastActionFingerprint && now - lastActionTime < 300) {
      return;
    }
    lastActionFingerprint = fingerprint;
    lastActionTime = now;
    lastAction = normalized;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    console.log(`[VirtualData] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);
    for (const listener of enterListeners) {
      try {
        listener(normalized);
      } catch (err) {
        console.error("[VirtualData] Error in onPluginEnter listener:", err);
      }
    }
  }
  function dispatchPluginOut(processExit = false) {
    console.log("[VirtualData] dispatchPluginOut: processExit =", processExit);
    for (const listener of outListeners) {
      try {
        listener(processExit);
      } catch (err) {
        console.error("[VirtualData] Error in onPluginOut listener:", err);
      }
    }
  }
  function setupHostEventListeners() {
    if (hostEventsInstalled) return;
    hostEventsInstalled = true;
    const ruck = getRuck();
    if (typeof ruck?.onPluginEnter === "function") {
      ruck.onPluginEnter((action) => {
        dispatchPluginEnter(action);
      });
    }
    if (typeof ruck?.onPluginOut === "function") {
      ruck.onPluginOut((exit) => {
        dispatchPluginOut(exit);
      });
    }
    fallbackTimer = setTimeout(() => {
      if (!lastAction && enterListeners.size > 0) {
        console.log("[VirtualData] 150ms auto-fallback triggering default onPluginEnter");
        dispatchPluginEnter({ code: "xn", type: "text", payload: "" });
      }
    }, 150);
  }
  function createZtoolsBridge() {
    setupHostEventListeners();
    const bridge = {
      db,
      /**
       * 写入剪贴板文本
       */
      copyText(text) {
        const ruck = getRuck();
        if (ruck?.clipboard?.writeText && typeof ruck.clipboard.writeText === "function") {
          try {
            ruck.clipboard.writeText(text);
            return true;
          } catch (e) {
            console.warn("[ZTools Bridge] ruck.clipboard.writeText \u5F02\u5E38:", e);
          }
        }
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => {
          });
          return true;
        }
        return false;
      },
      /**
       * 弹出通知/轻提示
       */
      showNotification(body) {
        const ruck = getRuck();
        const content = String(body || "");
        if (ruck?.notification?.message && typeof ruck.notification.message === "function") {
          ruck.notification.message({ content, type: "info" });
          return;
        }
        if (ruck?.notification?.system && typeof ruck.notification.system === "function") {
          ruck.notification.system({ body: content });
          return;
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("\u865A\u62DF\u6570\u636E", { body: content });
        }
      },
      /**
       * 动态设置窗口高度
       */
      setExpendHeight(height = 600) {
        const ruck = getRuck();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      /**
       * 退出或切出插件
       */
      outPlugin(exit = false) {
        const ruck = getRuck();
        if (ruck?.window?.outPlugin && typeof ruck.window.outPlugin === "function") {
          ruck.window.outPlugin();
        } else if (ruck?.outPlugin && typeof ruck.outPlugin === "function") {
          ruck.outPlugin();
        } else if (ruck?.window?.hideMainWindow && typeof ruck.window.hideMainWindow === "function") {
          ruck.window.hideMainWindow();
        } else if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      },
      /**
       * 隐藏主窗口
       */
      hideMainWindow() {
        bridge.outPlugin();
      },
      /**
       * 监听插件激活/进入事件
       */
      onPluginEnter(callback) {
        if (typeof callback !== "function") return () => {
        };
        enterListeners.add(callback);
        if (lastAction) {
          try {
            callback(lastAction);
          } catch (e) {
            console.error("[ZTools Bridge] \u56DE\u653E\u8FDB\u5165\u4E8B\u4EF6\u5F02\u5E38:", e);
          }
        }
        return () => {
          enterListeners.delete(callback);
        };
      },
      /**
       * 监听插件切出事件
       */
      onPluginOut(callback) {
        if (typeof callback !== "function") return () => {
        };
        outListeners.add(callback);
        return () => {
          outListeners.delete(callback);
        };
      }
    };
    return bridge;
  }

  // src-compat/index.js
  initDatabase();
  var isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);
  window.IS_APP_VERSION4 = true;
  window.isMacOs = isMac;
  window.services = services;
  window.ztools = createZtoolsBridge();
  window.utools = window.ztools;
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (activeEl.value) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        window.ztools.outPlugin();
      } catch (e) {
        window.location.href = "ruck://action/close-plugin";
      }
    }
  }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("keydown", handleGlobalKeyDown, true);
  }
  console.log("[VirtualData] Ruck \u517C\u5BB9\u5C42\u88C5\u914D\u5B8C\u6210.");
})();
