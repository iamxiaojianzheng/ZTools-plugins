import { BaseWifiStrategy } from "./base-strategy.js";
import { executeCommand } from "../executor.js";

/**
 * macOS 平台 WiFi 凭证提取策略
 * 基于 networksetup 与 security 命令行工具
 */
export class MacWifiStrategy extends BaseWifiStrategy {
  async getWifiList() {
    try {
      const output = await executeCommand("networksetup", ["-listpreferredwirelessnetworks", "en0"]);
      const lines = output
        .split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.includes("Preferred networks on"));

      const results = [];
      for (const ssid of lines) {
        // macOS 批量获取密码会触发频繁 Keychain 鉴权弹窗，因此默认不获取，进入详情弹窗时按需获取
        results.push({
          ssid,
          password: undefined,
          securityType: "未知/按需获取"
        });
      }
      return results;
    } catch (err) {
      console.error("[MacWifiStrategy] 读取 WiFi 失败:", err);
      throw new Error(`macOS WiFi 提取失败: ${err.message || err}`);
    }
  }

  async getWifiPassword(ssid) {
    try {
      const pwdOutput = await executeCommand("security", ["find-generic-password", "-wa", ssid]);
      return pwdOutput.trim();
    } catch (err) {
      console.error(`[MacWifiStrategy] 获取 ${ssid} 密码失败:`, err);
    }
    return "";
  }
}
