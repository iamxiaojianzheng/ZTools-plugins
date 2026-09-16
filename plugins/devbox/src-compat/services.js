/**
 * window.services 服务抽象垫片
 * 适配原代码对 public/preload/services.js 的声明
 */
export const services = {
  // 原组件已有完善的 Web 标准 fallback，这里暴露安全的基础契约
  async readFile(file) {
    if (typeof window !== "undefined" && window.ruck?.fs?.readTextFile) {
      return await window.ruck.fs.readTextFile(file);
    }
    throw new Error("请使用原生文件选择器或剪贴板");
  },
  async writeTextFile(filename, content) {
    if (typeof window !== "undefined" && window.ruck?.fs?.writeTextFile) {
      return await window.ruck.fs.writeTextFile(filename, content);
    }
    throw new Error("请使用原生下载方式");
  },
  async writeImageFile(base64Url) {
    if (typeof window !== "undefined" && window.ruck?.fs?.writeImageFile) {
      return await window.ruck.fs.writeImageFile(base64Url);
    }
    return undefined;
  }
};
