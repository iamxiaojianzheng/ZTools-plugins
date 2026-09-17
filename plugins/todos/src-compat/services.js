/**
 * 待办日历 (todos) 纯 Web 标准 services 垫片
 * 替代原本依赖 Node.js (fs / path) 的旧实现
 */

export const services = {
  // 读取文本文件（Web 标准通过 FileReader 或 fetch 桥接）
  async readFile(file) {
    if (typeof window !== "undefined" && window.ruck?.fs?.readTextFile) {
      return await window.ruck.fs.readTextFile(file);
    }
    throw new Error("当前环境不支持直接读取本地文件路径");
  },

  // 写入文本文件
  async writeTextFile(text) {
    if (typeof window !== "undefined" && window.ruck?.fs?.writeTextFile) {
      const filename = `todos_${Date.now()}.txt`;
      return await window.ruck.fs.writeTextFile(filename, text);
    }
    // Web 标准下载降级
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
      return undefined;
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
      return undefined;
    }
  }
};
