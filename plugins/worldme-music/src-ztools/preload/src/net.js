/**
 * 网络层
 * - 统一配置 axios（Node http 适配器，绕过渲染层 CORS）
 * - 支持系统代理 / 手动代理 / 直连
 * - GitHub Raw、jsDelivr 自动镜像回退与重试
 * - 音源插件通过 require('axios') 拿到的也是这里配置过的实例
 */
const https = require('https');
const http = require('http');
const axios = require('axios');
const proxy = require('./proxy');

const insecureAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

axios.defaults.timeout = 30000;
axios.defaults.maxRedirects = 6;
axios.defaults.proxy = false;
try {
  axios.defaults.adapter = require('axios/lib/adapters/http');
} catch (e) {
  try {
    delete axios.defaults.adapter;
  } catch (e2) {
    /* ignore */
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return '';
  }
}

/** 根据当前代理配置刷新 axios 默认 agent（供插件直接使用 axios） */
function applyDefaults() {
  const pair = proxy.agentsForUrl('https://example.com');
  axios.defaults.httpsAgent = pair.httpsAgent || insecureAgent;
  axios.defaults.httpAgent = pair.httpAgent;
}

applyDefaults();

/** 追加随机参数，绕过部分 CDN 缓存（等价 MusicFree 的 addRandomHash） */
function addRandomHash(url) {
  if (typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    u.searchParams.set('_t', Date.now() + Math.random().toString(36).slice(2, 8));
    return u.toString();
  } catch (e) {
    return url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
  }
}

/** 为 GitHub Raw / jsDelivr 生成镜像地址 */
function mirrorList(url) {
  const out = [];
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return out;
  }

  if (u.hostname === 'cdn.jsdelivr.net') {
    for (const host of ['fastly.jsdelivr.net', 'gcore.jsdelivr.net', 'testingcf.jsdelivr.net']) {
      const v = new URL(url);
      v.hostname = host;
      out.push(v.toString());
    }
  }

  if (u.hostname === 'raw.githubusercontent.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 4) {
      const owner = parts[0];
      const repo = parts[1];
      const rest = parts.slice(2);
      let ref;
      let filePath;
      if (rest[0] === 'refs' && rest[1] === 'heads') {
        ref = rest[2];
        filePath = rest.slice(3).join('/');
      } else {
        ref = rest[0];
        filePath = rest.slice(1).join('/');
      }
      if (owner && repo && ref && filePath) {
        out.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${filePath}`);
        out.push(`https://ghproxy.net/https://raw.githubusercontent.com/${owner}/${repo}/${rest.join('/')}`);
      }
    }
  }

  if (u.hostname === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[2] === 'raw') {
      const owner = parts[0];
      const repo = parts[1];
      const ref = parts[3];
      const filePath = parts.slice(4).join('/');
      out.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${filePath}`);
      out.push(`https://ghproxy.net/https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`);
    }
  }

  return [...new Set(out.filter((x) => x !== url))];
}

/** 将网络错误转为可读中文提示 */
function friendlyError(err, url) {
  const host = hostOf(url);
  const status = err && err.response && err.response.status;
  const code = (err && err.code) || '';
  const raw = (err && err.message) || String(err);
  const suffix = host ? `（${host}）` : '';

  if (status === 423) return `音源服务器拒绝访问（HTTP 423），链接可能已失效或被锁${suffix}`;
  if (status === 404) return `音源地址不存在（HTTP 404），请检查链接${suffix}`;
  if (status === 403) return `音源服务器拒绝访问（HTTP 403）${suffix}`;
  if (status === 429) return `请求过于频繁（HTTP 429），请稍后重试${suffix}`;
  if (status >= 500) return `音源服务器错误（HTTP ${status}）${suffix}`;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE|socket hang up/i.test(code + ' ' + raw)) {
    return `网络连接失败（${code || 'ECONNRESET'}）${suffix}。请在设置中开启代理或镜像回退。`;
  }
  if (/timeout/i.test(raw)) return `请求超时${suffix}，请检查网络或代理设置`;
  return `请求失败${suffix}：${raw}`;
}

function makeError(err, url) {
  const e = new Error(friendlyError(err, url));
  e.cause = err;
  e.status = err && err.response && err.response.status;
  e.url = url;
  return e;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRetry(err) {
  const status = err && err.response && err.response.status;
  if (status) return status === 408 || status === 429 || status >= 500;
  return true;
}

/**
 * 带镜像回退与重试的文本请求
 * @returns {Promise<{data: string, url: string, status: number}>}
 */
async function requestText(url, options) {
  options = options || {};
  const timeout = options.timeout || 30000;
  const retries = options.retries === undefined ? 2 : options.retries;
  const allowMirror = options.allowMirror !== false && proxy.getConfig().mirror !== false;
  const candidates = [url].concat(allowMirror ? mirrorList(url) : []);
  let lastError = null;

  for (const candidate of candidates) {
    const pair = proxy.agentsForUrl(candidate);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(candidate, {
          timeout,
          maxRedirects: 6,
          proxy: false,
          responseType: 'text',
          transformResponse: [(d) => d],
          headers: Object.assign(
            {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              Accept: '*/*',
            },
            options.headers || {}
          ),
          httpsAgent: pair.httpsAgent || insecureAgent,
          httpAgent: pair.httpAgent,
        });
        if (typeof res.data !== 'string') {
          throw new Error('响应内容不是文本');
        }
        return { data: res.data, url: candidate, status: res.status };
      } catch (err) {
        lastError = err;
        if (!shouldRetry(err)) break;
        if (attempt < retries) await sleep(400 * (attempt + 1));
      }
    }
    // 4xx 通常换镜像也没用，直接结束
    const status = lastError && lastError.response && lastError.response.status;
    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) break;
  }

  throw makeError(lastError || new Error('请求失败'), url);
}

async function fetchText(url, options) {
  const res = await requestText(url, options);
  return res.data;
}

async function fetchJSON(url, options) {
  const text = await fetchText(url, options);
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('响应内容为空');
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('响应不是有效的 JSON');
  }
}

/** 测试当前代理是否可用 */
async function testConnection(url) {
  const target = url || 'https://api.github.com';
  const info = proxy.describe();
  const started = Date.now();
  try {
    const res = await requestText(target, { timeout: 10000, retries: 0, allowMirror: false });
    return {
      ok: true,
      status: res.status,
      ms: Date.now() - started,
      viaProxy: !!info.active,
      proxy: info.active ? info.active.url : '',
      target,
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      ms: Date.now() - started,
      viaProxy: !!info.active,
      proxy: info.active ? info.active.url : '',
      target,
    };
  }
}

/** 请求原始二进制流（用于媒体代理） */
function requestStream(targetUrl, headers, method) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      reject(new Error('无效的地址: ' + targetUrl));
      return;
    }
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const pair = proxy.agentsForUrl(targetUrl);
    const reqOptions = {
      method: method || 'GET',
      headers: Object.assign(
        {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: '*/*',
        },
        headers || {}
      ),
    };
    if (isHttps) reqOptions.agent = pair.httpsAgent || insecureAgent;
    else if (pair.httpAgent) reqOptions.agent = pair.httpAgent;

    const req = lib.request(parsed, reqOptions, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        let next = res.headers.location;
        if (!/^https?:\/\//i.test(next)) next = new URL(next, targetUrl).toString();
        requestStream(next, headers, method).then(resolve, reject);
        return;
      }
      resolve(res);
    });
    req.on('error', (err) => reject(new Error(friendlyError(err, targetUrl))));
    req.setTimeout(30000, () => {
      req.destroy(new Error('请求超时'));
    });
    req.end();
  });
}

module.exports = {
  axios,
  insecureAgent,
  addRandomHash,
  mirrorList,
  friendlyError,
  fetchText,
  fetchJSON,
  requestText,
  requestStream,
  testConnection,
  applyDefaults,
  getProxyInfo: () => proxy.describe(),
  setProxyConfig: (cfg) => {
    const next = proxy.setConfig(cfg);
    applyDefaults();
    return proxy.describe();
  },
  proxies: proxy,
};
