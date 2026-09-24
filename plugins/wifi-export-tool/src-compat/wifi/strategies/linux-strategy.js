import { BaseWifiStrategy } from "./base-strategy.js";
import { executeCommand } from "../executor.js";

/**
 * Linux 平台 WiFi 凭证提取策略
 * 基于 NetworkManager (nmcli) 命令行工具
 */
export class LinuxWifiStrategy extends BaseWifiStrategy {
  async getWifiList() {
    try {
      const output = await executeCommand("nmcli", ["-t", "-f", "NAME,TYPE", "connection", "show"]);
      const lines = output.split("\n");
      const results = [];

      for (const line of lines) {
        if (!line || !line.includes("802-11-wireless")) continue;

        const ssid = line.split(":")[0];
        if (!ssid) continue;

        let password = "";
        let securityType = "开放网络";

        try {
          const detail = await executeCommand("nmcli", [
            "-s",
            "-g",
            "802-11-wireless-security.psk",
            "connection",
            "show",
            ssid
          ]);
          if (detail && detail.trim()) {
            password = detail.trim();
            securityType = "WPA/WPA2";
          }
        } catch {}

        results.push({ ssid, password, securityType });
      }
      return results;
    } catch (err) {
      console.error("[LinuxWifiStrategy] 读取 WiFi 失败:", err);
      throw new Error(`Linux WiFi 提取失败: ${err.message || err}`);
    }
  }

  async getWifiPassword(ssid) {
    try {
      const detail = await executeCommand("nmcli", [
        "-s",
        "-g",
        "802-11-wireless-security.psk",
        "connection",
        "show",
        ssid
      ]);
      if (detail && detail.trim()) {
        return detail.trim();
      }
    } catch (err) {
      console.error(`[LinuxWifiStrategy] 获取 ${ssid} 密码失败:`, err);
    }
    return "";
  }
}
