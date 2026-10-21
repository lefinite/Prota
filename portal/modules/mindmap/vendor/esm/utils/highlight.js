//#region src/components/MindMap/utils/highlight.ts
function e(e) {
	return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function t(t, n) {
	return `<span class="${t}">${e(n)}</span>`;
}
function n(n) {
	let r = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|==[^=]+==#[a-zA-Z][\w-]*|\$\$[^$]+\$\$|\$[^$\n]+\$|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|->\.?\s*\{#[\w-]+\}(?:\s*"[^"]*")?\{#[\w-]+\}|\*(?!\*)[^*]+\*(?!\*))/g, i = "", a = 0, o;
	for (; (o = r.exec(n)) !== null;) {
		o.index > a && (i += e(n.slice(a, o.index)));
		let s = o[0];
		s.startsWith("**") ? i += `<span class="hl-root">${e(s)}</span>` : s.startsWith("~~") ? i += `<span class="hl-cmt" style="text-decoration:line-through">${e(s)}</span>` : s.startsWith("`") ? i += t("hl-tag", s) : s.startsWith("==") || s.startsWith("$$") || s.startsWith("$") && !s.startsWith("${") ? i += t("hl-num", s) : s.startsWith("![") || s.startsWith("[") || s.startsWith("->") ? i += t("hl-fn", s) : s.startsWith("{#") ? i += t("hl-attr", s) : s.startsWith("#") ? i += t("hl-kw", s) : s.startsWith("*") && (i += `<span class="hl-italic" style="font-style:italic">${e(s)}</span>`), a = r.lastIndex;
	}
	return a < n.length && (i += e(n.slice(a))), i;
}
function r(r) {
	let i = r.split("\n"), a = !1, o = !1;
	return i.map((r) => {
		if (r.length === 0) return "<div><br></div>";
		if (!r.trim()) return `<div>${e(r)}</div>`;
		if (r.trim() === "---") return a = !a, `<div>${t("hl-op", r)}</div>`;
		if (a) {
			let n = r.match(/^(\s*)([\w-]+)(\s*:\s*)(.*)/);
			return n ? `<div>${e(n[1])}${t("hl-attr", n[2])}${t("hl-op", n[3])}${t("hl-str", n[4])}</div>` : `<div>${e(r)}</div>`;
		}
		let i = r.match(/^(\s*)(%%.*)/);
		if (i) return `<div>${e(i[1])}${t("hl-cmt", i[2])}</div>`;
		let s = r.match(/^(\s*)(>.*)/);
		if (s) return `<div>${e(s[1])}${t("hl-cmt", s[2])}</div>`;
		let c = r.match(/^(\s*)(\|)(.*)/);
		if (c) return `<div>${e(c[1])}${t("hl-op", c[2])}${n(c[3])}</div>`;
		let l = r.match(/^(\s*)([-+]\.?\s)(.*)/);
		if (l) {
			let [, r, i, a] = l, s = r === "" && !o;
			r === "" && (o = !0);
			let c = `${e(r)}${t("hl-op", i)}`, u = a.match(/^\[([ x-])\]\s*/);
			if (u) {
				let e = u[1];
				c += `${t(e === "x" ? "hl-str" : e === "-" ? "hl-num" : "hl-task-pending", `[${e}] `)}`, c += s ? `<span class="hl-root">${n(a.slice(u[0].length))}</span>` : n(a.slice(u[0].length));
			} else c += s ? `<span class="hl-root">${n(a)}</span>` : n(a);
			return `<div>${c}</div>`;
		}
		return o = !0, `<div><span class="hl-root">${e(r)}</span></div>`;
	}).join("");
}
//#endregion
export { r as highlightMindmapHTML };
