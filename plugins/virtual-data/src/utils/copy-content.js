/**
 * 写入剪贴板工具函数
 * 优先调用 window.ztools.copyText 宿主能力，并向下兼容原生 Web API
 * @param {string} content - 待复制文本
 * @returns {Promise<void>}
 */
export function copyContent(content) {
  return new Promise((resolve, reject) => {
    // 1. 优先使用宿主/垫片提供的 copyText
    if (typeof window !== 'undefined' && window.ztools?.copyText) {
      try {
        const success = window.ztools.copyText(content);
        if (success) {
          return resolve();
        }
      } catch (err) {
        console.warn('[copyContent] ztools.copyText 失败，尝试回退:', err);
      }
    }

    // 2. 回退到浏览器原生 navigator.clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(content)
        .then(() => resolve())
        .catch(() => {
          fallbackCopy(content, resolve, reject);
        });
      return;
    }

    // 3. 终极 DOM 回退
    fallbackCopy(content, resolve, reject);
  });
}

function fallbackCopy(content, resolve, reject) {
  try {
    const input = document.createElement('input');
    input.value = content;
    document.body.append(input);
    input.select();
    const successful = document.execCommand('copy');
    input.remove();
    if (successful) {
      resolve();
    } else {
      reject(new Error('复制失败'));
    }
  } catch (e) {
    reject(e);
  }
}
