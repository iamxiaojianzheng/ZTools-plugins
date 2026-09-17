/**
 * Todos 快捷添加与 onMainPush 即时搜索联想引擎
 * 无需依赖 React 前端渲染，提供 0ms 本地持久化与静默快速入库
 */

import { getTodosData, persistTodosData } from "./database.js";

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
}

function stripPrefix(text = "") {
  return String(text).replace(/^(todo|待办|\+)\s*/i, "").trim();
}

function getStorageData() {
  return getTodosData();
}

function saveStorageData(data) {
  persistTodosData(data);
}

/**
 * 快速创建并持久化一条待办事项
 * @param {string} rawTitle 任务标题（支持自动剥离前缀）
 * @param {object} bridge 宿主桥接对象
 * @param {boolean} notify 是否弹出系统通知
 * @returns {object} 新建的 Task 对象
 */
export function quickAddTask(rawTitle, bridge, notify = true) {
  const title = stripPrefix(rawTitle);
  if (!title) return null;

  const data = getStorageData();
  const wsKey = data.currentWorkspace || "work";
  if (!Array.isArray(data.workspaces[wsKey])) {
    data.workspaces[wsKey] = [];
  }

  const today = formatDate(new Date());
  const newTask = {
    id: generateId(),
    title,
    description: "",
    priority: "medium",
    dates: [],
    status: "todo",
    createdAt: today,
    updatedAt: today
  };

  data.workspaces[wsKey].push(newTask);
  saveStorageData(data);

  // 通知正在前台运行的 React 应用更新状态
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      let evt = null;
      if (typeof CustomEvent === "function") {
        evt = new CustomEvent("todos-external-task-added", {
          detail: { workspace: wsKey, task: newTask }
        });
      } else if (typeof Event === "function") {
        evt = new Event("todos-external-task-added");
        evt.detail = { workspace: wsKey, task: newTask };
      }
      if (evt) {
        window.dispatchEvent(evt);
      }
    }
  } catch (err) {
    console.error("[TodosQuickAdd] Failed to dispatch custom event:", err);
  }

  if (notify && bridge?.showNotification) {
    bridge.showNotification(`已添加待办: ${title}`);
  }

  return newTask;
}

/**
 * 装配 onMainPush 搜索引擎与回调联动
 */
export function setupQuickAddEngine(bridge) {
  const ruck = typeof window !== "undefined" && window.ruck ? window.ruck : null;
  if (!ruck || typeof ruck.onMainPush !== "function") {
    console.warn("[TodosQuickAdd] window.ruck.onMainPush not found, skipping hook.");
    return;
  }

  ruck.onMainPush(
    async ({ code, type, payload, searchWord }) => {
      try {
        const rawText = typeof searchWord === "string" && searchWord !== "" 
          ? searchWord 
          : (typeof payload === "string" ? payload : "");
        const queryText = stripPrefix(rawText);

        const data = getStorageData();
        const wsKey = data.currentWorkspace || "work";
        const currentTasks = Array.isArray(data.workspaces[wsKey]) ? data.workspaces[wsKey] : [];

        // 1. 无输入内容：提供输入引导与最近待办速览
        if (!queryText) {
          const results = [
            {
              id: "quick-add-hint",
              title: "➕ 快捷添加待办",
              description: "输入待办内容后回车直接添加，或回车打开待办日历",
              icon: "logo.svg",
              payload: { action: "open" }
            }
          ];

          // 呈现最近 3 条未完成待办
          const uncompleted = currentTasks.filter((t) => t.status !== "done").slice(-3).reverse();
          for (const task of uncompleted) {
            results.push({
              id: `preview-${task.id}`,
              title: `📋 ${task.title}`,
              description: `待办事项 · 创建于 ${task.createdAt}`,
              icon: "logo.svg",
              payload: { action: "open", taskId: task.id }
            });
          }

          return results;
        }

        // 2. 有输入内容：置顶静默快捷添加选项
        const results = [
          {
            id: "quick-add-task-silent",
            title: `➕ 添加待办: ${queryText}`,
            description: "按回车快速添加至待办池（静默完成）",
            icon: "logo.svg",
            payload: { action: "add", title: queryText, open: false }
          },
          {
            id: "quick-add-task-and-open",
            title: `🚀 添加并打开: ${queryText}`,
            description: "添加至待办池并进入待办日历主界面",
            icon: "logo.svg",
            payload: { action: "add", title: queryText, open: true }
          }
        ];

        // 3. 联想已有包含该关键字的任务（最多 3 条）
        const lowerQ = queryText.toLowerCase();
        const matched = currentTasks
          .filter((t) => (t.title || "").toLowerCase().includes(lowerQ))
          .slice(0, 3);

        for (const task of matched) {
          results.push({
            id: `existing-${task.id}`,
            title: `📋 [已存在] ${task.title}`,
            description: `${task.status === "done" ? "已完成" : "待办"} · 创建于 ${task.createdAt}`,
            icon: "logo.svg",
            payload: { action: "open", taskId: task.id }
          });
        }

        return results;
      } catch (err) {
        console.error("[TodosQuickAdd] Error in onMainPush query:", err);
        return [];
      }
    },
    async ({ code, type, payload, option }) => {
      console.log("[TodosQuickAdd] onMainPush item selected:", option);
      const actionPayload = option?.payload || {};

      if (actionPayload.action === "add") {
        quickAddTask(actionPayload.title, bridge, true);
        // 若为 true 则进入插件，否则静默关闭主搜索框
        return Boolean(actionPayload.open);
      }

      if (actionPayload.action === "open") {
        return true;
      }

      return false;
    }
  );

  console.log("[TodosQuickAdd] onMainPush search & add engine registered successfully.");
}
