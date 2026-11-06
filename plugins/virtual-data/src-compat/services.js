/**
 * src-compat/services.js
 * 纯 Web 标准文件服务垫片，替代原生 Node.js fs/path 模块
 */

export const services = {
  /**
   * 读取文件内容 (纯前端环境)
   */
  async readFile(file) {
    if (typeof file === 'string') {
      return file;
    }
    if (file instanceof Blob || file instanceof File) {
      return await file.text();
    }
    return '';
  },

  /**
   * 将文本触发下载或作为本地文件存留
   */
  writeTextFile(text) {
    const filename = `virtual-data-${Date.now()}.txt`;
    if (typeof document !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
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
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = base64Url;
      a.download = filename;
      a.click();
    }
    return filename;
  },
};
