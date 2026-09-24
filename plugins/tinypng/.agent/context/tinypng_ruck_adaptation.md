# Knowledge Item: TinyPNG 插件架构与 Ruck 运行时适配规范

## 1. 模块职责
TinyPNG 是基于 Vue 3 + TypeScript 开发的高保真图片压缩插件，通过调用 TinyPNG 开放 API 提供本地 PNG/JPG/WEBP 单图或批量递归压缩、进度管理、一键覆盖原图与剪贴板导出能力。

## 2. 接口与契约
### 宿主接口契约 (`window.ztools` / `window.utools`)
- `getPath('temp')`: 获取本地系统临时缓存根路径。
- `copyFile(files: string | string[])`: 将指定文件路径写入系统剪贴板（作为系统文件）。
- `showNotification(msg: string)`: 唤起宿主轻提示。
- `getPathForFile(file: File)`: 从 DOM 拖拽文件对象中提取本地完整绝对路径。
- `onPluginEnter(callback)` / `onPluginOut(callback)`: 监听插件激活进入与退出生命周期。

### 业务接口契约 (`window.services`)
- `handlePluginEnter(action: { code, type, payload })`: 解析拖拽/选择的文件及目录，递归遍历图片并计算尺寸，生成临时文件目标路径，派发 `tinyping-compression` 事件。
- `readFile(path: string): Promise<Uint8Array | Buffer>`: 二进制读取本地源文件。
- `writeFile(path: string, data: ArrayBuffer | Uint8Array): Promise<void>`: 确保父目录存在并二进制写入文件。
- `readDir(path: string): Promise<string[]>`: 列出目录下所有文件路径。
- `replaceFiles(files: [string, string][]): Promise<void>`: 文件流覆盖复制替换原图。

## 3. Ruck 运行时环境边界与适配策略
- **沙箱与无 Node 环境**：Ruck 基于 Tauri 2.0 Webview2 构建，前端无 `node:fs` 或 `node:path`。通过 `window.ruck.fs`、`window.ruck.path`、`window.ruck.clipboard`、`window.ruck.notification` 提供原子系统能力。
- **二进制数据流转**：
  - `ruck.fs.readFile(path, { encoding: 'binary' })` 返回 `Uint8Array`。
  - `ruck.fs.writeFile(path, data, { encoding: 'binary' })` 支持 `ArrayBuffer` 与 `Uint8Array`。
  - `ruck.fs.copyFile(src, dest)` 代替原有的 Node.js Stream Pipe 复制。
- **本地图片协议边界**：
  - Chromium/Webview2 禁止在自定义协议 (`ruck://`) 下加载 `file:///` 资源。
  - Ruck 开放了 `assetProtocol`，Windows 下将本地路径转换为 `http://asset.localhost/<path>` 加载。
- **网络请求穿透**：
  - Ruck 底层内置 `SandboxedXHR` 和 `commonProxyRequest` 拦截器，自动接管 Axios 发送的跨域请求及特殊请求头（`X-Forwarded-For` 等），无须担心浏览器同源策略限制。
- **冷启动时序防竞态**：
  - 采用双向握手机制（`tinyping-compression-ready`），防止 Vue 组件挂载前进入事件丢失。
