/**
 * 代理配置与系统代理探测
 *
 * 配置持久化在 ZTools 数据库中（store 的 data 文档）：
 *   { mode: 'auto' | 'off' | 'manual', url: 'http://127.0.0.1:7890', mirror: true }
 */
const { execFileSync } = require('child_process');
const http = require('http');
const https = require('https');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const store = require('./store');

const DEFAULT_CONFIG = { mode: 'auto', url: '', mirror: true };
let cachedConfig = null;
let detection = null;
let detectionAt = 0;
const agentCache = new Map();

function getConfig() {
  if (cachedConfig) return cachedConfig;
  const saved = store.storageGet('network');
  cachedConfig = Object.assign({}, DEFAULT_CONFIG, saved && typeof saved === 'object' ? saved : {});
  return cachedConfig;
}

function setConfig(partial) {
  cachedConfig = Object.assign({}, getConfig(), partial || {});
  store.storageSet('network', cachedConfig);
  detection = null;
  detectionAt = 0;
  agentCache.clear();
  return cachedConfig;
}

function normalizeProxy(url) {
  if (!url) return null;
  let text = String(url).trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'http://' + text;
  try {
    const u = new URL(text);
    if (!u.port) return null;
    return { url: u.toString().replace(/\/$/, ''), host: u.hostname, port: Number(u.port) };
  } catch (e) {
    return null;
  }
}

function readWindowsProxy() {
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  try {
    const enabledOut = execFileSync('reg', ['query', key, '/v', 'ProxyEnable'], { encoding: 'utf8', windowsHide: true });
    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(enabledOut)) return null;
    const serverOut = execFileSync('reg', ['query', key, '/v', 'ProxyServer'], { encoding: 'utf8', windowsHide: true });
    const m = serverOut.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    if (!m) return null;
    let value = m[1].trim();
    if (value.includes('=')) {
      const map = {};
      value.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) map[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
      });
      value = map.https || map.http || '';
    }
    return normalizeProxy(value);
  } catch (e) {
    return null;
  }
}

function readMacProxy() {
  try {
    const out = execFileSync('scutil', ['--proxy'], { encoding: 'utf8' });
    const enabled = /HTTPSEnable\s*:\s*1/.test(out);
    const host = (out.match(/HTTPSProxy\s*:\s*(\S+)/) || [])[1];
    const port = (out.match(/HTTPSPort\s*:\s*(\d+)/) || [])[1];
    if (enabled && host && port) return normalizeProxy(`${host}:${port}`);
    const h2 = (out.match(/HTTPProxy\s*:\s*(\S+)/) || [])[1];
    const p2 = (out.match(/HTTPPort\s*:\s*(\d+)/) || [])[1];
    if (h2 && p2) return normalizeProxy(`${h2}:${p2}`);
    return null;
  } catch (e) {
    return null;
  }
}

function readEnvProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy;
  return raw ? normalizeProxy(raw) : null;
}

/** 探测系统代理（缓存 60 秒） */
function detectSystemProxy(force) {
  const now = Date.now();
  if (!force && detection && now - detectionAt < 60000) return detection;
  let found = readEnvProxy();
  let source = found ? 'env' : '';
  if (!found && process.platform === 'win32') {
    found = readWindowsProxy();
    source = found ? 'system' : '';
  }
  if (!found && process.platform === 'darwin') {
    found = readMacProxy();
    source = found ? 'system' : '';
  }
  detection = found ? Object.assign({ source }, found) : null;
  detectionAt = now;
  return detection;
}

/** 当前生效的代理；null 表示直连 */
function resolveProxy() {
  const cfg = getConfig();
  if (cfg.mode === 'off') return null;
  if (cfg.mode === 'manual') return normalizeProxy(cfg.url);
  return detectSystemProxy();
}

function isLocalHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h.endsWith('.local')) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

/** 为指定 URL 返回 Node http(s) agent；直连时返回 null */
function agentsForUrl(targetUrl) {
  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname;
  } catch (e) {
    return {};
  }
  if (isLocalHost(hostname)) return {};
  const proxy = resolveProxy();
  if (!proxy) return {};
  let pair = agentCache.get(proxy.url);
  if (!pair) {
    pair = {
      httpAgent: new HttpProxyAgent(proxy.url),
      httpsAgent: new HttpsProxyAgent(proxy.url, { rejectUnauthorized: false }),
    };
    agentCache.set(proxy.url, pair);
  }
  return pair;
}

/** 供 UI 展示 */
function describe() {
  const cfg = getConfig();
  const active = resolveProxy();
  return {
    config: cfg,
    active: active ? { url: active.url, source: active.source || (cfg.mode === 'manual' ? 'manual' : 'system') } : null,
    platform: process.platform,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  normalizeProxy,
  detectSystemProxy,
  resolveProxy,
  agentsForUrl,
  isLocalHost,
  describe,
};
