import { computeTokenLayouts as e, parseInlineMarkdown as t } from "../utils/inline-markdown.js";
import { runRenderInlineToken as n, runRenderNodeDecoration as r } from "../plugins/runner.js";
import { useEffect as i, useMemo as a, useState as o } from "react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
//#region src/components/MindMap/components/MindMapNode.tsx
var u = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
// Prota: measure edit-text width so the edit input + node box grow live as the
// user types (XMind-style). Without this the input has a fixed width and long
// text scrolls out to the left. Canvas measureText is cheap and cached.
var _protaMtCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
var _protaMtCtx = _protaMtCanvas ? _protaMtCanvas.getContext("2d") : null;
var _protaMtCache = new Map();
function _protaMeasureText(text, fontSize, fontFamily, fontWeight) {
	if (!_protaMtCtx) return 0;
	var key = (fontWeight || "normal") + "|" + (fontSize || 14) + "|" + (fontFamily || "") + "|" + (text || " ");
	var cached = _protaMtCache.get(key);
	if (cached !== undefined) return cached;
	_protaMtCtx.font = (fontWeight || "normal") + " " + (fontSize || 14) + "px " + (fontFamily || "sans-serif");
	var w = _protaMtCtx.measureText(text || " ").width;
	if (_protaMtCache.size > 3000) _protaMtCache.clear();
	_protaMtCache.set(key, w);
	return w;
}
function d(e, t, r, i) {
	let { token: a } = e;
	if (a.type !== "text" && a.type !== "bold" && a.type !== "italic" && a.type !== "strikethrough" && a.type !== "code" && a.type !== "highlight" && a.type !== "link" && a.type !== "image" && r && r.length > 0) {
		let i = n(r, e, t);
		if (i) return i;
	}
	switch (a.type) {
		case "bold": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-bold",
			fontWeight: 700,
			children: a.content
		}, t);
		case "italic": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-italic",
			fontStyle: "italic",
			children: a.content
		}, t);
		case "strikethrough": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-strikethrough",
			textDecoration: "line-through",
			opacity: .6,
			children: a.content
		}, t);
		case "code": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-code",
			fontFamily: u,
			fontSize: "0.88em",
			children: a.content
		}, t);
		case "highlight": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-highlight",
			fill: i || "#FFEB3B",
			children: a.content
		}, t);
		case "link": return /* @__PURE__ */ c("a", {
			className: "mindmap-text-link",
			href: a.url,
			target: "_blank",
			rel: "noopener noreferrer",
			onClick: (e) => e.stopPropagation(),
			onMouseDown: (e) => e.stopPropagation(),
			children: /* @__PURE__ */ c("tspan", {
				fill: "#2563EB",
				textDecoration: "underline",
				children: a.text
			})
		}, t);
		case "image": return /* @__PURE__ */ l("tspan", {
			className: "mindmap-text-image",
			fontStyle: "italic",
			children: [
				"[",
				a.alt || "image",
				"]"
			]
		}, t);
		case "latex-inline":
		case "latex-block": return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-latex",
			fontFamily: u,
			fontStyle: "italic",
			fontSize: "0.9em",
			children: a.content
		}, t);
		default: return /* @__PURE__ */ c("tspan", {
			className: "mindmap-text-plain",
			children: a.content
		}, t);
	}
}
function f({ status: e, size: t }) {
	return e === "done" ? /* @__PURE__ */ l("g", { children: [/* @__PURE__ */ c("rect", {
		x: 0,
		y: 0,
		width: t,
		height: t,
		rx: t * .2,
		fill: "#22C55E"
	}), /* @__PURE__ */ c("path", {
		d: `M${t * .28} ${t * .5}L${t * .44} ${t * .66}L${t * .72} ${t * .34}`,
		stroke: "white",
		strokeWidth: t * .13,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		fill: "none"
	})] }) : e === "doing" ? /* @__PURE__ */ l("g", { children: [/* @__PURE__ */ c("rect", {
		x: 0,
		y: 0,
		width: t,
		height: t,
		rx: t * .2,
		fill: "none",
		stroke: "#FBBF24",
		strokeWidth: t * .1
	}), /* @__PURE__ */ c("rect", {
		x: t * .25,
		y: t * .25,
		width: t * .5,
		height: t * .5,
		rx: t * .1,
		fill: "#FBBF24",
		opacity: .6
	})] }) : /* @__PURE__ */ c("rect", {
		x: 0,
		y: 0,
		width: t,
		height: t,
		rx: t * .2,
		fill: "none",
		stroke: "#999",
		strokeWidth: t * .1,
		opacity: .4
	});
}
function p({ node: n, fontSize: r, fontWeight: s, fontFamily: u, textColor: p, onRemarkHover: m, plugins: h, highlightTextColor: g, highlightBgColor: _, latexRenderer: v }) {
	let [y, b] = o(() => !!v?.getKatexSync());
	i(() => {
		!y && v && v.onKatexReady(() => b(!0));
	}, [y, v]);
	let { layouts: x, textContentWidth: S, taskIconWidth: C, totalWidth: w } = a(() => {
		let i = e(t(n.text, h), r, s, u), a = i.length > 0 ? i[i.length - 1].x + i[i.length - 1].width : 0, o = r * .85, c = n.taskStatus ? 4 : 0, l = n.taskStatus ? o + c : 0, d = r * .7, f = n.remark ? 4 : 0, p = n.remark ? d + f : 0;
		return {
			layouts: i,
			textContentWidth: a,
			taskIconWidth: l,
			totalWidth: l + a + p
		};
	}, [
		n.text,
		n.taskStatus,
		n.remark,
		r,
		s,
		u,
		h
	]), T = -w / 2, E = T + C, D = r * .85, O = -r / 2 - 2, k = r + 4, A = r * .7, j = n.multiLineContent, M = r * 1.4, N = r / 2 + 8;
	return /* @__PURE__ */ l("g", {
		className: "mindmap-node-content",
		children: [
			n.taskStatus && /* @__PURE__ */ c("g", {
				className: `mindmap-task-icon mindmap-task-${n.taskStatus}`,
				transform: `translate(${T}, ${-D / 2})`,
				children: /* @__PURE__ */ c(f, {
					status: n.taskStatus,
					size: D
				})
			}),
			x.map((e, t) => e.token.type === "code" ? /* @__PURE__ */ c("rect", {
				className: "mindmap-code-bg",
				x: E + e.x - 2,
				y: O,
				width: e.width + 4,
				height: k,
				rx: 3,
				fill: "rgba(128,128,128,0.12)"
			}, `bg-${t}`) : e.token.type === "highlight" ? /* @__PURE__ */ c("rect", {
				className: "mindmap-highlight-bg",
				x: E + e.x - 1,
				y: O,
				width: e.width + 2,
				height: k,
				rx: 2,
				fill: _ || "rgba(255,213,79,0.3)"
			}, `bg-${t}`) : null),
			/* @__PURE__ */ c("text", {
				className: "mindmap-node-text",
				textAnchor: "start",
				dominantBaseline: "central",
				x: E,
				fill: p,
				fontSize: r,
				fontWeight: s,
				fontFamily: u,
				children: x.map((e, t) => d(e, t, h, g))
			}),
			y && v && x.map((e, t) => {
				let { token: n } = e;
				if (n.type !== "latex-inline" && n.type !== "latex-block") return null;
				let i = v.renderLatexToHtml(n.content, n.type === "latex-block");
				if (!i) return null;
				v.loadKatexStyle();
				let a = E + e.x + e.width / 2, o = Math.max(e.width * 2.5, 120), s = r * 2;
				return /* @__PURE__ */ c("foreignObject", {
					className: "mindmap-latex",
					x: a - o / 2,
					y: -s / 2,
					width: o,
					height: s,
					children: /* @__PURE__ */ c("div", {
						className: "mindmap-latex-content",
						style: {
							fontSize: r * .75,
							lineHeight: `${s}px`,
							color: p
						},
						dangerouslySetInnerHTML: { __html: i }
					})
				}, `latex-fo-${t}`);
			}),
			j && j.length > 0 && j.map((n, i) => {
				let a = r * .85, o = e(t(n, h), a, 400, u), s = -(o.length > 0 ? o[o.length - 1].x + o[o.length - 1].width : 0) / 2, f = N + i * M, m = f - a / 2 - 2, b = a + 4;
				return /* @__PURE__ */ l("g", {
					className: "mindmap-multiline",
					children: [
						o.map((e, t) => e.token.type === "code" ? /* @__PURE__ */ c("rect", {
							className: "mindmap-code-bg",
							x: s + e.x - 2,
							y: m,
							width: e.width + 4,
							height: b,
							rx: 3,
							fill: "rgba(128,128,128,0.12)"
						}, `ml-bg-${t}`) : e.token.type === "highlight" ? /* @__PURE__ */ c("rect", {
							className: "mindmap-highlight-bg",
							x: s + e.x - 1,
							y: m,
							width: e.width + 2,
							height: b,
							rx: 2,
							fill: _ || "rgba(255,213,79,0.3)"
						}, `ml-bg-${t}`) : null),
						/* @__PURE__ */ c("text", {
							className: "mindmap-multiline-text",
							x: s,
							y: f,
							textAnchor: "start",
							dominantBaseline: "central",
							fill: p,
							fontSize: a,
							fontWeight: 400,
							fontFamily: u,
							opacity: .8,
							children: o.map((e, t) => d(e, t, h, g))
						}),
						y && v && o.map((e, t) => {
							let { token: n } = e;
							if (n.type !== "latex-inline" && n.type !== "latex-block") return null;
							let r = v.renderLatexToHtml(n.content, n.type === "latex-block");
							if (!r) return null;
							v.loadKatexStyle();
							let o = s + e.x + e.width / 2, l = Math.max(e.width * 2.5, 120), u = a * 2;
							return /* @__PURE__ */ c("foreignObject", {
								className: "mindmap-latex",
								x: o - l / 2,
								y: f - u / 2,
								width: l,
								height: u,
								children: /* @__PURE__ */ c("div", {
									className: "mindmap-latex-content",
									style: {
										fontSize: a * .75,
										lineHeight: `${u}px`,
										color: p,
										opacity: .8
									},
									dangerouslySetInnerHTML: { __html: r }
								})
							}, `ml-latex-fo-${i}-${t}`);
						})
					]
				}, `ml-${i}`);
			}),
			n.tags && n.tags.length > 0 && (() => {
				let e = r * .65, t = r / 2 + 6 + (j ? j.length * M : 0), i = -w / 2;
				return n.tags.map((n, r) => {
					let a = n.length * e * .65 + 10, o = i;
					i += a + 4;
					let s = [
						"#3B82F6",
						"#8B5CF6",
						"#EC4899",
						"#F59E0B",
						"#10B981",
						"#6366F1"
					], d = s[r % s.length];
					return /* @__PURE__ */ l("g", {
						className: "mindmap-tag",
						children: [/* @__PURE__ */ c("rect", {
							className: "mindmap-tag-bg",
							x: o,
							y: t,
							width: a,
							height: e + 6,
							rx: 3,
							fill: d,
							opacity: .15
						}), /* @__PURE__ */ c("text", {
							className: "mindmap-tag-text",
							x: o + a / 2,
							y: t + (e + 6) / 2,
							textAnchor: "middle",
							dominantBaseline: "central",
							fontSize: e,
							fill: d,
							fontFamily: u,
							children: n
						})]
					}, `tag-${r}`);
				});
			})(),
			n.remark && /* @__PURE__ */ l("text", {
				className: "mindmap-remark-indicator",
				x: E + S + 4,
				textAnchor: "start",
				dominantBaseline: "central",
				fontSize: A,
				opacity: .5,
				onMouseEnter: () => m?.(n.id),
				onMouseLeave: () => m?.(null),
				children: [/* @__PURE__ */ c("title", { children: n.remark }), "💬"]
			})
		]
	});
}
function m({ node: e, offset: t, isEditing: n, isPendingEdit: i, isSelected: a, isNew: o, isGhost: u, animClass: d, editText: f, theme: m, direction: h, readonly: g, plugins: _, onMouseDown: v, onClick: y, onDoubleClick: b, onEditChange: x, onEditCommit: S, onEditCancel: C, onAddChild: w, onRemarkHover: T, onFoldToggle: E, expandDelay: D, latexRenderer: O }) {
	let k = e.x + (t?.x ?? 0), A = e.y + (t?.y ?? 0), j = n || i, M = i && !n ? "" : f, N = o ? "mindmap-node-new" : "", P = e.placeholder ? "mindmap-node-placeholder" : "", F = D === void 0 ? "" : "mindmap-node-expanding", I = D === void 0 ? void 0 : { animationDelay: `${D}ms` }, L = (e.taskStatus === "done" ? "[x] " : e.taskStatus === "doing" ? "[-] " : e.taskStatus === "todo" ? "[ ] " : "") + e.text, R = _ && _.length > 0 ? r(_, e, m) : null;
	if (e.depth === 0) {
		let t = m.root.bgColor;
		let _rPad = m.root.paddingH != null ? m.root.paddingH : 14;
		let _rEW = j ? Math.max(e.width, Math.ceil(_protaMeasureText(M, m.root.fontSize, m.root.fontFamily, m.root.fontWeight)) + _rPad * 2 + 8, 90) : e.width;
		return /* @__PURE__ */ l("g", {
			transform: `translate(${k}, ${A})`,
			className: `mindmap-node-g mindmap-node-root ${d} ${N} ${P} ${F}${u ? " mindmap-node-ghost" : ""}`,
			"data-branch-index": e.branchIndex,
			onMouseDown: (t) => v(t, e.id),
			onClick: (t) => y(t, e.id),
			onDoubleClick: (t) => b(t, e.id, L),
			style: I,
			children: [
				/* @__PURE__ */ c("rect", {
					className: "mindmap-node-bg",
					x: -e.width / 2,
					y: -e.height / 2,
					width: _rEW,
					height: e.height,
					rx: e.height / 2,
					ry: e.height / 2,
					fill: t,
					stroke: a ? m.selection.strokeColor : "none",
					strokeWidth: a ? 2.5 : 0
				}),
				j ? /* @__PURE__ */ c("foreignObject", {
					x: -e.width / 2,
					y: -e.height / 2,
					width: _rEW,
					height: e.height,
					children: /* @__PURE__ */ c("input", {
						className: "mindmap-edit-input mindmap-edit-root",
						value: M,
						onChange: (e) => x(e.target.value),
						onKeyDown: (e) => {
							e.key === "Enter" && S();
						},
						onBlur: S,
						autoFocus: !0,
						style: {
							fontSize: m.root.fontSize,
							fontWeight: m.root.fontWeight,
							fontFamily: m.root.fontFamily,
							textAlign: "left",
							paddingLeft: _rPad + "px",
							paddingRight: _rPad + "px"
						}
					})
				}) : /* @__PURE__ */ c(p, {
					node: e,
					fontSize: m.root.fontSize,
					fontWeight: m.root.fontWeight,
					fontFamily: m.root.fontFamily,
					textColor: m.root.textColor,
					onRemarkHover: T,
					plugins: _,
					highlightTextColor: m.highlight.textColor,
					highlightBgColor: m.highlight.bgColor,
					latexRenderer: O
				}),
				R,
				!g && !u && (h === "right" || h === "both") && /* @__PURE__ */ l("g", {
					className: "mindmap-add-btn",
					onMouseDown: (e) => e.stopPropagation(),
					onClick: (t) => w(t, e.id, "right"),
					children: [
						/* @__PURE__ */ c("circle", {
							cx: e.width / 2 + 18,
							cy: 0,
							r: 11,
							fill: m.addBtn.fill
						}),
						/* @__PURE__ */ c("line", {
							x1: e.width / 2 + 14,
							y1: 0,
							x2: e.width / 2 + 22,
							y2: 0,
							stroke: m.addBtn.iconColor,
							strokeWidth: 2,
							strokeLinecap: "round"
						}),
						/* @__PURE__ */ c("line", {
							x1: e.width / 2 + 18,
							y1: -4,
							x2: e.width / 2 + 18,
							y2: 4,
							stroke: m.addBtn.iconColor,
							strokeWidth: 2,
							strokeLinecap: "round"
						})
					]
				}),
				!g && !u && (h === "left" || h === "both") && /* @__PURE__ */ l("g", {
					className: "mindmap-add-btn",
					onMouseDown: (e) => e.stopPropagation(),
					onClick: (t) => w(t, e.id, "left"),
					children: [
						/* @__PURE__ */ c("circle", {
							cx: -(e.width / 2 + 18),
							cy: 0,
							r: 11,
							fill: m.addBtn.fill
						}),
						/* @__PURE__ */ c("line", {
							x1: -(e.width / 2 + 22),
							y1: 0,
							x2: -(e.width / 2 + 14),
							y2: 0,
							stroke: m.addBtn.iconColor,
							strokeWidth: 2,
							strokeLinecap: "round"
						}),
						/* @__PURE__ */ c("line", {
							x1: -(e.width / 2 + 18),
							y1: -4,
							x2: -(e.width / 2 + 18),
							y2: 4,
							stroke: m.addBtn.iconColor,
							strokeWidth: 2,
							strokeLinecap: "round"
						})
					]
				}),
				e.collapsed !== void 0 && g && E && /* @__PURE__ */ c("g", {
					className: "mindmap-fold-btn",
					onMouseDown: (e) => e.stopPropagation(),
					onClick: (t) => {
						t.stopPropagation(), E(e.id);
					},
					children: /* @__PURE__ */ c("circle", {
						cx: e.width / 2 + 14,
						cy: 0,
						r: 6,
						fill: e.color
					})
				})
			]
		}, e.id);
	}
	let z = e.depth === 1 ? m.level1.fontSize : m.node.fontSize, B = e.depth === 1 ? m.level1.fontWeight : m.node.fontWeight, V = e.width - m.node.paddingH * 2, H = z / 2 + 4, U = e.side === "left" ? -e.width / 2 - 18 : e.width / 2 + 18;
	let _cPad = m.node.paddingH != null ? m.node.paddingH : 10;
	let _cEW = j ? Math.max(e.width, Math.ceil(_protaMeasureText(M, z, m.node.fontFamily, B)) + _cPad * 2 + 8, 80) : e.width;
	// Grow directionally so the text start stays put while typing: right-side nodes keep their left edge and grow rightward (away from the
	// parent); left-side nodes keep their right edge and grow leftward. This avoids the box sliding left as the user types.
	let _cLeft = e.side !== "left";
	let _cX = j ? (_cLeft ? -e.width / 2 : e.width / 2 - _cEW) : -e.width / 2;
	return /* @__PURE__ */ l("g", {
		transform: `translate(${k}, ${A})`,
		className: `mindmap-node-g mindmap-node-child ${d} ${N} ${P}${u ? " mindmap-node-ghost" : ""}`,
		"data-branch-index": e.branchIndex,
		onMouseDown: (t) => v(t, e.id),
		onClick: (t) => y(t, e.id),
		onDoubleClick: (t) => b(t, e.id, L),
		children: [
			/* @__PURE__ */ c("rect", {
				className: "mindmap-node-bg",
				x: _cX,
				y: -e.height / 2,
				width: _cEW,
				height: e.height,
				fill: a ? m.selection.fillColor : "transparent",
				stroke: a ? m.selection.strokeColor : "none",
				strokeWidth: a ? 1.5 : 0,
				rx: 4
			}),
			j ? /* @__PURE__ */ c("foreignObject", {
				x: _cX,
				y: -e.height / 2,
				width: _cEW,
				height: e.height,
				children: /* @__PURE__ */ c("input", {
					className: "mindmap-edit-input mindmap-edit-child",
					value: M,
					onChange: (e) => x(e.target.value),
					onKeyDown: (e) => {
						e.key === "Enter" && S(), e.key === "Escape" && C();
					},
					onBlur: S,
					autoFocus: !0,
					style: {
						fontSize: z,
						fontWeight: B,
						fontFamily: m.node.fontFamily,
						color: m.node.textColor,
						textAlign: _cLeft ? "left" : "right",
						paddingLeft: _cPad + "px",
						paddingRight: _cPad + "px",
						borderBottom: `2.5px solid ${e.color}`
					}
				})
			}) : /* @__PURE__ */ l(s, { children: [/* @__PURE__ */ c(p, {
				node: e,
				fontSize: z,
				fontWeight: B,
				fontFamily: m.node.fontFamily,
				textColor: m.node.textColor,
				onRemarkHover: T,
				plugins: _,
				highlightTextColor: m.highlight.textColor,
				highlightBgColor: m.highlight.bgColor,
				latexRenderer: O
			}), /* @__PURE__ */ c("line", {
				className: "mindmap-node-underline",
				x1: -V / 2,
				y1: H,
				x2: V / 2,
				y2: H,
				stroke: e.color,
				strokeWidth: 2.5,
				strokeLinecap: "round"
			})] }),
			R,
			!g && !u && /* @__PURE__ */ l("g", {
				className: "mindmap-add-btn",
				onMouseDown: (e) => e.stopPropagation(),
				onClick: (t) => w(t, e.id),
				children: [
					/* @__PURE__ */ c("circle", {
						cx: U,
						cy: 0,
						r: 11,
						fill: m.addBtn.fill
					}),
					/* @__PURE__ */ c("line", {
						x1: U - 4,
						y1: 0,
						x2: U + 4,
						y2: 0,
						stroke: m.addBtn.iconColor,
						strokeWidth: 2,
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ c("line", {
						x1: U,
						y1: -4,
						x2: U,
						y2: 4,
						stroke: m.addBtn.iconColor,
						strokeWidth: 2,
						strokeLinecap: "round"
					})
				]
			}),
			e.collapsed !== void 0 && g && E && /* @__PURE__ */ c("g", {
				className: "mindmap-fold-btn",
				onMouseDown: (e) => e.stopPropagation(),
				onClick: (t) => {
					t.stopPropagation(), E(e.id);
				},
				children: /* @__PURE__ */ c("circle", {
					cx: U,
					cy: 0,
					r: 6,
					fill: e.color
				})
			})
		]
	}, e.id);
}
//#endregion
export { m as MindMapNode };
