/* global ztools, sl */
(function () {
  "use strict";

  const host = window.ztools;

  const STORAGE = {
    apps: "fl.apps",
    webs: "fl.webs",
    settings: "fl.settings",
    features: "fl.featureCodes",
  };

  const DEFAULT_SETTINGS = {
    tab: "apps",
    iconSize: 46,
    hideNames: false,
    repeatAdd: false,
    autoAlias: false,
    launchAfterQuit: true,
  };

  const state = {
    apps: [],
    webs: [],
    settings: { ...DEFAULT_SETTINGS },
    tab: "apps",
    query: "",
    cursor: 0,
    editing: null,
  };

  const ICON = {
    open: '<svg viewBox="0 0 24 24"><path d="M5 5h7v2H7v10h10v-5h2v7H5zM14 4h6v6h-2V7.41l-6.3 6.3-1.4-1.42L16.58 6H14z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="m14.06 9.02.92.92L5.92 19H5v-.92zM17.66 3a1 1 0 0 1 .7.29l2.35 2.35a1 1 0 0 1 0 1.41l-1.83 1.83-3.76-3.76 1.83-1.83A1 1 0 0 1 17.66 3zM3 17.25V21h3.75L17.8 9.94l-3.75-3.75z"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 5h6l2 2h10v12H3z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M8 3h11v14h-2V5H8zM5 7h10v14H5zm2 2v10h6V9z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10.6 13.4a3 3 0 0 0 4.24 0l2.83-2.83a3 3 0 0 0-4.24-4.24L12 7.76 10.76 6.5l1.44-1.44a5 5 0 1 1 7.07 7.07l-2.83 2.83a5 5 0 0 1-7.07 0zM13.4 10.6a3 3 0 0 0-4.24 0l-2.83 2.83a3 3 0 1 0 4.24 4.24L12 16.24l1.24 1.26-1.44 1.44a5 5 0 1 1-7.07-7.07l2.83-2.83a5 5 0 0 1 7.07 0z"/></svg>',
    app: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
    web: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3.05a15.6 15.6 0 0 0-1.1-5.32A8.02 8.02 0 0 1 18.9 11zM12 4.04c.83 1.2 1.53 3.32 1.7 6.96h-3.4c.17-3.64.87-5.76 1.7-6.96zM5.1 11a8.02 8.02 0 0 1 4.15-5.32A15.6 15.6 0 0 0 8.15 11zm0 2h3.05c.15 2.04.53 3.83 1.1 5.32A8.02 8.02 0 0 1 5.1 13zm6.9 6.96c-.83-1.2-1.53-3.32-1.7-6.96h3.4c-.17 3.64-.87 5.76-1.7 6.96zm3.25-1.64c.57-1.49.95-3.28 1.1-5.32h3.05a8.02 8.02 0 0 1-4.15 5.32z"/></svg>',
  };

  const $ = (sel) => document.querySelector(sel);

  const el = {
    app: $("#app"),
    grid: $("#grid"),
    empty: $("#empty"),
    emptyTitle: $("#empty-title"),
    emptyDesc: $("#empty-desc"),
    emptyActions: $("#empty-actions"),
    tabs: $("#tabs"),
    search: $("#search"),
    searchWrap: $("#search-wrap"),
    searchClear: $("#search-clear"),
    countApps: $("#count-apps"),
    countWebs: $("#count-webs"),
    addBtn: $("#add-btn"),
    settingsBtn: $("#settings-btn"),
    brand: $("#brand"),
    modalRoot: $("#modal-root"),
    menuRoot: $("#menu-root"),
    toastRoot: $("#toast-root"),
    drop: $("#drop-overlay"),
    statusText: $("#status-text"),
  };

  /* ------------------------------------------------------------------ */
  /* 数据                                                                */
  /* ------------------------------------------------------------------ */

  function read(key, fallback) {
    try {
      const value = host.dbStorage.getItem(key);
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      host.dbStorage.setItem(key, value);
    } catch (e) {
      toast("保存失败：" + e.message, true);
    }
  }

  function loadState() {
    const apps = read(STORAGE.apps, []);
    const webs = read(STORAGE.webs, []);
    const settings = read(STORAGE.settings, {});
    state.apps = (Array.isArray(apps) ? apps : []).map((item) => normalize(item, "app"));
    state.webs = (Array.isArray(webs) ? webs : []).map((item) => normalize(item, "web"));
    state.settings = { ...DEFAULT_SETTINGS, ...(settings && typeof settings === "object" ? settings : {}) };
    state.tab = state.settings.tab === "webs" ? "webs" : "apps";
  }

  function normalize(item, kind) {
    const copy = { ...item };
    if (!copy.id) copy.id = uid();
    copy.kind = kind;
    if (!Array.isArray(copy.path)) copy.path = String(copy.path || "");
    copy.name = String(copy.name || "未命名");
    copy.alias = String(copy.alias || "");
    copy.icon = copy.icon || "";
    copy.args = copy.args || "";
    copy.adminStart = Boolean(copy.adminStart);
    copy.backupPath = copy.backupPath || "";
    return copy;
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function saveApps() {
    write(STORAGE.apps, state.apps.map(stripRuntime));
  }

  function saveWebs() {
    write(STORAGE.webs, state.webs.map(stripRuntime));
  }

  function stripRuntime(item) {
    const copy = { ...item };
    delete copy.$$iconTried;
    delete copy.index;
    return copy;
  }

  function saveSettings() {
    write(STORAGE.settings, state.settings);
  }

  function currentList() {
    return state.tab === "webs" ? state.webs : state.apps;
  }

  function findItem(id, kind) {
    const list = kind === "web" ? state.webs : state.apps;
    return list.find((item) => item.id === id);
  }

  /* ------------------------------------------------------------------ */
  /* 别名 -> ZTools 动态功能                                             */
  /* ------------------------------------------------------------------ */

  function featureCode(item) {
    return (item.kind === "web" ? "fl-web-" : "fl-app-") + item.id;
  }

  function syncFeatures() {
    if (!host || typeof host.setFeature !== "function") return;

    let platform = "win32";
    try {
      platform = sl.getPlatform();
    } catch (e) {}

    const codes = [];
    const keep = [];

    [...state.apps, ...state.webs].forEach((item) => {
      const code = featureCode(item);
      if (!item.alias) {
        codes.push(code);
        return;
      }
      try {
        host.setFeature({
          code,
          explain:
            (item.kind === "web" ? "打开 → " : "启动 → ") + "[" + item.name + "] " + item.path,
          icon: item.icon || "logo.png",
          platform,
          mainHide: true,
          cmds: [item.alias],
        });
        keep.push(code);
      } catch (e) {
        console.warn("setFeature failed", code, e);
      }
    });

    const previous = read(STORAGE.features, []);
    if (Array.isArray(previous)) {
      previous
        .filter((code) => !keep.includes(code))
        .forEach((code) => {
          try {
            host.removeFeature(code);
          } catch (e) {}
        });
    }
    write(STORAGE.features, keep);
  }

  /* ------------------------------------------------------------------ */
  /* 渲染                                                                */
  /* ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function visibleItems() {
    const list = currentList();
    const q = state.query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) =>
      [item.name, item.alias, item.path, item.displayPath]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }

  function iconHTML(item) {
    if (!item.icon && !item.$$iconTried) {
      item.$$iconTried = true;
      try {
        const guessed = sl.iconFor(item.path);
        if (guessed) item.icon = guessed;
      } catch (e) {}
    }
    if (item.icon) {
      return '<img src="' + escapeAttr(item.icon) + '" alt="" draggable="false" />';
    }
    const letter = (item.name || "?").trim().charAt(0).toUpperCase();
    return '<span class="fallback">' + escapeHtml(letter) + "</span>";
  }

  function applyAppearance() {
    el.app.classList.toggle("hide-names", Boolean(state.settings.hideNames));
    el.app.style.setProperty("--icon-size", Number(state.settings.iconSize) + "px");
    el.app.style.setProperty("--card-min", Math.max(84, Number(state.settings.iconSize) + 58) + "px");
  }

  function render() {
    const list = visibleItems();
    const total = currentList().length;
    const isWeb = state.tab === "webs";

    el.countApps.textContent = String(state.apps.length);
    el.countWebs.textContent = String(state.webs.length);
    Array.from(el.tabs.querySelectorAll(".tab")).forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === state.tab);
    });

    applyAppearance();

    if (state.cursor > list.length - 1) state.cursor = list.length - 1;
    if (state.cursor < 0) state.cursor = 0;

    el.grid.innerHTML = list
      .map((item, index) => {
        const selected = index === state.cursor ? " is-selected" : "";
        const typeLabel = item.kind === "web" ? (String(item.path).includes("{query}") ? "搜索" : "网址") : item.type === "folder" ? "文件夹" : "应用";
        return (
          '<button class="card' +
          selected +
          '" role="listitem" data-index="' +
          index +
          '" title="' +
          escapeAttr(item.alias ? item.path + "\n别名：" + item.alias : item.path) +
          '">' +
          '<span class="card-type">' +
          typeLabel +
          "</span>" +
          '<span class="card-icon">' +
          iconHTML(item) +
          "</span>" +
          '<span class="card-name">' +
          escapeHtml(item.name) +
          "</span>" +
          (item.alias ? '<span class="alias">' + escapeHtml(item.alias) + "</span>" : "") +
          "</button>"
        );
      })
      .join("");

    el.empty.hidden = list.length > 0;
    if (list.length === 0) {
      if (total === 0) {
        el.emptyTitle.textContent = isWeb ? "还没有网址" : "还没有应用";
        el.emptyDesc.textContent = isWeb
          ? "添加常用网址，或直接把浏览器地址栏的链接拖进来。"
          : "把桌面快捷方式、exe、文件夹拖进来，或点击「添加」。";
        el.emptyActions.innerHTML =
          '<button class="btn btn-primary" data-action="add">' +
          (isWeb ? "添加网址" : "添加应用") +
          "</button>" +
          '<button class="btn" data-action="paste">从剪贴板识别</button>';
      } else {
        el.emptyTitle.textContent = "没有匹配项";
        el.emptyDesc.textContent = "换个关键词试试，或清空搜索。";
        el.emptyActions.innerHTML = '<button class="btn" data-action="clear">清空搜索</button>';
      }
    } else {
      el.emptyActions.innerHTML = "";
    }

    requestAnimationFrame(() => {
      const selected = el.grid.querySelector(".card.is-selected");
      if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: "nearest" });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  function launchItem(item, query) {
    if (!item) return;
    if (!query && String(item.path).includes("{query}")) {
      askQuery(item);
      return;
    }
    const result = sl.launch(item, query);
    if (result && result.ok === false) {
      toast(result.message || "启动失败", true);
      return;
    }
    if (state.settings.launchAfterQuit) {
      setTimeout(() => {
        try {
          host.outPlugin();
        } catch (e) {}
      }, 220);
    }
  }

  function askQuery(item) {
    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML =
      '<div class="field"><label class="field-label">搜索内容</label>' +
      '<input class="input" id="query-input" placeholder="输入后回车，替换网址里的 {query}" /></div>';

    const modal = showModal({
      title: "「" + item.name + "」搜索",
      body,
      footer: [
        { label: "取消", onClick: () => modal.close() },
        {
          label: "打开",
          primary: true,
          onClick: () => {
            const value = body.querySelector("#query-input").value;
            modal.close();
            launchItem(item, value);
          },
        },
      ],
    });

    const input = body.querySelector("#query-input");
    input.focus();
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const value = input.value;
        modal.close();
        launchItem(item, value);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 菜单                                                                */
  /* ------------------------------------------------------------------ */

  let closeMenu = null;

  function showMenu(x, y, items) {
    hideMenu();
    const menu = document.createElement("div");
    menu.className = "menu";
    menu.innerHTML = items
      .map((item, index) => {
        if (item.sep) return '<div class="menu-sep"></div>';
        return (
          '<button data-menu-index="' +
          index +
          '"' +
          (item.danger ? ' class="danger"' : "") +
          ">" +
          (item.icon || "") +
          "<span>" +
          escapeHtml(item.label) +
          "</span></button>"
        );
      })
      .join("");

    el.menuRoot.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";

    menu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-menu-index]");
      if (!button) return;
      const item = items[Number(button.dataset.menuIndex)];
      hideMenu();
      if (item && typeof item.onClick === "function") setTimeout(item.onClick, 0);
    });

    const onDown = (event) => {
      if (!menu.contains(event.target)) hideMenu();
    };
    const onKey = (event) => {
      if (event.key === "Escape") hideMenu();
    };
    setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);

    closeMenu = () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      menu.remove();
      closeMenu = null;
    };
  }

  function hideMenu() {
    if (closeMenu) closeMenu();
  }

  function showItemMenu(item, x, y) {
    const items = [
      { label: "打开", icon: ICON.open, onClick: () => launchItem(item) },
      { label: "编辑", icon: ICON.edit, onClick: () => openEditor(item, item.kind) },
      { sep: true },
    ];

    if (item.kind === "web") {
      items.push({ label: "复制网址", icon: ICON.link, onClick: () => copy(item.path) });
    } else {
      items.push({
        label: "打开所在位置",
        icon: ICON.folder,
        onClick: () => {
          try {
            sl.showItemInFolder(item.path);
          } catch (e) {
            toast("无法定位该路径", true);
          }
        },
      });
      items.push({ label: "复制路径", icon: ICON.copy, onClick: () => copy(item.path) });
    }

    if (item.alias) {
      items.push({ label: "复制别名", icon: ICON.copy, onClick: () => copy(item.alias) });
    }

    items.push({ sep: true });
    items.push({ label: "删除", icon: ICON.trash, danger: true, onClick: () => confirmDelete(item) });

    showMenu(x, y, items);
  }

  function copy(text) {
    try {
      host.copyText(text);
      toast("已复制");
    } catch (e) {
      toast("复制失败", true);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 弹窗基础                                                            */
  /* ------------------------------------------------------------------ */

  let activeModal = null;

  function showModal(options) {
    closeModal();

    const mask = document.createElement("div");
    mask.className = "modal-mask";

    const modal = document.createElement("div");
    modal.className = "modal" + (options.size === "sm" ? " modal-sm" : "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const title = document.createElement("div");
    title.className = "modal-header";
    title.innerHTML =
      "<h2>" + escapeHtml(options.title || "") + "</h2>" +
      '<button class="modal-close" aria-label="关闭">×</button>';

    const body = document.createElement("div");
    body.className = "modal-body";
    if (typeof options.body === "string") body.innerHTML = options.body;
    else if (options.body) body.appendChild(options.body);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const api = {
      close: closeModal,
      onClose: options.onClose,
      mask,
      modal,
      body,
      footer,
    };

    (options.footer || []).forEach((button) => {
      const node = document.createElement("button");
      node.className = "btn" + (button.primary ? " btn-primary" : "") + (button.danger ? " btn-danger" : "");
      node.textContent = button.label;
      node.addEventListener("click", () => button.onClick && button.onClick(api));
      footer.appendChild(node);
    });

    modal.appendChild(title);
    modal.appendChild(body);
    if ((options.footer || []).length) modal.appendChild(footer);
    mask.appendChild(modal);
    el.modalRoot.appendChild(mask);

    title.querySelector(".modal-close").addEventListener("click", closeModal);
    mask.addEventListener("mousedown", (event) => {
      if (event.target === mask) closeModal();
    });

    activeModal = api;
    requestAnimationFrame(() => {
      const focusable = modal.querySelector("input, textarea, select, button.btn-primary");
      if (focusable) focusable.focus();
    });
    return api;
  }

  function closeModal() {
    if (!activeModal) return;
    const { mask, onClose } = activeModal;
    activeModal = null;
    mask.remove();
    if (typeof onClose === "function") {
      try {
        onClose();
      } catch (e) {}
    }
  }

  function confirmDialog(options) {
    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = '<p style="margin:0;line-height:1.7;color:var(--text-2)">' + escapeHtml(options.message) + "</p>";

    const modal = showModal({
      title: options.title || "确认",
      size: "sm",
      body,
      footer: [
        { label: "取消", onClick: () => modal.close() },
        { label: options.confirmText || "确定", danger: true, primary: false, onClick: () => {
          modal.close();
          options.onConfirm();
        } },
      ],
    });
  }

  /* ------------------------------------------------------------------ */
  /* 新增 / 编辑                                                         */
  /* ------------------------------------------------------------------ */

  function blankItem(kind) {
    return {
      id: uid(),
      kind,
      name: "",
      path: "",
      displayPath: "",
      alias: "",
      icon: "",
      args: "",
      adminStart: false,
      backupPath: "",
      type: kind === "web" ? "web" : "app",
    };
  }

  function openEditor(item, kind) {
    const isNew = !item;
    const draft = item ? { ...item } : blankItem(kind);
    const isWeb = draft.kind === "web";
    const isWin = sl.getPlatform() === "win32";

    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = `
      <div class="icon-picker">
        <div class="icon-preview" id="icon-preview">${draft.icon ? '<img src="' + escapeAttr(draft.icon) + '" alt="" />' : '<span class="fallback" style="border-radius:10px">' + escapeHtml((draft.name || "?").charAt(0)) + "</span>"}</div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="pick-icon">选择图标</button>
          ${isWeb ? '<button class="btn" id="fetch-meta">抓取名称/图标</button>' : '<button class="btn" id="extract-icon">重新提取</button>'}
        </div>
      </div>

      <div class="field">
        <label class="field-label">${isWeb ? "网址名称" : "应用名称"}</label>
        <input class="input" id="f-name" value="${escapeAttr(draft.name)}" placeholder="${isWeb ? "例如：GitHub" : "例如：Visual Studio Code"}" />
      </div>

      <div class="field">
        <label class="field-label">${isWeb ? "网址" : "执行路径"}</label>
        <div class="field-row">
          <input class="input" id="f-path" value="${escapeAttr(draft.path)}" placeholder="${isWeb ? "https://…（可含 {query}）" : "exe / 快捷方式 / 文件夹路径"}" />
          ${isWeb ? "" : '<button class="btn" id="browse-path">浏览</button>'}
        </div>
        <div class="field-hint">${
          isWeb
            ? "地址里写 <code>{query}</code> 就会在打开前询问关键词，例如 https://www.baidu.com/s?wd={query}"
            : "支持 .exe、.lnk、.desktop、文件夹；拖拽到主界面也能添加。"
        }</div>
      </div>

      <div class="field">
        <label class="field-label">别名（ZTools 全局关键词）</label>
        <input class="input" id="f-alias" value="${escapeAttr(draft.alias)}" placeholder="例如：vscode" />
        <div class="field-hint">保存后会注册到 ZTools 搜索框，输入别名即可直接启动。</div>
      </div>

      ${
        isWeb
          ? ""
          : `
      <div class="settings-group">
        <h4>高级</h4>
        <div class="field">
          <label class="field-label">启动参数</label>
          <input class="input" id="f-args" value="${escapeAttr(draft.args)}" placeholder="例如：--incognito" />
        </div>
        <div class="field">
          <label class="field-label">备用路径（可选）</label>
          <input class="input" id="f-backup" value="${escapeAttr(draft.backupPath)}" placeholder="换电脑后路径不一致时使用" />
        </div>
        ${
          isWin
            ? `<div class="switch-row">
          <div class="switch-text"><strong>以管理员身份运行</strong><span>会触发 UAC 提示</span></div>
          <label class="switch"><input type="checkbox" id="f-admin" ${draft.adminStart ? "checked" : ""}/><i></i></label>
        </div>`
            : ""
        }
      </div>`
      }
    `;

    const footer = [
      { label: "取消", onClick: () => modal.close() },
      {
        label: isNew ? "添加" : "保存",
        primary: true,
        onClick: () => {
          const name = body.querySelector("#f-name").value.trim();
          const pathValue = body.querySelector("#f-path").value.trim();
          const alias = body.querySelector("#f-alias").value.trim();

          if (!name) return toast("请填写名称", true);
          if (!pathValue) return toast(isWeb ? "请填写网址" : "请选择路径", true);
          if (isWeb && !/^https?:\/\//i.test(pathValue)) return toast("网址需以 http:// 或 https:// 开头", true);

          const duplicate = currentListOf(draft.kind).some(
            (entry) => entry.id !== draft.id && samePath(entry.path, pathValue),
          );
          if (duplicate && !state.settings.repeatAdd) return toast("当前路径已存在，可在设置中允许重复添加", true);

          draft.name = name;
          draft.path = pathValue;
          draft.alias = alias;
          if (!draft.kind) draft.kind = isWeb ? "web" : "app";
          if (draft.kind === "web") draft.type = "web";
          if (isWeb === false) {
            draft.args = body.querySelector("#f-args") ? body.querySelector("#f-args").value : "";
            draft.backupPath = body.querySelector("#f-backup") ? body.querySelector("#f-backup").value.trim() : "";
            draft.adminStart = body.querySelector("#f-admin") ? body.querySelector("#f-admin").checked : false;
            if (!draft.type || draft.type === "web") draft.type = "app";
          }
          if (state.settings.autoAlias && !draft.alias) draft.alias = draft.name;

          const list = currentListOf(draft.kind);
          const index = list.findIndex((entry) => entry.id === draft.id);
          if (index >= 0) list[index] = draft;
          else list.unshift(draft);

          persist(draft.kind);
          syncFeatures();
          if (isNew) {
            state.tab = draft.kind === "web" ? "webs" : "apps";
            state.settings.tab = state.tab;
            saveSettings();
            state.query = "";
            state.cursor = 0;
            el.search.value = "";
            el.searchWrap.classList.remove("has-value");
          }
          modal.close();
          toast(isNew ? "已添加「" + draft.name + "」" : "已保存");
          render();
        },
      },
    ];

    const modal = showModal({
      title: isNew ? (isWeb ? "添加网址" : "添加应用") : "编辑 · " + draft.name,
      body,
      footer,
    });

    body.querySelector("#pick-icon").addEventListener("click", () => {
      const icon = sl.pickImage();
      if (icon) {
        draft.icon = icon;
        body.querySelector("#icon-preview").innerHTML = '<img src="' + escapeAttr(icon) + '" alt="" />';
      }
    });

    const extract = body.querySelector("#extract-icon");
    if (extract) {
      extract.addEventListener("click", () => {
        const filePath = body.querySelector("#f-path").value.trim();
        if (!filePath) return toast("请先选择路径", true);
        const info = sl.describePath(filePath);
        if (info) {
          draft.icon = info.icon || draft.icon;
          if (!body.querySelector("#f-name").value.trim()) body.querySelector("#f-name").value = info.name;
          if (info.type === "folder") draft.type = "folder";
          if (info.args) body.querySelector("#f-args").value = info.args;
          body.querySelector("#icon-preview").innerHTML = draft.icon
            ? '<img src="' + escapeAttr(draft.icon) + '" alt="" />'
            : '<span class="fallback" style="border-radius:10px">' + escapeHtml(info.name.charAt(0)) + "</span>";
        }
      });
    }

    const browse = body.querySelector("#browse-path");
    if (browse) {
      browse.addEventListener("click", () => {
        const files = sl.pickEntries({ title: "选择应用或文件夹" });
        if (!files || !files.length) return;
        const info = sl.describePath(files[0]);
        if (!info) return toast("无法读取该路径", true);
        body.querySelector("#f-path").value = info.path;
        if (!body.querySelector("#f-name").value.trim()) body.querySelector("#f-name").value = info.name;
        draft.icon = info.icon;
        draft.type = info.type;
        draft.displayPath = info.displayPath;
        draft.args = info.args || "";
        if (body.querySelector("#f-args")) body.querySelector("#f-args").value = draft.args;
        body.querySelector("#icon-preview").innerHTML = info.icon
          ? '<img src="' + escapeAttr(info.icon) + '" alt="" />'
          : '<span class="fallback" style="border-radius:10px">' + escapeHtml(info.name.charAt(0)) + "</span>";
      });
    }

    const fetchButton = body.querySelector("#fetch-meta");
    if (fetchButton) {
      const fetchMeta = async () => {
        const url = body.querySelector("#f-path").value.trim();
        if (!/^https?:\/\//i.test(url)) return toast("请先填写有效网址", true);
        const text = fetchButton.textContent;
        fetchButton.disabled = true;
        fetchButton.textContent = "抓取中…";
        try {
          const meta = await sl.fetchMeta(url);
          if (meta.error) toast(meta.error, true);
          else {
            if (meta.title && !body.querySelector("#f-name").value.trim()) {
              body.querySelector("#f-name").value = meta.title;
            }
            if (meta.icon) {
              draft.icon = meta.icon;
              body.querySelector("#icon-preview").innerHTML = '<img src="' + escapeAttr(meta.icon) + '" alt="" />';
            }
            toast(meta.title || meta.icon ? "已抓取" : "没有抓到信息");
          }
        } catch (e) {
          toast("抓取失败", true);
        } finally {
          fetchButton.disabled = false;
          fetchButton.textContent = text;
        }
      };
      fetchButton.addEventListener("click", fetchMeta);
      const pathInput = body.querySelector("#f-path");
      pathInput.addEventListener("blur", () => {
        if (!body.querySelector("#f-name").value.trim() && /^https?:\/\//i.test(pathInput.value.trim())) fetchMeta();
      });
    }

    return modal;
  }

  function currentListOf(kind) {
    return kind === "web" ? state.webs : state.apps;
  }

  function samePath(a, b) {
    const norm = (value) => String(value || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    return norm(a) === norm(b);
  }

  function persist(kind) {
    if (kind === "web") saveWebs();
    else saveApps();
  }

  function confirmDelete(item) {
    confirmDialog({
      title: "删除",
      message: "确定删除「" + item.name + "」吗？该操作只会移除卡片，不会删除本地文件。",
      confirmText: "删除",
      onConfirm: () => {
        if (item.kind === "web") state.webs = state.webs.filter((entry) => entry.id !== item.id);
        else state.apps = state.apps.filter((entry) => entry.id !== item.id);
        persist(item.kind);
        syncFeatures();
        render();
        toast("已删除");
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 设置                                                                */
  /* ------------------------------------------------------------------ */

  function openSettings() {
    const preferences = { ...state.settings };

    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = `
      <div class="settings-group">
        <h4>外观</h4>
        <div class="field">
          <label class="field-label">卡片图标大小</label>
          <div class="range-row">
            <input type="range" id="s-icon" min="28" max="72" step="2" value="${preferences.iconSize}" />
            <span class="range-value" id="s-icon-value">${preferences.iconSize}px</span>
          </div>
        </div>
        <div class="switch-row">
          <div class="switch-text"><strong>隐藏卡片名称</strong><span>只显示图标，鼠标悬停可看提示</span></div>
          <label class="switch"><input type="checkbox" id="s-hide" ${preferences.hideNames ? "checked" : ""}/><i></i></label>
        </div>
      </div>

      <div class="settings-group">
        <h4>行为</h4>
        <div class="switch-row">
          <div class="switch-text"><strong>启动后退出插件</strong><span>和原版「卡片打开后：退出插件」一致</span></div>
          <label class="switch"><input type="checkbox" id="s-quit" ${preferences.launchAfterQuit ? "checked" : ""}/><i></i></label>
        </div>
        <div class="switch-row">
          <div class="switch-text"><strong>允许重复添加</strong><span>同一路径可以出现多张卡片</span></div>
          <label class="switch"><input type="checkbox" id="s-repeat" ${preferences.repeatAdd ? "checked" : ""}/><i></i></label>
        </div>
        <div class="switch-row">
          <div class="switch-text"><strong>新增时名称作别名</strong><span>省去再填一次别名的步骤</span></div>
          <label class="switch"><input type="checkbox" id="s-auto" ${preferences.autoAlias ? "checked" : ""}/><i></i></label>
        </div>
      </div>

      <div class="settings-group">
        <h4>数据</h4>
        <div class="field-row">
          <button class="btn" id="s-export">导出备份</button>
          <button class="btn" id="s-import">导入备份</button>
        </div>
        <div class="field-hint" id="s-info"></div>
      </div>
    `;

    const modal = showModal({
      title: "设置",
      body,
      onClose: () => applyAppearance(),
      footer: [
        { label: "关闭", onClick: () => modal.close() },
        {
          label: "保存",
          primary: true,
          onClick: () => {
            state.settings = { ...state.settings, ...preferences, tab: state.tab };
            saveSettings();
            modal.close();
            render();
            toast("设置已保存");
          },
        },
      ],
    });

    const iconRange = body.querySelector("#s-icon");
    const iconValue = body.querySelector("#s-icon-value");
    iconRange.addEventListener("input", () => {
      preferences.iconSize = Number(iconRange.value);
      iconValue.textContent = iconRange.value + "px";
      el.app.style.setProperty("--icon-size", iconRange.value + "px");
      el.app.style.setProperty("--card-min", Math.max(84, Number(iconRange.value) + 58) + "px");
    });

    body.querySelector("#s-hide").addEventListener("change", (event) => {
      preferences.hideNames = event.target.checked;
      el.app.classList.toggle("hide-names", event.target.checked);
    });
    body.querySelector("#s-quit").addEventListener("change", (event) => {
      preferences.launchAfterQuit = event.target.checked;
    });
    body.querySelector("#s-repeat").addEventListener("change", (event) => {
      preferences.repeatAdd = event.target.checked;
    });
    body.querySelector("#s-auto").addEventListener("change", (event) => {
      preferences.autoAlias = event.target.checked;
    });

    body.querySelector("#s-export").addEventListener("click", async () => {
      try {
        const path = await sl.exportBackup({
          version: "fl-v1",
          exportedAt: new Date().toISOString(),
          apps: state.apps.map(stripRuntime),
          webs: state.webs.map(stripRuntime),
          settings: state.settings,
        });
        if (path) toast("已导出到 " + path);
      } catch (e) {
        toast("导出失败：" + e.message, true);
      }
    });

    body.querySelector("#s-import").addEventListener("click", () => {
      confirmDialog({
        title: "导入备份",
        message: "导入会覆盖当前所有卡片和设置，确定继续吗？",
        confirmText: "继续导入",
        onConfirm: async () => {
          try {
            const data = await sl.importBackup();
            if (!data) return;
            if (data.version !== "fl-v1" || !Array.isArray(data.apps) || !Array.isArray(data.webs)) {
              return toast("备份文件格式不正确", true);
            }
            state.apps = data.apps.map((item) => normalize(item, "app"));
            state.webs = data.webs.map((item) => normalize(item, "web"));
            state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
            saveApps();
            saveWebs();
            saveSettings();
            syncFeatures();
            closeModal();
            render();
            toast("导入成功");
          } catch (e) {
            toast("导入失败：" + e.message, true);
          }
        },
      });
    });

    const info = sl.getInfo ? sl.getInfo() : null;
    body.querySelector("#s-info").textContent = info
      ? "数据保存在 ZTools dbStorage · 平台 " + info.platform + (info.appVersion ? " · 版本 " + info.appVersion : "")
      : "数据保存在 ZTools dbStorage";
  }

  /* ------------------------------------------------------------------ */
  /* 拖拽 / 剪贴板添加                                                    */
  /* ------------------------------------------------------------------ */

  let dragDepth = 0;

  function handleDrop(event) {
    event.preventDefault();
    dragDepth = 0;
    el.drop.hidden = true;

    const files = Array.from(event.dataTransfer.files || [])
      .map((file) => (sl.pathForFile ? sl.pathForFile(file) : file.path))
      .filter(Boolean);

    if (files.length) {
      const added = addPaths(files);
      if (added) toast("已添加 " + added + " 项");
      return;
    }

    const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    const url = text && text.split(/\r?\n/).find((line) => /^https?:\/\//i.test(line.trim()));
    if (url) addWebUrl(url.trim());
  }

  function addPaths(paths) {
    let added = 0;
    paths.forEach((filePath) => {
      const info = sl.describePath(filePath);
      if (!info) return;
      const duplicate = state.apps.some((item) => samePath(item.path, info.path));
      if (duplicate && !state.settings.repeatAdd) return;

      state.apps.unshift({
        id: uid(),
        kind: "app",
        name: info.name,
        path: info.path,
        displayPath: info.displayPath,
        alias: state.settings.autoAlias ? info.name : "",
        icon: info.icon,
        args: info.args || "",
        adminStart: false,
        backupPath: "",
        type: info.type,
      });
      added += 1;
    });

    if (added) {
      saveApps();
      syncFeatures();
      state.tab = "apps";
      state.settings.tab = "apps";
      saveSettings();
      state.cursor = 0;
      render();
    }
    return added;
  }

  function addWebUrl(url) {
    const duplicate = state.webs.some((item) => samePath(item.path, url));
    if (duplicate && !state.settings.repeatAdd) {
      toast("该网址已存在", true);
      return;
    }

    let name = url;
    try {
      name = new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {}

    const item = {
      id: uid(),
      kind: "web",
      name,
      path: url,
      alias: state.settings.autoAlias ? name : "",
      icon: "",
      type: "web",
    };
    state.webs.unshift(item);
    saveWebs();
    syncFeatures();
    state.tab = "webs";
    state.settings.tab = "webs";
    saveSettings();
    state.cursor = 0;
    render();
    toast("已添加网址，正在抓取名称和图标…");

    Promise.resolve(sl.fetchMeta(url))
      .then((meta) => {
        if (!meta || meta.error) return;
        if (meta.title) item.name = meta.title;
        if (meta.icon) item.icon = meta.icon;
        saveWebs();
        syncFeatures();
        render();
      })
      .catch(() => {});
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                            */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    el.tabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".tab");
      if (!tab) return;
      switchTab(tab.dataset.tab);
    });

    el.brand.addEventListener("click", () => switchTab("apps"));

    el.search.addEventListener("input", () => {
      state.query = el.search.value;
      state.cursor = 0;
      el.searchWrap.classList.toggle("has-value", Boolean(state.query));
      render();
    });

    el.searchClear.addEventListener("click", () => {
      el.search.value = "";
      state.query = "";
      state.cursor = 0;
      el.searchWrap.classList.remove("has-value");
      render();
      el.search.focus();
    });

    el.grid.addEventListener("click", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      state.cursor = Number(card.dataset.index) || 0;
      openByIndex();
    });

    el.grid.addEventListener("mousedown", (event) => {
      const card = event.target.closest(".card");
      if (card) state.cursor = Number(card.dataset.index) || 0;
    });

    el.grid.addEventListener("contextmenu", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      event.preventDefault();
      const item = visibleItems()[Number(card.dataset.index)];
      if (!item) return;
      state.cursor = Number(card.dataset.index) || 0;
      render();
      showItemMenu(item, event.clientX, event.clientY);
    });

    el.addBtn.addEventListener("click", () => {
      const rect = el.addBtn.getBoundingClientRect();
      showMenu(rect.right - 180, rect.bottom + 6, [
        {
          label: "添加应用 / 文件",
          icon: ICON.app,
          onClick: () => {
            const files = sl.pickEntries({ title: "选择应用或文件" });
            if (files && files.length) {
              const count = addPaths(files);
              if (count) toast("已添加 " + count + " 项");
            }
          },
        },
        {
          label: "添加文件夹",
          icon: ICON.folder,
          onClick: () => {
            const files = sl.pickEntries({ title: "选择文件夹", folder: true });
            if (files && files.length) {
              const count = addPaths(files);
              if (count) toast("已添加 " + count + " 项");
            }
          },
        },
        { sep: true },
        { label: "添加网址", icon: ICON.web, onClick: () => openEditor(null, "web") },
      ]);
    });

    el.settingsBtn.addEventListener("click", openSettings);

    document.addEventListener("keydown", onKeydown);

    el.emptyActions.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "add") {
        if (state.tab === "webs") openEditor(null, "web");
        else el.addBtn.click();
      } else if (action.dataset.action === "clear") {
        el.search.value = "";
        state.query = "";
        el.searchWrap.classList.remove("has-value");
        render();
      } else if (action.dataset.action === "paste") {
        pasteFromClipboard();
      }
    });

    document.addEventListener("dragenter", (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      el.drop.hidden = false;
    });

    document.addEventListener("dragover", (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    document.addEventListener("dragleave", (event) => {
      if (!hasFiles(event)) return;
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        el.drop.hidden = true;
      }
    });

    document.addEventListener("drop", handleDrop);
  }

  function hasFiles(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    return types && (Array.from(types).includes("Files") || Array.from(types).includes("text/uri-list"));
  }

  function pasteFromClipboard() {
    if (sl.readClipboard) {
      const value = String(sl.readClipboard() || "").trim();
      if (!/^https?:\/\//i.test(value)) return toast("剪贴板里没有网址", true);
      addWebUrl(value);
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return toast("当前环境不支持读取剪贴板", true);
    }
    navigator.clipboard
      .readText()
      .then((value) => {
        const url = String(value || "").trim();
        if (!/^https?:\/\//i.test(url)) return toast("剪贴板里没有网址", true);
        addWebUrl(url);
      })
      .catch(() => toast("剪贴板里没有网址", true));
  }

  function switchTab(tab) {
    state.tab = tab === "webs" ? "webs" : "apps";
    state.settings.tab = state.tab;
    saveSettings();
    state.cursor = 0;
    render();
    el.search.focus();
  }

  function openByIndex() {
    const item = visibleItems()[state.cursor];
    if (item) launchItem(item);
  }

  function gridColumns() {
    const template = getComputedStyle(el.grid).gridTemplateColumns;
    if (!template || template === "none") return 4;
    return template.split(" ").filter(Boolean).length || 4;
  }

  function onKeydown(event) {
    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key.toLowerCase() === "f") {
      event.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }

    if (event.key === "Escape") {
      if (activeModal) {
        closeModal();
        return;
      }
      hideMenu();
      if (state.query) {
        el.search.value = "";
        state.query = "";
        el.searchWrap.classList.remove("has-value");
        render();
      }
      return;
    }

    if (activeModal) return;

    const list = visibleItems();
    if (!list.length) return;
    const cols = gridColumns();

    if (event.key === "ArrowRight") {
      event.preventDefault();
      state.cursor = Math.min(list.length - 1, state.cursor + 1);
      render();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.cursor = Math.max(0, state.cursor - 1);
      render();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      state.cursor = Math.min(list.length - 1, state.cursor + cols);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.cursor = Math.max(0, state.cursor - cols);
      render();
    } else if (event.key === "Enter") {
      if (document.activeElement === el.search || document.activeElement === document.body) {
        event.preventDefault();
        openByIndex();
      }
    } else if (mod && event.key.toLowerCase() === "n") {
      event.preventDefault();
      el.addBtn.click();
    }
  }

  /* ------------------------------------------------------------------ */
  /* ZTools 入口                                                         */
  /* ------------------------------------------------------------------ */

  function handleEnter(enter) {
    const code = enter && enter.code ? enter.code : "";

    if (code === "fl-webs") {
      switchTab("webs");
      return;
    }
    if (code === "fl-apps") {
      switchTab("apps");
      return;
    }

    if (code.indexOf("fl-app-") === 0 || code.indexOf("fl-web-") === 0) {
      const kind = code.indexOf("fl-web-") === 0 ? "web" : "app";
      const id = code.replace(kind === "web" ? "fl-web-" : "fl-app-", "");
      const item = findItem(id, kind);
      if (!item) {
        toast("找不到对应的卡片，可能已被删除", true);
        return;
      }
      launchItem(item, enter.type === "over" ? enter.payload : null);
      return;
    }

    // fl-panel：恢复上次面板
    state.tab = state.settings.tab === "webs" ? "webs" : "apps";
    render();
    setTimeout(() => el.search.focus(), 30);
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */

  function toast(message, isError) {
    const node = document.createElement("div");
    node.className = "toast" + (isError ? " err" : "");
    node.textContent = message;
    el.toastRoot.appendChild(node);
    setTimeout(() => {
      node.classList.add("out");
      setTimeout(() => node.remove(), 200);
    }, isError ? 3200 : 2000);
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  function setStatus() {
    try {
      const info = sl.getInfo ? sl.getInfo() : null;
      if (info) {
        el.statusText.textContent =
          "本地数据 · dbStorage" + (info.platform ? " · " + info.platform : "");
      }
    } catch (e) {}
  }

  function init() {
    loadState();
    bindEvents();
    setStatus();
    render();

    if (host && typeof host.onPluginEnter === "function") {
      host.onPluginEnter(handleEnter);
    }

    // 让已保存的别名在每次启动时都重新注册一遍
    syncFeatures();

    setTimeout(() => el.search.focus(), 40);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
