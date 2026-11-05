(() => {
  "use strict";
  const C = window.CanvasCore, D = window.CanvasDomain;
  const route = decodeURI(location.pathname).match(/\/src\/pages\/([^/]+)\/([^/]+)\/(v\d+)\//);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && Boolean(route);
  const identityScope = route ? { projectId: route[1], pageId: route[2] } : { projectId: "", pageId: location.pathname.replace(/\/v\d+\/.*$/, "") };
  let schemaEnabled = false, boardVersionsEnabled = false, boardVersionBusy = false;
  const boardTitleVersions = new Map();
  let connections = null, flowQuick = null;
  let boardStateBusy = false;
  const restoringBoardStates = new WeakSet();
  const materialize = (document, force = schemaEnabled) => D.load(document, identityScope, { migrate: force || document.schemaVersion === 2 });
  const AUTOSAVE_DELAY = 100;
  const floatingPanels = ["#context-menu", "#property-popover", "#command-palette"];
  // Track the last input modality: menus opened by pointer must not move keyboard
  // focus, or the auto-focused first item paints a focus ring that reads as a selection box.
  let lastInputWasKeyboard = false;
  window.addEventListener("keydown", () => { lastInputWasKeyboard = true; }, true);
  window.addEventListener("pointerdown", () => { lastInputWasKeyboard = false; }, true);
  const $ = (s) => document.querySelector(s), clone = (value) => JSON.parse(JSON.stringify(value));
  let startupError = null;
  try {
    C.validate(window.PROTA_CANVAS);
  } catch (error) {
    startupError = error;
  }
  const initialDocument = startupError ? { schemaVersion: 1, revision: 0, nodes: [], viewport: { x: 100, y: 80, zoom: 1 } } : window.PROTA_CANVAS;
  let prepared;
  try { prepared = materialize(initialDocument); }
  catch (error) { startupError = error; prepared = { schemaVersion: 1, revision: 0, nodes: [], viewport: { x: 100, y: 80, zoom: 1 } }; }
  let state = prepared, baseline = clone(initialDocument), selected = /* @__PURE__ */ new Set(), history = [], future = [], dirty = false, saving = false, readOnly = Boolean(startupError), space = false, gesture = null, interacting = null;
  const stage = $("#stage"), world = $("#world"), properties = $("#properties");
  let agentTextSelection = null;
  let renameOnly = false;
  let propertyEdit = null, propertiesSelection = "", menuInvoker = null, fullscreenFallback = false, imageInsertionPoint = null, imageReplaceTarget = null, groupContext = null, paletteIndex = 0, paletteItems = [], renderFrame = 0, viewAnim = 0;
  let draftRecovery = null, recoveringDraft = false, restoredConflictBackup = null, conflictBackupNotice = null;
  let tool = "select", autoTimer, savePromise = null, conflict = false, agentBusy = false, agentPending = false, clipboard = null, editing = null, panelKey = "";
  const nodeEls = /* @__PURE__ */ new Map(), touches = /* @__PURE__ */ new Map(), boardStamps = /* @__PURE__ */ new Map();
  const boardPreviewUrls = new Map();
  // Board-level right-click gesture → board annotation. Runtime-only, never persisted.
  const RIGHT_GESTURE_INTERVAL = 420, RIGHT_GESTURE_DISTANCE = 12;
  let boardRightGesture = { boardId: null, count: 0, required: 2, lastTime: 0, lastX: 0, lastY: 0 };
  let annotationBoardId = null, annotationFrameEl = null, deferredBoardMenu = null, viewNotifyFrame = 0;
  const boardFrameBindings = new Map();
  let agentTargets = /* @__PURE__ */ new Set(), preparingTargets = new Set(), pasteTimer = null;
  const draftKey = "prota-canvas-draft:" + location.pathname, clipboardKey = "prota-canvas-clipboard";
  let nodeIndex = D.createIndex(state.nodes);
  const effectiveLocked = (n) => C.locked(state.nodes, n, nodeIndex);
  // Agent targets are mid-rewrite: selecting and viewing stay open, mutating them does not.
  const agentHeld = (n) => {
    if ((!agentBusy && !agentPending) || !n) return false;
    const targets = new Set([...agentTargets, ...preparingTargets]);
    let item = n;
    const seen = /* @__PURE__ */ new Set();
    while (item && !seen.has(item.id)) {
      if (targets.has(item.id)) return true;
      seen.add(item.id);
      item = state.nodes.find((p) => p.id === item.parentId);
    }
    // A container cannot move/delete an Agent-owned descendant. Siblings of
    // that descendant remain independently editable.
    return [...targets].some(id => {
      let target = state.nodes.find(node => node.id === id);
      const visited = new Set();
      while (target && !visited.has(target.id)) {
        if (target.parentId === n.id) return true;
        visited.add(target.id);
        target = state.nodes.find(node => node.id === target.parentId);
      }
      return false;
    });
  };
  const selectedRoots = () => C.roots(state.nodes, selected);
  const movable = () => {
    const roots = selectedRoots().filter((n) => !effectiveLocked(n) && !agentHeld(n));
    const ids = C.descendants(state.nodes, roots.map((n) => n.id));
    return state.nodes.filter((n) => ids.has(n.id));
  };
  // Agent preparation and execution protect only their captured targets.
  const canEdit = () => !readOnly && !recoveringDraft && !annotationBoardId && !boardVersionBusy && !boardStateBusy;

  // Annotations are stored separately from board source and layout. Agent
  // preparation, target locks and active runs do not block this interaction.
  const canAnnotateBoard = (node) => !readOnly && !boardVersionBusy && node?.type === "board" && Boolean(node.src) && !effectiveLocked(node) && (!annotationBoardId || annotationBoardId === node.id);

 let textTools = null, expandedEditor = null, linkedSavePromise = null, linkedTimer = null, linkedConflict = false;
  const linkedPrds = new Map();
  const isMarkdownDocument = n => Boolean(n?.markdownDocument || n?.prdPath || n?.markdownSource);
  const prdPath = n => n?.type === "text" ? n.prdPath || n.markdownSource || "" : "";
  const displayText = n => linkedPrds.get(prdPath(n)) ?? n.text ?? "";
  const documentUrl = path => {
    const url = new URL(String(path).replace(/^src\//, "/src/"), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/src/pages/") || !/\.md$/i.test(url.pathname)) throw new Error("PRD 路径无效");
    return url;
  };
  let syncingPrds = false;
  async function syncPrds() {
    if (!local || readOnly || syncingPrds || document.hidden) return;
    syncingPrds = true;
    let updated = false;
    try {
      await Promise.all([...new Set(state.nodes.map(prdPath).filter(Boolean))].map(async path => {
        try {
          const response = await fetch(documentUrl(path), { cache: "no-store", signal: AbortSignal.timeout(5000) });
          if (!response.ok) return; // Keep the last available content if the source is unavailable.
          const text = await response.text();
          if (editing && prdPath(state.nodes.find(n => n.id === editing.id) || {}) === path) return;
          if (linkedPrds.get(path) !== text) { linkedPrds.set(path, text); updated = true; }
        } catch { /* A later refresh retries without replacing the document with an error page. */ }
      }));
      if (updated) render({ panels: false });
    } finally { syncingPrds = false; }
  }
  setInterval(syncPrds, 2000);
  window.addEventListener("focus", syncPrds);
  document.addEventListener("visibilitychange", syncPrds);

  const names = { group: "分组", board: "画板", text: "文本", note: "便签", rect: "矩形", ellipse: "圆形", image: "图片" };
  const uid = () => "n_" + crypto.randomUUID().replaceAll("-", "");
  function status(text, kind = "") {
    const el = $("#save-status");
    el.textContent = text;
    el.classList.toggle("busy", kind === "busy");
    el.classList.toggle("error", kind === "error");
  }
  const isStorageQuotaError = (error) => error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED" || error?.code === 22;
  function readStoredValue(key) {
    let persistent = null, session = null;
    try { persistent = localStorage.getItem(key); } catch {}
    try { session = sessionStorage.getItem(key); } catch {}
    if (persistent === null) return session;
    if (session === null) return persistent;
    const savedAt = value => {
      try { return Number(JSON.parse(value)?.savedAt) || 0; } catch { return 0; }
    };
    return savedAt(session) >= savedAt(persistent) ? session : persistent;
  }
  function writeStoredValue(key, value) {
    try {
      localStorage.setItem(key, value);
      try { sessionStorage.removeItem(key); } catch {}
      return { ok: true, mode: "local" };
    } catch {}
    // Keep the previous durable copy until a replacement succeeds.
    try {
      sessionStorage.setItem(key, value);
      return { ok: true, mode: "session" };
    } catch (error) {
      return { ok: false, mode: "none", error };
    }
  }
  function removeStoredValue(key) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }
  function persistDraft({ announce = true, requireLocal = false } = {}) {
    if (readOnly || !dirty) return true;
    let value;
    try {
      value = JSON.stringify({ state, baseline, savedAt: Date.now() });
    } catch {
      if (announce) status("本机恢复副本不可用，请保持页面打开", "error");
      return false;
    }
    const result = writeStoredValue(draftKey, value);
    if (result.ok && (!requireLocal || result.mode === "local")) return true;
    if (announce) status(isStorageQuotaError(result.error)
      ? "本机恢复副本空间不足，请保持页面打开"
      : "本机恢复副本不可用，请保持页面打开", "error");
    return false;
  }
  async function prepareNavigation() {
    if (draftRecovery) await draftRecovery;
    if (readOnly) return true;
    if ((await finishText()) === false) return false;
    if (linkedSavePromise && (await linkedSavePromise) === false) return false;
    if (await save()) return dirty ? prepareNavigation() : true;
    // An Agent lock or an offline server must not discard edits on navigation.
    return persistDraft();
  }
  function checkpoint() {
    history.push(clone(state));
    if (history.length > 60) history.shift();
    future = [];
  }
  function changed({ panels = true } = {}) {
    if (state.schemaVersion === 2) for (const node of state.nodes) if (node.type === "board" && !node.boardId) {
      node.boardId = "b_" + crypto.randomUUID().replaceAll("-", "");
      node.boardRevisionId = null;
    }
    updateGroupBounds();
    dirty = true;
    status(local ? "正在保存…" : "已暂存在当前浏览器", "busy");
    const draftSaved = persistDraft({ announce: false });
    if (!draftSaved && !local) status("本机恢复副本不可用，请及时备份", "error");
    render({ panels });
    clearTimeout(autoTimer);
    if (local && !conflict) autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
  }
  // `coalesce` is for live drags: the caller checkpoints once at the start, then streams updates.
  function mutate(fn, { coalesce = false } = {}) {
    if (!canEdit()) return;
    exitInteraction();
    if (!coalesce) checkpoint();
    fn();
    changed();
  }
  function current() {
    return state.nodes.filter((n) => selected.has(n.id));
  }
  function point(clientX, clientY) {
    const r = stage.getBoundingClientRect(), v = state.viewport;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }
  const iconPaths = window.ProtaCanvasIcons;
  function iconSvg(icon) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (iconPaths[icon] || iconPaths.frame) + "</svg>";
  }
  function decorate(element, icon, label = "") {
    element.innerHTML = iconSvg(icon);
    if (label) {
      const span = document.createElement("span");
      span.className = "button-label";
      span.textContent = label;
      element.append(span);
    }
  }
  for (const el of document.querySelectorAll("[data-icon]")) decorate(el, el.dataset.icon, el.textContent.trim());
  const actions = {
    agent: { label: "Prota", icon: "sparkles", agent: true, when: (ctx) => !readOnly && !ctx.nodes.some(effectiveLocked) && (ctx.nodes.length > 1 || ["board", "image", "text"].includes(ctx.single?.type)), run: () => focusAgent() },
    "edit-text": { label: (ctx) => isMarkdownDocument(ctx.single) ? "编辑 Markdown" : "编辑文字", icon: "pen-line", when: (ctx) => ctx.single && ["text", "note", "rect"].includes(ctx.single.type) && ctx.editable, run: (ctx) => startText(ctx.single.id) },
    style: { label: "样式", icon: "sliders-horizontal", when: (ctx) => ctx.single && ["board", "text", "note", "rect", "ellipse"].includes(ctx.single.type) && ctx.editable, run: () => openProperties() },
    fill: { label: "颜色", icon: "paint-bucket", when: (ctx) => ctx.single && ["rect", "ellipse"].includes(ctx.single.type) && ctx.editable, run: (ctx, rect) => openNodeColor(ctx.single, "color", "颜色", rect) },
    color: { label: "颜色", icon: "paint-bucket", when: (ctx) => ctx.single?.type === "note" && ctx.editable, run: (ctx, rect) => openNodeColor(ctx.single, "color", "便签颜色", rect) },
    replace: { label: "替换", icon: "replace", when: (ctx) => ctx.single?.type === "image" && ctx.editable, run: (ctx) => {
      imageReplaceTarget = ctx.single.id;
      $("#image-input").click();
    } },
    "fit-image": { label: "适应比例", icon: "crop", when: (ctx) => ctx.single?.type === "image" && ctx.editable, run: (ctx) => fitImageRatio(ctx.single) },
    preview: { label: "演示", icon: "play", shortcut: "双击", when: (ctx) => ctx.single?.type === "board" && ctx.single.src, run: (ctx) => { fit([ctx.single], { animate: true, align: state.focusAlignment || "center" }); previewBoard(ctx.single); } },
    "pin-state": { label: (ctx) => ctx.single?.pinnedState ? "更新固定状态" : "固定当前状态", icon: "pin", when: (ctx) => ctx.editable && ctx.single?.type === "board" && ctx.single.src, run: (ctx) => pinBoardState(ctx.single) },
    "copy-state": { label: "以当前状态复制", icon: "copy", when: (ctx) => ctx.editable && ctx.single?.type === "board" && ctx.single.src, run: (ctx) => pinBoardState(ctx.single, true) },
    "reset-state": { label: "回到固定状态", icon: "undo-2", when: (ctx) => Boolean(ctx.single?.pinnedState) && ctx.single.type === "board", run: (ctx) => resetPinnedBoard(ctx.single) },
    "unpin-state": { label: "取消固定", icon: "pin-off", when: (ctx) => ctx.editable && Boolean(ctx.single?.pinnedState), run: (ctx) => mutate(() => { delete ctx.single.pinnedState; }) },
    annotate: { label: "标注", icon: "pen-line", when: (ctx) => canAnnotateBoard(ctx.single), run: (ctx) => { fit([ctx.single], { animate: true, align: state.focusAlignment || "center" }); enterBoardAnnotation(ctx.single.id); } },
    adjust: { label: "调整", icon: "sliders-horizontal", when: (ctx) => ctx.editable && ctx.single && ctx.single.type !== "board", run: () => openProperties() },
    rename: { label: "重命名", icon: "pencil", shortcut: "F2", when: (ctx) => ctx.editable && ctx.single, run: () => focusName() },
    group: { label: "编组", icon: "group", shortcut: "⌘ G", when: (ctx) => ctx.editable && ctx.roots > 1, run: () => groupSelection() },
    ungroup: { label: "取消编组", icon: "ungroup", shortcut: "⌘ ⇧ G", when: (ctx) => ctx.editable && ctx.nodes.length > 0 && ctx.nodes.every((n) => n.type === "group"), run: () => ungroupSelection() },
    align: { label: "对齐", icon: "align-start-vertical", when: (ctx) => ctx.editable && ctx.roots > 1, run: (_, rect) => {
      const r = rect || $("#selection-tools").getBoundingClientRect();
      showMenu(alignmentActions(), r.left, r.bottom + 6);
    } },
    "align-left": { label: "左对齐", icon: "align-start-vertical", when: (ctx) => ctx.editable && ctx.roots > 1, run: () => align("left") },
    "align-center-x": { label: "水平居中", icon: "align-center-vertical", when: (ctx) => ctx.editable && ctx.roots > 1, run: () => align("centerX") },
    "align-right": { label: "右对齐", icon: "align-end-vertical", when: (ctx) => ctx.editable && ctx.roots > 1, run: () => align("right") },
    duplicate: { label: "复制", icon: "copy", shortcut: "⌘ D", when: (ctx) => ctx.editable, run: () => duplicateSelection() },
    "copy-image": { label: "复制到剪贴板", icon: "copy", shortcut: /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ ⇧ C" : "Ctrl Shift C", when: (ctx) => ctx.single?.type === "image", run: (ctx) => copyImageToClipboard(ctx.single) },
    lock: { label: "锁定", icon: "lock", when: (ctx) => ctx.editable, run: () => mutate(() => current().forEach((n) => n.locked = true)) },
    unlock: { label: "解锁", icon: "lock-open", when: (ctx) => ctx.nodes.length > 0 && ctx.nodes.some(effectiveLocked) && canEdit(), run: () => mutate(() => {
      for (const n of current()) {
        let item = n;
        const seen = /* @__PURE__ */ new Set();
        while (item && !seen.has(item.id)) {
          seen.add(item.id);
          item.locked = false;
          item = state.nodes.find((parent2) => parent2.id === item.parentId);
        }
      }
    }) },
    front: { label: "置于顶层", icon: "bring-to-front", when: (ctx) => ctx.editable, run: () => reorder(true) },
    back: { label: "置于底层", icon: "send-to-back", when: (ctx) => ctx.editable, run: () => reorder(false) },
    detach: { label: "移出容器", icon: "detach", when: (ctx) => ctx.editable && ctx.nodes.some((n) => n.parentId), run: () => mutate(() => C.reparent(state.nodes, selected, null)) },
    "select-parent": { label: "选择容器", icon: "frame", when: (ctx) => ctx.single?.parentId, run: (ctx) => {
      selected = /* @__PURE__ */ new Set([ctx.single.parentId]);
      groupContext = null;
      render();
    } },
    "enter-group": { label: "进入分组", icon: "group", when: (ctx) => ctx.single?.type === "group", run: (ctx) => enterGroup(ctx.single) },
    focus: { label: "聚焦选中", icon: "focus", when: (ctx) => ctx.nodes.length > 0, run: () => fit(current(), { animate: true }) },
    delete: { label: "删除", icon: "trash-2", shortcut: "⌫", danger: true, when: (ctx) => ctx.editable, run: () => removeSelection() }
  };
  function renderNodeTitle(title, node) {
    if (node.type !== "board") { title.textContent = node.name || ""; return; }
    let name = title.querySelector(".node-name");
    if (!name) {
      title.replaceChildren();
      name = document.createElement("span");
      name.className = "node-name";
      title.append(name);
    }
    name.textContent = node.name || "";
    renderBoardStateButton(title, node);
    let button = title.querySelector(".board-version");
    if (!node.src || (!node.boardRevisionId && !(local && boardVersionsEnabled))) { button?.remove(); return; }
    if (!button) {
      button = document.createElement("button");
      button.className = "board-version";
      button.type = "button";
      button.setAttribute("aria-haspopup", "menu");
      button.addEventListener("pointerdown", e => e.stopPropagation());
      button.addEventListener("dblclick", e => e.stopPropagation());
      button.onclick = e => {
        e.stopPropagation();
        const currentNode = state.nodes.find(n => n.id === node.id);
        if (!currentNode || !canEdit() || effectiveLocked(currentNode) || agentHeld(currentNode)) return;
        $('#notice').hidden = true;
        if (!$("#context-menu").hidden && $("#context-menu").dataset.boardVersions === node.id) {
          setFloatingPanel("#context-menu", false);
          return;
        }
        finishText();
        exitInteraction();
        selected = new Set([node.id]);
        render();
        openBoardVersions(node.id, button.getBoundingClientRect());
      };
      title.append(button);
    }
    const cached = boardTitleVersions.get(node.boardId);
    const label = currentBoardVersion(node, cached).toUpperCase();
    button.textContent = label;
    if (local && boardVersionsEnabled) {
      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevron.setAttribute("viewBox", "0 0 24 24");
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = '<path d="M6 9l6 6 6-6"/>';
      button.append(chevron);
    }
    button.setAttribute("aria-expanded", String(!$("#context-menu").hidden && $("#context-menu").dataset.boardVersions === node.id));
    button.setAttribute("aria-label", `${node.name || "画板"}，${label}，切换版本`);
    button.disabled = !local || !boardVersionsEnabled || !canEdit() || effectiveLocked(node) || agentHeld(node);
    if (local && boardVersionsEnabled && node.boardId && cached?.pointer !== node.boardRevisionId) {
      boardTitleVersions.set(node.boardId, { ...cached, pointer: node.boardRevisionId });
      loadBoardVersions(node).catch(() => { /* The dropdown retries explicitly on the next click. */ });
    }
  }
  function currentBoardVersion(node, catalog = boardTitleVersions.get(node.boardId)) {
    const versions = catalog?.versions || { v1: { revisionId: null } };
    if (node.boardVersionId && (versions[node.boardVersionId] || (!catalog?.versions && /^v\d+$/.test(node.boardVersionId)))) return node.boardVersionId;
    let pointer = node.boardRevisionId;
    const seen = new Set();
    while (pointer && !seen.has(pointer)) {
      seen.add(pointer);
      const match = Object.keys(versions).find(name => versions[name].revisionId === pointer);
      if (match) return match;
      pointer = catalog?.revisions?.find(r => r.revisionId === pointer)?.parentRevisionId;
    }
    return Object.keys(versions)[0] || "v1";
  }
  function boardParams(node) {
    return { projectId: route[1], pageId: route[2], version: route[3], nodeId: node.id, boardId: node.boardId };
  }
  async function loadBoardVersions(node) {
    const query = new URLSearchParams(boardParams(node));
    const response = await fetch("/api/boards/versions?" + query, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw Error(payload?.error || "读取画板版本失败");
    const result = D.normalizeBoardVersions(payload);
    boardTitleVersions.set(node.boardId, { ...result, pointer: node.boardRevisionId });
    for (const board of state.nodes) if (board.type === "board" && board.boardId === node.boardId) {
      const title = nodeEls.get(board.id)?.querySelector(".node-title");
      if (title) renderNodeTitle(title, board);
    }
    return result;
  }
  async function changeBoardVersion(nodeId, versionAction, targetVersion) {
    if (!local || !boardVersionsEnabled || !canEdit()) return false;
    const board = state.nodes.find(node => node.id === nodeId);
    if (boardTitleVersions.get(board?.boardId)?.manageSupported === false) {
      notice("本地服务版本较旧，历史版本可查看；请在当前生成任务结束后重新启动 Prota，再进行迭代、切换或删除。");
      return false;
    }
    finishText();
    exitInteraction();
    if (baseline.schemaVersion === 1 && state.schemaVersion === 2) dirty = true;
    if (!await save()) return false;
    const node = state.nodes.find(n => n.id === nodeId && n.type === "board");
    if (!node || effectiveLocked(node) || agentHeld(node) || !canEdit()) return false;
    boardVersionBusy = true;
    renderInspector();
    status(versionAction === "fork" ? "正在创建版本…" : versionAction === "delete" ? "正在删除版本…" : "正在切换版本…", "busy");
    try {
      const response = await fetch("/api/boards/versions/manage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...boardParams(node), revision: baseline.revision, baseline: clone(baseline), versionAction, targetVersion })
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "画板版本操作失败");
      // Install only the committed pointer and layout revision. Do not discard local layout
      // or race a subsequent disk read; the server compares the complete saved baseline.
      const savedNode = baseline.nodes.find(n => n.id === nodeId);
      savedNode.boardRevisionId = result.revisionId;
      node.boardRevisionId = result.revisionId;
      savedNode.boardVersionId = node.boardVersionId = result.boardVersionId;
      baseline.revision = state.revision = result.revision;
      history = []; future = [];
      boardStamps.set(node.id, Date.now());
      boardPreviewUrls.delete(node.id);
      status(versionAction === "fork" ? `已创建 ${result.boardVersionId.toUpperCase()}` : versionAction === "delete" ? "已删除版本" : "已切换版本");
      $("#notice").hidden = true;
      return true;
    } catch (error) {
      status("画板版本操作失败", "error");
      notice(error.message);
      return false;
    } finally {
      boardVersionBusy = false;
      render();
    }
  }
  async function deleteBoardVersion(nodeId, version) {
    let confirmed;
    const options = { title: `删除版本 ${version.toUpperCase()}`, message: "该版本将从画板版本列表中删除。", okText: "确认删除" };
    try {
      confirmed = parent !== window && parent.shell?.showConfirm ? await parent.shell.showConfirm(options) : window.confirm(options.title + "？");
    } catch { confirmed = window.confirm(options.title + "？"); }
    if (confirmed) await changeBoardVersion(nodeId, "delete", version);
  }
  async function openBoardVersions(nodeId, rect) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !canEdit() || effectiveLocked(node) || agentHeld(node)) return;
    try {
      const catalog = await loadBoardVersions(node);
      if (current()[0]?.id !== nodeId || !canEdit()) return;
      const active = currentBoardVersion(node, catalog);
      const names = Object.keys(catalog.versions).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
      const menu = $("#context-menu");
      closePalette();
      setFloatingPanel("#property-popover", false);
      menu.replaceChildren();
      menu.removeAttribute("data-selection-tools");
      menu.style.removeProperty("max-height");
      menu.dataset.boardVersions = nodeId;
      menuInvoker = nodeEls.get(nodeId)?.querySelector(".board-version");
      const list = document.createElement("div");
      list.className = "version-panel__list";
      const close = () => setFloatingPanel("#context-menu", false);
      for (const version of names) {
        const row = document.createElement("div");
        row.className = "version-row" + (version === active ? " is-active" : "");
        row.dataset.version = version;
        const select = document.createElement("button");
        select.className = "version-row__label";
        select.textContent = version.toUpperCase();
        select.setAttribute("role", "menuitemradio");
        select.setAttribute("aria-checked", String(version === active));
        select.dataset.action = "board-version-switch-" + version;
        const switchToVersion = () => { close(); if (version !== active) changeBoardVersion(nodeId, "switch", version); };
        select.onclick = switchToVersion;
        row.onclick = event => { if (!event.target.closest("button")) switchToVersion(); };
        const actions = document.createElement("div");
        actions.className = "version-row__actions";
        const fork = document.createElement("button");
        fork.className = "version-row__btn version-row__btn--fork";
        fork.title = `基于 ${version.toUpperCase()} 迭代`;
        fork.setAttribute("aria-label", fork.title);
        fork.dataset.action = "board-version-fork-" + version;
        decorate(fork, "plus");
        fork.onclick = () => { close(); changeBoardVersion(nodeId, "fork", version); };
        const remove = document.createElement("button");
        remove.className = "version-row__btn version-row__btn--delete";
        remove.title = `删除 ${version.toUpperCase()}`;
        remove.setAttribute("aria-label", remove.title);
        remove.dataset.action = "board-version-delete-" + version;
        remove.disabled = names.length <= 1;
        decorate(remove, "trash-2");
        remove.onclick = () => { close(); deleteBoardVersion(nodeId, version); };
        actions.append(fork, remove);
        row.append(select, actions);
        list.append(row);
      }
      const footer = document.createElement("div");
      footer.className = "version-panel__footer";
      const forkCurrent = document.createElement("button");
      forkCurrent.className = "version-panel__action";
      forkCurrent.dataset.action = "board-version-fork-current";
      decorate(forkCurrent, "plus", `基于 ${active.toUpperCase()} 迭代`);
      forkCurrent.onclick = () => { close(); changeBoardVersion(nodeId, "fork", active); };
      footer.append(forkCurrent);
      menu.append(list, footer);
      const anchor = rect || menuInvoker.getBoundingClientRect();
      placeFloating(menu, anchor.left, anchor.bottom + 6);
      menuInvoker?.setAttribute("aria-expanded", "true");
      list.querySelector('.is-active .version-row__label')?.focus({ preventScroll: true });
    } catch (error) { notice(error.message); }
  }
  function actionContext() {
    const nodes = current(), single = nodes.length === 1 ? nodes[0] : null;
    return { nodes, single, roots: selectedRoots().length, editable: canEdit() && nodes.length > 0 && nodes.every((n) => !effectiveLocked(n) && !agentHeld(n)) };
  }
  function resolveAction(id) {
    const def = actions[id], ctx = actionContext();
    if (!def || !def.when(ctx)) return null;
    return { id, label: typeof def.label === "function" ? def.label(ctx) : def.label, icon: def.icon, shortcut: def.shortcut, agent: def.agent, danger: def.danger, disabled: def.disabled?.() || false, run: (event, rect) => def.run(ctx, rect) };
  }
  function contextActions(options = {}) {
    const ctx = actionContext();
    if (!ctx.nodes.length) return { primary: [], more: [] };
    const primary = [], more = [];
    const push = (list, id) => {
      const action = resolveAction(id);
      if (action) list.push(action);
    };
    if (ctx.nodes.some(effectiveLocked)) {
      push(primary, "unlock");
      push(primary, "copy-image");
      push(primary, "focus");
      return { primary, more };
    }
    if (ctx.single?.type === "board" && !ctx.single.src) {
      push(primary, "style");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "board") {
      push(primary, "style");
      push(primary, "preview");
      push(primary, "annotate");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.single && ["text", "note"].includes(ctx.single.type)) {
      push(primary, ctx.single.type === "note" ? "color" : "style");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.single && ["rect", "ellipse"].includes(ctx.single.type)) {
      push(primary, "fill");
      push(primary, "style");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "image") {
      push(primary, "replace");
      push(primary, "copy-image");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "group") {
      push(primary, "rename");
      push(primary, "ungroup");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    } else if (ctx.roots > 1) {
      push(primary, "group");
      if (options.toolbar) {
        push(primary, "align-left");
        push(primary, "align-center-x");
        push(primary, "align-right");
        primary.push({ id: "align-more", label: "更多对齐", icon: "align-horizontal-distribute-center", chevron: true, run: (_, rect) => {
          const r = rect || $("#selection-tools").getBoundingClientRect();
          showMenu(alignmentActions().filter((a) => !["left", "centerX", "right"].includes(a.id)), r.left, r.bottom + 6, $(`#selection-tools [data-action="align-more"]`), { keepSelectionTools: true });
        } });
      } else push(primary, "align");
      push(primary, "duplicate");
    } else {
      push(primary, "adjust");
      push(primary, "front");
      push(primary, "back");
      push(primary, "focus");
      push(primary, "duplicate");
    }
    push(primary, "agent");
    for (const id of ["pin-state", "copy-state", "reset-state", "unpin-state", "rename", "enter-group", "preview", "fit-image", "front", "back", "detach", "select-parent", "focus", "lock", "delete"]) {
      const action = resolveAction(id);
      if (action && !primary.some((p) => p.id === id)) more.push(action);
    }
    return { primary, more };
  }
  function runAction(id, event, rect) {
    const action = resolveAction(id);
    if (!action || action.disabled) {
      notice(current().some(effectiveLocked) ? "对象已锁定，请先解锁。" : current().some(agentHeld) ? "Agent 正在处理此对象，请先操作其他对象。" : "请先选择适用的对象。");
      return false;
    }
    setFloatingPanel("#context-menu", false);
    action.run(event, rect);
    return true;
  }
  function actionButton(action, menu = false) {
    const button = document.createElement("button");
    decorate(button, action.icon, menu ? action.label : "");
    button.setAttribute("aria-label", action.label);
    if (!menu) { button.title = action.label; button.dataset.tip = action.label; }
    button.dataset.action = action.id;
    if (["fill", "color"].includes(action.id)) {
      button.classList.add("connection-color", "canvas-color-button");
      button.setAttribute("aria-label", "颜色"); button.setAttribute("aria-haspopup", "dialog"); button.title = "颜色";
      button.style.setProperty("--line-color", current()[0]?.color || "#ffffff");
      const swatch = document.createElement("span"); swatch.className = "connection-color-swatch canvas-color-swatch"; swatch.setAttribute("aria-hidden", "true");
      button.replaceChildren(swatch);
    }
    if (!menu && (action.id === "more" || action.id === "align-more")) {
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-controls", "context-menu");
      button.setAttribute("aria-expanded", String(!$("#context-menu").hidden && $("#context-menu").hasAttribute("data-selection-tools")));
    }
    if (action.chevron && !menu) {
      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevron.setAttribute("viewBox", "0 0 24 24");
      chevron.setAttribute("aria-hidden", "true");
      chevron.setAttribute("fill", "none");
      chevron.setAttribute("stroke", "currentColor");
      chevron.setAttribute("stroke-width", "2");
      chevron.setAttribute("stroke-linecap", "round");
      chevron.setAttribute("stroke-linejoin", "round");
      chevron.classList.add("action-chevron");
      chevron.innerHTML = '<path d="M6 9l6 6 6-6"/>';
      button.append(chevron);
    }
    button.disabled = Boolean(action.disabled);
    if (action.agent) button.classList.add("agent");
    if (action.danger) button.classList.add("danger");
    if (menu) button.setAttribute("role", "menuitem");
    if (action.shortcut && menu) {
      const hint = document.createElement("span");
      hint.className = "menu-shortcut";
      hint.textContent = action.shortcut;
      button.append(hint);
    }
    button.onclick = (e) => {
      const rect = button.getBoundingClientRect();
      if (!menu && (action.id === "more" || action.id === "align-more") && !$("#context-menu").hidden && $("#context-menu").hasAttribute("data-selection-tools") && menuInvoker === button) {
        setFloatingPanel("#context-menu", false);
        return;
      }
      setFloatingPanel("#context-menu", false);
      actions[action.id] ? runAction(action.id, e, rect) : action.run(e, rect);
      if (document.activeElement === button) stage.focus();
    };
    return button;
  }
  function alignmentActions() {
    return [["left", "左对齐", "align-start-vertical"], ["centerX", "水平居中", "align-center-vertical"], ["right", "右对齐", "align-end-vertical"], ["top", "顶部对齐", "align-start-horizontal"], ["centerY", "垂直居中", "align-center-horizontal"], ["bottom", "底部对齐", "align-end-horizontal"], ["evenX", "水平等距", "align-horizontal-distribute-center"], ["evenY", "垂直等距", "align-vertical-distribute-center"]].map(([mode, label, icon]) => ({ id: mode, label, icon, disabled: mode.startsWith("even") && selectedRoots().length < 3, run: () => align(mode) }));
  }
  function view() {
    const v = state.viewport;
    world.style.setProperty("--zoom", v.zoom);
    world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
    const gridStep = 20 * v.zoom * Math.pow(2, Math.ceil(Math.log2(1 / v.zoom)));
    stage.style.backgroundSize = `${gridStep}px ${gridStep}px`;
    stage.style.backgroundPosition = `${v.x}px ${v.y}px`;
    $("#zoom-reset").textContent = `${Math.round(v.zoom * 100)}%`;
    updateSelectionFrame();
    // Dots first: the selection toolbar is placed around the current dots.
    flowQuick?.sync();
    positionSelectionTools();
    connections?.schedule();
    positionTextTools();
    // Portal annotation markers must follow viewport pan/zoom; coalesce to one message per frame.
    if (parent !== window && !viewNotifyFrame) {
      viewNotifyFrame = requestAnimationFrame(() => {
        viewNotifyFrame = 0;
        if (parent !== window) parent.postMessage({ type: "prota:canvas-view" }, location.origin);
      });
    }
  }
  function notify() {
    const target = agentTextSelection && state.nodes.find(n => n.id === agentTextSelection.id);
    if (!target || selected.size !== 1 || !selected.has(target.id) || String(displayText(target)) !== agentTextSelection.source) agentTextSelection = null;
    if (window.parent !== window) window.parent.postMessage({ type: "prota:canvas-selection", selected: current().map((n) => ({ id: n.id, name: n.name, type: n.type, src: n.src || "", parentId: n.parentId || null, ...(agentTextSelection?.id === n.id ? { textSelection: { start: agentTextSelection.start, end: agentTextSelection.end, text: agentTextSelection.source.slice(agentTextSelection.start, agentTextSelection.end).slice(0, 20000) } } : {}), bounds: { x: n.x, y: n.y, width: n.width, height: n.height }, attributes: { flowShape: n.flowShape || null, prdPath: prdPath(n), text: String(displayText(n)).slice(0, 1e3), color: n.color || "", fontSize: n.fontSize || 20, locked: effectiveLocked(n) } })), dirty, runtimeVersion: 63 }, location.origin === "null" ? "*" : location.origin);
  }
  function exitInteraction() {
    const previous = state.nodes.find(n => n.id === interacting);
    resetBoardRightGesture();
    if (annotationBoardId) exitBoardAnnotation();
    interacting = null;
    document.querySelectorAll(".interacting").forEach((n) => n.classList.remove("interacting"));
    $("#interaction-hint").textContent = "";
    if (previous?.pinnedState) resetPinnedBoard(previous);
  }
  function renderBoardStateButton(title, node) {
    // The pin stays in the title row, pushed to its right end; visibility
    // itself stays CSS-driven (only the activated board shows it).
    let button = title.querySelector('.board-state-pin');
    const allowed = canEdit() && !effectiveLocked(node) && !agentHeld(node);
    if (!node.src || !allowed) { button?.remove(); return; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.className = 'board-state-pin';
      decorate(button, 'pin');
      for (const type of ['pointerdown', 'dblclick']) button.addEventListener(type, e => e.stopPropagation());
      button.onclick = e => {
        e.stopPropagation();
        const currentNode = state.nodes.find(n => n.id === node.id);
        if (!currentNode || !canEdit() || effectiveLocked(currentNode) || agentHeld(currentNode)) return;
        $('#notice').hidden = true;
        selected = new Set([currentNode.id]); renderInspector(); notify();
        if (!currentNode.pinnedState) { pinBoardState(currentNode); return; }
        const rect = button.getBoundingClientRect();
        showMenu(['pin-state','copy-state','reset-state','unpin-state'].map(resolveAction).filter(Boolean), rect.left, rect.bottom + 4, button);
      };
      title.append(button);
    }
    button.classList.toggle('is-pinned', Boolean(node.pinnedState));
    const stateWarning = nodeEls.get(node.id)?.querySelector('iframe')?.dataset.stateWarning;
    button.title = node.pinnedState ? stateWarning ? `已固定状态 · ${stateWarning}` : '已固定状态' : '固定当前状态';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(Boolean(node.pinnedState)));
    button.setAttribute('aria-haspopup', node.pinnedState ? 'menu' : 'false');
  }
  async function pinBoardState(node, duplicate = false) {
    if (!canEdit() || effectiveLocked(node) || agentHeld(node)) return false;
    const frame = nodeEls.get(node.id)?.querySelector('iframe');
    if (!frame || restoringBoardStates.has(frame) || frame.dataset.statePending) { notice('画板正在恢复状态，请稍后重试'); return false; }
    const src = node.src, version = node.boardVersionId, sourceDocument = frame.contentDocument;
    boardStateBusy = true;
    try {
      const pinnedState = await window.CanvasBoardState.capture(frame, boardPreviewUrls.get(node.id) || src);
      D.validate({...state, nodes: state.nodes.map(n => n === node ? {...n, pinnedState} : n)});
      if (!state.nodes.includes(node) || node.src !== src || node.boardVersionId !== version || frame.contentDocument !== sourceDocument || readOnly || agentHeld(node)) throw Error('画板已变化，请重新固定');
      boardStateBusy = false;
      if (duplicate) {
        mutate(() => {
          const row = state.nodes.filter(n => n.parentId === node.parentId && n.y < node.y + node.height && n.y + n.height > node.y);
          const offset = Math.max(node.x + node.width + 64, ...row.map(n => n.x + n.width + 64)) - node.x;
          const copied = C.duplicate(state.nodes, new Set([node.id]), offset);
          for (const child of copied.nodes) child.y -= offset;
          copied.nodes.find(n => n.id === copied.selected[0]).pinnedState = pinnedState;
          state.nodes.push(...copied.nodes);
          if (state.edges) state.edges.push(...C.duplicateEdges(state.edges, copied.mapping, {x:offset,y:0}));
          selected = new Set(copied.selected);
        });
      } else {
        checkpoint(); node.pinnedState = pinnedState;
        exitInteraction(); changed();
      }
      const saved = await save();
      if (saved && !dirty) notice(duplicate ? '已复制并固定状态' : '已固定当前状态');
      return true;
    } catch (error) {
      notice(error.message || '状态固定失败，请重试', [{label:'适配状态保存', run: () => {
        selected = new Set([node.id]); render(); notify(); focusAgent(true);
      }}]);
      return false;
    } finally { boardStateBusy = false; render(); }
  }
  function resetPinnedBoard(node) {
    if (!node.pinnedState) return;
    const frame = nodeEls.get(node.id)?.querySelector('iframe');
    if (!frame || restoringBoardStates.has(frame)) return;
    try {
      const url = new URL(window.CanvasBoardState.urlFor(node.pinnedState, boardPreviewUrls.get(node.id) || node.src));
      // Assigning an unchanged hash URL can be a same-document navigation and
      // never fire load. A transient query forces a fresh JS realm; restore
      // removes it with replaceState before applying the saved data.
      url.searchParams.set('__prota_restore', crypto.randomUUID());
      nodeEls.get(node.id)?.classList.add('restoring-state');
      frame.dataset.statePending = 'true';
      frame.src = url.href;
    }
    catch (error) { notice(error.message); }
  }
  async function restorePinnedBoard(nodeId, frame) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node?.pinnedState || interacting === nodeId || restoringBoardStates.has(frame) || !frame.isConnected || nodeEls.get(nodeId)?.querySelector('iframe') !== frame) return;
    restoringBoardStates.add(frame);
    nodeEls.get(nodeId)?.classList.add('restoring-state');
    try {
      const result = await window.CanvasBoardState.restore(frame, node.pinnedState, boardPreviewUrls.get(nodeId) || node.src);
      delete frame.dataset.stateError;
      if (result?.skippedControls) frame.dataset.stateWarning = '页面已更新，部分旧控件已跳过，可重新固定';
      else delete frame.dataset.stateWarning;
    } catch (error) {
      frame.dataset.stateError = 'true';
      // Automatic refresh must not interrupt unrelated canvas work. Keep the
      // pin intact and attach diagnostics to this board's existing control.
      frame.dataset.stateWarning = error.message || '固定状态未完整恢复，可重新固定';
    } finally {
      restoringBoardStates.delete(frame);
      delete frame.dataset.statePending;
      if (nodeEls.get(nodeId)?.querySelector('iframe') === frame) {
        nodeEls.get(nodeId)?.classList.remove('restoring-state');
        const title = nodeEls.get(nodeId)?.querySelector('.node-title');
        if (title) renderBoardStateButton(title, node);
      }
      connections?.schedule();
    }
  }
  function boardFolderOf(node) {
    const match = /^boards\/([a-zA-Z0-9_-]+)\/index\.html$/.exec(node?.src || "");
    return match ? match[1] : "";
  }
  function postAnnotationState(active, { rebind = false } = {}) {
    const node = state.nodes.find((n) => n.id === annotationBoardId);
    const payload = { type: "prota:canvas-annotation-state", active: Boolean(active), boardId: boardFolderOf(node), boardPath: node?.src || "", nodeId: annotationBoardId || "", rebind };
    window.__protaCanvasAnnotationState = payload;
    if (parent !== window) parent.postMessage(payload, location.origin);
  }
  function enterBoardAnnotation(id) {
    const node = state.nodes.find((n) => n.id === id && n.type === "board");
    if (!canAnnotateBoard(node)) return;
    resetBoardRightGesture();
    const el = nodeEls.get(id);
    const frame = el?.querySelector("iframe");
    if (!node || !frame || !boardFolderOf(node)) {
      notice("该画板还没有生成内容，暂时不能标注。");
      return;
    }
    let doc = null;
    try { doc = frame.contentDocument; } catch { doc = null; }
    if (!doc) {
      notice("无法访问该画板内容，暂时不能标注。");
      return;
    }
    if (interacting && interacting !== id) {
      interacting = null;
      document.querySelectorAll(".interacting").forEach((n) => n.classList.remove("interacting"));
    }
    annotationBoardId = id;
    annotationFrameEl = frame;
    if (interacting !== id) {
      selected = /* @__PURE__ */ new Set([id]);
      groupContext = null;
      render();
      interacting = id;
      el.classList.add("interacting");
    }
    document.body.classList.add("board-annotating");
    updateSelectionFrame();
    renderInspector();
    $("#interaction-hint").textContent = "标注中 · 右键或 Esc 退出";
    positionSelectionTools();
    postAnnotationState(true);
  }
  function exitBoardAnnotation() {
    if (!annotationBoardId) return;
    annotationBoardId = null;
    annotationFrameEl = null;
    document.body.classList.remove("board-annotating");
    updateSelectionFrame();
    renderInspector();
    positionSelectionTools();
    $("#interaction-hint").textContent = interacting ? "预览中 · Esc 返回画布" : "";
    resetBoardRightGesture();
    postAnnotationState(false);
  }
  function resetBoardRightGesture() {
    boardRightGesture = { boardId: null, count: 0, required: 2, lastTime: 0, lastX: 0, lastY: 0 };
    cancelDeferredBoardMenu();
  }
  function cancelDeferredBoardMenu() {
    if (!deferredBoardMenu) return;
    clearTimeout(deferredBoardMenu.timer);
    deferredBoardMenu = null;
  }
  function deferBoardMenu(run) {
    cancelDeferredBoardMenu();
    deferredBoardMenu = { run, timer: setTimeout(() => { deferredBoardMenu = null; run?.(); }, RIGHT_GESTURE_INTERVAL) };
  }
  // Unified right-click counter: the 1st click may land on the canvas while the
  // board is inactive, follow-ups land inside the board iframe. Both feed this
  // single state machine; the threshold is fixed when the sequence starts.
  function handleBoardContextMenu(boardId, screenX, screenY, showMenu) {
    if (annotationBoardId) {
      exitBoardAnnotation();
      return;
    }
    showMenu ||= deferredBoardMenu?.run;
    setFloatingPanel("#context-menu", false);
    const outerFrame = window.frameElement;
    if (outerFrame) {
      const rect = outerFrame.getBoundingClientRect();
      screenX *= rect.width / Math.max(1, innerWidth);
      screenY *= rect.height / Math.max(1, innerHeight);
    }
    const now = Date.now(), g = boardRightGesture;
    if (g.boardId !== boardId || !g.lastTime || now - g.lastTime > RIGHT_GESTURE_INTERVAL || Math.hypot(screenX - g.lastX, screenY - g.lastY) > RIGHT_GESTURE_DISTANCE) {
      g.boardId = boardId;
      g.count = 0;
      g.required = interacting === boardId ? 2 : 3;
    }
    g.count += 1;
    g.lastTime = now;
    g.lastX = screenX;
    g.lastY = screenY;
    const node = state.nodes.find((n) => n.id === boardId && n.type === "board");
    if (!canAnnotateBoard(node)) {
      resetBoardRightGesture();
      if (interacting) exitInteraction();
      else showMenu?.();
      return;
    }
    if (g.count >= g.required) {
      resetBoardRightGesture();
      enterBoardAnnotation(boardId);
      return;
    }
    if (interacting !== boardId) {
      // First right click activates the board (same as preview double-click);
      // the regular menu still opens after the gesture window expires.
      exitInteraction();
      selected = /* @__PURE__ */ new Set([boardId]);
      groupContext = null;
      render();
      interacting = boardId;
      nodeEls.get(boardId)?.classList.add("interacting");
      $("#interaction-hint").textContent = "预览中 · Esc 返回画布";
      positionSelectionTools();
      deferBoardMenu(showMenu);
      return;
    }
    // A sequence started in preview waits for a possible second click before
    // leaving. Sequences started on an inactive board keep their three clicks.
    deferBoardMenu(g.required === 2 ? () => {
      exitInteraction();
      updateSelectionFrame();
      positionSelectionTools();
      stage.focus({ preventScroll: true });
    } : showMenu);
  }
  // Capture before board scripts, object menus, and floating controls. Frame
  // coordinates are converted to the same canvas space as outer-document clicks.
  function consumeFocusedContextMenu(e, frame = null) {
    if (!annotationBoardId && !interacting) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (annotationBoardId) {
      exitBoardAnnotation();
      return true;
    }
    let x = e.clientX, y = e.clientY;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      x = rect.left + x * rect.width / Math.max(1, frame.contentWindow.innerWidth);
      y = rect.top + y * rect.height / Math.max(1, frame.contentWindow.innerHeight);
    }
    handleBoardContextMenu(interacting, x, y);
    return true;
  }
  // Same-origin board frames report their own contextmenu/Escape events here.
  // Cross-origin or unavailable documents simply never bind; the editor keeps working.
  function detachBoardFrameEvents(frame) {
    boardFrameBindings.get(frame)?.abort();
    boardFrameBindings.delete(frame);
  }
  function attachBoardFrameEvents(nodeId, frame) {
    detachBoardFrameEvents(frame);
    if (!frame.isConnected || nodeEls.get(nodeId)?.querySelector("iframe") !== frame) return;
    let doc = null;
    try { doc = frame.contentDocument; } catch { doc = null; }
    if (!doc) {
      if (annotationBoardId === nodeId) exitBoardAnnotation();
      return;
    }
    const controller = new AbortController();
    boardFrameBindings.set(frame, controller);
    const options = { capture: true, signal: controller.signal };
    doc.addEventListener("pointerdown", (e) => {
      if (e.button !== 2) resetBoardRightGesture();
      lastInputWasKeyboard = false;
      setFloatingPanel("#context-menu", false);
    }, options);
    doc.addEventListener("pointermove", (e) => {
      if (e.buttons) resetBoardRightGesture();
      // Frame events never reach the canvas document; report the hovered board for its quick dots.
      else flowQuick?.hover(nodeId);
    }, options);
    // Keep native board scrolling, but route pinch / modified-wheel zoom to
    // the canvas camera. Frame events do not bubble into the canvas document.
    doc.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const rect = frame.getBoundingClientRect();
      const width = frame.contentWindow.innerWidth || frame.clientWidth || 1;
      const height = frame.contentWindow.innerHeight || frame.clientHeight || 1;
      handleCanvasWheel(e, rect.left + e.clientX * rect.width / width, rect.top + e.clientY * rect.height / height);
    }, { ...options, passive: false });
    doc.addEventListener("scroll", () => {
      if (parent !== window) parent.postMessage({ type: "prota:canvas-view" }, location.origin);
    }, options);
    doc.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      resetBoardRightGesture();
      e.preventDefault();
      e.stopPropagation();
      if (annotationBoardId) {
        exitBoardAnnotation();
        stage.focus();
        return;
      }
      setFloatingPanel("#property-popover", false);
      exitInteraction();
      stage.focus();
    }, options);
    frame.contentWindow.addEventListener("contextmenu", (e) => {
      consumeFocusedContextMenu(e, frame);
    }, options);
    doc.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const node = state.nodes.find((n) => n.id === nodeId && n.type === "board");
      if (!node) return;
      let screenX = e.clientX, screenY = e.clientY;
      try {
        const r = frame.getBoundingClientRect(), w = frame.contentWindow;
        screenX = r.left + (e.clientX / Math.max(1, w.innerWidth)) * r.width;
        screenY = r.top + (e.clientY / Math.max(1, w.innerHeight)) * r.height;
      } catch {
      }
      if (annotationBoardId) {
        if (annotationBoardId === nodeId) exitBoardAnnotation();
        return;
      }
      if (!canAnnotateBoard(state.nodes.find(n => n.id === nodeId))) return;
      handleBoardContextMenu(nodeId, screenX, screenY, () => openNodeMenu(nodeEls.get(nodeId), screenX, screenY, { includeBoardAdd: true }));
    }, options);
    if (annotationBoardId === nodeId) {
      annotationFrameEl = frame;
      postAnnotationState(true, { rebind: true });
    }
  }
  // Insertable flowchart presets come from the shared registry; legacy kinds keep their icons.
  const flowRegistry = window.CanvasFlowShapes, legacyFlowIcons = { terminator: "flow-terminator", process: "flow-process", decision: "flow-decision", subprocess: "flow-subprocess", connector: "flow-connector" };
  const flowShapes = Object.fromEntries((flowRegistry?.MENU || []).map(id => [id, { ...flowRegistry.defaults(id), icon: legacyFlowIcons[id] || "flowchart" }]));
  const colorAlpha = (color, opacity = 1) => opacity === 1 ? color : `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
  function renderFlowGeometry(el, node) {
    el.classList.toggle("flowchart", Boolean(node.flowShape));
    if (!node.flowShape) {
      delete el.dataset.flowShape;
      for (const name of ["--flow-stroke", "--flow-stroke-width", "--flow-inset"]) el.style.removeProperty(name);
      return;
    }
    el.dataset.flowShape = node.flowShape;
    // Stroke and text inset are CSS variables so selection/target outlines can still override them.
    if (node.strokeColor) el.style.setProperty("--flow-stroke", colorAlpha(node.strokeColor, node.strokeOpacity)); else el.style.removeProperty("--flow-stroke");
    if (node.strokeWidth) el.style.setProperty("--flow-stroke-width", node.strokeWidth); else el.style.removeProperty("--flow-stroke-width");
    const inset = flowRegistry?.inset(node.flowShape) || 0;
    if (inset) el.style.setProperty("--flow-inset", `${inset * 100}%`); else el.style.removeProperty("--flow-inset");
    let svg = el.querySelector(":scope > .flow-geometry");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("flow-geometry"); svg.setAttribute("aria-hidden", "true"); el.prepend(svg);
    }
    const signature = JSON.stringify([node.flowShape, node.width, node.height, node.color, node.fillOpacity]);
    if (svg.dataset.geometry === signature) return;
    svg.dataset.geometry = signature;
    const w = node.width, h = node.height;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("preserveAspectRatio", "none"); svg.replaceChildren();
    // The first path is the fillable outline; later paths are decorative strokes only.
    (flowRegistry?.paths(node.flowShape, w, h) || []).forEach((d, index) => {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", d); path.setAttribute("fill", index ? "none" : colorAlpha(node.color || "#ffffff", node.fillOpacity));
      path.setAttribute("vector-effect", "non-scaling-stroke");
      if (index) path.setAttribute("pointer-events", "none");
      svg.append(path);
    });
  }
  function nodeContentSignature(n) {
    return JSON.stringify([n.type, n.markdownDocument, n.flowShape, n.type === "board" ? "" : displayText(n), n.prdPath, n.markdownSource, n.src, n.pinnedState, n.cloneFrom ? baseline.nodes.some(saved => saved.id === n.id) : null, n.type === "board" ? boardPreviewUrls.get(n.id) || "" : "", n.type === "board" ? boardStamps.get(n.id) || 0 : 0]);
  }
  function render(options = {}) {
    if (options.panels === false) {
      if (!renderFrame) renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        renderNow({ panels: false });
      });
      return;
    }
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
      renderFrame = 0;
    }
    renderNow(options);
  }
  function renderNow({ panels = true } = {}) {
    if (selected.size && connections?.getSelection()) connections.clear();
    nodeIndex = D.createIndex(state.nodes);
    if (annotationBoardId && !state.nodes.some((n) => n.id === annotationBoardId)) exitBoardAnnotation();
    const previous = new Map([...world.querySelectorAll(".node")].map((el) => [el.dataset.id, el]));
    const contextMembers = groupContext ? C.descendants(state.nodes, [groupContext]) : null;
    for (const [index, n] of state.nodes.entries()) {
      let el = previous.get(n.id);
      if (!el) {
        el = document.createElement("article");
        el.dataset.id = n.id;
      }
      previous.delete(n.id);
      nodeEls.set(n.id, el);
      const connectionLayers = ["connection-container", "connection-top-port", "connection-source", "connection-target"].filter(name => el.classList.contains(name));
      el.className = `node ${n.type}${n.type === "text" && !isMarkdownDocument(n) ? " plain-text" : ""}${selected.has(n.id) ? " selected" : ""}${effectiveLocked(n) ? " locked" : ""}${interacting === n.id ? " interacting" : ""}${n.hidden ? " hidden-node" : ""}${editing?.id === n.id ? " editing" : ""}${agentHeld(n) ? " agent-target" : ""}${n.id === groupContext ? " context" : ""}${contextMembers && !contextMembers.has(n.id) ? " dimmed" : ""}` + (connectionLayers.length ? " " + connectionLayers.join(" ") : "");
      Object.assign(el.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px`, background: n.color ? colorAlpha(n.color, n.fillOpacity) : "", fontSize: `${n.fontSize || 20}px`, opacity: n.opacity ?? 1, borderRadius: n.type === "ellipse" ? "50%" : `${n.radius || 0}px`, color: colorAlpha(n.textColor || "#30323a", n.textOpacity), fontWeight: n.fontWeight || 400, textAlign: n.textAlign || "left", letterSpacing: `${n.letterSpacing || 0}px` });
      const signature = nodeContentSignature(n);
      if (el.dataset.signature !== signature && editing?.id !== n.id) {
        el.dataset.signature = signature;
        el.querySelectorAll("iframe").forEach(detachBoardFrameEvents);
        el.replaceChildren();
        const title = document.createElement("div");
        title.className = "node-title";
        title.textContent = n.name;
        el.append(title);
        const content = document.createElement("div");
        content.className = "node-content";
        el.append(content);
        if (n.type === "board") {
          if (n.cloneFrom && !baseline.nodes.some(saved => saved.id === n.id)) {
            content.textContent = "正在复制…";
          } else if (/^boards\/[a-zA-Z0-9_-]+\/index\.html$/.test(n.src || "")) {
            const frame = document.createElement("iframe");
            const stamp = boardStamps.get(n.id) || 0;
            frame.src = (boardPreviewUrls.get(n.id) || n.src) + (stamp ? "?canvas=" + stamp : "");
            if (n.pinnedState) frame.src = window.CanvasBoardState.urlFor(n.pinnedState, boardPreviewUrls.get(n.id) || n.src);
            frame.title = n.name;
            // Anchored routes need DOM geometry even when their board is outside the viewport.
            frame.loading = state.edges?.some(edge => edge.fromInstanceId === n.id && edge.fromAnchor || edge.toInstanceId === n.id && edge.toAnchor) ? "eager" : "lazy";
            frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin");
            content.append(frame);
            el.classList.add("loading");
            frame.addEventListener("load", () => {
              el.classList.remove("loading");
              attachBoardFrameEvents(n.id, frame);
              restorePinnedBoard(n.id, frame);
              connections?.schedule();
            });
          } else {
            const placeholder2 = document.createElement("div");
            placeholder2.className = "board-placeholder";
            const heading = document.createElement("strong");
            heading.textContent = n.name;
            placeholder2.append(heading, document.createTextNode("双击，让 Agent 开始设计"));
            const create = document.createElement("button");
            decorate(create, "sparkles", "使用当前 Agent 生成");
            create.className = "board-agent";
            create.onclick = () => {
              selected = /* @__PURE__ */ new Set([n.id]);
              render();
              focusAgent();
            };
            placeholder2.append(create);
            content.append(placeholder2);
          }
        } else if (n.type === "image") {
          if (/^(data:image\/(png|jpeg|webp|gif);base64,|assets\/[a-zA-Z0-9_.-]+$)/.test(n.src || "")) {
            const img = document.createElement("img");
            img.src = n.src;
            img.alt = n.name;
            content.append(img);
          }
        } else if (n.type === "text") {
          content.append(window.CanvasMarkdown.render(displayText(n), { baseUrl: prdPath(n) }));
          void window.CanvasMarkdown.mount(content,{onResize:()=>scheduleFit(new Set([n.id]))});
          for (const image of content.querySelectorAll("img")) image.addEventListener("load", () => scheduleFit(new Set([n.id])));
        }
        else content.textContent = n.text || "";
      }
      renderFlowGeometry(el, n);
      const inner = el.querySelector(".node-content");
      if (inner) inner.style.lineHeight = n.lineHeight || "";
      if (inner && n.padding !== void 0) inner.style.padding = n.padding + "px";
      const placeholder = el.querySelector(".board-placeholder");
      if (placeholder) placeholder.hidden = state.nodes.some((child) => child.parentId === n.id);
      renderNodeTitle(el.querySelector(".node-title"), n);
      if (world.children[index] !== el) world.insertBefore(el, world.children[index] || null);
    }
    previous.forEach((el) => {
      el.querySelectorAll("iframe").forEach(detachBoardFrameEvents);
      nodeEls.delete(el.dataset.id);
      el.remove();
    });
    // Text renders Markdown, so its intrinsic height is only known once the DOM is in place.
    if (state.nodes.some(textAutoHeight)) scheduleFit();
    scheduleFlowText();
    world.append($("#selection-frame"));
    $("#empty").hidden = state.nodes.length > 0;
    $("#undo").disabled = !history.length;
    $("#redo").disabled = !future.length;
    if (panels) renderInspector();
    view();
    notify();
  }
  // Flow labels never cross their outline. After layout, mark nodes whose text exceeds the safe
  // area: CSS fades the overflow and the tooltip suggests enlarging the shape with its handles.
  let flowTextFrame = 0;
  function scheduleFlowText() {
    if (flowTextFrame || !state.nodes.some(n => n.flowShape)) return;
    flowTextFrame = requestAnimationFrame(() => {
      flowTextFrame = 0;
      const marks = [];
      for (const n of state.nodes) {
        const el = n.flowShape ? nodeEls.get(n.id) : null, inner = el?.querySelector(".node-content");
        if (!inner || el.classList.contains("editing")) continue;
        marks.push([el, inner.scrollHeight > inner.clientHeight + 1 || inner.scrollWidth > inner.clientWidth + 1]);
      }
      // Reads first, then writes: one layout pass however many flow shapes there are.
      for (const [el, over] of marks) {
        el.toggleAttribute("data-text-overflow", over);
        if (over) el.title = "文字超出图形，拖动手柄可扩大"; else el.removeAttribute("title");
      }
    });
  }
  function updatePositions(ids) {
    for (const id of ids) {
      const n = state.nodes.find((item) => item.id === id), el = nodeEls.get(id);
      if (!n || !el) continue;
      Object.assign(el.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px` });
      if (n.flowShape) renderFlowGeometry(el, n);
    }
    updateSelectionFrame();
    connections?.schedule();
    flowQuick?.sync();
    scheduleFlowText();
  }
  function updateSelectionFrame() {
    const frame = $("#selection-frame"), roots = selectedRoots().filter((n) => !effectiveLocked(n)), bounds = C.bounds(roots);
    frame.hidden = !bounds || !!editing || !!interacting || gesture?.kind === "select" || !selected.size;
    if (!bounds) return;
    frame.style.left = `${bounds.x}px`;
    frame.style.top = `${bounds.y}px`;
    frame.style.width = `${bounds.width}px`;
    frame.style.height = `${bounds.height}px`;
    frame.toggleAttribute("data-multi", roots.length > 1);
    const nodes = current();
    for (const node of nodeEls.values()) node.classList.toggle("multi-member", nodes.length > 1 && selected.has(node.dataset.id));
    const withHandles = canEdit() && roots.length > 0;
    for (const handle of frame.children) handle.style.display = withHandles ? "" : "none";
  }
  function renderInspector() {
    const signature = JSON.stringify(current());
    const box = $("#selection-tools");
    box.replaceChildren();
    const nodes = current();
    if (nodes.length > 1) {
      const count = document.createElement("span");
      count.className = "selection-count";
      count.textContent = `已选 ${nodes.length} 个`;
      box.append(count);
    }
    const { primary, more } = contextActions({ toolbar: true });
    for (let index = primary.length - 1; index >= 0; index--) {
      if (["duplicate", "copy-image", "copy-state"].includes(primary[index].id)) more.unshift(...primary.splice(index, 1));
    }
    if (innerWidth < 480) {
      const agentIndex = primary.findIndex(action => action.agent);
      const agent = agentIndex >= 0 ? primary.splice(agentIndex, 1)[0] : null;
      const limit = agent ? 2 : 3;
      if (primary.length > limit) more.unshift(...primary.splice(limit));
      if (agent) primary.push(agent);
    }
    primary.forEach((action) => {
      if (action.agent && box.childElementCount > 0) {
        const divider = document.createElement("span");
        divider.className = "divider";
        box.append(divider);
      }
      box.append(actionButton(action));
    });
    if (more.length) {
      const divider = document.createElement("span");
      divider.className = "divider";
      box.append(divider);
      box.append(actionButton({ id: "more", label: "更多", icon: "ellipsis", run: (_, rect) => {
        const r = rect || box.getBoundingClientRect();
        showMenu(more, r.left, r.bottom + 6, box.querySelector('[data-action="more"]'), { keepSelectionTools: true });
      } }));
    }
    if (propertiesSelection !== [...selected].join(",")) {
      closeNodeColor();
      propertyEdit = null;
      setFloatingPanel("#property-popover", false);
      propertiesSelection = [...selected].join(",");
    }
    if (!$("#property-popover").hidden && signature !== panelKey && !properties.contains(document.activeElement)) renderProperties();
    panelKey = signature;
    positionSelectionTools();
  }
  const boardPresets = [["", "自定义"], ["390x844", "iPhone"], ["412x915", "Android"], ["834x1194", "平板"], ["1440x900", "Web"]];
  let nodeColorPanel = null, nodeColorCleanup = null;
  function closeNodeColor() {
    nodeColorCleanup?.(); nodeColorCleanup = null;
    if (nodeColorPanel) { nodeColorPanel.hidden = true; nodeColorPanel.replaceChildren(); }
  }
  function openNodeColor(node, key, label, anchor) {
    closeNodeColor();
    if (!node || !canEdit() || effectiveLocked(node) || agentHeld(node)) return;
    const rect = anchor || $("#selection-tools").getBoundingClientRect();
    if (!nodeColorPanel) {
      nodeColorPanel = document.createElement("div"); nodeColorPanel.id = "node-colors";
      nodeColorPanel.className = "floating canvas-color-palette"; nodeColorPanel.setAttribute("role", "dialog");
      document.body.append(nodeColorPanel);
    }
    nodeColorPanel.setAttribute("aria-label", label);
    let started = false;
    const apply = value => {
      const target = state.nodes.find(n => n.id === node.id);
      if (!target || !selected.has(node.id) || !canEdit() || effectiveLocked(target) || agentHeld(target)) { closeNodeColor(); return; }
      if (target[key] === value) return;
      if (!started) { checkpoint(); started = true; }
      target[key] = value; changed();
      for (const button of nodeColorPanel.querySelectorAll('[data-color]')) button.setAttribute('aria-pressed', String(button.dataset.color === value));
    };
    nodeColorPanel.append(C.colorGrid({ label, value: node[key] || (key === "textColor" ? "#424650" : key === "strokeColor" ? "#97a5b8" : "#ffffff"),
      presets: key === "color" ? ["#fff1b8", "#ffd9d2", "#d4ecec", "#dde6ff", "#f0ddff", "#ffffff", ...C.COLOR_PRESETS.slice(0, 5)] : C.COLOR_PRESETS,
      onInput: apply, onCommit: value => { apply(value); closeNodeColor(); stage.focus({ preventScroll: true }); } }));
    nodeColorPanel.hidden = false;
    nodeColorPanel.style.left = Math.max(8, Math.min(innerWidth - nodeColorPanel.offsetWidth - 8, rect.left)) + "px";
    nodeColorPanel.style.top = Math.max(8, Math.min(innerHeight - nodeColorPanel.offsetHeight - 8, rect.top - nodeColorPanel.offsetHeight - 8 < 8 ? rect.bottom + 8 : rect.top - nodeColorPanel.offsetHeight - 8)) + "px";
    const controller = new AbortController(), options = { capture: true, signal: controller.signal };
    nodeColorCleanup = () => controller.abort();
    document.addEventListener("pointerdown", e => { if (!e.target.closest('#node-colors')) closeNodeColor(); }, options);
    document.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopImmediatePropagation(); closeNodeColor(); stage.focus({ preventScroll: true }); } }, options);
    window.addEventListener("blur", closeNodeColor, { signal: controller.signal });
    window.addEventListener("resize", closeNodeColor, options);
    nodeColorPanel.querySelector("button")?.focus({ preventScroll: true });
  }
  function inspectorShapeIcon(id) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const box = flowRegistry.iconBox(id);
    svg.setAttribute("viewBox", `-3 -3 ${box.width + 6} ${box.height + 6}`); svg.setAttribute("aria-hidden", "true");
    for (const d of flowRegistry.paths(id, box.width, box.height)) {
      const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", d); svg.append(path);
    }
    return svg;
  }
  let inspectorDropdown = null;
  const closeInspectorDropdown = () => { inspectorDropdown?.(); inspectorDropdown = null; };
  window.addEventListener("resize", closeInspectorDropdown);
  document.addEventListener("scroll", closeInspectorDropdown, true);
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".inspector-choice")) closeInspectorDropdown();
  }, true);
  function inspectorChoice(label, options, value, onChange, { shapes = false, disabled = false } = {}) {
    const details = document.createElement("details"); details.className = "inspector-choice";
    const summary = document.createElement("summary"); summary.setAttribute("aria-label", label); summary.setAttribute("aria-haspopup", "listbox"); summary.setAttribute("aria-expanded", "false");
    const list = document.createElement("div"); list.className = shapes ? "inspector-options shape-options" : "inspector-options";
    list.setAttribute("role", "listbox"); list.setAttribute("aria-label", label);
    list.setAttribute("popover", "manual");
    const close = () => {
      details.open = false;
      if (list.matches(":popover-open")) list.hidePopover();
      summary.setAttribute("aria-expanded", "false");
      if (inspectorDropdown === close) inspectorDropdown = null;
    };
    const show = () => {
      if (disabled || !details.isConnected) return;
      if (inspectorDropdown !== close) closeInspectorDropdown();
      inspectorDropdown = close; details.open = true;
      summary.setAttribute("aria-expanded", "true");
      const anchor = summary.getBoundingClientRect(), margin = 8, gap = 5;
      const width = Math.min(Math.max(anchor.width, shapes ? 216 : 178), innerWidth - margin * 2);
      list.style.width = `${width}px`;
      const below = innerHeight - anchor.bottom - gap - margin, above = anchor.top - gap - margin;
      const expectedHeight = shapes ? 228 : options.length * 32 + 8;
      const upward = below < Math.min(228, expectedHeight) && above > below;
      list.style.maxHeight = `${Math.max(32, Math.min(228, upward ? above : below))}px`;
      if (!list.matches(":popover-open")) list.showPopover();
      const height = list.getBoundingClientRect().height;
      list.style.left = `${Math.max(margin, Math.min(anchor.left, innerWidth - width - margin))}px`;
      list.style.top = `${Math.max(margin, upward ? anchor.top - gap - height : anchor.bottom + gap)}px`;
      list.dataset.placement = upward ? "above" : "below";
    };
    const update = selected => {
      summary.replaceChildren();
      if (shapes) summary.append(inspectorShapeIcon(selected));
      else { const text = document.createElement("span"); text.textContent = options.find(([id]) => String(id) === String(selected))?.[1] || "自定义"; summary.append(text); }
      summary.title = options.find(([id]) => String(id) === String(selected))?.[1] || label;
      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg"); chevron.setAttribute("viewBox", "0 0 16 16"); chevron.classList.add("choice-chevron"); chevron.innerHTML = '<path d="m5 6 3 3 3-3"/>'; summary.append(chevron);
      for (const button of list.children) button.setAttribute("aria-selected", button.dataset.value === String(selected));
    };
    for (const [id, text] of options) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.value = id; button.setAttribute("role", "option"); button.setAttribute("aria-label", text); button.title = text;
      if (shapes) button.append(inspectorShapeIcon(id)); else button.textContent = text;
      if (label === "字重") button.style.fontWeight = id;
      button.onclick = () => { onChange(id); update(id); close(); summary.focus({ preventScroll: true }); };
      list.append(button);
    }
    details.append(summary, list); update(value);
    summary.setAttribute("aria-disabled", disabled);
    summary.onclick = event => { event.preventDefault(); if (!disabled) details.open ? close() : show(); };
    details.addEventListener("toggle", () => {
      if (details.open && !list.matches(":popover-open")) show();
      if (!details.open) close();
    });
    details.addEventListener("keydown", event => {
      if (disabled) { event.preventDefault(); return; }
      if (event.key === "Tab") close();
      if (event.key === "Escape" && details.open) { event.preventDefault(); event.stopPropagation(); close(); summary.focus(); }
      if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault(); show();
        const buttons = [...list.children], index = buttons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? buttons.length - 1 : 1)) % buttons.length;
        buttons[next].focus();
      }
    });
    return details;
  }
  function bindInspectorScrub(target, input, applyValue) {
    target.classList.add("scrub-handle"); target.title = "按住左右拖动调整 · Shift 加速 · Alt 细调";
    target.addEventListener("pointerdown", event => {
      if (event.button !== 0 || input.disabled || !canEdit()) return;
      event.preventDefault(); event.stopPropagation();
      propertyEdit = null;
      const origin = Number(input.value), step = Number(input.step) || 1, startX = event.clientX;
      let lastX = startX, value = origin, started = false;
      target.setPointerCapture(event.pointerId);
      const move = e => {
        if (!started && Math.abs(e.clientX - startX) < 3) return;
        started = true; document.body.classList.add("inspector-scrubbing");
        value += (e.clientX - lastX) * step * (e.shiftKey ? 10 : e.altKey ? .1 : 1); lastX = e.clientX;
        const low = input.min === "" ? -1e6 : Number(input.min), high = input.max === "" ? 1e6 : Number(input.max);
        value = Math.max(low, Math.min(high, value));
        input.value = Number(value.toFixed(2)); applyValue();
      };
      const finish = (cancel = false) => {
        target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", cancelDrag); target.removeEventListener("lostpointercapture", cancelDrag); document.removeEventListener("keydown", escape, true);
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        document.body.classList.remove("inspector-scrubbing");
        if (cancel && propertyEdit) { undo(); future = []; }
        else input.dispatchEvent(new Event("change", { bubbles: true }));
        propertyEdit = null;
      };
      const up = () => finish(), cancelDrag = () => finish(true), escape = e => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(true); } };
      target.addEventListener("pointermove", move); target.addEventListener("pointerup", up); target.addEventListener("pointercancel", cancelDrag); target.addEventListener("lostpointercapture", cancelDrag); document.addEventListener("keydown", escape, true);
    });
    target.addEventListener("click", event => event.preventDefault());
  }
  function renderProperties(focusLabel = "") {
    const n = current()[0];
    closeInspectorDropdown();
    properties.replaceChildren();
    if (!n || current().length !== 1) return;
    $("#property-title").textContent = renameOnly ? "重命名" : n.name || names[n.type];
    $("#property-popover").setAttribute("aria-label", renameOnly ? "重命名" : "对象样式");
    let fields = [["name", "名称", "text"], ["color", "颜色", "color"], ["opacity", "不透明度", "number"], ["radius", "圆角", "number"]];
    if (n.type === "group") fields = fields.filter(([key]) => key === "name");
    if (n.type === "ellipse" || n.flowShape) fields = fields.filter(([key]) => key !== "radius");
    if (n.flowShape) fields.splice(fields.findIndex(([key]) => key === "color") + 1, 0, ["strokeColor", "描边", "color"], ["strokeWidth", "描边宽度", "number"]);
    if (n.type === "text") fields = fields.filter(([key]) => !["color", "radius"].includes(key));
    if (n.type === "image" || n.type === "board") fields = fields.filter(([key]) => key !== "color" && key !== "radius");
    if (["text", "note", "rect", "ellipse"].includes(n.type)) fields.push(["text", "内容", "textarea"], ["fontSize", "字号", "number"], ["textColor", "文字颜色", "color"]);
    if (prdPath(n)) fields = fields.filter(([key]) => key !== "text");
    if (renameOnly) fields = fields.filter(([key]) => key === "name");
    let specialRow = null;
    if (!renameOnly && (n.type === "board" || n.flowShape && flowRegistry)) {
      specialRow = document.createElement("div"); specialRow.className = "inspector-special-row";
      const label = document.createElement("span"); label.textContent = n.type === "board" ? "设备预设" : "形状";
      const choice = n.type === "board"
        ? inspectorChoice("设备预设", boardPresets, boardPresets.find(([value]) => value === `${n.width}x${n.height}`)?.[0] ?? "", value => {
          const [width, height] = value.split("x").map(Number); if (width) { mutate(() => { n.width = width; n.height = height; }); renderProperties(); }
        }, { disabled: !canEdit() || effectiveLocked(n) || agentHeld(n) })
        : inspectorChoice("形状", flowRegistry.MENU.filter(id => flowRegistry.has(id)).map(id => [id, flowShapes[id].label]), n.flowShape, value => mutate(() => { n.flowShape = value; }), { shapes: true, disabled: !canEdit() || effectiveLocked(n) || agentHeld(n) });
      specialRow.append(label, choice);
    }
    if (!renameOnly && n.type !== "group") fields.splice(1, 0, ["x", "X", "number"], ["y", "Y", "number"], ["width", "W", "number"], ...(["text", "note"].includes(n.type) ? [] : [["height", "H", "number"]]));
    if (!renameOnly && ["text", "note", "rect", "ellipse"].includes(n.type)) fields.push(["lineHeight", "行高", "number"], ["letterSpacing", "字距", "number"]);
    for (let index = fields.length - 1; index >= 0; index--) {
      const [key, label, type] = fields[index];
      if (type === "color") fields.splice(index + 1, 0, [{ color: "fillOpacity", textColor: "textOpacity", strokeColor: "strokeOpacity" }[key], `${label}不透明度`, "number"]);
    }
    const isOpacity = key => ["opacity", "fillOpacity", "textOpacity", "strokeOpacity"].includes(key);
    const groups = new Map();
    const groupFor = key => key === "name" ? "对象" : ["x", "y", "width", "height"].includes(key) ? "布局" : ["text", "fontSize", "lineHeight", "letterSpacing"].includes(key) ? "文字" : "外观";
    for (const [key, label, type] of fields) {
      const row = document.createElement(type === "color" ? "div" : "label");
      row.className = `inspector-field field-${key}`;
      const fieldLabel = document.createElement("span"); fieldLabel.className = "field-label"; fieldLabel.textContent = label; row.append(fieldLabel);
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      input.value = n[key] ?? (key === "color" ? "#ffffff" : key === "textColor" ? "#424650" : key === "strokeColor" ? "#97a5b8" : key === "strokeWidth" ? 1.5 : key === "opacity" ? 1 : key === "radius" ? 0 : "");
      if (type === "number" && n[key] !== undefined) input.value = Number(Number(n[key]).toFixed(2));
      if (isOpacity(key)) input.value = Math.round((n[key] ?? 1) * 100);
      if (key === "lineHeight") input.value = n.lineHeight ?? (n.type === "text" ? 1.55 : n.flowShape ? 1.45 : 1.5);
      if (key === "letterSpacing") input.value = n.letterSpacing ?? 0;
      input.setAttribute("aria-label", label);
      input.disabled = !canEdit() || effectiveLocked(n) || agentHeld(n);
      if (isOpacity(key)) {
        input.min = 0;
        input.max = 100;
        input.step = 1;
      }
      if (key === "strokeWidth") {
        input.min = 0.5;
        input.max = 10;
        input.step = 0.5;
      }
      if (type === "number") {
        input.step = ["lineHeight", "letterSpacing"].includes(key) ? 0.1 : key === "strokeWidth" ? 0.5 : 1;
        if (["width", "height", "fontSize"].includes(key)) input.min = key === "fontSize" ? 8 : 1;
        if (key === "fontSize") input.max = 400;
        if (key === "radius") { input.min = 0; input.max = 1000; }
        if (key === "lineHeight") { input.min = .5; input.max = 5; }
        if (key === "letterSpacing") { input.min = -20; input.max = 100; }
      }
      const control = document.createElement("div");
      control.className = "inspector-control";
      control.append(input);
      if (type === "number") {
        const unit = document.createElement("span"); unit.className = "field-unit";
        unit.textContent = isOpacity(key) ? "%" : key === "lineHeight" ? "倍" : ["x", "y"].includes(key) ? "" : "px";
        control.append(unit);
      }
      row.append(control);
      const groupName = groupFor(key);
      if (!groups.has(groupName)) {
        const section = document.createElement("section"); section.className = "inspector-section";
        const heading = document.createElement("h3"); heading.textContent = groupName; section.append(heading);
        groups.set(groupName, section);
      }
      groups.get(groupName).append(row);
      const applyValue = () => {
        let value = input.value;
        if (type === "color") {
          const hex = value.trim().replace(/^#/, "");
          if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
          value = "#" + (hex.length === 3 ? [...hex].map(char => char + char).join("") : hex).toLowerCase();
        }
        if (type === "number") {
          if (value.trim() === "") return;
          value = Number(value);
          if (!Number.isFinite(value) || Math.abs(value) > 1e6) return;
          if (key === "fontSize") value = Math.max(8, Math.min(400, value));
          if (isOpacity(key)) value = Math.max(0, Math.min(100, value)) / 100;
          if (["width", "height"].includes(key)) value = Math.max(1, value);
          if (key === "lineHeight") value = Math.max(0.5, Math.min(5, value));
          if (key === "letterSpacing") value = Math.max(-20, Math.min(100, value));
          if (key === "radius") value = Math.max(0, Math.min(1e3, value));
          // Matches the document contract (0.5–10) so an out-of-range entry never blocks saving.
          if (key === "strokeWidth") value = Math.max(0.5, Math.min(10, value));
        }
        if (!canEdit() || effectiveLocked(n) || agentHeld(n) || n[key] === value) return;
        if (!propertyEdit || propertyEdit.node !== n.id || propertyEdit.key !== key) {
          checkpoint();
          propertyEdit = { node: n.id, key };
        }
        if (["x", "y"].includes(key)) {
          const delta = value - n[key], ids = C.descendants(state.nodes, [n.id]);
          for (const child of state.nodes) if (child.id !== n.id && ids.has(child.id)) child[key] += delta;
        }
        n[key] = value;
        if (type === "color") control.querySelector(".node-color-button")?.style.setProperty("--line-color", value);
        changed({ panels: false });
      };
      input.addEventListener("input", applyValue);
      input.addEventListener("change", () => {
        applyValue();
        if (type === "color") input.value = String(n[key] || "#ffffff").replace(/^#/, "").toUpperCase();
        else if (isOpacity(key)) input.value = Math.round((n[key] ?? 1) * 100);
        else if (type === "number") input.value = Number(Number(n[key] ?? input.value).toFixed(2));
        propertyEdit = null;
      });
      if (type === "number") {
        bindInspectorScrub(fieldLabel, input, applyValue);
        bindInspectorScrub(control.querySelector(".field-unit"), input, applyValue);
      }
      if (type === "color") {
        const button = document.createElement("button"); button.type = "button"; button.className = "node-color-button canvas-color-button";
        button.setAttribute("aria-label", label); button.setAttribute("aria-haspopup", "dialog"); button.disabled = input.disabled;
        button.style.setProperty("--line-color", input.value);
        const swatch = document.createElement("span"); swatch.className = "canvas-color-swatch"; swatch.setAttribute("aria-hidden", "true"); button.append(swatch);
        button.onclick = () => openNodeColor(n, key, label, button.getBoundingClientRect());
        control.classList.add("inspector-color-control");
        input.type = "text"; input.className = "color-hex-input";
        input.value = input.value.replace(/^#/, "").toUpperCase();
        input.setAttribute("aria-label", `${label} HEX`); input.setAttribute("autocomplete", "off"); input.spellcheck = false;
        input.addEventListener("blur", () => { input.value = String(n[key] || (key === "textColor" ? "#424650" : key === "strokeColor" ? "#97a5b8" : "#ffffff")).replace(/^#/, "").toUpperCase(); });
        control.prepend(button);
      }
    }
    const appearance = groups.get("外观");
    for (const [key, alphaKey] of [["color", "fillOpacity"], ["textColor", "textOpacity"], ["strokeColor", "strokeOpacity"]]) {
      const colorControl = appearance?.querySelector(`.field-${key} .inspector-control`);
      const opacityRow = appearance?.querySelector(`.field-${alphaKey}`);
      if (colorControl && opacityRow) {
        const opacityControl = opacityRow.querySelector(".inspector-control");
        opacityControl.classList.add("inspector-opacity-control");
        colorControl.append(opacityControl); opacityRow.remove();
      }
    }
    if (specialRow) groups.get("对象")?.append(specialRow);
    for (const name of ["对象", "布局", "文字", "外观"]) if (groups.has(name)) properties.append(groups.get(name));
    if (!renameOnly && ["text", "note", "rect", "ellipse"].includes(n.type) && canEdit() && !effectiveLocked(n) && !agentHeld(n)) {
      const section = document.createElement("details");
      section.className = "property-section";
      section.open = true;
      const summary = document.createElement("summary");
      summary.textContent = "排版";
      section.append(summary);
      for (const [key, label, options] of [["fontWeight", "字重", [[400, "常规"], [500, "中等"], [600, "半粗"], [700, "加粗"]]], ["textAlign", "对齐", [["left", "左对齐"], ["center", "居中"], ["right", "右对齐"]]]]) {
        const row = document.createElement("label");
        row.textContent = label;
        const select = document.createElement("select");
        select.setAttribute("aria-label", label);
        for (const [value, text] of options) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          select.append(option);
        }
        select.value = String(n[key] ?? (key === "fontWeight" ? 400 : "left"));
        select.onchange = () => mutate(() => {
          n[key] = key === "fontWeight" ? Number(select.value) : select.value;
        });
        if (key === "textAlign") {
          const segments = document.createElement("div"); segments.className = "alignment-segments"; segments.setAttribute("role", "group"); segments.setAttribute("aria-label", "文字对齐");
          for (const [value, text] of options) {
            const button = document.createElement("button"); button.type = "button"; button.title = text; button.setAttribute("aria-label", text); button.setAttribute("aria-pressed", (n.textAlign || "left") === value);
            button.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h14M${value === "right" ? 7 : value === "center" ? 5 : 3} 9h10M3 13h14M${value === "right" ? 7 : value === "center" ? 5 : 3} 17h10"/></svg>`;
            button.onclick = () => { mutate(() => { n.textAlign = value; }); for (const b of segments.children) b.setAttribute("aria-pressed", b === button); };
            segments.append(button);
          }
          row.append(segments);
        } else row.append(inspectorChoice(label, options, n[key] ?? 400, value => mutate(() => { n[key] = Number(value); })));
        section.append(row);
      }
      properties.append(section);
    }
    if (focusLabel) properties.querySelector(`[aria-label="${focusLabel}"]`)?.focus();
  }
  function openProperties(focusLabel = "", options = {}) {
    finishText();
    renameOnly = Boolean(options.renameOnly);
    propertiesSelection = [...selected].join(",");
    renderProperties(focusLabel);
    const popover = $("#property-popover");
    setFloatingPanel("#property-popover", true);
    setFloatingPanel("#context-menu", false);
    const anchor = screenSelection();
    const position = C.placeOverlay({ anchor, width: popover.offsetWidth, height: popover.offsetHeight, viewport: { width: innerWidth, height: innerHeight }, obstacles: overlayObstacles(), placement: "popover" });
    popover.style.left = position.x + "px";
    popover.style.top = position.y + "px";
  }
  function focusName() {
    if (current().length !== 1) return;
    openProperties("", { renameOnly: true });
    const input = properties.querySelector('[aria-label="名称"]');
    input?.focus();
    input?.select();
  }
  function add(kind, at) {
    if (!canEdit()) return;
    if (kind.startsWith("flow-")) return insertFlowShape(kind.slice(5), at);
    if (kind.startsWith("component-")) return insertComponent(kind, at);
    const p = at || point(stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
    const type = ["mobile", "web"].includes(kind) ? "board" : kind;
    const size = kind === "mobile" ? [390, 844] : kind === "web" ? [1200, 800] : type === "board" ? [600, 400] : type === "text" ? [280, 100] : [240, 200];
    const n = { id: uid(), type, name: (kind === "mobile" ? "手机画板" : kind === "web" ? "Web 画板" : names[type]) + " " + (state.nodes.filter((n2) => n2.type === type).length + 1), x: Math.round(p.x - size[0] / 2), y: Math.round(p.y - size[1] / 2), width: size[0], height: size[1], text: type === "text" ? "双击编辑文本" : type === "note" ? "写下你的想法" : "", color: type === "note" ? "#fff1b8" : type === "rect" || type === "ellipse" ? "#dfe9ff" : type === "text" ? "" : "#ffffff", fontSize: 20 };
    const container = current().length === 1 && ["board", "group"].includes(current()[0].type) && type !== "board" ? current()[0] : null;
    if (container) {
      n.parentId = container.id;
      n.x = container.x + 24;
      n.y = container.y + 24;
    } else if (type === "board" && !at) {
      const last = state.nodes.filter((item) => item.type === "board").at(-1);
      if (last) {
        n.x = last.x + last.width + 80;
        n.y = last.y;
      }
    }
    mutate(() => {
      state.nodes.push(n);
      selected = /* @__PURE__ */ new Set([n.id]);
    });
    return n;
  }
  function insertFlowShape(shape, at) {
    const preset = flowShapes[shape];
    if (!preset || !canEdit()) return;
    finishText(); exitInteraction(); setTool("select");
    const previous = current().length === 1 ? current()[0] : null;
    const center = at || point(stage.clientWidth / 2, stage.clientHeight / 2);
    const type = preset.kind === "text" ? "text" : preset.kind === "ellipse" ? "ellipse" : "rect";
    const n = { id: uid(), type, ...(preset.kind === "flow" ? { flowShape: shape } : {}), name: preset.label,
      x: Math.round(!at && previous ? previous.x + previous.width + 80 : center.x - preset.width / 2),
      y: Math.round(!at && previous ? previous.y + (previous.height - preset.height) / 2 : center.y - preset.height / 2),
      width: preset.width, height: preset.height, text: type === "text" ? "双击编辑文本" : preset.text,
      color: type === "text" ? "" : type === "ellipse" ? "#dfe9ff" : "#ffffff", fontSize: type === "text" ? 20 : 16,
      ...(type === "text" ? {} : { textAlign: "center", textColor: "#344155" }) };
    if (!at) for (let attempt = 0; attempt <= state.nodes.length; attempt++) {
      const collision = state.nodes.find(item => !item.hidden && item.type !== "group" && n.x < item.x+item.width+24 && n.x+n.width+24 > item.x && n.y < item.y+item.height+24 && n.y+n.height+24 > item.y);
      if (!collision) break;
      n.x = collision.x + collision.width + 80;
    }
    // Flow steps remain independent of the selected board so that its outgoing edge is routable.
    mutate(() => { state.nodes.push(n); selected = new Set([n.id]); });
    const v = state.viewport, left = n.x*v.zoom+v.x, top = n.y*v.zoom+v.y;
    const dx = left < 48 ? 48-left : Math.min(0, stage.clientWidth-48-left-n.width*v.zoom);
    const dy = top < 100 ? 100-top : Math.min(0, stage.clientHeight-120-top-n.height*v.zoom);
    if (dx || dy) { v.x += dx; v.y += dy; persistView(); }
    return n;
  }
  function insertComponent(kind, at) {
    const parent2 = current().length === 1 && ["board", "group"].includes(current()[0].type) ? current()[0] : null;
    const center = at || point(stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
    const origin = { x: parent2 ? parent2.x + 32 : center.x - 140, y: parent2 ? parent2.y + 32 : center.y - 70 };
    const labels = { "component-button": "按钮", "component-input": "输入框", "component-card": "信息卡", "component-nav": "导航栏" };
    const group = { id: uid(), type: "group", name: labels[kind], x: origin.x, y: origin.y, width: 280, height: 120, parentId: parent2?.id || null, component: kind };
    const nodes = [group];
    const shape = (x, y, width, height, color, radius = 8) => nodes.push({ id: uid(), type: "rect", name: "背景", parentId: group.id, x: origin.x + x, y: origin.y + y, width, height, color, radius });
    const text = (value, x, y, width, fontSize = 14, textColor = "#343747") => nodes.push({ id: uid(), type: "text", name: value, parentId: group.id, x: origin.x + x, y: origin.y + y, width, height: Math.max(22, fontSize * 1.5), text: value, fontSize, textColor, padding: 0 });
    if (kind === "component-button") {
      shape(0, 0, 160, 44, "#5364cf");
      text("开始使用", 48, 12, 96, 14, "#ffffff");
    }
    if (kind === "component-input") {
      text("邮箱地址", 0, 0, 280, 12);
      shape(0, 28, 280, 44, "#f0f1f5", 6);
      text("输入邮箱地址", 14, 40, 240, 13, "#989ca9");
    }
    if (kind === "component-card") {
      shape(0, 0, 280, 152, "#ffffff", 12);
      shape(20, 20, 36, 36, "#e9ecfa", 9);
      text("卡片标题", 20, 72, 240, 18);
      text("在这里补充内容与说明", 20, 107, 240, 13, "#9498a6");
    }
    if (kind === "component-nav") {
      shape(0, 0, 360, 60, "#ffffff", 0);
      text("概览", 24, 21, 80, 14, "#5364cf");
      text("内容", 128, 21, 80, 14, "#9397a4");
      text("设置", 240, 21, 80, 14, "#9397a4");
    }
    mutate(() => {
      state.nodes.push(...nodes);
      selected = /* @__PURE__ */ new Set([group.id]);
    });
    return group;
  }
  function duplicateSelection() {
    mutate(() => {
      const copied = C.duplicate(state.nodes, selected);
      state.nodes.push(...copied.nodes);
      if(state.edges) state.edges.push(...C.duplicateEdges(state.edges, copied.mapping));
      selected = new Set(copied.selected);
    });
  }
  function removeSelection() {
    mutate(() => {
      const ids = C.descendants(state.nodes, selectedRoots().filter((n) => !effectiveLocked(n) && !agentHeld(n)).map((n) => n.id));
      state.nodes = state.nodes.filter((n) => !ids.has(n.id));
      if (state.edges) state.edges = state.edges.filter(e => !ids.has(e.fromInstanceId) && !ids.has(e.toInstanceId));
      selected.clear();
    });
    if (groupContext && !state.nodes.some((n) => n.id === groupContext)) groupContext = null;
  }
  function groupSelection() {
    if (selectedRoots().length < 2) return;
    mutate(() => {
      const nodes = selectedRoots().filter((n2) => !effectiveLocked(n2));
      if (nodes.length < 2) return;
      const b = C.bounds(nodes), parentId = nodes.every((n2) => n2.parentId === nodes[0].parentId) ? nodes[0].parentId : null;
      const n = { id: C.uid(), type: "group", name: "分组", ...b, parentId: parentId || null };
      state.nodes.unshift(n);
      nodes.forEach((item) => item.parentId = n.id);
      selected = /* @__PURE__ */ new Set([n.id]);
    });
  }
  function ungroupSelection() {
    mutate(() => {
      const groups = current().filter((n) => n.type === "group" && !effectiveLocked(n));
      selected.clear();
      for (const g of groups) {
        state.nodes.filter((n) => n.parentId === g.id).forEach((n) => {
          n.parentId = g.parentId || null;
          selected.add(n.id);
        });
        state.nodes = state.nodes.filter((n) => n !== g);
      }
    });
    groupContext = null;
  }
  function reorder(top) {
    mutate(() => {
      const ids = C.descendants(state.nodes, selectedRoots().filter((n) => !effectiveLocked(n)).map((n) => n.id)), moving = state.nodes.filter((n) => ids.has(n.id)), rest = state.nodes.filter((n) => !ids.has(n.id));
      state.nodes = top ? [...rest, ...moving] : [...moving, ...rest];
    });
  }
  function align(mode) {
    const nodes = selectedRoots().filter((n) => !effectiveLocked(n));
    if (nodes.length < 2) return;
    mutate(() => {
      const bounds = C.bounds(nodes), axis = ["left", "right", "centerX", "evenX"].includes(mode) ? "x" : "y", size = axis === "x" ? "width" : "height";
      let gap = 0, cursor = bounds[axis];
      if (mode.startsWith("even")) {
        if (nodes.length < 3) return;
        nodes.sort((a, b) => a[axis] - b[axis]);
        gap = (bounds[size] - nodes.reduce((sum, n) => sum + n[size], 0)) / (nodes.length - 1);
      }
      for (const n of nodes) {
        const target = mode.startsWith("even") ? cursor : mode.startsWith("center") ? bounds[axis] + (bounds[size] - n[size]) / 2 : ["right", "bottom"].includes(mode) ? bounds[axis] + bounds[size] - n[size] : bounds[axis];
        const delta = target - n[axis], ids = C.descendants(state.nodes, [n.id]);
        state.nodes.filter((item) => ids.has(item.id)).forEach((item) => item[axis] += delta);
        cursor += n[size] + gap;
      }
    });
  }
  function enterGroup(group) {
    if (!group || group.type !== "group") return;
    finishText();
    groupContext = group.id;
    const children = state.nodes.filter((n) => n.parentId === group.id);
    selected = new Set(children.length ? children.map((n) => n.id) : [group.id]);
    render();
  }
  function exitGroup() {
    if (!groupContext) return false;
    const group = state.nodes.find((n) => n.id === groupContext);
    groupContext = null;
    if (group) selected = /* @__PURE__ */ new Set([group.id]);
    render();
    return true;
  }
  async function fitImageRatio(node) {
    const size = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = node.src || "";
    });
    if (!size?.width || !size.height) return;
    mutate(() => {
      node.height = Math.max(16, Math.round(node.width * size.height / size.width));
    });
  }
  function previewBoard(n) {
    if (annotationBoardId) return;
    const activeFrame = nodeEls.get(n.id)?.querySelector('iframe');
    if (restoringBoardStates.has(activeFrame) || activeFrame?.dataset.statePending) { notice('画板正在恢复状态，请稍后重试'); return; }
    if (interacting === n.id) return;
    hideShareTip();
    exitInteraction();
    const el = nodeEls.get(n.id);
    if (!el) return;
    interacting = n.id;
    el.classList.add("interacting");
    $("#interaction-hint").textContent = el.querySelector("iframe") ? "预览中 · Esc 返回画布" : "画板已激活 · Esc 返回画布";
    el.querySelector("iframe")?.focus();
    updateSelectionFrame();
    positionSelectionTools();
  }
  // Share visitors land in read-only mode and cannot discover the double-click
  // entry on their own; the tip stays until they first enter a board.
  function showShareTip() {
    if (!state.nodes.some((n) => n.type === "board" && n.src)) return;
    const tip = $("#share-tip");
    tip.classList.remove("hide");
    tip.hidden = false;
  }
  function hideShareTip() {
    const tip = $("#share-tip");
    if (tip.hidden || tip.classList.contains("hide")) return;
    tip.classList.add("hide");
    setTimeout(() => {
      tip.hidden = true;
      tip.classList.remove("hide");
    }, 350);
  }
  function stopViewAnimation() {
    if (viewAnim) {
      cancelAnimationFrame(viewAnim);
      viewAnim = 0;
    }
  }
  function animateView(target, duration = 190, onDone) {
    stopViewAnimation();
    const from = { ...state.viewport }, start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration), k = ease(t);
      state.viewport = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, zoom: from.zoom + (target.zoom - from.zoom) * k };
      view();
      viewAnim = t < 1 ? requestAnimationFrame(step) : (onDone?.(), 0);
    };
    viewAnim = requestAnimationFrame(step);
  }
  // Keep the last point on the canvas when the pointer moves to zoom controls.
  let zoomAnchor = null;
  function rememberZoomAnchor(e) {
    if (e.target.closest("button,input,textarea,select,.floating,#selection-tools")) return;
    const r = stage.getBoundingClientRect();
    zoomAnchor = { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  stage.addEventListener("pointermove", (e) => {
    if (e.buttons) resetBoardRightGesture();
    rememberZoomAnchor(e);
  });
  stage.addEventListener("pointerdown", rememberZoomAnchor);
  function zoom(factor, x = zoomAnchor?.x ?? stage.clientWidth / 2, y = zoomAnchor?.y ?? stage.clientHeight / 2, animate = false) {
    stopViewAnimation();
    const v = state.viewport, z = Math.max(0.05, Math.min(4, v.zoom * factor));
    const target = { zoom: z, x: x - (x - v.x) * z / v.zoom, y: y - (y - v.y) * z / v.zoom };
    if (animate) animateView(target, 190, () => {
      if (!readOnly) persistView();
    });
    else {
      state.viewport = target;
      view();
      if (!readOnly) persistView();
    }
  }
  function zoomTo(z) {
    zoom(z / state.viewport.zoom, void 0, void 0, true);
  }
  function fit(nodes = state.nodes, { animate = false, align = "center" } = {}) {
    nodes = nodes.filter((n) => !n.hidden);
    if (!nodes.length) return;
    if (!annotationBoardId) exitInteraction();
    const left = Math.min(...nodes.map((n) => n.x)), top = Math.min(...nodes.map((n) => n.y)), right = Math.max(...nodes.map((n) => n.x + n.width)), bottom = Math.max(...nodes.map((n) => n.y + n.height));
    // Fit within the workspace between the side rails, including board titles
    // above and interaction/status hints below the board.
    const bounds = stage.getBoundingClientRect();
    const creation = $(".creation-tools").getBoundingClientRect();
    const rails = [$(".right-tools")].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
    const safeLeft = creation.width && creation.height ? creation.right - bounds.left + 24 : 32;
    const safeRight = rails.length ? Math.min(...rails.map(r => r.left - bounds.left)) - 24 : stage.clientWidth - 32;
    const safeTop = align === "top" ? 100 : 56, safeBottom = stage.clientHeight - 56;
    const width = Math.max(1, safeRight - safeLeft), height = Math.max(1, safeBottom - safeTop);
    const z = Math.max(0.05, Math.min(1.5, width / (right - left), height / (bottom - top)));
    const target = { x: safeLeft + (width - (right - left) * z) / 2 - left * z, y: safeTop + (align === "top" ? 0 : (height - (bottom - top) * z) / 2) - top * z, zoom: z };
    if (animate) animateView(target, 200, () => {
      if (!readOnly) persistView();
    });
    else {
      state.viewport = target;
      view();
      if (!readOnly) persistView();
    }
  }
  function undo(redo = false) {
    if (!canEdit()) return;
    finishText();
    const from = redo ? future : history, to = redo ? history : future;
    if (!from.length) return;
    to.push(clone(state));
    const inspectorSelection = !$("#property-popover").hidden ? [...selected] : [];
    const revision = state.revision;
    const restored = from.pop();
    const protectedIds = new Set(state.nodes.filter(agentHeld).map(node => node.id));
    const liveNodes = new Map(state.nodes.map(node => [node.id, node]));
    restored.nodes = restored.nodes.map(node => protectedIds.has(node.id) ? clone(liveNodes.get(node.id)) : node);
    const restoredIds = new Set(restored.nodes.map(node => node.id));
    for (const id of protectedIds) if (!restoredIds.has(id)) restored.nodes.push(clone(liveNodes.get(id)));
    if (state.edges || restored.edges) {
      const protectedEdge = edge => protectedIds.has(edge.fromInstanceId) || protectedIds.has(edge.toInstanceId);
      restored.edges = [...(restored.edges || []).filter(edge => !protectedEdge(edge)), ...(state.edges || []).filter(protectedEdge).map(clone)];
    }
    state = restored;
    state.revision = revision;
    selected = new Set(inspectorSelection.filter(id => state.nodes.some(n => n.id === id)));
    propertyEdit = null;
    groupContext = null;
    changed();
    if (selected.size === 1 && inspectorSelection.length) openProperties();
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#canvas-connections") && !space && tool !== "hand" && e.button !== 1) return;
    if (e.button === 2 || e.target.closest("button,input,textarea,select,.floating,#selection-tools") || e.target.closest(".interacting") || e.target.isContentEditable) return;
    if (e.button === 0 && tool === "select" && !space && !e.target.closest(".node,#selection-frame") && !$("#context-menu").hidden && $("#context-menu").hasAttribute("data-selection-tools")) {
      setFloatingPanel("#context-menu", false);
      stage.focus({ preventScroll: true });
      e.preventDefault();
      return;
    }
    stopViewAnimation();
    resetBoardRightGesture();
    // While annotating a board, canvas editing gestures stay disabled;
    // only viewport panning (space / hand / middle button) remains available.
    if (annotationBoardId) {
      if (!(space || tool === "hand" || e.button === 1)) {
        e.preventDefault();
        return;
      }
      finishText();
      setFloatingPanel("#context-menu", false);
      gesture = { kind: "pan", cx: e.clientX, cy: e.clientY, x: state.viewport.x, y: state.viewport.y };
      stage.classList.add("panning");
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.pointerType === "touch") {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        endGesture();
        const [a, b] = [...touches.values()], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        gesture = { kind: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.viewport.zoom, world: point(cx, cy) };
        stage.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    finishText();
    const priorSelection = [...selected];
    setFloatingPanel("#context-menu", false);
    exitInteraction();
    stage.focus();
    const handleEl = e.target.closest("#selection-frame i[data-handle]");
    const el = e.target.closest(".node"), n = state.nodes.find((n2) => n2.id === el?.dataset.id), p = point(e.clientX, e.clientY);
    if (space || tool === "hand" || e.button === 1) {
      gesture = { kind: "pan", cx: e.clientX, cy: e.clientY, x: state.viewport.x, y: state.viewport.y };
      stage.classList.add("panning");
    } else if (e.button !== 0) return;
    else if (handleEl && canEdit() && selected.size) {
      const items = movable().map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }));
      const base = C.bounds(selectedRoots().filter((item) => !effectiveLocked(item) && !agentHeld(item)));
      if (base && items.length) gesture = { kind: "scale", handle: handleEl.dataset.handle, base, items, start: p };
    } else if (tool !== "select" && canEdit()) {
      const beforeDraw = { preState: clone(state), preSelection: [...selected], historyLength: history.length, preFuture: future.slice(), wasDirty: dirty };
      const made = add(tool, p);
      if (made) {
        made.x = p.x;
        made.y = p.y;
        if (textAutoHeight(made)) {
          // A text box keeps its writing width; dragging only sets that width, the height follows.
          gesture = { kind: "draw", id: made.id, start: p, started: true, widthOnly: true, ...beforeDraw };
        } else {
          made.width = 16;
          made.height = 16;
          gesture = { kind: "draw", id: made.id, start: p, started: true, ...beforeDraw };
        }
        render();
      }
      setTool("select");
    } else if (n) {
      // Shift-click toggles selection only after we know this is not a drag.
      const pendingDeselect = e.shiftKey && selected.has(n.id) && canEdit() && !effectiveLocked(n) && !agentHeld(n);
      if (e.shiftKey) {
        if (!pendingDeselect) selected.has(n.id) ? selected.delete(n.id) : selected.add(n.id);
      } else if (!selected.has(n.id)) {
        selected = /* @__PURE__ */ new Set([n.id]);
        groupContext = null;
      }
      render();
      if (canEdit() && !effectiveLocked(n) && !agentHeld(n) && selected.size) {
        gesture = { kind: "move", start: p, pendingAlt: e.altKey, nodes: movable().map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })), started: false };
        if (pendingDeselect) gesture.deselectTarget = n.id;
        if (!e.shiftKey && selected.size > 1) gesture.clickTarget = n.id;
      }
    } else {
      if (!e.shiftKey) selected.clear();
      gesture = { kind: "select", preSelection: priorSelection, start: p, selected: new Set(selected), cx: e.clientX, cy: e.clientY };
      render();
    }
    if (gesture) {
      gesture.pointerId = e.pointerId;
      // Screen anchor kept on every gesture: setSpace can turn a pending
      // move/marquee into a pan and still needs the original press point.
      gesture.px = e.clientX;
      gesture.py = e.clientY;
      positionSelectionTools();
      updateSelectionFrame();
      (n && el?.isConnected ? el : stage).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    const g = gesture, p = point(e.clientX, e.clientY);
    if (g.kind === "pinch") {
      if (touches.size < 2) return;
      const [a, b] = [...touches.values()], r = stage.getBoundingClientRect(), z = Math.max(0.05, Math.min(4, g.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.distance)));
      state.viewport = { zoom: z, x: (a.x + b.x) / 2 - r.left - g.world.x * z, y: (a.y + b.y) / 2 - r.top - g.world.y * z };
      view();
      return;
    }
    if (g.kind === "draw") {
      const n = state.nodes.find((n2) => n2.id === g.id);
      n.x = Math.min(p.x, g.start.x);
      n.y = Math.min(p.y, g.start.y);
      n.width = Math.max(16, Math.abs(p.x - g.start.x));
      // A text box drawn with the tool only takes the width; its height answers to the content.
      if (!g.widthOnly) n.height = Math.max(16, Math.abs(p.y - g.start.y));
      updatePositions([g.id]);
      if (g.widthOnly) fitContentHeight(n);
      return;
    }
    if (g.kind === "pan") {
      state.viewport.x = g.x + e.clientX - g.cx;
      state.viewport.y = g.y + e.clientY - g.cy;
      view();
      return;
    }
    if (g.kind === "select") {
      const r = stage.getBoundingClientRect(), box = $("#marquee");
      box.hidden = false;
      Object.assign(box.style, { left: `${Math.min(g.cx, e.clientX) - r.left}px`, top: `${Math.min(g.cy, e.clientY) - r.top}px`, width: `${Math.abs(e.clientX - g.cx)}px`, height: `${Math.abs(e.clientY - g.cy)}px` });
      selected = new Set(g.selected);
      for (const n of state.nodes) if (!n.parentId && !n.hidden && n.x >= Math.min(p.x, g.start.x) && n.x + n.width <= Math.max(p.x, g.start.x) && n.y >= Math.min(p.y, g.start.y) && n.y + n.height <= Math.max(p.y, g.start.y)) selected.add(n.id);
      render({ panels: false });
      return;
    }
    if (g.kind === "scale") {
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (!g.started) {
        if (Math.hypot(dx, dy) * state.viewport.zoom < 3) return;
        beginGesture(g);
      }
      const transformed = C.resizeSelection(g.base, g.items, g.handle, dx, dy, e.shiftKey);
      const map = new Map(state.nodes.map((n) => [n.id, n]));
      // Text and note boxes only take the new width; their height answers to the content.
      const autoFit = g.items.map((item) => map.get(item.id)).filter(textAutoHeight);
      const autoFitIds = new Set(autoFit.map((n) => n.id));
      // A handle that only drags vertically has nothing to change on a content-sized box.
      const verticalOnly = !g.handle.includes("e") && !g.handle.includes("w") && autoFit.length === g.items.length;
      if (verticalOnly) return;
      for (const next of transformed) {
        if (autoFitIds.has(next.id)) Object.assign(map.get(next.id), { x: next.x, y: next.y, width: next.width });
        else Object.assign(map.get(next.id), next);
      }
      updatePositions(g.items.map((n) => n.id));
      for (const n of autoFit) fitContentHeight(n);
      return;
    }
    if (g.kind === "move") {
      let dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (!g.started) {
        if (Math.hypot(dx, dy) * state.viewport.zoom < 3) return;
        beginGesture(g);
        if (g.pendingAlt) {
          const copies = C.duplicate(state.nodes, selected, 0);
          state.nodes.push(...copies.nodes);
          if(state.edges) state.edges.push(...C.duplicateEdges(state.edges, copies.mapping, {x:0,y:0}));
          selected = new Set(copies.selected);
          g.nodes = copies.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }));
          renderNow({ panels: false });
        }
      }
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (!e.altKey) {
        const snapped = snap(g.nodes, dx, dy);
        dx = snapped.dx;
        dy = snapped.dy;
      }
      for (const old of g.nodes) {
        const n = state.nodes.find((item) => item.id === old.id);
        if (!n) continue;
        n.x = Math.round(old.x + dx);
        n.y = Math.round(old.y + dy);
      }
      updatePositions(g.nodes.map((item) => item.id));
    }
  });
  function beginGesture(g) {
    g.preState = clone(state);
    g.preSelection = [...selected];
    g.historyLength = history.length;
    g.preFuture = future.slice();
    g.wasDirty = dirty;
    checkpoint();
    g.started = true;
  }
  function cancelGesture() {
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.kind === "select" && g.preSelection) selected = new Set(g.preSelection);
    if (g.kind === "pan") {
      state.viewport.x = g.x;
      state.viewport.y = g.y;
    }
    if (g.preState) {
      state = clone(g.preState);
      state.revision = baseline.revision;
      selected = new Set(g.preSelection);
      history.length = g.historyLength;
      future = g.preFuture;
      dirty = g.wasDirty && JSON.stringify(state.nodes) !== JSON.stringify(baseline.nodes);
    }
    $("#marquee").hidden = true;
    $("#guides").replaceChildren();
    stage.classList.remove("panning");
    if (dirty) {
      persistDraft({ announce: false });
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
    } else {
      clearTimeout(autoTimer);
      removeStoredValue(draftKey);
      status("已保存");
    }
    render();
  }
  function endGesture() {
    const g = gesture;
    gesture = null;
    $("#marquee").hidden = true;
    $("#guides").replaceChildren();
    stage.classList.remove("panning");
    updateSelectionFrame();
    if (g?.kind === "move" && !g.started && g.deselectTarget) {
      selected.delete(g.deselectTarget);
      render();
      return;
    }
    if (g?.kind === "move" && !g.started && g.clickTarget) {
      selected = /* @__PURE__ */ new Set([g.clickTarget]);
      render();
      return;
    }
    if (g?.started || g?.kind === "draw") {
      if (g.kind === "move") {
        for (const n of selectedRoots().filter((item) => item.type !== "board" && item.type !== "group")) {
          const board = [...state.nodes].reverse().find((b) => b.type === "board" && !effectiveLocked(b) && n.x >= b.x && n.y >= b.y && n.x + n.width <= b.x + b.width && n.y + n.height <= b.y + b.height);
          if (!n.parentId || state.nodes.find((p) => p.id === n.parentId)?.type === "board") n.parentId = board?.id || null;
        }
      }
      changed();
      if (g.kind === "draw" && state.nodes.find((n) => n.id === g.id)?.type === "text") startText(g.id);
    } else if (g && ["scale", "move", "draw", "select"].includes(g.kind)) render();
    if (["pan", "pinch"].includes(g?.kind) && !readOnly) persistView();
  }
  stage.addEventListener("pointerup", (e) => {
    touches.delete(e.pointerId);
    endGesture();
  });
  stage.addEventListener("pointercancel", (e) => {
    touches.delete(e.pointerId);
    cancelGesture();
  });
  stage.addEventListener("lostpointercapture", (e) => {
    if (gesture?.pointerId === e.pointerId) cancelGesture();
  });
  stage.addEventListener("dblclick", (e) => {
    if (e.target.closest("#canvas-connections,.connection-handles,.connection-preview,.flow-quick-dots,.flow-quick-preview")) return;
    const el = e.target.closest(".node"), n = state.nodes.find((n2) => n2.id === el?.dataset.id);
    if (e.target.closest("button,input,textarea,select,.floating,#selection-tools,[contenteditable=true]") || e.target.isContentEditable || space || tool !== "select" || e.button !== 0) return;
    if (annotationBoardId) return;
    if (!n) {
      // Rapid clicks on quick-create dots move the dots away; the second click must not add text.
      if (!canEdit() || flowQuick?.recentlyUsed()) return;
      e.preventDefault();
      const p = point(e.clientX, e.clientY);
      selected.clear();
      const made = add("text", { x: p.x + 140, y: p.y + 50 });
      if (made) startText(made.id);
      return;
    }
    e.preventDefault();
    if (["text", "note", "rect"].includes(n.type) && canEdit() && !effectiveLocked(n) && !agentHeld(n)) {
      startText(n.id);
      return;
    }
    selected = new Set([n.id]);
    render();
    fit([n], { animate: true });
    if (n.type === "board") previewBoard(n);
  });
  function handleCanvasWheel(e, clientX = e.clientX, clientY = e.clientY) {
    if (!(e.ctrlKey || e.metaKey) && e.target.closest(".interacting")) return;
    e.preventDefault();
    stopViewAnimation();
    const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1;
    // macOS pinch and driver-mapped zoom wheels arrive as modified wheel events.
    if (e.ctrlKey || e.metaKey) {
      const r = stage.getBoundingClientRect();
      zoomAnchor = { x: clientX - r.left, y: clientY - r.top };
      zoom(Math.exp(-e.deltaY * factor * 8e-3), zoomAnchor.x, zoomAnchor.y);
      return;
    }
    state.viewport.x -= (e.shiftKey ? e.deltaY : e.deltaX) * factor;
    state.viewport.y -= (e.shiftKey ? 0 : e.deltaY) * factor;
    view();
    if (!readOnly) persistView();
  }
  stage.addEventListener("wheel", (e) => handleCanvasWheel(e), { passive: false });
  document.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") {
      resetBoardRightGesture();
      if (annotationBoardId) {
        e.preventDefault();
        exitBoardAnnotation();
        stage.focus();
        return;
      }
      if (!$("#command-palette").hidden) {
        closePalette();
        return;
      }
      if (!$("#context-menu").hidden) {
        setFloatingPanel("#context-menu", false);
        menuInvoker?.focus?.();
        return;
      }
      if (!$("#property-popover").hidden) {
        setFloatingPanel("#property-popover", false);
        stage.focus();
        return;
      }
      if (gesture) {
        cancelGesture();
        return;
      }
      if (editing) {
        finishText(true);
        return;
      }
      if (annotationBoardId) {
        exitBoardAnnotation();
        stage.focus();
        return;
      }
      if (interacting) {
        exitInteraction();
        stage.focus();
        return;
      }
      if (exitGroup()) return;
      if (fullscreenFallback) {
        parent.postMessage({ type: "prota:canvas-fullscreen", active: false }, location.origin);
        return;
      }
      setTool("select");
      setFloatingPanel("#property-popover", false);
      if (selected.size) {
        selected.clear();
        render();
      }
      stage.focus();
      return;
    }
    if (e.target.matches("input,textarea,select") || e.target.isContentEditable) return;
    if (annotationBoardId && !(e.code === "Space" || (mod && ["0", "s"].includes(e.key.toLowerCase())))) return;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("#command-palette").hidden ? openPalette() : closePalette();
      return;
    }
    if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      e.shiftKey ? runAction("ungroup") : runAction("group");
      return;
    }
    if (mod && e.key.toLowerCase() === "c") {
      if (e.shiftKey) {
        e.preventDefault();
        runAction("copy-image");
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "v") {
      clearTimeout(pasteTimer);
      pasteTimer = setTimeout(() => pasteSelection(), 20);
      return;
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo(e.shiftKey);
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      runAction("duplicate");
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selected = new Set(state.nodes.filter((n) => !n.hidden && !effectiveLocked(n) && (groupContext ? n.parentId === groupContext : !n.parentId)).map((n) => n.id));
      render();
      return;
    }
    if (mod && e.key === "0") {
      e.preventDefault();
      zoomTo(1);
      return;
    }
    if (!mod && { v: 1, h: 1, t: 1, f: 1 }[e.key.toLowerCase()]) {
      setTool({ v: "select", h: "hand", t: "text", f: "board" }[e.key.toLowerCase()]);
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      runAction("rename");
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      setSpace(true);
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      runAction("delete");
      return;
    }
    const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (offsets[e.key] && selected.size) {
      e.preventDefault();
      mutate(() => movable().forEach((n) => {
        n.x += offsets[e.key][0] * (e.shiftKey ? 10 : 1);
        n.y += offsets[e.key][1] * (e.shiftKey ? 10 : 1);
      }));
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") setSpace(false);
  });
  window.addEventListener("blur", () => {
    setSpace(false);
    cancelGesture();
  });
  // Space reaches the canvas late or not at all when the key was pressed
  // while keyboard focus sat elsewhere (Portal agent panel) or before the
  // relayed message landed. setSpace is the single writer of the flag so the
  // relay can feed it too, and a pending gesture that has not touched the
  // document yet can still turn into a pan instead of dragging objects away.
  function setSpace(down) {
    if (space === down) return;
    space = down;
    stage.classList.toggle("space", down);
    if (down && gesture && !gesture.started && (gesture.kind === "move" || gesture.kind === "select")) {
      if (gesture.kind === "select") {
        $("#marquee").hidden = true;
        selected = new Set(gesture.selected);
        render({ panels: false });
      }
      gesture = { kind: "pan", cx: gesture.px ?? gesture.cx, cy: gesture.py ?? gesture.cy, x: state.viewport.x, y: state.viewport.y, pointerId: gesture.pointerId };
      stage.classList.add("panning");
    }
  }
  function snap(nodes, dx, dy) {
    const b = C.bounds(nodes), ids = new Set(nodes.map((n) => n.id)), limit = 6 / state.viewport.zoom;
    let bestX = limit, bestY = limit, guideX = null, guideY = null, resultX = dx, resultY = dy;
    for (const n of state.nodes) {
      if (ids.has(n.id) || n.hidden || n.type === "group") continue;
      for (const target of [n.x, n.x + n.width / 2, n.x + n.width]) for (const source of [b.x + dx, b.x + dx + b.width / 2, b.x + dx + b.width]) {
        const d = target - source;
        if (Math.abs(d) < bestX) {
          bestX = Math.abs(d);
          resultX = dx + d;
          guideX = target;
        }
      }
      for (const target of [n.y, n.y + n.height / 2, n.y + n.height]) for (const source of [b.y + dy, b.y + dy + b.height / 2, b.y + dy + b.height]) {
        const d = target - source;
        if (Math.abs(d) < bestY) {
          bestY = Math.abs(d);
          resultY = dy + d;
          guideY = target;
        }
      }
    }
    const host = $("#guides");
    host.replaceChildren();
    for (const [axis, value] of [["x", guideX], ["y", guideY]]) if (value !== null) {
      const el = document.createElement("div");
      el.className = "guide " + axis;
      el.style[axis === "x" ? "left" : "top"] = value * state.viewport.zoom + state.viewport[axis] + "px";
      host.append(el);
    }
    return { dx: resultX, dy: resultY };
  }
  function textSource(el) {
    if (el.tagName === "TEXTAREA") return el.value;
    // Chromium represents Enter as sibling DIVs with a placeholder BR on empty lines.
    // innerText counts those placeholder breaks twice under pre-wrap.
    function read(parent) {
      if (parent.childNodes.length === 1 && parent.firstChild.nodeName === "BR") return "";
      return [...parent.childNodes].map((child, index) => {
        if (child.nodeType === Node.TEXT_NODE) return child.nodeValue;
        if (child.nodeName === "BR") return "\n";
        return (index > 0 && ["DIV", "P"].includes(child.nodeName) ? "\n" : "") + read(child);
      }).join("");
    }
    return read(el);
  }
  // Text and note boxes own their content: the width is fixed, the height follows the text.
  const textAutoHeight = (n) => n.type === "text" || n.type === "note";
  // A box only needs re-measuring when what it renders has changed; zoom is a CSS transform.
  const fitSignatures = new Map();
  const fitSignature = (n) => JSON.stringify([displayText(n), n.width, n.fontSize || 20, n.fontWeight || 400, n.textAlign || "left", n.lineHeight, n.letterSpacing, n.padding ?? null]);
  function fitContentHeight(n, el = nodeEls.get(n.id)) {
    const inner = el?.querySelector(".node-content");
    if (!inner || !el.isConnected) return false;
    inner.style.height = "auto";
    // scrollHeight covers the padding and ignores any leftover scroll offset.
    const height = Math.max(16, Math.ceil(inner.scrollHeight - 0.5));
    inner.style.height = `${height}px`;
    const resized = n.height !== height || Math.abs(Number.parseFloat(el.style.height) - height) >= 1;
    n.height = height;
    el.style.height = `${height}px`;
    return resized;
  }
  function fitTextNodes(only = null) {
    let resized = false;
    for (const n of state.nodes) {
      if (!textAutoHeight(n)) continue;
      if (only && !only.has(n.id)) continue;
      const signature = fitSignature(n);
      if (!only && fitSignatures.get(n.id) === signature) continue;
      fitSignatures.set(n.id, signature);
      resized = fitContentHeight(n) || resized;
    }
    if (resized) {
      updateGroupBounds();
      updatePositions(state.nodes.filter((n) => n.type === "group").map((n) => n.id));
      updateSelectionFrame();
      positionSelectionTools();
    }
    return resized;
  }
  let fitFrame = 0;
  let fitPending = null;
  const scheduleFit = (ids = null) => {
    if (ids) fitPending = fitPending ? new Set([...fitPending, ...ids]) : new Set(ids);
    else fitPending = "all";
    if (fitFrame) return;
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      const only = fitPending === "all" ? null : fitPending;
      fitPending = null;
      fitTextNodes(only);
    });
  };
  let fontTimer = 0;
  // A late web font changes every line box, so the cached signatures are dropped first.
  const refitAfterFonts = () => {
    fitSignatures.clear();
    scheduleFit();
  };
  if (document.fonts?.ready) document.fonts.ready.then(() => refitAfterFonts());
  document.fonts?.addEventListener?.("loadingdone", () => {
    clearTimeout(fontTimer);
    fontTimer = setTimeout(refitAfterFonts, 60);
  });
  function positionTextTools() {
    if (!textTools || !editing) return;
    const rect = nodeEls.get(editing.id)?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(textTools.offsetWidth || 510, innerWidth - 24);
    textTools.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + "px";
    textTools.style.top = Math.max(12, Math.min(rect.top - 48, innerHeight - 60)) + "px";
  }
  async function saveLinkedMarkdown(path, content, original, { background = false } = {}) {
    if (!local || readOnly) throw new Error("当前不可保存原文档，请在本机重试");
    const url = documentUrl(path), match = decodeURI(url.pathname).match(/^\/src\/pages\/([^/]+)\/([^/]+)\/(docs|v\d+)\//);
    if (!match) throw new Error("原文档路径无效");
    const latest = await fetch(url, {cache:"no-store"});
    if (!latest.ok) throw new Error("原文档无法读取，修改已保留在编辑器中");
    if ((await latest.text()) !== original) throw new Error("原文档已被修改，请保留当前草稿，读取最新原文后合并");
    const response = await fetch("/api/prd-doc", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:match[1],pageId:match[2],version:match[3] === "docs" ? route[3] : match[3],path:decodeURI(url.pathname),content,expectedContent:original,autosave:background || agentBusy || agentPending})});
    if (!response.ok) throw new Error(response.status === 409 ? "原文档已被修改，请保留当前草稿并合并最新内容" : "原文档保存失败，请重试");
    linkedPrds.set(path, content);
    if (parent !== window) parent.postMessage({type:"prota:canvas-prd-saved",path,content}, location.origin);
  }
  async function saveLinkedWithCurrentDisk(path, content, original, version, autosave) {
    const response = await fetch("/api/prd-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: route[1], pageId: route[2], version, path, content, expectedContent: original, autosave }) });
    if (!response.ok) throw new Error(response.status === 409 ? "原文档已被修改，请保留当前草稿并合并最新内容" : "原文档保存失败，请重试");
    linkedPrds.set(path, content);
  }
  function queueLinkedSave(edit, node, delay = AUTOSAVE_DELAY) {
    if (!local || readOnly || linkedConflict || linkedSavePromise) return;
    clearTimeout(linkedTimer);
    linkedTimer = setTimeout(() => {
      if (editing !== edit || node.text === edit.original) return;
      void flushLinkedSave(edit, node, { background: true });
    }, delay);
  }
  function flushLinkedSave(edit, node, { background = false, content = node.text, original = edit.original, retry = false } = {}) {
    if (linkedSavePromise) return linkedSavePromise;
    if (!local || readOnly || content === original) return Promise.resolve(true);
    const version = edit.prdPath.includes(`/${route[2]}/docs/`) ? route[3] : edit.prdPath.match(/^\/src\/pages\/[^/]+\/[^/]+\/(v\d+)\//)?.[1];
    const attempt = expected => saveLinkedWithCurrentDisk(edit.prdPath, content, expected, version, true);
    const request = retry ? attempt(original).catch(async error => {
      const latest = await fetch(documentUrl(edit.prdPath), { cache: "no-store" });
      if (!latest.ok) throw error;
      const disk = await latest.text();
      // A stale Agent rewrite between the user save and the journal repair is
      // expected; any unrelated external source still opens the merge dialog.
      if (disk !== original && disk !== content) throw error;
      return attempt(disk);
    }) : attempt(original);
    linkedSavePromise = request.then(() => {
      edit.original = content;
      linkedPrds.set(edit.prdPath, content);
      linkedConflict = false;
      status("已保存");
      return true;
    }).catch(error => {
      linkedConflict = true;
      status("原文档保存失败 · 已保留本机备份", "error");
      if (!background) notice(error.message);
      return false;
    }).finally(() => {
      linkedSavePromise = null;
    });
    return linkedSavePromise;
  }
  function applyTextCommand(command) {
    const el = editing && nodeEls.get(editing.id)?.querySelector(".node-content");
    if (!el) return;
    const {source,start,end}=window.CanvasMarkdownEditor.snapshot(el);
    window.CanvasMarkdownEditor.replace(el,window.CanvasMarkdownEditor.transform(source,start,end,command));
  }

  function mountTextTools() {
    textTools?.remove();
    textTools = document.createElement("div");textTools.className = "markdown-inline-tools";
    textTools.append(window.CanvasMarkdownEditor.toolbar(applyTextCommand));
    const expand = document.createElement("button");expand.type="button";expand.textContent="展开编辑";expand.setAttribute("aria-label","展开 Markdown 编辑器");
    expand.onpointerdown=e=>e.preventDefault();
    expand.onclick=()=>{
      const edit = editing, n = edit && state.nodes.find(n=>n.id===edit.id), el = n && nodeEls.get(n.id)?.querySelector(".node-content");
      if (!n || !el) return;
      clearTimeout(linkedTimer);
      expandedEditor={};
      expandedEditor=window.CanvasMarkdownEditor.dialog({title:n.name || "编辑 Markdown",source:textSource(el),baseUrl:prdPath(n),
        onSave:async source=>{
          if (edit.prdPath) {
            if (linkedSavePromise) await linkedSavePromise;
            await saveLinkedMarkdown(edit.prdPath,source,edit.original);
          }
          edit.prdPath="";el.value=source;el.oninput?.();finishText();expandedEditor=null;
        },
        onCancel:()=>{expandedEditor=null;el.focus();if(edit.prdPath)queueLinkedSave(edit,n);}});
    };
    const done = document.createElement("button");done.type="button";done.textContent="完成";done.onpointerdown=e=>e.preventDefault();done.onclick=()=>finishText();
    textTools.append(expand,done);document.body.append(textTools);positionTextTools();
  }
  function startText(id) {
    if (!canEdit()) return;
    finishText();
    setFloatingPanel("#property-popover", false);
    setFloatingPanel("#context-menu", false);
    const n = state.nodes.find((n2) => n2.id === id);
    if (!n || !["text", "note", "rect"].includes(n.type) || effectiveLocked(n) || agentHeld(n)) return;
    agentTextSelection = null;
    selected = /* @__PURE__ */ new Set([id]);
    render();
    let el = nodeEls.get(id)?.querySelector(".node-content");
    if (!el) return;
    if (prdPath(n)) n.text = displayText(n);
    checkpoint();
    editing = { id, prdPath: prdPath(n), original: n.text || "", historyLength: history.length - 1, composing: false };
    // Editing always uses the saved source, never the rendered Markdown DOM.
    if (n.type === "text") {
      const input=document.createElement("textarea");input.className="node-content";input.rows=1;
      input.value=n.text || "";input.style.cssText=el.style.cssText;el.replaceWith(input);el=input;
    } else {
      el.textContent = n.text || "";
      el.contentEditable = "plaintext-only";
    }
    el.spellcheck = false;
    el.setAttribute("aria-label", n.type === "text" ? (isMarkdownDocument(n) ? "编辑 Markdown 文本" : "编辑文本") : n.flowShape ? "编辑流程图文字" : n.type === "rect" ? "编辑矩形文字" : "编辑便签");
    el.parentElement.classList.add("editing");
    // render() ran before `editing` was set; drop the quick-create dots now that the label is being edited.
    flowQuick?.sync();
    el.focus();
    if (n.type === "text") el.select();
    else {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    el.onblur = event => {
      if (!expandedEditor && !event.relatedTarget?.closest('#context-menu[data-text-editing]')) finishText();
    };
    el.oncompositionstart = () => {
      if (editing) editing.composing = true;
    };
    el.oncompositionend = () => {
      if (editing) editing.composing = false;
    };
    el.oninput = () => {
      // Startup schema migration can replace node objects while this editor
      // stays focused. Always write into the current document.
      const node = state.nodes.find(item => item.id === id);
      if (editing?.id !== id || !node) return;
      node.text = textSource(el);
      if (prdPath(node)) linkedPrds.set(prdPath(node), node.text);
      // Keep the caret in view when the box grows past the viewport edge.
      const overflowing = el.scrollHeight > el.clientHeight + 1;
      const atBottom = overflowing && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      if (textAutoHeight(node)) fitContentHeight(node, el.parentElement);
      if (atBottom) el.scrollTop = el.scrollHeight;
      dirty = true;
      status("等待保存…", "busy");
      persistDraft({ announce: false });
      clearTimeout(autoTimer);
      if (prdPath(node)) queueLinkedSave(editing, node);
      else autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
    };
    if (n.type === "text") {
      if (isMarkdownDocument(n)) mountTextTools();
      el.onkeydown = event => {
        if (event.isComposing) return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {event.preventDefault();event.stopPropagation();finishText();return;}
        window.CanvasMarkdownEditor.handleKey(event,el);
      };
    } else if (n.flowShape) {
      // Flow labels are short: Enter commits, Shift+Enter breaks the line, IME composition never commits.
      el.onkeydown = event => {
        if (event.isComposing || event.keyCode === 229 || editing?.composing) return;
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault(); event.stopPropagation();
          finishText(); stage.focus({ preventScroll: true });
        }
      };
    }
    positionSelectionTools();
  }
  function finishText(cancel = false) {
    if (!editing) return;
    const edit = editing;
    fitSignatures.delete(edit.id);
    const n = state.nodes.find((item) => item.id === edit.id), el = nodeEls.get(edit.id)?.querySelector(".node-content");
    if (el) {
      n.text = textSource(el);
      if (edit.prdPath) linkedPrds.set(edit.prdPath, n.text);
    }
    editing = null;
    textTools?.remove();textTools=null;
    clearTimeout(autoTimer);
    clearTimeout(linkedTimer);
    if (el) {
      el.onkeydown = null;
      el.onblur = null;
      el.oninput = null;
      el.oncompositionstart = null;
      el.oncompositionend = null;
      el.contentEditable = "false";
      // Force source/preview synchronization even after Escape or an unchanged edit.
      delete el.parentElement.dataset.signature;
    }
    if (!n) return;
    if (edit.prdPath && !cancel && n.text === edit.original && !linkedConflict) {
      render();
      return true;
    }
    if (edit.prdPath && !cancel && n.text !== edit.original) {
      if (linkedSavePromise) {
        return linkedSavePromise.then(async saved => {
          if (saved !== false && edit.prdPath && n.text !== edit.original) {
            await flushLinkedSave(edit, n);
            changed();
          }
          return saved;
        });
      }
      const content = n.text;
      n.text = edit.original;
      linkedSavePromise = flushLinkedSave(edit, n, { content, original: edit.original, retry: true }).then(saved=>{
        if (!saved) throw new Error("原文档保存失败，请保留当前草稿后重试");
        return true;
      }).catch(error=>{
        notice(error.message);
        expandedEditor=window.CanvasMarkdownEditor.dialog({title:n.name,source:content,baseUrl:edit.prdPath,onSave:async value=>{
          n.text=value;
          if (!(await flushLinkedSave(edit,n,{content:value}))) throw new Error("原文档保存失败，请保留当前草稿后重试");
          expandedEditor=null;changed();
        },onCancel:()=>{expandedEditor=null;render();}});
        return false;
      }).finally(()=>{linkedSavePromise=null;});
      render();
      return linkedSavePromise;
    }
    if (cancel) n.text = edit.original;
    if (n.text !== edit.original) {
      changed();
      return;
    }
    if (history.length === edit.historyLength + 1) history.pop();
    const stillDirty = JSON.stringify(state.nodes) !== JSON.stringify(baseline.nodes);
    if (stillDirty) changed();
    else {
      dirty = false;
      removeStoredValue(draftKey);
      status("已保存");
      render();
    }
  }
  async function copyImageToClipboard(node) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      notice("当前环境不支持复制图片，请使用 HTTPS 或本机地址打开画布。");
      return;
    }
    try {
      const src = node.src;
      if (!/^(data:image\/(png|jpeg|webp|gif);base64,|assets\/[a-zA-Z0-9_.-]+$)/.test(src || "")) throw new Error("图片地址无效");
      const png = (async () => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法读取图片");
        context.drawImage(image, 0, 0);
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片转换失败")), "image/png"));
      })();
      // Start the clipboard write during the user gesture; Safari requires this
      // even when image decoding and PNG conversion are still pending.
      png.catch(() => {});
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      notice("图片已复制到剪贴板");
    } catch {
      notice("图片复制失败，请检查图片是否可读取并允许剪贴板访问后重试。");
    }
  }
  const canvasClipboardType = "application/x-prota-canvas";
  document.addEventListener("copy", (e) => {
    if (e.target.matches("input,textarea,select") || e.target.isContentEditable || !selected.size) return;
    copySelection(e);
  });
  function copySelection(event = null) {
    if (!selected.size) return;
    // Toolbar/menu copies must publish the same format as the native shortcut.
    if (!event?.clipboardData && document.execCommand("copy")) return;
    clipboard = { token: uid(), nodes: clone(state.nodes.filter((n) => C.descendants(state.nodes, selected).has(n.id))), selected: [...selected], edges: clone((state.edges || []).filter(e => C.descendants(state.nodes, selected).has(e.fromInstanceId) && C.descendants(state.nodes, selected).has(e.toInstanceId))), sourcePath: location.pathname };
    try {
      localStorage.setItem(clipboardKey, JSON.stringify({ ...clipboard, at: Date.now() }));
    } catch {
    }
    if (event?.clipboardData) {
      event.clipboardData.setData(canvasClipboardType, clipboard.token);
      event.clipboardData.setData("text/plain", clipboard.nodes.map(n => n.text || n.name || "").join("\n"));
      event.preventDefault();
    }
    notice("已复制 " + selected.size + " 个对象");
    setTimeout(() => {
      if ($("#notice-text").textContent.startsWith("已复制")) $("#notice").hidden = true;
    }, 1800);
  }
  function loadClipboard() {
    try {
      const stored = JSON.parse(localStorage.getItem(clipboardKey) || "null");
      if (stored?.nodes?.length) clipboard = { token: stored.token, nodes: clone(stored.nodes), selected: clone(stored.selected), edges: clone(stored.edges || []), sourcePath: stored.sourcePath };
    } catch {
    }
    return clipboard;
  }
  function pasteSelection(at = null) {
    const source = loadClipboard();
    if (!source || !canEdit()) return false;
    if (source.sourcePath !== location.pathname && source.nodes.some((n) => n.src && !n.src.startsWith("data:"))) {
      notice("跨画布目前支持文本与基础组件；含业务代码或本地图片的对象请在原画布内复制。");
      return false;
    }
    mutate(() => {
      const copies = C.duplicate(source.nodes, source.selected, 40);
      for (const n of copies.nodes) if (n.parentId && !copies.nodes.some((p) => p.id === n.parentId)) n.parentId = null;
      const edgeOffset={x:40,y:40};
      let target = at;
      if (!target && source.sourcePath !== location.pathname) target = point(innerWidth / 2, innerHeight / 2);
      if (target) {
        const b = C.bounds(C.roots(copies.nodes, copies.selected)), dx = target.x - b.x - b.width / 2, dy = target.y - b.y - b.height / 2;
        edgeOffset.x+=dx;edgeOffset.y+=dy;
        for (const n of copies.nodes) {
          n.x += dx;
          n.y += dy;
        }
      }
      state.nodes.push(...copies.nodes);
      const copiedEdges=C.duplicateEdges(source.edges || [], copies.mapping, edgeOffset);
      if(copiedEdges.length)(state.edges ||= []).push(...copiedEdges);
      selected = new Set(copies.selected);
    });
    return true;
  }
  async function images(files, at) {
    if (!canEdit()) return;
    for (const file of files) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
        status("支持 PNG、JPEG、WebP、GIF，单张不超过 4 MB", "error");
        continue;
      }
      const src = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const img = new Image();
      img.src = src;
      await img.decode();
      const target = imageReplaceTarget && state.nodes.find((n2) => n2.id === imageReplaceTarget && n2.type === "image");
      if (target) {
        mutate(() => {
          target.src = src;
          target.name = file.name || target.name;
        });
        imageReplaceTarget = null;
        continue;
      }
      const n = add("image", at);
      if (!n) return;
      n.src = src;
      n.name = file.name || "粘贴图片";
      n.width = Math.max(16, Math.min(600, img.naturalWidth));
      n.height = Math.max(16, Math.round(n.width * img.naturalHeight / img.naturalWidth));
      changed();
    }
  }
  const prdDragType = "application/x-prota-prd+json";
  async function dropPrd(raw, at) {
    if (!canEdit()) throw new Error(readOnly ? "当前画布只读" : "正在准备 Agent 任务，请稍候再拖入 PRD");
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!payload || typeof payload.path !== "string") throw new Error("PRD 拖拽数据无效");
    const source = documentUrl(payload.path);
    const response = await fetch(source.href, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`PRD 读取失败（${response.status}），请检查原文档是否存在`);
    const content = await response.text();
    if (!canEdit()) throw new Error("画布暂不可编辑，请稍后再拖入");
    finishText();
    linkedPrds.set(source.pathname, content);
    mutate(() => {
      const node = { id: uid(), type: "text", name: String(payload.name || decodeURIComponent(source.pathname.split("/").pop())),
        x: Math.round(at.x), y: Math.round(at.y), width: 720, height: 100,
        text: content, prdPath: source.pathname, markdownSource: source.pathname, color: "#ffffff", fontSize: 16, padding: 28 };
      state.nodes.push(node);
      selected = new Set([node.id]);
    });
    return true;
  }
  stage.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes(prdDragType)) e.dataTransfer.dropEffect = canEdit() ? "copy" : "none";
  });
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const at = point(e.clientX, e.clientY);
    if (e.dataTransfer.types.includes(prdDragType)) {
      dropPrd(e.dataTransfer.getData(prdDragType), at).catch(error => notice(error.message || "PRD 读取失败，请重试"));
      return;
    }
    const files=[...e.dataTransfer.files];
    const markdownFiles=files.filter(file=>/\.(md|markdown)$/i.test(file.name));
    void (async()=>{
      for (const [index,file] of markdownFiles.entries()) {
        const text=(await file.text()).replace(/^\uFEFF/, "").replace(/\r\n?/g,"\n");
        if (!canEdit()) return;
        finishText();
        mutate(()=>{
          const node={id:uid(),type:"text",name:file.name,x:Math.round(at.x+index*32),y:Math.round(at.y+index*32),width:720,height:100,text,markdownDocument:true,color:"#ffffff",fontSize:16,padding:28};
          state.nodes.push(node);selected=new Set([node.id]);
        });
      }
      await images(files.filter(file=>!markdownFiles.includes(file)),at);
    })().catch(()=>status("文件读取失败", "error"));
  });
  function pasteText(text) {
    if (!text.trim() || !canEdit()) return false;
    const rect = stage.getBoundingClientRect();
    const at = point(rect.left + stage.clientWidth / 2, rect.top + stage.clientHeight / 2);
    const width = Math.min(560, Math.max(280, stage.clientWidth * 0.6 / state.viewport.zoom));
    mutate(() => {
      const n = { id: uid(), type: "text", name: "文本", text: text.replace(/\r\n?/g, "\n"),
        x: Math.round(at.x - width / 2), y: Math.round(at.y - 50),
        width, height: 100, color: "", fontSize: 20 };
      state.nodes.push(n);
      selected = new Set([n.id]);
    });
    stage.focus();
    return true;
  }
  document.addEventListener("paste", (e) => {
    clearTimeout(pasteTimer);
    if (e.target.matches("input,textarea,select") || e.target.isContentEditable || !e.clipboardData || !canEdit()) return;
    const data = e.clipboardData;
    const files = [...data.files];
    if (files.length) {
      e.preventDefault();
      images(files).catch(() => status("图片读取失败", "error"));
    } else if (data.getData(canvasClipboardType) && data.getData(canvasClipboardType) === loadClipboard()?.token) {
      if (pasteSelection()) e.preventDefault();
    } else if (pasteText(data.getData("text/plain"))) {
      e.preventDefault();
    } else if (!data.types.length && pasteSelection()) e.preventDefault();
  });
  // Background saves persist the current source without committing the editor.
  // Explicit saves and outside clicks still finish editing.
  async function save({ preserveEditing = false, keepalive = false } = {}) {
    clearTimeout(autoTimer);
    if (gesture) {
      autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
      return false;
    }
    if (preserveEditing && editing?.composing) {
      autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
      return false;
    }
    if (!preserveEditing && (await finishText()) === false) return false;
    if (linkedSavePromise && (await linkedSavePromise) === false) return false;
    if (readOnly) return false;
    if (savePromise) {
      await savePromise;
      return dirty && !conflict ? save({ preserveEditing, keepalive }) : !dirty;
    }
    if (!local) {
      status("已暂存在当前浏览器");
      return false;
    }
    if (!dirty) return true;
    saving = true;
    status("正在保存…", "busy");
    const snapshot = clone(state), original = clone(baseline);
    savePromise = (async () => {
      try {
        const response = await fetch("/api/canvas/save", { method: "POST", keepalive, signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: route[1], pageId: route[2], version: route[3], revision: baseline.revision, baseline: original, state: snapshot, autosave: true }) });
        const result = await response.json();
        if (!response.ok) {
          conflict = response.status === 409;
          throw Error(result.error || "保存失败");
        }
        dirty = JSON.stringify(state) !== JSON.stringify(snapshot);
        for (const asset of result.assets || []) {
          const old = snapshot.nodes.find((n) => n.id === asset.id)?.src;
          const node = snapshot.nodes.find((n) => n.id === asset.id);
          if (node) node.src = asset.src;
          for (const doc of [state, ...history, ...future]) {
            const item = doc.nodes.find((entry) => entry.id === asset.id);
            if (item?.src === old) item.src = asset.src;
          }
        }
        if (result.deferred) {
          // The server fsynced the manual receipt before acknowledging it. Its
          // worker reconciles partial Agent writes even after this iframe closes.
          baseline = clone(original);
        } else if (result.state) {
          const persisted = materialize(result.state, schemaEnabled || result.state.schemaVersion === 2);
          const rebased = C.mergeDocuments(snapshot, state, persisted).state;
          // Property controls retain node references while the user is typing.
          // Adopt acknowledged fields without invalidating those live controls.
          const existing = new Map(state.nodes.map(node => [node.id, node]));
          rebased.nodes = rebased.nodes.map(node => {
            const live = existing.get(node.id);
            if (!live) return node;
            for (const key of Object.keys(live)) if (!(key in node)) delete live[key];
            return Object.assign(live, node);
          });
          state = rebased;
          state.revision = persisted.revision;
          baseline = clone(result.state);
          render({ panels: false });
        } else {
          const revision = result.revision;
          if (!Number.isSafeInteger(revision) || revision < 0) throw Error("保存失败，请重试");
          baseline = clone(snapshot);
          baseline.revision = revision;
          state.revision = revision;
        }
        conflict = false;
        if (dirty) persistDraft({ announce: false });
        if (!dirty) {
          removeStoredValue(draftKey);
          if (restoredConflictBackup && readStoredValue(draftKey + ":conflict-backup") === restoredConflictBackup) {
            removeStoredValue(draftKey + ":conflict-backup");
            restoredConflictBackup = null;
          }
          $("#notice").hidden = true;
        }
        if (snapshot.nodes.some(n => n.cloneFrom)) render({panels:false});
        status(dirty ? "有新的修改待保存" : "已保存", dirty ? "busy" : "");
        notify();
        return true;
      } catch (error) {
        dirty = true;
        const backedUp = persistDraft({ announce: false });
        status(conflict ? "保存冲突" : backedUp ? "保存失败 · 已保留本机备份" : "保存失败 · 请保持页面打开", "error");
        if (conflict) {
          try {
            backupLocal();
          } catch {
          }
        }
        notice(error.message, conflict ? [
          { label: "恢复我的修改", primary: true, run: restoreLocalOverConflict },
          { label: "读取最新版本", run: reloadLatestKeepBackup }
        ] : [{ label: "重试保存", primary: true, run: () => save() }]);
        return false;
      } finally {
        saving = false;
        savePromise = null;
        if (dirty && !conflict) autoTimer = setTimeout(() => save({ preserveEditing: true }), JSON.stringify(state) !== JSON.stringify(snapshot) ? AUTOSAVE_DELAY : 3000);
      }
    })();
    return savePromise;
  }
  // A sustained typing session must keep reaching disk without waiting for a
  // pause in input. The single in-flight save rebases any edits made meanwhile.
  setInterval(() => {
    if (local && !readOnly && !gesture && !editing?.composing && !recoveringDraft) {
      if (editing?.prdPath) {
        const node = state.nodes.find(item => item.id === editing.id);
        if (node) queueLinkedSave(editing, node, 0);
        return;
      }
      if (!dirty || saving || conflict) return;
      void save({ preserveEditing: true });
    }
  }, 150);
  function backupLocal() {
    try {
      const result = writeStoredValue(draftKey + ":conflict-backup", JSON.stringify({ state, baseline, savedAt: Date.now() }));
      if (!result.ok) throw result.error;
    } catch {
      notice("本机备份空间不足，当前修改仍保留在画布中。");
      throw Error("无法备份当前修改");
    }
  }
  async function fetchDiskDocument(snapshotUrl = null) {
    const layoutUrl = snapshotUrl ? new URL("canvas-data.js", new URL(snapshotUrl, location.href)).href : "./canvas-data.js?fresh=" + Date.now();
    const response = await fetch(layoutUrl, { cache: "no-store" });
    if (!response.ok) throw Error("读取画布失败");
    const text = await response.text(), prefix = "window.PROTA_CANVAS = ";
    if (!text.trim().startsWith(prefix)) throw Error("画布格式错误，请检查 Agent 的修改");
    const next = JSON.parse(text.trim().slice(prefix.length).replace(/;\s*$/, ""));
    C.validate(next);
    return next;
  }
  async function reloadLatestKeepBackup() {
    try {
      backupLocal();
      const loaded=await reloadFromDisk(true);
      if(loaded)offerConflictBackupRestore();
    } catch (error) {
      notice(error.message || "读取最新版本失败");
    }
  }
  async function restoreLocalOverConflict() {
    try {
      const backup = JSON.parse(readStoredValue(draftKey + ":conflict-backup") || "null");
      if (!backup?.state) throw Error("未找到本机备份");
      const disk = await fetchDiskDocument();
      C.validate(backup.state);
      const useV2 = schemaEnabled || state.schemaVersion === 2 || backup.state.schemaVersion === 2 || disk.schemaVersion === 2;
      const [before, ours, theirs] = await Promise.all([backup.baseline || baseline, backup.state, disk].map(doc => materialize(doc, useV2)));
      const merged = C.mergeDocuments(before, ours, theirs);
      const apply = () => {
        checkpoint();
        try {
          writeStoredValue(draftKey + ":conflict-backup", JSON.stringify({ ...backup, disk }));
        } catch {
        }
        restoredConflictBackup = readStoredValue(draftKey + ":conflict-backup");
        const viewport = state.viewport;
        state = merged.state;
        state.viewport = viewport;
        baseline = clone(disk);
        state.revision = disk.revision;
        conflict = false;
        dirty = true;
        $("#notice").hidden = true;
        changed();
        notice("已恢复本机修改并保留独立的外部更新，正在自动保存…");
      };
      if (merged.conflicts.length) {
        notice(`有 ${merged.conflicts.length} 个对象被双方修改。继续后仅冲突字段采用本机内容，其他外部修改保留。`, [{ label: "应用本机修改", primary: true, run: apply }, { label: "读取最新版本", run: reloadLatestKeepBackup }]);
        return;
      }
      apply();
    } catch (error) {
      notice("恢复失败：" + (error.message || "备份不可用"), [{ label: "读取最新版本", run: reloadLatestKeepBackup }]);
    }
  }
  function backupNoticeToken(raw) {
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
    return raw.length + ":" + (hash >>> 0);
  }
  function keepCurrentDiscardBackup(raw) {
    // Only discard the backup shown by this notice, never a newer receipt or
    // the active recovery draft. No document state or disk content is changed.
    if (readStoredValue(draftKey + ":conflict-backup") !== raw) return;
    removeStoredValue(draftKey + ":conflict-backup");
    removeStoredValue(draftKey + ":conflict-backup-dismissed");
    conflictBackupNotice = null;
    $("#notice").hidden = true;
  }
  function offerConflictBackupRestore() {
    try {
      const raw = readStoredValue(draftKey + ":conflict-backup");
      const backup = JSON.parse(raw || "null");
      if (!backup?.state) return;
      // Older runtimes retained already-applied backups indefinitely. Retire
      // one only when replaying its actual edits would leave this document unchanged.
      if (backup.baseline) {
        const useV2 = schemaEnabled || state.schemaVersion === 2 || backup.state.schemaVersion === 2;
        const merged = C.mergeDocuments(materialize(backup.baseline, useV2), materialize(backup.state, useV2), state);
        const content = doc => {
          const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object"
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
          const { revision, viewport, ...rest } = doc;
          return JSON.stringify(normalize(rest));
        };
        if (!merged.conflicts.length && content(merged.state) === content(state)) {
          removeStoredValue(draftKey + ":conflict-backup");
          return;
        }
      }
      const token = backupNoticeToken(raw);
      if (readStoredValue(draftKey + ":conflict-backup-dismissed") === token) return;
      const at = new Date(backup.savedAt || Date.now());
      const time = `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
      notice(`冲突前的本机修改已备份（${time}）`, [
        { label: "保留当前状态", primary: true, run: () => keepCurrentDiscardBackup(raw) },
        { label: "恢复备份", run: restoreLocalOverConflict }
      ]);
      conflictBackupNotice = token;
    } catch {
    }
  }
  async function focusAgent(adaptBoardState = false, textSelection = null) {
    if (readOnly) return;
    if ((await finishText()) === false) return;
    agentTextSelection = textSelection;
    notify();
    if (parent === window) {
      notice("请在 Prota 中使用当前 Agent。");
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    if (fullscreenFallback) parent.postMessage({ type: "prota:canvas-fullscreen", active: false }, location.origin);
    parent.postMessage({ type: "prota:canvas-open-agent", adaptBoardState: adaptBoardState === true }, location.origin);
  }
  // When the Agent run settles, fold its disk writes into local edits without discarding either
  // side; unresolved objects keep the local version and the merged document autosaves right after.
  async function syncAgentOutcome() {
    clearTimeout(autoTimer);
    if (savePromise) {
      try {
        await savePromise;
      } catch {
      }
    }
    if (conflict) return;
    try {
      finishText();
    } catch {
    }
    if (linkedSavePromise) {
      try {
        await linkedSavePromise;
      } catch {
      }
    }
    if (!dirty) return;
    try {
      const disk = await fetchDiskDocument();
      const useV2 = schemaEnabled || state.schemaVersion === 2 || disk.schemaVersion === 2;
      const [before, ours, theirs] = await Promise.all([baseline, clone(state), disk].map(doc => materialize(doc, useV2)));
      const merged = C.mergeDocuments(before, ours, theirs);
      const viewport = clone(state.viewport);
      checkpoint();
      state = merged.state;
      state.viewport = viewport;
      baseline = clone(disk);
      state.revision = disk.revision;
      selected = new Set([...selected].filter((id) => state.nodes.some((n) => n.id === id)));
      conflict = false;
      dirty = true;
      state.nodes.filter((n) => n.type === "board").forEach((n) => boardStamps.set(n.id, Date.now()));
      changed();
      notice(merged.conflicts.length ? `Agent 的修改与你的编辑在 ${merged.conflicts.length} 个对象上冲突，冲突处已保留你的修改。` : "已合并 Agent 的修改，正在保存…");
    } catch (error) {
      notice(error.message || "同步 Agent 修改失败", [{ label: "读取最新版本", run: reloadLatestKeepBackup }]);
    }
  }
  function agentState(data) {
    const wasBusy = agentBusy, previousTargets = [...agentTargets];
    agentTargets = new Set(data.active ? data.targetIds || [] : []);
    if (data.active || wasBusy) { agentPending = false; preparingTargets.clear(); }
    agentBusy = Boolean(data.active);
    for (const [id, el] of nodeEls) el.classList.toggle("agent-target", agentHeld(state.nodes.find(n => n.id === id)));
    document.body.classList.toggle("agent-working", agentBusy);
    if (agentBusy && !dirty && !saving) status("已保存 · Agent 正在修改");
    else if (wasBusy) {
      if (data.error) notice("任务未完成，可在当前 Agent 中查看详情。");
      const settle = () => {
        if (!data.previewManaged && !(dirty || editing)) reloadFromDisk(false, { targetIds: previousTargets.length ? previousTargets : null });
      };
      if (dirty || editing || saving) syncAgentOutcome().finally(settle);
      else settle();
    }
    document.querySelectorAll("#add-board,#add-flowchart,#add-note,#image,#first-board,#ask-agent,[data-tool]:not([data-tool=select]):not([data-tool=hand])").forEach((button) => button.disabled = readOnly);
    renderInspector();
  }
  // Context menus replace the toolbar; its own More menu expands underneath it.
  function setFloatingPanel(selector, open) {
    if ((selector === "#property-popover" && !open) || (open && selector !== "#property-popover")) closeInspectorDropdown();
    if (open) {
      for (const other of floatingPanels) if (other !== selector) $(other).hidden = true;
    }
    $(selector).hidden = !open;
    if (selector === "#context-menu" && !open) {
      delete $(selector).dataset.boardVersions;
      document.querySelectorAll('.board-version[aria-expanded="true"]').forEach(button => button.setAttribute("aria-expanded", "false"));
    }
    for (const id of ["more", "align-more"]) {
      const invokerButton = $(`#selection-tools [data-action="${id}"]`);
      invokerButton?.setAttribute("aria-expanded", String(!$("#context-menu").hidden && $("#context-menu").hasAttribute("data-selection-tools")));
    }
    positionSelectionTools();
  }
  function placeFloating(element, x, y) {
    setFloatingPanel("#" + element.id, true);
    const w = element.offsetWidth, h = element.offsetHeight;
    element.style.left = Math.max(10, Math.min(innerWidth - w - 10, x)) + "px";
    element.style.top = Math.max(10, Math.min(innerHeight - h - 10, y)) + "px";
  }
  function showMenu(items, x, y, invoker = document.activeElement, { keepSelectionTools = false, textEditing = false } = {}) {
    if (!invoker || invoker === document.body) invoker = stage;
    closePalette();
    setFloatingPanel("#property-popover", false);
    const menu = $("#context-menu");
    menu.replaceChildren();
    delete menu.dataset.boardVersions;
    delete menu.dataset.flowchart;
    menu.toggleAttribute("data-selection-tools", keepSelectionTools);
    menu.toggleAttribute("data-text-editing", textEditing);
    menu.style.removeProperty("max-height");
    menuInvoker = invoker;
    for (const item of items) {
      if (item.divider) {
        const divider = document.createElement("div");
        divider.className = "menu-divider";
        divider.setAttribute("role", "separator");
        menu.append(divider);
      } else if (item.heading) {
        const heading = document.createElement("div");
        heading.className = "menu-section";
        heading.textContent = item.heading;
        menu.append(heading);
      } else menu.append(actionButton(item, true));
    }
    placeFloating(menu, x, y);
    if (keepSelectionTools) positionSelectionTools();
    // Keyboard-opened menus keep the focus-first-item behavior; pointer-opened
    // menus (right-click) focus the menu shell so no focus ring lands on an item.
    if (textEditing && !lastInputWasKeyboard) {
      // Keep native textarea selection actively highlighted behind the pointer menu.
      invoker.focus({ preventScroll: true });
    } else if (lastInputWasKeyboard) menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    else menu.focus({ preventScroll: true });
  }
  function insertAt(kind, at) {
    const n = add(kind, at);
    if (n && at) {
      const ids = C.descendants(state.nodes, [n.id]), dx = at.x - n.x, dy = at.y - n.y;
      for (const item of state.nodes) if (ids.has(item.id)) {
        item.x += dx;
        item.y += dy;
      }
      changed();
    }
  }
  function creationActions(at = null, category = "all") {
    const defs = [["mobile", "手机画板", "frame", "boards"], ["web", "Web 画板", "frame", "boards"], ["board", "自由画板", "frame", "boards"], ["text", "文本", "type", "content"], ["note", "便签", "sticky-note", "content"], ["image", "图片", "image-plus", "content"]];
    // Picker-only presets (text, circle) already exist as base kinds; keep only real flow shapes here.
    defs.push(...Object.entries(flowShapes).filter(([, preset]) => preset.kind === "flow").map(([shape, preset]) => ["flow-"+shape, preset.label, preset.icon, "flowchart"]));
    return defs.filter(([, , , group]) => category === "all" || category === group).map(([kind, label, icon]) => ({ id: "add-" + kind, label, icon, disabled: !canEdit(), run: () => {
      if (kind === "image") {
        imageReplaceTarget = null;
        imageInsertionPoint = at;
        $("#image-input").click();
      } else insertAt(kind, at);
    } }));
  }
  function openCreateMenu(button, category) {
    const r = button.getBoundingClientRect();
    showMenu(creationActions(null, category), r.right + 12, r.top, button);
  }
  $("#add-board").onclick = (e) => openCreateMenu(e.currentTarget, "boards");
  // The flowchart toolbar and context menu share the quick-create shape grid.
  function openFlowchartMenu(button, at = null) {
    if (!flowQuick || !canEdit()) return;
    setFloatingPanel("#context-menu", false);
    const r = button.getBoundingClientRect();
    flowQuick.openPicker(r.right + 12, r.top, at, button);
    const panel = $("#flow-shape-picker");
    panel.style.top = Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, r.top)) + "px";
  }
  $("#add-flowchart").onclick = e => openFlowchartMenu(e.currentTarget);
  $("#more-tools").onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    showMenu(creationActions().filter((a) => ["add-note", "add-image"].includes(a.id)), rect.right + 12, rect.top, e.currentTarget);
  };
  $("#add-note").onclick = () => add("note");
  $("#ask-agent").onclick = focusAgent;
  $("#empty-agent").onclick = focusAgent;
  $("#close-properties").onclick = () => {
    setFloatingPanel("#property-popover", false);
    stage.focus();
  };
  $("#notice-dismiss").onclick = () => {
    if (conflictBackupNotice) writeStoredValue(draftKey + ":conflict-backup-dismissed", conflictBackupNotice);
    conflictBackupNotice = null;
    $("#notice").hidden = true;
  };
  document.querySelectorAll("[data-tool]").forEach((button) => button.onclick = () => {
    finishText();
    exitInteraction();
    setTool(button.dataset.tool);
    setFloatingPanel("#property-popover", false);
  });
  function openNodeMenu(el, clientX, clientY, { includeBoardAdd = false } = {}) {
    if (!el) return;
    lastInputWasKeyboard = false;
    if (!selected.has(el.dataset.id)) {
      selected = /* @__PURE__ */ new Set([el.dataset.id]);
      groupContext = null;
    }
    render();
    const { primary, more } = contextActions();
    const items = [...primary];
    if (primary.length && more.length) items.push({ divider: true });
    items.push(...more);
    const board = state.nodes.find((n) => n.id === el.dataset.id && n.type === "board");
    if (includeBoardAdd && board && !effectiveLocked(board) && canEdit()) {
      const at = point(clientX, clientY);
      items.push({ divider: true }, { heading: "添加到此画板" }, ...creationActions(at).filter((a) => ["add-text", "add-note", "add-image"].includes(a.id)));
    }
    showMenu(items, clientX, clientY);
  }
  window.addEventListener("contextmenu", (e) => {
    consumeFocusedContextMenu(e);
  }, true);
  function openTextMenu(el, event) {
    const edit = editing, { source, start, end } = window.CanvasMarkdownEditor.snapshot(el);
    const restore = () => {
      if (editing !== edit || !el.isConnected) return false;
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
      return true;
    };
    const copy = async cut => {
      try {
        await navigator.clipboard.writeText(source.slice(start, end));
        if (restore() && cut) document.execCommand("insertText", false, "");
      } catch { restore(); notice("无法访问剪贴板，请使用键盘快捷键。"); }
    };
    const items = [
      { id: "text-cut", label: "剪切", icon: "scissors", disabled: start === end, run: () => copy(true) },
      { id: "text-copy", label: "复制", icon: "copy", disabled: start === end, run: () => copy(false) },
      { id: "text-paste", label: "粘贴", icon: "clipboard-paste", run: async () => {
        try { const text = await navigator.clipboard.readText(); if (restore()) document.execCommand("insertText", false, text); }
        catch { restore(); notice("无法访问剪贴板，请使用键盘快捷键。"); }
      } },
      { id: "text-select-all", label: "全选", icon: "type", run: () => { if (restore()) el.select(); } },
      { divider: true },
      { id: "text-agent", label: "Prota", icon: "sparkles", agent: true, run: () => focusAgent(false, start < end ? { id: edit.id, source, start, end } : null) }
    ];
    lastInputWasKeyboard = false;
    showMenu(items, event.clientX, event.clientY, el, { textEditing: true });
  }
  stage.addEventListener("contextmenu", (e) => {
    if (editing && e.target.matches("textarea.node-content") && state.nodes.find(n => n.id === editing.id)?.type === "text") {
      e.preventDefault();
      openTextMenu(e.target, e);
      return;
    }
    if (e.target.isContentEditable || e.target.closest("#property-popover,#selection-tools,.floating")) return;
    e.preventDefault();
    finishText();
    if (annotationBoardId) {
      exitBoardAnnotation();
      return;
    }
    const el = e.target.closest(".node");
    const boardNode = el ? state.nodes.find((n) => n.id === el.dataset.id && n.type === "board" && el.querySelector("iframe")) : null;
    if (boardNode && !e.target.closest(".node-title") && canAnnotateBoard(boardNode)) {
      const includeBoardAdd = !e.target.closest(".node-title");
      handleBoardContextMenu(boardNode.id, e.clientX, e.clientY, () => {
        openNodeMenu(el, e.clientX, e.clientY, { includeBoardAdd });
      });
      return;
    }
    exitInteraction();
    if (el) {
      openNodeMenu(el, e.clientX, e.clientY, { includeBoardAdd: false });
    } else {
      selected.clear();
      groupContext = null;
      render();
      const at = point(e.clientX, e.clientY);
      showMenu([
        { heading: "添加到这里" },
        { id: "add-board", label: "画板", icon: "frame", disabled: !canEdit(), run: () => showMenu(creationActions(at, "boards"), e.clientX, e.clientY) },
        ...creationActions(at).filter((a) => !["add-mobile", "add-web", "add-board"].includes(a.id) && !a.id.startsWith("add-component") && !a.id.startsWith("add-flow-")),
        { id: "flowchart", label: "流程图", icon: "flowchart", disabled: !canEdit(), run: () => { setFloatingPanel("#context-menu", false); flowQuick?.openPicker(e.clientX, e.clientY, at, stage); } },
        { divider: true },
        { id: "paste", label: "粘贴", icon: "clipboard-paste", shortcut: "⌘ V", disabled: !loadClipboard() || !canEdit(), run: () => pasteSelection(at) },
        { divider: true },
        { id: "fit", label: "查看全部", icon: "scan", run: () => fit(void 0, { animate: true }) }
      ], e.clientX, e.clientY);
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#context-menu") && !e.target.closest("[aria-haspopup=menu]") && !e.target.closest("#command-palette")) setFloatingPanel("#context-menu", false);
    if (!e.target.closest("#property-popover,#node-colors") && !e.target.closest("#selection-tools")) setFloatingPanel("#property-popover", false);
  });
  $("#context-menu").addEventListener("pointerdown", e => {
    if (e.currentTarget.hasAttribute("data-text-editing")) e.preventDefault();
  });
  $("#context-menu").addEventListener("keydown", (e) => {
    const buttons = [...$("#context-menu").querySelectorAll("button:not(:disabled)")], index = buttons.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : index === -1 ? (e.key === "ArrowDown" ? 0 : buttons.length - 1) : (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setFloatingPanel("#context-menu", false);
      menuInvoker?.focus?.();
    }
  });
  function paletteCommands() {
    const list = [];
    const push = (label, icon, shortcut, run, id) => list.push({ id: id || "cmd-" + label, label, icon, shortcut, run });
    for (const action of creationActions(null).filter((a) => a.id !== "add-image" && !a.disabled)) push(action.label, action.icon, "", action.run, action.id);
    if (canEdit()) push("连接对象", "waypoints", "L", () => setTool("connect"), "connect");
    if (canEdit()) push("插入图片", "image-plus", "", () => $("#image-input").click());
    push("撤销", "undo-2", "⌘ Z", () => undo());
    push("重做", "redo-2", "⌘ ⇧ Z", () => undo(true));
    push("查看全部", "scan", "", () => fit(void 0, { animate: true }));
    push("缩放 100%", "zoom-in", "⌘ 0", () => zoomTo(1));
    push("全屏 / 退出全屏", "maximize-2", "", () => toggleFullscreen());
    if (selected.size) {
      push("聚焦选中", "focus", "", () => fit(current(), { animate: true }));
      const { primary, more } = contextActions();
      for (const action of [...primary, ...more].filter((a) => !a.disabled)) push(action.label, action.icon, action.shortcut || "", (event, rect) => action.run(event, rect || $("#selection-tools").getBoundingClientRect()), "ctx-" + action.id);
    }
    if (!readOnly && readStoredValue(draftKey + ":conflict-backup")) push("恢复冲突前的本机备份", "undo-2", "", restoreLocalOverConflict);
    if (!readOnly) push("交给当前 Agent", "sparkles", "", () => focusAgent());
    return list;
  }
  function renderPalette() {
    const query = $("#command-input").value.trim().toLowerCase();
    paletteItems = paletteCommands().filter((item) => !query || item.label.toLowerCase().includes(query));
    paletteIndex = Math.max(0, Math.min(paletteIndex, paletteItems.length - 1));
    const list = $("#command-list");
    list.replaceChildren();
    if (!paletteItems.length) {
      const empty = document.createElement("div");
      empty.className = "command-empty";
      empty.textContent = "没有匹配的命令";
      list.append(empty);
      return;
    }
    paletteItems.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "command-item" + (index === paletteIndex ? " selected" : "");
      button.setAttribute("role", "option");
      button.dataset.index = index;
      decorate(button, item.icon, item.label);
      if (item.shortcut) {
        const hint = document.createElement("span");
        hint.className = "menu-shortcut";
        hint.textContent = item.shortcut;
        button.append(hint);
      }
      button.onclick = () => runPaletteItem(index);
      list.append(button);
    });
    list.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  }
  function runPaletteItem(index) {
    const item = paletteItems[index];
    closePalette();
    item?.run(null, $("#selection-tools").getBoundingClientRect());
  }
  function openPalette() {
    setFloatingPanel("#command-palette", true);
    paletteIndex = 0;
    $("#command-input").value = "";
    renderPalette();
    $("#command-input").focus();
  }
  function closePalette() {
    if ($("#command-palette").hidden) return;
    setFloatingPanel("#command-palette", false);
    stage.focus();
  }
  $("#command-input").addEventListener("input", () => {
    paletteIndex = 0;
    renderPalette();
  });
  $("#command-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (paletteItems.length) paletteIndex = (paletteIndex + (e.key === "ArrowDown" ? 1 : paletteItems.length - 1)) % paletteItems.length;
      renderPalette();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runPaletteItem(paletteIndex);
    }
  });
  $("#command-list").addEventListener("click", (e) => {
    const item = e.target.closest(".command-item");
    if (item) runPaletteItem(Number(item.dataset.index));
  });
  function screenSelection() {
    const b = C.bounds(selectedRoots());
    if (!b) return null;
    const v = state.viewport;
    return { x: b.x * v.zoom + v.x, y: b.y * v.zoom + v.y, width: b.width * v.zoom, height: b.height * v.zoom };
  }
  function overlayObstacles(extra = []) {
    return [".canvas-identity", ".right-tools", ".creation-tools", "#notice", ...extra].map((selector) => $(selector)).filter((el) => el && !el.hidden).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10 };
    });
  }
  function positionSelectionTools() {
    const box = $("#selection-tools");
    if (!current().length || editing || gesture || interacting || floatingPanels.some((selector) => !$(selector).hidden && !(selector === "#context-menu" && $(selector).hasAttribute("data-selection-tools")))) {
      box.hidden = true;
      return;
    }
    const anchor = screenSelection();
    if (!anchor) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const pos = C.placeOverlay({ anchor, width: box.offsetWidth, height: box.offsetHeight, viewport: { width: innerWidth, height: innerHeight }, obstacles: [...overlayObstacles(), ...(flowQuick?.dotRects() || [])], adjacent: true, gap: 50 });
    box.style.left = pos.x + "px";
    box.style.top = pos.y + "px";
    box.dataset.placement = pos.placement;
    const menu = $("#context-menu");
    if (!menu.hidden && menu.hasAttribute("data-selection-tools")) {
      const rect = box.getBoundingClientRect();
      menu.style.maxHeight = Math.max(0, innerHeight - 24) + "px";
      const menuPos = C.placeOverlay({ anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, width: menu.offsetWidth, height: menu.offsetHeight, viewport: { width: innerWidth, height: innerHeight }, obstacles: overlayObstacles(), placement: "popover", gap: 10 });
      menu.style.left = menuPos.x + "px";
      menu.style.top = menuPos.y + "px";
    }
  }
  function notice(text, actionList = []) {
    conflictBackupNotice = null;
    $("#notice-text").textContent = text;
    const container = $("#notice-actions");
    const list = Array.isArray(actionList) ? actionList : actionList ? [actionList] : [];
    // Autosave retries republish the same notice; keep buttons mounted so a
    // user click is not racing periodic DOM replacement.
    while (container.children.length > list.length) container.lastElementChild.remove();
    for (const [index, action] of list.entries()) {
      let button = container.children[index];
      if (!button) {
        button = document.createElement("button");
        container.append(button);
      }
      button.className = "notice-action";
      button.id = button.previousElementSibling ? "notice-action-secondary" : "notice-action";
      button.textContent = action.label;
      if (action.primary) button.classList.add("primary");
      button.onclick = action.run;
    }
    $("#notice").hidden = false;
  }
  $("#first-board").onclick = () => add("mobile");
  $("#image").onclick = () => {
    imageReplaceTarget = null;
    imageInsertionPoint = null;
    $("#image-input").click();
  };
  $("#image-input").addEventListener("cancel", () => {
    imageReplaceTarget = null;
    imageInsertionPoint = null;
  });
  $("#image-input").onchange = (e) => {
    images(e.target.files, imageInsertionPoint).catch(() => status("图片读取失败", "error"));
    imageInsertionPoint = null;
    e.target.value = "";
  };
  $("#undo").onclick = () => undo();
  $("#redo").onclick = () => undo(true);
  $("#fit").onclick = () => fit(void 0, { animate: true });
  $("#focus-selection").onclick = () => fit(selectedRoots().length ? current() : state.nodes, { animate: true });
  $("#zoom-in").onclick = () => zoom(1.2, void 0, void 0, true);
  $("#zoom-out").onclick = () => zoom(1 / 1.2, void 0, void 0, true);
  $("#zoom-reset").onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const currentZoom = Math.round(state.viewport.zoom * 100);
    showMenu([200, 150, 100, 75, 50].map((value) => ({ id: "zoom-" + value, label: value + "%", icon: value === currentZoom ? "check" : "zoom-in", disabled: value === currentZoom, run: () => zoomTo(value / 100) })).concat([{ divider: true }, { id: "fit", label: "适配全部", icon: "scan", run: () => fit(void 0, { animate: true }) }]), Math.max(10, r.left - 70), Math.max(10, r.top - 250), e.currentTarget);
  };
  function setTool(value) {
    tool = value;
    connections?.setTool(value);
    flowQuick?.sync();
    stage.classList.remove("tool-select", "tool-hand", "tool-text", "tool-rect", "tool-ellipse", "tool-board", "tool-connect");
    stage.classList.add("tool-" + value);
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === value);
      b.setAttribute("aria-pressed", b.dataset.tool === value);
    });
  }
  function persistView() {
    try {
      sessionStorage.setItem(draftKey + ":view", JSON.stringify(state.viewport));
    } catch {
    }
    view();
  }
  function updateGroupBounds() {
    const children = /* @__PURE__ */ new Map(), visited = /* @__PURE__ */ new Set();
    for (const n of state.nodes) {
      if (!children.has(n.parentId)) children.set(n.parentId, []);
      children.get(n.parentId).push(n);
    }
    function visit(n) {
      if (visited.has(n.id)) return;
      visited.add(n.id);
      const list = children.get(n.id) || [];
      list.forEach(visit);
      if (n.type === "group") {
        const b = C.bounds(list);
        if (b) Object.assign(n, b);
      }
    }
    state.nodes.forEach(visit);
  }
  async function reloadFromDisk(discard = false, { targetIds = null, previewSync = false, snapshotUrl = null } = {}) {
    if (!local || boardVersionBusy || (!previewSync && (agentBusy || agentPending))) return false;
    if (previewSync && (editing || dirty || saving)) return false;
    if (saving) await savePromise;
    if (editing || dirty) {
      if (!discard) {
        notice("发现外部更新。你的本机修改已保留。", [{ label: "读取最新版本", run: reloadLatestKeepBackup }]);
        return false;
      }
      finishText();
    }
    try {
      const next = await fetchDiskDocument(snapshotUrl);
      if (previewSync && (editing || dirty || saving)) return false;
      const viewport = clone(state.viewport), previousIds = new Set(state.nodes.map((n) => n.id));
      if (previewSync && snapshotUrl) {
        for (const node of next.nodes) {
          if (node.type === "board" && /^boards\/[a-zA-Z0-9_-]+\/index\.html$/.test(node.src || "") && !state.nodes.some(n => n.id === node.id && n.src === node.src)) {
            boardPreviewUrls.set(node.id, new URL(node.src, new URL(snapshotUrl, location.href)).href);
          }
        }
      }
      state = materialize(next, schemaEnabled || state.schemaVersion === 2);
      baseline = clone(next);
      state.viewport = viewport;
      selected = new Set([...selected].filter((id) => state.nodes.some((n) => n.id === id)));
      if (!previewSync && !selected.size) {
        const added = state.nodes.filter((n) => !previousIds.has(n.id));
        if (added.length) selected = new Set(C.roots(state.nodes, added.map((n) => n.id)).map((n) => n.id));
      }
      if (!state.nodes.some((n) => n.id === groupContext)) groupContext = null;
      dirty = false;
      conflict = false;
      history = [];
      future = [];
      const refreshed = /* @__PURE__ */ new Set();
      if (targetIds) {
        for (const id of C.descendants(state.nodes, targetIds)) {
          let node = state.nodes.find((n) => n.id === id);
          const seen = /* @__PURE__ */ new Set();
          while (node && !seen.has(node.id)) {
            seen.add(node.id);
            if (node.type === "board") refreshed.add(node.id);
            node = state.nodes.find((n) => n.id === node.parentId);
          }
        }
      } else state.nodes.filter((n) => n.type === "board").forEach((n) => refreshed.add(n.id));
      if (!previewSync) for (const id of refreshed) boardStamps.set(id, Date.now());
      panelKey = "";
      render();
      status("已同步");
      $("#notice").hidden = true;
      $("#save-status").classList.remove("error");
      removeStoredValue(draftKey);
      return true;
    } catch (error) {
      notice(error.message, [{ label: "重试", run: () => reloadFromDisk(discard) }]);
      return false;
    }
  }
  async function refreshBoards(boardIds, { snapshotUrl = null } = {}) {
    if (dirty || editing || saving) return false;
    const ids = boardIds == null ? state.nodes.filter(n => n.type === "board").map(n => n.id) : Array.isArray(boardIds) ? state.nodes.filter(n => n.type === "board" && (boardIds.includes(n.id) || boardIds.includes((n.src || "").split("/")[1]))).map(n => n.id) : null;
    if (!Array.isArray(ids)) return false;
    let ok = true;
    for (const id of ids) {
      const node = state.nodes.find(n => n.id === id && n.type === "board");
      if (!node || !/^boards\/[a-zA-Z0-9_-]+\/index\.html$/.test(node.src || "")) continue;
      const old = nodeEls.get(id)?.querySelector("iframe");
      const url = snapshotUrl ? new URL(node.src, new URL(snapshotUrl, location.href)).href : node.src;
      if (snapshotUrl && old && new URL(old.src, location.href).pathname === new URL(url, location.href).pathname) {
        boardPreviewUrls.set(id, url);
        const el = nodeEls.get(id);
        if (el) el.dataset.signature = nodeContentSignature(node);
        continue;
      }
      if (old) {
        const next = old.cloneNode(false);
        next.loading = "eager";
        Object.assign(next.style, { position: "absolute", inset: "0", opacity: "0", pointerEvents: "none" });
        const loaded = await new Promise(resolve => {
          const timer = setTimeout(() => resolve(false), 5000);
          next.onload = () => {
            clearTimeout(timer);
            try { const body = next.contentDocument?.body; resolve(Boolean(body && (body.innerText.trim() || body.querySelector("img,svg,canvas,iframe,input,button")))); }
            catch { resolve(false); }
          };
          next.onerror = () => { clearTimeout(timer); resolve(false); };
          old.after(next); next.src = url + (url.includes("?") ? "&" : "?") + "canvas=" + Date.now();
        });
        if (!loaded || dirty || editing || saving || !old.isConnected) { next.remove(); ok = false; continue; }
        next.onload = next.onerror = null;
        // The replacement keeps the same Escape/annotation behavior as an original board.
        next.addEventListener("load", () => { attachBoardFrameEvents(id, next); restorePinnedBoard(id, next); });
        attachBoardFrameEvents(id, next);
        old.replaceWith(next); next.removeAttribute("style");
      }
      if (snapshotUrl) boardPreviewUrls.set(id, url); else boardPreviewUrls.delete(id);
      const activeFrame = nodeEls.get(id)?.querySelector("iframe");
      if (activeFrame) restorePinnedBoard(id, activeFrame);
      // Mark the rendered signature without rerendering unrelated boards.
      const el = nodeEls.get(id);
      if (el) el.dataset.signature = nodeContentSignature(node);
    }
    return ok;
  }
  function updateFullscreen() {
    const active = Boolean(document.fullscreenElement) || fullscreenFallback;
    decorate($("#fullscreen"), active ? "minimize-2" : "maximize-2", active ? "退出全屏" : "全屏");
    $("#fullscreen").setAttribute("aria-pressed", active);
    view();
  }
  async function toggleFullscreen() {
    if (fullscreenFallback) {
      parent.postMessage({ type: "prota:canvas-fullscreen", active: false }, location.origin);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      if (parent !== window) parent.postMessage({ type: "prota:canvas-fullscreen", active: true }, location.origin);
      else notice("当前环境不支持全屏，请使用浏览器全屏功能。");
    }
  }
  $("#document-name").tabIndex = 0;
  $("#document-name").setAttribute("role", "button");
  $("#document-name").setAttribute("aria-label", "重命名画布");
  function renameCanvas() {
    const label = $("#document-name");
    if (readOnly || parent === window || label.querySelector("input")) return;
    const previous = label.textContent, input = document.createElement("input");
    input.value = previous;
    input.maxLength = 120;
    input.setAttribute("aria-label", "画布名称");
    label.replaceChildren(input);
    input.focus();
    input.select();
    let cancel = false;
    input.onkeydown = (e) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel = true;
        input.blur();
      }
    };
    input.onblur = () => {
      const name = input.value.trim();
      label.textContent = cancel || !name ? previous : name;
      if (!cancel && name && name !== previous) parent.postMessage({ type: "prota:canvas-rename", name, previous, projectId: route?.[1], pageId: route?.[2], version: route?.[3] }, location.origin);
    };
  }
  $("#document-name").onclick = renameCanvas;
  $("#document-name").onkeydown = (e) => {
    if (e.target === $("#document-name") && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      renameCanvas();
    }
  };
  $("#fullscreen").onclick = toggleFullscreen;
  document.addEventListener("fullscreenchange", updateFullscreen);
  window.addEventListener("message", (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const data = e.data || {};
    if (data.type === "prota:canvas-agent-status") agentState(data);
    if (data.type === "prota:canvas-agent-error") notice(data.error);
    if (data.type === "prota:canvas-rename-result") {
      if (data.name) $("#document-name").textContent = data.name;
      if (data.error) notice(data.error);
    }
    if (data.type === "prota:canvas-config") {
      if (data.readOnly && !readOnly) {
        readOnly = true;
        document.body.classList.add("readonly");
        render();
        status("只读分享");
        showShareTip();
      }
      if (data.pageName && !$("#document-name").contains(document.activeElement)) $("#document-name").textContent = data.pageName;
    }
    if (data.type === "prota:canvas-fullscreen-state") {
      fullscreenFallback = Boolean(data.active);
      updateFullscreen();
    }
    // The Portal relays Space held while its own document had focus, so the
    // pan gesture still works after using the agent panel (see setSpace).
    if (data.type === "prota:canvas-key" && data.code === "Space") setSpace(Boolean(data.down));
  });
  // Inspector events born inside the annotated board frame are relayed to the
  // Portal with the board identity attached; only the currently annotated
  // same-origin board frame may speak, never other boards or the editor itself.
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const data = e.data || {};
    if (e.source === parent && data.type === "prota:canvas-annotation-exit") {
      exitBoardAnnotation();
      return;
    }
    if (parent === window || !annotationBoardId) return;
    if (!["readify:element-hover", "readify:element-hover-clear", "readify:element-selected"].includes(data.type)) return;
    const frame = annotationFrameEl || nodeEls.get(annotationBoardId)?.querySelector("iframe");
    if (!frame || e.source !== frame.contentWindow) return;
    const node = state.nodes.find((n) => n.id === annotationBoardId);
    parent.postMessage({ ...data, protaBoardId: boardFolderOf(node), protaBoardPath: node?.src || "", protaAnnotationNodeId: annotationBoardId }, location.origin);
  });
  function saveOnHide() {
    if (readOnly || !dirty) return;
    persistDraft({ announce: false });
    void save({ preserveEditing: true, keepalive: true });
  }
  window.addEventListener("pagehide", saveOnHide);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveOnHide();
  });
  window.addEventListener("online", () => {
    if (dirty && !conflict) void save({ preserveEditing: true });
  });
  window.addEventListener("beforeunload", (e) => {
    // A session copy survives refresh but not closing this browser tab.
    if (dirty && !readOnly && (!persistDraft({ requireLocal: true }) || editing?.prdPath || linkedSavePromise)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  let compactTools = innerWidth < 480;
  new ResizeObserver(() => {
    const compact = innerWidth < 480;
    if (compact !== compactTools) {
      compactTools = compact;
      renderInspector();
    }
    view();
  }).observe(stage);
  try {
    if (parent !== window && parent.shell?.isShareMode) {
      readOnly = true;
      document.body.classList.add("readonly");
    }
  } catch {
  }
  if (!state?.viewport) state.viewport = { x: 120, y: 100, zoom: 1 };
  state.viewport.zoom = Math.max(0.05, Math.min(4, state.viewport.zoom || 1));
  let restoredView = false;
  try {
    const viewport = JSON.parse(sessionStorage.getItem(draftKey + ":view") || "null");
    if (viewport && Number.isFinite(viewport.zoom) && viewport.zoom >= 0.05 && viewport.zoom <= 4) {
      state.viewport = viewport;
      restoredView = true;
    }
  } catch {
  }
  try {
    const draft = JSON.parse(readStoredValue(draftKey) || "null");
    if (draft?.state && !readOnly) {
      C.validate(draft.state);
      C.validate(draft.baseline);
      const sameContent = (a, b) => {
        const { revision: ar, viewport: av, ...ac } = a;
        const { revision: br, viewport: bv, ...bc } = b;
        return JSON.stringify(ac) === JSON.stringify(bc);
      };
      if (sameContent(draft.state, state)) removeStoredValue(draftKey);
      else if (JSON.stringify(draft.baseline) === JSON.stringify(initialDocument)) {
        state = materialize(draft.state, schemaEnabled || state.schemaVersion === 2);
        baseline = clone(draft.baseline);
        changed();
      } else {
        // Independent edits are ordinary recovery, not a conflict backup.
        const useV2 = schemaEnabled || state.schemaVersion === 2 || draft.state.schemaVersion === 2;
        const merged = C.mergeDocuments(materialize(draft.baseline, useV2), materialize(draft.state, useV2), state);
        if (!merged.conflicts.length) {
          state = merged.state;
          baseline = clone(initialDocument);
          changed();
        } else {
          const backup = writeStoredValue(draftKey + ":conflict-backup", JSON.stringify(draft));
          if (!backup.ok) throw backup.error;
          recoveringDraft = true;
          draftRecovery = restoreLocalOverConflict().finally(() => {
            recoveringDraft = false;
            draftRecovery = null;
            render();
          });
        }
      }
    }
  } catch {
  }
  if (!recoveringDraft && $("#notice").hidden) offerConflictBackupRestore();
  if (startupError) {
    document.body.classList.add("readonly");
    $("#empty h1").textContent = "暂时无法打开这张画布";
    $("#empty p").textContent = "布局文件格式有误。原文件已保留，请检查或从备份恢复。";
    notice(startupError.message, [{ label: "刷新重试", run: () => location.reload() }]);
  }
  connections = window.CanvasConnections.install({
    state: () => state, canEdit, blocked: n => effectiveLocked(n) || agentHeld(n), panBy: (dx, dy) => { state.viewport.x += dx; state.viewport.y += dy; persistView(); }, focus: ids => fit(state.nodes.filter(n => ids.includes(n.id)), {animate: true, align: state.focusAlignment || "center"}), tool: () => tool, panning: () => space || tool === "hand",
    mutate: (fn, options) => mutate(() => fn(state), options), setTool,
    clearSelection: () => { selected.clear(); finishText(); exitInteraction(); renderInspector(); updateSelectionFrame(); },
  });
  flowQuick = window.CanvasFlowQuickCreate?.install({
    state: () => state, canEdit, blocked: n => effectiveLocked(n) || agentHeld(n), tool: () => tool, panning: () => space || tool === "hand",
    editing: () => Boolean(editing), annotating: () => Boolean(annotationBoardId), interacting: () => Boolean(interacting),
    selection: () => selected.size === 1 ? state.nodes.find(n => selected.has(n.id)) || null : null,
    multiSelected: id => selected.size > 1 && selected.has(id),
    connectionStyle: () => connections.getDefaultStyle(),
    select: id => { finishText(); groupContext = null; selected = new Set([id]); render(); },
    // One mutate per quick action keeps node and edge in a single undo record.
    mutate: fn => mutate(() => fn(state)),
    insert: (id, at) => at ? insertAt("flow-" + id, at) : insertFlowShape(id),
    worldPoint: point, notice: text => notice(text),
    nudgeViewport: (dx, dy) => { state.viewport.x += dx; state.viewport.y += dy; persistView(); },
  }) || null;
  render();
  if (!restoredView && !readOnly && state.nodes.length) {
    const initial = state.nodes.filter(n => (state.initialFocusNodeIds || []).includes(n.id));
    fit(initial.length ? initial : state.nodes, {align: state.focusAlignment || "center"});
  }
  if (!local) status(readOnly ? "只读分享" : "已暂存在当前浏览器");
  function getBoardFrame(id) {
    const node = state.nodes.find((n) => n.type === "board" && (n.id === id || boardFolderOf(n) === id));
    if (!node) return null;
    const iframe = nodeEls.get(node.id)?.querySelector("iframe") || null;
    return { boardId: boardFolderOf(node), boardPath: node.src || "", nodeId: node.id, iframe };
  }
  window.protaCanvas = { shellFormat: window.__protaCanvasRuntimeManifest ? "shared-v1" : "legacy", runtimeHash: window.__protaCanvasRuntimeManifest?.runtimeHash || null, documentSchema: initialDocument.schemaVersion, runtimeVersion: 63, colorControlVersion: 2, previewSyncVersion: 2, importPrd: (payload, x, y) => dropPrd(payload, point(x, y)), syncPrds, connections: { create: (...args) => connections.add(...args), update: (...args) => connections.update(...args), getRoutes: () => clone(connections.getRoutes()), getSelection: () => connections.getSelection() }, focus: (ids) => fit(state.nodes.filter(n => ids.includes(n.id)), {animate: true, align: state.focusAlignment || "center"}), getBoardFrame, getActiveBoard: () => interacting ? getBoardFrame(interacting) : null, getAnnotationState: () => ({ active: Boolean(annotationBoardId), boardId: annotationBoardId ? boardFolderOf(state.nodes.find(n => n.id === annotationBoardId)) : "", nodeId: annotationBoardId || "" }), enterBoardAnnotation, exitBoardAnnotation, getState: () => clone(state), getSelection: () => [...selected], isDirty: () => dirty, save, prepareNavigation, fit, reloadFromDisk, refreshBoards, agentState, setPreparing(value, targetIds = [...selected]) {
    agentPending = Boolean(value);
    preparingTargets = new Set(value ? targetIds : []);
    for (const [id, el] of nodeEls) el.classList.toggle("agent-target", agentHeld(state.nodes.find(n => n.id === id)));
    panelKey = "";
    renderInspector();
  } };
  syncPrds();
  window.protaCanvasSchemaReady = (async () => {
    if (!local || startupError) return;
    try {
      const response = await fetch("/api/canvas/features", { cache: "no-store", signal: AbortSignal.timeout(2000) });
      if (!response.ok) return;
      const features = await response.json();
      boardVersionsEnabled = features.boardRevisions === true;
      if (features.canvasSchemaV2 !== true) { render(); return; }
      const prepared = materialize(state, true);
      const past = history.map(doc => materialize(doc, true)), next = future.map(doc => materialize(doc, true));
      state = prepared; history = past; future = next; schemaEnabled = true;
      render();
    } catch (error) {
      // Configuration unavailability falls back to v1; invalid migration never replaces state.
      if (!(error instanceof TypeError) && error.name !== "TimeoutError") notice("画布迁移未应用：" + error.message);
    }
  })();
})();
