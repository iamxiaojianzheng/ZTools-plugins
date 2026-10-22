(() => {
  // src-compat/services.js
  function sanitizeFileName(fileName, fallback) {
    if (!fileName || typeof fileName !== "string" || !fileName.trim()) return fallback;
    const base = fileName.trim().split(/[\\/]/).pop() || fallback;
    return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || fallback;
  }
  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
    const binary = atob(parts[1]);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  function base64ToBlob(base64, mimeType = "application/octet-stream") {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  function downloadBlob(blob, targetFileName) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return targetFileName;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = targetFileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
    return targetFileName;
  }
  async function saveWithNativeDialog(data, defaultFileName, mimeType, ext) {
    const ruck = typeof window !== "undefined" ? window.ruck : null;
    if (ruck?.showSaveDialog && ruck?.fs?.writeFile) {
      try {
        const filters = ext ? [{ name: `${ext.toUpperCase()} \u6587\u4EF6`, extensions: [ext] }] : [];
        const targetPath = await ruck.showSaveDialog({
          title: "\u4FDD\u5B58\u6587\u4EF6",
          defaultPath: defaultFileName,
          filters
        });
        if (!targetPath) {
          return null;
        }
        if (data instanceof Blob) {
          const buffer = await data.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          await ruck.fs.writeFile(targetPath, bytes);
        } else if (typeof data === "string") {
          if (data.startsWith("data:")) {
            const parts = data.split(",");
            await ruck.fs.writeFile(targetPath, parts[1], { encoding: "base64" });
          } else {
            await ruck.fs.writeFile(targetPath, data);
          }
        }
        return targetPath;
      } catch (err) {
        console.warn("[Ruck showSaveDialog] \u5931\u8D25\uFF0C\u5C1D\u8BD5\u964D\u7EA7:", err);
      }
    }
    if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
      try {
        const accept = {};
        if (mimeType && ext) {
          accept[mimeType] = [`.${ext}`];
        }
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultFileName,
          types: ext ? [{ description: `${ext.toUpperCase()} \u6587\u4EF6`, accept }] : void 0
        });
        const writable = await handle.createWritable();
        if (data instanceof Blob) {
          await writable.write(data);
        } else if (typeof data === "string") {
          if (data.startsWith("data:")) {
            await writable.write(dataUrlToBlob(data));
          } else {
            await writable.write(data);
          }
        }
        await writable.close();
        return handle.name || defaultFileName;
      } catch (err) {
        if (err && (err.name === "AbortError" || String(err).includes("AbortError"))) {
          return null;
        }
        console.warn("[showSaveFilePicker] \u5931\u8D25\uFF0C\u56DE\u9000\u5230\u4E0B\u8F7D:", err);
      }
    }
    let fallbackBlob;
    if (data instanceof Blob) {
      fallbackBlob = data;
    } else if (typeof data === "string") {
      fallbackBlob = data.startsWith("data:") ? dataUrlToBlob(data) : new Blob([data], { type: mimeType || "text/plain;charset=utf-8" });
    }
    return downloadBlob(fallbackBlob, defaultFileName);
  }
  var nodeFs = null;
  var nodePath = null;
  try {
    if (typeof window !== "undefined" && typeof window.require === "function") {
      nodeFs = window.require("node:fs") || window.require("fs");
      nodePath = window.require("node:path") || window.require("path");
    }
  } catch {
    nodeFs = null;
    nodePath = null;
  }
  function createServices() {
    return {
      readFile(file) {
        if (nodeFs && typeof file === "string") {
          return nodeFs.readFileSync(file, { encoding: "utf-8" });
        }
        console.warn("[services] \u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u540C\u6B65 readFile");
        return "";
      },
      async writeTextFile(text, ext = "txt") {
        const fileName = `${Date.now()}.${ext}`;
        if (nodeFs && nodePath && window.ztools?.getPath) {
          const filePath = nodePath.join(window.ztools.getPath("downloads"), fileName);
          nodeFs.writeFileSync(filePath, text, { encoding: "utf-8" });
          return filePath;
        }
        return await saveWithNativeDialog(text, fileName, "text/plain;charset=utf-8", ext);
      },
      async writeTextFileToPath(text, filePath) {
        if (nodeFs && nodePath) {
          nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true });
          nodeFs.writeFileSync(filePath, text, { encoding: "utf-8" });
          return filePath;
        }
        const ruck = typeof window !== "undefined" ? window.ruck : null;
        if (ruck?.fs?.writeFile) {
          await ruck.fs.writeFile(filePath, text);
          return filePath;
        }
        const targetName = sanitizeFileName(filePath, `${Date.now()}.json`);
        return await saveWithNativeDialog(text, targetName, "application/json;charset=utf-8", "json");
      },
      async writeSvgFile(svgText, fileName) {
        const safe = sanitizeFileName(fileName, `${Date.now()}.svg`);
        const targetName = safe.endsWith(".svg") ? safe : `${safe}.svg`;
        if (nodeFs && nodePath && window.ztools?.getPath) {
          const filePath = nodePath.join(window.ztools.getPath("downloads"), targetName);
          nodeFs.writeFileSync(filePath, svgText, { encoding: "utf-8" });
          return filePath;
        }
        return await saveWithNativeDialog(svgText, targetName, "image/svg+xml;charset=utf-8", "svg");
      },
      async writeImageFile(base64Url, fileName) {
        const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url);
        const ext = match ? match[1] : "png";
        const safe = sanitizeFileName(fileName, `${Date.now()}.${ext}`);
        const targetName = safe.endsWith(`.${ext}`) ? safe : `${safe}.${ext}`;
        if (nodeFs && nodePath && window.ztools?.getPath && match) {
          const filePath = nodePath.join(window.ztools.getPath("downloads"), targetName);
          nodeFs.writeFileSync(filePath, base64Url.substring(match[0].length), { encoding: "base64" });
          return filePath;
        }
        return await saveWithNativeDialog(base64Url, targetName, `image/${ext}`, ext);
      },
      async writeZipFile(zipBlob, fileName) {
        const safe = sanitizeFileName(fileName, `${Date.now()}.zip`);
        const targetName = safe.endsWith(".zip") ? safe : `${safe}.zip`;
        if (nodeFs && nodePath && window.ztools?.getPath) {
          const filePath = nodePath.join(window.ztools.getPath("downloads"), targetName);
          const arrayBuffer = await zipBlob.arrayBuffer();
          nodeFs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          return filePath;
        }
        return await saveWithNativeDialog(zipBlob, targetName, "application/zip", "zip");
      },
      async writeImageFileToPath(base64Url, filePath) {
        if (nodeFs && nodePath) {
          const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url);
          if (!match) return "";
          nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true });
          nodeFs.writeFileSync(filePath, base64Url.substring(match[0].length), { encoding: "base64" });
          return filePath;
        }
        const ruck = typeof window !== "undefined" ? window.ruck : null;
        if (ruck?.fs?.writeFile) {
          const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url);
          const content = match ? base64Url.substring(match[0].length) : base64Url;
          await ruck.fs.writeFile(filePath, content, { encoding: "base64" });
          return filePath;
        }
        const targetName = sanitizeFileName(filePath, `${Date.now()}.png`);
        return await saveWithNativeDialog(base64Url, targetName, "image/png", "png");
      },
      async writeBinaryFile(base64, fileName) {
        const safe = sanitizeFileName(fileName, `${Date.now()}.bin`);
        const ext = safe.split(".").pop() || "bin";
        if (nodeFs && nodePath && window.ztools?.getPath) {
          const filePath = nodePath.join(window.ztools.getPath("downloads"), safe);
          nodeFs.writeFileSync(filePath, Buffer.from(base64, "base64"));
          return filePath;
        }
        const blob = base64ToBlob(base64);
        return await saveWithNativeDialog(blob, safe, "application/octet-stream", ext);
      },
      async writeBinaryFileToPath(base64, filePath) {
        if (nodeFs && nodePath) {
          nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true });
          nodeFs.writeFileSync(filePath, Buffer.from(base64, "base64"));
          return filePath;
        }
        const ruck = typeof window !== "undefined" ? window.ruck : null;
        if (ruck?.fs?.writeFile) {
          await ruck.fs.writeFile(filePath, base64, { encoding: "base64" });
          return filePath;
        }
        const targetName = sanitizeFileName(filePath, `${Date.now()}.bin`);
        const blob = base64ToBlob(base64);
        return await saveWithNativeDialog(blob, targetName, "application/octet-stream", "bin");
      }
    };
  }

  // src-compat/ztools.js
  function getRuck() {
    if (typeof window !== "undefined" && window.ruck) {
      return window.ruck;
    }
    return null;
  }
  function createZtoolsShim() {
    let enterCallback = null;
    let outCallback = null;
    let enterTriggered = false;
    const ruck = getRuck();
    if (ruck?.onPluginEnter) {
      try {
        ruck.onPluginEnter((action) => {
          enterTriggered = true;
          if (typeof enterCallback === "function") {
            enterCallback(action || { code: "icon-creator", type: "text" });
          }
        });
      } catch (e) {
        console.warn("[ztools-shim] \u6302\u8F7D ruck.onPluginEnter \u5931\u8D25:", e);
      }
    }
    if (ruck?.onPluginOut) {
      try {
        ruck.onPluginOut((exit) => {
          if (typeof outCallback === "function") {
            outCallback(exit);
          }
        });
      } catch (e) {
        console.warn("[ztools-shim] \u6302\u8F7D ruck.onPluginOut \u5931\u8D25:", e);
      }
    }
    const dbStorageShim = {
      getItem(key) {
        try {
          const raw = window.localStorage.getItem(`ztools_db_${key}`);
          if (raw === null) return null;
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        } catch {
          return null;
        }
      },
      setItem(key, value) {
        try {
          const serialized = typeof value === "string" ? value : JSON.stringify(value);
          window.localStorage.setItem(`ztools_db_${key}`, serialized);
        } catch (e) {
          console.warn("[ztools-shim] dbStorage setItem \u5931\u8D25:", e);
        }
      },
      removeItem(key) {
        try {
          window.localStorage.removeItem(`ztools_db_${key}`);
        } catch (e) {
          console.warn("[ztools-shim] dbStorage removeItem \u5931\u8D25:", e);
        }
      }
    };
    return {
      isRuck: true,
      onPluginEnter(callback) {
        enterCallback = callback;
        setTimeout(() => {
          if (!enterTriggered && typeof enterCallback === "function") {
            enterTriggered = true;
            enterCallback({ code: "icon-creator", type: "text", data: "" });
          }
        }, 80);
      },
      onPluginOut(callback) {
        outCallback = callback;
      },
      dbStorage: dbStorageShim,
      getPath(name) {
        if (name === "downloads") return "downloads";
        return "";
      },
      showSaveDialog(options = {}) {
        const currentRuck = getRuck();
        if (typeof currentRuck?.showSaveDialog === "function") {
          try {
            return currentRuck.showSaveDialog(options);
          } catch {
            return "";
          }
        }
        return "";
      },
      copyText(text) {
        const currentRuck = getRuck();
        if (currentRuck?.clipboard?.writeText) {
          return currentRuck.clipboard.writeText(text);
        }
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          return navigator.clipboard.writeText(text);
        }
        return Promise.resolve();
      },
      outPlugin() {
        const currentRuck = getRuck();
        if (currentRuck?.window?.outPlugin) {
          currentRuck.window.outPlugin();
        } else if (currentRuck?.window?.hideMainWindow) {
          currentRuck.window.hideMainWindow();
        }
      },
      hideMainWindow() {
        const currentRuck = getRuck();
        if (currentRuck?.window?.hideMainWindow) {
          currentRuck.window.hideMainWindow();
        }
      },
      isDark() {
        const currentRuck = getRuck();
        if (typeof currentRuck?.theme?.isDark === "function") {
          return currentRuck.theme.isDark();
        }
        if (typeof window !== "undefined" && window.matchMedia) {
          return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
      }
    };
  }

  // src-compat/index.js
  if (typeof window !== "undefined") {
    if (!window.services) {
      window.services = createServices();
    }
    if (!window.ztools) {
      const shim = createZtoolsShim();
      window.ztools = shim;
      if (!window.utools) {
        window.utools = shim;
      }
    }
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          const active = document.activeElement;
          if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
            if ("value" in active && active.value) {
              return;
            }
          }
          if (window.ztools?.outPlugin) {
            window.ztools.outPlugin();
          }
        }
      },
      true
    );
    console.log("\u2705 [icon-creator] Ruck / Webview compatibility shim initialized.");
  }
})();
