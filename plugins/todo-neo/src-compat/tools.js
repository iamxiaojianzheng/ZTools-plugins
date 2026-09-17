/**
 * Todo-Neo 待办 AI Tools (MCP 契约工具集合)
 * 纯 Web JS 实现，直接操作双轨数据库兼容层
 */

import { db, dbStorage } from "./database.js";

const TASKS_PREFIX = "todo-tasks/";
const GROUPS_PREFIX = "todo-group/";
const NEXT_TASK_SORT_KEY = "mcp-next-task-sort";
const NEXT_GROUP_SORT_KEY = "mcp-next-group-sort";

function getDbDocValue(doc) {
  return doc && (doc.value || doc);
}

export function getAllTasks() {
  const docs = db.allDocs(TASKS_PREFIX) || [];
  return docs
    .filter((doc) => doc._id?.startsWith(TASKS_PREFIX) && !doc.$deprecated)
    .map((doc) => ({ _id: doc._id, ...getDbDocValue(doc) }));
}

export function getAllGroups() {
  const docs = db.allDocs(GROUPS_PREFIX) || [];
  return docs
    .filter((doc) => doc._id?.startsWith(GROUPS_PREFIX) && !doc.$deprecated)
    .map((doc) => ({ _id: doc._id, ...getDbDocValue(doc) }))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

export function getTaskById(id) {
  const fullId = id.startsWith(TASKS_PREFIX) ? id : `${TASKS_PREFIX}${id}`;
  const doc = db.get(fullId);
  if (!doc || doc.$deprecated) return null;
  return { _id: doc._id, ...getDbDocValue(doc) };
}

export function putDoc(id, value) {
  dbStorage.setItem(id, value);
  return db.put({ _id: id, value });
}

function nextSort(key) {
  const current = dbStorage.getItem(key) || 0;
  const next = Number(current) + 1;
  dbStorage.setItem(key, next);
  return next;
}

export function getGroupNameById(id) {
  return getAllGroups().find((group) => group._id === id)?.title || "";
}

export function getGroupIdByName(name) {
  return getAllGroups().find((group) => group.title === name)?._id || null;
}

export function getOrCreateGroup(name) {
  const existing = getGroupIdByName(name);
  if (existing) return existing;
  const now = Date.now();
  const id = `${GROUPS_PREFIX}${now}`;
  putDoc(id, {
    title: name,
    sort: nextSort(NEXT_GROUP_SORT_KEY),
    created_at: now
  });
  return id;
}

function formatDateTime(timestamp) {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseDueAt(value) {
  if (!value) return undefined;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

// 1. 列出所有分组
export async function todoGroupList() {
  return {
    groups: getAllGroups().map((group) => ({ name: group.title }))
  };
}

// 2. 搜索待办
export async function todoSearch({ query, group, status, dueAt } = {}) {
  let tasks = getAllTasks();
  if (query) {
    const keyword = query.toLowerCase();
    tasks = tasks.filter((task) => task.text?.toLowerCase().includes(keyword));
  }
  if (group) {
    const groupId = getGroupIdByName(group);
    tasks = groupId ? tasks.filter((task) => task.groupId === groupId) : [];
  }
  if (status === "done") tasks = tasks.filter((task) => task.completed);
  if (status === "pending") tasks = tasks.filter((task) => !task.completed);
  if (dueAt) {
    const due = parseDueAt(dueAt);
    tasks = tasks.filter((task) => task.dueAt && task.dueAt <= due);
  }

  return {
    tasks: tasks
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map((task) => ({
        id: task._id,
        text: task.text,
        group: getGroupNameById(task.groupId),
        completed: Boolean(task.completed),
        dueAt: formatDateTime(task.dueAt),
        completed_at: formatDateTime(task.completed_at),
        created_at: formatDateTime(task.created_at)
      }))
  };
}

// 3. 创建待办
export async function todoCreate({ content, dueAt, group }) {
  const now = Date.now();
  const id = `${TASKS_PREFIX}${now}`;
  const groupId = group ? getOrCreateGroup(group) : `${GROUPS_PREFIX}pending`;
  const task = {
    text: content,
    groupId,
    completed: false,
    created_at: now,
    sort: nextSort(NEXT_TASK_SORT_KEY),
    dueAt: parseDueAt(dueAt)
  };
  putDoc(id, task);
  return {
    id,
    text: task.text,
    group: group || "待处理",
    dueAt: formatDateTime(task.dueAt),
    created_at: formatDateTime(task.created_at)
  };
}

// 4. 更新待办
export async function todoUpdate({ id, patch }) {
  const task = getTaskById(id);
  if (!task) throw new Error(`待办事项不存在: ${id}`);
  const updated = { ...task };
  delete updated._id;

  if (patch.content !== undefined) updated.text = patch.content;
  if (patch.status === "done") {
    updated.completed = true;
    updated.completed_at = Date.now();
    if (!updated.first_completed_at) updated.first_completed_at = updated.completed_at;
  }
  if (patch.status === "pending") {
    updated.completed = false;
    delete updated.completed_at;
  }
  if (patch.dueAt !== undefined) {
    const due = parseDueAt(patch.dueAt);
    if (due) updated.dueAt = due;
    else delete updated.dueAt;
  }
  if (patch.group !== undefined) updated.groupId = getOrCreateGroup(patch.group);

  putDoc(task._id, updated);
  return {
    id: task._id,
    text: updated.text,
    group: getGroupNameById(updated.groupId),
    completed: Boolean(updated.completed),
    dueAt: formatDateTime(updated.dueAt),
    updated: true
  };
}

export const toolHandlers = {
  todo_group_list: todoGroupList,
  todo_search: todoSearch,
  todo_create: todoCreate,
  todo_update: todoUpdate
};
