/**
 * 纯 Web 标准 services 垫片
 * 替代原生 Node.js fs / path 模块
 */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const services = {
  // 读文件 (纯浏览器沙箱安全兜底)
  readFile(file) {
    console.warn("[services] readFile is restricted in browser sandbox:", file);
    return "";
  },

  // 文本写入并触发下载
  writeTextFile(text) {
    try {
      const filename = `${Date.now()}.txt`;
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, filename);
      return filename;
    } catch (err) {
      console.error("[regex-editor] writeTextFile failed:", err);
      return undefined;
    }
  },

  // Base64 图片写入并触发下载
  writeImageFile(base64Url) {
    try {
      const match = /^data:image\/([a-z0-9]+);base64,(.+)$/i.exec(base64Url);
      if (!match) return;

      const ext = match[1] || "png";
      const b64Data = match[2];
      const byteCharacters = atob(b64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${ext}` });
      const filename = `${Date.now()}.${ext}`;

      downloadBlob(blob, filename);
      return filename;
    } catch (err) {
      console.error("[regex-editor] writeImageFile failed:", err);
      return undefined;
    }
  }
};
