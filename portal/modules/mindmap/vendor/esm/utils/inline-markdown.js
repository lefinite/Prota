//#region src/components/MindMap/utils/inline-markdown.ts
var e = "!\\[([^\\]]*)\\]\\(([^)]+)\\)|\\[([^\\]]+)\\]\\(([^)]+)\\)|`([^`]+)`|\\*\\*(.+?)\\*\\*|\\*(.+?)\\*|~~(.+?)~~|==(.+?)==";
function t(t, r) {
	let i = [], a = e, o = [];
	if (r && r.length > 0) {
		let e = [];
		for (let t of r) if (t.inlineTokenPattern) {
			let { pattern: n, priority: r } = t.inlineTokenPattern();
			e.push({
				plugin: t,
				pattern: n,
				priority: r
			});
		}
		e.sort((e, t) => e.priority - t.priority);
		let t = 0;
		for (let r of e) {
			let e = n(r.pattern);
			o.push({
				plugin: r.plugin,
				groupOffset: t,
				pattern: r.pattern
			}), t += e;
		}
		o.length > 0 && (a = o.map((e) => e.pattern).join("|") + "|!\\[([^\\]]*)\\]\\(([^)]+)\\)|\\[([^\\]]+)\\]\\(([^)]+)\\)|`([^`]+)`|\\*\\*(.+?)\\*\\*|\\*(.+?)\\*|~~(.+?)~~|==(.+?)==");
	}
	let s = new RegExp(a, "g"), c = o.reduce((e, t) => e + n(t.pattern), 0), l = 0, u;
	for (; (u = s.exec(t)) !== null;) {
		u.index > l && i.push({
			type: "text",
			content: t.slice(l, u.index)
		});
		let e = !1;
		if (o.length > 0) for (let t of o) {
			let r = t.groupOffset + 1, a = n(t.pattern), o = !1;
			for (let e = r; e < r + a; e++) if (u[e] !== void 0) {
				o = !0;
				break;
			}
			if (o && t.plugin.createInlineToken) {
				let n = t.plugin.createInlineToken(u, t.groupOffset);
				if (n) {
					i.push(n), e = !0;
					break;
				}
			}
		}
		if (!e) {
			let e = c, t = (t) => u[e + t];
			t(1) !== void 0 || t(2) !== void 0 ? i.push({
				type: "image",
				alt: t(1) ?? "",
				url: t(2)
			}) : t(3) === void 0 ? t(5) === void 0 ? t(6) === void 0 ? t(7) === void 0 ? t(8) === void 0 ? t(9) !== void 0 && i.push({
				type: "highlight",
				content: t(9)
			}) : i.push({
				type: "strikethrough",
				content: t(8)
			}) : i.push({
				type: "italic",
				content: t(7)
			}) : i.push({
				type: "bold",
				content: t(6)
			}) : i.push({
				type: "code",
				content: t(5)
			}) : i.push({
				type: "link",
				text: t(3),
				url: t(4)
			});
		}
		l = u.index + u[0].length;
	}
	return l < t.length && i.push({
		type: "text",
		content: t.slice(l)
	}), i.length === 0 && i.push({
		type: "text",
		content: t
	}), i;
}
function n(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) {
		if (e[n] === "\\") {
			n++;
			continue;
		}
		e[n] === "(" && e[n + 1] !== "?" && t++;
	}
	return t;
}
function r(e) {
	return e.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/~~(.+?)~~/g, "$1").replace(/==(.+?)==/g, "$1").replace(/\$\$(.+?)\$\$/g, "$1").replace(/\$([^$]+?)\$/g, "$1");
}
var i = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace", a = null;
function o() {
	return a ||= document.createElement("canvas").getContext("2d"), a;
}
function s(e, t, n, r) {
	let i = o();
	return i.font = `${n} ${t}px ${r}`, i.measureText(e).width;
}
function c(e, t, n, r) {
	let a = [], o = 0;
	for (let c of e) {
		let e;
		switch (c.type) {
			case "bold":
				e = s(c.content, t, 700, r);
				break;
			case "code":
				e = s(c.content, t * .88, 400, i);
				break;
			case "link":
				e = s(c.text, t, n, r);
				break;
			case "image":
				e = s(`[${c.alt || "image"}]`, t, n, r);
				break;
			case "latex-inline":
			case "latex-block":
				e = s(c.content, t * .9, n, i);
				break;
			default:
				e = s("content" in c ? c.content : "", t, n, r);
				break;
		}
		a.push({
			token: c,
			x: o,
			width: e
		}), o += e;
	}
	return a;
}
function l(e) {
	return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function u(e, n, r, i, a, o, s, l, u, p, m) {
	let h = c(t(e, l), n, r, i), g = h.length > 0 ? h[h.length - 1].x + h[h.length - 1].width : 0, _ = n * .85, v = o ? _ + (o ? 4 : 0) : 0, y = n * .7, b = s ? 4 : 0, x = s ? y + b : 0, S = -(v + g + x) / 2, C = S + v, w = [];
	o && (w.push(`<g transform="translate(${S}, ${-_ / 2})">`), w.push(f(o, _)), w.push("</g>"));
	let T = -n / 2 - 2, E = n + 4;
	for (let e of h) e.token.type === "code" ? w.push(`<rect x="${C + e.x - 2}" y="${T}" width="${e.width + 4}" height="${E}" rx="3" fill="rgba(128,128,128,0.12)"/>`) : e.token.type === "highlight" && w.push(`<rect x="${C + e.x - 1}" y="${T}" width="${e.width + 2}" height="${E}" rx="2" fill="${p || "rgba(255,213,79,0.3)"}"/>`);
	w.push(`<text text-anchor="start" dominant-baseline="central" x="${C}" fill="${a}" font-size="${n}" font-weight="${r}" font-family="${i}">`);
	for (let e of h) w.push(d(e.token, l, u, m));
	return w.push("</text>"), s && w.push(`<text x="${C + g + b}" text-anchor="start" dominant-baseline="central" font-size="${y}" opacity="0.5">💬</text>`), w.join("");
}
function d(e, t, n, r) {
	switch (e.type) {
		case "bold": return `<tspan font-weight="700">${l(e.content)}</tspan>`;
		case "italic": return `<tspan font-style="italic">${l(e.content)}</tspan>`;
		case "strikethrough": return `<tspan text-decoration="line-through" opacity="0.6">${l(e.content)}</tspan>`;
		case "code": return `<tspan font-family="${i}" font-size="0.88em">${l(e.content)}</tspan>`;
		case "highlight": return `<tspan fill="${n || "#FFEB3B"}">${l(e.content)}</tspan>`;
		case "link": return `<a href="${l(e.url)}" target="_blank"><tspan fill="#2563EB" text-decoration="underline">${l(e.text)}</tspan></a>`;
		case "image": return `<tspan font-style="italic">[${l(e.alt || "image")}]</tspan>`;
		case "latex-inline":
		case "latex-block":
			if (t) {
				for (let n of t) if (n.exportInlineToken) {
					let t = n.exportInlineToken({
						token: e,
						x: 0,
						width: 0
					}, r);
					if (t) return t;
				}
			}
			return `<tspan font-family="${i}" font-style="italic" font-size="0.9em">${l(e.content)}</tspan>`;
		default: return l(e.content);
	}
}
function f(e, t) {
	return e === "done" ? `<rect x="0" y="0" width="${t}" height="${t}" rx="${t * .2}" fill="#22C55E"/><path d="M${t * .28} ${t * .5}L${t * .44} ${t * .66}L${t * .72} ${t * .34}" stroke="white" stroke-width="${t * .13}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` : e === "doing" ? `<rect x="0" y="0" width="${t}" height="${t}" rx="${t * .2}" fill="none" stroke="#FBBF24" stroke-width="${t * .1}"/><rect x="${t * .25}" y="${t * .25}" width="${t * .5}" height="${t * .5}" rx="${t * .1}" fill="#FBBF24" opacity="0.6"/>` : `<rect x="0" y="0" width="${t}" height="${t}" rx="${t * .2}" fill="none" stroke="#999" stroke-width="${t * .1}" opacity="0.4"/>`;
}
function p(e, n, r, i, a, o, s, l, u, f) {
	let p = c(t(e, s), n, r, i), m = -(p.length > 0 ? p[p.length - 1].x + p[p.length - 1].width : 0) / 2, h = [], g = o - n / 2 - 2, _ = n + 4;
	for (let e of p) e.token.type === "code" ? h.push(`<rect x="${m + e.x - 2}" y="${g}" width="${e.width + 4}" height="${_}" rx="3" fill="rgba(128,128,128,0.12)"/>`) : e.token.type === "highlight" && h.push(`<rect x="${m + e.x - 1}" y="${g}" width="${e.width + 2}" height="${_}" rx="2" fill="${u || "rgba(255,213,79,0.3)"}"/>`);
	let v = f === void 0 ? "" : ` opacity="${f}"`;
	h.push(`<text x="${m}" y="${o}" text-anchor="start" dominant-baseline="central" fill="${a}" font-size="${n}" font-weight="${r}" font-family="${i}"${v}>`);
	for (let e of p) h.push(d(e.token, s, l));
	return h.push("</text>"), h.join("");
}
//#endregion
export { u as buildSvgNodeTextString, p as buildSvgTextLineString, c as computeTokenLayouts, l as escapeXml, t as parseInlineMarkdown, r as stripInlineMarkdown };
