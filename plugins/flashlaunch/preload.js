/**
 * 闪启 FlashLaunch —— preload
 * 把文件系统 / 快捷方式 / 启动 / 抓网页信息 / 备份收敛为 window.sl。
 *
 * 启动不经过 shell 字符串拼接：普通启动走 spawn，Windows 管理员启动走
 * PowerShell -EncodedCommand，参数以单引号字面量传入，避免命令注入。
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const electron = require("electron");
const { shell } = electron;
const { spawn, execFileSync } = require("child_process");
const { splitArgs } = require("./utils/args");

function getHost() {
  return window.ztools || {};
}

let webUtils = null;
try {
  webUtils = electron.webUtils || null;
} catch (e) {
  /* 旧版 Electron 没有 webUtils */
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const IMAGE_EXTS = ["png", "jpg", "jpeg", "bmp", "ico", "gif", "webp", "svg"];
const URL_RE = /^(ftp|https?):\/\/[^ "]+$/i;

function getPlatform() {
  if (getHost().isWindows()) return "win32";
  if (getHost().isMacOS()) return "darwin";
  return "linux";
}

function dataUrlFromBuffer(buf, ext) {
  const mime =
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      ico: "image/x-icon",
      svg: "image/svg+xml",
    }[String(ext).toLowerCase()] || "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function iconFor(filePath) {
  if (!filePath) return "";
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) return dataUrlFromBuffer(fs.readFileSync(filePath), ext);
    return getHost().getFileIcon(filePath) || "";
  } catch (e) {
    return "";
  }
}

/** 解析 .lnk / .desktop，失败时退回原路径 */
function readShortcut(filePath) {
  const result = { target: filePath, args: "" };
  if (!filePath) return result;
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".lnk") {
    try {
      const link = shell.readShortcutLink(filePath);
      if (link && link.target) {
        result.target = link.target;
        result.args = link.args || "";
      }
    } catch (e) {
      try {
        // 通过环境变量传路径，避免把文件路径拼进 PowerShell 脚本
        const script = "(New-Object -ComObject WScript.Shell).CreateShortcut($env:FL_SHORTCUT).TargetPath";
        const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
          env: { ...process.env, FL_SHORTCUT: filePath },
          windowsHide: true,
          timeout: 4000,
        })
          .toString()
          .trim();
        if (out) result.target = out;
      } catch (e2) {
        /* 保留原路径 */
      }
    }
  }

  if (ext === ".desktop") {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const line = /^Exec=(.*)$/m.exec(text);
      if (line && line[1]) {
        const cmd = line[1].split("%")[0].trim();
        const quoted = cmd.match(/^"([^"]+)"/) || cmd.match(/^'([^']+)'/);
        result.target = quoted ? quoted[1] : cmd.split(" ")[0];
        result.args = quoted ? cmd.slice(quoted[0].length).trim() : cmd.slice(result.target.length).trim();
      }
    } catch (e) {
      /* 忽略 */
    }
  }
  return result;
}

/** 路径 -> 卡片数据（拖拽 / 文件选择共用） */
function describePath(filePath, hintType) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    return null;
  }

  const parsed = path.parse(filePath);
  const isDir = stat.isDirectory();
  const shortcut = /\.(lnk|desktop)$/i.test(filePath) ? readShortcut(filePath) : null;
  const realPath = shortcut && shortcut.target ? shortcut.target : filePath;
  let name = parsed.name || parsed.base;

  if (shortcut && /\.desktop$/i.test(filePath)) {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const zh = /^Name\[zh_CN\]=(.*)$/m.exec(text) || /^Name=(.*)$/m.exec(text);
      if (zh && zh[1]) name = zh[1].trim();
    } catch (e) {
      /* 忽略 */
    }
  }

  return {
    name,
    path: realPath,
    displayPath: filePath,
    args: shortcut ? shortcut.args || "" : "",
    type: hintType || (isDir ? "folder" : "app"),
    icon: iconFor(filePath) || iconFor(realPath),
  };
}

function pickEntries(opts = {}) {
  const properties = opts.folder
    ? ["openDirectory", "multiSelections"]
    : ["openFile", "multiSelections"];
  const files = getHost().showOpenDialog({
    title: opts.title || (opts.folder ? "选择文件夹" : "选择文件"),
    buttonLabel: "选择",
    properties,
  });
  return Array.isArray(files) ? files : [];
}

function pickImage() {
  const files = getHost().showOpenDialog({
    title: "选择图标",
    buttonLabel: "确定",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "ico", "svg", "webp"] }],
    properties: ["openFile"],
  });
  return files && files[0] ? iconFor(files[0]) : "";
}

function psLiteral(value) {
  return `'${String(value == null ? "" : value).replace(/'/g, "''")}'`;
}

function notifyError(message) {
  try {
    getHost().showNotification(message);
  } catch (e) {
    /* 忽略 */
  }
}

/** 不经过 shell 的分离进程启动 */
function spawnDetached(file, args, options = {}) {
  if (!file) {
    notifyError("启动失败：没有可执行路径");
    return false;
  }
  try {
    const child = spawn(file, args, {
      cwd: options.cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => notifyError("启动出错，请检查路径是否正确，或权限不足"));
    child.unref();
    return true;
  } catch (e) {
    notifyError("启动出错，请检查路径是否正确，或权限不足");
    return false;
  }
}

/** PowerShell 走 EncodedCommand，脚本内容不经过 cmd 解析 */
function runPowerShell(script) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return spawnDetached("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encoded,
  ]);
}

function startOnWindows(filePath, args, options = {}) {
  const isScript = /\.(bat|cmd)$/i.test(filePath);

  if (isScript && args.some((arg) => /[&|<>^"]/.test(arg))) {
    notifyError("批处理参数包含不支持的字符");
    return false;
  }

  // 普通启动：spawn 直接把参数数组交给 CreateProcess
  if (!options.admin) {
    if (isScript) return spawnDetached("cmd.exe", ["/d", "/s", "/c", filePath, ...args], { cwd: options.cwd });
    return spawnDetached(filePath, args, { cwd: options.cwd });
  }

  // 管理员启动：PowerShell Start-Process + UAC，参数用单引号字面量
  const exe = isScript ? "cmd.exe" : filePath;
  const list = isScript ? ["/d", "/s", "/c", filePath, ...args] : args;
  const argList = list.length ? ` -ArgumentList @(${list.map(psLiteral).join(", ")})` : "";
  const workingDir = options.cwd ? ` -WorkingDirectory ${psLiteral(options.cwd)}` : "";
  const script = `Start-Process -FilePath ${psLiteral(exe)}${argList} -Verb RunAs${workingDir}`;
  return runPowerShell(script);
}

/**
 * 启动条目。
 * @param {object} item {path, backupPath, openAppPath, args, adminStart}
 * @param {string} [query] 替换网址里的 {query}
 */
function launch(item, query) {
  if (!item || !item.path) return { ok: false, message: "路径为空" };

  let target = String(item.path);
  if (query != null) target = target.replace(/\{query\}/g, encodeURIComponent(String(query)));

  if (URL_RE.test(target)) {
    getHost().shellOpenExternal(target);
    return { ok: true };
  }

  let filePath = target;
  try {
    if (!fs.existsSync(filePath) && item.backupPath && fs.existsSync(item.backupPath)) {
      filePath = item.backupPath;
    }
    if (!fs.existsSync(filePath) && !item.openAppPath) {
      return { ok: false, message: "路径不存在，或权限不足" };
    }
  } catch (e) {
    return { ok: false, message: "无法访问该路径" };
  }

  // 快捷方式可能指向网址
  if (URL_RE.test(filePath)) {
    getHost().shellOpenExternal(filePath);
    return { ok: true };
  }

  const args = splitArgs(item.args);
  const cwd = path.dirname(filePath);
  const platform = getPlatform();
  const hasExtras = Boolean(item.args || item.adminStart || item.openAppPath);

  if (!hasExtras) {
    getHost().shellOpenPath(filePath);
    return { ok: true };
  }

  if (platform === "win32") {
    if (item.openAppPath) {
      startOnWindows(item.openAppPath, [...args, filePath], { cwd: path.dirname(item.openAppPath) });
    } else {
      startOnWindows(filePath, args, { cwd, admin: Boolean(item.adminStart) });
    }
    return { ok: true };
  }

  if (platform === "darwin") {
    const openArgs = [];
    if (item.openAppPath) openArgs.push("-a", item.openAppPath);
    openArgs.push(filePath);
    if (args.length) openArgs.push("--args", ...args);
    spawnDetached("open", openArgs);
    return { ok: true };
  }

  // Linux
  if (item.openAppPath) {
    spawnDetached(item.openAppPath, [...args, filePath]);
  } else if (/\.desktop$/i.test(filePath)) {
    const shortcut = readShortcut(filePath);
    spawnDetached(shortcut.target, [...splitArgs(shortcut.args), filePath], { cwd });
  } else if (/\.sh$/i.test(filePath)) {
    spawnDetached("/bin/sh", [filePath, ...args], { cwd });
  } else {
    getHost().shellOpenPath(filePath);
  }
  return { ok: true };
}

/* ------------------------------ 网页元信息 ------------------------------ */

function requestText(url, redirects = 3) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve(null);
    }
    if (!/^https?:$/.test(parsed.protocol)) return resolve(null);

    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.get(
      parsed,
      {
        timeout: 8000,
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          res.resume();
          return requestText(new URL(res.headers.location, url).href, redirects - 1).then(resolve);
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 512 * 1024) return res.destroy();
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ text: Buffer.concat(chunks).toString("utf8"), finalUrl: url }));
        res.on("error", () => resolve(null));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

function requestBuffer(url, redirects = 3) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve(null);
    }
    if (!/^https?:$/.test(parsed.protocol)) return resolve(null);

    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.get(
      parsed,
      { timeout: 8000, headers: { "User-Agent": UA, "Accept-Encoding": "identity" } },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          res.resume();
          return requestBuffer(new URL(res.headers.location, url).href, redirects - 1).then(resolve);
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 512 * 1024) return res.destroy();
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({ buffer: Buffer.concat(chunks), contentType: res.headers["content-type"] || "" }),
        );
        res.on("error", () => resolve(null));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseMeta(html, finalUrl) {
  let title = "";
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) title = decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim();

  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const head = headMatch ? headMatch[1] : html;

  let iconUrl = "";
  const candidates = [];
  const linkRe = /<link\b[^>]*>/gi;
  let link;
  while ((link = linkRe.exec(head))) {
    const tag = link[0];
    if (!/\brel\s*=\s*["']?[^"'>]*icon/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag);
    const sizes = /\bsizes\s*=\s*["']?([^"'>]+)/i.exec(tag);
    candidates.push({ href: href[1], rel: rel ? rel[1] : "", sizes: sizes ? sizes[1] : "" });
    if (!iconUrl) iconUrl = href[1];
  }

  const apple = candidates.find((c) => /apple-touch/i.test(c.rel));
  const large = candidates.find((c) => /(192|180|128|96)x/.test(c.sizes));
  if (apple) iconUrl = apple.href;
  else if (large) iconUrl = large.href;
  if (!iconUrl) iconUrl = "/favicon.ico";

  try {
    iconUrl = new URL(iconUrl, finalUrl).href;
  } catch (e) {
    iconUrl = "";
  }
  return { title, iconUrl };
}

async function compressIcon(buffer, ext) {
  try {
    if (getHost().sharp) {
      const resized = await getHost().sharp(buffer).resize(96, 96, { fit: "inside" }).png().toBuffer();
      if (resized && resized.length) return dataUrlFromBuffer(resized, "png");
    }
  } catch (e) {
    /* 没有 sharp 或格式不支持时保留原图 */
  }
  return dataUrlFromBuffer(buffer, ext);
}

async function fetchMeta(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) return { title: "", icon: "", error: "请输入 http(s) 网址" };

  const page = await requestText(url);
  if (!page) return { title: "", icon: "", error: "无法访问该网址" };

  const meta = parseMeta(page.text, page.finalUrl);
  if (meta.iconUrl) {
    const res = await requestBuffer(meta.iconUrl);
    if (res && res.buffer && res.buffer.length) {
      const fromType = (res.contentType.match(/image\/([a-z0-9+.-]+)/i) || [])[1] || "";
      let fromUrl = "";
      try {
        fromUrl = path.extname(new URL(meta.iconUrl).pathname).slice(1).toLowerCase();
      } catch (e) {
        /* 忽略 */
      }
      meta.icon = await compressIcon(res.buffer, (fromType || fromUrl || "png").replace("svg+xml", "svg"));
    }
  }
  return { title: meta.title, icon: meta.icon || "", error: "" };
}

/* -------------------------------- 备份 --------------------------------- */

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}`;
}

function exportBackup(data) {
  const dir = getHost().getPath("documents") || getHost().getPath("home");
  const target = getHost().showSaveDialog({
    title: "导出闪启数据",
    defaultPath: path.join(dir, `闪启-备份-${stamp()}.json`),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!target) return "";
  fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
  return target;
}

function importBackup() {
  const files = getHost().showOpenDialog({
    title: "选择备份文件",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!files || !files[0]) return null;
  try {
    return JSON.parse(fs.readFileSync(files[0], "utf8"));
  } catch (e) {
    throw new Error("备份文件不是有效 JSON");
  }
}

function getInfo() {
  let appVersion = "";
  let nativeId = "";
  try {
    appVersion = getHost().getAppVersion();
  } catch (e) {}
  try {
    nativeId = getHost().getNativeId();
  } catch (e) {}
  return { platform: getPlatform(), appVersion, nativeId, electron: process.versions.electron };
}

const isExist = (p) => {
  try {
    return fs.existsSync(p);
  } catch (e) {
    return false;
  }
};

const api = {
  MARKER: "flashlaunch-v1",
  getPlatform,
  getInfo,
  iconFor,
  readShortcut,
  describePath,
  pickEntries,
  pickImage,
  launch,
  fetchMeta,
  exportBackup,
  importBackup,
  isPathExist: isExist,
  pathForFile: (file) => {
    try {
      if (file && file.path) return file.path;
      if (webUtils && typeof webUtils.getPathForFile === "function") return webUtils.getPathForFile(file);
    } catch (e) {
      /* 忽略 */
    }
    return "";
  },
  readClipboard: () => {
    try {
      return electron.clipboard.readText();
    } catch (e) {
      return "";
    }
  },
  openExternal: (url) => getHost().shellOpenExternal(url),
  showItemInFolder: (p) => getHost().shellShowItemInFolder(p),
  copyText: (text) => getHost().copyText(text),
  notify: (message) => getHost().showNotification(message),
  outPlugin: () => getHost().outPlugin(),
};

window.sl = api;
// 如果 ZTools 未来开启 contextIsolation，也保证渲染层能拿到同一套 API
try {
  if (electron.contextBridge) electron.contextBridge.exposeInMainWorld("sl", api);
} catch (e) {
  /* contextIsolation=false 时会抛错，忽略即可 */
}
