# Ruck 沙箱 IPC 参数契约与 AI 接口多签名防御案例

> **工件定位**：总结 Ruck (Tauri 2.0 Webview2) 沙箱跨进程调用底层参数序列化契约，剖析 `ai.chat` 接口因签名参数顺序导致的 `解析 ChatRequestDto 失败: invalid type: null` 根本原因与通用自适应防御准则。

---

## 1. 根本原因深度剖析 (Root Cause)

### 1.1 问题现象
调用 `ai.chat` 时后端抛出异常：
```json
{
    "category": "system",
    "code": "INTERNAL_ERROR",
    "message": "解析 ChatRequestDto 失败: invalid type: null, expected struct ChatRequestDto"
}
```
抓取的 IPC 发送参数为：
`[{"model":"","messages":[...]}, null]`

### 1.2 架构通信链路错位链条

```mermaid
flowchart TD
    A["插件层: ruck.ai.chat(request)"] -->|仅传 1 个参数| B["Webview 宿主 preload: chat(providerConfig, request)"]
    B -->|序列化参数| C["JSON.stringify([providerConfig, request])"]
    C -->|发送内容| D["[requestObject, null]"]
    D -->|跨进程 IPC| E["Rust 端: commands/sandbox/ai.rs"]
    E -->|args.get(0)| F["解析为 ProviderConfigDto (把 request 当配置)"]
    E -->|args.get(1)| G["解析为 ChatRequestDto (接收到 null，崩溃报错！)"]
```

1. **Rust 端参数索引契约**：
   在 `src-tauri/src/commands/sandbox/ai.rs` 中：
   - `args.get(0)`：严格对应 `ProviderConfigDto`；
   - `args.get(1)`：严格对应 `ChatRequestDto`；
2. **Webview 注入层签名**：
   在 `src-tauri/src/preload/sdk/ai.ts` 中：
   `chat: async (providerConfig, request) => callSandboxedApi('ai.chat', JSON.stringify([providerConfig, request]))`
   即第一参数为 `providerConfig`，第二参数为 `request`；
3. **插件层错误调用**：
   插件仅传递了单个参数 `ruck.ai.chat(request)`，导致第二参数变为 `undefined`，被 JSON 序列化为 `null`，Rust 端解析 `ChatRequestDto` 时命中 `null` 导致内部错误。

---

## 2. 解决方案与双向自适应规范

在垫片层实现自适应调用器，优先以 `({}, request)` 调用宿主注入层；若捕获签名不匹配错误则自动以 `(request, {})` 容错重试：

```javascript
async function invokeRuckAiChat(ruck, request) {
  // 1. 优先采用 Webview 宿主 preload 注入签名: chat(providerConfig, request)
  try {
    return await ruck.ai.chat({}, request);
  } catch (err) {
    const msg = String(err?.message || err || "");
    // 2. 容错分支: 若宿主为 @ruck/sdk 独立包签名: chat(request, providerConfig)
    if (msg.includes("ChatRequestDto") || msg.includes("ProviderConfigDto")) {
      return await ruck.ai.chat(request, {});
    }
    throw err;
  }
}
```
通过此适配策略，彻底抹平不同 SDK 打包形态与注入层之间的参数顺序差异。
