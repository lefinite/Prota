import { escapeXml as e } from "../utils/inline-markdown.js";
//#region src/components/MindMap/plugins/tags.ts
var t = /((?:\s+#[\w-]+)+)$/, n = [
	"#3B82F6",
	"#8B5CF6",
	"#EC4899",
	"#F59E0B",
	"#10B981",
	"#6366F1"
], r = {
	name: "tags",
	transformNodeData(e) {
		let n = e.text.match(t);
		if (!n) return e;
		let r = n[1], i = e.text.slice(0, e.text.length - r.length).trim(), a = [], o = /#([\w-]+)/g, s;
		for (; (s = o.exec(r)) !== null;) a.push(s[1]);
		return a.length > 0 ? {
			...e,
			text: i,
			tags: a
		} : e;
	},
	serializeNodeText(e, t) {
		return !e.tags || e.tags.length === 0 ? t : t + " " + e.tags.map((e) => "#" + e).join(" ");
	},
	adjustNodeSize(e, t, n, r) {
		if (!e.tags || e.tags.length === 0) return {
			width: t,
			height: n
		};
		let i = r * .65, a = 0;
		for (let t of e.tags) a += t.length * i * .65 + 10 + 4;
		return {
			width: Math.max(t, a + 16),
			height: n + (i + 10)
		};
	},
	exportNodeDecoration(t, r) {
		if (!t.tags || t.tags.length === 0) return "";
		let i = t.depth === 0 ? r.root.fontSize : t.depth === 1 ? r.level1.fontSize : r.node.fontSize, a = t.depth === 0 ? r.root.fontFamily : r.node.fontFamily, o = i * .65, s = i * 1.4, c = t.multiLineContent ? t.multiLineContent.length * s : 0, l = i / 2 + 6 + c, u = o + 6, d = 0, f = [];
		for (let e of t.tags) {
			let t = e.length * o * .65 + 10;
			f.push(t), d += t;
		}
		d += (t.tags.length - 1) * 4;
		let p = -d / 2, m = [];
		for (let r = 0; r < t.tags.length; r++) {
			let i = t.tags[r], s = f[r], c = n[r % n.length];
			m.push(`<rect x="${p}" y="${l}" width="${s}" height="${u}" rx="3" fill="${c}" opacity="0.15"/>`), m.push(`<text x="${p + s / 2}" y="${l + u / 2}" text-anchor="middle" dominant-baseline="central" font-size="${o}" fill="${c}" font-family="${a}">${e(i)}</text>`), p += s + 4;
		}
		return m.join("");
	}
};
//#endregion
export { r as tagsPlugin };
