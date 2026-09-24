(() => {
  // src-compat/services.js
  function getRuck() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var imageReg = /\.(png|jpeg|jpg|webp)$/i;
  var excludeDirReg = /^(\.|node_modules)/i;
  function getSep() {
    const ruck = getRuck();
    if (ruck?.path?.sep) return ruck.path.sep;
    const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
    return isWin ? "\\" : "/";
  }
  function joinPath(...parts) {
    const ruck = getRuck();
    if (ruck?.path?.join && typeof ruck.path.join === "function") {
      return ruck.path.join(...parts);
    }
    const sep = getSep();
    return parts.filter(Boolean).join(sep).replace(/[\\/]+/g, sep);
  }
  function getDirname(p) {
    const ruck = getRuck();
    if (ruck?.path?.dirname && typeof ruck.path.dirname === "function") {
      return ruck.path.dirname(p);
    }
    const sep = getSep();
    const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    return idx > 0 ? p.substring(0, idx) : p;
  }
  function getBasename(p) {
    const ruck = getRuck();
    if (ruck?.path?.basename && typeof ruck.path.basename === "function") {
      return ruck.path.basename(p);
    }
    const sep = getSep();
    const normalized = p.replace(/[\\/]+$/, "");
    const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
    return idx >= 0 ? normalized.substring(idx + 1) : normalized;
  }
  async function getTempPath() {
    const ruck = getRuck();
    let baseTemp = "";
    if (ruck?.path?.tempDir && typeof ruck.path.tempDir === "function") {
      try {
        baseTemp = await ruck.path.tempDir();
      } catch (e) {
        console.warn("[TinyPNG] ruck.path.tempDir \u83B7\u53D6\u5931\u8D25:", e);
      }
    }
    if (!baseTemp && ruck?.os?.tmpdir && typeof ruck.os.tmpdir === "function") {
      try {
        baseTemp = await ruck.os.tmpdir();
      } catch (e) {
        console.warn("[TinyPNG] ruck.os.tmpdir \u83B7\u53D6\u5931\u8D25:", e);
      }
    }
    if (!baseTemp) {
      const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
      baseTemp = isWin ? "C:\\Windows\\Temp" : "/tmp";
    }
    return joinPath(baseTemp, "ruck.tinypng");
  }
  async function findImages(rootPath) {
    const ruck = getRuck();
    if (!ruck?.fs) return [];
    const base = getBasename(rootPath);
    if (excludeDirReg.test(base)) return [];
    try {
      const stat = await ruck.fs.stat(rootPath);
      if (!stat) return [];
      if (stat.isFile) {
        return imageReg.test(rootPath) ? [rootPath] : [];
      }
      if (stat.isDirectory) {
        const files = [];
        const entries = await ruck.fs.readDir(rootPath);
        for (const entry of entries) {
          const entryName = entry.name;
          if (excludeDirReg.test(entryName)) continue;
          const childPath = entry.path || joinPath(rootPath, entryName);
          if (entry.isDirectory) {
            const subFiles = await findImages(childPath);
            files.push(...subFiles);
          } else if (entry.isFile && imageReg.test(childPath)) {
            files.push(childPath);
          }
        }
        return files;
      }
    } catch (err) {
      console.warn(`[TinyPNG] \u68C0\u7D22\u76EE\u5F55\u5F02\u5E38: ${rootPath}`, err);
    }
    return [];
  }
  var pendingCompressionConfig = null;
  var vueAppReady = false;
  if (typeof window !== "undefined") {
    window.addEventListener("tinyping-compression-ready", () => {
      vueAppReady = true;
      if (pendingCompressionConfig) {
        console.log("[TinyPNG] Vue App \u5C31\u7EEA\uFF0C\u56DE\u653E\u6682\u5B58\u7684\u538B\u7F29\u4EFB\u52A1");
        window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: pendingCompressionConfig }));
        pendingCompressionConfig = null;
      }
    });
  }
  var services = {
    /**
     * 响应插件进入动作，解析图片路径并派发压缩任务
     */
    async handlePluginEnter({ code, type, payload }) {
      const ruck = getRuck();
      try {
        console.log("[TinyPNG] handlePluginEnter \u6536\u5230\u53C2\u6570:", { code, type, payload });
        const tempRoot = await getTempPath();
        if (ruck?.fs?.exists && ruck?.fs?.createDir) {
          const exists = await ruck.fs.exists(tempRoot);
          if (!exists) {
            await ruck.fs.createDir(tempRoot, true);
          }
        }
        const date = Date.now();
        const config = {
          date,
          images: [],
          tempdir: joinPath(tempRoot, String(date))
        };
        const paths = [];
        if (["files", "drop"].includes(type)) {
          const items = Array.isArray(payload) ? payload : [];
          paths.push(...items.filter((it) => it && it.path).map((it) => it.path));
        }
        console.log("[TinyPNG] \u89E3\u6790\u5230\u5F85\u5904\u7406\u8DEF\u5F84:", paths);
        const sep = getSep();
        for (const it of paths) {
          if (!it) continue;
          const base = getBasename(it);
          if (excludeDirReg.test(base)) continue;
          let stat = null;
          try {
            stat = await ruck.fs.stat(it);
          } catch {
            continue;
          }
          const images = [];
          let basedir = "";
          if (stat?.isFile) {
            if (!imageReg.test(it)) continue;
            images.push(it);
            basedir = getDirname(it);
          } else if (stat?.isDirectory) {
            basedir = getDirname(it);
            const found = await findImages(it);
            images.push(...found);
          }
          for (const img of images) {
            let name = img;
            if (basedir && name.startsWith(basedir)) {
              name = name.substring(basedir.length);
            }
            name = name.replace(/^[\\/]+/, "");
            const nameExist = config.images.some((item) => item.name === name);
            if (nameExist) {
              window.ztools?.showNotification?.(`\u6B64\u6587\u4EF6\u540D\u5DF2\u88AB\u5360\u7528\uFF1A"${name}" \u8DF3\u8FC7\u5904\u7406`);
              continue;
            }
            let imgStat = { size: 0 };
            try {
              imgStat = await ruck.fs.stat(img);
            } catch (e) {
              console.warn("[TinyPNG] \u8BFB\u53D6\u6587\u4EF6\u5143\u4FE1\u606F\u5931\u8D25:", img, e);
            }
            config.images.push({
              name,
              path: img,
              size: imgStat.size || 0,
              compress: {
                path: joinPath(config.tempdir, name),
                progress: 0
              }
            });
          }
        }
        if (config.images.length === 0) {
          console.log("[TinyPNG] \u672A\u627E\u5230\u6709\u6548\u7684\u5F85\u538B\u7F29\u56FE\u7247");
          return;
        }
        console.log(`[TinyPNG] \u6210\u529F\u5339\u914D\u5230 ${config.images.length} \u5F20\u56FE\u7247\uFF0C\u51C6\u5907\u6D3E\u53D1\u538B\u7F29\u4E8B\u4EF6`);
        if (vueAppReady) {
          window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: config }));
        } else {
          pendingCompressionConfig = config;
          setTimeout(() => {
            if (pendingCompressionConfig) {
              window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: pendingCompressionConfig }));
              pendingCompressionConfig = null;
            }
          }, 300);
        }
      } catch (error) {
        console.error("[TinyPNG] handlePluginEnter \u5F02\u5E38:", error);
        window.ztools?.showNotification?.(String(error));
      }
    },
    /**
     * 读取本地二进制文件
     * @param {string} p
     * @returns {Promise<Uint8Array>}
     */
    async readFile(p) {
      const ruck = getRuck();
      if (ruck?.fs?.readFile) {
        const res = await ruck.fs.readFile(p, { encoding: "binary" });
        if (res instanceof Uint8Array) return res;
        if (typeof res === "string") {
          const binaryString = atob(res);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        }
        return new Uint8Array(res);
      }
      throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u76F4\u63A5\u8BFB\u53D6\u672C\u5730\u6587\u4EF6");
    },
    /**
     * 写入本地二进制文件
     * @param {string} p 目标路径
     * @param {ArrayBuffer | Uint8Array} data 数据
     */
    async writeFile(p, data) {
      const ruck = getRuck();
      if (!ruck?.fs) throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u672C\u5730\u6587\u4EF6\u5199\u5165");
      const dir = getDirname(p);
      const exists = await ruck.fs.exists(dir);
      if (!exists) {
        await ruck.fs.createDir(dir, true);
      }
      return await ruck.fs.writeFile(p, data, { encoding: "binary" });
    },
    /**
     * 读取目录下全部子文件完整路径
     * @param {string} p
     * @returns {Promise<string[]>}
     */
    async readDir(p) {
      const ruck = getRuck();
      if (!ruck?.fs?.readDir) return [];
      const entries = await ruck.fs.readDir(p);
      return entries.map((it) => it.path || joinPath(p, it.name));
    },
    /**
     * 批量替换覆盖文件
     * @param {[string, string][]} files [源路径, 目标覆盖路径]
     */
    async replaceFiles(files) {
      const ruck = getRuck();
      if (!ruck?.fs?.copyFile) {
        throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u6587\u4EF6\u8986\u76D6\u64CD\u4F5C");
      }
      for (const [from, to] of files) {
        await ruck.fs.copyFile(from, to);
      }
    }
  };
  async function cleanupTempPath(exit) {
    if (!exit) return;
    const ruck = getRuck();
    if (!ruck?.fs?.remove) return;
    try {
      const tempRoot = await getTempPath();
      const exists = await ruck.fs.exists(tempRoot);
      if (exists) {
        await ruck.fs.remove(tempRoot, true);
        console.log("[TinyPNG] \u6210\u529F\u6E05\u7406\u4E34\u65F6\u7F13\u5B58\u76EE\u5F55:", tempRoot);
      }
    } catch (e) {
      console.warn("[TinyPNG] \u6E05\u7406\u4E34\u65F6\u76EE\u5F55\u5931\u8D25:", e);
    }
  }

  // src-compat/ztools.js
  function getRuck2() {
    return typeof window !== "undefined" && window.ruck ? window.ruck : null;
  }
  var cachedTempDir = "";
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
    if (!rawCode || rawCode === "default" || rawCode === "main" || rawCode === "@ruck-plugins/tinypng") {
      normalized.code = "tinypng";
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
      return;
    }
    lastActionFingerprint = fingerprint;
    lastActionTime = now;
    lastAction = normalized;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    console.log(`[TinyPNG] dispatchPluginEnter: code="${normalized.code}", type="${normalized.type}"`);
    for (const listener of enterListeners) {
      try {
        listener(normalized);
      } catch (err) {
        console.error("[TinyPNG] Error in onPluginEnter listener:", err);
      }
    }
  }
  function dispatchPluginOut(processExit = false) {
    console.log("[TinyPNG] dispatchPluginOut: processExit =", processExit);
    for (const listener of outListeners) {
      try {
        listener(processExit);
      } catch (err) {
        console.error("[TinyPNG] Error in onPluginOut listener:", err);
      }
    }
  }
  function setupHostEventListeners() {
    if (hostEventsInstalled) return;
    hostEventsInstalled = true;
    const ruck = getRuck2();
    if (ruck?.path?.tempDir && typeof ruck.path.tempDir === "function") {
      ruck.path.tempDir().then((d) => {
        if (d) cachedTempDir = d;
      }).catch(() => {
      });
    } else if (ruck?.os?.tmpdir && typeof ruck.os.tmpdir === "function") {
      ruck.os.tmpdir().then((d) => {
        if (d) cachedTempDir = d;
      }).catch(() => {
      });
    }
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
    fallbackTimer = setTimeout(() => {
      if (!lastAction && enterListeners.size > 0) {
        console.log("[TinyPNG] 300ms auto-fallback triggering default onPluginEnter");
        dispatchPluginEnter({ code: "tinypng", type: "text", payload: "" });
      }
    }, 300);
  }
  function createZtoolsBridge() {
    setupHostEventListeners();
    const bridge = {
      /**
       * 获取指定目录类型的本地路径
       * @param {'temp' | 'home' | 'appData' | 'userData'} name
       */
      getPath(name) {
        if (name === "temp") {
          if (cachedTempDir) return cachedTempDir;
          const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
          return isWin ? "C:\\Windows\\Temp" : "/tmp";
        }
        return "";
      },
      /**
       * 写入剪贴板文本
       */
      copyText(text) {
        const ruck = getRuck2();
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
       * 将文件复制到剪贴板中（支持单文件或文件列表）
       * @param {string | string[]} files
       */
      copyFile(files) {
        if (!files) return false;
        const fileList = Array.isArray(files) ? files : [files];
        if (fileList.length === 0) return false;
        const ruck = getRuck2();
        if (ruck?.clipboard?.writeFiles && typeof ruck.clipboard.writeFiles === "function") {
          try {
            ruck.clipboard.writeFiles(fileList).catch((err) => {
              console.error("[ZTools Bridge] \u5199\u5165\u526A\u8D34\u677F\u6587\u4EF6\u5931\u8D25:", err);
            });
            return true;
          } catch (e) {
            console.error("[ZTools Bridge] copyFile \u629B\u51FA\u5F02\u5E38:", e);
            return false;
          }
        }
        return false;
      },
      /**
       * 从拖拽或输入的 File 对象获取绝对路径
       */
      getPathForFile(file) {
        if (!file) return "";
        if (typeof file === "string") return file;
        if (file.path) return file.path;
        if (file.webkitRelativePath) return file.webkitRelativePath;
        return file.name || "";
      },
      /**
       * 弹出通知/轻提示
       */
      showNotification(body) {
        const ruck = getRuck2();
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
          new Notification("TinyPNG", { body: content });
        }
      },
      /**
       * 动态设置窗口高度
       */
      setExpendHeight(height = 600) {
        const ruck = getRuck2();
        if (ruck?.window?.setExpendHeight && typeof ruck.window.setExpendHeight === "function") {
          ruck.window.setExpendHeight(height);
        } else if (ruck?.setExpendHeight && typeof ruck.setExpendHeight === "function") {
          ruck.setExpendHeight(height);
        }
      },
      /**
       * 退出或切出插件
       */
      outPlugin() {
        const ruck = getRuck2();
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
  if (typeof window !== "undefined" && window.__RUCK_TINYPNG_COMPAT_MOUNTED__) {
    console.log("[TinyPNG] Ruck compat already mounted, skipping duplicate execution.");
  } else {
    let handleGlobalKeyDown = function(event) {
      if (event.key === "Escape" || event.code === "Escape") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          if (activeEl.value) {
            return;
          }
        }
        if (document.querySelector("[role='dialog'], .el-overlay, .el-message-box")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        try {
          window.ztools?.outPlugin?.();
        } catch {
          if (typeof window !== "undefined" && window.location) {
            window.location.href = "ruck://action/close-plugin";
          }
        }
      }
    };
    if (typeof window !== "undefined") {
      window.__RUCK_TINYPNG_COMPAT_MOUNTED__ = true;
    }
    const bridge = createZtoolsBridge();
    window.ztools = bridge;
    window.utools = bridge;
    window.services = services;
    bridge.onPluginEnter((action) => {
      services.handlePluginEnter(action);
    });
    bridge.onPluginOut((exit) => {
      cleanupTempPath(exit);
    });
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    document.addEventListener("keydown", handleGlobalKeyDown, true);
    console.log("[TinyPNG] Ruck compatibility layer successfully mounted.");
  }
})();
