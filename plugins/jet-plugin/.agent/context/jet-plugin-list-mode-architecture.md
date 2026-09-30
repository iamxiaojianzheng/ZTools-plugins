# Jet-plugin 原生 List 模式适配与架构契约

## 1. 模块职责
本模块负责在 Ruck 宿主主搜索框下以原生列表交互形态展示本机已安装的 JetBrains 系列 IDE（IntelliJ IDEA、PyCharm、GoLand、RustRover、WebStorm 等）的最近打开工程，支持毫秒级缓存直出、即时模糊搜索过滤、回车调用系统进程拉起对应 IDE 打开工程，并随之关闭/隐藏搜索主窗。

## 2. 模式契约与接口规范
本插件弃用传统自建 HTML/UI 弹窗（避免额外窗口与样式割裂），全面对齐 Ruck 宿主的 `ListModeDriver` 规范：

- **配置文件契约 (`plugin.json`)**：
  - 声明 `preload: "preload.js"`，移除了 `main: "index.html"` 与 `pluginType: "ui"`；
  - 声明精确的权限白名单：`file_system_read`、`shell_execute`（明确限制可拉起的 IDE 可执行文件，如 `idea64.exe`、`pycharm64.exe`、`open`、`cmd.exe` 等）、`window_control`、`notification`；
  - 触发词配置于 `features`，如 `code: "all"`, `cmds: ["jb", "IDE", "JetBrains", ...]`。

- **文件系统契约 (`ruck.fs.readDir`)**：
  - Ruck 宿主受控沙箱的 `readDir(path)` 返回标准 `Entry[]` 对象数组（`{ name, path, isDirectory, isFile, isSymlink }`）；
  - 插件侧保持双模防御兼容，优先依据 `isDirectory: false` 剔除非目录条目，并安全解析 `dirName`。

- **本地启动器嗅探契约 (`IdeLocator`)**：
  - 自动在 Windows（`C:/Program Files/JetBrains`, `%LOCALAPPDATA%/Programs/JetBrains` 等）、macOS、Linux 常见目录嗅探已安装 IDE；
  - 动态建立绝对路径映射（如 `C:/Program Files/JetBrains/IntelliJ IDEA 2025.3/bin/idea64.exe`）；
  - 提取本地或内置的 JetBrains 官方正版矢量 SVG 图标（包含官方折角几何多边形与立体双渐变）；
  - 消除对用户系统环境变量 `PATH` 的依赖，杜绝裸命令导致 Windows 弹窗“找不到文件”。

- **运行时导出契约 (`preload.js` / `window.exports`)**：
  ```javascript
  window.exports = {
    all: {
      mode: "list",
      args: {
        placeholder: "搜索项目（支持模糊匹配）",
        enter: (action, callbackSetList) => void,
        search: (action, searchWord, callbackSetList) => void,
        select: (action, itemData, callbackSetList) => void
      }
    }
  }
  ```

- **列表项数据契约 (Item Schema)**：
  - `title`: 项目工程名称（如 `demodemo`、`ruoyi`，取工程目录名）；
  - `description`: 格式为 `${projectPath} · ${ideName}`（如 `D:/IdeaProjects/ruoyi · IntelliJ IDEA`）；
  - `icon`: 对应 IDE 的官方 SVG/矢量图标数据或本地资源；
  - `path`: 项目完整绝对路径；
  - `frameTitle`: 最近打开窗口文件标题（用于深层搜索索引）。

## 3. 数据流与扫描机制
1. **0ms 缓存直出**：`enter()` 触发时，优先从 `localStorage` 读取上次扫描缓存推流给 `callbackSetList`，界面即时上屏，无卡顿。
2. **异步后台深扫**：
   - 通过 `ruck.path.homeDir()` 获取用户家目录，结合盘符或路径特征判定 `win32` / `darwin` / `linux` 操作系统；
   - 跨平台定位 JetBrains 配置根目录（Windows 为 `%APPDATA%/JetBrains`，macOS 为 `~/Library/Application Support/JetBrains`，Linux 为 `~/.config/JetBrains`）；
   - 读取该根目录下各 IDE 版本的 `options/recentProjects.xml`；
   - 双轨解析（DOMParser 解析 + 正则流式兜底），按最后打开时间戳倒序排序、去重；
   - 刷新本地缓存并通过 `callbackSetList` 再次推流更新。
3. **即时检索 (Search)**：
   - 内存过滤，支持拼音、大小写无关的工程名、项目绝对路径、IDE 名字及窗口文件名的多维模糊匹配。
4. **唤醒启动与自动收窗 (Select)**：
   - 用户选中条目并回车，执行器优先调用受控绝对路径 `ruck.shell.execute(ideExecutable, [projectPath])`；
   - 启动命令成功调用后（`launched === true`），执行器主动调用 `await hideAndOutPlugin()` 隐藏主搜索窗口，给用户极致流畅的启动体验；
   - 若拉起未成功，则保持窗口不关闭并气泡提示用户，便于排查。
