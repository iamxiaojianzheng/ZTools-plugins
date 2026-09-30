/**
 * JetBrains IDE 本地安装目录与启动器绝对路径自动嗅探器
 */

import { getPlatform } from "./executor.js";

export class IdeLocator {
  constructor() {
    this.installedApps = new Map(); // key: ideCode / lowerName -> { installDir, exePath, iconPath, iconSvg }
    this.isLocated = false;
  }

  /**
   * 收集本机潜在的 JetBrains 安装根目录
   * @param {string} homeDir 用户家目录
   * @returns {string[]}
   */
  getCandidateInstallRoots(homeDir = "") {
    const platform = getPlatform(homeDir);
    const normHome = (homeDir || "").replace(/\\/g, "/").replace(/\/$/, "");
    const roots = [];

    if (platform === "win32") {
      roots.push("C:/Program Files/JetBrains");
      roots.push("C:/Program Files (x86)/JetBrains");
      roots.push("D:/Program Files/JetBrains");
      if (normHome) {
        roots.push(`${normHome}/AppData/Local/Programs/JetBrains`);
        roots.push(`${normHome}/AppData/Local/JetBrains/Toolbox/apps`);
      }
    } else if (platform === "darwin") {
      roots.push("/Applications");
      if (normHome) {
        roots.push(`${normHome}/Applications`);
        roots.push(`${normHome}/Library/Application Support/JetBrains/Toolbox/apps`);
      }
    } else {
      roots.push("/opt");
      roots.push("/usr/share");
      if (normHome) {
        roots.push(`${normHome}/.local/share/JetBrains/Toolbox/apps`);
      }
    }

    return roots;
  }

  /**
   * 探测并建立本机已安装 IDE 映射字典
   * @param {string} homeDir 家目录
   */
  async locate(homeDir = "") {
    if (this.isLocated) {
      return this.installedApps;
    }

    const ruck = window.ruck;
    if (!ruck?.fs) {
      this.isLocated = true;
      return this.installedApps;
    }

    const candidateRoots = this.getCandidateInstallRoots(homeDir);

    for (const root of candidateRoots) {
      try {
        const rootExists = await ruck.fs.exists(root);
        if (!rootExists) continue;

        const entries = await ruck.fs.readDir(root);
        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
          if (typeof entry === "object" && entry.isDirectory === false) continue;

          const dirName = typeof entry === "string"
            ? entry.split(/[\\/]/).pop()
            : (entry.name || (entry.path ? entry.path.split(/[\\/]/).pop() : ""));

          if (!dirName || dirName.startsWith(".")) continue;

          const fullAppPath = typeof entry === "object" && entry.path
            ? entry.path.replace(/\\/g, "/")
            : `${root}/${dirName}`;

          await this.inspectAppDirectory(fullAppPath, dirName);
        }
      } catch (err) {
        console.warn(`[Locator] 探测目录 ${root} 异常:`, err.message);
      }
    }

    console.log(`[Locator] 本机嗅探到 ${this.installedApps.size} 个有效 IDE 启动器:`, Array.from(this.installedApps.keys()));
    this.isLocated = true;
    return this.installedApps;
  }

  /**
   * 检查单个候选应用目录
   * @param {string} appDir 应用主目录
   * @param {string} dirName 目录名
   */
  async inspectAppDirectory(appDir, dirName) {
    const ruck = window.ruck;
    const binDir = `${appDir}/bin`;

    try {
      const hasBin = await ruck.fs.exists(binDir);
      if (!hasBin) return;

      const binEntries = await ruck.fs.readDir(binDir);
      if (!Array.isArray(binEntries)) return;

      let mainExe = "";
      let svgPath = "";
      let svgContent = "";

      for (const bEntry of binEntries) {
        const bName = typeof bEntry === "string"
          ? bEntry.split(/[\\/]/).pop()
          : (bEntry.name || (bEntry.path ? bEntry.path.split(/[\\/]/).pop() : ""));

        if (!bName) continue;

        // 识别 64 位启动器 exe
        if (bName.endsWith("64.exe") && !bName.includes("client") && !bName.includes("worker") && !bName.includes("helper")) {
          mainExe = typeof bEntry === "object" && bEntry.path
            ? bEntry.path.replace(/\\/g, "/")
            : `${binDir}/${bName}`;
        } else if (!mainExe && bName.endsWith(".exe") && (bName.startsWith("idea") || bName.startsWith("pycharm") || bName.startsWith("webstorm") || bName.startsWith("goland") || bName.startsWith("rustrover") || bName.startsWith("clion") || bName.startsWith("rider") || bName.startsWith("datagrip"))) {
          mainExe = typeof bEntry === "object" && bEntry.path
            ? bEntry.path.replace(/\\/g, "/")
            : `${binDir}/${bName}`;
        }

        // 识别官方 SVG 图标
        if (bName.endsWith(".svg") && !svgPath) {
          svgPath = typeof bEntry === "object" && bEntry.path
            ? bEntry.path.replace(/\\/g, "/")
            : `${binDir}/${bName}`;
        }
      }

      // 如果发现了 SVG，尝试读取其内容生成 data url
      if (svgPath && ruck.fs.readFile) {
        try {
          const rawSvg = await ruck.fs.readFile(svgPath, { encoding: "utf8" });
          if (rawSvg && typeof rawSvg === "string" && rawSvg.includes("<svg")) {
            svgContent = `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`;
          }
        } catch (svgErr) {
          // ignore
        }
      }

      if (mainExe) {
        const info = {
          installDir: appDir,
          exePath: mainExe,
          svgPath: svgPath,
          iconSvg: svgContent
        };

        const lowerName = dirName.toLowerCase();
        this.installedApps.set(lowerName, info);

        // 建立特征前缀匹配
        if (lowerName.includes("idea") || lowerName.includes("intellij")) {
          this.installedApps.set("iu", info);
          this.installedApps.set("ic", info);
          this.installedApps.set("intellijidea", info);
        } else if (lowerName.includes("pycharm")) {
          this.installedApps.set("pc", info);
          this.installedApps.set("pycharm", info);
        } else if (lowerName.includes("rustrover")) {
          this.installedApps.set("rr", info);
          this.installedApps.set("rustrover", info);
        } else if (lowerName.includes("webstorm")) {
          this.installedApps.set("ws", info);
          this.installedApps.set("webstorm", info);
        } else if (lowerName.includes("goland")) {
          this.installedApps.set("go", info);
          this.installedApps.set("goland", info);
        } else if (lowerName.includes("clion")) {
          this.installedApps.set("cl", info);
          this.installedApps.set("clion", info);
        } else if (lowerName.includes("rider")) {
          this.installedApps.set("rd", info);
          this.installedApps.set("rider", info);
        } else if (lowerName.includes("datagrip")) {
          this.installedApps.set("db", info);
          this.installedApps.set("datagrip", info);
        }
      }
    } catch (binErr) {
      // ignore
    }
  }

  /**
   * 根据项目或 IDE 特征查找最佳启动器信息
   * @param {Object} project
   * @returns {Object|null}
   */
  findAppForProject(project) {
    if (!project) return null;

    const keys = [
      (project.dirName || "").toLowerCase(),
      (project.ideCode || "").toLowerCase(),
      (project.ideShortName || "").toLowerCase(),
      (project.ideName || "").toLowerCase()
    ];

    for (const key of keys) {
      if (!key) continue;
      for (const [mapKey, info] of this.installedApps.entries()) {
        if (key.includes(mapKey) || mapKey.includes(key)) {
          return info;
        }
      }
    }

    return null;
  }
}

export const ideLocator = new IdeLocator();
