(() => {
  "use strict";
  const C = window.CanvasCore;
  const $ = (s) => document.querySelector(s), clone = (value) => JSON.parse(JSON.stringify(value));
  let startupError = null;
  try { C.validate(window.PROTA_CANVAS); } catch(error) { startupError = error; }
  const initialDocument = startupError ? {schemaVersion:1,revision:0,nodes:[],viewport:{x:100,y:80,zoom:1}} : window.PROTA_CANVAS;
  let state = clone(initialDocument), baseline = clone(state), selected = /* @__PURE__ */ new Set(), history = [], future = [], dirty = false, saving = false, readOnly = Boolean(startupError), space = false, gesture = null, interacting = null;
  const stage = $("#stage"), world = $("#world"), properties = $("#properties");
  let propertiesSelection="", menuInvoker=null, fullscreenFallback=false, imageInsertionPoint=null;
  let tool = "select", autoTimer, savePromise = null, conflict = false, agentBusy = false, agentPending = false, clipboard = null, editing = null, panelKey = "", frameStamp = 0, renderFrame = 0;
  const touches = /* @__PURE__ */ new Map();
  const draftKey = "prota-canvas-draft:" + location.pathname;
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
  const status = (text) => {
    $("#save-status").textContent = text;
  };
  function checkpoint() {
    history.push(clone(state));
    if (history.length > 60) history.shift();
    future = [];
  }
  function changed({ panels = true } = {}) {
    updateGroupBounds();
    dirty = true;
    status(local ? "等待保存…" : "已暂存在当前浏览器");
    try {
      localStorage.setItem(draftKey, JSON.stringify({ state, baseline, savedAt: Date.now() }));
    } catch {
      status("恢复备份空间不足，请及时保存");
    }
    render({ panels });
    clearTimeout(autoTimer);
    if (local && !conflict && !agentBusy) autoTimer = setTimeout(() => save(), 300);
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
  function view() {
    const v = state.viewport;
    world.style.setProperty("--zoom", v.zoom);
    world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
    stage.style.backgroundSize = `${20 * v.zoom}px ${20 * v.zoom}px`;
    stage.style.backgroundPosition = `${v.x}px ${v.y}px`;
    $("#zoom-reset").textContent = `${Math.round(v.zoom * 100)}%`;
    positionSelectionTools();
  }
  function notify() {
    if (window.parent !== window) window.parent.postMessage({ type: "prota:canvas-selection", selected: current().map((n) => ({ id: n.id, name: n.name, type: n.type, src: n.src || "", parentId: n.parentId || null })), dirty, runtimeVersion: 3 }, location.origin === "null" ? "*" : location.origin);
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
    const previous = new Map([...world.children].map((el) => [el.dataset.id, el]));
    for (const [index, n] of state.nodes.entries()) {
      let el = previous.get(n.id);
      if (!el) {
        el = document.createElement("article");
        el.dataset.id = n.id;
      }
      previous.delete(n.id);
      el.className = `node ${n.type}${selected.has(n.id) ? " selected" : ""}${effectiveLocked(n) ? " locked" : ""}${interacting === n.id ? " interacting" : ""}${n.hidden ? " hidden-node" : ""}${editing?.id === n.id ? " editing" : ""}`;
      Object.assign(el.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px`, background: n.color || "", fontSize: `${n.fontSize || 20}px`, opacity: n.opacity ?? 1, borderRadius: n.type === "ellipse" ? "50%" : `${n.radius || 0}px`, color: n.textColor || "#30323a", fontWeight: n.fontWeight || 400 });
      const signature = JSON.stringify([n.type, n.type === "board" ? "" : n.text, n.src, n.type === "board" ? frameStamp : 0]);
      if (el.dataset.signature !== signature && editing?.id !== n.id) {
        el.dataset.signature = signature;
        el.replaceChildren();
        const title = document.createElement("div");
        title.className = "node-title";
        title.textContent = (n.locked ? "🔒 " : "") + n.name;
        el.append(title);
        const content = document.createElement("div");
        content.className = "node-content";
        el.append(content);
        if (n.type === "board") {
          if (/^boards\/[a-zA-Z0-9_-]+\/index\.html$/.test(n.src || "")) {
            const frame = document.createElement("iframe");
            frame.src = n.src + (frameStamp ? "?canvas=" + frameStamp : "");
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
      $("#property-popover").hidden=true;
      if(fullscreenFallback){parent.postMessage({type:"prota:canvas-fullscreen",active:false},location.origin);return;}
      if(document.fullscreenElement){document.exitFullscreen();return;}
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
            create.textContent = "用 Agent 生成界面 ↗";
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
      el.querySelector(".node-title").textContent = (n.locked ? "🔒 " : "") + n.name;
      const needsHandle = selected.has(n.id) && !effectiveLocked(n) && canEdit() && n.type !== "group";
      if (needsHandle && !el.querySelector(".resize")) for (const direction of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
        const handle = document.createElement("div");
        handle.className = "resize";
        handle.dataset.handle = direction;
        el.append(handle);
      }
      if (!needsHandle) el.querySelectorAll(".resize").forEach((h) => h.remove());
      if (world.children[index] !== el) world.insertBefore(el, world.children[index] || null);
    }
    previous.forEach((el) => el.remove());
    $("#empty").hidden = state.nodes.length > 0;
    $("#undo").disabled = !history.length;
    $("#redo").disabled = !future.length;
    if (panels) renderInspector();
    view();
    notify();
  }
  function renderInspector() {
    const signature=JSON.stringify(current());
    const box=$('#selection-tools');box.replaceChildren();
    if(current().length>1){const count=document.createElement('span');count.className='selection-count';count.textContent=current().length+' 个对象';box.append(count);}
    for(const action of selectionActions(false))box.append(actionButton(action));
    if(propertiesSelection!==[...selected].join(',')){$('#property-popover').hidden=true;propertiesSelection=[...selected].join(',');}
    if(!$('#property-popover').hidden&&signature!==panelKey&&!properties.contains(document.activeElement))renderProperties();
    panelKey=signature;positionSelectionTools();
  }
  function actionButton(action,menu=false){
    const button=document.createElement('button');decorate(button,action.icon,action.label);button.dataset.action=action.id;button.disabled=Boolean(action.disabled);if(action.danger)button.classList.add('danger');if(menu)button.setAttribute('role','menuitem');
    if(action.shortcut&&menu){const hint=document.createElement('span');hint.className='menu-shortcut';hint.textContent=action.shortcut;button.append(hint);}
    button.onclick=e=>{const rect=button.getBoundingClientRect();$('#context-menu').hidden=true;action.run(e,rect);};return button;
  }
  function selectionActions(full=false){
    const nodes=current(),single=nodes.length===1?nodes[0]:null,editable=canEdit()&&nodes.every(n=>!effectiveLocked(n));if(!nodes.length)return[];
    const actions=[];
    if(!readOnly)actions.push({id:'agent',label:single?.type==='board'&&!single.src?'生成界面':'Agent 修改',icon:'agent',run:focusAgent,disabled:agentBusy});
    if(single&&['text','note'].includes(single.type)&&editable)actions.push({id:'edit-text',label:'编辑文字',icon:'text',run:()=>startText(single.id)});
    if(single?.type==='board'&&single.src)actions.push({id:'preview',label:'预览',icon:'play',run:()=>previewBoard(single)});
    if(editable){
      if(single)actions.push({id:'properties',label:single.type==='group'?'重命名':'调整',icon:single.type==='group'?'rename':'sliders',run:()=>openProperties()});
      if(selectedRoots().length>1){actions.push({id:'group',label:'分组',icon:'group',run:group,shortcut:'⌘ G'});actions.push({id:'align',label:'对齐',icon:'align',run:(_,r)=>showMenu(alignmentActions(),r.left,r.bottom+6)});}
      if(nodes.every(n=>n.type==='group'))actions.push({id:'ungroup',label:'取消分组',icon:'ungroup',run:ungroup,shortcut:'⌘ ⇧ G'});
      actions.push({id:'duplicate',label:'复制',icon:'copy',run:duplicate,shortcut:'⌘ D'});
    }
    if(nodes.every(n=>n.locked)&&canEdit())actions.push({id:'unlock',label:'解锁',icon:'unlock',run:()=>mutate(()=>nodes.forEach(n=>n.locked=false))});
    const extra=[];
    if(editable){extra.push({id:'front',label:'置于顶层',icon:'front',run:()=>reorder(true)},{id:'back',label:'置于底层',icon:'back',run:()=>reorder(false)},{id:'lock',label:'锁定',icon:'lock',run:()=>mutate(()=>nodes.forEach(n=>n.locked=true))});
      if(nodes.some(n=>n.parentId))extra.push({id:'detach',label:'移出容器',icon:'detach',run:()=>mutate(()=>C.reparent(state.nodes,selected,null))});
      extra.push({id:'delete',label:'删除',icon:'trash',run:remove,danger:true,shortcut:'⌫'});
    }
    if(single?.parentId)extra.push({id:'parent',label:'选择容器',icon:'frame',run:()=>{selected=new Set([single.parentId]);render();}});
    extra.push({id:'focus',label:'聚焦选中',icon:'fit',run:()=>fit(current())});
    if(full)return [...actions,{divider:true},...extra];
    actions.push({id:'more',label:'更多',icon:'more',run:(_,r)=>showMenu(extra,r.left,r.bottom+6)});return actions;
  }
  function renderProperties(){
    const n=current()[0];properties.replaceChildren();if(!n||current().length!==1)return;
    $('#property-title').textContent=n.name||names[n.type];
    let fields=[['name','名称','text'],['x','X','number'],['y','Y','number'],['width','宽','number'],['height','高','number'],['color','填充','color'],['opacity','不透明度','number'],['radius','圆角','number']];
    if(n.type==='group')fields=fields.filter(([key])=>['name','x','y'].includes(key));
    if(['text','note','rect','ellipse'].includes(n.type))fields.push(['text','内容','textarea'],['fontSize','字号','number'],['textColor','文字颜色','color']);
    for(const [key,label,type] of fields){const row=document.createElement('label');row.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;
      input.value=n[key]??(key==='color'?'#ffffff':key==='textColor'?'#424650':key==='opacity'?1:key==='radius'?0:'');input.setAttribute('aria-label',label);input.disabled=!canEdit()||effectiveLocked(n);if(key==='opacity'){input.min=0;input.max=1;input.step=.1;}row.append(input);properties.append(row);
      input.addEventListener('change',()=>{let value=input.value;if(type==='number'){value=Number(value);if(!Number.isFinite(value)||Math.abs(value)>1e6){input.value=n[key];return;}if(['width','height'].includes(key))value=Math.max(16,value);if(key==='fontSize')value=Math.max(8,Math.min(400,value));if(key==='opacity')value=Math.max(0,Math.min(1,value));if(key==='radius')value=Math.max(0,Math.min(1000,value));}
        mutate(()=>{if(key==='x'||key==='y'){const delta=value-n[key],ids=C.descendants(state.nodes,[n.id]);state.nodes.filter(item=>ids.has(item.id)).forEach(item=>item[key]+=delta);}else n[key]=value;});
      });
    }
  }
  function openProperties(){finishText();propertiesSelection=[...selected].join(',');renderProperties();const popover=$('#property-popover');popover.hidden=false;const rect=$('#selection-tools').getBoundingClientRect();placeFloating(popover,rect.left,rect.bottom+8);}
  function alignmentActions(){return [['left','左对齐','align'],['centerX','水平居中','align-center'],['right','右对齐','align-right'],['top','顶部对齐','align-top'],['centerY','垂直居中','align-middle'],['bottom','底部对齐','align-bottom'],['evenX','水平等距','distribute'],['evenY','垂直等距','distribute-v']].map(([mode,label,icon])=>({id:mode,label,icon,disabled:mode.startsWith('even')&&selectedRoots().length<3,run:()=>align(mode)}));}
  function previewBoard(n){exitInteraction();const el=world.querySelector(`[data-id="${n.id}"]`);if(!el?.querySelector('iframe'))return;interacting=n.id;el.classList.add('interacting');$('#interaction-hint').textContent='预览中 · Esc 返回画布';el.querySelector('iframe').focus();positionSelectionTools();}
  function add(kind, at) {
    if (!canEdit()) return;
    if (kind.startsWith("component-")) return insertComponent(kind);
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
  function insertComponent(kind) {
    const parent2 = current().length === 1 && ["board", "group"].includes(current()[0].type) ? current()[0] : null;
    const center = point(stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
    const origin = { x: parent2 ? parent2.x + 32 : center.x - 140, y: parent2 ? parent2.y + 32 : center.y - 70 };
    const names2 = { "component-button": "按钮", "component-input": "输入框", "component-card": "信息卡", "component-nav": "导航栏" };
    const group2 = { id: uid(), type: "group", name: names2[kind], x: origin.x, y: origin.y, width: 280, height: 120, parentId: parent2?.id || null, component: kind };
    const nodes = [group2];
    const shape = (x, y, width, height, color, radius = 8) => nodes.push({ id: uid(), type: "rect", name: "背景", parentId: group2.id, x: origin.x + x, y: origin.y + y, width, height, color, radius });
    const text = (value, x, y, width, fontSize = 14, textColor = "#343747") => nodes.push({ id: uid(), type: "text", name: value, parentId: group2.id, x: origin.x + x, y: origin.y + y, width, height: Math.max(22, fontSize * 1.5), text: value, fontSize, textColor, padding: 0 });
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
      selected = /* @__PURE__ */ new Set([group2.id]);
    });
    return group2;
  }
  function duplicate() {
    mutate(() => {
      const copied = C.duplicate(state.nodes, selected);
      state.nodes.push(...copied.nodes);
      selected = new Set(copied.selected);
    });
  }
  function remove() {
    mutate(() => {
      const ids = C.descendants(state.nodes, selectedRoots().filter((n) => !effectiveLocked(n)).map((n) => n.id));
      state.nodes = state.nodes.filter((n) => !ids.has(n.id));
      selected.clear();
    });
  }
  function group() {
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
  function ungroup() {
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
  }
  function reorder(top) {
    mutate(() => {
      const ids = C.descendants(state.nodes, selectedRoots().filter((n) => !effectiveLocked(n)).map((n) => n.id)), moving = state.nodes.filter((n) => ids.has(n.id)), rest = state.nodes.filter((n) => !ids.has(n.id));
      state.nodes = top ? [...rest, ...moving] : [...moving, ...rest];
    });
  }
  function align(mode) {
    const nodes=selectedRoots().filter(n=>!effectiveLocked(n));if(nodes.length<2)return;
    mutate(()=>{const bounds=C.bounds(nodes),axis=['left','right','centerX','evenX'].includes(mode)?'x':'y',size=axis==='x'?'width':'height';
      let gap=0,cursor=bounds[axis];if(mode.startsWith('even')){if(nodes.length<3)return;nodes.sort((a,b)=>a[axis]-b[axis]);gap=(bounds[size]-nodes.reduce((sum,n)=>sum+n[size],0))/(nodes.length-1);}
      for(const n of nodes){let target=mode.startsWith('even')?cursor:mode.startsWith('center')?bounds[axis]+(bounds[size]-n[size])/2:['right','bottom'].includes(mode)?bounds[axis]+bounds[size]-n[size]:bounds[axis];const delta=target-n[axis],ids=C.descendants(state.nodes,[n.id]);state.nodes.filter(item=>ids.has(item.id)).forEach(item=>item[axis]+=delta);cursor+=n[size]+gap;}
    });
  }
  function zoom(factor, x = stage.clientWidth / 2, y = stage.clientHeight / 2) {
    exitInteraction();
    const v = state.viewport, z = Math.max(0.05, Math.min(4, v.zoom * factor));
    v.x = x - (x - v.x) * z / v.zoom;
    v.y = y - (y - v.y) * z / v.zoom;
    v.zoom = z;
    view();
    if (!readOnly) persistView();
  }
  function fit(nodes = state.nodes) {
    if (!nodes.length) return;
    exitInteraction();
    const left = Math.min(...nodes.map((n) => n.x)), top = Math.min(...nodes.map((n) => n.y)), right = Math.max(...nodes.map((n) => n.x + n.width)), bottom = Math.max(...nodes.map((n) => n.y + n.height));
    const z = Math.max(0.05, Math.min(1.5, (stage.clientWidth - 100) / (right - left), (stage.clientHeight - 100) / (bottom - top)));
    state.viewport = { x: (stage.clientWidth - (right - left) * z) / 2 - left * z, y: (stage.clientHeight - (bottom - top) * z) / 2 - top * z, zoom: z };
    view();
    if (!readOnly) persistView();
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
    changed();
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.button===2 || e.target.closest("button,.floating-panel,#selection-tools") || e.target.closest(".interacting") || e.target.isContentEditable) return;
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
    $("#context-menu").hidden = true;
    exitInteraction();
    stage.focus();
    const el = e.target.closest(".node"), n = state.nodes.find((n2) => n2.id === el?.dataset.id), p = point(e.clientX, e.clientY);
    if (space || tool === "hand" || e.button === 1) {
      gesture = { kind: "pan", cx: e.clientX, cy: e.clientY, x: state.viewport.x, y: state.viewport.y };
      stage.classList.add("panning");
    } else if (e.button !== 0) return;
    else if (tool !== "select" && canEdit()) {
      const made = add(tool, p);
      if (made) {
        made.x = p.x;
        made.y = p.y;
        made.width = 16;
        made.height = 16;
        gesture = { kind: "draw", id: made.id, start: p };
        render();
      }
      setTool("select");
    } else if (n) {
      if (e.shiftKey) {
        selected.has(n.id) ? selected.delete(n.id) : selected.add(n.id);
      } else if (!selected.has(n.id)) selected = /* @__PURE__ */ new Set([n.id]);
      const resize = e.target.classList.contains("resize"), handle = e.target.dataset.handle || "se";
      if (e.altKey && !resize && canEdit()) {
        duplicate();
      }
      render();
      if (canEdit() && !effectiveLocked(n) && selected.size) {
        gesture = { kind: resize ? "resize" : "move", handle, start: p, nodes: movable().map((n2) => ({ id: n2.id, x: n2.x, y: n2.y, width: n2.width, height: n2.height })), started: false };
      }
    } else {
      if (!e.shiftKey) selected.clear();
      gesture = { kind: "select", start: p, selected: new Set(selected), cx: e.clientX, cy: e.clientY };
      render();
    }
    if (gesture) {
      (n && el.isConnected ? el : stage).setPointerCapture(e.pointerId);
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
      render({ panels: false });
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
      render();
      return;
    }
    let dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.started) {
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      checkpoint();
      g.started = true;
    }
    if (e.shiftKey && g.kind === "move") {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (g.kind === "move" && !e.altKey) {
      const snapped = snap(g.nodes, dx, dy);
      dx = snapped.dx;
      dy = snapped.dy;
    }
    for (const old of g.nodes) {
      const n = state.nodes.find((n2) => n2.id === old.id);
      if (g.kind === "move") {
        n.x = Math.round(old.x + dx);
        n.y = Math.round(old.y + dy);
      } else if (selected.has(n.id)) {
        const h = g.handle;
        let w = old.width + (h.includes("e") ? dx : h.includes("w") ? -dx : 0), height = old.height + (h.includes("s") ? dy : h.includes("n") ? -dy : 0);
        if (e.shiftKey && h.length === 2) height = w * old.height / old.width;
        n.width = Math.max(16, Math.round(w));
        n.height = Math.max(16, Math.round(height));
        n.x = old.x + (h.includes("w") ? old.width - n.width : 0);
        n.y = old.y + (h.includes("n") ? old.height - n.height : 0);
      }
    }
    render({ panels: false });
  });
  function endGesture() {
    const g = gesture;
    gesture = null;
    $("#marquee").hidden = true;
    $("#guides").replaceChildren();
    stage.classList.remove("panning");
    if (g?.started || g?.kind === "draw") {
      if (g.kind === "move") {
        for (const n of selectedRoots().filter((n2) => n2.type !== "board" && n2.type !== "group")) {
          const board = [...state.nodes].reverse().find((b) => b.type === "board" && !effectiveLocked(b) && n.x >= b.x && n.y >= b.y && n.x + n.width <= b.x + b.width && n.y + n.height <= b.y + b.height);
          if (!n.parentId || state.nodes.find((p) => p.id === n.parentId)?.type === "board") n.parentId = board?.id || null;
        }
      }
      changed();
      if (g.kind === "draw" && state.nodes.find((n) => n.id === g.id)?.type === "text") startText(g.id);
    }
    if (["pan", "pinch"].includes(g?.kind) && !readOnly) persistView();
  }
  stage.addEventListener("pointerup", (e) => {
    touches.delete(e.pointerId);
    endGesture();
  });
  stage.addEventListener("pointercancel", (e) => {
    touches.delete(e.pointerId);
    endGesture();
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
    } else if (canEdit() && !effectiveLocked(n) && ["text", "note"].includes(n.type)) startText(n.id);
  });
  stage.addEventListener("wheel", (e) => {
    if (e.target.closest(".interacting")) return;
    e.preventDefault();
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
    if (e.key === "Escape") {
      if (gesture?.started) {
        for (const old of gesture.nodes) Object.assign(state.nodes.find((n) => n.id === old.id), old);
        history.pop();
        gesture = null;
        $("#guides").replaceChildren();
        render();
        return;
      }
      if (editing) {
        finishText(true);
        return;
      }
      exitInteraction();
      setTool("select");
      $("#context-menu").hidden = true;
      stage.focus();
      return;
    }
    if (e.target.matches("input,textarea,select") || e.target.isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      e.shiftKey ? ungroup() : group();
      return;
    }
    if (mod && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copySelection();
      return;
    }
    if (mod && e.key.toLowerCase() === "v") {
      e.preventDefault();
      pasteSelection();
      return;
    }
    if (!mod && { v: 1, h: 1, t: 1, r: 1, o: 1, f: 1 }[e.key.toLowerCase()]) {
      const map = { v: "select", h: "hand", t: "text", r: "rect", o: "ellipse", f: "board" };
      setTool(map[e.key.toLowerCase()]);
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      focusName();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      space = true;
      stage.classList.add("space");
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo(e.shiftKey);
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicate();
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selected = new Set(state.nodes.map((n) => n.id));
      render();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove();
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
    endGesture();
  });
  async function images(files, at) {
    if (!canEdit()) return;
    for (const file of files) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
        status("支持 PNG、JPEG、WebP、GIF，单张不超过 4 MB");
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
      const n = add("image", at);
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
    images(e.dataTransfer.files, point(e.clientX, e.clientY)).catch(() => status("图片读取失败"));
  });
  document.addEventListener("paste", (e) => {
    if (e.target.matches("input,textarea") || e.target.isContentEditable) return;
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      images(files).catch(() => status("图片读取失败"));
    }
  });
  async function save() {
    clearTimeout(autoTimer);
    if (gesture) {
      autoTimer = setTimeout(() => save(), 300);
      return false;
    }
    finishText();
    if (readOnly) return false;
    if (savePromise) {
      await savePromise;
      return dirty && !conflict ? save() : !dirty;
    }
    if (!local) {
      status("已暂存在当前浏览器");
      return false;
    }
    if (!dirty) return true;
    saving = true;

    status("正在保存…");
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
          for (const document2 of [state, ...history, ...future]) {
            const current2 = document2.nodes.find((n) => n.id === asset.id);
            if (current2?.src === old) current2.src = asset.src;
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
        status(dirty ? "有新的修改待保存" : "已保存");
        $("#save-status").classList.remove("error");
        notify();
        return true;
      } catch (error) {
        status(conflict ? "保存冲突" : "保存失败 · 已保留本机备份");
        $("#save-status").classList.add("error");
        notice(error.message, conflict ? "读取最新版本" : "重试", conflict ? async () => {
          backupLocal();
          await reloadFromDisk(true);
        } : () => save());
        return false;
      } finally {
        saving = false;

        savePromise = null;
        if (dirty && !conflict && JSON.stringify(state) !== JSON.stringify(snapshot)) autoTimer = setTimeout(() => save(), 300);
      }
    })();
    return savePromise;
  }
  function backupLocal(){try{localStorage.setItem(draftKey+':conflict-backup',JSON.stringify({state,baseline,savedAt:Date.now()}));}catch{notice('本机备份空间不足，当前修改仍保留在画布中。');throw Error('无法备份当前修改');}}
  $("#first-board").onclick = () => add("mobile");
  $("#image").onclick = () => $("#image-input").click();
  $("#image-input").onchange = (e) => {
    images(e.target.files,imageInsertionPoint).catch(() => status("图片读取失败"));
    imageInsertionPoint=null;e.target.value = "";
  };
  $("#undo").onclick = () => undo();
  $("#redo").onclick = () => undo(true);
  $("#fit").onclick = () => fit();
  $("#zoom-in").onclick = () => zoom(1.2);
  $("#zoom-out").onclick = () => zoom(1 / 1.2);
  $("#zoom-reset").onclick = () => zoom(1 / state.viewport.zoom);
  window.addEventListener("beforeunload", (e) => {
    if (dirty && !readOnly) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("message", (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    if (e.data?.type === "prota:canvas-config" && e.data.readOnly && !readOnly) {
      readOnly = true;
      document.body.classList.add("readonly");
      render();
      status("只读分享");
    }
  });
  try {
    if (parent !== window && parent.shell?.isShareMode) {
      readOnly = true;
      document.body.classList.add("readonly");
    }
  } catch {
  }
  if (!state?.viewport) state.viewport = { x: 120, y: 100, zoom: 1 };
  state.viewport.zoom = Math.max(0.05, Math.min(4, state.viewport.zoom || 1));
  function notice(text, actionLabel = "", action = null) {
    $("#notice-text").textContent = text;
    $("#notice-action").textContent = actionLabel;
    $("#notice-action").hidden = !action;
    $("#notice-action").onclick = action;
    $("#notice").hidden = false;
  }
  function setTool(value) {
    tool = value;
    stage.classList.remove("tool-select", "tool-hand", "tool-text", "tool-rect", "tool-ellipse", "tool-board");
    stage.classList.add("tool-" + value);
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === value);
      b.setAttribute("aria-pressed", b.dataset.tool === value);
    });
  }
  function focusName(){if(current().length!==1)return;openProperties();properties.querySelector('[aria-label="名称"]')?.focus();properties.querySelector('[aria-label="名称"]')?.select();}
  async function focusAgent(){
    finishText();if(parent===window){notice('请在 Prota 中使用当前 Agent。');return;}
    if(dirty&&!(await save())){notice('更改还未写入本地，请先处理保存提示。');return;}
    if(document.fullscreenElement)await document.exitFullscreen();
    if(fullscreenFallback)parent.postMessage({type:'prota:canvas-fullscreen',active:false},location.origin);
    parent.postMessage({type:'prota:canvas-open-agent'},location.origin);
  }
  function positionSelectionTools(){
    const box=$('#selection-tools'),b=C.bounds(current());box.hidden=!b||!!editing||!!gesture||!!interacting;if(!b)return;
    const v=state.viewport,width=box.offsetWidth||360,height=box.offsetHeight||40,left=b.x*v.zoom+v.x+(b.width*v.zoom-width)/2,above=b.y*v.zoom+v.y-height-18;
    box.style.left=Math.max(10,Math.min(stage.clientWidth-width-10,left))+'px';
    box.style.top=Math.max(58,Math.min(stage.clientHeight-height-88,above<58?(b.y+b.height)*v.zoom+v.y+16:above))+'px';
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
    const n = state.nodes.find((n2) => n2.id === id);
    if (!n || effectiveLocked(n)) return;
    selected = /* @__PURE__ */ new Set([id]);
    render();
    const el = world.querySelector(`[data-id="${id}"] .node-content`);
    checkpoint();
    editing = { id, original: n.text || "" };
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
    el.oninput = () => {
      n.text = el.innerText;
      dirty = true;
      try {
        localStorage.setItem(draftKey, JSON.stringify({ state, baseline, savedAt: Date.now() }));
      } catch {
      }
    };
    positionSelectionTools();
  }
  function finishText(cancel = false) {
    if (!editing) return;
    const edit = editing;
    editing = null;
    const n = state.nodes.find((n2) => n2.id === edit.id), el = world.querySelector(`[data-id="${edit.id}"] .node-content`);
    if (el) {
      el.onblur = null;
      el.oninput = null;
      el.contentEditable = "false";
    }
    if (n && cancel) n.text = edit.original;
    if (n && n.text !== edit.original) changed();
    else {
      history.pop();
      render();
    }
  }
  function copySelection() {
    clipboard = { nodes: clone(state.nodes.filter((n) => C.descendants(state.nodes, selected).has(n.id))), selected: [...selected] };
    notice("已复制 " + selected.size + " 个对象");
    setTimeout(() => $("#notice").hidden = true, 1800);
  }
  function pasteSelection() {
    if (!clipboard || !canEdit()) return;
    mutate(() => {
      const copies = C.duplicate(clipboard.nodes, clipboard.selected, 40);
      for (const n of copies.nodes) if (n.parentId && !copies.nodes.some((p) => p.id === n.parentId)) n.parentId = null;
      state.nodes.push(...copies.nodes);
      selected = new Set(copies.selected);
    });
  }
  async function reloadFromDisk(discard = false) {
    if (!local || agentBusy || agentPending) return false;
    if (saving) await savePromise;
    if (editing || dirty) {
      if (!discard) {
        notice("发现外部更新。你的本机修改已保留。", "读取最新版本", async () => {
          backupLocal();
          await reloadFromDisk(true);
        });
        return false;
      }
      finishText();
    }
    try {
      const response = await fetch("./canvas-data.js?fresh=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw Error("读取画布失败");
      const text = await response.text(), prefix = "window.PROTA_CANVAS = ";
      if (!text.trim().startsWith(prefix)) throw Error("画布格式错误，请检查 Agent 的修改");
      const next = JSON.parse(text.trim().slice(prefix.length).replace(/;\s*$/, ""));
      C.validate(next);
      const viewport = clone(state.viewport), previousIds = new Set(state.nodes.map((n) => n.id));
      state = next;
      baseline = clone(next);
      state.viewport = viewport;
      selected = new Set([...selected].filter((id) => state.nodes.some((n) => n.id === id)));
      if (!selected.size) {
        const added = state.nodes.filter((n) => !previousIds.has(n.id));
        if (added.length) selected = new Set(C.roots(state.nodes, added.map((n) => n.id)).map((n) => n.id));
      }
      dirty = false;
      conflict = false;
      history = [];
      future = [];
      frameStamp = Date.now();
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
      notice(error.message, "重试", () => reloadFromDisk(discard));
      return false;
    }
  }
  function agentState(data){const wasBusy=agentBusy;if(data.active||wasBusy)agentPending=false;agentBusy=Boolean(data.active);document.body.classList.toggle('agent-working',agentBusy);
    if(agentBusy)status('Agent 正在修改');else if(wasBusy){if(data.error)notice('任务未完成，可在当前 Agent 中查看详情。');reloadFromDisk();}
    document.querySelectorAll('#add-board,#add-shape,#add-note,#add-component,#image,#first-board,[data-tool]:not([data-tool=select]):not([data-tool=hand])').forEach(button=>button.disabled=agentBusy||readOnly);renderInspector();
  }
  const iconPaths={
    cursor:'<path d="m5 3 14 9-7 1-3 7-4-17Z"/>',
    hand:'<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 6-6 6h-1c-2 0-3.5-1-4.5-2.5L4 13a1.5 1.5 0 0 1 2-2l2 2"/>',
    frame:'<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
    canvas:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16M9 9h11"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    shapes:'<rect x="3" y="3" width="11" height="11" rx="2"/><circle cx="16" cy="16" r="5"/>',
    rect:'<rect x="4" y="5" width="16" height="14" rx="2"/>',
    ellipse:'<circle cx="12" cy="12" r="8"/>',
    note:'<path d="M14 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9l-7 7Z"/><path d="M14 21v-7h7M7 8h10M7 12h4"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L6 21"/>',
    component:'<path d="m12 2 4 4-4 4-4-4 4-4Zm-6 6 4 4-4 4-4-4 4-4Zm12 0 4 4-4 4-4-4 4-4Zm-6 6 4 4-4 4-4-4 4-4Z"/>',
    agent:'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M9 12v2M15 12v2M9 17h6M2 12v3M22 12v3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
    undo:'<path d="M3 10h10a7 7 0 0 1 7 7M3 10l5-5M3 10l5 5"/>',redo:'<path d="M21 10H11a7 7 0 0 0-7 7m17-7-5-5m5 5-5 5"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',collapse:'<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m18 0h-5v5"/>',
    fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    group:'<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M8 5h8M5 8v8m14-8v8M8 19h8"/>',
    ungroup:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M14 3h7v7M3 14v7h7"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6M12 14v3"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    sliders:'<path d="M4 7h3m4 0h9M4 17h9m4 0h3"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    rename:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>',
    front:'<rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3"/>',
    back:'<rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3"/>',
    detach:'<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M13 3h8v8m-1-7-9 9"/>',
    align:'<path d="M4 3v18"/><rect x="8" y="5" width="12" height="5" rx="1"/><rect x="8" y="14" width="8" height="5" rx="1"/>',
    'align-center':'<path d="M12 2v20"/><rect x="4" y="5" width="16" height="5" rx="1"/><rect x="7" y="14" width="10" height="5" rx="1"/>',
    'align-right':'<path d="M20 3v18"/><rect x="4" y="5" width="12" height="5" rx="1"/><rect x="8" y="14" width="8" height="5" rx="1"/>',
    'align-top':'<path d="M3 4h18"/><rect x="5" y="8" width="5" height="12" rx="1"/><rect x="14" y="8" width="5" height="8" rx="1"/>',
    'align-middle':'<path d="M2 12h20"/><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="7" width="5" height="10" rx="1"/>',
    'align-bottom':'<path d="M3 20h18"/><rect x="5" y="4" width="5" height="12" rx="1"/><rect x="14" y="8" width="5" height="8" rx="1"/>',
    distribute:'<path d="M3 3v18M21 3v18"/><rect x="7" y="6" width="3" height="12" rx="1"/><rect x="14" y="6" width="3" height="12" rx="1"/>',
    'distribute-v':'<path d="M3 3h18M3 21h18"/><rect x="6" y="7" width="12" height="3" rx="1"/><rect x="6" y="14" width="12" height="3" rx="1"/>'
  };
  function decorate(element,icon,label=''){
    element.innerHTML='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[icon]||iconPaths.rect)+'</svg>';
    if(label){const span=document.createElement('span');span.className='button-label';span.textContent=label;element.append(span);}
  }
  for(const el of document.querySelectorAll('[data-icon]'))decorate(el,el.dataset.icon,el.textContent.trim());
  function placeFloating(element,x,y){
    element.hidden=false;const w=element.offsetWidth,h=element.offsetHeight;
    element.style.left=Math.max(10,Math.min(innerWidth-w-10,x))+'px';
    element.style.top=Math.max(10,Math.min(innerHeight-h-10,y))+'px';
  }
  function showMenu(actions,x,y,invoker=document.activeElement){
    $('#property-popover').hidden=true;const menu=$('#context-menu');menu.replaceChildren();menuInvoker=invoker;
    for(const action of actions){if(action.divider){const divider=document.createElement('div');divider.className='menu-divider';menu.append(divider);}else if(action.heading){const heading=document.createElement('div');heading.className='menu-section';heading.textContent=action.heading;menu.append(heading);}else menu.append(actionButton(action,true));}
    placeFloating(menu,x,y);menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  function insertAt(kind,at){
    const n=add(kind,at);if(n&&at){const ids=C.descendants(state.nodes,[n.id]),dx=at.x-n.x,dy=at.y-n.y;for(const item of state.nodes)if(ids.has(item.id)){item.x+=dx;item.y+=dy;}changed();}
  }
  function creationActions(at=null,category='all'){
    const defs=[['mobile','手机画板','frame','boards'],['web','Web 画板','frame','boards'],['board','自由画板','frame','boards'],['text','文本','text','content'],['note','便签','note','content'],['rect','矩形','rect','shapes'],['ellipse','圆形','ellipse','shapes'],['image','图片','image','content'],['component-button','按钮组件','component','components'],['component-input','输入框组件','component','components'],['component-card','信息卡组件','component','components'],['component-nav','导航栏组件','component','components']];
    return defs.filter(([, , ,group])=>category==='all'||category===group).map(([kind,label,icon])=>({id:'add-'+kind,label,icon,disabled:!canEdit(),run:()=>{if(kind==='image'){imageInsertionPoint=at;$('#image-input').click();}else insertAt(kind,at);}}));
  }
  function openCreateMenu(button,category){const r=button.getBoundingClientRect();showMenu(creationActions(null,category),r.left,Math.max(10,r.top-290),button);}
  $('#add-board').onclick=e=>openCreateMenu(e.currentTarget,'boards');
  $('#add-shape').onclick=e=>openCreateMenu(e.currentTarget,'shapes');
  $('#add-component').onclick=e=>openCreateMenu(e.currentTarget,'components');
  $('#add-note').onclick=()=>add('note');
  $('#ask-agent').onclick=focusAgent;$('#empty-agent').onclick=focusAgent;
  $('#close-properties').onclick=()=>{$('#property-popover').hidden=true;stage.focus();};
  $('#notice-dismiss').onclick=()=>$('#notice').hidden=true;
  document.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{finishText();exitInteraction();setTool(button.dataset.tool);$('#property-popover').hidden=true;});
  properties.addEventListener('focusout',()=>setTimeout(()=>{if(!properties.contains(document.activeElement)&&!$('#property-popover').hidden)renderProperties();},0));
  stage.addEventListener('contextmenu',e=>{
    if(e.target.isContentEditable||e.target.closest('#property-popover'))return;
    e.preventDefault();finishText();exitInteraction();const el=e.target.closest('.node');
    if(el){if(!selected.has(el.dataset.id))selected=new Set([el.dataset.id]);render();showMenu(selectionActions(true),e.clientX,e.clientY);}
    else{selected.clear();render();const at=point(e.clientX,e.clientY);showMenu([{heading:'添加到这里'},...creationActions(at),{divider:true},{id:'paste',label:'粘贴',icon:'copy',disabled:!clipboard||!canEdit(),run:pasteSelection},{id:'fit',label:'查看全部',icon:'fit',run:()=>fit()}],e.clientX,e.clientY);}
  });
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('#context-menu')&&!e.target.closest('[aria-haspopup=menu]'))$('#context-menu').hidden=true;
    if(!e.target.closest('#property-popover')&&!e.target.closest('#selection-tools'))$('#property-popover').hidden=true;
  });
  $('#context-menu').addEventListener('keydown',e=>{
    const buttons=[...$('#context-menu').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length;buttons[next]?.focus();}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();$('#context-menu').hidden=true;menuInvoker?.focus?.();}
  });
  function updateFullscreen(){const active=Boolean(document.fullscreenElement)||fullscreenFallback;decorate($('#fullscreen'),active?'collapse':'expand',active?'退出全屏':'全屏');$('#fullscreen').setAttribute('aria-pressed',active);view();}
  async function toggleFullscreen(){
    if(fullscreenFallback){parent.postMessage({type:'prota:canvas-fullscreen',active:false},location.origin);return;}
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{if(parent!==window)parent.postMessage({type:'prota:canvas-fullscreen',active:true},location.origin);else notice('当前环境不支持全屏，请使用浏览器全屏功能。');}
  }
  $('#fullscreen').onclick=toggleFullscreen;document.addEventListener('fullscreenchange',updateFullscreen);
  window.addEventListener('message',e=>{
    if(e.source!==parent||e.origin!==location.origin)return;const data=e.data||{};
    if(data.type==='prota:canvas-agent-status')agentState(data);
    if(data.type==='prota:canvas-agent-error')notice(data.error);
    if(data.type==='prota:canvas-config'&&data.pageName)$('#document-name').textContent=data.pageName;
    if(data.type==='prota:canvas-fullscreen-state'){fullscreenFallback=Boolean(data.active);updateFullscreen();}
  });
  new ResizeObserver(() => view()).observe(stage);
  try {
    const viewport = JSON.parse(sessionStorage.getItem(draftKey + ":view") || "null");
    if (viewport && Number.isFinite(viewport.zoom) && viewport.zoom >= 0.05 && viewport.zoom <= 4) state.viewport = viewport;
  } catch {
  }
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (draft && !readOnly && JSON.stringify(draft.state.nodes) !== JSON.stringify(state.nodes)) notice("找到未保存的本机修改。", "恢复修改", () => {
      C.validate(draft.state);
      checkpoint();
      state = draft.state;
      baseline = draft.baseline;
      conflict = JSON.stringify(baseline) !== JSON.stringify(window.PROTA_CANVAS);
      changed();
      $("#notice").hidden = true;
    });
  } catch {
  }
  if(startupError){document.body.classList.add('readonly');$('#empty h1').textContent='暂时无法打开这张画布';$('#empty p').textContent='布局文件格式有误。原文件已保留，请检查或从备份恢复。';notice(startupError.message,'刷新重试',()=>location.reload());}
  render();
  if (!local) status(readOnly ? "只读分享" : "已暂存在当前浏览器");
  window.protaCanvas = { runtimeVersion: 3, getState: () => clone(state), getSelection: () => [...selected], isDirty: () => dirty, save, fit, reloadFromDisk, agentState, setPreparing(value) {
    agentPending = Boolean(value);
    panelKey = "";
    renderInspector();
  } };
})();
