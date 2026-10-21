//#region src/components/MindMap/plugins/cross-link.ts
var e = /\{#([\w-]+)\}/, t = /(-?\.?)>\s*\{#([\w-]+)\}(?:\s+"([^"]*)")?/g, n = {
	name: "cross-link",
	transformNodeData(n) {
		let r = n.text, i, a = [], o = new RegExp(t.source, "g"), s;
		for (; (s = o.exec(r)) !== null;) {
			let e = s[1] === "-.";
			a.push({
				targetAnchorId: s[2],
				label: s[3] || void 0,
				dotted: e
			});
		}
		r = r.replace(new RegExp(t.source, "g"), "").trim();
		let c = r.match(e);
		return c && (i = c[1], r = r.replace(e, "").trim()), i || a.length > 0 ? {
			...n,
			text: r,
			...i ? { anchorId: i } : {},
			...a.length > 0 ? { crossLinks: a } : {}
		} : n;
	},
	serializeNodeText(e, t) {
		let n = t;
		if (e.anchorId && (n += ` {#${e.anchorId}}`), e.crossLinks) for (let t of e.crossLinks) {
			let e = t.dotted ? "-.>" : "->";
			n += ` ${e} {#${t.targetAnchorId}}`, t.label && (n += ` "${t.label}"`);
		}
		return n;
	},
	generateExtraEdges(e, t) {
		let n = [], i = /* @__PURE__ */ new Map();
		for (let t of e) t.anchorId && i.set(t.anchorId, t);
		function a(t) {
			if (t.crossLinks) {
				let a = e.find((e) => e.id === t.id);
				if (a) for (let e of t.crossLinks) {
					let t = i.get(e.targetAnchorId);
					if (t) {
						let i = r(a, t);
						n.push({
							key: `xlink-${a.id}-${t.id}`,
							path: i,
							color: a.color,
							fromId: a.id,
							toId: t.id,
							strokeDasharray: "6 4",
							isCrossLink: !0,
							label: e.label
						});
					}
				}
			}
			if (t.children) for (let e of t.children) a(e);
		}
		for (let e of t) a(e);
		return n;
	}
};
function r(e, t) {
	let n = e.x, r = e.y, i = t.x, a = t.y, o = i - n, s = a - r, c = Math.sqrt(o * o + s * s), l = (n + i) / 2, u = (r + a) / 2, d = Math.min(c * .3, 60), f = -s / c, p = o / c;
	return `M ${n},${r} Q ${l + f * d},${u + p * d} ${i},${a}`;
}
//#endregion
export { n as crossLinkPlugin };
