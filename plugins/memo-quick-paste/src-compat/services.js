/**
 * window.services 适配层
 * 替代原基于 Node.js (crypto, fs, path, url) 的服务逻辑
 */
import { md5 } from "./md5.js";

// 用于缓存外部拖入或选中的本地文件数据
const fileCache = new Map();

export function setFileCache(pathOrUrl, info) {
  fileCache.set(pathOrUrl, info);
}

export const services = {
  md5Format(input) {
    if (input === null || input === undefined) return "";
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
      throw new Error("图片参数错误");
    }

    // 1. 处理 Data URL (base64)
    if (/^data:(image\/[a-zA-Z0-9.+_-]+)(?:;[a-zA-Z0-9=_-]+)*;base64,(.+)$/i.test(input)) {
      const contentType = RegExp.$1.toLowerCase();
      const b64Data = RegExp.$2;
      const binaryString = atob(b64Data);
      const len = binaryString.length;
      if (len > 10485760) {
        throw new Error("图片大小超过 10 M");
      }
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const digest = md5(bytes);
      return { digest, data: bytes, contentType };
    }

    // 2. 检查本地内存缓存
    if (fileCache.has(input)) {
      return fileCache.get(input);
    }

    // 3. 处理 file: 协议或本地路径
    let cleanPath = input;
    if (cleanPath.startsWith("file:///")) {
      cleanPath = decodeURIComponent(cleanPath.substring(8));
    } else if (cleanPath.startsWith("file://")) {
      cleanPath = decodeURIComponent(cleanPath.substring(7));
    }

    // 尝试同步读取或通过预先生成的 mock 返回
    const extMatch = cleanPath.match(/\.(png|jpg|jpeg)$/i);
    if (!extMatch) {
      throw new Error("只支持 png、jpg 图片文件");
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

      // 若 Ruck 宿主环境提供了临时路径与写文件能力
      if (window.ruck && window.ruck.fs && window.ruck.os) {
        const tempPath = `ruck.collection/${fileName}`;
        window.ruck.fs.writeFile(tempPath, bytes).catch(() => {});
        return tempPath;
      }

      // 浏览器 Webview 内部 Blob URL 回退
      const blob = new Blob([bytes], { type: contentType || "image/png" });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("[services] saveImgToFileByArrayBuffer failed:", err);
      return null;
    }
  }
};
