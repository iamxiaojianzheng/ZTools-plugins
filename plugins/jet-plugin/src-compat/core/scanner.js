/**
 * JetBrains 历史项目核心扫描引擎
 */

import { matchProductByDirectory } from "./ide-registry.js";
import { parseRecentProjectsXml } from "./xml-parser.js";
import { getPlatform } from "./executor.js";
import { ideLocator } from "./ide-locator.js";

const CACHE_KEY = "ruck_jet_projects_cache";
const CACHE_TTL = 3 * 60 * 1000; // 3分钟缓存有效期

export class ProjectScanner {
  constructor() {
    this.homeDir = "";
    this.configRoot = "";
    this.isScanning = false;
  }

  /**
   * 初始化环境与配置根目录
   */
  async initEnvironment() {
    const ruck = window.ruck;
    let home = "";
    if (ruck?.path?.homeDir) {
      try {
        home = await ruck.path.homeDir();
      } catch (e) {
        console.warn("[Scanner] 获取 homeDir 失败:", e);
      }
    }

    const platform = getPlatform(home);
    if (!home) {
      // 降级推断
      home = platform === "win32" ? "C:/Users/Administrator" : "/Users/default";
    }

    this.homeDir = home;
    const normHome = this.homeDir.replace(/\\/g, "/").replace(/\/$/, "");

    if (platform === "win32") {
      this.configRoot = `${normHome}/AppData/Roaming/JetBrains`;
    } else if (platform === "darwin") {
      this.configRoot = `${normHome}/Library/Application Support/JetBrains`;
    } else {
      this.configRoot = `${normHome}/.config/JetBrains`;
    }

    console.log(`[Scanner] JetBrains 配置根目录定位为:`, this.configRoot);
  }

  /**
   * 从本地缓存极速读取（0ms 启动恢复）
   * @returns {Array<Object>|null}
   */
  readFromCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data.projects)) {
        return data;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * 写入缓存
   * @param {Array<Object>} projects
   */
  writeToCache(projects) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          updatedAt: Date.now(),
          projects: projects
        })
      );
    } catch (e) {
      // ignore
    }
  }

  /**
   * 全量扫描本机 JetBrains 最近工程
   * @returns {Promise<Array<Object>>}
   */
  async scan() {
    if (this.isScanning) {
      console.log("[Scanner] 正在扫描中，跳过重复触发");
      return this.readFromCache()?.projects || [];
    }

    this.isScanning = true;
    const ruck = window.ruck;

    try {
      if (!this.configRoot) {
        await this.initEnvironment();
      }

      if (!ruck?.fs) {
        console.warn("[Scanner] 宿主未提供 ruck.fs，无法扫描文件系统");
        return [];
      }

      // 1. 检查配置根目录是否存在
      const rootExists = await ruck.fs.exists(this.configRoot);
      if (!rootExists) {
        console.warn(`[Scanner] JetBrains 配置根目录不存在: ${this.configRoot}`);
        return [];
      }

      // 2. 读取配置根目录下的所有子文件夹
      const subEntries = await ruck.fs.readDir(this.configRoot);
      if (!Array.isArray(subEntries) || subEntries.length === 0) {
        console.log("[Scanner] 未找到任何 IDE 配置目录");
        return [];
      }

      // 并发启动本机已安装 IDE 启动器与官方图标嗅探
      try {
        await ideLocator.locate(this.homeDir);
      } catch (locErr) {
        console.warn("[Scanner] 嗅探本机 IDE 启动器失败:", locErr.message);
      }

      const allProjects = [];

      // 3. 逐个子目录查找 options/recentProjects.xml
      for (const entry of subEntries) {
        if (!entry) continue;

        // 若明确标识不是目录（例如文件 bl, crl 等），直接跳过
        if (typeof entry === "object" && entry.isDirectory === false) {
          continue;
        }

        // entry 可能是字符串，或包含 name / path 的对象
        const rawName = typeof entry === "string"
          ? entry
          : (entry.name || entry.path || "");

        const dirName = rawName.split(/[\\/]/).pop();
        if (!dirName || dirName.startsWith(".") || dirName === "consentOptions") {
          continue;
        }

        const product = matchProductByDirectory(dirName);
        const xmlPath = `${this.configRoot}/${dirName}/options/recentProjects.xml`;

        try {
          const hasXml = await ruck.fs.exists(xmlPath);
          if (!hasXml) continue;

          console.log(`[Scanner] 发现项目历史文件: ${xmlPath}`);
          const xmlContent = await ruck.fs.readFile(xmlPath, { encoding: "utf8" });
          if (!xmlContent || typeof xmlContent !== "string") continue;

          const parsedList = parseRecentProjectsXml(xmlContent, this.homeDir, product, dirName);
          
          // 关联本机安装的启动器路径与官方正版图标
          for (const p of parsedList) {
            const appInfo = ideLocator.findAppForProject(p);
            if (appInfo) {
              if (appInfo.exePath) p.launchExecutable = appInfo.exePath;
              if (appInfo.iconSvg) p.ideIcon = appInfo.iconSvg;
            }
          }

          allProjects.push(...parsedList);
        } catch (dirErr) {
          console.warn(`[Scanner] 解析目录 ${dirName} 异常:`, dirErr.message);
        }
      }

      // 4. 去重与合并（同一项目路径可能在多个版本 IDE 中打开，保留时间戳最新的一条）
      const projectMap = new Map();
      for (const item of allProjects) {
        const normPath = item.path.toLowerCase().replace(/\\/g, "/");
        if (!projectMap.has(normPath)) {
          projectMap.set(normPath, item);
        } else {
          const existing = projectMap.get(normPath);
          if (item.openTimestamp > existing.openTimestamp) {
            projectMap.set(normPath, item);
          }
        }
      }

      // 5. 按最近打开时间倒序排序
      const sortedProjects = Array.from(projectMap.values()).sort(
        (a, b) => (b.openTimestamp || 0) - (a.openTimestamp || 0)
      );

      console.log(`[Scanner] 扫描完成，共聚合 ${sortedProjects.length} 个历史项目`);

      // 6. 更新本地缓存
      this.writeToCache(sortedProjects);

      return sortedProjects;
    } catch (error) {
      console.error("[Scanner] 扫描 JetBrains 项目失败:", error);
      return [];
    } finally {
      this.isScanning = false;
    }
  }
}

export const scanner = new ProjectScanner();
