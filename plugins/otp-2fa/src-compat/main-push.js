/**
 * src-compat/main-push.js
 * otp-2fa 搜索框即时联想与快捷键入引擎 (mainPush)
 * 无需渲染前端 Vue 视图，直接交互 ruck.db，实现 0ms 响应、模糊搜索、实时动态码计算与自动粘贴
 * 
 * 对齐 Ruck 插件规范（参考 codehelper）：
 * 1. 结果项不硬编码 icon 相对路径，交由 Ruck 原生从 plugin.json 的 logo 自动注入 group.pluginLogo
 * 2. 深度适配 Ruck 的 payload 对象参数，精准提取 searchWord
 * 3. 当用户输入明确搜索词且无匹配项时，直接返回空数组 []，不展示无关结果
 */

import { db, initDatabase } from "./database.js";
import { getOTP } from "../src/utils/otp.ts";
import { deriveKey, decryptSecret, importKeyFromRaw, hashVerifier } from "../src/utils/crypto.ts";
import { matchesPinyin } from "../src/utils/pinyin.ts";

const STORAGE_KEY = "otp_accounts_v1";
const CONFIG_KEY = "otp_config_v1";
const HW_SALT = new Uint8Array([
  90, 84, 111, 111, 108, 115, 45, 72, 97, 114, 100, 119, 97, 114, 101,
]); // "ZTools-Hardware"

// 内存中缓存已解锁的主密钥，避免每次击键重复 600,000 次 PBKDF2 运算
let cachedMasterKey = null;
let cachedMasterKeyHash = null;

function extractSearchQuery(payload) {
  let text = "";
  if (typeof payload === "string") {
    text = payload;
  } else if (payload && typeof payload === "object") {
    text = payload.searchWord || payload.text || payload.rawText || payload.payload || "";
  }
  return text
    .replace(/^(?:2fa|otp|yzm|验证码|动态验证码|otp-2fa)\s*/i, "")
    .trim();
}

function formatCode(code) {
  if (!code || typeof code !== "string") return code;
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

function getTimeLeft(acc) {
  const period = Number(acc.period || 30);
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = nowSec % period;
  return Math.max(1, period - elapsed);
}

function isMatch(acc, query, scheme) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = (acc.name || "").toLowerCase();
  if (name.includes(q)) return true;
  if (acc.issuer && acc.issuer.toLowerCase().includes(q)) return true;
  try {
    if (matchesPinyin(acc.name || "", q, scheme)) return true;
  } catch {}
  return false;
}

async function tryGetMasterKey(bridge) {
  if (cachedMasterKey) return cachedMasterKey;
  try {
    const configDoc = db.get(CONFIG_KEY);
    if (!configDoc || !configDoc.hardwareEncryptedKey || !configDoc.verifier) {
      return null;
    }
    const nativeId = bridge.getNativeId();
    if (!nativeId) return null;

    const hwKey = await deriveKey(nativeId, HW_SALT);
    const rawKey = await decryptSecret(configDoc.hardwareEncryptedKey, hwKey);
    if (rawKey) {
      const verifier = await hashVerifier(rawKey);
      if (verifier === configDoc.verifier) {
        cachedMasterKey = await importKeyFromRaw(rawKey);
        cachedMasterKeyHash = verifier;
        return cachedMasterKey;
      }
    }
  } catch (err) {
    console.warn("[OTPMainPush] Hardware auto-unlock failed:", err);
  }
  return null;
}

async function resolveAccountToken(acc, masterKey) {
  try {
    let secret = acc.secret;
    if (acc.encrypted && secret.includes(":")) {
      if (!masterKey) {
        return { isLocked: true };
      }
      secret = await decryptSecret(secret, masterKey);
    }
    const code = await getOTP({ ...acc, secret });
    const timeLeft = acc.type === "hotp" ? null : getTimeLeft(acc);
    return { isLocked: false, code, timeLeft };
  } catch (err) {
    return { isLocked: false, code: "Error", timeLeft: null };
  }
}

export function setupMainPushEngine(bridge) {
  bridge.onMainPush(
    async ({ code, type, payload }) => {
      try {
        await initDatabase();

        const query = extractSearchQuery(payload);

        let accountsDoc = db.get(STORAGE_KEY);
        // 若内存尚未加载完成，尝试直接从 ruck.storage 异步拉取
        if (!accountsDoc) {
          const ruck = typeof window !== "undefined" ? window.ruck : null;
          if (ruck?.storage?.get) {
            accountsDoc = await ruck.storage.get(STORAGE_KEY);
            if (accountsDoc) {
              db.put(accountsDoc);
            }
          }
        }

        const accounts = Array.isArray(accountsDoc?.data)
          ? accountsDoc.data
          : [];

        if (!accounts.length) {
          // 若用户输入了关键词但账号库为空，直接返回空数组
          if (query) return [];
          return [
            {
              id: "empty-tip",
              text: "未找到任何 2FA 账号",
              title: "未找到任何 2FA 账号",
              description: "回车打开 2FA 令牌管理器添加新账号",
              payload: { action: "open" },
            },
          ];
        }

        let configDoc = db.get(CONFIG_KEY);
        if (!configDoc) {
          const ruck = typeof window !== "undefined" ? window.ruck : null;
          if (ruck?.storage?.get) {
            configDoc = await ruck.storage.get(CONFIG_KEY);
            if (configDoc) {
              db.put(configDoc);
            }
          }
        }

        const scheme = configDoc?.pinyinScheme || "quanpin";

        // 尝试获取解密主密钥
        const masterKey = await tryGetMasterKey(bridge);

        // 过滤并排序：置顶账户优先
        const matched = accounts
          .filter((acc) => isMatch(acc, query, scheme))
          .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
          });

        // 核心规则：若用户输入了明确关键词（如 "github"），但没有任何账号匹配，直接静默返回空数组，不显示无关结果
        if (query && !matched.length) {
          return [];
        }

        // 选取前 6 个匹配结果计算动态码
        const targetList = matched.slice(0, 6);
        const results = [];

        for (const acc of targetList) {
          const tokenInfo = await resolveAccountToken(acc, masterKey);

          if (tokenInfo.isLocked) {
            results.push({
              id: `acc-locked-${acc.id}`,
              text: `🔒 [待解锁] ${acc.name}`,
              title: `🔒 [待解锁] ${acc.name}`,
              description: "需输入主密码解锁后查看 · 回车打开插件输入密码",
              payload: { action: "open", accId: acc.id },
            });
          } else {
            const formatted = formatCode(tokenInfo.code);
            const timeDesc =
              tokenInfo.timeLeft != null
                ? `(剩余 ${tokenInfo.timeLeft} 秒)`
                : "(HOTP 计数器型)";

            results.push({
              id: `acc-${acc.id}`,
              text: `${acc.name} · ${formatted}`,
              title: `${acc.name} · ${formatted}`,
              description: `2FA 动态码 ${timeDesc} · 敲击回车直接复制并自动粘贴`,
              payload: {
                action: "copy",
                code: tokenInfo.code,
                name: acc.name,
                acc,
              },
            });
          }
        }

        // 若总匹配数大于 6 或查询为空，追加直达入口
        if (matched.length > 6 || !query) {
          results.push({
            id: "manager-entry",
            text: `打开 2FA 令牌管理器 (共 ${accounts.length} 个账号)`,
            title: `打开 2FA 令牌管理器 (共 ${accounts.length} 个账号)`,
            description: "进入完整界面查看所有令牌或管理设置",
            payload: { action: "open" },
          });
        }

        return results;
      } catch (err) {
        console.error("[OTPMainPush] onMainPush search error:", err);
        return [
          {
            id: "error-tip",
            text: "2FA 动态验证码",
            title: "2FA 动态验证码",
            description: "回车打开 2FA 令牌管理器",
            payload: { action: "open" },
          },
        ];
      }
    },
    async ({ code, type, payload, option }) => {
      const actionPayload = option?.payload || {};

      if (actionPayload.action === "copy") {
        const rawCode = actionPayload.code;
        bridge.copyText(rawCode);

        // 如果是 HOTP 计数器类型，递增 counter 并落盘
        if (actionPayload.acc?.type === "hotp") {
          try {
            const accDoc = db.get(STORAGE_KEY);
            if (accDoc && Array.isArray(accDoc.data)) {
              const target = accDoc.data.find(
                (a) => a.id === actionPayload.acc.id
              );
              if (target) {
                target.counter = (target.counter || 0) + 1;
                db.put(accDoc);
              }
            }
          } catch (e) {
            console.warn("[OTPMainPush] Failed to update HOTP counter:", e);
          }
        }

        // 隐藏主窗口并自动模拟粘贴
        bridge.hideMainWindow(true);

        const ruck = typeof window !== "undefined" ? window.ruck : null;
        if (ruck?.clipboard?.paste) {
          ruck.clipboard.paste("ctrl_v");
        } else {
          bridge.simulateKeyboardTap(
            "v",
            bridge.isMacOs() ? "command" : "ctrl"
          );
        }

        bridge.showNotification(
          `已复制 ${actionPayload.name} 动态码: ${rawCode}`
        );
        return false; // 静默执行完成，不展开大窗口
      }

      if (actionPayload.action === "open") {
        bridge.showMainWindow();
        return true; // 展开插件大窗口
      }

      return false;
    }
  );

  console.log("[OTPMainPush] onMainPush engine registered successfully.");
}
