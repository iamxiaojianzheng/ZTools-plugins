import { WindowsWifiStrategy } from "./strategies/windows-strategy.js";
import { MacWifiStrategy } from "./strategies/mac-strategy.js";
import { LinuxWifiStrategy } from "./strategies/linux-strategy.js";

/**
 * WiFi 服务门面 (Facade Pattern)
 * 自动识别平台运行时环境并分发给具体策略
 */
export class WifiService {
  constructor() {
    this.strategy = null;
    this.currentPlatform = null;
  }

  /**
   * 探测当前操作系统类型 ('windows' | 'macos' | 'linux')
   * @returns {Promise<string>}
   */
  async detectPlatform() {
    if (this.currentPlatform) {
      return this.currentPlatform;
    }

    // 1. 尝试从 Ruck 宿主沙箱获取平台标识
    if (window.ruck?.os?.platform && typeof window.ruck.os.platform === "function") {
      try {
        const plat = await window.ruck.os.platform();
        if (plat) {
          const lower = String(plat).toLowerCase();
          if (lower.includes("win")) this.currentPlatform = "windows";
          else if (lower.includes("mac") || lower.includes("darwin")) this.currentPlatform = "macos";
          else if (lower.includes("linux")) this.currentPlatform = "linux";
        }
      } catch (e) {
        console.warn("[WifiService] 从 ruck.os.platform 获取平台失败:", e);
      }
    }

    // 2. 尝试从 Node.js 环境获取 (Electron / 测试环境)
    if (!this.currentPlatform && typeof process !== "undefined" && process.platform) {
      const p = process.platform;
      if (p === "win32") this.currentPlatform = "windows";
      else if (p === "darwin") this.currentPlatform = "macos";
      else if (p === "linux") this.currentPlatform = "linux";
    }

    // 3. 兜底通过浏览器 UserAgent 与 platform 判断
    if (!this.currentPlatform && typeof navigator !== "undefined") {
      const ua = (navigator.userAgent || "").toLowerCase();
      const p = (navigator.platform || "").toLowerCase();
      if (p.includes("win") || ua.includes("windows")) {
        this.currentPlatform = "windows";
      } else if (p.includes("mac") || ua.includes("macintosh")) {
        this.currentPlatform = "macos";
      } else if (p.includes("linux") || ua.includes("linux")) {
        this.currentPlatform = "linux";
      }
    }

    // 默认回退到 windows
    if (!this.currentPlatform) {
      this.currentPlatform = "windows";
    }

    return this.currentPlatform;
  }

  /**
   * 延迟获取或初始化平台策略实例
   * @returns {Promise<BaseWifiStrategy>}
   */
  async getStrategy() {
    if (this.strategy) {
      return this.strategy;
    }

    const platform = await this.detectPlatform();
    switch (platform) {
      case "windows":
        this.strategy = new WindowsWifiStrategy();
        break;
      case "macos":
        this.strategy = new MacWifiStrategy();
        break;
      case "linux":
        this.strategy = new LinuxWifiStrategy();
        break;
      default:
        this.strategy = new WindowsWifiStrategy();
        break;
    }

    return this.strategy;
  }

  /**
   * 获取所有 WiFi 网络配置及密码
   */
  async getWifiList() {
    const strategy = await this.getStrategy();
    return await strategy.getWifiList();
  }

  /**
   * 按需获取指定 SSID 的密码明文
   * @param {string} ssid
   */
  async getWifiPassword(ssid) {
    if (!ssid) return "";
    const strategy = await this.getStrategy();
    return await strategy.getWifiPassword(ssid);
  }
}

export const wifiService = new WifiService();
