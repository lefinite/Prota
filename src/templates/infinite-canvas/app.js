(() => {
  "use strict";
  const C = window.CanvasCore;
  const AUTOSAVE_DELAY = 300;
  const $ = (s) => document.querySelector(s), clone = (value) => JSON.parse(JSON.stringify(value));
  let startupError = null;
  try {
    C.validate(window.PROTA_CANVAS);
  } catch (error) {
    startupError = error;
  }
  const initialDocument = startupError ? { schemaVersion: 1, revision: 0, nodes: [], viewport: { x: 100, y: 80, zoom: 1 } } : window.PROTA_CANVAS;
  let state = clone(initialDocument), baseline = clone(state), selected = /* @__PURE__ */ new Set(), history = [], future = [], dirty = false, saving = false, readOnly = Boolean(startupError), space = false, gesture = null, interacting = null;
  const stage = $("#stage"), world = $("#world"), properties = $("#properties");
  let propertyEdit = null, propertiesSelection = "", menuInvoker = null, fullscreenFallback = false, imageInsertionPoint = null, imageReplaceTarget = null, groupContext = null, paletteIndex = 0, paletteItems = [], renderFrame = 0, viewAnim = 0;
  let tool = "select", autoTimer, savePromise = null, conflict = false, agentBusy = false, agentPending = false, clipboard = null, editing = null, panelKey = "";
  const nodeEls = /* @__PURE__ */ new Map(), touches = /* @__PURE__ */ new Map(), boardStamps = /* @__PURE__ */ new Map();
  let agentTargets = /* @__PURE__ */ new Set(), pasteTimer = null;
  const draftKey = "prota-canvas-draft:" + location.pathname, clipboardKey = "prota-canvas-clipboard";
  const effectiveLocked = (n) => C.locked(state.nodes, n);
  const selectedRoots = () => C.roots(state.nodes, selected);
  const movable = () => {
    const roots = selectedRoots().filter((n) => !effectiveLocked(n));
    const ids = C.descendants(state.nodes, roots.map((n) => n.id));
    return state.nodes.filter((n) => ids.has(n.id));
  };
  const canEdit = () => !readOnly && !agentBusy && !agentPending;
  const route = decodeURI(location.pathname).match(/\/src\/pages\/([^/]+)\/([^/]+)\/(v\d+)\//);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && Boolean(route);
  const names = { group: "分组", board: "画板", text: "文本", note: "便签", rect: "矩形", ellipse: "圆形", image: "图片" };
  const uid = () => "n_" + crypto.randomUUID().replaceAll("-", "");
  function status(text, kind = "") {
    const el = $("#save-status");
    el.textContent = text;
    el.classList.toggle("busy", kind === "busy");
    el.classList.toggle("error", kind === "error");
  }
  function checkpoint() {
    history.push(clone(state));
    if (history.length > 60) history.shift();
    future = [];
  }
  function changed({ panels = true } = {}) {
    updateGroupBounds();
    dirty = true;
    status(local ? "等待保存…" : "已暂存在当前浏览器", "busy");
    try {
      localStorage.setItem(draftKey, JSON.stringify({ state, baseline, savedAt: Date.now() }));
    } catch {
      status("恢复备份空间不足，请及时保存", "error");
    }
    render({ panels });
    clearTimeout(autoTimer);
    if (local && !conflict && !agentBusy) autoTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
  }
  function mutate(fn) {
    if (!canEdit()) return;
    checkpoint();
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
    agent: { label: (ctx) => ctx.single?.type === "board" && !ctx.single.src ? "Agent 生成" : "Agent 修改", icon: "sparkles", agent: true, when: (ctx) => !readOnly && !ctx.nodes.some(effectiveLocked), disabled: () => agentBusy, run: () => focusAgent() },
    "edit-text": { label: "编辑文字", icon: "pen-line", shortcut: "双击", when: (ctx) => ctx.single && ["text", "note"].includes(ctx.single.type) && ctx.editable, run: (ctx) => startText(ctx.single.id) },
    style: { label: "样式", icon: "sliders-horizontal", when: (ctx) => ctx.single && ["text", "note", "rect", "ellipse"].includes(ctx.single.type) && ctx.editable, run: () => openProperties() },
    fill: { label: "填充", icon: "paint-bucket", when: (ctx) => ctx.single && ["rect", "ellipse"].includes(ctx.single.type) && ctx.editable, run: () => openProperties("填充") },
    color: { label: "颜色", icon: "paint-bucket", when: (ctx) => ctx.single?.type === "note" && ctx.editable, run: () => openProperties("便签颜色 #fff1b8") },
    replace: { label: "替换", icon: "replace", when: (ctx) => ctx.single?.type === "image" && ctx.editable, run: (ctx) => {
      imageReplaceTarget = ctx.single.id;
      $("#image-input").click();
    } },
    "fit-image": { label: "适应比例", icon: "crop", when: (ctx) => ctx.single?.type === "image" && ctx.editable, run: (ctx) => fitImageRatio(ctx.single) },
    preview: { label: "预览", icon: "play", shortcut: "双击", when: (ctx) => ctx.single?.type === "board" && ctx.single.src, run: (ctx) => previewBoard(ctx.single) },
    adjust: { label: "调整", icon: "sliders-horizontal", when: (ctx) => ctx.editable && ctx.single, run: () => openProperties() },
    rename: { label: "重命名", icon: "pencil", shortcut: "F2", when: (ctx) => ctx.editable && ctx.single, run: () => focusName() },
    group: { label: "编组", icon: "group", shortcut: "⌘ G", when: (ctx) => ctx.editable && ctx.roots > 1, run: () => groupSelection() },
    ungroup: { label: "取消编组", icon: "ungroup", shortcut: "⌘ ⇧ G", when: (ctx) => ctx.editable && ctx.nodes.length > 0 && ctx.nodes.every((n) => n.type === "group"), run: () => ungroupSelection() },
    align: { label: "对齐", icon: "align-start-vertical", when: (ctx) => ctx.editable && ctx.roots > 1, run: (_, rect) => {
      const r = rect || $("#selection-tools").getBoundingClientRect();
      showMenu(alignmentActions(), r.left, r.bottom + 6);
    } },
    duplicate: { label: "复制", icon: "copy", shortcut: "⌘ D", when: (ctx) => ctx.editable, run: () => duplicateSelection() },
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
  function actionContext() {
    const nodes = current(), single = nodes.length === 1 ? nodes[0] : null;
    return { nodes, single, roots: selectedRoots().length, editable: canEdit() && nodes.length > 0 && nodes.every((n) => !effectiveLocked(n)) };
  }
  function resolveAction(id) {
    const def = actions[id], ctx = actionContext();
    if (!def || !def.when(ctx)) return null;
    return { id, label: typeof def.label === "function" ? def.label(ctx) : def.label, icon: def.icon, shortcut: def.shortcut, agent: def.agent, danger: def.danger, disabled: def.disabled?.() || false, run: (event, rect) => def.run(ctx, rect) };
  }
  function contextActions() {
    const ctx = actionContext();
    if (!ctx.nodes.length) return { primary: [], more: [] };
    const primary = [], more = [];
    const push = (list, id) => {
      const action = resolveAction(id);
      if (action) list.push(action);
    };
    if (ctx.nodes.some(effectiveLocked)) {
      push(primary, "unlock");
      push(primary, "focus");
      return { primary, more };
    }
    if (ctx.single?.type === "board" && !ctx.single.src) {
      push(primary, "agent");
      push(primary, "adjust");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "board") {
      push(primary, "preview");
      push(primary, "agent");
      push(primary, "adjust");
      push(primary, "duplicate");
    } else if (ctx.single && ["text", "note"].includes(ctx.single.type)) {
      push(primary, "edit-text");
      push(primary, ctx.single.type === "note" ? "color" : "style");
      push(primary, "agent");
      push(primary, "duplicate");
    } else if (ctx.single && ["rect", "ellipse"].includes(ctx.single.type)) {
      push(primary, "fill");
      push(primary, "style");
      push(primary, "agent");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "image") {
      push(primary, "replace");
      push(primary, "agent");
      push(primary, "duplicate");
    } else if (ctx.single?.type === "group") {
      push(primary, "rename");
      push(primary, "ungroup");
      push(primary, "agent");
      push(primary, "duplicate");
    } else if (ctx.roots > 1) {
      push(primary, "group");
      push(primary, "align");
      push(primary, "agent");
      push(primary, "duplicate");
    } else {
      push(primary, "agent");
      push(primary, "adjust");
      push(primary, "duplicate");
    }
    for (const id of ["rename", "enter-group", "preview", "fit-image", "front", "back", "detach", "select-parent", "focus", "lock", "delete"]) {
      const action = resolveAction(id);
      if (action && !primary.some((p) => p.id === id)) more.push(action);
    }
    return { primary, more };
  }
  function runAction(id, event, rect) {
    const action = resolveAction(id);
    if (!action || action.disabled) {
      notice(current().some(effectiveLocked) ? "对象已锁定，请先解锁。" : agentBusy ? "Agent 正在处理，完成后可继续编辑。" : "请先选择适用的对象。");
      return false;
    }
    $("#context-menu").hidden = true;
    action.run(event, rect);
    return true;
  }
  function actionButton(action, menu = false) {
    const button = document.createElement("button");
    decorate(button, action.icon, action.label);
    button.dataset.action = action.id;
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
      $("#context-menu").hidden = true;
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
    positionSelectionTools();
  }
  function notify() {
    if (window.parent !== window) window.parent.postMessage({ type: "prota:canvas-selection", selected: current().map((n) => ({ id: n.id, name: n.name, type: n.type, src: n.src || "", parentId: n.parentId || null, bounds: { x: n.x, y: n.y, width: n.width, height: n.height }, attributes: { text: String(n.text || "").slice(0, 1e3), color: n.color || "", fontSize: n.fontSize || 20, locked: effectiveLocked(n) } })), dirty, runtimeVersion: 4 }, location.origin === "null" ? "*" : location.origin);
  }
  function exitInteraction() {
    interacting = null;
    document.querySelectorAll(".interacting").forEach((n) => n.classList.remove("interacting"));
    $("#interaction-hint").textContent = "";
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
      el.className = `node ${n.type}${selected.has(n.id) ? " selected" : ""}${effectiveLocked(n) ? " locked" : ""}${interacting === n.id ? " interacting" : ""}${n.hidden ? " hidden-node" : ""}${editing?.id === n.id ? " editing" : ""}${agentTargets.has(n.id) ? " agent-target" : ""}${n.id === groupContext ? " context" : ""}${contextMembers && !contextMembers.has(n.id) ? " dimmed" : ""}`;
      Object.assign(el.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px`, background: n.color || "", fontSize: `${n.fontSize || 20}px`, opacity: n.opacity ?? 1, borderRadius: n.type === "ellipse" ? "50%" : `${n.radius || 0}px`, color: n.textColor || "#30323a", fontWeight: n.fontWeight || 400, textAlign: n.textAlign || "left" });
      const signature = JSON.stringify([n.type, n.type === "board" ? "" : n.text, n.src, n.type === "board" ? boardStamps.get(n.id) || 0 : 0]);
      if (el.dataset.signature !== signature && editing?.id !== n.id) {
        el.dataset.signature = signature;
        el.replaceChildren();
        const title = document.createElement("div");
        title.className = "node-title";
        title.textContent = n.name;
        el.append(title);
        const content = document.createElement("div");
        content.className = "node-content";
        el.append(content);
        if (n.type === "board") {
          if (/^boards\/[a-zA-Z0-9_-]+\/index\.html$/.test(n.src || "")) {
            const frame = document.createElement("iframe");
            const stamp = boardStamps.get(n.id) || 0;
            frame.src = n.src + (stamp ? "?canvas=" + stamp : "");
            frame.title = n.name;
            frame.loading = "lazy";
            frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin");
            content.append(frame);
            el.classList.add("loading");
            frame.addEventListener("load", () => {
              el.classList.remove("loading");
              try {
                frame.contentDocument.addEventListener("keydown", (e) => {
                  if (e.key === "Escape") {
                    $("#property-popover").hidden = true;
                    e.preventDefault();
                    e.stopPropagation();
                    exitInteraction();
                    stage.focus();
                  }
                });
              } catch {
              }
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
        } else content.textContent = n.text || "";
      }
      const inner = el.querySelector(".node-content");
      if (inner && n.padding !== void 0) inner.style.padding = n.padding + "px";
      const placeholder = el.querySelector(".board-placeholder");
      if (placeholder) placeholder.hidden = state.nodes.some((child) => child.parentId === n.id);
      el.querySelector(".node-title").textContent = n.name;
      if (world.children[index] !== el) world.insertBefore(el, world.children[index] || null);
    }
    previous.forEach((el) => {
      nodeEls.delete(el.dataset.id);
      el.remove();
    });
    world.append($("#selection-frame"));
    $("#empty").hidden = state.nodes.length > 0;
    $("#undo").disabled = !history.length;
    $("#redo").disabled = !future.length;
    if (panels) renderInspector();
    view();
    notify();
  }
  function updatePositions(ids) {
    for (const id of ids) {
      const n = state.nodes.find((item) => item.id === id), el = nodeEls.get(id);
      if (!n || !el) continue;
      Object.assign(el.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px` });
    }
    updateSelectionFrame();
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
    const { primary, more } = contextActions();
    if (innerWidth < 480 && primary.length > 3) more.unshift(...primary.splice(3));
    primary.forEach((action) => {
      if (action.agent) {
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
        showMenu(more, r.left, r.bottom + 6);
      } }));
    }
    if (propertiesSelection !== [...selected].join(",")) {
      propertyEdit = null;
      $("#property-popover").hidden = true;
      propertiesSelection = [...selected].join(",");
    }
    if (!$("#property-popover").hidden && signature !== panelKey && !properties.contains(document.activeElement)) renderProperties();
    panelKey = signature;
    positionSelectionTools();
  }
  const boardPresets = [["", "自定义尺寸"], ["390x844", "iPhone 390 × 844"], ["412x915", "Android 412 × 915"], ["834x1194", "平板 834 × 1194"], ["1440x900", "Web 1440 × 900"]];
  const noteSwatches = ["#fff1b8", "#ffd9d2", "#d4ecec", "#dde6ff", "#f0ddff", "#ffffff"];
  function renderProperties(focusLabel = "") {
    const n = current()[0];
    properties.replaceChildren();
    if (!n || current().length !== 1) return;
    $("#property-title").textContent = n.name || names[n.type];
    if (n.type === "note" && canEdit() && !effectiveLocked(n)) {
      const row = document.createElement("div");
      row.className = "swatch-row";
      for (const color of noteSwatches) {
        const swatch = document.createElement("button");
        swatch.className = "swatch";
        swatch.style.background = color;
        swatch.setAttribute("aria-label", "便签颜色 " + color);
        swatch.setAttribute("aria-pressed", (n.color || "") === color);
        swatch.onclick = () => mutate(() => {
          n.color = color;
        });
        row.append(swatch);
      }
      properties.append(row);
    }
    let fields = [["name", "名称", "text"], ["x", "X", "number"], ["y", "Y", "number"], ["width", "宽", "number"], ["height", "高", "number"], ["color", "填充", "color"], ["opacity", "不透明度", "number"], ["radius", "圆角", "number"]];
    if (n.type === "group") fields = fields.filter(([key]) => ["name", "x", "y"].includes(key));
    if (n.type === "ellipse") fields = fields.filter(([key]) => key !== "radius");
    if (n.type === "text") fields = fields.filter(([key]) => !["color", "radius"].includes(key));
    if (n.type === "image" || n.type === "board") fields = fields.filter(([key]) => key !== "color" && key !== "radius");
    if (["text", "note", "rect", "ellipse"].includes(n.type)) fields.push(["text", "内容", "textarea"], ["fontSize", "字号", "number"], ["textColor", "文字颜色", "color"]);
    if (n.type === "board") {
      const row = document.createElement("label");
      row.textContent = "设备预设";
      const select = document.createElement("select");
      for (const [value, label] of boardPresets) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = boardPresets.find(([value]) => value === `${n.width}x${n.height}`)?.[0] ?? "";
      select.disabled = !canEdit() || effectiveLocked(n);
      select.onchange = () => {
        const [width, height] = select.value.split("x").map(Number);
        if (!width) return;
        mutate(() => {
          n.width = width;
          n.height = height;
        });
      };
      row.append(select);
      properties.append(row);
    }
    for (const [key, label, type] of fields) {
      const row = document.createElement("label");
      row.textContent = label;
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      input.value = n[key] ?? (key === "color" ? "#ffffff" : key === "textColor" ? "#424650" : key === "opacity" ? 1 : key === "radius" ? 0 : "");
      input.setAttribute("aria-label", label);
      input.disabled = !canEdit() || effectiveLocked(n);
      if (key === "opacity") {
        input.min = 0;
        input.max = 1;
        input.step = 0.1;
      }
      row.append(input);
      properties.append(row);
      const applyValue = () => {
        let value = input.value;
        if (type === "number") {
          if (value.trim() === "") return;
          value = Number(value);
          if (!Number.isFinite(value) || Math.abs(value) > 1e6) return;
          if (["width", "height"].includes(key)) value = Math.max(16, value);
          if (key === "fontSize") value = Math.max(8, Math.min(400, value));
          if (key === "opacity") value = Math.max(0, Math.min(1, value));
          if (key === "radius") value = Math.max(0, Math.min(1e3, value));
        }
        if (!canEdit() || effectiveLocked(n) || n[key] === value) return;
        if (!propertyEdit || propertyEdit.node !== n.id || propertyEdit.key !== key) {
          checkpoint();
          propertyEdit = { node: n.id, key };
        }
        if (key === "x" || key === "y") {
          const delta = value - n[key], ids = C.descendants(state.nodes, [n.id]);
          state.nodes.filter((item) => ids.has(item.id)).forEach((item) => item[key] += delta);
        } else n[key] = value;
        changed({ panels: false });
      };
      input.addEventListener("input", applyValue);
      input.addEventListener("change", () => {
        applyValue();
        propertyEdit = null;
      });
    }
    if (["text", "note"].includes(n.type) && canEdit() && !effectiveLocked(n)) {
      const section = document.createElement("details");
      section.className = "property-section";
      const summary = document.createElement("summary");
      summary.textContent = "排版";
      section.append(summary);
      for (const [key, label, options] of [["fontWeight", "字重", [[400, "常规"], [500, "中等"], [600, "半粗"], [700, "加粗"]]], ["textAlign", "对齐", [["left", "左对齐"], ["center", "居中"], ["right", "右对齐"]]]]) {
        const row = document.createElement("label");
        row.textContent = label;
        const select = document.createElement("select");
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
        row.append(select);
        section.append(row);
      }
      properties.append(section);
    }
    if (focusLabel) properties.querySelector(`[aria-label="${focusLabel}"]`)?.focus();
  }
  function openProperties(focusLabel = "") {
    finishText();
    propertiesSelection = [...selected].join(",");
    renderProperties(focusLabel);
    const popover = $("#property-popover");
    popover.hidden = false;
    $("#context-menu").hidden = true;
    const anchor = screenSelection();
    const position = C.placeOverlay({ anchor, width: popover.offsetWidth, height: popover.offsetHeight, viewport: { width: innerWidth, height: innerHeight }, obstacles: overlayObstacles(["#selection-tools"]), placement: "popover" });
    popover.style.left = position.x + "px";
    popover.style.top = position.y + "px";
  }
  function focusName() {
    if (current().length !== 1) return;
    openProperties();
    const input = properties.querySelector('[aria-label="名称"]');
    input?.focus();
    input?.select();
  }
  function add(kind, at) {
    if (!canEdit()) return;
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
      selected = new Set(copied.selected);
    });
  }
  function removeSelection() {
    mutate(() => {
      const ids = C.descendants(state.nodes, selectedRoots().filter((n) => !effectiveLocked(n)).map((n) => n.id));
      state.nodes = state.nodes.filter((n) => !ids.has(n.id));
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
    exitInteraction();
    const el = nodeEls.get(n.id);
    if (!el?.querySelector("iframe")) return;
    interacting = n.id;
    el.classList.add("interacting");
    $("#interaction-hint").textContent = "预览中 · Esc 返回画布";
    el.querySelector("iframe").focus();
    positionSelectionTools();
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
  function zoom(factor, x = stage.clientWidth / 2, y = stage.clientHeight / 2, animate = false) {
    exitInteraction();
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
    exitInteraction();
    const v = state.viewport, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2;
    animateView({ zoom: z, x: cx - (cx - v.x) * z / v.zoom, y: cy - (cy - v.y) * z / v.zoom }, 190, () => {
      if (!readOnly) persistView();
    });
  }
  function fit(nodes = state.nodes, { animate = false } = {}) {
    nodes = nodes.filter((n) => !n.hidden);
    if (!nodes.length) return;
    exitInteraction();
    const left = Math.min(...nodes.map((n) => n.x)), top = Math.min(...nodes.map((n) => n.y)), right = Math.max(...nodes.map((n) => n.x + n.width)), bottom = Math.max(...nodes.map((n) => n.y + n.height));
    const z = Math.max(0.05, Math.min(1.5, (stage.clientWidth - 100) / (right - left), (stage.clientHeight - 100) / (bottom - top)));
    const target = { x: (stage.clientWidth - (right - left) * z) / 2 - left * z, y: (stage.clientHeight - (bottom - top) * z) / 2 - top * z, zoom: z };
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
    const revision = state.revision;
    state = from.pop();
    state.revision = revision;
    selected.clear();
    groupContext = null;
    changed();
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.button === 2 || e.target.closest("button,.floating,#selection-tools") || e.target.closest(".interacting") || e.target.isContentEditable) return;
    stopViewAnimation();
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
    $("#context-menu").hidden = true;
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
      const base = C.bounds(selectedRoots().filter((item) => !effectiveLocked(item)));
      if (base && items.length) gesture = { kind: "scale", handle: handleEl.dataset.handle, base, items, start: p };
    } else if (tool !== "select" && canEdit()) {
      const beforeDraw = { preState: clone(state), preSelection: [...selected], historyLength: history.length, preFuture: future.slice(), wasDirty: dirty };
      const made = add(tool, p);
      if (made) {
        made.x = p.x;
        made.y = p.y;
        made.width = 16;
        made.height = 16;
        gesture = { kind: "draw", id: made.id, start: p, started: true, ...beforeDraw };
        render();
      }
      setTool("select");
    } else if (n) {
      if (e.shiftKey) {
        selected.has(n.id) ? selected.delete(n.id) : selected.add(n.id);
      } else if (!selected.has(n.id)) {
        selected = /* @__PURE__ */ new Set([n.id]);
        groupContext = null;
      }
      render();
      if (canEdit() && !effectiveLocked(n) && selected.size) {
        gesture = { kind: "move", start: p, pendingAlt: e.altKey, nodes: movable().map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })), started: false };
        if (!e.shiftKey && selected.size > 1) gesture.clickTarget = n.id;
      }
    } else {
      if (!e.shiftKey) selected.clear();
      gesture = { kind: "select", preSelection: priorSelection, start: p, selected: new Set(selected), cx: e.clientX, cy: e.clientY };
      render();
    }
    if (gesture) {
      gesture.pointerId = e.pointerId;
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
      n.height = Math.max(16, Math.abs(p.y - g.start.y));
      updatePositions([g.id]);
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
      for (const n of state.nodes) if (!n.parentId && !effectiveLocked(n) && !n.hidden && n.x <= Math.max(p.x, g.start.x) && n.x + n.width >= Math.min(p.x, g.start.x) && n.y <= Math.max(p.y, g.start.y) && n.y + n.height >= Math.min(p.y, g.start.y)) selected.add(n.id);
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
      for (const next of transformed) Object.assign(map.get(next.id), next);
      updatePositions(g.items.map((n) => n.id));
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
      try {
        localStorage.setItem(draftKey, JSON.stringify({ state, baseline, savedAt: Date.now() }));
      } catch {
      }
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
    } else {
      clearTimeout(autoTimer);
      try {
        localStorage.removeItem(draftKey);
      } catch {
      }
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
    } else if (g && ["scale", "move", "draw"].includes(g.kind)) render();
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
    const el = e.target.closest(".node"), n = state.nodes.find((n2) => n2.id === el?.dataset.id);
    if (!n) return;
    if (n.type === "board" && el.querySelector("iframe")) {
      interacting = n.id;
      el.classList.add("interacting");
      $("#interaction-hint").textContent = "预览中 · Esc 返回";
      el.querySelector("iframe").focus();
    } else if (n.type === "board") {
      selected = /* @__PURE__ */ new Set([n.id]);
      render();
      focusAgent();
    } else if (n.type === "group") enterGroup(n);
    else if (canEdit() && !effectiveLocked(n) && ["text", "note"].includes(n.type)) startText(n.id);
  });
  stage.addEventListener("wheel", (e) => {
    if (e.target.closest(".interacting")) return;
    e.preventDefault();
    stopViewAnimation();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoom(Math.exp(-e.deltaY * 8e-3), e.clientX - r.left, e.clientY - r.top);
    else {
      state.viewport.x -= e.deltaX;
      state.viewport.y -= e.deltaY;
      view();
      if (!readOnly) persistView();
    }
  }, { passive: false });
  document.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") {
      if (!$("#command-palette").hidden) {
        closePalette();
        return;
      }
      if (!$("#context-menu").hidden) {
        $("#context-menu").hidden = true;
        menuInvoker?.focus?.();
        return;
      }
      if (!$("#property-popover").hidden) {
        $("#property-popover").hidden = true;
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
      $("#property-popover").hidden = true;
      if (selected.size) {
        selected.clear();
        render();
      }
      stage.focus();
      return;
    }
    if (e.target.matches("input,textarea,select") || e.target.isContentEditable) return;
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
      e.preventDefault();
      copySelection();
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
    if (!mod && { v: 1, h: 1, t: 1, r: 1, o: 1, f: 1 }[e.key.toLowerCase()]) {
      setTool({ v: "select", h: "hand", t: "text", r: "rect", o: "ellipse", f: "board" }[e.key.toLowerCase()]);
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      runAction("rename");
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      space = true;
      stage.classList.add("space");
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
    if (e.code === "Space") {
      space = false;
      stage.classList.remove("space");
    }
  });
  window.addEventListener("blur", () => {
    space = false;
    stage.classList.remove("space");
    cancelGesture();
  });
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
  function startText(id) {
    if (!canEdit()) return;
    finishText();
    $("#property-popover").hidden = true;
    $("#context-menu").hidden = true;
    const n = state.nodes.find((n2) => n2.id === id);
    if (!n || effectiveLocked(n)) return;
    selected = /* @__PURE__ */ new Set([id]);
    render();
    const el = nodeEls.get(id)?.querySelector(".node-content");
    if (!el) return;
    checkpoint();
    editing = { id, original: n.text || "", historyLength: history.length - 1, composing: false };
    el.contentEditable = "true";
    el.spellcheck = false;
    el.parentElement.classList.add("editing");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.onblur = () => finishText();
    el.oncompositionstart = () => {
      if (editing) editing.composing = true;
    };
    el.oncompositionend = () => {
      if (editing) editing.composing = false;
    };
    el.oninput = () => {
      n.text = el.innerText;
      dirty = true;
      status("等待保存…", "busy");
      try {
        localStorage.setItem(draftKey, JSON.stringify({ state, baseline, savedAt: Date.now() }));
      } catch {
      }
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
    };
    positionSelectionTools();
  }
  function finishText(cancel = false) {
    if (!editing) return;
    const edit = editing;
    editing = null;
    clearTimeout(autoTimer);
    const n = state.nodes.find((item) => item.id === edit.id), el = nodeEls.get(edit.id)?.querySelector(".node-content");
    if (el) {
      el.onblur = null;
      el.oninput = null;
      el.oncompositionstart = null;
      el.oncompositionend = null;
      el.contentEditable = "false";
    }
    if (!n) return;
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
      try {
        localStorage.removeItem(draftKey);
      } catch {
      }
      status("已保存");
      render();
    }
  }
  function copySelection() {
    if (!selected.size) return;
    clipboard = { nodes: clone(state.nodes.filter((n) => C.descendants(state.nodes, selected).has(n.id))), selected: [...selected], sourcePath: location.pathname };
    try {
      localStorage.setItem(clipboardKey, JSON.stringify({ ...clipboard, at: Date.now() }));
    } catch {
    }
    notice("已复制 " + selected.size + " 个对象");
    setTimeout(() => {
      if ($("#notice-text").textContent.startsWith("已复制")) $("#notice").hidden = true;
    }, 1800);
  }
  function loadClipboard() {
    try {
      const stored = JSON.parse(localStorage.getItem(clipboardKey) || "null");
      if (stored?.nodes?.length) clipboard = { nodes: clone(stored.nodes), selected: clone(stored.selected), sourcePath: stored.sourcePath };
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
      let target = at;
      if (!target && source.sourcePath !== location.pathname) target = point(innerWidth / 2, innerHeight / 2);
      if (target) {
        const b = C.bounds(C.roots(copies.nodes, copies.selected)), dx = target.x - b.x - b.width / 2, dy = target.y - b.y - b.height / 2;
        for (const n of copies.nodes) {
          n.x += dx;
          n.y += dy;
        }
      }
      state.nodes.push(...copies.nodes);
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
  stage.addEventListener("dragover", (e) => e.preventDefault());
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    images(e.dataTransfer.files, point(e.clientX, e.clientY)).catch(() => status("图片读取失败", "error"));
  });
  document.addEventListener("paste", (e) => {
    if (e.target.matches("input,textarea") || e.target.isContentEditable) return;
    clearTimeout(pasteTimer);
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      images(files).catch(() => status("图片读取失败", "error"));
    } else if (pasteSelection()) e.preventDefault();
  });
  async function save({ preserveEditing = false } = {}) {
    clearTimeout(autoTimer);
    if (gesture) {
      autoTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
      return false;
    }
    if (preserveEditing && editing?.composing) {
      autoTimer = setTimeout(() => save({ preserveEditing: true }), AUTOSAVE_DELAY);
      return false;
    }
    if (!preserveEditing) finishText();
    if (readOnly) return false;
    if (savePromise) {
      await savePromise;
      return dirty && !conflict ? save({ preserveEditing }) : !dirty;
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
        const response = await fetch("/api/canvas/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: route[1], pageId: route[2], version: route[3], revision: baseline.revision, baseline: original, state: snapshot }) });
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
        snapshot.revision = result.revision;
        state.revision = result.revision;
        baseline = clone(snapshot);
        conflict = false;
        if (!dirty) {
          try {
            localStorage.removeItem(draftKey);
          } catch {
          }
          $("#notice").hidden = true;
        }
        status(dirty ? "有新的修改待保存" : "已保存", dirty ? "busy" : "");
        notify();
        return true;
      } catch (error) {
        status(conflict ? "保存冲突" : "保存失败 · 已保留本机备份", "error");
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
        if (dirty && !conflict && JSON.stringify(state) !== JSON.stringify(snapshot)) autoTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
      }
    })();
    return savePromise;
  }
  function backupLocal() {
    try {
      localStorage.setItem(draftKey + ":conflict-backup", JSON.stringify({ state, baseline, savedAt: Date.now() }));
    } catch {
      notice("本机备份空间不足，当前修改仍保留在画布中。");
      throw Error("无法备份当前修改");
    }
  }
  async function fetchDiskDocument() {
    const response = await fetch("./canvas-data.js?fresh=" + Date.now(), { cache: "no-store" });
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
      const backup = JSON.parse(localStorage.getItem(draftKey + ":conflict-backup") || "null");
      if (!backup?.state) throw Error("未找到本机备份");
      const disk = await fetchDiskDocument();
      C.validate(backup.state);
      const merged = C.mergeDocuments(backup.baseline || baseline, backup.state, disk);
      const apply = () => {
        checkpoint();
        try {
          localStorage.setItem(draftKey + ":conflict-backup", JSON.stringify({ ...backup, disk }));
        } catch {
        }
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
  function offerConflictBackupRestore() {
    try {
      const backup = JSON.parse(localStorage.getItem(draftKey + ":conflict-backup") || "null");
      if (!backup?.state) return;
      const at = new Date(backup.savedAt || Date.now());
      const time = `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
      notice(`冲突前的本机修改已备份（${time}）`, [{ label: "恢复备份", primary: true, run: restoreLocalOverConflict }]);
    } catch {
    }
  }
  async function focusAgent() {
    if (readOnly) return;
    finishText();
    if (parent === window) {
      notice("请在 Prota 中使用当前 Agent。");
      return;
    }
    if (dirty && !await save()) {
      notice("更改还未写入本地，请先处理保存提示。");
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    if (fullscreenFallback) parent.postMessage({ type: "prota:canvas-fullscreen", active: false }, location.origin);
    parent.postMessage({ type: "prota:canvas-open-agent" }, location.origin);
  }
  function agentState(data) {
    const wasBusy = agentBusy, previousTargets = [...agentTargets];
    agentTargets = new Set(data.active ? data.targetIds || [] : []);
    for (const [id, el] of nodeEls) el.classList.toggle("agent-target", agentTargets.has(id));
    if (data.active || wasBusy) agentPending = false;
    agentBusy = Boolean(data.active);
    document.body.classList.toggle("agent-working", agentBusy);
    if (agentBusy) status("Agent 正在修改", "busy");
    else if (wasBusy) {
      if (data.error) notice("任务未完成，可在当前 Agent 中查看详情。");
      reloadFromDisk(false, { targetIds: previousTargets.length ? previousTargets : null });
    }
    document.querySelectorAll("#add-board,#add-shape,#add-note,#add-component,#image,#first-board,#ask-agent,[data-tool]:not([data-tool=select]):not([data-tool=hand])").forEach((button) => button.disabled = agentBusy || readOnly);
    renderInspector();
  }
  function placeFloating(element, x, y) {
    element.hidden = false;
    const w = element.offsetWidth, h = element.offsetHeight;
    element.style.left = Math.max(10, Math.min(innerWidth - w - 10, x)) + "px";
    element.style.top = Math.max(10, Math.min(innerHeight - h - 10, y)) + "px";
  }
  function showMenu(items, x, y, invoker = document.activeElement) {
    if (!invoker || invoker === document.body) invoker = stage;
    closePalette();
    $("#property-popover").hidden = true;
    const menu = $("#context-menu");
    menu.replaceChildren();
    menuInvoker = invoker;
    for (const item of items) {
      if (item.divider) {
        const divider = document.createElement("div");
        divider.className = "menu-divider";
        menu.append(divider);
      } else if (item.heading) {
        const heading = document.createElement("div");
        heading.className = "menu-section";
        heading.textContent = item.heading;
        menu.append(heading);
      } else menu.append(actionButton(item, true));
    }
    placeFloating(menu, x, y);
    menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
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
    const defs = [["mobile", "手机画板", "frame", "boards"], ["web", "Web 画板", "frame", "boards"], ["board", "自由画板", "frame", "boards"], ["text", "文本", "type", "content"], ["note", "便签", "sticky-note", "content"], ["rect", "矩形", "shapes", "shapes"], ["ellipse", "圆形", "shapes", "shapes"], ["image", "图片", "image-plus", "content"], ["component-button", "按钮组件", "component", "components"], ["component-input", "输入框组件", "component", "components"], ["component-card", "信息卡组件", "component", "components"], ["component-nav", "导航栏组件", "component", "components"]];
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
    showMenu(creationActions(null, category), r.left, Math.max(10, r.top - 300), button);
  }
  $("#add-board").onclick = (e) => openCreateMenu(e.currentTarget, "boards");
  $("#add-shape").onclick = (e) => openCreateMenu(e.currentTarget, "shapes");
  $("#add-component").onclick = (e) => openCreateMenu(e.currentTarget, "components");
  $("#more-tools").onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    showMenu(creationActions().filter((a) => ["add-note", "add-image"].includes(a.id) || a.id.startsWith("add-component")), rect.left, rect.top - 300, e.currentTarget);
  };
  $("#add-note").onclick = () => add("note");
  $("#ask-agent").onclick = focusAgent;
  $("#empty-agent").onclick = focusAgent;
  $("#close-properties").onclick = () => {
    $("#property-popover").hidden = true;
    stage.focus();
  };
  $("#notice-dismiss").onclick = () => $("#notice").hidden = true;
  document.querySelectorAll("[data-tool]").forEach((button) => button.onclick = () => {
    finishText();
    exitInteraction();
    setTool(button.dataset.tool);
    $("#property-popover").hidden = true;
  });
  stage.addEventListener("contextmenu", (e) => {
    if (e.target.isContentEditable || e.target.closest("#property-popover,#selection-tools,.floating")) return;
    e.preventDefault();
    finishText();
    exitInteraction();
    const el = e.target.closest(".node");
    if (el) {
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
      if (board && !e.target.closest(".node-title") && !effectiveLocked(board) && canEdit()) {
        const at = point(e.clientX, e.clientY);
        items.push({ divider: true }, { heading: "添加到此画板" }, ...creationActions(at).filter((a) => ["add-text", "add-note", "add-rect", "add-ellipse", "add-image"].includes(a.id)));
      }
      showMenu(items, e.clientX, e.clientY);
    } else {
      selected.clear();
      groupContext = null;
      render();
      const at = point(e.clientX, e.clientY);
      showMenu([
        { heading: "添加到这里" },
        { id: "add-board", label: "画板", icon: "frame", disabled: !canEdit(), run: () => showMenu(creationActions(at, "boards"), e.clientX, e.clientY) },
        ...creationActions(at).filter((a) => !["add-mobile", "add-web", "add-board"].includes(a.id) && !a.id.startsWith("add-component")),
        { divider: true },
        { id: "paste", label: "粘贴", icon: "clipboard-paste", shortcut: "⌘ V", disabled: !loadClipboard() || !canEdit(), run: () => pasteSelection(at) },
        { divider: true },
        { id: "fit", label: "查看全部", icon: "scan", run: () => fit(void 0, { animate: true }) }
      ], e.clientX, e.clientY);
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#context-menu") && !e.target.closest("[aria-haspopup=menu]") && !e.target.closest("#command-palette")) $("#context-menu").hidden = true;
    if (!e.target.closest("#property-popover") && !e.target.closest("#selection-tools")) $("#property-popover").hidden = true;
  });
  $("#context-menu").addEventListener("keydown", (e) => {
    const buttons = [...$("#context-menu").querySelectorAll("button:not(:disabled)")], index = buttons.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      $("#context-menu").hidden = true;
      menuInvoker?.focus?.();
    }
  });
  function paletteCommands() {
    const list = [];
    const push = (label, icon, shortcut, run, id) => list.push({ id: id || "cmd-" + label, label, icon, shortcut, run });
    for (const action of creationActions(null).filter((a) => a.id !== "add-image" && !a.disabled)) push(action.label, action.icon, "", action.run, action.id);
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
    if (!readOnly && localStorage.getItem(draftKey + ":conflict-backup")) push("恢复冲突前的本机备份", "undo-2", "", restoreLocalOverConflict);
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
    $("#command-palette").hidden = false;
    paletteIndex = 0;
    $("#command-input").value = "";
    renderPalette();
    $("#command-input").focus();
  }
  function closePalette() {
    if ($("#command-palette").hidden) return;
    $("#command-palette").hidden = true;
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
    return [".canvas-identity", ".view-tools", ".creation-tools", ".zoom-tools", "#notice", ...extra].map((selector) => $(selector)).filter((el) => el && !el.hidden).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10 };
    });
  }
  function positionSelectionTools() {
    const box = $("#selection-tools");
    if (!current().length || editing || gesture || interacting) {
      box.hidden = true;
      return;
    }
    const anchor = screenSelection();
    if (!anchor) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const pos = C.placeOverlay({ anchor, width: box.offsetWidth, height: box.offsetHeight, viewport: { width: innerWidth, height: innerHeight }, obstacles: overlayObstacles() });
    box.style.left = pos.x + "px";
    box.style.top = pos.y + "px";
    box.dataset.placement = pos.placement;
  }
  function notice(text, actionList = []) {
    $("#notice-text").textContent = text;
    const container = $("#notice-actions");
    container.replaceChildren();
    const list = Array.isArray(actionList) ? actionList : actionList ? [actionList] : [];
    for (const action of list) {
      const button = document.createElement("button");
      button.className = "notice-action";
      button.id = container.children.length ? "notice-action-secondary" : "notice-action";
      button.textContent = action.label;
      if (action.primary) button.classList.add("primary");
      button.onclick = action.run;
      container.append(button);
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
    stage.classList.remove("tool-select", "tool-hand", "tool-text", "tool-rect", "tool-ellipse", "tool-board");
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
  async function reloadFromDisk(discard = false, { targetIds = null } = {}) {
    if (!local || agentBusy || agentPending) return false;
    if (saving) await savePromise;
    if (editing || dirty) {
      if (!discard) {
        notice("发现外部更新。你的本机修改已保留。", [{ label: "读取最新版本", run: reloadLatestKeepBackup }]);
        return false;
      }
      finishText();
    }
    try {
      const next = await fetchDiskDocument();
      const viewport = clone(state.viewport), previousIds = new Set(state.nodes.map((n) => n.id));
      state = next;
      baseline = clone(next);
      state.viewport = viewport;
      selected = new Set([...selected].filter((id) => state.nodes.some((n) => n.id === id)));
      if (!selected.size) {
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
      for (const id of refreshed) boardStamps.set(id, Date.now());
      panelKey = "";
      render();
      status("已同步");
      $("#notice").hidden = true;
      $("#save-status").classList.remove("error");
      try {
        localStorage.removeItem(draftKey);
      } catch {
      }
      return true;
    } catch (error) {
      notice(error.message, [{ label: "重试", run: () => reloadFromDisk(discard) }]);
      return false;
    }
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
      }
      if (data.pageName && !$("#document-name").contains(document.activeElement)) $("#document-name").textContent = data.pageName;
    }
    if (data.type === "prota:canvas-fullscreen-state") {
      fullscreenFallback = Boolean(data.active);
      updateFullscreen();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty && !readOnly) {
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
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (draft && !readOnly && JSON.stringify(draft.state.nodes) !== JSON.stringify(state.nodes)) notice("找到未保存的本机修改。", [{ label: "恢复修改", primary: true, run: () => {
      C.validate(draft.state);
      if (JSON.stringify(draft.baseline) !== JSON.stringify(window.PROTA_CANVAS)) {
        try {
          localStorage.setItem(draftKey + ":conflict-backup", JSON.stringify(draft));
        } catch {
          notice("本机备份空间不足，修改仍保留在恢复草稿中。");
          return;
        }
        restoreLocalOverConflict();
        return;
      }
      checkpoint();
      state = draft.state;
      baseline = draft.baseline;
      conflict = false;
      changed();
      $("#notice").hidden = true;
    } }]);
  } catch {
  }
  if ($("#notice").hidden) offerConflictBackupRestore();
  if (startupError) {
    document.body.classList.add("readonly");
    $("#empty h1").textContent = "暂时无法打开这张画布";
    $("#empty p").textContent = "布局文件格式有误。原文件已保留，请检查或从备份恢复。";
    notice(startupError.message, [{ label: "刷新重试", run: () => location.reload() }]);
  }
  render();
  if (!restoredView && !readOnly && state.nodes.length) fit();
  if (!local) status(readOnly ? "只读分享" : "已暂存在当前浏览器");
  window.protaCanvas = { runtimeVersion: 4, getState: () => clone(state), getSelection: () => [...selected], isDirty: () => dirty, save, fit, reloadFromDisk, agentState, setPreparing(value) {
    agentPending = Boolean(value);
    panelKey = "";
    renderInspector();
  } };
})();
