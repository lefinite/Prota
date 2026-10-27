(function(root) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const uid = () => "n_" + crypto.randomUUID().replaceAll("-", "");
  const descendants = (nodes, ids) => {
    const result = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) if (result.has(n.parentId) && !result.has(n.id)) {
        result.add(n.id);
        grew = true;
      }
    }
    return result;
  };
  const roots = (nodes, ids) => {
    const set = new Set(ids), map = new Map(nodes.map((n) => [n.id, n]));
    return nodes.filter((n) => {
      if (!set.has(n.id)) return false;
      let p = map.get(n.parentId);
      const seen = /* @__PURE__ */ new Set();
      while (p && !seen.has(p.id)) {
        if (set.has(p.id)) return false;
        seen.add(p.id);
        p = map.get(p.parentId);
      }
      return true;
    });
  };
  const locked = (nodes, node) => {
    const seen = /* @__PURE__ */ new Set();
    while (node && !seen.has(node.id)) {
      if (node.locked) return true;
      seen.add(node.id);
      node = nodes.find((n) => n.id === node.parentId);
    }
    return false;
  };
  const bounds = (nodes) => {
    if (!nodes.length) return null;
    const x = Math.min(...nodes.map((n) => n.x)), y = Math.min(...nodes.map((n) => n.y));
    return { x, y, width: Math.max(...nodes.map((n) => n.x + n.width)) - x, height: Math.max(...nodes.map((n) => n.y + n.height)) - y };
  };
  const duplicate = (nodes, ids, offset = 32) => {
    const rootNodes = roots(nodes, ids), all = descendants(nodes, rootNodes.map((n) => n.id)), mapping = new Map([...all].map((id) => [id, uid()]));
    const copies = nodes.filter((n) => all.has(n.id)).map((n) => {
      const c = { ...copy(n), id: mapping.get(n.id), x: n.x + offset, y: n.y + offset, locked: false };
      c.parentId = mapping.get(n.parentId) || n.parentId || null;
      if (rootNodes.includes(n)) c.name += " 副本";
      if (c.type === "board" && c.src) {
        c.cloneFrom = c.src;
        c.src = `boards/${c.id}/index.html`;
      }
      return c;
    });
    return { nodes: copies, selected: rootNodes.map((n) => mapping.get(n.id)) };
  };
  function reparent(nodes, ids, parentId) {
    const parents = nodes.filter((n) => n.id === parentId && ["board", "group"].includes(n.type));
    if (parentId && !parents.length) throw Error("只能移入画板或分组");
    if (descendants(nodes, ids).has(parentId)) throw Error("不能将对象移入自己的子级");
    for (const n of roots(nodes, ids)) if (!locked(nodes, n)) n.parentId = parentId || null;
  }
  function validate(state) {
    if (!state || state.schemaVersion !== 1 || !Array.isArray(state.nodes) || state.nodes.length > 1e3) throw Error("画布格式不正确");
    if (!state.viewport || !["x", "y", "zoom"].every((key) => Number.isFinite(state.viewport[key])) || state.viewport.zoom < 0.05 || state.viewport.zoom > 4) throw Error("画布视角无效");
    const map = /* @__PURE__ */ new Map();
    for (const n of state.nodes) {
      if (!n || typeof n.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(n.id) || map.has(n.id) || !["group", "board", "text", "note", "rect", "ellipse", "image"].includes(n.type)) throw Error("画布对象无效");
      map.set(n.id, n);
      for (const key of ["x", "y", "width", "height"]) if (!Number.isFinite(n[key]) || Math.abs(n[key]) > 1e7) throw Error("画布坐标无效");
      if (n.width < 16 || n.height < 16) throw Error("画布尺寸无效");
    }
    for (const n of state.nodes) {
      let p = n;
      const seen = /* @__PURE__ */ new Set();
      while (p.parentId) {
        if (seen.has(p.id)) throw Error("画布层级存在循环");
        seen.add(p.id);
        p = map.get(p.parentId);
        if (!p || !["board", "group"].includes(p.type)) throw Error("画布容器无效");
      }
    }
    return state;
  }
  function resizeSelection(base, items, handle, dx, dy, keepRatio = false) {
    if (!base || !items.length || base.width <= 0 || base.height <= 0) throw Error("选区尺寸无效");
    let sx = handle.includes("e") ? 1 + dx / base.width : handle.includes("w") ? 1 - dx / base.width : 1;
    let sy = handle.includes("s") ? 1 + dy / base.height : handle.includes("n") ? 1 - dy / base.height : 1;
    const minX = Math.max(...items.map((n) => 16 / n.width));
    const minY = Math.max(...items.map((n) => 16 / n.height));
    if (keepRatio) {
      const scale = handle.length === 1 ? ["e", "w"].includes(handle) ? sx : sy : Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
      sx = sy = Math.max(minX, minY, scale);
    } else {
      sx = Math.max(minX, sx);
      sy = Math.max(minY, sy);
    }
    const width = base.width * sx, height = base.height * sy;
    const x = handle.includes("w") ? base.x + base.width - width : handle.includes("e") ? base.x : base.x + (base.width - width) / 2;
    const y = handle.includes("n") ? base.y + base.height - height : handle.includes("s") ? base.y : base.y + (base.height - height) / 2;
    return items.map((n) => ({ id: n.id, x: x + (n.x - base.x) * sx, y: y + (n.y - base.y) * sy, width: n.width * sx, height: n.height * sy }));
  }
  function placeOverlay({ anchor, width, height, viewport, obstacles = [], placement = "toolbar", margin = 12, gap = 18 }) {
    const limitX = Math.max(margin, viewport.width - width - margin), limitY = Math.max(margin, viewport.height - height - margin);
    const clamp = (x, y) => ({ x: Math.max(margin, Math.min(limitX, x)), y: Math.max(margin, Math.min(limitY, y)), width, height });
    const cx = anchor.x + (anchor.width - width) / 2, cy = anchor.y + (anchor.height - height) / 2;
    const candidates = { above: clamp(cx, anchor.y - height - gap - 20), below: clamp(cx, anchor.y + anchor.height + gap), left: clamp(anchor.x - width - gap, cy), right: clamp(anchor.x + anchor.width + gap, cy) };
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const padded = { x: anchor.x - 7, y: anchor.y - 25, width: anchor.width + 14, height: anchor.height + 32 };
    let best = null, score = Infinity;
    for (const name of placement === "popover" ? ["right", "left", "below", "above"] : ["above", "below", "left", "right"]) {
      const rect = candidates[name], cost = overlap(rect, padded) * 3 + obstacles.reduce((sum, item) => {
        const area = overlap(rect, item);
        return sum + (area ? 1e9 + area : 0);
      }, 0);
      if (cost < score) {
        score = cost;
        best = { ...rect, placement: name };
      }
      if (cost === 0) break;
    }
    if (score > 0) {
      const xs = [margin, (viewport.width - width) / 2, limitX];
      const ys = [margin, 70, (viewport.height - height) / 2, viewport.height - height - 92, ...obstacles.flatMap((o) => [o.y - height - gap, o.y + o.height + gap])];
      for (const x of xs) for (const y of ys) {
        const rect = clamp(x, y), cost = overlap(rect, padded) * 3 + obstacles.reduce((sum, item) => {
          const area = overlap(rect, item);
          return sum + (area ? 1e9 + area : 0);
        }, 0);
        if (cost < score) {
          score = cost;
          best = { ...rect, placement: "viewport" };
        }
      }
    }
    return best;
  }
  function mergeDocuments(base, local, remote) {
    const byId = (doc) => new Map(doc.nodes.map((n) => [n.id, n]));
    const b = byId(base), l = byId(local), r = byId(remote), merged = /* @__PURE__ */ new Map(), conflicts = [];
    const normalize = (value) => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])])) : value;
    const equal = (a, b2) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b2));
    for (const id of /* @__PURE__ */ new Set([...r.keys(), ...l.keys(), ...b.keys()])) {
      const original = b.get(id), ours = l.get(id), theirs = r.get(id);
      let next;
      if (equal(ours, original)) next = theirs;
      else if (equal(theirs, original) || equal(ours, theirs)) next = ours;
      else if (ours && theirs) {
        next = {};
        let disputed = false;
        for (const key of /* @__PURE__ */ new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(original || {})])) {
          const before = original?.[key], a = ours[key], b2 = theirs[key];
          let value;
          if (equal(a, before)) value = b2;
          else if (equal(b2, before) || equal(a, b2)) value = a;
          else {
            disputed = true;
            value = a;
          }
          if (value !== void 0) next[key] = copy(value);
        }
        if (disputed) conflicts.push(id);
      } else {
        conflicts.push(id);
        next = ours;
      }
      if (next) merged.set(id, copy(next));
    }
    const order = equal(local.nodes.map((n) => n.id), base.nodes.map((n) => n.id)) ? remote.nodes : local.nodes;
    const nodes = [...order.map((n) => n.id), ...merged.keys()].filter((id, i, all) => all.indexOf(id) === i && merged.has(id)).map((id) => merged.get(id));
    for (const n of nodes) if (n.parentId && !merged.has(n.parentId)) n.parentId = null;
    const result = { ...copy(remote), nodes, viewport: copy(local.viewport) };
    validate(result);
    return { state: result, conflicts };
  }
  const api = { copy, uid, descendants, roots, locked, bounds, duplicate, reparent, validate, resizeSelection, placeOverlay, mergeDocuments };
  root.CanvasCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
