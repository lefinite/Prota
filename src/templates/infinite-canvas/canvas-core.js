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
  const api = { copy, uid, descendants, roots, locked, bounds, duplicate, reparent, validate };
  root.CanvasCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
