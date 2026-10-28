// Pure document contracts. No DOM, storage, network, or implicit writes.
(function(root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const full = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
  const identity = value => full(/^[a-zA-Z0-9_-]{1,80}$/, value);
  const number = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
  function createIndex(nodes) {
    const byId = new Map(), children = new Map(), boards = new Map();
    for (const node of nodes) {
      byId.set(node.id, node);
      const key = node.parentId || null;
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(node);
      if (node.type === 'board' && node.boardId) {
        if (!boards.has(node.boardId)) boards.set(node.boardId, []);
        boards.get(node.boardId).push(node);
      }
    }
    return { byId, children, boards };
  }
  function validate(state) {
    if (!state || ![1, 2].includes(state.schemaVersion) || !Array.isArray(state.nodes) || state.nodes.length > 1000) throw Error('画布格式不正确');
    if (!Number.isSafeInteger('revision' in state ? state.revision : 0) || ('revision' in state ? state.revision : 0) < 0) throw Error('画布 revision 无效');
    const v = state.viewport;
    if (!v || !number(v.x, -1e7, 1e7) || !number(v.y, -1e7, 1e7) || !number(v.zoom, .05, 4)) throw Error('画布视角无效');
    const ids = new Set();
    for (const n of state.nodes) {
      if (!n || !identity(n.id) || ids.has(n.id) || !['board','group','text','note','rect','ellipse','image'].includes(n.type)) throw Error('画布对象无效');
      ids.add(n.id);
      if (!number(n.x, -1e7, 1e7) || !number(n.y, -1e7, 1e7) || !number(n.width, 16, 1e7) || !number(n.height, 16, 1e7)) throw Error('画布坐标或尺寸无效');
      if (n.parentId != null && typeof n.parentId !== 'string') throw Error('画布容器无效');
      for (const key of ['name','text','src','color']) if (key in n && typeof n[key] !== 'string') throw Error('对象属性无效');
      const src = n.src || '';
      if (n.type === 'board' && src && !full(/^boards\/[a-zA-Z0-9_-]+\/index\.html$/, src)) throw Error('画板只能引用本版本 boards 目录');
      if (n.type === 'image' && src && !(/^data:image\/(png|jpeg|webp|gif);base64,/.test(src) || full(/^assets\/[a-zA-Z0-9_.-]+$/, src))) throw Error('图片必须保存在当前版本');
      if ('cloneFrom' in n && (n.type !== 'board' || !full(/^boards\/[a-zA-Z0-9_-]+\/index\.html$/, n.cloneFrom))) throw Error('复制画板来源无效');
      for (const [key, low, high] of [['opacity',0,1],['radius',0,1000],['fontSize',8,400],['fontWeight',100,900],['padding',0,10000]]) if (key in n && !number(n[key], low, high)) throw Error('样式属性无效');
      if ('textAlign' in n && !['left','center','right','justify'].includes(n.textAlign)) throw Error('文字对齐属性无效');
      if (state.schemaVersion === 2 && n.type === 'board') {
        if (!identity(n.boardId) || !('boardRevisionId' in n) || (n.boardRevisionId !== null && !identity(n.boardRevisionId))) throw Error('画板版本身份无效');
        if ('originBoardId' in n && !identity(n.originBoardId)) throw Error('画板来源身份无效');
      }
    }
    const { byId } = createIndex(state.nodes);
    for (let node of state.nodes) {
      const seen = new Set();
      while (node.parentId) {
        if (seen.has(node.id)) throw Error('画布层级存在循环');
        seen.add(node.id); node = byId.get(node.parentId);
        if (!node || !['board','group'].includes(node.type)) throw Error('画布容器无效');
      }
    }
    if (state.schemaVersion === 2 || "edges" in state) {
      if (!Array.isArray(state.edges) || state.edges.length > 10000) throw Error('画布连线无效');
      const edges = new Set();
      for (const edge of state.edges) {
        // Missing endpoints retain their identity for the future broken-link UI.
        if (!edge || !identity(edge.id) || edges.has(edge.id) || !identity(edge.fromInstanceId) || !identity(edge.toInstanceId)) throw Error('画布连线身份无效');
        if ('label' in edge && (typeof edge.label !== 'string' || edge.label.length > 200)) throw Error('连线文案最多 200 字');
        if ('kind' in edge && !['main','secondary','exception'].includes(edge.kind)) throw Error('连线类型无效');
        for (const key of ['fromPort','toPort']) if (key in edge && !['auto','left','right','top','bottom'].includes(edge[key])) throw Error('连线连接位置无效');
        if ('fontSize' in edge && !number(edge.fontSize, 8, 64)) throw Error('连线字号无效');
        edges.add(edge.id);
      }
    }
    return state;
  }
  // SHA-256 is used only as a reproducible identity namespace, never as authentication.
  // Synchronous hashing keeps the classic-script/file:// startup contract intact.
  function hash(text) {
    const bytes = new TextEncoder().encode(text), size = Math.ceil((bytes.length + 9) / 64) * 64;
    const buffer = new Uint8Array(size); buffer.set(bytes); buffer[bytes.length] = 128;
    const view = new DataView(buffer.buffer);
    view.setUint32(size - 8, Math.floor(bytes.length / 0x20000000));
    view.setUint32(size - 4, (bytes.length * 8) >>> 0);
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const rotate = (v, n) => (v >>> n) | (v << (32 - n));
    for (let offset = 0; offset < size; offset += 64) {
      const w = new Int32Array(64);
      for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i-15], b = w[i-2];
        w[i] = (w[i-16] + (rotate(a,7) ^ rotate(a,18) ^ (a >>> 3)) + w[i-7] + (rotate(b,17) ^ rotate(b,19) ^ (b >>> 10))) | 0;
      }
      let [a,b,c,d,e,f,g,j] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (j + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
        const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      [a,b,c,d,e,f,g,j].forEach((value, i) => h[i] = (h[i] + value) | 0);
    }
    return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function migrateV1(state, { projectId = '', pageId = '' } = {}) {
    const next = copy(state);
    for (const node of next.nodes) if (node.type === 'board') {
      if (!node.boardId) {
        // Stable across vN copies. The scope deliberately excludes the version.
        const source = JSON.stringify(['prota-board-v1', projectId, pageId, node.id]);
        node.boardId = 'b_' + hash(source).slice(0, 32);
      }
      if (!('boardRevisionId' in node)) node.boardRevisionId = null;
    }
    next.schemaVersion = 2;
    if (!('edges' in next)) next.edges = [];
    return next;
  }
  const migrations = new Map([[1, migrateV1]]);
  function load(document, scope = {}, { migrate = true } = {}) {
    validate(document);
    let result = copy(document);
    if (migrate) while (result.schemaVersion < 2) {
      const migration = migrations.get(result.schemaVersion);
      if (!migration) throw Error('缺少画布迁移程序');
      result = migration(result, scope);
    }
    validate(result);
    return result;
  }
  root.CanvasDomain = Object.freeze({ schemaVersion: 2, validate, load, createIndex });
})(globalThis);
