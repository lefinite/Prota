//#region src/components/MindMap/utils/tree-ops.ts
function e() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function t(e) {
	return Array.isArray(e) ? e : [e];
}
function n(e, t, r) {
	if (e.id === t) {
		let t = {
			...e,
			...r
		};
		return "taskStatus" in r && r.taskStatus === void 0 && delete t.taskStatus, "remark" in r && r.remark === void 0 && delete t.remark, t;
	}
	return e.children ? {
		...e,
		children: e.children.map((e) => n(e, t, r))
	} : e;
}
function r(e, t, n) {
	return e.id === t ? {
		...e,
		children: [...e.children || [], n]
	} : e.children ? {
		...e,
		children: e.children.map((e) => r(e, t, n))
	} : e;
}
function i(e, t) {
	if (!e.children) return e;
	let n = e.children.filter((e) => e.id !== t).map((e) => i(e, t));
	return {
		...e,
		children: n.length > 0 ? n : void 0
	};
}
function a(e, t, n) {
	if (!e.children) return e;
	let r = e.children.findIndex((e) => e.id === t), i = e.children.findIndex((e) => e.id === n);
	if (r !== -1 && i !== -1) {
		let t = [...e.children];
		return [t[r], t[i]] = [t[i], t[r]], {
			...e,
			children: t
		};
	}
	return {
		...e,
		children: e.children.map((e) => a(e, t, n))
	};
}
function o(e, t) {
	if (e.id === t) return structuredClone(e);
	if (!e.children) return null;
	for (let n of e.children) {
		let e = o(n, t);
		if (e) return e;
	}
	return null;
}
function s(t) {
	return {
		...t,
		id: e(),
		children: t.children?.map((e) => s(e))
	};
}
function c(e, t) {
	let n = {};
	for (let e of t) e.parentId && (n[e.parentId] || (n[e.parentId] = []), n[e.parentId].push(e.id));
	let r = [], i = [e];
	for (; i.length > 0;) {
		let e = n[i.pop()];
		if (e) for (let t of e) r.push(t), i.push(t);
	}
	return r;
}
function l(e, t, r) {
	return e.map((e) => n(e, t, r));
}
function u(e, t, n) {
	return e.map((e) => r(e, t, n));
}
function d(e, t) {
	let n = e.filter((e) => e.id !== t);
	return n.length < e.length ? n : e.map((e) => i(e, t));
}
function f(e, t, n) {
	return e.map((e) => a(e, t, n));
}
function p(e, t) {
	for (let n of e) {
		let e = o(n, t);
		if (e) return e;
	}
	return null;
}
function m(e, t, n, r) {
	let i = [...e.children || []], a = Math.min(r, i.length);
	return n === "right" ? (i.splice(a, 0, t), {
		data: {
			...e,
			children: i
		},
		newSplitIndex: a + 1
	}) : (i.push(t), {
		data: {
			...e,
			children: i
		},
		newSplitIndex: a
	});
}
function h(e, t, n, r) {
	let i = e.children || [], a = i.findIndex((e) => e.id === t);
	if (a === -1) return null;
	let o = Math.min(Math.max(r, 0), i.length);
	if (n === "right" && a < o || n === "left" && a >= o) return null;
	let s = [...i], [c] = s.splice(a, 1);
	return n === "left" ? (s.push(c), {
		data: {
			...e,
			children: s
		},
		newSplitIndex: o - 1
	}) : (s.splice(o, 0, c), {
		data: {
			...e,
			children: s
		},
		newSplitIndex: o + 1
	});
}
//#endregion
export { u as addChildMulti, m as addChildToSide, p as findSubtreeMulti, e as generateId, c as getDescendantIds, h as moveChildToSide, t as normalizeData, s as regenerateIds, d as removeNodeMulti, f as swapSiblingsMulti, l as updateNodeFieldsMulti };
