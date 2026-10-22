/**
 * services 兼容垫片 (Native File Dialog 驱动)
 * 优先调用系统原生文件保存对话框（Ruck showSaveDialog 与 Web showSaveFilePicker），
 * 彻底告别浏览器的下载条/气泡弹窗，用户选定保存路径后直接落盘。
 */

function sanitizeFileName(fileName, fallback) {
  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) return fallback
  const base = fileName.trim().split(/[\\/]/).pop() || fallback
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || fallback
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const binary = atob(parts[1])
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const binary = atob(base64)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

function downloadBlob(blob, targetFileName) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return targetFileName
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = targetFileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return targetFileName
}

/**
 * 唤起系统原生文件保存对话框保存数据
 */
async function saveWithNativeDialog(data, defaultFileName, mimeType, ext) {
  const ruck = typeof window !== 'undefined' ? window.ruck : null

  // 1. 优先调用 Ruck 原生保存文件对话框与原生写盘
  if (ruck?.showSaveDialog && ruck?.fs?.writeFile) {
    try {
      const filters = ext ? [{ name: `${ext.toUpperCase()} 文件`, extensions: [ext] }] : []
      const targetPath = await ruck.showSaveDialog({
        title: '保存文件',
        defaultPath: defaultFileName,
        filters
      })
      if (!targetPath) {
        // 用户主动点击取消
        return null
      }

      if (data instanceof Blob) {
        const buffer = await data.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        await ruck.fs.writeFile(targetPath, bytes)
      } else if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          const parts = data.split(',')
          await ruck.fs.writeFile(targetPath, parts[1], { encoding: 'base64' })
        } else {
          await ruck.fs.writeFile(targetPath, data)
        }
      }
      return targetPath
    } catch (err) {
      console.warn('[Ruck showSaveDialog] 失败，尝试降级:', err)
    }
  }

  // 2. 现代浏览器 / Webview2 原生文件保存对话框 (File System Access API)
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const accept = {}
      if (mimeType && ext) {
        accept[mimeType] = [`.${ext}`]
      }
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: ext ? [{ description: `${ext.toUpperCase()} 文件`, accept }] : undefined
      })
      const writable = await handle.createWritable()
      if (data instanceof Blob) {
        await writable.write(data)
      } else if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          await writable.write(dataUrlToBlob(data))
        } else {
          await writable.write(data)
        }
      }
      await writable.close()
      return handle.name || defaultFileName
    } catch (err) {
      if (err && (err.name === 'AbortError' || String(err).includes('AbortError'))) {
        // 用户主动点击取消
        return null
      }
      console.warn('[showSaveFilePicker] 失败，回退到下载:', err)
    }
  }

  // 3. 兜底回退
  let fallbackBlob
  if (data instanceof Blob) {
    fallbackBlob = data
  } else if (typeof data === 'string') {
    fallbackBlob = data.startsWith('data:')
      ? dataUrlToBlob(data)
      : new Blob([data], { type: mimeType || 'text/plain;charset=utf-8' })
  }
  return downloadBlob(fallbackBlob, defaultFileName)
}

// 检查 Node.js 原生模块
let nodeFs = null
let nodePath = null
try {
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    nodeFs = window.require('node:fs') || window.require('fs')
    nodePath = window.require('node:path') || window.require('path')
  }
} catch {
  nodeFs = null
  nodePath = null
}

export function createServices() {
  return {
    readFile(file) {
      if (nodeFs && typeof file === 'string') {
        return nodeFs.readFileSync(file, { encoding: 'utf-8' })
      }
      console.warn('[services] 当前环境不支持同步 readFile')
      return ''
    },

    async writeTextFile(text, ext = 'txt') {
      const fileName = `${Date.now()}.${ext}`
      if (nodeFs && nodePath && window.ztools?.getPath) {
        const filePath = nodePath.join(window.ztools.getPath('downloads'), fileName)
        nodeFs.writeFileSync(filePath, text, { encoding: 'utf-8' })
        return filePath
      }
      return await saveWithNativeDialog(text, fileName, 'text/plain;charset=utf-8', ext)
    },

    async writeTextFileToPath(text, filePath) {
      if (nodeFs && nodePath) {
        nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true })
        nodeFs.writeFileSync(filePath, text, { encoding: 'utf-8' })
        return filePath
      }
      const ruck = typeof window !== 'undefined' ? window.ruck : null
      if (ruck?.fs?.writeFile) {
        await ruck.fs.writeFile(filePath, text)
        return filePath
      }
      const targetName = sanitizeFileName(filePath, `${Date.now()}.json`)
      return await saveWithNativeDialog(text, targetName, 'application/json;charset=utf-8', 'json')
    },

    async writeSvgFile(svgText, fileName) {
      const safe = sanitizeFileName(fileName, `${Date.now()}.svg`)
      const targetName = safe.endsWith('.svg') ? safe : `${safe}.svg`
      if (nodeFs && nodePath && window.ztools?.getPath) {
        const filePath = nodePath.join(window.ztools.getPath('downloads'), targetName)
        nodeFs.writeFileSync(filePath, svgText, { encoding: 'utf-8' })
        return filePath
      }
      return await saveWithNativeDialog(svgText, targetName, 'image/svg+xml;charset=utf-8', 'svg')
    },

    async writeImageFile(base64Url, fileName) {
      const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url)
      const ext = match ? match[1] : 'png'
      const safe = sanitizeFileName(fileName, `${Date.now()}.${ext}`)
      const targetName = safe.endsWith(`.${ext}`) ? safe : `${safe}.${ext}`
      if (nodeFs && nodePath && window.ztools?.getPath && match) {
        const filePath = nodePath.join(window.ztools.getPath('downloads'), targetName)
        nodeFs.writeFileSync(filePath, base64Url.substring(match[0].length), { encoding: 'base64' })
        return filePath
      }
      return await saveWithNativeDialog(base64Url, targetName, `image/${ext}`, ext)
    },

    async writeZipFile(zipBlob, fileName) {
      const safe = sanitizeFileName(fileName, `${Date.now()}.zip`)
      const targetName = safe.endsWith('.zip') ? safe : `${safe}.zip`
      if (nodeFs && nodePath && window.ztools?.getPath) {
        const filePath = nodePath.join(window.ztools.getPath('downloads'), targetName)
        const arrayBuffer = await zipBlob.arrayBuffer()
        nodeFs.writeFileSync(filePath, Buffer.from(arrayBuffer))
        return filePath
      }
      return await saveWithNativeDialog(zipBlob, targetName, 'application/zip', 'zip')
    },

    async writeImageFileToPath(base64Url, filePath) {
      if (nodeFs && nodePath) {
        const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url)
        if (!match) return ''
        nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true })
        nodeFs.writeFileSync(filePath, base64Url.substring(match[0].length), { encoding: 'base64' })
        return filePath
      }
      const ruck = typeof window !== 'undefined' ? window.ruck : null
      if (ruck?.fs?.writeFile) {
        const match = /^data:image\/([a-z0-9.+-]{1,20});base64,/i.exec(base64Url)
        const content = match ? base64Url.substring(match[0].length) : base64Url
        await ruck.fs.writeFile(filePath, content, { encoding: 'base64' })
        return filePath
      }
      const targetName = sanitizeFileName(filePath, `${Date.now()}.png`)
      return await saveWithNativeDialog(base64Url, targetName, 'image/png', 'png')
    },

    async writeBinaryFile(base64, fileName) {
      const safe = sanitizeFileName(fileName, `${Date.now()}.bin`)
      const ext = safe.split('.').pop() || 'bin'
      if (nodeFs && nodePath && window.ztools?.getPath) {
        const filePath = nodePath.join(window.ztools.getPath('downloads'), safe)
        nodeFs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
        return filePath
      }
      const blob = base64ToBlob(base64)
      return await saveWithNativeDialog(blob, safe, 'application/octet-stream', ext)
    },

    async writeBinaryFileToPath(base64, filePath) {
      if (nodeFs && nodePath) {
        nodeFs.mkdirSync(nodePath.dirname(filePath), { recursive: true })
        nodeFs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
        return filePath
      }
      const ruck = typeof window !== 'undefined' ? window.ruck : null
      if (ruck?.fs?.writeFile) {
        await ruck.fs.writeFile(filePath, base64, { encoding: 'base64' })
        return filePath
      }
      const targetName = sanitizeFileName(filePath, `${Date.now()}.bin`)
      const blob = base64ToBlob(base64)
      return await saveWithNativeDialog(blob, targetName, 'application/octet-stream', 'bin')
    }
  }
}
