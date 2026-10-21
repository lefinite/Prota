import { BRANCH_COLORS as e, THEME as t } from "./theme.js";
import { stripInlineMarkdown as n } from "./inline-markdown.js";
import { runAdjustNodeSize as r, runFilterChildren as i, runGenerateExtraEdges as a, runTransformEdge as o, runTransformNodeColor as s } from "../plugins/runner.js";
//#region src/components/MindMap/utils/layout.ts
var c = null;
function l() {
	return c ||= document.createElement("canvas").getContext("2d"), c;
}
function u(e, n, r, i) {
	let a = l();
	return a.font = `${r} ${n}px ${i || t.root.fontFamily}`, a.measureText(e).width;
}
var d = 4, f = 20;
function p(e, t, r, i, a) {
	let o = u(n(e), t, r);
	return i && (o += t * .9 + d), a && (o += f), o;
}
function m(n, a, o, c, l, u, d, f) {
	let h = a === 0, g = a === 1, _ = h ? t.root.fontSize : g ? t.level1.fontSize : t.node.fontSize, v = h ? t.root.fontWeight : g ? t.level1.fontWeight : t.node.fontWeight, y = h ? t.root.paddingH : t.node.paddingH, b = h ? t.root.paddingV : t.node.paddingV, x = (n.placeholder ? 60 : p(n.text, _, v, n.taskStatus, !!n.remark)) + y * 2, S = _ + b * 2;
	if (u && u.length > 0) {
		let e = r(u, n, x, S, _);
		x = e.width, S = e.height;
	}
	let C = n.children || [];
	u && u.length > 0 && d && (C = i(u, n, C, d));
	let w = c;
	if (u && u.length > 0) {
		let e = s(u, {
			id: n.id,
			text: n.text,
			x: 0,
			y: 0,
			width: x,
			height: S,
			color: c,
			depth: a,
			side: o,
			parentId: l
		}, n, c);
		e.color && (w = e.color);
	}
	let T = C.map((t, r) => {
		let i = h ? e[r % e.length] : w, s = h ? r % e.length : f;
		return m(t, a + 1, o, i, n.id, u, d, s);
	});
	return {
		id: n.id,
		text: n.text,
		children: T,
		width: x,
		height: S,
		depth: a,
		side: o,
		color: w,
		x: 0,
		y: 0,
		subtreeHeight: 0,
		parentId: l,
		remark: n.remark,
		taskStatus: n.taskStatus,
		branchIndex: f,
		dottedLine: n.dottedLine,
		multiLineContent: n.multiLineContent,
		tags: n.tags,
		anchorId: n.anchorId,
		crossLinks: n.crossLinks,
		collapsed: n.collapsed,
		placeholder: n.placeholder
	};
}
function h(e) {
	if (e.children.length === 0) return e.subtreeHeight = e.height, e.height;
	let n = e.children.reduce((e, t) => e + h(t), 0) + (e.children.length - 1) * t.layout.verticalGap;
	return e.subtreeHeight = Math.max(e.height, n), e.subtreeHeight;
}
function g(e, n, r) {
	if (e.x = n, e.y = r, e.children.length === 0) return;
	let i = e.side === "left" ? -1 : 1, a = r - (e.children.reduce((e, t) => e + t.subtreeHeight, 0) + (e.children.length - 1) * t.layout.verticalGap) / 2;
	for (let r of e.children) {
		let o = a + r.subtreeHeight / 2;
		g(r, n + i * (e.width / 2 + t.layout.horizontalGap + r.width / 2), o), a += r.subtreeHeight + t.layout.verticalGap;
	}
}
function _(e, t) {
	t.push({
		id: e.id,
		text: e.text,
		x: e.x,
		y: e.y,
		width: e.width,
		height: e.height,
		color: e.color,
		depth: e.depth,
		side: e.side,
		parentId: e.parentId,
		remark: e.remark,
		taskStatus: e.taskStatus,
		branchIndex: e.branchIndex,
		dottedLine: e.dottedLine,
		multiLineContent: e.multiLineContent,
		tags: e.tags,
		anchorId: e.anchorId,
		crossLinks: e.crossLinks,
		collapsed: e.collapsed,
		placeholder: e.placeholder
	});
	for (let n of e.children) _(n, t);
}
function v(e, t, n, r, i, a, o) {
	let s = o === "left" ? -1 : 1, c = e + n / 2 * s, l = t, u = r - a / 2 * s, d = i, f = c + (u - c) * .5;
	return `M ${c},${l} C ${f},${l} ${f},${d} ${u},${d}`;
}
function y(e, t, n, r) {
	for (let i of e.children) {
		let a = {
			key: `${e.id}-${i.id}`,
			path: v(e.x, e.y, e.width, i.x, i.y, i.width, i.side),
			color: i.color,
			fromId: e.id,
			toId: i.id
		};
		if (r && r.length > 0) {
			let t = n.find((t) => t.id === e.id), s = n.find((e) => e.id === i.id);
			t && s && (a = o(r, a, t, s));
		}
		t.push(a), y(i, t, n, r);
	}
}
function b(n, r = "both", i, o, s, c, l) {
	let u = s && s.length > 0 ? {
		direction: r,
		theme: t,
		readonly: !!c,
		foldOverrides: l || {}
	} : void 0, d = n.children || [], f, p, v;
	r === "right" ? (f = d, p = [], v = d.length) : r === "left" ? (f = [], p = d, v = 0) : (v = o ?? Math.ceil(d.length / 2), v = Math.min(Math.max(v, 0), d.length), f = d.slice(0, v), p = d.slice(v));
	let b = m({
		...n,
		children: []
	}, 0, "root", t.root.bgColor, void 0, s, u), x = f.map((t, r) => {
		let a = r % e.length;
		return m(t, 1, "right", i?.[t.id] ?? e[a], n.id, s, u, a);
	}), S = p.map((t, a) => {
		let o = ((r === "left" ? 0 : v) + a) % e.length;
		return m(t, 1, "left", i?.[t.id] ?? e[o], n.id, s, u, o);
	});
	b.children = [...x, ...S];
	for (let e of b.children) h(e);
	b.x = 0, b.y = 0;
	let C = b.children.filter((e) => e.side === "right"), w = b.children.filter((e) => e.side === "left"), T = (e, n) => {
		let r = -(e.reduce((e, t) => e + t.subtreeHeight, 0) + Math.max(0, e.length - 1) * t.layout.verticalGap) / 2;
		for (let i of e) {
			let e = r + i.subtreeHeight / 2;
			g(i, n * (b.width / 2 + t.layout.horizontalGap + i.width / 2), e), r += i.subtreeHeight + t.layout.verticalGap;
		}
	};
	T(C, 1), T(w, -1);
	let E = [], D = [];
	if (_(b, E), y(b, D, E, s), s && s.length > 0 && u) {
		let e = a(s, E, [n], u);
		D.push(...e);
	}
	return {
		nodes: E,
		edges: D
	};
}
function x(e, t = "both", n, r, i, a, o) {
	if (e.length === 0) return {
		nodes: [],
		edges: []
	};
	if (e.length === 1) return b(e[0], t, n, r?.[e[0].id], i, a, o);
	let s = e.map((e) => b(e, t, n, r?.[e.id], i, a, o)), c = s.map((e) => {
		let t = Infinity, n = -Infinity;
		for (let r of e.nodes) t = Math.min(t, r.y - r.height / 2), n = Math.max(n, r.y + r.height / 2);
		return {
			minY: t,
			maxY: n
		};
	}), l = [], u = [], d = c[0].maxY;
	for (let e of s[0].nodes) l.push(e);
	for (let e of s[0].edges) u.push(e);
	for (let e = 1; e < s.length; e++) {
		let t = d + 80 - c[e].minY, n = l.length;
		for (let n of s[e].nodes) l.push({
			...n,
			y: n.y + t
		});
		for (let t of s[e].edges) {
			let e = l.slice(n).find((e) => e.id === t.fromId), r = l.slice(n).find((e) => e.id === t.toId);
			e && r ? u.push({
				...t,
				path: v(e.x, e.y, e.width, r.x, r.y, r.width, r.side)
			}) : u.push(t);
		}
		d = d + 80 + (c[e].maxY - c[e].minY);
	}
	let f = -(Math.min(...l.map((e) => e.y - e.height / 2)) + Math.max(...l.map((e) => e.y + e.height / 2))) / 2;
	if (Math.abs(f) > .1) {
		for (let e of l) e.y += f;
		for (let e = 0; e < u.length; e++) {
			let t = u[e];
			if (t.isCrossLink) continue;
			let n = l.find((e) => e.id === t.fromId), r = l.find((e) => e.id === t.toId);
			n && r && (u[e] = {
				...t,
				path: v(n.x, n.y, n.width, r.x, r.y, r.width, r.side)
			});
		}
	}
	return {
		nodes: l,
		edges: u
	};
}
//#endregion
export { v as computeEdgePath, x as layoutMultiRoot };
