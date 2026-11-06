# Knowledge Item: Virtual Data 插件架构与 Ruck 运行时适配规范

## 1. 模块职责
`virtual-data` 是一个基于 Vue 3 + Naive UI + Mock.js 开发的虚拟数据生成器插件。它支持配置自定义 Mock.js 模板代码、对数据规则进行列表管理与拖拽排序、并在主界面通过卡片/列表双视图点击即时生成测试数据并自动复制到剪贴板，极大简化了开发和测试阶段的数据构造工作。

## 2. 接口与契约
### 宿主接口契约 (`window.ztools` / `window.utools`)
- `onPluginEnter(callback)` / `onPluginOut(callback)`: 监听插件激活进入与退出生命周期，传入 `action` 对象（`code`, `type`, `payload`）。
- `outPlugin(isKill?: boolean)`: 退出/切出插件。
- `hideMainWindow()`: 隐藏宿主主窗口。
- `db.promises.get(id: string)`: 异步获取持久化文档对象（包含 `_id`, `_rev` 等字段）。
- `db.promises.put(doc: object)`: 异步创建或更新持久化文档对象，返回 `{ id, ok, rev }`。
- `db.promises.allDocs(prefix?: string)`: 异步按前缀拉取所有文档列表。
- `db.promises.remove(id: string)`: 异步删除指定 ID 的持久化文档。

### 业务与剪贴板契约
- 数据前缀: `virtual-data-`，存储用户配置的每个生成规则项（包含 `_id`, `name`, `code`, `sort`, `createdAt`, `updatedAt`）。
- 全局配置: `settings-main`，存储用户偏好（`clickToCopy`, `showCopyTip`, `closeAfterCopy`, `displayShape`）。
- 剪贴板交互: `copyContent(content)` 将生成的 Mock 文本写入系统剪贴板。

## 3. Ruck 运行时环境边界与适配规范
- **运行环境差异**:
  - 原运行环境为 Electron (ZTools)，依赖 Node.js 的 `public/preload/services.js`；
  - 目标运行环境为 Ruck (Tauri 2.0 + Webview2)，纯 Web 沙箱环境，无 Node.js 内置模块（`node:fs`, `node:path`）；
  - Ruck 原生通过 `window.ruck` 暴露 `clipboard`, `window`, `notification`, `storage` 等 IPC 能力。
- **双轨持久化 (Dual-Track Persistence)**:
  - 针对 `ztools.db.promises` 契约，构建“内存 Map + localStorage 同步双写 + IndexedDB 异步落盘”体系；
  - 在模块加载阶段 0ms 同步从 `localStorage` 反序列化预热，消除 Webview 异步冷启动阶段的空白或竞态。
- **生命周期保底与 Action Code 归一化**:
  - Ruck 宿主启动可能传入 `code: "default"` 或 `code: "main"`，需规范化为插件默认 code `"xn"`；
  - 提供 150ms 冷启动保底 dispatch 机制，确保 Vue 根组件挂载后总能稳定接收激活事件。
- **全局 Escape 快捷退出与键盘治理**:
  - 捕获 `Escape` 键盘事件，在非活动输入框状态下调用 `window.ztools.outPlugin()` 退出窗口。
- **构建管线对齐**:
  - 采用模块化解耦规范 `src-compat/`（`index.js`, `ztools.js`, `database.js`, `services.js`）；
  - 新增 `build-compat.js`，通过 esbuild 编译出独立的 `preload.js`；
  - 将包名更新为 `@ruck-plugins/virtual-data`，并在 `public/plugin.json` 和根目录 `plugin.json` 中配置 `pluginType: "ui"`、`preload.js` 及对应权限项（`clipboard_write`, `window_control`, `storage_get`, `storage_put`, `storage_delete`, `notification`）。
