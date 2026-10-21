import { highlightMindmapHTML as e } from "../utils/highlight.js";
import { useCallback as t, useEffect as n, useRef as r } from "react";
import { jsx as i } from "react/jsx-runtime";
//#region src/components/MindMap/components/MindMapTextEditor.tsx
function a(e) {
	let t = window.getSelection();
	if (!t || t.rangeCount === 0) return 0;
	let n = t.getRangeAt(0), r = 0, i = e.childNodes;
	for (let e = 0; e < i.length; e++) {
		let t = i[e];
		if (n.startContainer === t || t.contains(n.startContainer)) {
			let e = document.createRange();
			return e.selectNodeContents(t), e.setEnd(n.startContainer, n.startOffset), r += e.toString().length, r;
		}
		r += (t.textContent || "").length, e < i.length - 1 && (r += 1);
	}
	return r;
}
function o(e, t) {
	let n = window.getSelection();
	if (!n) return;
	let r = t, i = e.childNodes;
	for (let e = 0; e < i.length; e++) {
		let t = i[e], a = (t.textContent || "").length;
		if (r <= a) {
			let e = document.createRange(), i = !1, a = (t) => {
				if (t.nodeType === Node.TEXT_NODE) {
					let n = t.textContent.length;
					if (r <= n) return e.setStart(t, r), e.collapse(!0), i = !0, !0;
					r -= n;
				} else for (let e = 0; e < t.childNodes.length; e++) if (a(t.childNodes[e])) return !0;
				return !1;
			};
			a(t), i || (e.setStart(t, 0), e.collapse(!0)), n.removeAllRanges(), n.addRange(e);
			return;
		}
		r -= a + 1;
	}
	let a = document.createRange();
	a.selectNodeContents(e), a.collapse(!1), n.removeAllRanges(), n.addRange(a);
}
function s(e) {
	let t = e.childNodes;
	if (t.length === 0) return "";
	let n = [];
	for (let e = 0; e < t.length; e++) n.push(t[e].textContent || "");
	return n.join("\n").replace(/\u00a0/g, " ");
}
function c({ value: c, onChange: l, readOnly: u, className: d, style: f }) {
	let p = r(null), m = r(!1), h = r(c), g = r(!1), _ = r([{
		text: c,
		caret: 0
	}]), v = r([]), y = r(0);
	n(() => {
		let t = p.current;
		if (t) {
			if (m.current) {
				m.current = !1;
				return;
			}
			c === h.current && t.innerHTML !== "" || (h.current = c, t.innerHTML = e(c), _.current = [{
				text: c,
				caret: 0
			}], v.current = []);
		}
	}, [c]);
	let b = t((e, t) => {
		let n = Date.now(), r = _.current;
		n - y.current < 300 && r.length > 1 ? r[r.length - 1] = {
			text: e,
			caret: t
		} : (r.push({
			text: e,
			caret: t
		}), r.length > 100 && r.shift()), y.current = n, v.current = [];
	}, []), x = t(() => {
		let t = p.current;
		if (!t || g.current) return;
		let n = a(t), r = s(t);
		m.current = !0, h.current = r, t.innerHTML = e(r), o(t, n), b(r, n), l(r);
	}, [l, b]), S = t((t) => {
		let n = p.current;
		if (n && !g.current) {
			if ((t.metaKey || t.ctrlKey) && t.key === "z" && !t.shiftKey) {
				t.preventDefault();
				let r = _.current;
				if (r.length <= 1) return;
				v.current.push(r.pop());
				let i = r[r.length - 1];
				m.current = !0, h.current = i.text, n.innerHTML = e(i.text), o(n, i.caret), l(i.text);
				return;
			}
			if ((t.metaKey || t.ctrlKey) && (t.key === "z" && t.shiftKey || t.key === "y")) {
				t.preventDefault();
				let r = v.current;
				if (r.length === 0) return;
				let i = r.pop();
				_.current.push(i), m.current = !0, h.current = i.text, n.innerHTML = e(i.text), o(n, i.caret), l(i.text);
				return;
			}
			if (t.key === "Enter") {
				t.preventDefault();
				let r = a(n), i = s(n), c = i.slice(0, r) + "\n" + i.slice(r);
				m.current = !0, h.current = c, n.innerHTML = e(c), o(n, r + 1), b(c, r + 1), l(c);
				return;
			}
			if (t.key === "Tab") {
				t.preventDefault();
				let r = a(n), i = s(n);
				if (t.shiftKey) {
					let t = i.lastIndexOf("\n", r - 1) + 1, a = i.slice(t), s = a.match(/^ {1,2}/);
					if (!s) return;
					let c = s[0].length, u = i.slice(0, t) + a.slice(c);
					m.current = !0, h.current = u, n.innerHTML = e(u), o(n, Math.max(t, r - c)), b(u, Math.max(t, r - c)), l(u);
				} else {
					let t = i.slice(0, r) + "  " + i.slice(r);
					m.current = !0, h.current = t, n.innerHTML = e(t), o(n, r + 2), b(t, r + 2), l(t);
				}
				return;
			}
		}
	}, [l, b]), C = t((t) => {
		t.preventDefault();
		let n = t.clipboardData.getData("text/plain"), r = p.current;
		if (!r) return;
		let i = s(r), c = a(r), u = i.slice(0, c) + n + i.slice(c), d = c + n.length;
		m.current = !0, h.current = u, r.innerHTML = e(u), o(r, d), b(u, d), l(u);
	}, [l, b]), w = t(() => {
		g.current = !0;
	}, []), T = t(() => {
		g.current = !1, x();
	}, [x]);
	return /* @__PURE__ */ i("pre", {
		ref: p,
		className: `mindmap-text-editor${d ? ` ${d}` : ""}`,
		contentEditable: !u,
		suppressContentEditableWarning: !0,
		spellCheck: !1,
		onInput: x,
		onKeyDown: S,
		onPaste: C,
		onCompositionStart: w,
		onCompositionEnd: T,
		style: {
			...u ? { opacity: .7 } : void 0,
			...f
		}
	});
}
//#endregion
export { c as MindMapTextEditor };
