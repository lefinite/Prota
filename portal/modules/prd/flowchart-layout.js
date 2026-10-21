const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function textWidth(text, size = 14) {
    return Array.from(String(text)).reduce((width, char) => width + (/\s/.test(char) ? size * 0.3
        : char.codePointAt(0) > 127 ? size : /[MW@]/.test(char) ? size * 0.8 : size * 0.55), 0);
}

export function wrapFlowchartLabel(text, maxWidth, size = 14) {
    const lines = [];
    for (const paragraph of String(text).replace(/<br\s*\/?\s*>/gi, '\n').split('\n')) {
        let current = '';
        for (const char of Array.from(paragraph)) {
            if (current && textWidth(current + char, size) > maxWidth) {
                const space = current.lastIndexOf(' ');
                if (space > 0) {
                    lines.push(current.slice(0, space));
                    current = current.slice(space + 1) + char;
                } else {
                    lines.push(current);
                    current = char;
                }
            } else current += char;
        }
        lines.push(current || '\u200b');
    }
    return lines;
}

function reorderRows(rows, edges, byId) {
    const related = (node, incoming) => edges.filter((edge) => incoming ? edge.end === node.id : edge.start === node.id)
        .map((edge) => byId.get(incoming ? edge.start : edge.end))
        .filter((other) => incoming ? other.rank < node.rank : other.rank > node.rank);
    // Alternate downward and upward barycenter sweeps. This untangles crossed
    // branches without changing edges or moving nodes out of their level.
    for (let pass = 0; pass < 4; pass += 1) {
        for (const incoming of [true, false]) {
            const orderedRows = incoming ? rows : rows.toReversed();
            for (const row of orderedRows) {
                const position = (node) => {
                    const peers = rows[node.rank];
                    return peers.indexOf(node) - (peers.length - 1) / 2;
                };
                const scores = new Map(row.map((node) => {
                    const neighbors = related(node, incoming);
                    return [node.id, neighbors.length ? neighbors.reduce((sum, other) => sum + position(other), 0) / neighbors.length : position(node)];
                }));
                row.sort((a, b) => scores.get(a.id) - scores.get(b.id));
            }
        }
    }
}

// Keep ordinary business flows on a level grid. Retry/cross-branch edges do
// not push an earlier decision below the steps that depend on it.
export function layoutFlowchart(data, options = {}) {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    if (!nodes.length || !['TD', 'TB'].includes(data.direction)
        || nodes.some((node) => node.isGroup || !['squareRect', 'rect', 'rounded', 'diamond'].includes(node.shape)
            || node.cssStyles?.length || node.cssCompiledStyles?.length || node.labelStyle || node.link
            || (node.look && node.look !== 'classic')
            || /<(?!br\s*\/?\s*>)/i.test(node.label))
        || edges.some((edge) => edge.start === edge.end || edge.arrowTypeStart !== 'none'
            || !['arrow_point', 'arrow_open'].includes(edge.type) || edge.style?.length
            || edge.cssCompiledStyles?.length || edge.labelStyle?.length)) return null;
    const byId = new Map(nodes.map((node) => [node.id, { ...node, rank: Infinity }]));
    if (edges.some((edge) => !byId.has(edge.start) || !byId.has(edge.end))) return null;
    const solid = edges.filter((edge) => edge.pattern !== 'dotted');
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    const incoming = new Set();
    solid.forEach((edge) => { outgoing.get(edge.start).push(edge); incoming.add(edge.end); });
    let roots = nodes.filter((node) => !incoming.has(node.id));
    if (!roots.length) roots = [nodes[0]];
    const queue = roots.map((node) => byId.get(node.id));
    queue.forEach((node) => { node.rank = 0; });
    for (let index = 0; index < queue.length; index += 1) {
        const node = queue[index];
        outgoing.get(node.id).forEach((edge) => {
            const target = byId.get(edge.end);
            if (target.rank === Infinity) { target.rank = node.rank + 1; queue.push(target); }
        });
    }
    if (Array.from(byId.values()).some((node) => !Number.isFinite(node.rank))) return null;
    const initialRanks = new Map(Array.from(byId, ([id, node]) => [id, node.rank]));
    const forward = solid.filter((edge) => initialRanks.get(edge.end) > initialRanks.get(edge.start)
        || (initialRanks.get(edge.end) === initialRanks.get(edge.start)
            && !outgoing.get(edge.end).length));
    Array.from(byId.values()).sort((a, b) => a.rank - b.rank).forEach((node) => {
        forward.filter((edge) => edge.start === node.id).forEach((edge) => {
            const target = byId.get(edge.end);
            target.rank = Math.max(target.rank, node.rank + 1);
        });
    });
    const rows = [];
    byId.forEach((node) => { (rows[node.rank] ||= []).push(node); });
    if (options.reorder) reorderRows(rows, solid, byId);
    const nodeWidth = Math.max(224, Math.min(320, Math.max(...nodes.flatMap((node) => String(node.label).replace(/<br\s*\/?\s*>/gi, '\n').split('\n').map((line) => textWidth(line)))) + 40));
    byId.forEach((node) => {
        node.lines = wrapFlowchartLabel(node.label, node.shape === 'diamond' ? nodeWidth * 0.65 - 24 : nodeWidth - 40);
        node.width = nodeWidth;
    });
    const rectangleHeight = Math.max(64, ...Array.from(byId.values()).filter((node) => node.shape !== 'diamond').map((node) => node.lines.length * 21 + 32));
    const diamondHeight = Math.max(112, ...Array.from(byId.values()).filter((node) => node.shape === 'diamond').map((node) => {
        const textBand = (node.lines.length - 1) * 21 / 2 + 8;
        const textRatio = (Math.max(...node.lines.map((line) => textWidth(line))) + 32) / nodeWidth;
        return Math.ceil(2 * textBand / Math.max(0.1, 1 - textRatio));
    }));
    const edgeLabels = edges.map((edge) => wrapFlowchartLabel(edge.label || '', 140, 12));
    const maxLabelWidth = Math.max(0, ...edgeLabels.flatMap((lines) => lines.map((line) => textWidth(line, 12) + 18)));
    const gap = Math.max(152, maxLabelWidth + 32) * (options.gapFactor || 1);
    const rowGap = Math.max(88, Math.max(...edgeLabels.map((lines) => lines.length * 18 + 6)) + 32) * (options.rowGapFactor || 1);
    const laneCounts = { left: 0, right: 0 };
    edges.forEach((edge) => {
        const from = byId.get(edge.start), to = byId.get(edge.end);
        if (to.rank === from.rank || (to.rank === from.rank + 1 && edge.pattern !== 'dotted')) return;
        const row = rows[from.rank];
        laneCounts[row.indexOf(from) < (row.length - 1) / 2 ? 'left' : 'right'] += 1;
    });
    const margin = Math.max(140, 92 + Math.max(0, Math.max(laneCounts.left, laneCounts.right) - 1) * 26 + maxLabelWidth / 2 + 24);
    const columns = Math.max(...rows.map((row) => row.length));
    const width = margin * 2 + columns * nodeWidth + (columns - 1) * gap;
    let top = 36;
    rows.forEach((row) => {
        const height = row.some((node) => node.shape === 'diamond') ? Math.max(diamondHeight, rectangleHeight) : rectangleHeight;
        row.forEach((node, index) => {
            node.width = nodeWidth;
            node.height = node.shape === 'diamond' ? diamondHeight : rectangleHeight;
            node.x = width / 2 + (index - (row.length - 1) / 2) * (nodeWidth + gap);
            node.y = top + height / 2;
        });
        top += height + rowGap;
    });
    return { nodes: Array.from(byId.values()), edges, width,
        height: top - rowGap + (options.detourSameRank ? Math.max(36, rowGap / 2 + 32) : 36), rowGap };
}

function boxesOverlap(a, b) {
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
}

function boxHitsNode(box, node) {
    const x = Math.max(box.left, Math.min(box.right, node.x));
    const y = Math.max(box.top, Math.min(box.bottom, node.y));
    return node.shape === 'diamond'
        ? Math.abs(x - node.x) / (node.width / 2) + Math.abs(y - node.y) / (node.height / 2) < 0.98
        : Math.abs(x - node.x) < node.width / 2 - 1 && Math.abs(y - node.y) < node.height / 2 - 1;
}

function segmentBox(a, b) {
    return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
}

function segmentsIntersect(a, b, c, d) {
    const first = segmentBox(a, b), second = segmentBox(c, d);
    const horizontalA = a.y === b.y, horizontalB = c.y === d.y;
    if (horizontalA === horizontalB) {
        if (horizontalA) return Math.abs(a.y - c.y) < 1
            && Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1;
        return Math.abs(a.x - c.x) < 1
            && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1;
    }
    const h = horizontalA ? first : second, v = horizontalA ? second : first;
    return v.left > h.left + 1 && v.left < h.right - 1
        && h.top > v.top + 1 && h.top < v.bottom - 1;
}

// Decide from the proposed geometry, not how many nodes the document contains.
// Shared fork/join stems are intentional; unrelated crossings are not.
export function assessFlowchartLayout(layout, routes) {
    const { nodes, width, height } = layout;
    for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (![node.x, node.y, node.width, node.height].every(Number.isFinite)) return { ok: false, reason: 'invalid-geometry' };
        const box = { left: node.x - node.width / 2, right: node.x + node.width / 2, top: node.y - node.height / 2, bottom: node.y + node.height / 2 };
        if (nodes.slice(index + 1).some((other) => boxHitsNode(box, other))) return { ok: false, reason: 'node-overlap' };
    }
    for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index];
        if (route.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
            || point.x < 0 || point.x > width || point.y < 0 || point.y > height)) return { ok: false, reason: 'route-outside-canvas' };
        for (let segment = 1; segment < route.points.length; segment += 1) {
            const a = route.points[segment - 1], b = route.points[segment];
            const box = segmentBox(a, b);
            if (nodes.some((node) => node.id !== route.edge.start && node.id !== route.edge.end && boxHitsNode(box, node))) {
                return { ok: false, reason: 'edge-through-node' };
            }
            for (const other of routes.slice(index + 1)) {
                if ([route.edge.start, route.edge.end].some((id) => id === other.edge.start || id === other.edge.end)) continue;
                for (let otherSegment = 1; otherSegment < other.points.length; otherSegment += 1) {
                    if (segmentsIntersect(a, b, other.points[otherSegment - 1], other.points[otherSegment])) return { ok: false, reason: 'edge-crossing' };
                }
            }
        }
        if (route.labelBox) {
            const box = route.labelBox;
            if (box.left < 0 || box.right > width || box.top < 0 || box.bottom > height) return { ok: false, reason: 'label-outside-canvas' };
            if (nodes.some((node) => boxHitsNode(box, node))) return { ok: false, reason: 'label-over-node' };
            if (routes.slice(index + 1).some((other) => other.labelBox && boxesOverlap(box, other.labelBox))) return { ok: false, reason: 'label-overlap' };
        }
    }
    return { ok: true };
}

function roundedPath(points) {
    const result = [`M ${points[0].x} ${points[0].y}`];
    for (let index = 1; index < points.length - 1; index += 1) {
        const prev = points[index - 1], current = points[index], next = points[index + 1];
        const a = Math.hypot(current.x - prev.x, current.y - prev.y);
        const b = Math.hypot(next.x - current.x, next.y - current.y);
        if (!a || !b) continue;
        const r = Math.min(7, a / 2, b / 2);
        const before = { x: current.x + (prev.x - current.x) * r / a, y: current.y + (prev.y - current.y) * r / a };
        const after = { x: current.x + (next.x - current.x) * r / b, y: current.y + (next.y - current.y) * r / b };
        result.push(`L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`);
    }
    const last = points[points.length - 1];
    return `${result.join(' ')} L ${last.x} ${last.y}`;
}

export function getFlowchartSidePort(node, side, index = 0, count = 1, splitDirections = false) {
    // The default anchor is the middle of a rectangle's edge or a diamond's
    // vertex. Only crowded ports fan out along the actual shape boundary.
    const crowded = splitDirections || count > (node.shape === 'diamond' ? 2 : 3);
    const spread = node.shape === 'diamond' ? 24 : 16;
    const offset = crowded ? (index / (count - 1) * 2 - 1) * spread : 0;
    const halfWidth = node.width / 2 * (node.shape === 'diamond' ? 1 - Math.abs(offset) / (node.height / 2) : 1);
    return { x: node.x + side * halfWidth, y: node.y + offset };
}

function renderCandidate(data, id, options, attempt) {
    const layout = layoutFlowchart(data, options);
    if (!layout) return null;
    const { nodes, edges, width, height } = layout;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const portCounts = new Map();
    const portGroups = new Map();
    const registerPort = (node, side, other, incoming = false) => {
        const key = `${node.id}:${side}`;
        const index = portCounts.get(key) || 0;
        portCounts.set(key, index + 1);
        const port = { key, index, side, node, other, incoming };
        if (!portGroups.has(key)) portGroups.set(key, []);
        portGroups.get(key).push(port);
        return port;
    };
    const portPlans = edges.map((edge) => {
        const from = byId.get(edge.start), to = byId.get(edge.end);
        if (to.rank === from.rank && from.x !== to.x) {
            if (options.detourSameRank) return { detour: true };
            const side = to.x > from.x ? 1 : -1;
            return { from: registerPort(from, side, to), to: registerPort(to, -side, from, true) };
        }
        if (to.rank === from.rank + 1 && edge.pattern !== 'dotted') return null;
        const side = from.x < width / 2 ? -1 : 1;
        return { from: registerPort(from, side, to), to: registerPort(to, side, from, true), outer: true };
    });
    portGroups.forEach((ports) => {
        const priority = (port) => port.incoming && port.other.y !== port.node.y
            ? (port.other.y < port.node.y ? -Infinity : Infinity) : port.other.y;
        ports.sort((a, b) => priority(a) - priority(b));
        const split = ports.some((port) => port.other.y < port.node.y)
            && ports.some((port) => port.other.y > port.node.y);
        ports.forEach((port, index) => { port.index = index; port.split = split; });
    });
    // Nested return routes get outer lanes; longer downward routes get inner
    // lanes. This prevents an incoming return rail crossing a downward exit.
    for (const side of [-1, 1]) {
        portPlans.filter((plan) => plan?.outer && plan.from.side === side)
            .sort((a, b) => Math.min(a.from.node.y, a.to.node.y) - Math.min(b.from.node.y, b.to.node.y)
                || Math.max(b.from.node.y, b.to.node.y) - Math.max(a.from.node.y, a.to.node.y))
            .forEach((plan, index) => { plan.lane = index; });
    }
    const anchor = (node, port) => {
        const count = portCounts.get(port.key);
        let index = port.index;
        if (port.split && index === (count - 1) / 2 && port.other.y !== node.y) {
            index += Math.sign(port.other.y - node.y) / 3;
        }
        return getFlowchartSidePort(node, port.side, index, count, port.split);
    };
    const labels = [];
    const routes = [];
    const rowCenters = [...new Set(nodes.map((node) => node.y))].sort((a, b) => a - b);
    const paths = edges.map((edge, index) => {
        const from = byId.get(edge.start), to = byId.get(edge.end);
        const plan = portPlans[index];
        let points, label;
        if (to.rank === from.rank && from.x !== to.x) {
            if (options.detourSameRank) {
                const start = { x: from.x, y: from.y + from.height / 2 };
                const end = { x: to.x, y: to.y + to.height / 2 };
                const corridor = Math.max(start.y, end.y) + layout.rowGap / 2;
                points = [start, { x: start.x, y: corridor }, { x: end.x, y: corridor }, end];
                label = { x: (start.x + end.x) / 2, y: corridor };
            } else {
                const start = anchor(from, plan.from), end = anchor(to, plan.to);
                points = start.y === end.y ? [start, end]
                    : [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end];
                label = { x: (start.x + end.x) / 2, y: start.y };
            }
        } else if (to.rank === from.rank + 1 && edge.pattern !== 'dotted') {
            const start = { x: from.x, y: from.y + from.height / 2 };
            const end = { x: to.x, y: to.y - to.height / 2 };
            const middle = (start.y + end.y) / 2;
            points = from.x === to.x ? [start, end] : [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
            label = { x: (start.x + end.x) / 2, y: middle };
        } else {
            const side = from.x < width / 2 ? -1 : 1;
            const lane = plan.lane;
            const rail = side < 0 ? 92 + lane * 26 : width - 92 - lane * 26;
            const start = anchor(from, plan.from), end = anchor(to, plan.to);
            points = [start, { x: rail, y: start.y }, { x: rail, y: end.y }, end];
            label = { x: rail, y: (start.y + end.y) / 2 };
            const nearRow = rowCenters.findIndex((center) => Math.abs(center - label.y) < 28);
            if (nearRow >= 0) {
                const neighbor = rowCenters[nearRow + (to.y > from.y ? 1 : -1)];
                if (neighbor !== undefined) {
                    const candidate = (rowCenters[nearRow] + neighbor) / 2;
                    if (candidate > Math.min(start.y, end.y) + 18 && candidate < Math.max(start.y, end.y) - 18) label.y = candidate;
                }
            }
        }
        const route = { edge, points };
        routes.push(route);
        if (edge.label) {
            const lines = wrapFlowchartLabel(edge.label, 140, 12);
            const labelWidth = Math.max(...lines.map((line) => textWidth(line, 12))) + 18;
            const labelHeight = Math.max(24, lines.length * 18 + 6);
            route.labelBox = { left: label.x - labelWidth / 2, right: label.x + labelWidth / 2, top: label.y - labelHeight / 2, bottom: label.y + labelHeight / 2 };
            labels.push(`<g class="flow-label"><rect x="${label.x - labelWidth / 2}" y="${label.y - labelHeight / 2}" width="${labelWidth}" height="${labelHeight}" rx="6" fill="#fff"/><text x="${label.x}" y="${label.y}" dominant-baseline="central" text-anchor="middle" fill="#64748b" font-size="12">${lines.map((line, index) => `<tspan x="${label.x}" y="${label.y + (index - (lines.length - 1) / 2) * 18}">${escape(line)}</tspan>`).join('')}</text></g>`);
        }
        return `<path class="flow-edge" data-from="${escape(edge.start)}" data-to="${escape(edge.end)}" d="${roundedPath(points)}" fill="none" stroke="${edge.pattern === 'dotted' ? '#a2adbd' : '#8291a6'}" stroke-width="1.5" ${edge.pattern === 'dotted' ? 'stroke-dasharray="5 5"' : ''} ${edge.type === 'arrow_point' ? `marker-end="url(#${id}-arrow)"` : ''}/>`;
    });
    if (!assessFlowchartLayout(layout, routes).ok) return null;
    const shapes = nodes.map((node) => {
        const decision = node.shape === 'diamond';
        const terminal = !edges.some((edge) => edge.start === node.id);
        const fill = decision ? '#eff4fc' : terminal ? '#edf6f0' : '#fff';
        const stroke = decision ? '#9aafd1' : terminal ? '#a2bdaa' : '#cbd5e1';
        const shape = decision
            ? `<path d="M 0 ${-node.height / 2} L ${node.width / 2} 0 L 0 ${node.height / 2} L ${-node.width / 2} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`
            : `<rect x="${-node.width / 2}" y="${-node.height / 2}" width="${node.width}" height="${node.height}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
        const lines = node.lines;
        return `<g class="node flow-node" data-node-id="${escape(node.id)}" data-rank="${node.rank}" transform="translate(${node.x}, ${node.y})">${shape}<text text-anchor="middle" fill="#243247" font-size="14" font-weight="500" dominant-baseline="central">${lines.map((line, index) => `<tspan x="0" y="${(index - (lines.length - 1) / 2) * 21}">${escape(line)}</tspan>`).join('')}</text></g>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" class="prd-aligned-flowchart" data-layout-attempt="${attempt}" role="img" aria-label="业务流程图" viewBox="0 0 ${width} ${height}" style="font-family:Inter,'PingFang SC','Microsoft YaHei',sans-serif;max-width:${width}px"><defs><marker id="${id}-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#8291a6"/></marker></defs>${paths.join('')}${labels.join('')}${shapes.join('')}</svg>`;
}

export function renderAlignedFlowchart(data, id) {
    // Keep already-good diagrams compact. On a conflict, improve the layout
    // before falling back: reorder branches, then give routes and labels room.
    const candidates = [
        {},
        { reorder: true },
        { reorder: true, gapFactor: 1.35, rowGapFactor: 1.4 },
        { reorder: true, gapFactor: 1.7, rowGapFactor: 1.8, detourSameRank: true }
    ];
    for (const [index, options] of candidates.entries()) {
        const svg = renderCandidate(data, id, options, index + 1);
        if (svg) return svg;
    }
    return null;
}
