/**
 * TinyPNG 纯沙箱 services 服务层
 * 适配 Ruck (Tauri 2.0 Webview2) 运行时环境，替代 Node.js (fs/path)
 */

function getRuck() {
  return typeof window !== "undefined" && window.ruck ? window.ruck : null;
}

const imageReg = /\.(png|jpeg|jpg|webp)$/i;
const excludeDirReg = /^(\.|node_modules)/i;

/**
 * 获取跨平台路径分隔符
 */
function getSep() {
  const ruck = getRuck();
  if (ruck?.path?.sep) return ruck.path.sep;
  const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
  return isWin ? "\\" : "/";
}

/**
 * 规范化路径拼接
 */
function joinPath(...parts) {
  const ruck = getRuck();
  if (ruck?.path?.join && typeof ruck.path.join === "function") {
    return ruck.path.join(...parts);
  }
  const sep = getSep();
  return parts.filter(Boolean).join(sep).replace(/[\\/]+/g, sep);
}

/**
 * 提取文件所在父目录路径
 */
function getDirname(p) {
  const ruck = getRuck();
  if (ruck?.path?.dirname && typeof ruck.path.dirname === "function") {
    return ruck.path.dirname(p);
  }
  const sep = getSep();
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx > 0 ? p.substring(0, idx) : p;
}

/**
 * 提取路径基础名称
 */
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

/**
 * 获取插件专用的系统临时存储根目录
 */
async function getTempPath() {
  const ruck = getRuck();
  let baseTemp = "";
  if (ruck?.path?.tempDir && typeof ruck.path.tempDir === "function") {
    try {
      baseTemp = await ruck.path.tempDir();
    } catch (e) {
      console.warn("[TinyPNG] ruck.path.tempDir 获取失败:", e);
    }
  }

  if (!baseTemp && ruck?.os?.tmpdir && typeof ruck.os.tmpdir === "function") {
    try {
      baseTemp = await ruck.os.tmpdir();
    } catch (e) {
      console.warn("[TinyPNG] ruck.os.tmpdir 获取失败:", e);
    }
  }

  if (!baseTemp) {
    const isWin = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent);
    baseTemp = isWin ? "C:\\Windows\\Temp" : "/tmp";
  }

  return joinPath(baseTemp, "ruck.tinypng");
}

/**
 * 递归检索指定目录下的全部符合规则的图片文件
 */
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
    console.warn(`[TinyPNG] 检索目录异常: ${rootPath}`, err);
  }

  return [];
}

// 冷启动进入动作缓冲（防前端 Vue 挂载前事件丢失）
let pendingCompressionConfig = null;
let vueAppReady = false;

// 安装与 Vue 前端的握手就绪监听
if (typeof window !== "undefined") {
  window.addEventListener("tinyping-compression-ready", () => {
    vueAppReady = true;
    if (pendingCompressionConfig) {
      console.log("[TinyPNG] Vue App 就绪，回放暂存的压缩任务");
      window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: pendingCompressionConfig }));
      pendingCompressionConfig = null;
    }
  });
}

export const services = {
  /**
   * 响应插件进入动作，解析图片路径并派发压缩任务
   */
  async handlePluginEnter({ code, type, payload }) {
    const ruck = getRuck();
    try {
      console.log("[TinyPNG] handlePluginEnter 收到参数:", { code, type, payload });

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

      console.log("[TinyPNG] 解析到待处理路径:", paths);

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
            window.ztools?.showNotification?.(`此文件名已被占用："${name}" 跳过处理`);
            continue;
          }

          let imgStat = { size: 0 };
          try {
            imgStat = await ruck.fs.stat(img);
          } catch (e) {
            console.warn("[TinyPNG] 读取文件元信息失败:", img, e);
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
        console.log("[TinyPNG] 未找到有效的待压缩图片");
        return;
      }

      console.log(`[TinyPNG] 成功匹配到 ${config.images.length} 张图片，准备派发压缩事件`);

      if (vueAppReady) {
        window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: config }));
      } else {
        pendingCompressionConfig = config;
        // 延时重试派发，确保事件至少发出一次
        setTimeout(() => {
          if (pendingCompressionConfig) {
            window.dispatchEvent(new CustomEvent("tinyping-compression", { detail: pendingCompressionConfig }));
            pendingCompressionConfig = null;
          }
        }, 300);
      }
    } catch (error) {
      console.error("[TinyPNG] handlePluginEnter 异常:", error);
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
        // Base64 降级转换
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
    throw new Error("当前环境不支持直接读取本地文件");
  },

  /**
   * 写入本地二进制文件
   * @param {string} p 目标路径
   * @param {ArrayBuffer | Uint8Array} data 数据
   */
  async writeFile(p, data) {
    const ruck = getRuck();
    if (!ruck?.fs) throw new Error("当前环境不支持本地文件写入");

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
      throw new Error("当前环境不支持文件覆盖操作");
    }

    for (const [from, to] of files) {
      await ruck.fs.copyFile(from, to);
    }
  }
};

/**
 * 监听退出事件，自动清理生成的临时缓存文件
 */
export async function cleanupTempPath(exit) {
  if (!exit) return;
  const ruck = getRuck();
  if (!ruck?.fs?.remove) return;

  try {
    const tempRoot = await getTempPath();
    const exists = await ruck.fs.exists(tempRoot);
    if (exists) {
      await ruck.fs.remove(tempRoot, true);
      console.log("[TinyPNG] 成功清理临时缓存目录:", tempRoot);
    }
  } catch (e) {
    console.warn("[TinyPNG] 清理临时目录失败:", e);
  }
}
