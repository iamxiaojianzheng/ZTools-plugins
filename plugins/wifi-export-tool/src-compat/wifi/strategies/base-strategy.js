/**
 * WiFi 信息提取策略接口基类
 */
export class BaseWifiStrategy {
  /**
   * 提取已保存的所有 WiFi 网络信息列表
   * @returns {Promise<Array<{ ssid: string, password?: string, securityType: string }>>}
   */
  async getWifiList() {
    throw new Error("Method getWifiList() must be implemented.");
  }

  /**
   * 按需获取指定 SSID 的密码明文
   * @param {string} ssid
   * @returns {Promise<string>}
   */
  async getWifiPassword(ssid) {
    throw new Error("Method getWifiPassword() must be implemented.");
  }
}
