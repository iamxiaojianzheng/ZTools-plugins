/**
 * 图片选择与 React 表单状态直写适配模块
 * 解决 Webview2 环境下同步 showOpenDialog 阻断问题，并提供剪贴板与拖拽选图增强
 */

/**
 * 遍历 DOM 与 React Fiber 树，定位活动中的表单 ClassComponent 实例
 */
export function findFormInstance() {
  if (typeof document === "undefined") return null;
  const roots = [
    document.querySelector(".form-body"),
    document.querySelector(".form-content-box"),
    document.querySelector(".form-content-textarea")
  ].filter(Boolean);

  for (const root of roots) {
    const fiberKey = Object.keys(root).find(
      (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
    );
    if (!fiberKey) continue;

    let fiber = root[fiberKey];
    while (fiber) {
      if (
        fiber.stateNode &&
        typeof fiber.stateNode.setState === "function" &&
        fiber.stateNode.handleInsertImage
      ) {
        return fiber.stateNode;
      }
      fiber = fiber.return;
    }
  }
  return null;
}

/**
 * 将图片 Data URL 注入表单状态，同时将原有文本内容规范合并至备注中
 * 完全契合原插件 handleInsertImage 的业务状态机
 */
export function applyImageToForm(dataUrl) {
  if (!dataUrl) return false;
  const form = findFormInstance();
  if (!form) {
    console.warn("[ImagePicker] Active form instance not found via React Fiber.");
    return false;
  }
  const state = form.state || {};
  const content = state.content || "";
  const remark = state.remark || "";
  if (content) {
    const formattedContent = content.replace(/\r?\n/g, " ").trim();
    const newRemark = remark ? `${remark} ${formattedContent}` : formattedContent;
    form.setState({
      image: dataUrl,
      content: "",
      remark: newRemark
    });
  } else {
    form.setState({ image: dataUrl });
  }
  console.log("[ImagePicker] Successfully applied image to form state.");
  return true;
}

/**
 * 将 File 对象转换为 Base64 Data URL
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("未提供文件对象"));
    if (file.type && !file.type.startsWith("image/")) {
      return reject(new Error("选中的文件不是图片格式"));
    }
    if (file.size > 10 * 1024 * 1024) {
      return reject(new Error("图片大小不能超过 10 M"));
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

let fileInput = null;

/**
 * 唤起主窗口显示并聚焦，恢复用户编辑上下文
 */
export function restoreMainWindowFocus() {
  try {
    const ruck = typeof window !== "undefined" && window.ruck ? window.ruck : null;
    if (ruck?.window?.showMainWindow) {
      ruck.window.showMainWindow();
    } else if (ruck?.showMainWindow) {
      ruck.showMainWindow();
    } else if (typeof window !== "undefined" && window.ztools?.showMainWindow) {
      window.ztools.showMainWindow();
    }

    if (typeof window !== "undefined") {
      window.focus();
      setTimeout(() => {
        const remarkInput =
          document.querySelector('input[placeholder="备注说明"]') ||
          document.querySelector("textarea") ||
          document.querySelector(".form-body input");
        if (remarkInput && typeof remarkInput.focus === "function") {
          remarkInput.focus();
        }
      }, 50);
    }
  } catch (e) {
    console.warn("[ImagePicker] restoreMainWindowFocus error:", e);
  }
}

/**
 * 唤起系统原生文件选择器选取图片并在完成后主动恢复主窗口显示与焦点
 */
export function pickImageFile() {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
    }

    let finished = false;
    const finalize = (result) => {
      if (finished) return;
      finished = true;
      restoreMainWindowFocus();
      resolve(result);
    };

    fileInput.value = "";
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (file) {
        try {
          const dataUrl = await fileToDataUrl(file);
          applyImageToForm(dataUrl);
          finalize([dataUrl]);
        } catch (err) {
          console.error("[ImagePicker] fileToDataUrl failed:", err);
          finalize(null);
        }
      } else {
        finalize(null);
      }
    };

    // 取消选择事件监听
    if ("oncancel" in fileInput) {
      fileInput.oncancel = () => finalize(null);
    }

    // 窗口重新聚焦兜底（防止部分宿主环境下未触发 oncancel）
    const onWindowFocus = () => {
      window.removeEventListener("focus", onWindowFocus);
      setTimeout(() => {
        if (!finished) {
          finalize(null);
        }
      }, 100);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onWindowFocus, { once: true });
    }

    fileInput.click();
  });
}

/**
 * 判断是否为图片对话框配置
 */
export function isImageDialogOptions(options = {}) {
  const filters = options.filters || [];
  return filters.some(
    (f) =>
      f.name === "image" ||
      (Array.isArray(f.extensions) &&
        f.extensions.some((ext) => ["png", "jpg", "jpeg", "webp", "gif"].includes(String(ext).toLowerCase())))
  );
}

/**
 * 对接原插件的同步 showOpenDialog 调用
 */
export function handleShowOpenDialog(options = {}) {
  if (isImageDialogOptions(options)) {
    // 异步拉起文件选择框并在选中后注入 React Form 状态
    pickImageFile();
    return null;
  }
  return undefined;
}

/**
 * 安装图片交互增强器：剪贴板直接粘贴 (Ctrl+V) 与图片直接拖拽
 */
export function setupImageEnhancements() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 1. 剪贴板粘贴图片拦截 (Ctrl+V)
  window.addEventListener(
    "paste",
    async (event) => {
      const items = event.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const form = findFormInstance();
            if (form) {
              event.preventDefault();
              event.stopPropagation();
              try {
                const dataUrl = await fileToDataUrl(file);
                applyImageToForm(dataUrl);
                console.log("[ImagePicker] Clipboard image pasted to form.");
              } catch (err) {
                console.error("[ImagePicker] Clipboard image paste failed:", err);
              }
              return;
            }
          }
        }
      }
    },
    true
  );

  // 2. 拖拽图片拦截 (Drag & Drop)
  document.addEventListener("dragover", (event) => {
    const form = findFormInstance();
    if (form) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    }
  });

  document.addEventListener("drop", async (event) => {
    const form = findFormInstance();
    if (!form) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type && file.type.startsWith("image/")) {
        event.preventDefault();
        event.stopPropagation();
        try {
          const dataUrl = await fileToDataUrl(file);
          applyImageToForm(dataUrl);
          console.log("[ImagePicker] Dropped image added to form.");
        } catch (err) {
          console.error("[ImagePicker] Dropped image failed:", err);
        }
      }
    }
  });
}
