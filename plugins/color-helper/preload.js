"use strict";
(() => {
  // src-compat/services.js
  var services = {
    /**
     * 保存色卡图片
     * @param {ArrayBuffer | number[] | Uint8Array} bf 二进制缓冲区
     * @param {string} [filename] 保存文件名
     */
    async saveColorCard(bf, filename) {
      if (!bf) return;
      try {
        let uint8Array;
        if (bf instanceof Uint8Array) {
          uint8Array = bf;
        } else if (bf instanceof ArrayBuffer) {
          uint8Array = new Uint8Array(bf);
        } else if (Array.isArray(bf)) {
          uint8Array = new Uint8Array(bf);
        } else {
          uint8Array = new Uint8Array(bf);
        }
        const blob = new Blob([uint8Array], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        const name = filename || `color-card-${Date.now()}.png`;
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1e3);
        console.log(`[ColorHelperServices] \u8272\u5361\u5DF2\u6210\u529F\u5BFC\u51FA\u4E3A: ${name}`);
      } catch (err) {
        console.error("[ColorHelperServices] saveColorCard failed:", err);
      }
    }
  };

  // src-compat/database.js
  var DB_NAME = "ruck_color_helper_db";
  var DB_VERSION = 1;
  var STORE_DOCS = "docs";
  var STORAGE_PREFIX = "color_helper_db_";
  var docsMap = /* @__PURE__ */ new Map();
  var dbInstance = null;
  var initPromise = null;
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
            } catch (e) {
            }
          }
        }
      }
    } catch (err) {
      console.error("[ColorHelperDB] loadFromLocalStorage failed:", err);
    }
  }
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
  function initDatabase() {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          dbInstance = await openIDB();
          if (!dbInstance) return;
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
  async function persistDocToIDB(doc) {
    try {
      if (!dbInstance) await initDatabase();
      if (!dbInstance) return;
      const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
      tx.objectStore(STORE_DOCS).put(doc);
    } catch (e) {
    }
  }
  async function removeDocFromIDB(id) {
    try {
      if (!dbInstance) await initDatabase();
      if (!dbInstance) return;
      const tx = dbInstance.transaction(STORE_DOCS, "readwrite");
      tx.objectStore(STORE_DOCS).delete(id);
    } catch (e) {
    }
  }
  var db = {
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
      docsMap.set(id, toSave);
      syncDocToLocalStorage(toSave);
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

  // src-compat/ztools.js
  var isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  var STORAGE_PREFIX2 = "color_helper_";
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var KNOWN_CODES = [
    "color",
    "ai",
    "ui",
    "traditional",
    "gradient",
    "image",
    "collect",
    "pickercolor"
  ];
  async function invokeRuckAiChat(ruck, request) {
    try {
      return await ruck.ai.chat({}, request);
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
        return await ruck.ai.chat(request, {});
      }
      throw err;
    }
  }
  function createZtoolsBridge() {
    const bridge2 = {
      db,
      // dbStorage 同步 K-V 存储
      dbStorage: {
        getItem(key) {
          try {
            if (typeof localStorage === "undefined") return null;
            const v = localStorage.getItem(`${STORAGE_PREFIX2}${key}`);
            return v ? JSON.parse(v) : null;
          } catch {
            return null;
          }
        },
        setItem(key, value) {
          try {
            if (typeof localStorage === "undefined") return;
            localStorage.setItem(`${STORAGE_PREFIX2}${key}`, JSON.stringify(value));
          } catch (e) {
          }
        },
        removeItem(key) {
          try {
            if (typeof localStorage === "undefined") return;
            localStorage.removeItem(`${STORAGE_PREFIX2}${key}`);
          } catch (e) {
          }
        }
      },
      // 平台特征
      isMacOs() {
        return isMac;
      },
      getPath(name) {
        if (name === "downloads") return "downloads";
        if (name === "temp") return "temp";
        return "";
      },
      // 剪贴板
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
        } catch (e) {
          return false;
        }
      },
      copyImage(imageData) {
        const ruck = getRuck();
        if (ruck?.clipboard?.writeImage) {
          ruck.clipboard.writeImage(imageData);
          return true;
        }
        return false;
      },
      // 屏幕取色
      screenColorPick(callback) {
        const ruck = getRuck();
        if (ruck?.screenColorPick) {
          ruck.screenColorPick(callback);
          return;
        }
        if (ruck?.screen?.colorPick) {
          ruck.screen.colorPick(callback);
          return;
        }
        if (typeof window !== "undefined" && window.EyeDropper) {
          const dropper = new window.EyeDropper();
          dropper.open().then((result) => {
            if (typeof callback === "function") {
              callback({ hex: result.sRGBHex, rgb: "" });
            }
          }).catch(() => {
          });
          return;
        }
        console.warn("[ColorHelper] screenColorPick is not supported in this environment");
      },
      // 屏幕截图
      screenCapture(callback) {
        const ruck = getRuck();
        if (ruck?.screenCapture) {
          ruck.screenCapture(callback);
          return;
        }
        if (ruck?.screen?.capture) {
          ruck.screen.capture(callback);
          return;
        }
        console.warn("[ColorHelper] screenCapture is not supported in this environment");
      },
      // 窗口控制
      hideMainWindow(restorePreWindow = true) {
        const ruck = getRuck();
        if (ruck?.window?.hideMainWindow) {
          return ruck.window.hideMainWindow(restorePreWindow);
        }
        if (ruck?.hideMainWindow) {
          return ruck.hideMainWindow(restorePreWindow);
        }
      },
      showMainWindow() {
        const ruck = getRuck();
        if (ruck?.window?.showMainWindow) {
          return ruck.window.showMainWindow();
        }
        if (ruck?.showMainWindow) {
          return ruck.showMainWindow();
        }
      },
      outPlugin(isKill = false) {
        const ruck = getRuck();
        if (ruck?.window?.outPlugin) {
          return ruck.window.outPlugin(isKill);
        }
        if (ruck?.outPlugin) {
          return ruck.outPlugin(isKill);
        }
      },
      // 判定 AI 能力是否可用
      isAIAvailable() {
        const ruck = getRuck();
        return !!(ruck?.ai?.chat || typeof ruck?.ai === "function");
      },
      // AI 配色与命名桥接 (对齐 uTools/ZTools 的 { content: string } 契约)
      async ai(options = {}) {
        const ruck = getRuck();
        if (ruck?.ai?.chat) {
          const rawModel = options.model || "";
          const model = rawModel.startsWith("doubao-") || !rawModel.trim() ? "" : rawModel.trim();
          const request = {
            model,
            messages: (options.messages || []).map((m) => ({
              role: m.role || "user",
              content: String(m.content || "")
            })),
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            think: options.think
          };
          const res = await invokeRuckAiChat(ruck, request);
          const content = typeof res === "string" ? res : res?.content || String(res || "");
          return { content };
        }
        if (typeof ruck?.ai === "function") {
          const res = await ruck.ai(options);
          const content = typeof res === "string" ? res : res?.content || String(res || "");
          return { content };
        }
        throw new Error("\u5F53\u524D\u73AF\u5883\u672A\u914D\u7F6E AI \u80FD\u529B\u652F\u6301");
      },
      // 文件选择对话框
      showOpenDialog(options = {}) {
        const ruck = getRuck();
        if (ruck?.window?.showOpenDialog) {
          return ruck.window.showOpenDialog(options);
        }
        if (ruck?.showOpenDialog) {
          return ruck.showOpenDialog(options);
        }
        return null;
      },
      // 生命周期与 Action 智能纠偏
      onPluginEnter(callback) {
        let enterTriggered = false;
        const wrappedCallback = (action = {}) => {
          enterTriggered = true;
          const normalized = { ...action };
          if (!normalized.code || normalized.code === "default" || normalized.code === "main" || !KNOWN_CODES.includes(normalized.code)) {
            normalized.code = "color";
          }
          if (!normalized.type) {
            normalized.type = "text";
          }
          if (normalized.payload === void 0) {
            normalized.payload = "";
          }
          console.log(`[ColorHelper] onPluginEnter dispatching code: "${normalized.code}", type: "${normalized.type}"`);
          if (typeof callback === "function") {
            callback(normalized);
          }
        };
        const ruck = getRuck();
        if (ruck?.onPluginEnter) {
          ruck.onPluginEnter(wrappedCallback);
        } else if (ruck?.on) {
          ruck.on("plugin-enter", wrappedCallback);
        }
        setTimeout(() => {
          if (!enterTriggered) {
            wrappedCallback({ code: "color", type: "text", payload: "" });
          }
        }, 80);
      },
      onPluginOut(callback) {
        const ruck = getRuck();
        if (ruck?.onPluginOut) {
          ruck.onPluginOut(callback);
        } else if (ruck?.on) {
          ruck.on("plugin-out", callback);
        }
      }
    };
    return bridge2;
  }

  // src-compat/index.js
  initDatabase();
  var bridge = createZtoolsBridge();
  window.ztools = bridge;
  window.utools = bridge;
  window.platform = bridge;
  window.services = services;
  function handleGlobalKeyDown(event) {
    if (event.key === "Escape" || event.code === "Escape") {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (activeEl.value) {
          return;
        }
      }
      if (document.querySelector(".MuiDialog-root")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        window.ztools.outPlugin();
      } catch (e) {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "ruck://action/close-plugin";
        }
      }
    }
  }
  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("keydown", handleGlobalKeyDown, true);
  console.log("[ColorHelper] Ruck compatibility layer successfully mounted.");
})();
