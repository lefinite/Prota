import { useState as e } from "react";
import { Fragment as t, jsx as n, jsxs as r } from "react/jsx-runtime";
//#region src/components/MindMap/components/MindMapContextMenu.tsx
function i({ position: i, messages: a, readonly: o, onNewRootNode: s, onExportSVG: c, onExportPNG: l, onExportMarkdown: u, onDirectionChange: d, onClose: f }) {
	let [p, m] = e(!1), [h, g] = e(!1);
	return /* @__PURE__ */ r("div", {
		className: "mindmap-context-menu",
		style: {
			left: i.x,
			top: i.y
		},
		onClick: (e) => e.stopPropagation(),
		children: [
			!o && /* @__PURE__ */ r(t, { children: [/* @__PURE__ */ n("div", {
				className: "mindmap-ctx-item mindmap-ctx-new-root",
				onClick: s,
				children: a.newRootNode
			}), /* @__PURE__ */ n("div", { className: "mindmap-ctx-divider" })] }),
			/* @__PURE__ */ r("div", {
				className: "mindmap-ctx-item mindmap-ctx-has-sub mindmap-ctx-layout",
				onMouseEnter: () => g(!0),
				onMouseLeave: () => g(!1),
				children: [
					a.layout,
					/* @__PURE__ */ n("span", {
						className: "mindmap-ctx-arrow",
						children: "▶"
					}),
					h && /* @__PURE__ */ r("div", {
						className: "mindmap-ctx-submenu",
						children: [
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-layout-left",
								onClick: () => {
									d("left"), f();
								},
								children: a.layoutLeft
							}),
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-layout-both",
								onClick: () => {
									d("both"), f();
								},
								children: a.layoutBoth
							}),
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-layout-right",
								onClick: () => {
									d("right"), f();
								},
								children: a.layoutRight
							})
						]
					})
				]
			}),
			/* @__PURE__ */ n("div", { className: "mindmap-ctx-divider" }),
			/* @__PURE__ */ r("div", {
				className: "mindmap-ctx-item mindmap-ctx-has-sub mindmap-ctx-export",
				onMouseEnter: () => m(!0),
				onMouseLeave: () => m(!1),
				children: [
					a.export,
					/* @__PURE__ */ n("span", {
						className: "mindmap-ctx-arrow",
						children: "▶"
					}),
					p && /* @__PURE__ */ r("div", {
						className: "mindmap-ctx-submenu",
						children: [
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-export-svg",
								onClick: c,
								children: a.exportSVG
							}),
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-export-png",
								onClick: l,
								children: a.exportPNG
							}),
							/* @__PURE__ */ n("div", {
								className: "mindmap-ctx-item mindmap-ctx-export-md",
								onClick: u,
								children: a.exportMarkdown
							})
						]
					})
				]
			})
		]
	});
}
//#endregion
export { i as MindMapContextMenu };
