import { THEME as e, generateExportStyles as t } from "./theme.js";
import { buildSvgNodeTextString as n } from "./inline-markdown.js";
import { runExportNodeDecoration as r, runExportOverlay as i } from "../plugins/runner.js";
//#region src/components/MindMap/utils/export.ts
function a(a, o, s = {}, c = e, l) {
	let { padding: u = 40, background: d = c.canvas.bgColor, pngSafe: f = !1 } = s, p = Infinity, m = -Infinity, h = Infinity, g = -Infinity;
	for (let e of a) p = Math.min(p, e.x - e.width / 2), m = Math.max(m, e.x + e.width / 2), h = Math.min(h, e.y - e.height / 2), g = Math.max(g, e.y + e.height / 2);
	let _ = m - p + u * 2, v = g - h + u * 2, y = -p + u, b = -h + u, x = [];
	x.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${_}" height="${v}" viewBox="0 0 ${_} ${v}">`), x.push("<defs>"), x.push("  <style>"), x.push(`    ${t(c)}`), x.push("  </style>"), o.some((e) => e.isCrossLink) && (x.push("<marker id=\"arrowhead\" markerWidth=\"8\" markerHeight=\"6\" refX=\"8\" refY=\"3\" orient=\"auto\">"), x.push("<path d=\"M0,0 L8,3 L0,6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/>"), x.push("</marker>")), x.push("</defs>"), x.push(`<rect width="100%" height="100%" fill="${d}"/>`), x.push(`<g transform="translate(${y}, ${b})">`);
	for (let e of o) {
		let t = a.find((t) => t.id === e.toId), n = t?.branchIndex === void 0 ? "" : ` data-branch-index="${t.branchIndex}"`, r = `class="mindmap-edge" d="${e.path}" stroke="${e.color}"${n}`;
		if (e.strokeDasharray && (r += ` stroke-dasharray="${e.strokeDasharray}"`), e.isCrossLink && (r += " marker-end=\"url(#arrowhead)\" opacity=\"0.7\""), x.push(`<path ${r}/>`), e.label) {
			let n = a.find((t) => t.id === e.fromId);
			if (n && t) {
				let r = (n.x + t.x) / 2, i = (n.y + t.y) / 2;
				x.push(`<text class="mindmap-edge-label" x="${r}" y="${i - 6}" text-anchor="middle" font-size="11" fill="${e.color}" opacity="0.8">${e.label}</text>`);
			}
		}
	}
	for (let e of a) {
		let t = e.x, i = e.y, a = e.branchIndex === void 0 ? "" : ` data-branch-index="${e.branchIndex}"`;
		if (e.depth === 0) {
			let { fontSize: o, fontWeight: s, fontFamily: u, textColor: d } = c.root, p = c.root.bgColor;
			x.push(`<g class="mindmap-node-g mindmap-node-root" transform="translate(${t}, ${i})"${a}>`), x.push(`<rect class="mindmap-node-bg" x="${-e.width / 2}" y="${-e.height / 2}" width="${e.width}" height="${e.height}" rx="${e.height / 2}" ry="${e.height / 2}" fill="${p}"/>`), x.push(n(e.text, o, s, u, d, e.taskStatus, e.remark, l, c.highlight.textColor, c.highlight.bgColor, f)), l && l.length > 0 && x.push(r(l, e, c, l, f)), x.push("</g>");
		} else {
			let o = e.depth === 1 ? c.level1.fontSize : c.node.fontSize, s = e.depth === 1 ? c.level1.fontWeight : c.node.fontWeight, u = e.width - c.node.paddingH * 2, d = o / 2 + 4;
			x.push(`<g class="mindmap-node-g mindmap-node-child" transform="translate(${t}, ${i})"${a}>`), x.push(n(e.text, o, s, c.node.fontFamily, c.node.textColor, e.taskStatus, e.remark, l, c.highlight.textColor, c.highlight.bgColor, f)), x.push(`<line class="mindmap-node-underline" x1="${-u / 2}" y1="${d}" x2="${u / 2}" y2="${d}" stroke="${e.color}"/>`), l && l.length > 0 && x.push(r(l, e, c, l, f)), x.push("</g>");
		}
	}
	return l && l.length > 0 && x.push(i(l, a, o, c)), x.push("</g>"), x.push("</svg>"), x.join("\n");
}
var o = a;
function s(e, t = {}) {
	let n = typeof window < "u" ? Math.max(window.devicePixelRatio ?? 1, 2) : 2, { scale: r = n } = t;
	return new Promise((t, n) => {
		let i = new DOMParser().parseFromString(e, "image/svg+xml").documentElement, a = parseFloat(i.getAttribute("width") || "800"), o = parseFloat(i.getAttribute("height") || "600"), s = new Blob([e], { type: "image/svg+xml;charset=utf-8" }), c = URL.createObjectURL(s), l = new Image();
		l.onload = () => {
			let e = document.createElement("canvas");
			e.width = a * r, e.height = o * r;
			let i = e.getContext("2d");
			i.scale(r, r), i.drawImage(l, 0, 0, a, o), URL.revokeObjectURL(c), e.toBlob((e) => {
				e ? t(e) : n(/* @__PURE__ */ Error("Failed to create PNG blob"));
			}, "image/png");
		}, l.onerror = () => {
			URL.revokeObjectURL(c), n(/* @__PURE__ */ Error("Failed to load SVG image"));
		}, l.src = c;
	});
}
//#endregion
export { a as buildExportSVG, o as buildExportSVGForPNG, s as exportToPNG };
