// Quick create: four dots float outside the hovered or selected object. Click a dot to add the
// same flowchart step in that direction (all other objects open the flowchart panel),
// drag it onto an object to connect, or drop it on blank canvas to pick a shape.
// Every write is one host.mutate: a node and its edge share one undo record.
(function(root) {
  'use strict';
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const OUTWARD = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
  const SIDE_LABELS = { top: '上', right: '右', bottom: '下', left: '左' };
  const STYLE_KEYS = ['color', 'textColor', 'fontSize', 'fontWeight', 'textAlign', 'strokeColor', 'strokeWidth'];
  const KIND_NAMES = { rect: '矩形', ellipse: '圆形', note: '便签' };
  // Screen pixels: dot centre beyond the outline, its hit radius, and the magnetic radius of drop targets.
  const DOT_OFFSET = 24, DOT_HIT = 14, MAGNET = 22, MAGNET_TOUCH = 28;
  const nodeId = () => 'n_' + crypto.randomUUID().replaceAll('-', '');
  const edgeId = () => 'e_' + crypto.randomUUID().replaceAll('-', '');
  const overlap = (a, b, m = 24) => a.x < b.x + b.width + m && a.x + a.width + m > b.x && a.y < b.y + b.height + m && a.y + a.height + m > b.y;
  const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
  // Only flowchart steps duplicate on click; all other objects ask which flowchart step to add.
  const duplicable = n => Boolean(n.flowShape && root.CanvasFlowShapes.has(n.flowShape));
  const isFlow = (n, F) => Boolean(n.flowShape && F.has(n.flowShape));

  // Pure placement: collision-free candidates around the source side whose edge routes.
  // Old nodes are never pushed; a crowded neighbourhood returns null instead of a half write.
  function obstacles(doc, source) {
    const level = source.parentId || null, visible = doc.nodes.filter(n => !n.hidden && n.type !== 'group');
    // Background plates (plain rects holding other objects) never block a new neighbour.
    const plate = n => n.type === 'rect' && !n.flowShape && visible.some(o => o.id !== n.id && contains(n, o));
    return visible.filter(n => n.id !== source.id && (n.parentId || null) === level && !plate(n));
  }
  function candidates(doc, source, node, side, drop, F) {
    const zoom = doc.viewport.zoom, gap = Math.min(240, Math.max(80, 100 / zoom));
    const dir = side === 'right' ? { x: 1, y: 0 } : side === 'left' ? { x: -1, y: 0 } : side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
    const horizontal = dir.x !== 0, along = horizontal ? node.width : node.height, across = (horizontal ? node.height : node.width) + 32;
    const p = F.endpoint(source.flowShape, side, source.width, source.height), start = { x: source.x + p.x, y: source.y + p.y };
    // A dropped connector keeps its direction: the new node stays beyond that side of the source.
    const ahead = r => side === 'right' ? r.x >= source.x + source.width + 24 : side === 'left' ? r.x + node.width <= source.x - 24 : side === 'bottom' ? r.y >= source.y + source.height + 24 : r.y + node.height <= source.y - 24;
    const out = [];
    let ideal = null;
    if (drop) {
      // Near edge on the drop point, then the closest free cells of a local grid around it.
      ideal = { x: drop.x + dir.x * along / 2, y: drop.y + dir.y * along / 2 };
      for (let dx = -640; dx <= 640; dx += 40) for (let dy = -640; dy <= 640; dy += 40) {
        const rect = { x: ideal.x + dx - node.width / 2, y: ideal.y + dy - node.height / 2 };
        if (ahead(rect)) out.push(rect);
      }
    }
    for (let step = 0; step < 4; step++) for (const k of [0, 1, -1, 2, -2, 3, -3]) {
      const reach = gap + step * (along + 32) + along / 2, off = k * across;
      out.push({ x: start.x + dir.x * reach + dir.y * off - node.width / 2, y: start.y + dir.y * reach + dir.x * off - node.height / 2 });
    }
    const seen = new Set();
    return out.filter(r => { const key = Math.round(r.x) + ':' + Math.round(r.y); if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || seen.has(key)) return false; seen.add(key); return true; })
      .map((r, order) => ({ ...r, cost: (ideal ? Math.hypot(r.x + node.width / 2 - ideal.x, r.y + node.height / 2 - ideal.y) * 1000 : 0) + order }))
      .sort((a, b) => a.cost - b.cost);
  }
  function findPlacement(doc, source, node, side, drop, F = root.CanvasFlowShapes, R = root.CanvasConnections) {
    const blocking = obstacles(doc, source);
    let routed = 0;
    for (const rect of candidates(doc, source, node, side, drop, F)) {
      const placed = { ...node, x: Math.round(rect.x), y: Math.round(rect.y) };
      if (blocking.some(o => overlap(placed, o))) continue;
      // Routing is the expensive check; a bounded number of free slots keeps a drop responsive.
      if (++routed > 48) break;
      for (const toPort of [OPPOSITE[side], 'auto']) {
        const route = R.routeEdges(doc.nodes.concat([placed]), [{ id: 'probe', fromInstanceId: source.id, toInstanceId: placed.id, fromPort: side, toPort }], { zoom: doc.viewport.zoom })[0];
        if (route && !route.unroutable && route.points.length) return { x: placed.x, y: placed.y, toPort };
      }
    }
    return null;
  }
  // A shape chosen from the panel. A flow source lends its look; other sources keep the defaults.
  function buildNode(source, shapeId, sameSize, F = root.CanvasFlowShapes) {
    const preset = F.defaults(shapeId);
    const base = { id: nodeId(), name: preset.label, width: sameSize ? source.width : preset.width, height: sameSize ? source.height : preset.height, ...(source.parentId ? { parentId: source.parentId } : {}) };
    if (preset.kind === 'text') return { ...base, type: 'text', text: '双击编辑文本', color: '', fontSize: 20 };
    const node = { ...base, type: preset.kind === 'ellipse' ? 'ellipse' : 'rect', text: '', color: preset.kind === 'ellipse' ? '#dfe9ff' : '#ffffff', fontSize: 16, textAlign: 'center', textColor: '#344155' };
    if (preset.kind === 'flow') node.flowShape = shapeId;
    if (isFlow(source, F)) for (const key of STYLE_KEYS) if (source[key] !== undefined && source[key] !== '') node[key] = source[key];
    return node;
  }
  // The same kind of object: type, flow shape, size and look carry over; identity, text and lock never do.
  function cloneNode(source, F = root.CanvasFlowShapes) {
    const node = { id: nodeId(), type: source.type, name: isFlow(source, F) ? F.defaults(source.flowShape).label : KIND_NAMES[source.type] || source.name || '', width: source.width, height: source.height, text: '', ...(source.parentId ? { parentId: source.parentId } : {}) };
    if (isFlow(source, F)) node.flowShape = source.flowShape;
    for (const key of [...STYLE_KEYS, 'radius', 'opacity', 'padding']) if (source[key] !== undefined && source[key] !== '') node[key] = source[key];
    return node;
  }

  function install(host) {
    const F = root.CanvasFlowShapes, R = root.CanvasConnections, NS = 'http://www.w3.org/2000/svg';
    const make = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
    const stage = document.querySelector('#stage'), world = document.querySelector('#world');
    const dots = make('svg', { class: 'flow-quick-dots', width: 1, height: 1 }); world.append(dots);
    const preview = make('svg', { class: 'flow-quick-preview', width: 1, height: 1 }); world.append(preview);
    const panel = document.createElement('div'); panel.id = 'flow-shape-picker'; panel.className = 'floating';
    panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', '插入图形'); panel.hidden = true; document.body.append(panel);
    // idle → press → (click | drag) → (connect | choose) → idle. Only `choose` keeps a pending
    // source in memory while the panel is open; nothing is written before a shape is chosen.
    let mode = 'idle', sourceId = null, side = 'right', pointerId = null, pointerKind = 'mouse', start = null, last = null, frame = 0;
    let hovered = null, dotted = null, dottedLift = 0, signature = '', invoker = null, menuWorld = null, lastUsed = -Infinity, pendingArrow = null, keyboardNav = false;
    const stateNode = id => host.state().nodes.find(n => n.id === id && n.type !== 'group' && !n.hidden);
    const editable = n => Boolean(n) && host.canEdit() && !host.blocked(n);
    const dottable = n => Boolean(n && !n.hidden && n.type !== 'group') && editable(n);
    const anchor = (n, s) => R.outlinePoint(n, s);
    const zoomOf = () => host.state().viewport.zoom;
    const nodeEls = () => world.querySelectorAll('.node');
    const insideStage = p => { const r = stage.getBoundingClientRect(); return p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom; };
    const overFloating = p => Boolean(document.elementFromPoint(p.clientX, p.clientY)?.closest('.floating,.canvas-identity'));
    const hoverAllowed = () => mode === 'idle' && pointerId == null && host.canEdit() && host.tool() === 'select' && !host.panning() && !host.editing?.() && !host.annotating?.() && !host.interacting?.();
    // A visible object title sits above its top edge; the top dot clears it.
    function titleLift(n) {
      const title = world.querySelector(`.node[data-id="${CSS.escape(n.id)}"] > .node-title`);
      return title && title.getClientRects().length ? title.getBoundingClientRect().height : 0;
    }
    function dotPoint(n, s, lift = 0) {
      const o = anchor(n, s), [dx, dy] = OUTWARD[s], off = (DOT_OFFSET + (s === 'top' ? lift : 0)) / zoomOf();
      return { x: o.x + dx * off, y: o.y + dy * off };
    }
    // Hover: the object under the pointer, or the one whose dots the pointer is heading for.
    function hoverTarget(e) {
      if (e.buttons || e.pointerType === 'touch' || !hoverAllowed()) return null;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('.floating,.canvas-identity')) return null;
      const dot = target?.closest('.flow-quick-dot');
      if (dot) return dot.dataset.nodeId;
      const el = target?.closest('.node'), under = el ? stateNode(el.dataset.id) : null;
      const w = host.worldPoint(e.clientX, e.clientY), reach = (DOT_HIT + 10) / zoomOf();
      // A hair of tolerance: the pointer exactly on an edge can round to the world just outside,
      // and its DOM hit lands on the bare stage.
      const inBox = (n, pad = 0) => w.x >= n.x - pad && w.x <= n.x + n.width + pad && w.y >= n.y - pad && w.y <= n.y + n.height + pad;
      const near = (n, lift) => SIDES.some(s => { const d = dotPoint(n, s, lift); return Math.hypot(w.x - d.x, w.y - d.y) <= reach; });
      // Keep the current object while the pointer crosses the gap to a dot, even over a background.
      const current = hovered ? stateNode(hovered) : null;
      if (dottable(current) && (!under || under.id === current.id || contains(under, current)) && (inBox(current) || near(current, current.id === dotted ? dottedLift : 0))) return current.id;
      // Otherwise the topmost object near the pointer: the one under it or anything resting on it.
      const nodes = host.state().nodes, pad = (DOT_OFFSET + DOT_HIT + 50) / zoomOf();
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (w.x < n.x - pad || w.x > n.x + n.width + pad || w.y < n.y - pad || w.y > n.y + n.height + pad) continue;
        if (!dottable(n) || (under && n.id !== under.id && !contains(under, n))) continue;
        // Outline shapes leave their box corners unpainted; those still belong to the shape.
        if (near(n, 0) || inBox(n, 6 / zoomOf())) return n.id;
      }
      return dottable(under) ? under.id : null;
    }
    function setHovered(id) { if (id !== hovered) { hovered = id; renderDots(); } }
    // Drop targets are magnetic like the connection ports: near a side counts as on the object.
    function nodeAt(p) {
      if (!insideStage(p) || overFloating(p)) return null;
      const el = document.elementsFromPoint(p.clientX, p.clientY).map(item => item.closest('.node')).find(Boolean);
      const under = el ? stateNode(el.dataset.id) : null, w = host.worldPoint(p.clientX, p.clientY);
      let best = null, distance = (pointerKind === 'touch' ? MAGNET_TOUCH : MAGNET) / zoomOf();
      for (const n of host.state().nodes) {
        if (n.type === 'group' || n.hidden || n.id === sourceId || host.blocked(n)) continue;
        if (under && under.id !== n.id && !contains(under, n)) continue;
        for (const s of SIDES) { const d = anchor(n, s), q = Math.hypot(w.x - d.x, w.y - d.y); if (q < distance) { distance = q; best = n; } }
      }
      return best || (under && under.id !== sourceId && !host.blocked(under) ? under : null);
    }
    function dropPort(p, node) {
      const w = host.worldPoint(p.clientX, p.clientY);
      let best = 'auto', distance = (pointerKind === 'touch' ? MAGNET_TOUCH : MAGNET) / zoomOf();
      for (const s of SIDES) {
        const d = anchor(node, s), q = Math.hypot(w.x - d.x, w.y - d.y);
        if (q < distance) { distance = q; best = s; }
      }
      return best;
    }
    function keepVisible(node) {
      const v = host.state().viewport, r = stage.getBoundingClientRect();
      const left = node.x * v.zoom + v.x, top = node.y * v.zoom + v.y;
      const dx = left < 48 ? 48 - left : Math.min(0, r.width - 48 - left - node.width * v.zoom);
      const dy = top < 100 ? 100 - top : Math.min(0, r.height - 120 - top - node.height * v.zoom);
      if (dx || dy) host.nudgeViewport?.(dx, dy);
    }
    function commit(fromId, fromSide, node, drop) {
      const doc = host.state(), source = stateNode(fromId);
      reset();
      if (!dottable(source)) return host.notice?.('源对象已不可编辑');
      if (doc.nodes.length >= 1000 || (doc.edges?.length || 0) >= 10000) return host.notice?.('画布对象已达上限，无法继续添加');
      const placement = findPlacement(doc, source, node, fromSide, drop);
      if (!placement) return host.notice?.('附近没有可连接的空位，请先挪开相邻对象');
      node.x = placement.x; node.y = placement.y;
      const edge = { id: edgeId(), fromInstanceId: source.id, toInstanceId: node.id, fromPort: fromSide, toPort: placement.toPort, label: '', kind: 'main', ...host.connectionStyle?.() };
      host.mutate(d => { d.nodes.push(node); (d.edges ||= []).push(edge); });
      keepVisible(node);
      host.select(node.id);
    }
    function connectExisting(fromId, fromSide, toNode, toPort) {
      const doc = host.state(), source = stateNode(fromId);
      reset();
      if (!dottable(source) || (doc.edges?.length || 0) >= 10000) return;
      const edge = { id: edgeId(), fromInstanceId: source.id, toInstanceId: toNode.id, fromPort: fromSide, toPort, label: '', kind: 'main', ...host.connectionStyle?.() };
      const route = R.routeEdges(doc.nodes, [edge], { zoom: doc.viewport.zoom })[0];
      if (!route || route.unroutable || !route.points.length) return host.notice?.('此处被遮挡，换一个连接点或拉开对象');
      host.mutate(d => { (d.edges ||= []).push(edge); });
    }
    function renderGhost() {
      frame = 0;
      if (mode !== 'drag' || !last) return;
      const doc = host.state(), source = stateNode(sourceId);
      if (!dottable(source) || host.tool() !== 'select') return cancel();
      const from = anchor(source, side), to = host.worldPoint(last.clientX, last.clientY), hit = nodeAt(last);
      let points = null, valid = false;
      if (hit) {
        const route = R.routeEdges(doc.nodes, [{ id: 'preview', fromInstanceId: source.id, toInstanceId: hit.id, fromPort: side, toPort: dropPort(last, hit) }], { zoom: doc.viewport.zoom })[0];
        valid = Boolean(route && !route.unroutable && route.points.length);
        if (valid) points = route.points;
      }
      for (const el of nodeEls()) el.classList.toggle('connection-target', valid && el.dataset.id === hit.id);
      if (!points) points = side === 'left' || side === 'right' ? [from, { x: (from.x + to.x) / 2, y: from.y }, { x: (from.x + to.x) / 2, y: to.y }, to] : [from, { x: from.x, y: (from.y + to.y) / 2 }, { x: to.x, y: (from.y + to.y) / 2 }, to];
      preview.replaceChildren(make('path', { d: pathOf(points), class: valid ? 'flow-ghost valid' : hit ? 'flow-ghost blocked' : 'flow-ghost', 'vector-effect': 'non-scaling-stroke', 'marker-end': 'url(#canvas-arrow-main)' }));
    }
    function clearPreview() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; preview.replaceChildren();
      for (const el of nodeEls()) el.classList.remove('connection-target');
      delete stage.dataset.flowQuickDrag;
    }
    function releasePointer() {
      const id = pointerId; pointerId = null;
      if (id != null && stage.hasPointerCapture?.(id)) stage.releasePointerCapture(id);
    }
    function closePanel(restoreFocus) {
      if (panel.hidden) return;
      panel.hidden = true; menuWorld = null;
      const target = invoker; invoker = null;
      if (restoreFocus) (target || stage).focus?.({ preventScroll: true });
    }
    // Drop every transient: preview, capture, pending source and the panel. No data changes.
    function reset() {
      const pending = mode !== 'idle';
      mode = 'idle'; sourceId = null; side = 'right'; start = null; last = null; pendingArrow = null;
      releasePointer(); clearPreview(); closePanel(pending);
      signature = ''; renderDots();
    }
    function cancel() { reset(); }
    function renderDots() {
      const zoom = zoomOf(), hover = hovered ? stateNode(hovered) : null;
      const chosen = dottable(hover) ? hover : host.selection?.() || null;
      // Hidden on tiny objects, where the dots would overlap, and on members of a multi-selection.
      const node = mode === 'idle' && hoverAllowed() && dottable(chosen) && !host.multiSelected?.(chosen.id) && Math.min(chosen.width, chosen.height) * zoom >= 36 ? chosen : null;
      const lift = node ? titleLift(node) : 0;
      dotted = node ? node.id : null; dottedLift = lift;
      const sig = node ? JSON.stringify([node.id, node.type, node.flowShape, node.x, node.y, node.width, node.height, Math.round(zoom * 1000) / 1000, Math.round(lift)]) : '';
      if (sig === signature) return;
      signature = sig; dots.replaceChildren();
      if (!node) return;
      const action = duplicable(node) ? '添加同类图形' : '添加图形';
      for (const s of SIDES) {
        // Dots float a constant 24px beyond the outline, clear of the selection frame's handles;
        // the connection itself still starts on the outline.
        const p = dotPoint(node, s, lift), turn = { right: 0, bottom: 90, left: 180, top: 270 }[s];
        const g = make('g', { class: 'flow-quick-dot', 'data-side': s, 'data-node-id': node.id, role: 'button', 'aria-label': `向${SIDE_LABELS[s]}${action}，拖动可连线` });
        g.append(make('circle', { class: 'dot-hit', cx: p.x, cy: p.y, r: DOT_HIT / zoom }), make('circle', { class: 'dot-core', cx: p.x, cy: p.y, r: 4.5 / zoom }),
          make('path', { class: 'dot-arrow', d: `M${p.x - 3 / zoom} ${p.y - 4.5 / zoom}L${p.x + 2.5 / zoom} ${p.y}L${p.x - 3 / zoom} ${p.y + 4.5 / zoom}`, transform: `rotate(${turn} ${p.x} ${p.y})` }));
        dots.append(g);
      }
    }
    function sync() {
      if (mode === 'choose' && (!dottable(stateNode(sourceId)) || host.tool() !== 'select')) return cancel();
      if ((mode === 'press' || mode === 'drag') && (!host.canEdit() || host.tool() !== 'select')) return cancel();
      if (!panel.hidden && mode === 'idle' && !host.canEdit()) closePanel(false);
      if (hovered && !hoverAllowed()) hovered = null;
      renderDots();
    }
    // Capture on document so the press never reaches node dragging or connection ports.
    document.addEventListener('pointerdown', e => {
      const target = e.target instanceof Element ? e.target : null;
      // A second finger (pinch) or pen during a held quick gesture cancels it without writing.
      if (pointerId != null && e.pointerId !== pointerId) return cancel();
      if (!panel.hidden && !target?.closest('#flow-shape-picker')) { cancel(); if (!target?.closest('.flow-quick-dot')) return; }
      const dot = target?.closest('.flow-quick-dot');
      if (!dot || e.button !== 0 || host.panning() || host.tool() !== 'select') return;
      const source = stateNode(dot.dataset.nodeId);
      if (!dottable(source)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      mode = 'press'; sourceId = source.id; side = dot.dataset.side; pointerId = e.pointerId; pointerKind = e.pointerType || 'mouse';
      start = { clientX: e.clientX, clientY: e.clientY }; last = start;
      stage.setPointerCapture?.(pointerId); stage.focus({ preventScroll: true });
    }, true);
    document.addEventListener('pointermove', e => {
      if (pointerId == null) return setHovered(hoverTarget(e));
      if (e.pointerId !== pointerId) return;
      last = { clientX: e.clientX, clientY: e.clientY };
      if (mode === 'press' && Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) >= 6) {
        mode = 'drag'; stage.dataset.flowQuickDrag = side; signature = ''; dots.replaceChildren(); dotted = null;
      }
      if (mode === 'drag' && !frame) frame = requestAnimationFrame(renderGhost);
    }, true);
    document.documentElement.addEventListener('mouseleave', () => setHovered(null));
    document.addEventListener('pointerup', e => {
      if (pointerId == null || e.pointerId !== pointerId) return;
      e.stopImmediatePropagation();
      lastUsed = performance.now();
      const from = sourceId, fromSide = side, at = { clientX: e.clientX, clientY: e.clientY };
      if (mode === 'press') {
        const source = stateNode(from);
        if (!source) return reset();
        if (duplicable(source)) return commit(from, fromSide, cloneNode(source), null);
        // Boards, text and images: choose the shape to add on this side, beside the dot.
        const dot = dots.querySelector(`[data-side="${fromSide}"] .dot-hit`)?.getBoundingClientRect();
        releasePointer(); mode = 'choose'; sourceId = from; side = fromSide; pendingArrow = null; drawPending();
        return openBeside(dot || { left: at.clientX, top: at.clientY, width: 0, height: 0 }, fromSide);
      }
      if (mode !== 'drag') return;
      const hit = nodeAt(at);
      if (hit) return connectExisting(from, fromSide, hit, dropPort(at, hit));
      if (!insideStage(at) || overFloating(at)) return cancel();
      // Blank canvas: keep only an in-memory pending source while the panel is open.
      releasePointer(); clearPreview();
      const drop = host.worldPoint(at.clientX, at.clientY), source = stateNode(from);
      if (!source) return cancel();
      mode = 'choose'; sourceId = from; side = fromSide;
      const end = anchor(source, fromSide);
      pendingArrow = fromSide === 'left' || fromSide === 'right' ? [end, { x: (end.x + drop.x) / 2, y: end.y }, { x: (end.x + drop.x) / 2, y: drop.y }, drop] : [end, { x: end.x, y: (end.y + drop.y) / 2 }, { x: drop.x, y: (end.y + drop.y) / 2 }, drop];
      drawPending();
      openPanel(at.clientX + 12, at.clientY + 12, drop, null);
    }, true);
    document.addEventListener('pointercancel', e => { if (pointerId != null && e.pointerId === pointerId) cancel(); }, true);
    stage.addEventListener('lostpointercapture', e => { if (pointerId != null && pointerId === e.pointerId) cancel(); });
    window.addEventListener('blur', () => { if (mode !== 'idle' || !panel.hidden) cancel(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || (mode === 'idle' && panel.hidden)) return;
      e.preventDefault(); e.stopImmediatePropagation(); cancel();
    }, true);
    function buildPanel() {
      for (const id of F.MENU) {
        const preset = F.defaults(id), button = document.createElement('button');
        button.type = 'button'; button.dataset.shape = id; button.title = preset.label;
        button.setAttribute('role', 'menuitem'); button.setAttribute('aria-label', preset.label);
        const box = F.iconBox(id);
        const icon = make('svg', { viewBox: `0 0 ${box.width} ${box.height}`, 'aria-hidden': 'true' });
        for (const d of F.paths(id, box.width, box.height)) icon.append(make('path', { d }));
        button.append(icon);
        button.addEventListener('click', () => choose(id));
        // Hover, or keyboard navigation, previews the landing spot; only a click commits.
        button.addEventListener('pointerenter', () => previewShape(id));
        button.addEventListener('pointerleave', () => previewShape(null));
        button.addEventListener('focus', () => { if (keyboardNav) previewShape(id); });
        panel.append(button);
      }
      // The initial focus on open is programmatic; only keys the user presses drive the preview.
      panel.addEventListener('keydown', () => { keyboardNav = true; }, true);
      panel.addEventListener('pointermove', () => { keyboardNav = false; });
      panel.addEventListener('focusout', e => { if (!panel.contains(e.relatedTarget)) previewShape(null); });
    }
    const pathOf = points => points.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
    const arrow = points => make('path', { d: pathOf(points), class: 'flow-ghost', 'vector-effect': 'non-scaling-stroke', 'marker-end': 'url(#canvas-arrow-main)' });
    function drawPending() { preview.replaceChildren(...(pendingArrow ? [arrow(pendingArrow)] : [])); }
    // Outline of a would-be node in world space: registry paths for flow shapes, plain box/ellipse otherwise.
    function outlineOf(node) {
      const w = node.width, h = node.height;
      if (node.flowShape) return F.paths(node.flowShape, w, h);
      return node.type === 'ellipse' ? [`M${w / 2} 0A${w / 2} ${h / 2} 0 1 0 ${w / 2} ${h}A${w / 2} ${h / 2} 0 1 0 ${w / 2} 0Z`] : [`M0 0H${w}V${h}H0Z`];
    }
    function previewShape(id) {
      if (mode !== 'choose') return;
      const doc = host.state(), source = stateNode(sourceId);
      if (!id || !source) return drawPending();
      const node = buildNode(source, id, false), spot = findPlacement(doc, source, node, side, menuWorld);
      if (!spot) return drawPending();
      const placed = { ...node, x: spot.x, y: spot.y };
      const route = R.routeEdges(doc.nodes.concat([placed]), [{ id: 'preview', fromInstanceId: source.id, toInstanceId: placed.id, fromPort: side, toPort: spot.toPort }], { zoom: doc.viewport.zoom })[0];
      const outline = make('g', { class: 'flow-shape-preview', transform: `translate(${placed.x} ${placed.y})` });
      for (const d of outlineOf(placed)) outline.append(make('path', { d, 'vector-effect': 'non-scaling-stroke' }));
      preview.replaceChildren(...(route?.points.length ? [arrow(route.points)] : []), outline);
    }
    function choose(id) {
      if (mode === 'choose') {
        const source = stateNode(sourceId);
        if (!source) return cancel();
        return commit(sourceId, side, buildNode(source, id, false), menuWorld);
      }
      const at = menuWorld;
      closePanel(false);
      host.insert?.(id, at);
    }
    function openPanel(x, y, world, focusTarget, flip = true) {
      if (!panel.children.length) buildPanel();
      invoker = focusTarget; menuWorld = world; keyboardNav = false;
      panel.hidden = false;
      const width = panel.offsetWidth, height = panel.offsetHeight;
      // Open beside the drop point; flip left/up when the panel would leave the viewport.
      const left = flip && x + width + 8 > innerWidth ? x - width - 24 : x, top = flip && y + height + 8 > innerHeight ? y - height - 24 : y;
      panel.style.left = Math.max(8, Math.min(innerWidth - width - 8, left)) + 'px';
      panel.style.top = Math.max(8, Math.min(innerHeight - height - 8, top)) + 'px';
      panel.querySelector('button')?.focus({ preventScroll: true });
    }
    // A clicked dot opens the panel on its own side, so the panel never covers the object.
    function openBeside(rect, s) {
      if (!panel.children.length) buildPanel();
      panel.hidden = false;
      const width = panel.offsetWidth, height = panel.offsetHeight, cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, gap = rect.width / 2 + 6;
      const x = s === 'right' ? cx + gap : s === 'left' ? cx - gap - width : cx - width / 2;
      const y = s === 'bottom' ? cy + gap : s === 'top' ? cy - gap - height : cy - height / 2;
      openPanel(x, y, null, null, false);
    }
    // Grid keyboard navigation; Enter/Space activate the focused native button.
    panel.addEventListener('keydown', e => {
      const buttons = [...panel.querySelectorAll('button')], index = buttons.indexOf(document.activeElement), columns = 5;
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, ArrowDown: index + columns, ArrowUp: index - columns, Home: 0, End: buttons.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault(); e.stopPropagation();
      buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
    });
    renderDots();
    return {
      sync, cancel,
      dottedNode: () => dotted,
      // Board iframes swallow pointer events; the editor reports which board the pointer is over.
      hover: id => setHovered(hoverAllowed() && dottable(stateNode(id)) ? id : null),
      // Screen rects of the dot hit areas; floating toolbars avoid covering them.
      dotRects: () => [...dots.querySelectorAll('.dot-hit')].map(dot => dot.getBoundingClientRect()),
      isActive: () => mode !== 'idle' || !panel.hidden,
      // A double press on dots must not reach the canvas "double-click blank → text" gesture.
      recentlyUsed: () => performance.now() - lastUsed < 500,
      // Toolbar and context menu reuse the grid; a chosen shape is inserted, not connected.
      openPicker(x, y, world = null, focusTarget = null) { if (mode !== 'idle') reset(); signature = ''; openPanel(x, y, world, focusTarget); }
    };
  }
  root.CanvasFlowQuickCreate = { install, findPlacement, buildNode, cloneNode };
})(globalThis);
