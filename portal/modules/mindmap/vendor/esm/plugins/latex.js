import { computeTokenLayouts as e, parseInlineMarkdown as t } from "../utils/inline-markdown.js";
import { jsx as n } from "react/jsx-runtime";
//#region src/components/MindMap/plugins/latex.tsx
var r = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace", i = null, a = !1, o = null, s = [];
function c() {
	return o || (o = import("katex").then((e) => {
		i = e.default || e, a = !0, d();
		for (let e of s) e();
		s = [];
	}).catch(() => {
		a = !0;
	}), o);
}
function l() {
	return i;
}
function u(e) {
	a ? e() : s.push(e);
}
c();
function d() {
	if (!(typeof document > "u") && !document.getElementById("katex-style")) {
		let e = document.createElement("link");
		e.id = "katex-style", e.rel = "stylesheet", e.href = "https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css", document.head.appendChild(e);
	}
}
function f(e, t) {
	let n = l();
	if (!n) return null;
	try {
		return n.renderToString(e, {
			throwOnError: !1,
			displayMode: t
		});
	} catch {
		return null;
	}
}
function p(e, t) {
	let n = l();
	if (!n) return null;
	try {
		return n.renderToString(e, {
			throwOnError: !1,
			displayMode: t,
			output: "mathml"
		});
	} catch {
		return null;
	}
}
var m = {
	name: "latex",
	inlineTokenPattern() {
		return {
			pattern: "\\$\\$(.+?)\\$\\$|\\$([^$]+?)\\$",
			priority: 3
		};
	},
	createInlineToken(e, t) {
		let n = e[t + 1], r = e[t + 2];
		return n === void 0 ? r === void 0 ? null : {
			type: "latex-inline",
			content: r
		} : {
			type: "latex-block",
			content: n
		};
	},
	renderInlineToken(e, t) {
		let { token: i } = e;
		return i.type !== "latex-inline" && i.type !== "latex-block" ? null : l() ? /* @__PURE__ */ n("tspan", {
			opacity: 0,
			children: i.content
		}, t) : /* @__PURE__ */ n("tspan", {
			fontFamily: r,
			fontStyle: "italic",
			fontSize: "0.9em",
			children: i.content
		}, t);
	},
	exportInlineToken(e, t) {
		let { token: n } = e;
		if (n.type !== "latex-inline" && n.type !== "latex-block") return "";
		let i = n.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		return t ? `<tspan font-family="${r}" font-style="italic" font-size="0.9em">${i}</tspan>` : l() ? `<tspan opacity="0">${i}</tspan>` : `<tspan font-family="${r}" font-style="italic" font-size="0.9em">${i}</tspan>`;
	},
	exportNodeDecoration(n, r, i, a) {
		if (a || !l()) return "";
		let o = [], s = (r, a, s, c, l, u) => {
			let d = e(t(r, i), a, s, c), f = d.length > 0 ? d[d.length - 1].x + d[d.length - 1].width : 0, m = a * .85, h = n.taskStatus ? 4 : 0, g = n.taskStatus ? m + h : 0, _ = a * .7, v = n.remark ? 4 : 0, y = n.remark ? _ + v : 0, b = -(g + f + y) / 2 + g;
			for (let e of d) {
				let { token: t } = e;
				if (t.type !== "latex-inline" && t.type !== "latex-block") continue;
				let n = p(t.content, t.type === "latex-block");
				if (!n) continue;
				let r = n.match(/<math[\s\S]*<\/math>/);
				if (!r) continue;
				let i = b + e.x + e.width / 2, s = Math.max(e.width * 2.5, 120), c = a * 2;
				o.push(`<foreignObject x="${i - s / 2}" y="${u - c / 2}" width="${s}" height="${c}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${a * .75}px;line-height:${c}px;color:${l};white-space:nowrap;text-align:center">` + r[0] + "</div></foreignObject>");
			}
		}, c = (n, r, a, s, c, l) => {
			let u = e(t(n, i), r, a, s), d = -(u.length > 0 ? u[u.length - 1].x + u[u.length - 1].width : 0) / 2;
			for (let e of u) {
				let { token: t } = e;
				if (t.type !== "latex-inline" && t.type !== "latex-block") continue;
				let n = p(t.content, t.type === "latex-block");
				if (!n) continue;
				let i = n.match(/<math[\s\S]*<\/math>/);
				if (!i) continue;
				let a = d + e.x + e.width / 2, s = Math.max(e.width * 2.5, 120), u = r * 2;
				o.push(`<foreignObject x="${a - s / 2}" y="${l - u / 2}" width="${s}" height="${u}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${r * .75}px;line-height:${u}px;color:${c};white-space:nowrap;text-align:center;opacity:0.8">` + i[0] + "</div></foreignObject>");
			}
		}, u = n.depth === 0 ? r.root.fontSize : n.depth === 1 ? r.level1.fontSize : r.node.fontSize, d = n.depth === 0 ? r.root.fontWeight : n.depth === 1 ? r.level1.fontWeight : r.node.fontWeight, f = n.depth === 0 ? r.root.fontFamily : r.node.fontFamily, m = n.depth === 0 ? r.root.textColor : r.node.textColor;
		if (s(n.text, u, d, f, m, 0), n.multiLineContent && n.multiLineContent.length > 0) {
			let e = u * .85, t = u * 1.4, r = u / 2 + 8;
			for (let i = 0; i < n.multiLineContent.length; i++) {
				let a = r + i * t;
				c(n.multiLineContent[i], e, 400, f, m, a);
			}
		}
		return o.join("");
	},
	adjustNodeSize(e, t, n) {
		return {
			width: t,
			height: n
		};
	}
};
//#endregion
export { l as getKatexSync, m as latexPlugin, d as loadKatexStyle, u as onKatexReady, f as renderLatexToHtml };
