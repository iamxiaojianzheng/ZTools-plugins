/**
 * 下载模块
 * 通过本地网络层拉取音频流，写入用户选择的路径；支持进度回调。
 */
const fs = require('fs');
const path = require('path');
const { requestStream } = require('./net');

function ztools() {
  try {
    return (typeof window !== 'undefined' && window.ztools) || null;
  } catch (e) {
    return null;
  }
}

function guessExt(url, title) {
  try {
    const p = new URL(url).pathname;
    const ext = path.extname(p).split('?')[0].toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch (e) {
    /* ignore */
  }
  return '.mp3';
}

function safeName(name) {
  return String(name || 'music')
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'music';
}

async function download(url, headers, suggestedName, onProgress) {
  if (!url) throw new Error('缺少下载地址');

  const zt = ztools();
  const ext = guessExt(url, suggestedName);
  const defaultName = safeName(suggestedName) + ext;

  let savePath;
  if (zt && typeof zt.showSaveDialog === 'function') {
    savePath = zt.showSaveDialog({
      title: '保存歌曲',
      defaultPath: defaultName,
      filters: [
        { name: '音频文件', extensions: ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'wav', 'mp4'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
  } else {
    const downloads = zt && zt.getPath ? zt.getPath('downloads') : process.cwd();
    savePath = path.join(downloads, defaultName);
  }
  if (!savePath) return { canceled: true };

  const upstream = await requestStream(url, headers || {}, 'GET');
  const status = upstream.statusCode || 0;
  if (status >= 400) {
    upstream.resume();
    throw new Error('下载失败：HTTP ' + status);
  }

  const total = parseInt(upstream.headers['content-length'] || '0', 10) || 0;
  let received = 0;

  const file = fs.createWriteStream(savePath);
  upstream.on('data', (chunk) => {
    received += chunk.length;
    if (typeof onProgress === 'function') {
      onProgress(total ? received / total : 0, received, total);
    }
  });

  await new Promise((resolve, reject) => {
    upstream.on('error', reject);
    file.on('error', reject);
    file.on('finish', resolve);
    upstream.pipe(file);
  });

  return { canceled: false, path: savePath, size: received };
}

module.exports = { download };
