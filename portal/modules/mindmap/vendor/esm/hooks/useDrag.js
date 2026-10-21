import { getDescendantIds as e, moveChildToSide as t, swapSiblingsMulti as n } from "../utils/tree-ops.js";
import { useCallback as r, useEffect as i, useMemo as a, useRef as o, useState as s } from "react";
//#region src/components/MindMap/hooks/useDrag.ts
function c({ svgRef: c, zoom: l, pan: u, setPan: d, setZoom: f, nodeMap: p, nodes: m, updateData: h, direction: g, splitIndices: _, setSplitIndices: v, mapData: y, contentCenter: b }) {
	let [x, S] = s(!1), [C, w] = s(null), [T, E] = s(null), D = o({
		x: 0,
		y: 0,
		panX: 0,
		panY: 0
	}), O = o({
		x: 0,
		y: 0
	}), k = o(!1), A = o(0), j = o({
		type: "none",
		startPan: {
			x: 0,
			y: 0
		},
		startZoom: 1,
		startTouches: [],
		pinchDistance: 0,
		contentCenter: {
			x: 0,
			y: 0
		},
		touchNodeId: null
	}), M = a(() => {
		if (!C) return /* @__PURE__ */ new Set();
		let t = new Set([C]);
		for (let n of e(C, m)) t.add(n);
		return t;
	}, [C, m]), N = r((e, t) => {
		let n = c.current.getBoundingClientRect();
		return {
			x: (e - n.left - u.x) / l,
			y: (t - n.top - u.y) / l
		};
	}, [
		c,
		u,
		l
	]), P = r((e, r, i) => {
		let a = N(e, r), o = {
			x: a.x + O.current.x,
			y: a.y + O.current.y
		};
		E(o);
		let s = Date.now();
		if (s - A.current > 500) {
			let e = p[i];
			if (e && e.parentId) {
				if (e.depth === 1 && g === "both") {
					let n = e.side, r = n === "right" && o.x < 0, a = n === "left" && o.x > 0;
					if (r || a) {
						let n = r ? "left" : "right", a = e.parentId, o = y.find((e) => e.id === a);
						if (o) {
							let e = t(o, i, n, _[a] ?? Math.ceil((o.children?.length ?? 0) / 2));
							if (e) {
								A.current = s, v((t) => ({
									...t,
									[a]: e.newSplitIndex
								})), h((t) => t.map((t) => t.id === a ? e.data : t));
								return;
							}
						}
					}
				}
				let r = m.filter((t) => t.parentId === e.parentId && t.id !== i && t.side === e.side);
				for (let t of r) {
					let r = Math.max(e.height, t.height) * .6;
					if (Math.abs(o.y - t.y) < r) {
						A.current = s, h((e) => n(e, i, t.id));
						break;
					}
				}
			}
		}
	}, [
		N,
		p,
		m,
		h,
		g,
		_,
		v,
		y
	]), F = r((e) => {
		e.button === 0 && (k.current = !1, S(!0), D.current = {
			x: e.clientX,
			y: e.clientY,
			panX: u.x,
			panY: u.y
		});
	}, [u]), I = r((e) => {
		x ? (k.current = !0, d({
			x: D.current.panX + (e.clientX - D.current.x),
			y: D.current.panY + (e.clientY - D.current.y)
		})) : C && (k.current = !0, P(e.clientX, e.clientY, C));
	}, [
		x,
		C,
		d,
		P
	]), L = r(() => {
		S(!1), w(null), E(null);
	}, []), R = r((e, t) => {
		if (e.stopPropagation(), e.button !== 0) return;
		k.current = !1;
		let n = p[t];
		if (!n) return;
		w(t), E({
			x: n.x,
			y: n.y
		});
		let r = N(e.clientX, e.clientY);
		O.current = {
			x: n.x - r.x,
			y: n.y - r.y
		};
	}, [p, N]), z = o(u), B = o(l), V = o(p), H = o(b), U = o(C);
	i(() => {
		z.current = u, B.current = l, V.current = p, H.current = b, U.current = C;
	});
	let W = r((e) => {
		let t = e;
		for (; t && t !== c.current;) {
			if (t.classList?.contains("mindmap-node-g")) {
				let e = t.getAttribute("transform");
				if (e) for (let t of m) {
					let n = t.x, r = t.y;
					if (e.includes(`translate(${n}`) && e.includes(`${r})`)) return t.id;
				}
			}
			t = t.parentElement;
		}
		return null;
	}, [c, m]);
	return i(() => {
		let e = c.current;
		if (!e) return;
		let r = e;
		function i(e, t) {
			return Math.hypot(t.clientX - e.clientX, t.clientY - e.clientY);
		}
		function a(e) {
			e.preventDefault();
			let t = e.touches;
			if (t.length === 2) {
				let e = i(t[0], t[1]);
				j.current = {
					type: "pinch",
					startPan: { ...z.current },
					startZoom: B.current,
					startTouches: [{
						id: t[0].identifier,
						x: t[0].clientX,
						y: t[0].clientY
					}, {
						id: t[1].identifier,
						x: t[1].clientX,
						y: t[1].clientY
					}],
					pinchDistance: e,
					contentCenter: { ...H.current },
					touchNodeId: null
				}, U.current && (w(null), E(null)), S(!1);
				return;
			}
			if (t.length === 1) {
				let n = t[0], i = W(e.target);
				if (i) {
					let t = e.target;
					for (; t && t !== r;) {
						if (t.classList?.contains("mindmap-add-btn")) return;
						t = t.parentElement;
					}
					k.current = !1;
					let a = V.current[i];
					if (a) {
						w(i), E({
							x: a.x,
							y: a.y
						});
						let e = r.getBoundingClientRect(), t = (n.clientX - e.left - z.current.x) / B.current, o = (n.clientY - e.top - z.current.y) / B.current;
						O.current = {
							x: a.x - t,
							y: a.y - o
						}, j.current = {
							type: "node-drag",
							startPan: { ...z.current },
							startZoom: B.current,
							startTouches: [{
								id: n.identifier,
								x: n.clientX,
								y: n.clientY
							}],
							pinchDistance: 0,
							contentCenter: { ...H.current },
							touchNodeId: i
						};
					}
				} else k.current = !1, S(!0), D.current = {
					x: n.clientX,
					y: n.clientY,
					panX: z.current.x,
					panY: z.current.y
				}, j.current = {
					type: "canvas-pan",
					startPan: { ...z.current },
					startZoom: B.current,
					startTouches: [{
						id: n.identifier,
						x: n.clientX,
						y: n.clientY
					}],
					pinchDistance: 0,
					contentCenter: { ...H.current },
					touchNodeId: null
				};
			}
		}
		function o(e) {
			e.preventDefault();
			let a = j.current, o = e.touches;
			if (a.type === "pinch" && o.length >= 2) {
				let e = i(o[0], o[1]) / a.pinchDistance, t = Math.min(Math.max(a.startZoom * e, .1), 5), n = r.clientWidth / 2, s = r.clientHeight / 2, c = a.contentCenter;
				f(t), d({
					x: n - c.x * t,
					y: s - c.y * t
				});
				return;
			}
			if (a.type === "canvas-pan" && o.length === 1) {
				k.current = !0;
				let e = o[0];
				d({
					x: D.current.panX + (e.clientX - D.current.x),
					y: D.current.panY + (e.clientY - D.current.y)
				});
				return;
			}
			if (a.type === "node-drag" && o.length === 1 && a.touchNodeId) {
				k.current = !0;
				let e = o[0], i = r.getBoundingClientRect(), s = (e.clientX - i.left - z.current.x) / B.current, c = (e.clientY - i.top - z.current.y) / B.current, l = {
					x: s + O.current.x,
					y: c + O.current.y
				};
				E(l);
				let u = Date.now();
				if (u - A.current > 500) {
					let e = V.current[a.touchNodeId];
					if (e && e.parentId) {
						if (e.depth === 1 && g === "both") {
							let n = e.side, r = n === "right" && l.x < 0, i = n === "left" && l.x > 0;
							if (r || i) {
								let n = r ? "left" : "right", i = e.parentId, o = y.find((e) => e.id === i);
								if (o) {
									let e = _[i] ?? Math.ceil((o.children?.length ?? 0) / 2), r = t(o, a.touchNodeId, n, e);
									if (r) {
										A.current = u, v((e) => ({
											...e,
											[i]: r.newSplitIndex
										})), h((e) => e.map((e) => e.id === i ? r.data : e));
										return;
									}
								}
							}
						}
						let r = m.filter((t) => t.parentId === e.parentId && t.id !== a.touchNodeId && t.side === e.side);
						for (let t of r) {
							let r = Math.max(e.height, t.height) * .6;
							if (Math.abs(l.y - t.y) < r) {
								A.current = u, h((e) => n(e, a.touchNodeId, t.id));
								break;
							}
						}
					}
				}
				return;
			}
		}
		function s(e) {
			e.preventDefault();
			let t = j.current, n = e.touches;
			if (t.type === "pinch" && n.length === 1) {
				let e = n[0];
				D.current = {
					x: e.clientX,
					y: e.clientY,
					panX: z.current.x,
					panY: z.current.y
				}, S(!0), j.current = {
					...t,
					type: "canvas-pan",
					startTouches: [{
						id: e.identifier,
						x: e.clientX,
						y: e.clientY
					}]
				};
				return;
			}
			n.length === 0 && (S(!1), w(null), E(null), j.current = {
				type: "none",
				startPan: {
					x: 0,
					y: 0
				},
				startZoom: 1,
				startTouches: [],
				pinchDistance: 0,
				contentCenter: {
					x: 0,
					y: 0
				},
				touchNodeId: null
			});
		}
		return r.addEventListener("touchstart", a, { passive: !1 }), r.addEventListener("touchmove", o, { passive: !1 }), r.addEventListener("touchend", s, { passive: !1 }), r.addEventListener("touchcancel", s, { passive: !1 }), () => {
			r.removeEventListener("touchstart", a), r.removeEventListener("touchmove", o), r.removeEventListener("touchend", s), r.removeEventListener("touchcancel", s);
		};
	}, [
		c,
		d,
		f,
		W,
		g,
		y,
		_,
		v,
		h,
		m
	]), {
		draggingCanvas: x,
		floatingNodeId: C,
		floatingPos: T,
		floatingSubtreeIds: M,
		didDragRef: k,
		handleCanvasMouseDown: F,
		handleMouseMove: I,
		handleMouseUp: L,
		handleNodeMouseDown: R
	};
}
//#endregion
export { c as useDrag };
