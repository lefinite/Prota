import { updateNodeFieldsMulti as e } from "../utils/tree-ops.js";
import { useCallback as t, useEffect as n, useState as r } from "react";
//#region src/components/MindMap/hooks/useNodeEdit.ts
function i(e) {
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
function a({ nodeMap: a, updateData: o, onTextChange: s }) {
	let [c, l] = r(null), [u, d] = r(""), [f, p] = r(null);
	return n(() => {
		f && a[f] && (l(f), d(""), p(null));
	}, [f, a]), {
		editingId: c,
		editText: u,
		setEditText: d,
		pendingEditId: f,
		setPendingEditId: p,
		handleNodeDoubleClick: t((e, t, n) => {
			e.stopPropagation(), l(t), d(n);
		}, []),
		commitEdit: t(() => {
			if (c) {
				let t = u.trim();
				if (t) {
					let n = a[c]?.text ?? "", { taskStatus: r, text: l } = i(t);
					o((t) => e(t, c, {
						text: l,
						taskStatus: r
					})), l !== n && s?.(c, n, l);
				}
			}
			l(null);
		}, [
			c,
			u,
			o,
			a,
			s
		]),
		cancelEdit: t(() => {
			l(null);
		}, [])
	};
}
//#endregion
export { a as useNodeEdit };
