import { buildSvgTextLineString as e } from "../utils/inline-markdown.js";
//#region src/components/MindMap/plugins/multi-line.ts
var t = {
	name: "multi-line",
	collectFollowLines(e, t, n) {
		let r = 0, i = [], a = t;
		for (; a < e.length;) {
			let t = e[a].match(/^(\s*)\|\s?(.*)$/);
			if (t) i.push(t[2]), r++, a++;
			else break;
		}
		return i.length > 0 && (n.multiLineContent = i), r;
	},
	serializeFollowLines(e, t) {
		return !e.multiLineContent || e.multiLineContent.length === 0 ? [] : e.multiLineContent.map((e) => `| ${e}`);
	},
	adjustNodeSize(e, t, n, r) {
		if (!e.multiLineContent || e.multiLineContent.length === 0) return {
			width: t,
			height: n
		};
		let i = r * 1.4;
		return {
			width: t,
			height: n + e.multiLineContent.length * i
		};
	},
	exportNodeDecoration(t, n, r) {
		if (!t.multiLineContent || t.multiLineContent.length === 0) return "";
		let i = t.depth === 0 ? n.root.fontSize : t.depth === 1 ? n.level1.fontSize : n.node.fontSize, a = t.depth === 0 ? n.root.fontFamily : n.node.fontFamily, o = t.depth === 0 ? n.root.textColor : n.node.textColor, s = i * .85, c = i * 1.4, l = i / 2 + 8, u = [];
		for (let i = 0; i < t.multiLineContent.length; i++) {
			let d = l + i * c;
			u.push(e(t.multiLineContent[i], s, 400, a, o, d, r, n.highlight.textColor, n.highlight.bgColor, .8));
		}
		return u.join("");
	}
};
//#endregion
export { t as multiLinePlugin };
