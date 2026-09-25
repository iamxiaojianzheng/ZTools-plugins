# Knowledge Item: Ruck 网络沙箱代理识别机制与跨域故障排查

## 1. 模块职责
Ruck 网络沙箱（`fetch-proxy.ts` / `xhr-proxy.ts` / `ws-proxy.ts` / `commands::http`）负责在 Webview 前端拦截插件发起的网络请求（Fetch、XMLHttpRequest、WebSocket），将请求桥接到 Rust 后端（`reqwest`）执行代理请求，突破浏览器同源策略（CORS）与受限 Header 限制，并提供域名与权限控制。

## 2. 接口与契约
- **前端注入拦截**：
  - `installFetchProxy()`：重写 `window.fetch`，将 HTTP/HTTPS 请求重定向至 `commonProxyRequest`。
  - `installXhrProxy()`：以 `SandboxedXHR` 替换 `window.XMLHttpRequest`。
  - `installWsProxy()`：以 `SandboxedWebSocket` 替换 `window.WebSocket`。
- **IPC 通讯契约**：
  - 前端通过 `invoke('plugin_http_fetch', { pluginName, url, options })` 调用后端。
  - 选项包含 `method`、`headers`、`body`（二进制通过 Base64 编码传递）及 `is_body_base64`。
- **后端执行契约**：
  - `commands::http::proxy_http_request` 校验插件声明的 `network_access` 或具体域名权限后通过 `reqwest::Client` 发出外部请求。

## 3. 故障根因与边界约束 (Windows WebView2)
- **协议映射与误判风险**：
  - 在 Windows WebView2 运行时下，自定义协议 `ruck://localhost/...` 在页面内部映射为 `http://ruck.localhost/...`，其 `window.location.protocol` 为 `'http:'`。
  - 本地 Vite 开发调试时，URL 为 `http://localhost:5173`，`window.location.protocol` 亦为 `'http:'`。
- **致命缺陷**：
  - 若在代理安装时以 `if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return;` 作为判断“外部公网网页”的标准，将直接误伤 Windows 本地插件和本地开发插件，导致代理直接退出。
  - 代理未安装时，Axios/Fetch 回退到 WebView2 原生浏览器网络栈，触发浏览器同源策略（CORS）拦截，产生 `AxiosError: Network Error`。
- **治理标准**：
  - 必须严格使用 `isLocalEnvironment()` 检测（检查 host 是否为 `localhost`、`127.0.0.1`、`*.localhost` 或 `ruck.` 开头，或协议是否为 `ruck:`），仅在非本地且为外部公网页面时豁免代理。

## 4. Tauri IPC 命令命名规范与大小写约束
- **Rust 后端注册标准**：
  - Rust 函数名统一为蛇形命名法（如 `sandboxed_api_call_fs_write_raw`），在宏 `tauri::generate_handler![...]` 注册后，命令分发名称**严格保留蛇形命名**。
- **前端调用约束**：
  - 前端 `invoke('...')` 必须使用与 Rust 函数名一致的蛇形命名（如 `invoke('sandboxed_api_call_fs_write_raw')`），严禁手写成小驼峰（`sandboxedApiCallFsWriteRaw`），否则会导致 `Command not found` 致命异常。
