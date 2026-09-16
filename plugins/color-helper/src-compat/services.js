/**
 * window.services 纯 Web 抽象服务层
 * 替代原生 Node.js fs/promises、buffer、path 模块
 */

export const services = {
  /**
   * 保存色卡图片
   * @param {ArrayBuffer | number[] | Uint8Array} bf 二进制缓冲区
   * @param {string} [filename] 保存文件名
   */
  async saveColorCard(bf, filename) {
    if (!bf) return;

    try {
      let uint8Array;
      if (bf instanceof Uint8Array) {
        uint8Array = bf;
      } else if (bf instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(bf);
      } else if (Array.isArray(bf)) {
        uint8Array = new Uint8Array(bf);
      } else {
        uint8Array = new Uint8Array(bf);
      }

      const blob = new Blob([uint8Array], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const name = filename || `color-card-${Date.now()}.png`;

      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      console.log(`[ColorHelperServices] 色卡已成功导出为: ${name}`);
    } catch (err) {
      console.error("[ColorHelperServices] saveColorCard failed:", err);
    }
  }
};
