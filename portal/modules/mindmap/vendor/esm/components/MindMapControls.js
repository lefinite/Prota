import { IconMinus as e, IconPlus as t } from "./icons.js";
import { Fragment as n, jsx as r, jsxs as i } from "react/jsx-runtime";
//#region src/components/MindMap/components/MindMapControls.tsx
function a({ zoom: a, messages: o, showZoom: s = !0, showModeToggle: c = !0, mode: l, isFullscreen: u, onZoomIn: d, onZoomOut: f, onAutoFit: p, onModeToggle: m, onFullscreenToggle: h }) {
	return /* @__PURE__ */ i(n, { children: [s && /* @__PURE__ */ i("div", {
		className: "mindmap-zoom-controls",
		children: [
			/* @__PURE__ */ r("button", {
				className: "mindmap-ctrl-btn mindmap-ctrl-zoom-out",
				onClick: f,
				title: o.zoomOut,
				children: /* @__PURE__ */ r(e, { size: 16 })
			}),
			/* @__PURE__ */ i("button", {
				className: "mindmap-ctrl-pct",
				onClick: p,
				title: o.resetView,
				children: [Math.round(a * 100), "%"]
			}),
			/* @__PURE__ */ r("button", {
				className: "mindmap-ctrl-btn mindmap-ctrl-zoom-in",
				onClick: d,
				title: o.zoomIn,
				children: /* @__PURE__ */ r(t, { size: 16 })
			})
		]
	}), /* @__PURE__ */ i("div", {
		className: "mindmap-extra-controls",
		children: [c && /* @__PURE__ */ r("button", {
			className: "mindmap-ctrl-btn mindmap-ctrl-mode",
			onClick: m,
			title: l === "view" ? o.textMode : o.viewMode,
			children: l === "view" ? /* @__PURE__ */ i("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					/* @__PURE__ */ r("path", { d: "M6 5h12" }),
					/* @__PURE__ */ r("path", { d: "M4 12h10" }),
					/* @__PURE__ */ r("path", { d: "M12 19h8" })
				]
			}) : /* @__PURE__ */ i("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [/* @__PURE__ */ r("path", { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }), /* @__PURE__ */ r("circle", {
					cx: "12",
					cy: "12",
					r: "3"
				})]
			})
		}), /* @__PURE__ */ r("button", {
			className: "mindmap-ctrl-btn mindmap-ctrl-fullscreen",
			onClick: h,
			title: u ? o.exitFullscreen : o.fullscreen,
			children: u ? /* @__PURE__ */ i("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					/* @__PURE__ */ r("path", { d: "M8 3v3a2 2 0 0 1-2 2H3" }),
					/* @__PURE__ */ r("path", { d: "M21 8h-3a2 2 0 0 1-2-2V3" }),
					/* @__PURE__ */ r("path", { d: "M3 16h3a2 2 0 0 1 2 2v3" }),
					/* @__PURE__ */ r("path", { d: "M16 21v-3a2 2 0 0 1 2-2h3" })
				]
			}) : /* @__PURE__ */ i("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					/* @__PURE__ */ r("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }),
					/* @__PURE__ */ r("path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }),
					/* @__PURE__ */ r("path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }),
					/* @__PURE__ */ r("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" })
				]
			})
		})]
	})] });
}
//#endregion
export { a as MindMapControls };
