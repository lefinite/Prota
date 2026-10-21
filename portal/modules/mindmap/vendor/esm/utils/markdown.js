import { runCollectFollowLines as e, runParseLine as t, runPostParseTree as n, runPreParseMarkdown as r, runSerializeFollowLines as i, runSerializeListMarker as a, runSerializeNodeText as o, runSerializePreamble as s, runTransformNodeData as c } from "../plugins/runner.js";
//#region src/components/MindMap/utils/markdown.ts
function l(e) {
	let t = e.match(/^\[([ x-])\]\s+(.*)/);
	if (!t) return { text: e };
	let n = t[1], r = t[2];
	return n === " " ? {
		taskStatus: "todo",
		text: r
	} : n === "x" ? {
		taskStatus: "done",
		text: r
	} : n === "-" ? {
		taskStatus: "doing",
		text: r
	} : { text: e };
}
function u(i, a) {
	let o = a && a.length > 0 ? a : void 0, s = o ? {
		lines: [],
		frontMatter: {}
	} : void 0, u = i;
	o && s && (u = r(o, u, s));
	let f = u.split("\n");
	s && (s.lines = f);
	let p = [], m = null, h = [], g = 0;
	for (; g < f.length;) {
		let n = f[g];
		if (/^\s*%%/.test(n)) {
			g++;
			continue;
		}
		let r = o && s ? t(o, n, g, s) : null;
		if (r) {
			let t = r.text.trim(), n = r.taskStatus, { taskStatus: i, text: a } = n ? {
				taskStatus: n,
				text: t
			} : l(t);
			if (a) {
				let t = {
					indent: r.indent,
					text: a,
					taskStatus: i,
					remarkLines: [],
					dottedLine: r.dottedLine,
					collapsed: r.collapsed
				}, n = g + 1;
				for (; n < f.length;) {
					let e = f[n].match(/^(\s*)>\s?(.*)$/);
					if (e) t.remarkLines.push(e[2]), n++;
					else break;
				}
				if (o && s) {
					let r = {
						id: "temp",
						text: a
					}, i = e(o, f, n, r, s);
					Object.assign(t, { _pluginNode: r }), n += i;
				}
				p.push(t), g = n;
				continue;
			}
		}
		let i = n.match(/^(\s*)[*-]\s+(.+)/);
		if (i) {
			let t = i[1].replace(/\t/g, "  ").length, { taskStatus: n, text: r } = l(i[2].trim());
			if (r) {
				let i = {
					indent: t,
					text: r,
					taskStatus: n,
					remarkLines: []
				}, a = g + 1;
				for (; a < f.length;) {
					let e = f[a].match(/^(\s*)>\s?(.*)$/);
					if (e) i.remarkLines.push(e[2]), a++;
					else break;
				}
				if (o && s) {
					let t = {
						id: "temp",
						text: r
					}, n = e(o, f, a, t, s);
					Object.assign(i, { _pluginNode: t }), a += n;
				}
				p.push(i), g = a;
				continue;
			}
		}
		let a = n.match(/^(\s*)[*-]\s*$/);
		if (a && g === f.length - 1) {
			let e = a[1].replace(/\t/g, "  ").length;
			p.push({
				indent: e,
				text: "",
				taskStatus: void 0,
				remarkLines: [],
				placeholder: !0
			}), g++;
			continue;
		}
		if (m === null && p.length === 0) {
			let e = n.trim();
			if (e) {
				m = e;
				let t = g + 1;
				for (; t < f.length;) {
					let e = f[t].match(/^(\s*)>\s?(.*)$/);
					if (e) h.push(e[2]), t++;
					else break;
				}
				g = t;
				continue;
			}
		}
		g++;
	}
	if (p.length === 0 && m === null) return {
		id: "md-0",
		text: "Root"
	};
	let _ = (e, t) => {
		t.dottedLine && (e = {
			...e,
			dottedLine: !0
		}), t.collapsed && (e = {
			...e,
			collapsed: !0
		});
		let n = t._pluginNode;
		return n && n.multiLineContent && (e = {
			...e,
			multiLineContent: n.multiLineContent
		}), o && s && (e = c(o, e, e.text, s)), e;
	};
	if (m !== null) {
		let e = {
			id: "md-0",
			text: m,
			children: [],
			...h.length > 0 ? { remark: h.join("\n") } : {}
		};
		if (o && s && (e = c(o, e, m, s)), p.length === 0) return delete e.children, e;
		let t = 2;
		for (let e of p) if (e.indent > 0) {
			t = e.indent;
			break;
		}
		let r = p.map((e) => ({
			level: e.indent > 0 ? Math.round(e.indent / t) : 0,
			text: e.text,
			taskStatus: e.taskStatus,
			remarkLines: e.remarkLines,
			_item: e
		})), i = [[e, -1]];
		for (let e = 0; e < r.length; e++) {
			let { level: t, text: n, taskStatus: a, remarkLines: o, _item: s } = r[e], c = {
				id: "md-tmp",
				text: n,
				...a ? { taskStatus: a } : {},
				...o.length > 0 ? { remark: o.join("\n") } : {},
				...s.placeholder ? { placeholder: !0 } : {}
			};
			for (; i.length > 1 && i[i.length - 1][1] >= t;) i.pop();
			let l = i[i.length - 1][0];
			l.children ||= [], c.id = `${l.id}-${l.children.length}`, c = _(c, s), l.children.push(c), i.push([c, t]);
		}
		if (d(e), o && s) {
			let [t] = n(o, [e], s);
			return t;
		}
		return e;
	}
	let v = 2;
	for (let e of p) if (e.indent > 0) {
		v = e.indent;
		break;
	}
	let y = p.map((e) => ({
		level: e.indent > 0 ? Math.round(e.indent / v) : 0,
		text: e.text,
		taskStatus: e.taskStatus,
		remarkLines: e.remarkLines,
		_item: e
	})), b = {
		id: "md-0",
		text: y[0].text,
		children: [],
		listRoot: !0,
		...y[0].taskStatus ? { taskStatus: y[0].taskStatus } : {},
		...y[0].remarkLines.length > 0 ? { remark: y[0].remarkLines.join("\n") } : {}
	};
	b = _(b, y[0]._item);
	let x = [[b, 0]];
	for (let e = 1; e < y.length; e++) {
		let { level: t, text: n, taskStatus: r, remarkLines: i, _item: a } = y[e], o = t === 0 ? 1 : t, s = {
			id: "md-tmp",
			text: n,
			...r ? { taskStatus: r } : {},
			...i.length > 0 ? { remark: i.join("\n") } : {},
			...a.placeholder ? { placeholder: !0 } : {}
		};
		for (; x.length > 1 && x[x.length - 1][1] >= o;) x.pop();
		let c = x[x.length - 1][0];
		c.children ||= [];
		let l = c.children.length;
		s.id = `${c.id}-${l}`, s = _(s, a), c.children.push(s), x.push([s, o]);
	}
	if (d(b), o && s) {
		let [e] = n(o, [b], s);
		return e;
	}
	return b;
}
function d(e) {
	if (e.children && e.children.length === 0) delete e.children;
	else if (e.children) for (let t of e.children) d(t);
}
function f(e, t = 0, n) {
	let r = n && n.length > 0 ? n : void 0, s;
	if (t === 0) {
		let t = e.text;
		r && (t = o(r, e, t)), s = (e.listRoot ? "- " : "") + t + "\n";
	} else {
		let n = "";
		e.taskStatus && (n = {
			todo: "[ ]",
			doing: "[-]",
			done: "[x]"
		}[e.taskStatus] + " ");
		let i = "- ";
		r && (i = a(r, e, i));
		let c = e.text;
		r && (c = o(r, e, c)), s = "  ".repeat(t - 1) + i + n + c + "\n";
	}
	if (e.remark) {
		let n = t === 0 ? "  " : "  ".repeat(t);
		for (let t of e.remark.split("\n")) s += n + "> " + t + "\n";
	}
	if (r) {
		let n = i(r, e, t), a = t === 0 ? "  " : "  ".repeat(t);
		for (let e of n) s += a + e + "\n";
	}
	if (e.children) for (let r of e.children) s += f(r, t + 1, n);
	return s;
}
function p(e, t) {
	let i = t && t.length > 0 ? t : void 0, a = e, o = i ? {
		lines: [],
		frontMatter: {}
	} : void 0;
	i && o && (a = r(i, a, o)), a = a.split("\n").filter((e) => e.trim().length > 0 && !/^\s*%%/.test(e)).join("\n");
	let s = a.split(/\n[ \t]*\n/).filter((e) => e.trim());
	if (s.length === 0) return [{
		id: "md-0",
		text: "Root"
	}];
	let c = i ? i.map((e) => ({
		...e,
		preParseMarkdown: void 0
	})) : void 0;
	if (s.length === 1) {
		let e = [u(a, c)];
		return i && o ? n(i, e, o) : e;
	}
	let l = s.map((e, t) => {
		let n = u(e, c);
		return m(n, `md-${t}`), n;
	});
	return i && o ? n(i, l, o) : l;
}
function m(e, t) {
	if (e.id = t, e.children) for (let n = 0; n < e.children.length; n++) m(e.children[n], `${t}-${n}`);
}
function h(e, t) {
	let n = t && t.length > 0 ? t : void 0, r = "";
	n && (r = s(n, e));
	let i = e.map((e) => f(e, 0, t)).join("\n");
	return r + i;
}
function g(e, t) {
	let i = {
		lines: [],
		frontMatter: {}
	}, a = r(t, e, i);
	a = a.split("\n").filter((e) => e.trim().length > 0 && !/^\s*%%/.test(e)).join("\n");
	let o = t.map((e) => ({
		...e,
		preParseMarkdown: void 0
	})), s = a.split(/\n[ \t]*\n/).filter((e) => e.trim());
	if (s.length === 0) return {
		roots: [{
			id: "md-0",
			text: "Root"
		}],
		frontMatter: i.frontMatter
	};
	let c;
	return c = s.length === 1 ? [u(a, o)] : s.map((e, t) => {
		let n = u(e, o);
		return m(n, `md-${t}`), n;
	}), c = n(t, c, i), {
		roots: c,
		frontMatter: i.frontMatter
	};
}
//#endregion
export { u as parseMarkdownList, p as parseMarkdownMultiRoot, g as parseMarkdownWithFrontMatter, f as toMarkdownList, h as toMarkdownMultiRoot };
