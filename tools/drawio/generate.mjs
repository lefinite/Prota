#!/usr/bin/env node

import fs from 'node:fs/promises';
import { getWorkspaceRoot } from '../../server/workspace.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = getWorkspaceRoot();

function fail(message) {
    console.error(`[drawio] ${message}`);
    process.exit(1);
}

function escapeXml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        args[key] = next && !next.startsWith('--') ? argv[++index] : true;
    }
    return args;
}

function normalizeId(value, fallback) {
    const id = String(value || fallback).trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
    return id || fallback;
}

function compactVisibleText(value, kind, maxUnits) {
    const raw = String(value || '').trim();
    if (!raw) fail(`${kind} requires a visible label`);
    if (/\r|\n|<\s*br\b/i.test(raw)) fail(`${kind} must use one line of text`);
    if (/[：:]/.test(raw)) fail(`${kind} must be one short phrase without a subtitle or explanation`);
    const text = raw.replace(/\s+/g, ' ');
    const units = Array.from(text).reduce((total, char) => total + (/^[\x00-\x7F]$/.test(char) ? 0.5 : 1), 0);
    if (units > maxUnits) fail(`${kind} is too long (${units} > ${maxUnits}): ${text}`);
    return text;
}

function nodeDimensions(node = {}) {
    return {
        width: Number(node.width) || (node.shape === 'diamond' ? 154 : 188),
        height: Number(node.height) || (node.shape === 'diamond' ? 96 : 64)
    };
}

function nodeStyle(node = {}) {
    const palette = {
        primary: ['#eef2ff', '#4f46e5'],
        success: ['#ecfdf5', '#059669'],
        warning: ['#fffbeb', '#d97706'],
        danger: ['#fef2f2', '#dc2626'],
        neutral: ['#f8fafc', '#64748b'],
        accent: ['#f5f3ff', '#7c3aed']
    };
    const [fill, stroke] = palette[node.tone] || palette.primary;
    const shape = node.shape === 'diamond'
        ? 'rhombus'
        : node.shape === 'ellipse'
            ? 'ellipse'
            : node.shape === 'document'
                ? 'shape=document'
                : 'rounded=1';
    return [
        shape,
        'whiteSpace=wrap',
        'html=1',
        'arcSize=14',
        `fillColor=${node.fill || fill}`,
        `strokeColor=${node.stroke || stroke}`,
        'strokeWidth=1.5',
        'fontColor=#0f172a',
        'fontSize=13',
        'fontStyle=1',
        'align=center',
        'verticalAlign=middle',
        'spacing=10',
        'shadow=0'
    ].join(';');
}

function edgeStyle(edge = {}, routing = '') {
    return [
        'edgeStyle=orthogonalEdgeStyle',
        'rounded=0',
        'orthogonalLoop=1',
        'jettySize=32',
        'orthogonal=1',
        'html=1',
        `strokeColor=${edge.stroke || '#64748b'}`,
        'strokeWidth=1.5',
        `dashed=${edge.dashed ? 1 : 0}`,
        'endArrow=block',
        'endFill=1',
        'fontColor=#475569',
        'fontSize=11',
        'labelBackgroundColor=#ffffff',
        routing
    ].join(';');
}

function buildAutoLayout(nodes = [], edges = [], layout = 'vertical') {
    const explicit = new Map();
    nodes.forEach((node, index) => {
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
            explicit.set(index, { x: node.x, y: node.y });
        }
    });

    const positions = new Map(explicit);
    const autoIndexes = nodes
        .map((node, index) => ({ node, index }))
        .filter(({ index }) => !explicit.has(index));
    if (!autoIndexes.length) return positions;

    const horizontal = layout === 'horizontal' || layout === 'architecture';
    const byId = new Map();
    nodes.forEach((node, index) => {
        byId.set(normalizeId(node.id, `node-${index + 1}`), index);
    });

    const outgoing = new Map();
    edges.forEach((edge) => {
        const source = byId.get(normalizeId(edge.source, ''));
        const target = byId.get(normalizeId(edge.target, ''));
        if (!Number.isInteger(source) || !Number.isInteger(target) || explicit.has(source) || explicit.has(target)) return;
        if (!outgoing.has(source)) outgoing.set(source, []);
        outgoing.get(source).push(target);
    });

    const hasUsableEdges = Array.from(outgoing.values()).some((targets) => targets.length > 0);
    if (!hasUsableEdges) {
        const columns = Math.min(horizontal ? 4 : 3, Math.max(autoIndexes.length, 1));
        autoIndexes.forEach(({ index }, order) => {
            const column = order % columns;
            const row = Math.floor(order / columns);
            positions.set(index, {
                x: 90 + column * 268,
                y: 80 + row * 164
            });
        });
        return positions;
    }

    const indexes = autoIndexes.map(({ index }) => index);
    const layoutOutgoing = new Map(indexes.map((index) => [index, []]));
    const layoutIncoming = new Map(indexes.map((index) => [index, 0]));
    outgoing.forEach((targets, source) => {
        for (const target of targets) {
            // Specs list nodes in reading order. An edge to an earlier node is a
            // return/loop connector and must not distort the forward ranks.
            if (target <= source) continue;
            layoutOutgoing.get(source).push(target);
            layoutIncoming.set(target, layoutIncoming.get(target) + 1);
        }
    });
    const rank = new Map(indexes.map((index) => [index, 0]));
    const queue = indexes.filter((index) => layoutIncoming.get(index) === 0);
    while (queue.length) {
        const source = queue.shift();
        for (const target of layoutOutgoing.get(source)) {
            rank.set(target, Math.max(rank.get(target), rank.get(source) + 1));
            layoutIncoming.set(target, layoutIncoming.get(target) - 1);
            if (layoutIncoming.get(target) === 0) queue.push(target);
        }
    }

    const levels = new Map();
    autoIndexes.forEach(({ index }) => {
        const level = rank.get(index) || 0;
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level).push(index);
    });

    const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
    if (sortedLevels.length > 6) fail(`automatic layout needs ${sortedLevels.length} ranks; simplify, change direction, or split the diagram`);
    const maxLevelSize = Math.max(...Array.from(levels.values()).map((items) => items.length), 1);
    if (maxLevelSize > 4) fail(`automatic layout would place ${maxLevelSize} nodes on one rank; simplify or split the diagram`);
    const maxWidth = Math.max(...nodes.map((node) => nodeDimensions(node).width), 188);
    const maxHeight = Math.max(...nodes.map((node) => nodeDimensions(node).height), 64);
    const laneSpacing = horizontal ? maxHeight + 86 : maxWidth + 86;
    const levelSpacing = horizontal ? maxWidth + 100 : maxHeight + 76;
    const laneOrigin = 90;
    const levelOrigin = 80;

    sortedLevels.forEach((level) => {
        const items = levels.get(level) || [];
        const levelWidth = (items.length - 1) * laneSpacing;
        const widestLevel = (maxLevelSize - 1) * laneSpacing;
        const offset = (widestLevel - levelWidth) / 2;
        items.forEach((index, order) => {
            if (horizontal) {
                positions.set(index, {
                    x: levelOrigin + level * levelSpacing,
                    y: laneOrigin + offset + order * laneSpacing
                });
            } else {
                positions.set(index, {
                    x: laneOrigin + offset + order * laneSpacing,
                    y: levelOrigin + level * levelSpacing
                });
            }
        });
    });

    return positions;
}

function autoPosition(index, count, layout, node = {}, positions = null) {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        return { x: node.x, y: node.y };
    }
    if (positions?.has(index)) return positions.get(index);
    const horizontal = layout === 'horizontal' || layout === 'architecture';
    const columns = Math.min(horizontal ? 4 : 3, Math.max(count, 1));
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
        x: 90 + column * 268,
        y: 80 + row * 164
    };
}

function connectorPlan(source, target, sourceNode, targetNode, layout, edgeIndex, bounds) {
    const horizontal = layout === 'horizontal' || layout === 'architecture';
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;
    const sourceSize = nodeDimensions(sourceNode);
    const targetSize = nodeDimensions(targetNode);
    const sourceCenter = { x: source.x + sourceSize.width / 2, y: source.y + sourceSize.height / 2 };
    const targetCenter = { x: target.x + targetSize.width / 2, y: target.y + targetSize.height / 2 };
    const outsideOffset = 56 + edgeIndex * 12;
    const geometry = (points = []) => points.length
        ? `<Array as="points">${points.map((point) => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array>`
        : '';

    if (horizontal && deltaX > 20) {
        const skipsRanks = deltaX > Math.max(sourceSize.width, targetSize.width) + 140;
        if (!skipsRanks) return { routing: 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;exitPerimeter=1;entryPerimeter=1', points: '' };
        const above = targetCenter.y <= sourceCenter.y;
        const corridor = above ? bounds.minY - outsideOffset : bounds.maxY + outsideOffset;
        return {
            routing: `exitX=0.5;exitY=${above ? 0 : 1};entryX=0.5;entryY=${above ? 0 : 1};exitPerimeter=1;entryPerimeter=1`,
            points: geometry([{ x: sourceCenter.x, y: corridor }, { x: targetCenter.x, y: corridor }])
        };
    }
    if (!horizontal && deltaY > 20) {
        const skipsRanks = deltaY > Math.max(sourceSize.height, targetSize.height) + 120;
        if (!skipsRanks) return { routing: 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;exitPerimeter=1;entryPerimeter=1', points: '' };
        const right = targetCenter.x >= sourceCenter.x;
        const corridor = right ? bounds.maxX + outsideOffset : bounds.minX - outsideOffset;
        return {
            routing: `exitX=${right ? 1 : 0};exitY=0.5;entryX=${right ? 1 : 0};entryY=0.5;exitPerimeter=1;entryPerimeter=1`,
            points: geometry([{ x: corridor, y: sourceCenter.y }, { x: corridor, y: targetCenter.y }])
        };
    }
    if (horizontal) {
        const side = deltaY >= 0 ? 1 : 0;
        const corridor = side ? bounds.maxY + outsideOffset : bounds.minY - outsideOffset;
        return {
            routing: `exitX=0.5;exitY=${side};entryX=0.5;entryY=${side};exitPerimeter=1;entryPerimeter=1`,
            points: geometry([{ x: sourceCenter.x, y: corridor }, { x: targetCenter.x, y: corridor }])
        };
    }
    const side = deltaX >= 0 ? 1 : 0;
    const corridor = side ? bounds.maxX + outsideOffset : bounds.minX - outsideOffset;
    return {
        routing: `exitX=${side};exitY=0.5;entryX=${side};entryY=0.5;exitPerimeter=1;entryPerimeter=1`,
        points: geometry([{ x: corridor, y: sourceCenter.y }, { x: corridor, y: targetCenter.y }])
    };
}

function validateNodeClearance(nodes, positions) {
    const boxes = nodes.map((node, index) => {
        const position = positions.get(index);
        const { width, height } = nodeDimensions(node);
        return { index, x: position.x, y: position.y, width, height };
    });
    for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
            const a = boxes[left];
            const b = boxes[right];
            const horizontalGap = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
            const verticalGap = Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height);
            if (horizontalGap < 80 && verticalGap < 64) {
                fail(`nodes ${left + 1} and ${right + 1} are too close; keep 80px horizontal or 64px vertical clearance`);
            }
        }
    }
}

function buildStandardPage(spec, page, pageIndex) {
    const layout = page.layout || spec.layout || 'vertical';
    const nodes = Array.isArray(page.nodes) ? page.nodes : [];
    const edges = Array.isArray(page.edges) ? page.edges : [];
    const nodeIds = new Set();
    const nodeIdMap = new Map();
    const nodePositionMap = new Map();
    const nodeSpecMap = new Map();
    const cells = [];
    const positions = buildAutoLayout(nodes, edges, layout);
    if (nodes.length > 12) fail('a diagram page supports at most 12 nodes; simplify or split it');
    validateNodeClearance(nodes, positions);

    nodes.forEach((node, index) => {
        const sourceId = normalizeId(node.id, `node-${pageIndex + 1}-${index + 1}`);
        const id = `n-${sourceId}`;
        if (nodeIds.has(id)) fail(`duplicate node id: ${sourceId}`);
        nodeIds.add(id);
        nodeIdMap.set(sourceId, id);
        nodeSpecMap.set(sourceId, node);
        const position = autoPosition(index, nodes.length, layout, node, positions);
        nodePositionMap.set(sourceId, position);
        const { width, height } = nodeDimensions(node);
        const label = compactVisibleText(node.label, `node ${sourceId}`, 12);
        const description = node.description ? ` dataDescription="${escapeXml(String(node.description).replace(/\s+/g, ' ').trim())}"` : '';
        cells.push(
            `<mxCell id="${escapeXml(id)}" value="${escapeXml(label)}"${description} style="${escapeXml(nodeStyle(node))}" vertex="1" parent="1">` +
            `<mxGeometry x="${position.x}" y="${position.y}" width="${width}" height="${height}" as="geometry"/>` +
            '</mxCell>'
        );
    });

    const bounds = nodes.reduce((current, node, index) => {
        const position = positions.get(index);
        const size = nodeDimensions(node);
        return {
            minX: Math.min(current.minX, position.x),
            minY: Math.min(current.minY, position.y),
            maxX: Math.max(current.maxX, position.x + size.width),
            maxY: Math.max(current.maxY, position.y + size.height)
        };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    edges.forEach((edge, index) => {
        const sourceRef = normalizeId(edge.source, '');
        const targetRef = normalizeId(edge.target, '');
        const source = nodeIdMap.get(sourceRef);
        const target = nodeIdMap.get(targetRef);
        if (!source || !target) {
            fail(`edge ${index + 1} references missing node: ${sourceRef} -> ${targetRef}`);
        }
        const id = `e-${normalizeId(edge.id, `${pageIndex + 1}-${index + 1}`)}`;
        const label = edge.label ? compactVisibleText(edge.label, `edge ${index + 1}`, 8) : '';
        const plan = connectorPlan(
            nodePositionMap.get(sourceRef),
            nodePositionMap.get(targetRef),
            nodeSpecMap.get(sourceRef),
            nodeSpecMap.get(targetRef),
            layout,
            index,
            bounds
        );
        cells.push(
            `<mxCell id="${escapeXml(id)}" value="${escapeXml(label)}" style="${escapeXml(edgeStyle(edge, plan.routing))}" edge="1" parent="1" source="${escapeXml(source)}" target="${escapeXml(target)}">` +
            `<mxGeometry relative="1" as="geometry">${plan.points}</mxGeometry>` +
            '</mxCell>'
        );
    });

    return cells.join('');
}

function buildSequencePage(spec, page, pageIndex) {
    const participants = Array.isArray(page.participants) ? page.participants : [];
    const messages = Array.isArray(page.messages) ? page.messages : [];
    if (participants.length < 2) fail('sequence diagram requires at least 2 participants');
    if (participants.length > 5) fail('sequence diagram supports at most 5 participants on one page; simplify or split it');
    if (messages.length > 12) fail('sequence diagram supports at most 12 messages on one page; simplify or split it');
    const cells = [];
    const ids = new Set();
    const idMap = new Map();

    participants.forEach((participant, index) => {
        const sourceId = normalizeId(participant.id, `participant-${index + 1}`);
        const id = `p-${sourceId}`;
        ids.add(id);
        idMap.set(sourceId, id);
        const x = 70 + index * 230;
        const label = compactVisibleText(participant.label, `participant ${sourceId}`, 10);
        cells.push(
            `<mxCell id="${escapeXml(id)}" value="${escapeXml(label)}" style="${escapeXml(nodeStyle({ tone: participant.tone || 'primary' }))}" vertex="1" parent="1">` +
            `<mxGeometry x="${x}" y="40" width="160" height="56" as="geometry"/></mxCell>`
        );
        cells.push(
            `<mxCell id="${escapeXml(id)}-lifeline" value="" style="shape=line;strokeColor=#94a3b8;dashed=1;html=1;" vertex="1" parent="1">` +
            `<mxGeometry x="${x + 79}" y="96" width="2" height="${Math.max(260, messages.length * 72)}" as="geometry"/></mxCell>`
        );
    });

    messages.forEach((message, index) => {
        const sourceRef = normalizeId(message.from, '');
        const targetRef = normalizeId(message.to, '');
        const source = idMap.get(sourceRef);
        const target = idMap.get(targetRef);
        if (!ids.has(source) || !ids.has(target)) fail(`message ${index + 1} references missing participant`);
        const sourceIndex = participants.findIndex((item, i) => normalizeId(item.id, `participant-${i + 1}`) === sourceRef);
        const targetIndex = participants.findIndex((item, i) => normalizeId(item.id, `participant-${i + 1}`) === targetRef);
        const y = 135 + index * 72;
        const x = 70 + Math.min(sourceIndex, targetIndex) * 230 + 80;
        const width = Math.max(1, Math.abs(targetIndex - sourceIndex)) * 230;
        const label = compactVisibleText(message.label, `message ${index + 1}`, 16);
        const style = [
            'endArrow=block',
            'html=1',
            `dashed=${message.dashed ? 1 : 0}`,
            'strokeColor=#475569',
            'strokeWidth=1.5',
            'fontColor=#334155',
            'fontSize=11',
            'labelBackgroundColor=#ffffff'
        ].join(';');
        cells.push(
            `<mxCell id="message-${pageIndex + 1}-${index + 1}" value="${escapeXml(label)}" style="${escapeXml(style)}" edge="1" parent="1">` +
            `<mxGeometry relative="1" as="geometry"><mxPoint x="${sourceIndex <= targetIndex ? x : x + width}" y="${y}" as="sourcePoint"/><mxPoint x="${sourceIndex <= targetIndex ? x + width : x}" y="${y}" as="targetPoint"/></mxGeometry>` +
            '</mxCell>'
        );
    });
    return cells.join('');
}

function buildXml(spec) {
    const pages = Array.isArray(spec.pages) && spec.pages.length
        ? spec.pages
        : [{ name: spec.title || '流程图', ...spec }];
    const diagrams = pages.map((page, pageIndex) => {
        const type = page.type || spec.type || 'flow';
        const body = type === 'sequence'
            ? buildSequencePage(spec, page, pageIndex)
            : buildStandardPage(spec, page, pageIndex);
        return `<diagram id="page-${pageIndex + 1}" name="${escapeXml(page.name || `Page ${pageIndex + 1}`)}">` +
            `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">` +
            '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
            body +
            '</root></mxGraphModel></diagram>';
    });
    return `<mxfile host="Prota" modified="${new Date().toISOString()}" agent="generate-flow-diagram" version="1.0" type="device">${diagrams.join('')}</mxfile>`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) fail('missing --input <spec.json>');
if (!args.project || !args.page || !args.version) {
    fail('missing --project, --page, or --version');
}

const inputPath = path.resolve(args.input);
const spec = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const outputPath = args.output
    ? path.resolve(args.output)
    : path.join(ROOT_DIR, 'src', 'pages', args.project, args.page, 'docs', 'diagrams', `${args.version}.drawio`);
const allowedRoot = path.join(ROOT_DIR, 'src', 'pages');
if (!outputPath.startsWith(`${allowedRoot}${path.sep}`)) fail('output must be inside src/pages');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, buildXml(spec), 'utf8');
console.log(JSON.stringify({
    status: 'success',
    path: path.relative(ROOT_DIR, outputPath).split(path.sep).join('/'),
    type: spec.type || 'flow',
    pages: Array.isArray(spec.pages) ? spec.pages.length : 1
}, null, 2));
