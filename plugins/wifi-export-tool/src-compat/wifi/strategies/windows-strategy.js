import { BaseWifiStrategy } from "./base-strategy.js";
import { executeCommand } from "../executor.js";

/**
 * Windows 平台 WiFi 凭证提取策略
 * 基于 netsh wlan 命令行工具
 */
export class WindowsWifiStrategy extends BaseWifiStrategy {
  async getWifiList() {
    try {
      const profilesOutput = await executeCommand("netsh", ["wlan", "show", "profiles"]);
      const ssids = this.parseSsids(profilesOutput);

      const results = [];
      for (const ssid of ssids) {
        if (!ssid) continue;
        try {
          const profileOutput = await executeCommand("netsh", [
            "wlan",
            "show",
            "profile",
            `name=${ssid}`,
            "key=clear"
          ]);

          let password = "";
          let securityType = "开放网络";

          const pwdMatch = profileOutput.match(/(?:关键内容|Key Content|Key content)\s*:\s*(.*)/i);
          if (pwdMatch) {
            password = pwdMatch[1].trim();
          }

          const authMatch = profileOutput.match(/(?:身份验证|Authentication)\s*:\s*(.*)/i);
          if (authMatch) {
            securityType = authMatch[1].trim();
            if (securityType === "Open" || securityType.includes("开放")) {
              securityType = "开放网络";
            }
          }

          results.push({
            ssid,
            password,
            securityType
          });
        } catch {
          results.push({
            ssid,
            password: "",
            securityType: "Unknown"
          });
        }
      }

      return results;
    } catch (err) {
      console.error("[WindowsWifiStrategy] 读取 WiFi 失败:", err);
      throw new Error(`Windows WiFi 提取失败: ${err.message || err}`);
    }
  }

  async getWifiPassword(ssid) {
    try {
      const profileOutput = await executeCommand("netsh", [
        "wlan",
        "show",
        "profile",
        `name=${ssid}`,
        "key=clear"
      ]);
      const pwdMatch = profileOutput.match(/(?:关键内容|Key Content|Key content)\s*:\s*(.*)/i);
      if (pwdMatch) {
        return pwdMatch[1].trim();
      }
    } catch (err) {
      console.error(`[WindowsWifiStrategy] 获取 ${ssid} 密码失败:`, err);
    }
    return "";
  }

  /**
   * 从 netsh wlan show profiles 输出中健壮提取所有 SSID 列表
   */
  parseSsids(output) {
    const ssids = [];
    if (!output) return ssids;

    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      // 匹配包含 Profile / 配置文件 行
      if (line.includes(":") && (line.includes("Profile") || line.includes("配置文件"))) {
        const parts = line.split(":");
        if (parts.length >= 2) {
          const ssid = parts.slice(1).join(":").trim();
          if (ssid && !ssids.includes(ssid)) {
            ssids.push(ssid);
          }
        }
      }
    }

    // 备用兼容：若没有命中关键字但包含冒号（如特殊语言系统），采用通用冒号匹配
    if (ssids.length === 0 && output.includes(":")) {
      const allRegex = /:\s+(.+)/g;
      let match;
      while ((match = allRegex.exec(output)) !== null) {
        const val = match[1].trim();
        if (val && !val.includes("---") && !val.startsWith("wlan") && !ssids.includes(val)) {
          ssids.push(val);
        }
      }
    }

    return ssids;
  }
}
