/**
 * Jet-plugin Ruck 原生 List 模式核心 Preload 脚本
 *
 * 遵循 Ruck 官方 ListModeDriver 契约，输出 window.exports.all (mode: "list")
 */

import { scanner } from "./core/scanner.js";
import { launchProject } from "./core/executor.js";

// 内存中缓存当前全量项目列表，供 search 快速即时过滤
let currentProjects = [];

/**
 * 列表搜索过滤函数
 * @param {string} searchWord 用户输入的搜索词
 * @returns {Array<Object>}
 */
function search(searchWord) {
  const query = (searchWord || "").trim().toLowerCase();
  if (!query) {
    return currentProjects;
  }

  return currentProjects.filter((item) => {
    const nameMatch = (item.title || item.name || "").toLowerCase().includes(query);
    const pathMatch = (item.path || "").toLowerCase().includes(query);
    const ideMatch = (item.ideName || "").toLowerCase().includes(query);
    const frameMatch = (item.frameTitle || "").toLowerCase().includes(query);
    return nameMatch || pathMatch || ideMatch || frameMatch;
  });
}

/**
 * 将扫描出的原始项目规范化为 ListModeDriver 期望的条目格式
 * @param {Object} item
 * @returns {Object}
 */
function formatProjectItem(item) {
  const ideDesc = item.ideName || item.dirName || "JetBrains IDE";
  return {
    ...item,
    title: item.name || item.title || "",
    description: `${item.path} · ${ideDesc}`,
    icon: item.ideIcon || "logo.png"
  };
}

// 导出 Ruck List 模式规范对象
const listConfig = {
  mode: "list",
  args: {
    placeholder: "搜索项目（支持模糊匹配）",

    /**
     * 进入插件时调用
     */
    enter: (action, callbackSetList) => {
      console.log("[jet-plugin] 激活 List 模式:", action);

      // 遵循架构规范：在插件自身的 enter 回调中挂载兼容垫片，宿主保持绝对纯净
      if (typeof window.utools === "undefined" && window.ruck) {
        window.utools = window.ruck;
      }
      if (typeof window.ztools === "undefined" && window.ruck) {
        window.ztools = window.ruck;
      }

      // 1. 0ms 尝试从缓存直接恢复首屏
      const cached = scanner.readFromCache();
      if (cached && Array.isArray(cached.projects) && cached.projects.length > 0) {
        currentProjects = cached.projects.map(formatProjectItem);
        callbackSetList(search(""));
      }

      // 2. 异步发起全量文件系统扫描，获得最新项目并即时推流更新
      scanner
        .scan()
        .then((latestProjects) => {
          if (Array.isArray(latestProjects) && latestProjects.length > 0) {
            currentProjects = latestProjects.map(formatProjectItem);
            callbackSetList(search(""));
          }
        })
        .catch((err) => {
          console.error("[jet-plugin] 扫描项目历史异常:", err);
          if (currentProjects.length === 0) {
            callbackSetList([]);
          }
        });
    },

    /**
     * 用户在主搜索框键入内容时即时触发
     */
    search: (action, searchWord, callbackSetList) => {
      const filtered = search(searchWord);
      callbackSetList(filtered);
    },

    /**
     * 用户选中某一项按回车时调用
     */
    select: (action, itemData, callbackSetList) => {
      console.log("[jet-plugin] 用户选中条目:", itemData);
      const project = itemData?.rawItem || itemData;
      launchProject(project);
    }
  }
};

// 挂载到 window.exports 供 Ruck TemplateSandbox 提取
window.exports = {
  all: listConfig,
  "jet-plugin": listConfig,
  "@ruck-plugins/jet-plugin": listConfig
};

console.log("✅ Jet-plugin Ruck 原生 List 模式 Preload 装配完成");
