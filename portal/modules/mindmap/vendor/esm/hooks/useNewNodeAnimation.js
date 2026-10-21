import { useEffect as e, useRef as t, useState as n } from "react";
//#region src/components/MindMap/hooks/useNewNodeAnimation.ts
function r(r) {
	let [i, a] = n(/* @__PURE__ */ new Set()), o = t(/* @__PURE__ */ new Set());
	return e(() => {
		let e = new Set(r.map((e) => e.id));
		if (o.current.size > 0) {
			let t = /* @__PURE__ */ new Set();
			for (let n of e) o.current.has(n) || t.add(n);
			if (t.size > 0) {
				a(t);
				let n = setTimeout(() => a(/* @__PURE__ */ new Set()), 350);
				return o.current = e, () => clearTimeout(n);
			}
		}
		o.current = e;
	}, [r]), i;
}
//#endregion
export { r as useNewNodeAnimation };
