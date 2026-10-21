import { generateCSSVariables as e } from "./utils/theme.js";
import { runRenderOverlay as t } from "./plugins/runner.js";
import { computeEdgePath as n, layoutMultiRoot as r } from "./utils/layout.js";
import { buildExportSVG as i, buildExportSVGForPNG as a, exportToPNG as ee } from "./utils/export.js";
import { parseMarkdownMultiRoot as o, parseMarkdownWithFrontMatter as s, toMarkdownMultiRoot as c } from "./utils/markdown.js";
import { detectLocale as te, resolveMessages as ne } from "./utils/i18n.js";
import { addChildMulti as re, addChildToSide as ie, findSubtreeMulti as ae, generateId as oe, normalizeData as se, regenerateIds as ce, removeNodeMulti as le } from "./utils/tree-ops.js";
import { useTheme as ue } from "./hooks/useTheme.js";
import { usePanZoom as de } from "./hooks/usePanZoom.js";
import { useDrag as fe } from "./hooks/useDrag.js";
import { useNodeEdit as pe } from "./hooks/useNodeEdit.js";
import { useNewNodeAnimation as me } from "./hooks/useNewNodeAnimation.js";
import { MindMapNode as he } from "./components/MindMapNode.js";
import { MindMapControls as ge } from "./components/MindMapControls.js";
import { MindMapContextMenu as _e } from "./components/MindMapContextMenu.js";
import { getKatexSync as ve, loadKatexStyle as ye, onKatexReady as be, renderLatexToHtml as xe } from "./plugins/latex.js";
import { MindMapAIInput as Se } from "./components/MindMapAIInput.js";
/* empty css        */
import { forwardRef as l, useCallback as u, useEffect as d, useImperativeHandle as Ce, useMemo as f, useRef as p, useState as m } from "react";
import { Fragment as we, jsx as h, jsxs as g } from "react/jsx-runtime";
//#region src/components/MindMap/MindMap.tsx
function Te(e, t) {
	let n = URL.createObjectURL(e), r = document.createElement("a");
	r.href = n, r.download = t, document.body.appendChild(r), r.click(), document.body.removeChild(r), URL.revokeObjectURL(n);
}
var _ = l(function({ data: l, markdown: _, defaultDirection: Ee = "both", theme: De = "auto", locale: Oe, messages: ke, readonly: v = !1, toolbar: y = !0, ai: Ae, onDataChange: je, onEvent: Me, plugins: Ne, textEditor: b }, Pe) {
	let Fe = p(null), x = p(null), S = Ne && Ne.length > 0 ? Ne : void 0, Ie = f(() => {
		if (l || _ === void 0) return null;
		if (S) {
			let e = s(_, S), t = e.frontMatter.direction, n = e.frontMatter.theme;
			return {
				roots: e.roots,
				direction: t === "left" || t === "right" || t === "both" ? t : void 0,
				theme: n === "light" || n === "dark" || n === "auto" ? n : void 0
			};
		}
		return {
			roots: o(_),
			direction: void 0,
			theme: void 0
		};
	}, []), [C, w] = m(() => l ? se(l) : Ie ? Ie.roots : [{
		id: "md-0",
		text: "Root"
	}]), [T, Le] = m(() => Ie?.direction ?? Ee), [E, D] = m({}), [O, Re] = m(null), [k, ze] = m(null), [Be, Ve] = m({}), He = p(null), [Ue, We] = m("view"), [Ge, Ke] = m(!1), [A, qe] = m(""), [Je, Ye] = m(null), [Xe, Ze] = m({}), [Qe, $e] = m(null), [et, tt] = m(() => Ie?.theme);
	d(() => {
		l && w(se(l));
	}, [l]), d(() => {
		if (_ !== void 0) if (S) {
			let { roots: e, frontMatter: t } = s(_, S);
			if (w(e), t.direction) {
				let e = t.direction;
				(e === "left" || e === "right" || e === "both") && Le(e);
			}
			if (t.theme) {
				let e = t.theme;
				(e === "light" || e === "dark" || e === "auto") && tt(e);
			}
		} else w(o(_));
	}, [_, S]);
	let j = u((e) => {
		w((t) => {
			let n = e(t);
			return je?.(n), n;
		});
	}, [je]), nt = p(Me);
	nt.current = Me;
	let M = u((e) => {
		nt.current?.(e);
	}, []), N = ue(et ?? De), P = f(() => ne(Oe ?? te(), ke), [Oe, ke]), rt = f(() => y === !1 ? { zoom: !1 } : y === !0 || y === void 0 ? { zoom: !0 } : { zoom: y.zoom ?? !0 }, [y]), { nodes: F, edges: I } = f(() => r(C, T, Be, E, S, v, Xe), [
		C,
		T,
		Be,
		E,
		S,
		v,
		Xe
	]);
	d(() => {
		let e = {}, t = !1;
		for (let n of F) n.depth === 1 && !Be[n.id] && (e[n.id] = n.color, t = !0);
		t && Ve((t) => ({
			...t,
			...e
		}));
	}, [F, Be]);
	let L = f(() => {
		let e = {};
		for (let t of F) e[t.id] = t;
		return e;
	}, [F]), it = f(() => {
		if (!Qe) return {};
		let e = {}, t = [];
		for (let e of F) e.parentId === Qe && t.push({
			id: e.id,
			depth: 1
		});
		for (; t.length > 0;) {
			let { id: n, depth: r } = t.shift();
			e[n] = r * 100;
			for (let e of F) e.parentId === n && t.push({
				id: e.id,
				depth: r + 1
			});
		}
		return e;
	}, [Qe, F]), { pan: R, setPan: z, zoom: B, setZoom: V, animateTo: H, autoFit: U, zoomIn: at, zoomOut: ot, contentCenter: st, panToNode: ct } = de(x, F), { draggingCanvas: lt, floatingNodeId: W, floatingPos: G, floatingSubtreeIds: K, didDragRef: ut, handleCanvasMouseDown: dt, handleMouseMove: ft, handleMouseUp: pt, handleNodeMouseDown: mt } = fe({
		svgRef: x,
		zoom: B,
		pan: R,
		setPan: z,
		setZoom: V,
		nodeMap: L,
		nodes: F,
		updateData: j,
		direction: T,
		splitIndices: E,
		setSplitIndices: D,
		mapData: C,
		contentCenter: st
	}), { editingId: ht, editText: gt, setEditText: q, pendingEditId: J, setPendingEditId: Y, handleNodeDoubleClick: _t, commitEdit: vt, cancelEdit: yt } = pe({
		nodeMap: L,
		updateData: j,
		onTextChange: (e, t, n) => {
			M({
				type: "nodeTextChange",
				nodeId: e,
				oldText: t,
				newText: n
			});
		}
	}), bt = me(F), [X, xt] = m(!1);
	let prevEditingIdRef = p(ht);
	let justFinishedEditingId = null;
	if (prevEditingIdRef.current !== ht) {
		if (prevEditingIdRef.current && !ht) {
			justFinishedEditingId = prevEditingIdRef.current;
		}
		prevEditingIdRef.current = ht;
	}
	d(() => {
		// Prota: only auto-fit the view ONCE, on initial load. Without this guard
		// every node-array change re-runs autoFit — including committing a text
		// edit, which resizes a node and shifts the content's center, so autoFit
		// recenters the whole canvas and the just-edited box visibly drifts. After
		// the initial fit the user keeps manual pan/zoom; new nodes still scroll
		// into view via panToNode (the pendingEditId effect below).
		if (X) return;
		if (W || J) return;
		let e = U();
		e ? X ? (V(e.zoom), z({
			x: e.panX,
			y: e.panY
		})) : (V(e.zoom * .92), z({
			x: e.panX,
			y: e.panY
		}), requestAnimationFrame(() => {
			xt(!0), H(e.zoom, e.panX, e.panY);
		})) : X || requestAnimationFrame(() => xt(!0));
	}, [
		F,
		U,
		W,
		J,
		V,
		z,
		X,
		H
	]), d(() => {
		J && L[J] && ct(J);
	}, [
		J,
		L,
		ct
	]);
	let St = u((e) => {
		ze(null), dt(e);
	}, [dt]), Ct = u((e, t) => {
		e.stopPropagation(), ut.current || (Re(t), M({
			type: "nodeSelect",
			nodeId: t
		}));
	}, [ut, M]), wt = u(() => {
		ut.current || (Re(null), M({
			type: "nodeSelect",
			nodeId: null
		}));
	}, [ut, M]), Tt = u((e) => {
		e.preventDefault(), e.stopPropagation();
		let t = Fe.current;
		if (!t) return;
		let n = t.getBoundingClientRect();
		ze({
			x: e.clientX - n.left,
			y: e.clientY - n.top
		});
	}, []), Z = u(() => {
		ze(null);
	}, []), Et = u((e) => {
		if (!e) {
			Ye(null);
			return;
		}
		let t = L[e];
		if (!t || !t.remark) {
			Ye(null);
			return;
		}
		let n = x.current;
		if (!n) return;
		let r = n.getBoundingClientRect(), i = (t.x + t.width / 2) * B + R.x, a = (t.y - t.height / 2) * B + R.y;
		Ye({
			nodeId: e,
			text: t.remark,
			x: Math.min(i, r.width - 300),
			y: a - 8
		});
	}, [
		L,
		B,
		R
	]), Dt = u((e, t, n) => {
		if (e.stopPropagation(), v) return;
		let r = oe(), i = {
			id: r,
			text: P.newNode
		};
		C.some((e) => e.id === t) && n && T === "both" ? j((e) => e.map((e) => {
			if (e.id !== t) return e;
			let r = e.children || [], a = E[t] ?? Math.ceil(r.length / 2), ee = a, o = r.length - a, s = n;
			n === "right" && ee >= 3 * Math.max(o, 1) ? s = "left" : n === "left" && o >= 3 * Math.max(ee, 1) && (s = "right");
			let c = ie(e, i, s, a);
			return D((e) => ({
				...e,
				[t]: c.newSplitIndex
			})), c.data;
		})) : j((e) => re(e, t, i)), M({
			type: "nodeAdd",
			node: i,
			parentId: t
		}), Y(r), q("");
	}, [
		j,
		C,
		T,
		E,
		Y,
		q,
		P,
		v,
		M
	]), Ot = u(() => {
		if (v) return;
		let e = oe(), t = {
			id: e,
			text: P.newNode
		};
		j((e) => [...e, t]), M({
			type: "nodeAdd",
			node: t,
			parentId: null
		}), Y(e), q(""), Z();
	}, [
		j,
		Z,
		Y,
		q,
		P,
		v,
		M
	]), kt = u(() => {
		let e = i(F, I, {}, N, S);
		Te(new Blob([e], { type: "image/svg+xml;charset=utf-8" }), "mindmap.svg"), Z();
	}, [
		F,
		I,
		N,
		Z,
		S
	]), At = u(async () => {
		Te(await ee(a(F, I, { pngSafe: !0 }, N, S)), "mindmap.png"), Z();
	}, [
		F,
		I,
		N,
		Z,
		S
	]), jt = u(() => {
		let e = c(C, S);
		Te(new Blob([e], { type: "text/markdown;charset=utf-8" }), "mindmap.md"), Z();
	}, [
		C,
		Z,
		S
	]), Q = u(() => {
		let e = U();
		e && H(e.zoom, e.panX, e.panY);
	}, [U, H]), $ = u((e) => {
		Le(e), D({}), M({
			type: "directionChange",
			direction: e
		});
	}, [M]), Mt = u(() => {
		b && We((e) => {
			if (e === "view") return qe(c(C, S)), M({
				type: "modeChange",
				mode: "text"
			}), "text";
			{
				let e = S ? s(A, S).roots : o(A);
				return j(() => e), D({}), M({
					type: "modeChange",
					mode: "view"
				}), "view";
			}
		});
	}, [
		b,
		C,
		A,
		j,
		S,
		M
	]), Nt = u(() => {
		let e = Fe.current;
		e && (document.fullscreenElement ? document.exitFullscreen() : e.requestFullscreen());
	}, []);
	d(() => {
		let e = () => {
			let e = !!document.fullscreenElement;
			Ke(e), M({
				type: "fullscreenChange",
				fullscreen: e
			});
		};
		return document.addEventListener("fullscreenchange", e), () => document.removeEventListener("fullscreenchange", e);
	}, [M]);
	let Pt = p(B);
	d(() => {
		B !== Pt.current && (Pt.current = B, M({
			type: "zoomChange",
			zoom: B
		}));
	}, [B, M]);
	let Ft = u((e) => {
		if (e.key === "Escape" && k) {
			e.preventDefault(), Z();
			return;
		}
		if (ht) return;
		let t = e.metaKey || e.ctrlKey;
		if (e.shiftKey && !t) {
			if (e.code === "Equal") {
				e.preventDefault(), at();
				return;
			}
			if (e.code === "Minus") {
				e.preventDefault(), ot();
				return;
			}
			if (e.code === "Digit0") {
				e.preventDefault(), Q();
				return;
			}
			if (e.code === "KeyL") {
				e.preventDefault(), $("left");
				return;
			}
			if (e.code === "KeyR") {
				e.preventDefault(), $("right");
				return;
			}
			if (e.code === "KeyM") {
				e.preventDefault(), $("both");
				return;
			}
		}
		if (e.key === "Enter" && !t && O && !v) {
			e.preventDefault();
			let t = oe(), n = {
				id: t,
				text: P.newNode
			};
			C.some((e) => e.id === O) && T === "both" ? j((e) => e.map((e) => {
				if (e.id !== O) return e;
				let t = e.children || [], r = ie(e, n, "right", E[O] ?? Math.ceil(t.length / 2));
				return D((e) => ({
					...e,
					[O]: r.newSplitIndex
				})), r.data;
			})) : j((e) => re(e, O, n)), Y(t), q(""), M({
				type: "nodeAdd",
				node: n,
				parentId: O
			});
			return;
		}
		if ((e.key === "Delete" || e.key === "Backspace") && O && !v) {
			if (e.preventDefault(), C.some((e) => e.id === O) && C.length <= 1) return;
			M({
				type: "nodeDelete",
				nodeId: O
			}), j((e) => le(e, O)), Re(null);
			return;
		}
		if (t && e.key === "c" && O) {
			e.preventDefault(), He.current = ae(C, O);
			return;
		}
		if (t && e.key === "x" && O && !v) {
			if (e.preventDefault(), He.current = ae(C, O), C.some((e) => e.id === O) && C.length <= 1) return;
			M({
				type: "nodeDelete",
				nodeId: O
			}), j((e) => le(e, O)), Re(null);
			return;
		}
		if (t && e.key === "v" && O && He.current && !v) {
			e.preventDefault();
			let t = ce(He.current);
			j((e) => re(e, O, t)), M({
				type: "nodeAdd",
				node: t,
				parentId: O
			});
			return;
		}
	}, [
		ht,
		O,
		C,
		T,
		E,
		j,
		k,
		Z,
		Y,
		q,
		P,
		at,
		ot,
		Q,
		$,
		v,
		M
	]);
	Ce(Pe, () => ({
		exportToSVG() {
			return i(F, I, {}, N, S);
		},
		async exportToPNG() {
			return ee(a(F, I, {}, N, S));
		},
		exportToOutline() {
			return c(C, S);
		},
		getData() {
			return C;
		},
		setData(e) {
			w(se(e)), D({});
		},
		setMarkdown(e) {
			w(S ? s(e, S).roots : o(e)), D({});
		},
		fitView() {
			Q();
		},
		setDirection(e) {
			$(e);
		},
		// Prota extension: enter the text-edit state for a node so the input
		// is focused immediately after Enter/Tab create it. Y is
		// setPendingEditId from useNodeEdit, which auto-opens the editor.
		startEdit(e) {
			Y(e);
		},
		// Prota extension: set the active node selection (Re is the
		// selectedId setter) so chained Enter/Tab operate on the freshly
		// created node instead of the original one.
		selectNode(e) {
			Re(e);
		}
	}), [
		F,
		I,
		C,
		S,
		Q,
		$,
		N
	]), d(() => {
		if (!k) return;
		let e = () => Z();
		return window.addEventListener("click", e), () => window.removeEventListener("click", e);
	}, [k, Z]);
	let It = u((e) => {
		w(S ? s(e, S).roots : o(e)), D({});
	}, [S]), Lt = u(() => {
		setTimeout(() => Q(), 100);
	}, [Q]), Rt = u(() => {}, []);
	return /* @__PURE__ */ g("div", {
		ref: Fe,
		className: "mindmap-container",
		style: e(N),
		children: [
			Ue === "text" && b && /* @__PURE__ */ h(b, {
				value: A,
				onChange: qe,
				readOnly: v
			}),
			/* @__PURE__ */ h("svg", {
				ref: x,
				className: `mindmap-svg ${lt ? "dragging-canvas" : ""} ${W ? "dragging-node" : ""}`,
				style: Ue === "text" ? { display: "none" } : void 0,
				tabIndex: 0,
				onMouseDown: St,
				onMouseMove: ft,
				onMouseUp: pt,
				onMouseLeave: pt,
				onClick: wt,
				onKeyDown: Ft,
				onContextMenu: Tt,
				children: /* @__PURE__ */ g("g", {
					className: `mindmap-canvas${X ? " mindmap-canvas-ready" : ""}`,
					transform: `translate(${R.x}, ${R.y}) scale(${B})`,
					opacity: X ? 1 : 0,
					children: [
						/* @__PURE__ */ g("g", {
							className: "mindmap-edges",
							children: [I.some((e) => e.isCrossLink) && /* @__PURE__ */ h("defs", { children: /* @__PURE__ */ h("marker", {
								id: "mindmap-arrowhead",
								markerWidth: "8",
								markerHeight: "6",
								refX: "8",
								refY: "3",
								orient: "auto",
								children: /* @__PURE__ */ h("path", {
									d: "M0,0 L8,3 L0,6",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: 1.5
								})
							}) }), I.map((e) => {
								let t = it[e.toId], n = t !== void 0;
								return /* @__PURE__ */ g("g", { children: [/* @__PURE__ */ h("path", {
									d: e.path,
									stroke: e.color,
									strokeWidth: N.connection.strokeWidth,
									strokeLinecap: "round",
									strokeDasharray: n ? void 0 : e.strokeDasharray,
									markerEnd: e.isCrossLink ? "url(#mindmap-arrowhead)" : void 0,
									opacity: e.isCrossLink ? .7 : 1,
									fill: "none",
									"data-branch-index": L[e.toId]?.branchIndex,
									className: [
										"mindmap-edge",
										e.isCrossLink ? "mindmap-edge-cross-link" : "",
										n ? "mindmap-edge-expanding" : lt || K.has(e.fromId) || K.has(e.toId) ? "" : "mindmap-edge-animated"
									].filter(Boolean).join(" "),
									style: n ? { animationDelay: `${t}ms` } : void 0
								}), e.label && (() => {
									let t = L[e.fromId], n = L[e.toId];
									return !t || !n ? null : /* @__PURE__ */ h("text", {
										className: "mindmap-edge-label",
										x: (t.x + n.x) / 2,
										y: (t.y + n.y) / 2 - 6,
										textAnchor: "middle",
										fontSize: 11,
										fill: e.color,
										opacity: .8,
										fontFamily: N.node.fontFamily,
										children: e.label
									});
								})()] }, e.key);
							})]
						}),
						/* @__PURE__ */ h("g", {
							className: "mindmap-nodes",
							children: F.map((e) => {
								let t = K.has(e.id), n = t || lt || e.id === justFinishedEditingId ? "" : "mindmap-node-animated";
								return /* @__PURE__ */ h(he, {
									node: e,
									isEditing: ht === e.id,
									isPendingEdit: J === e.id,
									isSelected: O === e.id,
									isNew: bt.has(e.id),
									isGhost: t,
									animClass: n,
									editText: gt,
									theme: N,
									direction: T,
									onMouseDown: mt,
									onClick: Ct,
									onDoubleClick: v ? () => {} : _t,
									onEditChange: q,
									onEditCommit: vt,
									onEditCancel: yt,
									onAddChild: Dt,
									onRemarkHover: Et,
									onFoldToggle: S ? (e) => {
										Xe[e] || ($e(e), setTimeout(() => $e(null), 800)), Ze((t) => ({
											...t,
											[e]: !t[e]
										}));
									} : void 0,
									expandDelay: it[e.id],
									readonly: v,
									plugins: S,
									latexRenderer: {
										getKatexSync: ve,
										onKatexReady: be,
										renderLatexToHtml: xe,
										loadKatexStyle: ye
									}
								}, e.id);
							})
						}),
						W && G && (() => {
							let e = L[W];
							if (!e) return null;
							let t = G.x - e.x, r = G.y - e.y, i = e.parentId ? L[e.parentId] : null;
							return /* @__PURE__ */ g(we, { children: [i && /* @__PURE__ */ h("path", {
								className: "mindmap-floating-edge",
								d: n(i.x, i.y, i.width, G.x, G.y, e.width, e.side),
								stroke: e.color,
								strokeWidth: N.connection.strokeWidth,
								strokeLinecap: "round",
								fill: "none"
							}), /* @__PURE__ */ g("g", {
								className: "mindmap-floating",
								transform: `translate(${t}, ${r})`,
								children: [I.filter((e) => K.has(e.fromId) && K.has(e.toId)).map((e) => /* @__PURE__ */ h("path", {
									className: "mindmap-floating-edge",
									d: e.path,
									stroke: e.color,
									strokeWidth: N.connection.strokeWidth,
									strokeLinecap: "round",
									fill: "none"
								}, `fl-${e.key}`)), F.filter((e) => K.has(e.id)).map((e) => /* @__PURE__ */ h(he, {
									node: e,
									isEditing: !1,
									isPendingEdit: !1,
									isSelected: !1,
									isNew: !1,
									animClass: "",
									editText: "",
									theme: N,
									direction: T,
									onMouseDown: () => {},
									onClick: () => {},
									onDoubleClick: () => {},
									onEditChange: () => {},
									onEditCommit: () => {},
									onEditCancel: () => {},
									onAddChild: () => {},
									readonly: !0,
									latexRenderer: {
										getKatexSync: ve,
										onKatexReady: be,
										renderLatexToHtml: xe,
										loadKatexStyle: ye
									}
								}, `fl-${e.id}`))]
							})] });
						})(),
						S && t(S, F, I, N).map((e, t) => /* @__PURE__ */ h("g", {
							className: "mindmap-plugin-overlay",
							children: e
						}, `plugin-overlay-${t}`))
					]
				})
			}),
			/* @__PURE__ */ h(ge, {
				zoom: B,
				theme: N,
				messages: P,
				showZoom: rt.zoom && Ue !== "text",
				showModeToggle: !!b,
				mode: Ue,
				isFullscreen: Ge,
				onZoomIn: at,
				onZoomOut: ot,
				onAutoFit: Q,
				onModeToggle: Mt,
				onFullscreenToggle: Nt
			}),
			Ae && /* @__PURE__ */ h(Se, {
				config: Ae,
				theme: N,
				messages: P,
				currentMarkdown: c(C, S),
				onMarkdownStream: It,
				onComplete: Lt,
				onError: Rt
			}),
			k && /* @__PURE__ */ h(_e, {
				position: k,
				theme: N,
				messages: P,
				direction: T,
				readonly: v,
				onNewRootNode: Ot,
				onExportSVG: kt,
				onExportPNG: At,
				onExportMarkdown: jt,
				onDirectionChange: $,
				onClose: Z
			}),
			Je && /* @__PURE__ */ h("div", {
				className: "mindmap-remark-tooltip",
				style: {
					left: Je.x,
					top: Je.y,
					transform: "translateY(-100%)"
				},
				children: Je.text
			})
		]
	});
});
//#endregion
export { _ as MindMap };
