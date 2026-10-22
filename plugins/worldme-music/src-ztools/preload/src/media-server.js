/**
 * 本地媒体代理服务
 * 解决 <audio> 无法自定义请求头 / 渲染层 CORS 的问题：
 * 渲染层播放 http://127.0.0.1:port/stream?token=...&u=<base64url 目标地址>&h=<base64 json 头>
 * 本服务透传 Range，实现拖动进度、边下边播。
 */
const http = require('http');
const crypto = require('crypto');
const { requestStream } = require('./net');

let server = null;
let port = 0;
let token = crypto.randomBytes(16).toString('hex');
let starting = null;
let lyricsState = null;
let lyricsVersion = 0;

function b64urlEncode(text) {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text) {
  let s = text.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function handleStream(req, res) {
  const reqUrl = new URL(req.url, 'http://127.0.0.1');

  // 桌面歌词同步接口（供独立歌词窗口轮询）
  if (reqUrl.pathname === '/lyrics') {
    if (reqUrl.searchParams.get('token') !== token) {
      res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
      res.end('forbidden');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ version: lyricsVersion, state: lyricsState }));
    return;
  }

  if (reqUrl.pathname !== '/stream') {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  if (reqUrl.searchParams.get('token') !== token) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let target;
  try {
    target = b64urlDecode(reqUrl.searchParams.get('u') || '');
  } catch (e) {
    res.writeHead(400);
    res.end('bad url');
    return;
  }

  let extraHeaders = {};
  const rawHeaders = reqUrl.searchParams.get('h');
  if (rawHeaders) {
    try {
      extraHeaders = JSON.parse(b64urlDecode(rawHeaders));
    } catch (e) {
      extraHeaders = {};
    }
  }
  if (req.headers.range) extraHeaders.Range = req.headers.range;

  requestStream(target, extraHeaders, req.method === 'HEAD' ? 'HEAD' : 'GET').then(
    (upstream) => {
      const status = upstream.statusCode || 200;
      const passHeaders = {
        'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
        'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
        'Cache-Control': 'no-cache',
      };
      if (upstream.headers['content-length']) passHeaders['Content-Length'] = upstream.headers['content-length'];
      if (upstream.headers['content-range']) passHeaders['Content-Range'] = upstream.headers['content-range'];
      res.writeHead(status, passHeaders);
      upstream.pipe(res);
      upstream.on('error', () => {
        try {
          res.end();
        } catch (e) {
          /* ignore */
        }
      });
    },
    (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('upstream error: ' + err.message);
    }
  );
}

function start() {
  if (server) return Promise.resolve(port);
  if (starting) return starting;
  starting = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          });
          res.end();
          return;
        }
        handleStream(req, res);
      } catch (e) {
        res.writeHead(500);
        res.end('error');
      }
    });
    server.on('error', (err) => {
      starting = null;
      server = null;
      reject(err);
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log('🎧 Worldme media proxy listening on http://127.0.0.1:' + port);
      resolve(port);
    });
  });
  return starting;
}

async function getStreamUrl(realUrl, headers) {
  if (!realUrl) return null;
  await start();
  const h = headers && Object.keys(headers).length ? '&h=' + b64urlEncode(JSON.stringify(headers)) : '';
  return 'http://127.0.0.1:' + port + '/stream?token=' + token + '&u=' + b64urlEncode(realUrl) + h;
}

async function getPort() {
  await start();
  return port;
}

/** 更新桌面歌词状态（供 /lyrics 接口读取） */
function setLyricsState(state) {
  lyricsState = state;
  lyricsVersion++;
  return true;
}

/** 桌面歌词窗口同步所需的端口与 token */
async function getSyncInfo() {
  await start();
  return { port, token };
}

module.exports = { start, getStreamUrl, getPort, setLyricsState, getSyncInfo, b64urlEncode, b64urlDecode };
