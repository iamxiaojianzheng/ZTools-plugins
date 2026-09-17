/**
 * window.services 纯 Web 宿主兼容与安全降级服务
 */

export const services = {
  readFile(file) {
    console.warn("[services] readFile is not supported in browser sandbox");
    return "";
  },
  writeFile(file, content) {
    console.warn("[services] writeFile is not supported in browser sandbox");
  },
  writeTextFile(text) {
    console.warn("[services] writeTextFile is not supported in browser sandbox");
    return "";
  },
  writeImageFile(base64Url) {
    console.warn("[services] writeImageFile is not supported in browser sandbox");
    return undefined;
  }
};
