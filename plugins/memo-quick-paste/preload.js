(() => {
  // src-compat/md5.js
  function safeAdd(x, y) {
    const lsw = (x & 65535) + (y & 65535);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 65535;
  }
  function bitRotateLeft(num, cnt) {
    return num << cnt | num >>> 32 - cnt;
  }
  function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn(b & c | ~b & d, a, b, x, s, t);
  }
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn(b & d | c & ~d, a, b, x, s, t);
  }
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function binlMD5(x, len) {
    x[len >> 5] |= 128 << len % 32;
    x[(len + 64 >>> 9 << 4) + 14] = len;
    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;
      a = md5ff(a, b, c, d, x[i], 7, -680876936);
      d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i], 11, -358537222);
      c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i], 6, -198630844);
      d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }
  function rhex(num) {
    const hexChars = "0123456789abcdef";
    let str = "";
    for (let j = 0; j <= 3; j++) {
      str += hexChars.charAt(num >> j * 8 + 4 & 15) + hexChars.charAt(num >> j * 8 & 15);
    }
    return str;
  }
  function md5(input) {
    let bytes;
    if (typeof input === "string") {
      const encoder = new TextEncoder();
      bytes = encoder.encode(input);
    } else if (input instanceof Uint8Array) {
      bytes = input;
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else {
      bytes = new TextEncoder().encode(String(input));
    }
    const words = [];
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      words[i >> 2] |= bytes[i] << i % 4 * 8;
    }
    const result = binlMD5(words, len * 8);
    return rhex(result[0]) + rhex(result[1]) + rhex(result[2]) + rhex(result[3]);
  }

  // src-compat/services.js
  var fileCache = /* @__PURE__ */ new Map();
  var services = {
    md5Format(input) {
      if (input === null || input === void 0) return "";
      return md5(input);
    },
    pathToFileURL(filePath) {
      if (!filePath) return "";
      if (filePath.startsWith("file://") || filePath.startsWith("data:") || filePath.startsWith("blob:")) {
        return filePath;
      }
      const normalized = filePath.replace(/\\/g, "/");
      return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
    },
    getImageData(input) {
      if (!input || typeof input !== "string") {
        throw new Error("\u56FE\u7247\u53C2\u6570\u9519\u8BEF");
      }
      if (/^data:(image\/[a-zA-Z0-9.+_-]+)(?:;[a-zA-Z0-9=_-]+)*;base64,(.+)$/i.test(input)) {
        const contentType = RegExp.$1.toLowerCase();
        const b64Data = RegExp.$2;
        const binaryString = atob(b64Data);
        const len = binaryString.length;
        if (len > 10485760) {
          throw new Error("\u56FE\u7247\u5927\u5C0F\u8D85\u8FC7 10 M");
        }
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const digest2 = md5(bytes);
        return { digest: digest2, data: bytes, contentType };
      }
      if (fileCache.has(input)) {
        return fileCache.get(input);
      }
      let cleanPath = input;
      if (cleanPath.startsWith("file:///")) {
        cleanPath = decodeURIComponent(cleanPath.substring(8));
      } else if (cleanPath.startsWith("file://")) {
        cleanPath = decodeURIComponent(cleanPath.substring(7));
      }
      const extMatch = cleanPath.match(/\.(png|jpg|jpeg)$/i);
      if (!extMatch) {
        throw new Error("\u53EA\u652F\u6301 png\u3001jpg \u56FE\u7247\u6587\u4EF6");
      }
      const digest = md5(cleanPath);
      return {
        digest,
        data: new Uint8Array(),
        contentType: `image/${extMatch[1].toLowerCase()}`
      };
    },
    saveImgToFileByArrayBuffer(arrayBuffer, contentType) {
      try {
        const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
        const digest = md5(bytes);
        const ext = (contentType || "image/png").replace("image/", ".").toLowerCase();
        const fileName = `${digest}${ext}`;
        if (window.ruck && window.ruck.fs && window.ruck.os) {
          const tempPath = `ruck.collection/${fileName}`;
          window.ruck.fs.writeFile(tempPath, bytes).catch(() => {
          });
          return tempPath;
        }
        const blob = new Blob([bytes], { type: contentType || "image/png" });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error("[services] saveImgToFileByArrayBuffer failed:", err);
        return null;
      }
    }
  };

  // src-compat/database.js
  var DB_NAME = "ruck_memo_quick_paste_db";
  var DB_VERSION = 1;
  var STORE_DOCS = "docs";
  var STORE_ATTACHMENTS = "attachments";
  var docsMap = /* @__PURE__ */ new Map();
  var attachmentsMap = /* @__PURE__ */ new Map();
  var dbInstance = null;
  var initPromise = null;
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
  loadFromLocalStorage();
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        console.warn("[MemoDB] indexedDB is not supported in current environment");
        return resolve(null);
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db2 = event.target.result;
        if (!db2.objectStoreNames.contains(STORE_DOCS)) {
          db2.createObjectStore(STORE_DOCS, { keyPath: "_id" });
        }
        if (!db2.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          db2.createObjectStore(STORE_ATTACHMENTS, { keyPath: "id" });
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
                docsMap.set(doc._id, doc);
              }
              resolve();
            };
            req.onerror = () => resolve();
          });
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
      initPromise = Promise.race([
        loader,
        new Promise((resolve) => setTimeout(resolve, 200))
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
      }
    }
  };

  // src-compat/image-picker.js
  function findFormInstance() {
    if (typeof document === "undefined") return null;
    const roots = [
      document.querySelector(".form-body"),
      document.querySelector(".form-content-box"),
      document.querySelector(".form-content-textarea")
    ].filter(Boolean);
    for (const root of roots) {
      const fiberKey = Object.keys(root).find(
        (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
      );
      if (!fiberKey) continue;
      let fiber = root[fiberKey];
      while (fiber) {
        if (fiber.stateNode && typeof fiber.stateNode.setState === "function" && fiber.stateNode.handleInsertImage) {
          return fiber.stateNode;
        }
        fiber = fiber.return;
      }
    }
    return null;
  }
  function applyImageToForm(dataUrl) {
    if (!dataUrl) return false;
    const form = findFormInstance();
    if (!form) {
      console.warn("[ImagePicker] Active form instance not found via React Fiber.");
      return false;
    }
    const state = form.state || {};
    const content = state.content || "";
    const remark = state.remark || "";
    if (content) {
      const formattedContent = content.replace(/\r?\n/g, " ").trim();
      const newRemark = remark ? `${remark} ${formattedContent}` : formattedContent;
      form.setState({
        image: dataUrl,
        content: "",
        remark: newRemark
      });
    } else {
      form.setState({ image: dataUrl });
    }
    console.log("[ImagePicker] Successfully applied image to form state.");
    return true;
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("\u672A\u63D0\u4F9B\u6587\u4EF6\u5BF9\u8C61"));
      if (file.type && !file.type.startsWith("image/")) {
        return reject(new Error("\u9009\u4E2D\u7684\u6587\u4EF6\u4E0D\u662F\u56FE\u7247\u683C\u5F0F"));
      }
      if (file.size > 10 * 1024 * 1024) {
        return reject(new Error("\u56FE\u7247\u5927\u5C0F\u4E0D\u80FD\u8D85\u8FC7 10 M"));
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }
  var fileInput = null;
  function restoreMainWindowFocus() {
    try {
      const ruck = typeof window !== "undefined" && window.ruck ? window.ruck : null;
      if (ruck?.window?.showMainWindow) {
        ruck.window.showMainWindow();
      } else if (ruck?.showMainWindow) {
        ruck.showMainWindow();
      } else if (typeof window !== "undefined" && window.ztools?.showMainWindow) {
        window.ztools.showMainWindow();
      }
      if (typeof window !== "undefined") {
        window.focus();
        setTimeout(() => {
          const remarkInput = document.querySelector('input[placeholder="\u5907\u6CE8\u8BF4\u660E"]') || document.querySelector("textarea") || document.querySelector(".form-body input");
          if (remarkInput && typeof remarkInput.focus === "function") {
            remarkInput.focus();
          }
        }, 50);
      }
    } catch (e) {
      console.warn("[ImagePicker] restoreMainWindowFocus error:", e);
    }
  }
  function pickImageFile() {
    return new Promise((resolve) => {
      if (typeof document === "undefined") return resolve(null);
      if (!fileInput) {
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
      }
      let finished = false;
      const finalize = (result) => {
        if (finished) return;
        finished = true;
        restoreMainWindowFocus();
        resolve(result);
      };
      fileInput.value = "";
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (file) {
          try {
            const dataUrl = await fileToDataUrl(file);
            applyImageToForm(dataUrl);
            finalize([dataUrl]);
          } catch (err) {
            console.error("[ImagePicker] fileToDataUrl failed:", err);
            finalize(null);
          }
        } else {
          finalize(null);
        }
      };
      if ("oncancel" in fileInput) {
        fileInput.oncancel = () => finalize(null);
      }
      const onWindowFocus = () => {
        window.removeEventListener("focus", onWindowFocus);
        setTimeout(() => {
          if (!finished) {
            finalize(null);
          }
        }, 100);
      };
      if (typeof window !== "undefined") {
        window.addEventListener("focus", onWindowFocus, { once: true });
      }
      fileInput.click();
    });
  }
  function isImageDialogOptions(options = {}) {
    const filters = options.filters || [];
    return filters.some(
      (f) => f.name === "image" || Array.isArray(f.extensions) && f.extensions.some((ext) => ["png", "jpg", "jpeg", "webp", "gif"].includes(String(ext).toLowerCase()))
    );
  }
  function handleShowOpenDialog(options = {}) {
    if (isImageDialogOptions(options)) {
      pickImageFile();
      return null;
    }
    return void 0;
  }
  function setupImageEnhancements() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.addEventListener(
      "paste",
      async (event) => {
        const items = event.clipboardData?.items;
        if (!items || items.length === 0) return;
        for (const item of items) {
          if (item.type && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              const form = findFormInstance();
              if (form) {
                event.preventDefault();
                event.stopPropagation();
                try {
                  const dataUrl = await fileToDataUrl(file);
                  applyImageToForm(dataUrl);
                  console.log("[ImagePicker] Clipboard image pasted to form.");
                } catch (err) {
                  console.error("[ImagePicker] Clipboard image paste failed:", err);
                }
                return;
              }
            }
          }
        }
      },
      true
    );
    document.addEventListener("dragover", (event) => {
      const form = findFormInstance();
      if (form) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
      }
    });
    document.addEventListener("drop", async (event) => {
      const form = findFormInstance();
      if (!form) return;
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type && file.type.startsWith("image/")) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const dataUrl = await fileToDataUrl(file);
            applyImageToForm(dataUrl);
            console.log("[ImagePicker] Dropped image added to form.");
          } catch (err) {
            console.error("[ImagePicker] Dropped image failed:", err);
          }
        }
      }
    });
  }

  // src-compat/ztools.js
  var isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  var currentSubInputCallback = null;
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  function createZtoolsBridge() {
    const bridge = {
      db,
      // 平台识别
      isMacOs() {
        return isMac;
      },
      // 路径管理
      getPath(name) {
        if (name === "temp") {
          return "temp";
        }
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
        return false;
      },
      copyImage(imageData) {
        const ruck = getRuck();
        if (ruck?.clipboard?.writeImage) {
          ruck.clipboard.writeImage(imageData);
          return true;
        }
        return false;
      },
      // 快捷模拟按键粘贴
      simulateKeyboardTap(key, modifier) {
        const ruck = getRuck();
        const lowerKey = String(key || "").toLowerCase();
        if (lowerKey === "v") {
          if (ruck?.clipboard?.paste) {
            ruck.clipboard.paste("ctrl_v");
          }
        }
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
      showOpenDialog(options = {}) {
        const handled = handleShowOpenDialog(options);
        if (handled !== void 0) {
          return handled;
        }
        const ruck = getRuck();
        if (ruck?.window?.showOpenDialog) {
          return ruck.window.showOpenDialog(options);
        }
        if (ruck?.showOpenDialog) {
          return ruck.showOpenDialog(options);
        }
        return null;
      },
      startDrag(filePath) {
        const ruck = getRuck();
        if (ruck?.window?.startDrag) {
          return ruck.window.startDrag(filePath);
        }
        if (ruck?.startDrag) {
          return ruck.startDrag(filePath);
        }
      },
      // 子输入框
      setSubInput(onChange, placeholder = "", isFocus = true) {
        currentSubInputCallback = onChange;
        const wrappedOnChange = (val) => {
          if (typeof onChange === "function") {
            const text = typeof val === "object" && val !== null ? val.text || "" : String(val || "");
            onChange({ text });
          }
        };
        const ruck = getRuck();
        if (ruck?.ui?.setSubInput) {
          return ruck.ui.setSubInput(wrappedOnChange, placeholder, isFocus);
        }
        if (ruck?.setSubInput) {
          return ruck.setSubInput(wrappedOnChange, placeholder, isFocus);
        }
      },
      removeSubInput() {
        currentSubInputCallback = null;
        const ruck = getRuck();
        if (ruck?.ui?.removeSubInput) {
          return ruck.ui.removeSubInput();
        }
        if (ruck?.removeSubInput) {
          return ruck.removeSubInput();
        }
      },
      setSubInputValue(value) {
        const text = typeof value === "string" ? value : String(value || "");
        const ruck = getRuck();
        if (ruck?.ui?.setSubInputValue) {
          ruck.ui.setSubInputValue(text);
        } else if (ruck?.setSubInputValue) {
          ruck.setSubInputValue(text);
        }
        if (typeof currentSubInputCallback === "function") {
          try {
            currentSubInputCallback({ text });
          } catch (e) {
            console.error("[ztools] subInputCallback error on setSubInputValue:", e);
          }
        }
      },
      subInputFocus() {
        const ruck = getRuck();
        if (ruck?.ui?.subInputFocus) {
          return ruck.ui.subInputFocus();
        }
        if (ruck?.subInputFocus) {
          return ruck.subInputFocus();
        }
      },
      subInputBlur() {
        const ruck = getRuck();
        if (ruck?.ui?.subInputBlur) {
          return ruck.ui.subInputBlur();
        }
        if (ruck?.subInputBlur) {
          return ruck.subInputBlur();
        }
      },
      // 生命周期回调
      onPluginEnter(callback) {
        let enterTriggered = false;
        const wrappedCallback = (action = {}) => {
          enterTriggered = true;
          const normalized = { ...action };
          const existingTags = bridge.getFeatures().map((f) => f.code);
          if (!normalized.code || normalized.code === "default" || normalized.code === "main" || !["collection", "record", "search"].includes(normalized.code) && !existingTags.includes(normalized.code)) {
            normalized.code = "collection";
          }
          if (!normalized.type) {
            normalized.type = "text";
          }
          console.log("[ztools] onPluginEnter executed with:", normalized);
          if (typeof callback === "function") {
            try {
              callback(normalized);
            } catch (e) {
              console.error("[ztools] callback in onPluginEnter failed:", e);
            }
          }
        };
        const ruck = getRuck();
        if (ruck?.onPluginEnter) {
          ruck.onPluginEnter(wrappedCallback);
        } else if (ruck?.lifecycle?.onPluginEnter) {
          ruck.lifecycle.onPluginEnter(wrappedCallback);
        }
        setTimeout(() => {
          if (!enterTriggered) {
            console.log("[ztools] Auto-fallback triggering onPluginEnter for collection view");
            wrappedCallback({ code: "collection", type: "text" });
          }
        }, 80);
      },
      onPluginOut(callback) {
        const ruck = getRuck();
        if (ruck?.onPluginOut) {
          ruck.onPluginOut(callback);
        } else if (ruck?.lifecycle?.onPluginOut) {
          ruck.lifecycle.onPluginOut(callback);
        }
      },
      onMainPush(callback, onSelect) {
        const ruck = getRuck();
        if (ruck?.onMainPush) {
          ruck.onMainPush(callback, onSelect);
        } else if (ruck?.lifecycle?.onMainPush) {
          ruck.lifecycle.onMainPush(callback, onSelect);
        }
      },
      onDbPull(callback) {
        console.log("[MemoQuickPaste] onDbPull registered");
      },
      // 页面搜索
      findInPage(text, options) {
        const ruck = getRuck();
        if (ruck?.window?.findInPage) {
          return ruck.window.findInPage(text, options);
        }
      },
      stopFindInPage(action) {
        const ruck = getRuck();
        if (ruck?.window?.stopFindInPage) {
          return ruck.window.stopFindInPage(action);
        }
      },
      // 动态 Feature 管理 (备忘快贴标签 Tags 存储系统)
      getFeatures() {
        try {
          const raw = localStorage.getItem("ruck_memo_features");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) return list;
          }
        } catch (e) {
          console.error("[ztools] getFeatures parse error:", e);
        }
        return [];
      },
      setFeature(feature) {
        if (!feature || !feature.code) return false;
        try {
          const list = this.getFeatures();
          const idx = list.findIndex((item) => item.code === feature.code);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...feature };
          } else {
            list.push(feature);
          }
          localStorage.setItem("ruck_memo_features", JSON.stringify(list));
          return true;
        } catch (e) {
          console.error("[ztools] setFeature error:", e);
          return false;
        }
      },
      removeFeature(code) {
        if (!code) return false;
        try {
          const list = this.getFeatures();
          const filtered = list.filter((item) => item.code !== code);
          localStorage.setItem("ruck_memo_features", JSON.stringify(filtered));
          return true;
        } catch (e) {
          console.error("[ztools] removeFeature error:", e);
          return false;
        }
      },
      // 系统文件与路径打开
      shellOpenPath(filePath) {
        const ruck = getRuck();
        if (ruck?.shell?.openPath) {
          return ruck.shell.openPath(filePath);
        }
        if (ruck?.shell?.open) {
          return ruck.shell.open(filePath);
        }
        return false;
      },
      // 屏幕截图回退增强
      screenCapture(callback) {
        const ruck = getRuck();
        if (ruck?.notification?.message) {
          ruck.notification.message({
            content: "\u8BF7\u4F7F\u7528\u7CFB\u7EDF\u5FEB\u6377\u952E\u622A\u56FE\u540E\u5728\u7A97\u53E3\u4E2D\u76F4\u63A5\u7C98\u8D34\u56FE\u7247",
            type: "info"
          });
        }
        if (ruck?.clipboard?.readImage) {
          setTimeout(async () => {
            try {
              const imgB64 = await ruck.clipboard.readImage();
              if (imgB64 && typeof callback === "function") {
                callback(imgB64);
              }
            } catch (e) {
            }
          }, 1e3);
        }
      }
    };
    return bridge;
  }

  // src-compat/index.js
  initDatabase();
  setupImageEnhancements();
  var isMac2 = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  window.IS_APP_VERSION4 = true;
  window.isMacOs = isMac2;
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
  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("keydown", handleGlobalKeyDown, true);
  console.log("[MemoQuickPaste] Ruck compatibility layer successfully mounted.");
})();
