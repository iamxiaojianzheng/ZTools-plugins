# Ruck 桌面端 AI 能力契约与插件适配指南

> **知识定位**：本文档梳理 Ruck（Tauri 2.0 后端 + Webview2 前端沙箱）的 AI 原生能力架构、SDK 接口规范，以及存量 uTools / ZTools 插件（如 `color-helper`）对 `ai.chat` 接口的标准化桥接适配方案。

---

## 1. 架构全景与对比分析

| 维度 | 原平台规范 (uTools / ZTools) | Ruck 目标规范 (`@ruck/sdk` / `window.ruck.ai`) |
| :--- | :--- | :--- |
| **宿主调用入口** | `window.ztools.ai({ model, messages })` | `window.ruck.ai.chat(request, providerConfig?)`<br>`window.ruck.ai.chatStream(...)` |
| **权限控制** | 需在 `plugin.json` 中配置 `"ai": true` | **免权限通用能力**（Rust 核心沙箱已声明 `Permission::None`） |
| **模型调度机制** | 平台中心云端代理（如固定豆包、文心等） | **用户自主配置 Provider**（支持 OpenAI、Ollama、Anthropic、Azure OpenAI 及兼容服务商） |
| **模型缺省策略** | 必须由插件传指定 model（如 `doubao-1.5-pro-32k`） | **自适应默认配置**：若插件传入 model 为空，自动继承用户在 Ruck 设置中心激活的模型 |
| **返回值契约** | `Promise<{ content: string }>` | `Promise<string>`（直接返回大模型回答的纯文本全量字符串） |
| **流式能力** | 历史版本通常仅支持同步/Promise | 完整支持 `chatStream(request, onChunk, providerConfig?)` |

---

## 2. Ruck SDK AI 模块接口契约

### 2.1 核心数据结构

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestDto {
  model: string;                    // 模型标识符（传空字符串时自动使用 Ruck 设置中的默认模型）
  messages: ChatMessage[];          // 对话上下文
  temperature?: number;             // 采样温度
  max_tokens?: number;              // 最大生成 Token
  think?: boolean;                  // 是否开启思考链推理
  reasoning_effort?: string;        // 推理强度
}

export interface ProviderConfigDto {
  provider_type?: 'openai' | 'ollama' | 'anthropic' | 'azure-openai' | string;
  api_key?: string;
  api_base?: string;
  api_version?: string;
  organization_id?: string;
  model?: string;
}
```

### 2.2 API 方法清单 (`window.ruck.ai`)

- `chat(request: ChatRequestDto, providerConfig?: ProviderConfigDto): Promise<string>`
  非流式生成，收集全部 Token 后一次性返回完整结果文本。
- `chatStream(request: ChatRequestDto, onChunk: (chunk: string) => void, providerConfig?: ProviderConfigDto): Promise<void>`
  流式生成，逐字分块派发至前端回调。
- `fetchModels(providerConfig?: ProviderConfigDto): Promise<string[]>`
  获取当前提供商支持的模型列表。
- `checkHealth(providerConfig?: ProviderConfigDto): Promise<void>`
  服务连通性健康检查。
- `abortChatStream(requestId: string): Promise<void>`
  中止正在进行的流式生成。

---

## 3. 标准双向适配与兼容方案

```mermaid
flowchart LR
    A[业务组件: AIPalettePage / ImagePalettePage] -->|aiChat(messages, model)| B[平台适配层: utils/platform.ts]
    B -->|platform.ai({ model, messages })| C[垫片层: src-compat/ztools.js]
    C -->|协议转换与模型缺省处理| D[Ruck SDK: window.ruck.ai.chat]
    D -->|Rust IPC / Tauri 沙箱| E[Ruck 后端: RuntimeExecutor]
    E -->|大模型请求| F[(OpenAI / DeepSeek / Ollama)]
    F -->|返回完整字符串| E
    E -->|String| D
    D -->|String| C
    C -->|包装为 { content: text }| B
    B -->|Promise&lt;{content}&gt;| A
```

### 3.1 垫片层协议转换代码规范 (`ztools.js`)

```javascript
// 判定环境是否具备 AI 能力
isAIAvailable() {
  const ruck = getRuck();
  return !!(ruck?.ai?.chat || typeof ruck?.ai === "function");
},

// 抹平入参与出参差异
async ai(options = {}) {
  const ruck = getRuck();
  if (ruck?.ai?.chat) {
    const request = {
      // 若业务方传入的为旧平台死模型名（如 doubao-*），转为空字符串以使用 Ruck 用户的配置模型
      model: (options.model && !options.model.startsWith("doubao-")) ? options.model : "",
      messages: (options.messages || []).map(m => ({
        role: m.role || "user",
        content: String(m.content || "")
      })),
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    // Ruck 返回纯文本 String
    const result = await ruck.ai.chat(request);
    const content = typeof result === "string" ? result : (result?.content || String(result || ""));

    // 转换为原业务期望的 { content } 结构
    return { content };
  }

  throw new Error("当前环境未配置 AI 能力支持");
}
```
