/**
 * 基于浏览器原生 DOMParser 的高性能 recentProjects.xml 解析器
 */

/**
 * 解析 recentProjects.xml 文本
 * @param {string} xmlText XML 原始文本
 * @param {string} homeDir 用户家目录绝对路径（用于展开 $USER_HOME$）
 * @param {Object} product 所属产品元数据
 * @param {string} dirName 配置目录名称（如 IntelliJIdea2026.2）
 * @returns {Array<Object>} 项目列表
 */
export function parseRecentProjectsXml(xmlText, homeDir, product, dirName) {
  if (!xmlText || typeof xmlText !== "string") {
    return [];
  }

  const projects = [];

  try {
    // 替换 $USER_HOME$ 为标准路径格式（统一使用标准正斜杠，避免转义错误）
    const normalizedHome = (homeDir || "").replace(/\\/g, "/").replace(/\/$/, "");
    let safeXml = xmlText.replace(/\$USER_HOME\$/g, normalizedHome);

    const parser = new DOMParser();
    const doc = parser.parseFromString(safeXml, "application/xml");

    // 检查 XML 解析错误
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      console.warn(`[XmlParser] XML 解析警告 (${dirName}):`, parserError.textContent);
    }

    // 查找所有 <entry key="...">
    const entries = doc.querySelectorAll("entry[key]");

    if (entries && entries.length > 0) {
      entries.forEach((entry) => {
        let rawPath = entry.getAttribute("key");
        if (!rawPath) return;

        let projectPath = rawPath.trim();
        const metaInfo = entry.querySelector("RecentProjectMetaInfo");
        let frameTitle = "";
        let binFolder = "";
        let build = "";
        let productionCode = "";
        let activationTimestamp = 0;
        let projectOpenTimestamp = 0;

        if (metaInfo) {
          frameTitle = metaInfo.getAttribute("frameTitle") || "";
          binFolder = metaInfo.getAttribute("binFolder") || "";
          build = metaInfo.getAttribute("build") || "";
          productionCode = metaInfo.getAttribute("productionCode") || "";

          const options = metaInfo.querySelectorAll("option");
          options.forEach((opt) => {
            const name = opt.getAttribute("name");
            const val = opt.getAttribute("value");
            if (!name || !val) return;

            if (name === "activationTimestamp") {
              activationTimestamp = parseInt(val, 10) || 0;
            } else if (name === "projectOpenTimestamp") {
              projectOpenTimestamp = parseInt(val, 10) || 0;
            } else if (name === "binFolder" && !binFolder) {
              binFolder = val;
            } else if (name === "build" && !build) {
              build = val;
            } else if (name === "productionCode" && !productionCode) {
              productionCode = val;
            }
          });
        }

        const cleanPath = projectPath.replace(/[\\/]+$/, "");
        const parts = cleanPath.split(/[\\/]/);
        const folderName = parts[parts.length - 1] || cleanPath;
        const projectName = folderName;

        const finalTimestamp = projectOpenTimestamp || activationTimestamp || 0;

        projects.push({
          id: `${dirName}_${projectPath}`,
          name: projectName,
          frameTitle: frameTitle,
          path: projectPath,
          ideCode: productionCode || product.code,
          ideName: product.name,
          ideShortName: product.shortName,
          ideColor: product.color,
          ideIcon: product.icon,
          dirName: dirName,
          openTimestamp: finalTimestamp,
          activationTimestamp: activationTimestamp,
          binFolder: binFolder,
          build: build
        });
      });
    }

    // 防御性兜底：若 DOM 查询未捕获到结果，启动双轨流式正则提取
    if (projects.length === 0) {
      const entryRegex = /<entry\s+[^>]*key="([^"]+)"[^>]*>([\s\S]*?)<\/entry>/gi;
      let match;
      while ((match = entryRegex.exec(safeXml)) !== null) {
        const rawPath = match[1];
        const body = match[2];
        if (!rawPath) continue;

        const frameMatch = /frameTitle="([^"]+)"/i.exec(body);
        const actMatch = /name="activationTimestamp"\s+value="(\d+)"/i.exec(body);
        const openMatch = /name="projectOpenTimestamp"\s+value="(\d+)"/i.exec(body);

        const projectPath = rawPath.trim();
        const cleanPath = projectPath.replace(/[\\/]+$/, "");
        const parts = cleanPath.split(/[\\/]/);
        const folderName = parts[parts.length - 1] || cleanPath;
        const projectName = folderName;
        const frameTitle = frameMatch ? frameMatch[1] : "";

        const actTime = actMatch ? parseInt(actMatch[1], 10) : 0;
        const openTime = openMatch ? parseInt(openMatch[1], 10) : 0;

        projects.push({
          id: `${dirName}_${projectPath}`,
          name: projectName,
          frameTitle: frameTitle,
          path: projectPath,
          ideCode: product.code,
          ideName: product.name,
          ideShortName: product.shortName,
          ideColor: product.color,
          ideIcon: product.icon,
          dirName: dirName,
          openTimestamp: openTime || actTime || 0,
          activationTimestamp: actTime,
          binFolder: "",
          build: ""
        });
      }
    }
  } catch (error) {
    console.error(`[XmlParser] 解析 recentProjects.xml 失败 (${dirName}):`, error);
  }

  return projects;
}
