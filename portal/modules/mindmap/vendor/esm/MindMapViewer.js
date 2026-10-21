import { generateCSSVariables as e } from "./utils/theme.js";
import { runRenderOverlay as t } from "./plugins/runner.js";
import { layoutMultiRoot as n } from "./utils/layout.js";
import { parseMarkdownMultiRoot as r, parseMarkdownWithFrontMatter as i } from "./utils/markdown.js";
import { detectLocale as a, resolveMessages as ee } from "./utils/i18n.js";
import { normalizeData as te } from "./utils/tree-ops.js";
import { useTheme as ne } from "./hooks/useTheme.js";
import { usePanZoom as re } from "./hooks/usePanZoom.js";
import { useNewNodeAnimation as ie } from "./hooks/useNewNodeAnimation.js";
import { MindMapNode as ae } from "./components/MindMapNode.js";
/* empty css        */
import { useCanvasPan as oe } from "./hooks/useCanvasPan.js";
import { forwardRef as o, useCallback as s, useEffect as c, useImperativeHandle as se, useMemo as l, useRef as u, useState as d } from "react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
//#region src/components/MindMap/MindMapViewer.tsx
var m = () => {}, h = o(function({ data: o, markdown: h, defaultDirection: ce = "both", theme: le = "auto", locale: g, messages: _, toolbar: v = !0, plugins: y, onEvent: ue }, de) {
	let fe = u(null), b = u(null), x = y && y.length > 0 ? y : void 0, S = l(() => {
		if (o || h === void 0) return null;
		if (x) {
			let e = i(h, x), t = e.frontMatter.direction, n = e.frontMatter.theme;
			return {
				roots: e.roots,
				direction: t === "left" || t === "right" || t === "both" ? t : void 0,
				theme: n === "light" || n === "dark" || n === "auto" ? n : void 0
			};
		}
		return {
			roots: r(h),
			direction: void 0,
			theme: void 0
		};
	}, []), [C, w] = d(() => o ? te(o) : S ? S.roots : [{
		id: "md-0",
		text: "Root"
	}]), [T, E] = d(() => S?.direction ?? ce), [D, pe] = d({}), [O, me] = d({}), [k, A] = d(null), [j, M] = d(null), [he, ge] = d(() => S?.theme);
	c(() => {
		o && w(te(o));
	}, [o]), c(() => {
		if (h !== void 0) if (x) {
			let { roots: e, frontMatter: t } = i(h, x);
			if (w(e), t.direction) {
				let e = t.direction;
				(e === "left" || e === "right" || e === "both") && E(e);
			}
			if (t.theme) {
				let e = t.theme;
				(e === "light" || e === "dark" || e === "auto") && ge(e);
			}
		} else w(r(h));
	}, [h, x]);
	let N = u(ue);
	N.current = ue;
	let P = s((e) => {
		N.current?.(e);
	}, []), F = ne(he ?? le), I = l(() => ee(g ?? a(), _), [g, _]), _e = l(() => v === !1 ? { zoom: !1 } : v === !0 || v === void 0 ? { zoom: !0 } : { zoom: v.zoom ?? !0 }, [v]), { nodes: L, edges: R } = l(() => n(C, T, D, {}, x, !0, O), [
		C,
		T,
		D,
		x,
		O
	]);
	c(() => {
		let e = {}, t = !1;
		for (let n of L) n.depth === 1 && !D[n.id] && (e[n.id] = n.color, t = !0);
		t && pe((t) => ({
			...t,
			...e
		}));
	}, [L, D]);
	let z = l(() => {
		let e = {};
		for (let t of L) e[t.id] = t;
		return e;
	}, [L]), B = l(() => {
		if (!k) return {};
		let e = {}, t = [];
		for (let e of L) e.parentId === k && t.push({
			id: e.id,
			depth: 1
		});
		for (; t.length > 0;) {
			let { id: n, depth: r } = t.shift();
			e[n] = r * 100;
			for (let e of L) e.parentId === n && t.push({
				id: e.id,
				depth: r + 1
			});
		}
		return e;
	}, [k, L]), { pan: V, setPan: H, zoom: U, setZoom: W, animateTo: G, autoFit: K, zoomIn: q, zoomOut: J } = re(b, L), { draggingCanvas: Y, didDragRef: ve, handleCanvasMouseDown: ye, handleMouseMove: be, handleMouseUp: xe } = oe({
		svgRef: b,
		pan: V,
		setPan: H
	}), Se = ie(L), [X, Ce] = d(!1);
	c(() => {
		let e = K();
		e ? X ? (W(e.zoom), H({
			x: e.panX,
			y: e.panY
		})) : (W(e.zoom * .92), H({
			x: e.panX,
			y: e.panY
		}), requestAnimationFrame(() => {
			Ce(!0), G(e.zoom, e.panX, e.panY);
		})) : X || requestAnimationFrame(() => Ce(!0));
	}, [
		L,
		K,
		W,
		H,
		X,
		G
	]);
	let we = s((e) => {
		if (!e) {
			M(null);
			return;
		}
		let t = z[e];
		if (!t || !t.remark) {
			M(null);
			return;
		}
		let n = b.current;
		if (!n) return;
		let r = n.getBoundingClientRect(), i = (t.x + t.width / 2) * U + V.x, a = (t.y - t.height / 2) * U + V.y;
		M({
			nodeId: e,
			text: t.remark,
			x: Math.min(i, r.width - 300),
			y: a - 8
		});
	}, [
		z,
		U,
		V
	]), Z = s(() => {
		let e = K();
		e && G(e.zoom, e.panX, e.panY);
	}, [K, G]), Q = s((e) => {
		E(e), P({
			type: "directionChange",
			direction: e
		});
	}, [P]), Te = s(() => {
		ve.current || P({
			type: "nodeSelect",
			nodeId: null
		});
	}, [ve, P]), $ = u(U);
	c(() => {
		U !== $.current && ($.current = U, P({
			type: "zoomChange",
			zoom: U
		}));
	}, [U, P]);
	let Ee = s((e) => {
		!e.shiftKey || e.metaKey || e.ctrlKey || (e.code === "Equal" ? (e.preventDefault(), q()) : e.code === "Minus" ? (e.preventDefault(), J()) : e.code === "Digit0" ? (e.preventDefault(), Z()) : e.code === "KeyL" ? (e.preventDefault(), Q("left")) : e.code === "KeyR" ? (e.preventDefault(), Q("right")) : e.code === "KeyM" && (e.preventDefault(), Q("both")));
	}, [
		q,
		J,
		Z,
		Q
	]);
	return se(de, () => ({
		getData() {
			return C;
		},
		fitView() {
			Z();
		},
		setDirection(e) {
			Q(e);
		}
	}), [
		C,
		Z,
		Q
	]), /* @__PURE__ */ p("div", {
		ref: fe,
		className: "mindmap-container",
		style: e(F),
		children: [
			/* @__PURE__ */ f("svg", {
				ref: b,
				className: `mindmap-svg ${Y ? "dragging-canvas" : ""}`,
				tabIndex: 0,
				onMouseDown: ye,
				onMouseMove: be,
				onMouseUp: xe,
				onMouseLeave: xe,
				onClick: Te,
				onKeyDown: Ee,
				children: /* @__PURE__ */ p("g", {
					className: `mindmap-canvas${X ? " mindmap-canvas-ready" : ""}`,
					transform: `translate(${V.x}, ${V.y}) scale(${U})`,
					opacity: X ? 1 : 0,
					children: [
						/* @__PURE__ */ p("g", {
							className: "mindmap-edges",
							children: [R.some((e) => e.isCrossLink) && /* @__PURE__ */ f("defs", { children: /* @__PURE__ */ f("marker", {
								id: "mindmap-arrowhead",
								markerWidth: "8",
								markerHeight: "6",
								refX: "8",
								refY: "3",
								orient: "auto",
								children: /* @__PURE__ */ f("path", {
									d: "M0,0 L8,3 L0,6",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: 1.5
								})
							}) }), R.map((e) => {
								let t = B[e.toId], n = t !== void 0;
								return /* @__PURE__ */ p("g", { children: [/* @__PURE__ */ f("path", {
									d: e.path,
									stroke: e.color,
									strokeWidth: F.connection.strokeWidth,
									strokeLinecap: "round",
									strokeDasharray: n ? void 0 : e.strokeDasharray,
									markerEnd: e.isCrossLink ? "url(#mindmap-arrowhead)" : void 0,
									opacity: e.isCrossLink ? .7 : 1,
									fill: "none",
									"data-branch-index": z[e.toId]?.branchIndex,
									className: [
										"mindmap-edge",
										e.isCrossLink ? "mindmap-edge-cross-link" : "",
										n ? "mindmap-edge-expanding" : Y ? "" : "mindmap-edge-animated"
									].filter(Boolean).join(" "),
									style: n ? { animationDelay: `${t}ms` } : void 0
								}), e.label && (() => {
									let t = z[e.fromId], n = z[e.toId];
									return !t || !n ? null : /* @__PURE__ */ f("text", {
										className: "mindmap-edge-label",
										x: (t.x + n.x) / 2,
										y: (t.y + n.y) / 2 - 6,
										textAnchor: "middle",
										fontSize: 11,
										fill: e.color,
										opacity: .8,
										fontFamily: F.node.fontFamily,
										children: e.label
									});
								})()] }, e.key);
							})]
						}),
						/* @__PURE__ */ f("g", {
							className: "mindmap-nodes",
							children: L.map((e) => {
								let t = Y ? "" : "mindmap-node-animated";
								return /* @__PURE__ */ f(ae, {
									node: e,
									isEditing: !1,
									isPendingEdit: !1,
									isSelected: !1,
									isNew: Se.has(e.id),
									animClass: t,
									editText: "",
									theme: F,
									direction: T,
									onMouseDown: m,
									onClick: m,
									onDoubleClick: m,
									onEditChange: m,
									onEditCommit: m,
									onEditCancel: m,
									onAddChild: m,
									onRemarkHover: we,
									onFoldToggle: x ? (e) => {
										O[e] || (A(e), setTimeout(() => A(null), 800)), me((t) => ({
											...t,
											[e]: !t[e]
										}));
									} : void 0,
									expandDelay: B[e.id],
									readonly: !0,
									plugins: x
								}, e.id);
							})
						}),
						x && t(x, L, R, F).map((e, t) => /* @__PURE__ */ f("g", {
							className: "mindmap-plugin-overlay",
							children: e
						}, `plugin-overlay-${t}`))
					]
				})
			}),
			_e.zoom && /* @__PURE__ */ p("div", {
				className: "mindmap-controls",
				children: [
					/* @__PURE__ */ f("button", {
						className: "mindmap-control-btn",
						onClick: q,
						title: I.zoomIn,
						children: /* @__PURE__ */ p("svg", {
							width: "18",
							height: "18",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							children: [/* @__PURE__ */ f("line", {
								x1: "12",
								y1: "5",
								x2: "12",
								y2: "19"
							}), /* @__PURE__ */ f("line", {
								x1: "5",
								y1: "12",
								x2: "19",
								y2: "12"
							})]
						})
					}),
					/* @__PURE__ */ p("span", {
						className: "mindmap-zoom-label",
						children: [Math.round(U * 100), "%"]
					}),
					/* @__PURE__ */ f("button", {
						className: "mindmap-control-btn",
						onClick: J,
						title: I.zoomOut,
						children: /* @__PURE__ */ f("svg", {
							width: "18",
							height: "18",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							children: /* @__PURE__ */ f("line", {
								x1: "5",
								y1: "12",
								x2: "19",
								y2: "12"
							})
						})
					}),
					/* @__PURE__ */ f("button", {
						className: "mindmap-control-btn",
						onClick: Z,
						title: I.resetView,
						children: /* @__PURE__ */ f("svg", {
							width: "18",
							height: "18",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							children: /* @__PURE__ */ f("path", { d: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" })
						})
					})
				]
			}),
			j && /* @__PURE__ */ f("div", {
				className: "mindmap-remark-tooltip",
				style: {
					left: j.x,
					top: j.y,
					transform: "translateY(-100%)"
				},
				children: j.text
			})
		]
	});
});
//#endregion
export { h as MindMapViewer };
