// Pure flowchart shape registry. Classic script so file:// canvases load it offline.
// Shapes stay rect nodes carrying a controlled flowShape id; SVG draws outline paths only,
// node text remains HTML so in-place editing, selection and layout measurement keep working.
(function(root) {
  'use strict';
  // The validated enum shared verbatim with canvas-domain.js and server/canvas_domain.py.
  const KINDS = ['terminator', 'process', 'decision', 'subprocess', 'connector', 'document', 'rounded-rect', 'database', 'hexagon-notched', 'hexagon-arrow', 'parallelogram', 'speech-bubble', 'triangle-right', 'triangle', 'trapezoid', 'star', 'hexagon', 'pentagon', 'octagon', 'arrow-right', 'arrow-both', 'cloud', 'callout', 'brace', 'cross'];
  const deg = Math.PI / 180;
  const star = (() => { const points = []; for (let i = 0; i < 10; i++) { const radius = i % 2 ? .2 : .5, angle = (-90 + i * 36) * deg; points.push([.5 + radius * Math.cos(angle), .52 + radius * Math.sin(angle)]); } return points; })();
  // Cloud: closed cubic segments in unit space. The outline is sampled from the same curves
  // so its ports sit on the drawn edge.
  const CLOUD = [[.22, .86], [[.07, .86], [.02, .7], [.11, .61]], [[.02, .47], [.12, .32], [.27, .35]], [[.3, .15], [.52, .09], [.6, .23]], [[.7, .09], [.92, .17], [.88, .38]], [[1, .45], [.99, .72], [.84, .77]], [[.83, .88], [.71, .92], [.63, .86]], [[.53, .95], [.32, .95], [.22, .86]]];
  const cubic = (a, b, c, d, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; };
  const cloudOutline = (() => { const points = []; let from = CLOUD[0]; for (const [b, c, d] of CLOUD.slice(1)) { for (let i = 0; i < 12; i++) points.push(cubic(from, b, c, d, i / 12)); from = d; } return points; })();
  // Closed unit outlines power both rendering and outline-accurate ports. null means
  // the bounding box midpoints already sit on the outline (rect/capsule/ellipse family).
  const PRESETS = {
    terminator: { label: '开始 / 结束', text: '开始', width: 180, height: 64, capsule: true },
    process: { label: '流程矩形', text: '处理步骤', width: 220, height: 88 },
    decision: { label: '判断', text: '是否满足条件？', width: 220, height: 152, outline: [[.5, 0], [1, .5], [.5, 1], [0, .5]], inset: .2 },
    subprocess: { label: '子流程', text: '子流程', width: 220, height: 88, lines: [[.08, 0, .08, 1], [.92, 0, .92, 1]] },
    connector: { label: '连接圆点', text: 'A', width: 64, height: 64, ellipse: true },
    document: { label: '文档', text: '文档', width: 200, height: 140, outline: [[0, 0], [1, 0], [1, .82], [.5, .82], [0, .82]] },
    'rounded-rect': { label: '圆角矩形', text: '圆角矩形', width: 220, height: 88, radius: .18 },
    database: { label: '数据库', text: '数据库', width: 180, height: 140, cylinder: true },
    'hexagon-notched': { label: '凹角六边形', text: '预置处理', width: 220, height: 100, outline: [[0, 0], [1, 0], [.86, .5], [1, 1], [0, 1], [.14, .5]], inset: .12 },
    'hexagon-arrow': { label: '箭头式六边形', text: '流转', width: 220, height: 100, outline: [[0, 0], [.7, 0], [1, .5], [.7, 1], [0, 1], [.18, .5]], inset: .14 },
    parallelogram: { label: '平行四边形', text: '输入 / 输出', width: 220, height: 100, outline: [[.16, 0], [1, 0], [.84, 1], [0, 1]], inset: .12 },
    'speech-bubble': { label: '对话气泡', text: '对话内容', width: 200, height: 140, outline: [[0, 0], [1, 0], [1, .7], [0, .7]] },
    'triangle-right': { label: '直角三角形', text: '', width: 160, height: 140, outline: [[0, 0], [1, 1], [0, 1]], inset: .2 },
    triangle: { label: '三角形', text: '', width: 180, height: 140, outline: [[.5, 0], [1, 1], [0, 1]], inset: .16 },
    trapezoid: { label: '梯形', text: '手动操作', width: 220, height: 100, outline: [[.18, 0], [.82, 0], [1, 1], [0, 1]], inset: .14 },
    star: { label: '星形', text: '重点', width: 180, height: 180, outline: star, inset: .22 },
    hexagon: { label: '六边形', text: '准备', width: 220, height: 110, outline: [[.22, 0], [.78, 0], [1, .5], [.78, 1], [.22, 1], [0, .5]], inset: .1 },
    pentagon: { label: '五边形', text: '', width: 180, height: 170, outline: [[.5, 0], [1, .38], [.8, 1], [.2, 1], [0, .38]], inset: .18 },
    octagon: { label: '八边形', text: '', width: 180, height: 180, outline: [[.3, 0], [.7, 0], [1, .3], [1, .7], [.7, 1], [.3, 1], [0, .7], [0, .3]], inset: .14 },
    'arrow-right': { label: '右箭头', text: '流转方向', width: 220, height: 100, outline: [[0, .3], [.66, .3], [.66, 0], [1, .5], [.66, 1], [.66, .7], [0, .7]], inset: .08 },
    'arrow-both': { label: '双向箭头', text: '双向', width: 240, height: 100, outline: [[0, .5], [.2, .28], [.2, .4], [.8, .4], [.8, .28], [1, .5], [.8, .72], [.8, .6], [.2, .6], [.2, .72]], inset: .16 },
    cloud: { label: '云朵', text: '云端', width: 220, height: 140, outline: cloudOutline, inset: .16 },
    callout: { label: '备注气泡', text: '备注说明', width: 220, height: 160, outline: [[0, 0], [1, 0], [1, .7], [0, .7]] },
    brace: { label: '大括号', text: '', width: 80, height: 220, outline: [[0, .5], [.23, .2], [.42, .05], [1, .05], [1, .95], [.42, .95], [.23, .8]] },
    cross: { label: '加号', text: '', width: 140, height: 140, outline: [[.4, 0], [.6, 0], [.6, .4], [1, .4], [1, .6], [.6, .6], [.6, 1], [.4, 1], [.4, .6], [0, .6], [0, .4], [.4, .4]] },
    // Picker-only entries; they create plain text/ellipse nodes without a flowShape id.
    text: { label: '文本', kind: 'text', width: 240, height: 80 },
    circle: { label: '圆形', kind: 'ellipse', width: 140, height: 140 }
  };
  // 开始/结束 leads the picker; the three core flow shapes follow; the two legacy shapes close the list.
  const MENU = ['terminator', 'rounded-rect', 'decision', 'process', 'text', 'document', 'circle', 'database', 'hexagon-notched', 'hexagon-arrow', 'parallelogram', 'speech-bubble', 'triangle-right', 'triangle', 'trapezoid', 'star', 'hexagon', 'pentagon', 'octagon', 'arrow-right', 'arrow-both', 'cloud', 'callout', 'brace', 'cross', 'subprocess', 'connector'];
  const round = value => Math.round(value * 100) / 100;
  const polygonPath = (outline, w, h) => outline.map(([x, y], i) => (i ? 'L' : 'M') + round(x * w) + ' ' + round(y * h)).join('') + 'Z';
  function shapePaths(id, w, h) {
    const preset = PRESETS[id];
    if (!preset) return [];
    if (id === 'text') return ['M5 5h14M12 5v15'];
    if (id === 'circle') return ['M12 3a9 9 0 1 0 .01 0Z'];
    if (preset.capsule) {
      const r = Math.min(w, h) / 2;
      return [`M${r} 0L${w - r} 0A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 ${r} 0Z`];
    }
    if (id === 'rounded-rect') {
      const r = Math.min(w * .18, h / 2, w / 2);
      return [`M${r} 0L${w - r} 0Q${w} 0 ${w} ${r}L${w} ${h - r}Q${w} ${h} ${w - r} ${h}L${r} ${h}Q0 ${h} 0 ${h - r}L0 ${r}Q0 0 ${r} 0Z`];
    }
    if (preset.cylinder) {
      const ry = h * .16;
      return [`M0 ${ry}A${w / 2} ${ry} 0 0 1 ${w} ${ry}L${w} ${h - ry}A${w / 2} ${ry} 0 0 1 0 ${h - ry}Z`, `M0 ${ry}A${w / 2} ${ry} 0 0 0 ${w} ${ry}`, `M0 ${h - ry}A${w / 2} ${ry} 0 0 0 ${w} ${h - ry}`];
    }
    if (preset.ellipse) return [`M${w / 2} 0A${w / 2} ${h / 2} 0 1 0 ${w / 2} ${h}A${w / 2} ${h / 2} 0 1 0 ${w / 2} 0Z`];
    if (id === 'document') return [`M0 0L${w} 0L${w} ${h * .82}C${w * .8} ${h * .7} ${w * .64} ${h * .95} ${w * .5} ${h * .82}C${w * .36} ${h * .7} ${w * .2} ${h * .94} 0 ${h * .82}Z`];
    // Speech bubble: rounded body, tail at the lower left. Callout: square body, tail at the lower right.
    if (id === 'speech-bubble') {
      const r = Math.min(w, h * .7) * .14, b = h * .7;
      return [`M${r} 0L${w - r} 0Q${w} 0 ${w} ${r}L${w} ${b - r}Q${w} ${b} ${w - r} ${b}L${w * .36} ${b}L${w * .14} ${h}L${w * .2} ${b}L${r} ${b}Q0 ${b} 0 ${b - r}L0 ${r}Q0 0 ${r} 0Z`];
    }
    if (id === 'callout') return [`M0 0L${w} 0L${w} ${h * .7}L${w * .82} ${h * .7}L${w * .9} ${h}L${w * .62} ${h * .7}L0 ${h * .7}Z`];
    if (id === 'brace') {
      const tip = w * .42, mid = h / 2;
      return [`M${w} ${h * .05}L${tip} ${h * .05}Q${tip * .55} ${h * .05} ${tip * .55} ${h * .2}L${tip * .55} ${mid - h * .16}Q${tip * .55} ${mid - h * .05} 0 ${mid}Q${tip * .55} ${mid + h * .05} ${tip * .55} ${mid + h * .16}L${tip * .55} ${h * .8}Q${tip * .55} ${h * .95} ${tip} ${h * .95}L${w} ${h * .95}`];
    }
    if (id === 'cloud') {
      const at = ([x, y]) => round(x * w) + ' ' + round(y * h);
      return ['M' + at(CLOUD[0]) + CLOUD.slice(1).map(([b, c, d]) => 'C' + at(b) + ' ' + at(c) + ' ' + at(d)).join('') + 'Z'];
    }
    if (preset.lines) {
      const paths = [polygonPath([[0, 0], [1, 0], [1, 1], [0, 1]], w, h)];
      for (const [x1, , x2] of preset.lines) paths.push(`M${round(x1 * w)} 0L${round(x2 * w)} ${h}`);
      return paths;
    }
    return [polygonPath(preset.outline || [[0, 0], [1, 0], [1, 1], [0, 1]], w, h)];
  }
  // Ports sit where the up/right/down/left rays through the node center leave the outline.
  const endpointCache = new Map();
  function rayHit(points, from, dx, dy) {
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / den;
      if (t <= 1e-6) continue;
      const hitX = from.x + dx * t, hitY = from.y + dy * t;
      const u = Math.abs(ex) >= Math.abs(ey) ? (hitX - a.x) / (ex || 1e-9) : (hitY - a.y) / (ey || 1e-9);
      if (u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
    }
    return best === Infinity ? null : { x: from.x + dx * best, y: from.y + dy * best };
  }
  function endpoint(id, side, w, h) {
    const preset = PRESETS[id];
    if (!preset || !preset.outline) return side === 'top' ? { x: w / 2, y: 0 } : side === 'right' ? { x: w, y: h / 2 } : side === 'bottom' ? { x: w / 2, y: h } : { x: 0, y: h / 2 };
    // Routing asks for the same ports many times per frame; outline hits are cached by geometry.
    const key = id + '|' + side + '|' + w + '|' + h;
    let point = endpointCache.get(key);
    if (!point) {
      const points = preset.outline.map(([x, y]) => ({ x: x * w, y: y * h }));
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length, cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      const hit = rayHit(points, { x: cx, y: cy }, side === 'right' ? 1 : side === 'left' ? -1 : 0, side === 'bottom' ? 1 : side === 'top' ? -1 : 0);
      // Snap float noise so vertices on the box (diamond, triangle apex) equal the exact midpoints.
      const snap = (value, marks) => marks.find(mark => Math.abs(value - mark) < 1e-6 * Math.max(1, w, h)) ?? value;
      point = hit ? { x: snap(hit.x, [0, w / 2, w]), y: snap(hit.y, [0, h / 2, h]) } : endpoint('', side, w, h);
      if (endpointCache.size > 4096) endpointCache.clear();
      endpointCache.set(key, point);
    }
    return { x: point.x, y: point.y };
  }
  const defaults = id => { const preset = PRESETS[id] || {}; return { label: preset.label || id, text: preset.text ?? '', width: preset.width || 220, height: preset.height || 100, kind: preset.kind || 'flow' }; };
  const inset = id => (PRESETS[id] || {}).inset || 0;
  const kindSet = new Set(KINDS);
  // Icon boxes keep the preset's real proportions: drawn square, the terminator capsule collapses into a circle.
  const iconBox = id => {
    const box = { width: 24, height: 24 };
    if (!kindSet.has(id)) return box;
    const preset = PRESETS[id], scale = 24 / Math.max(preset.width, preset.height);
    return { width: Math.round(preset.width * scale * 100) / 100, height: Math.round(preset.height * scale * 100) / 100 };
  };
  root.CanvasFlowShapes = Object.freeze({ KINDS: Object.freeze([...KINDS]), MENU: Object.freeze([...MENU]), PRESETS, has: id => kindSet.has(id), paths: shapePaths, endpoint, defaults, inset, iconBox });
})(globalThis);
