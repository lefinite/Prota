import { jsx as e, jsxs as t } from "react/jsx-runtime";
//#region src/components/MindMap/components/icons.tsx
function n({ size: n = 24, className: r }) {
	return /* @__PURE__ */ t("svg", {
		width: n,
		height: n,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		className: r,
		children: [/* @__PURE__ */ e("line", {
			x1: "12",
			y1: "5",
			x2: "12",
			y2: "19"
		}), /* @__PURE__ */ e("line", {
			x1: "5",
			y1: "12",
			x2: "19",
			y2: "12"
		})]
	});
}
function r({ size: t = 24, className: n }) {
	return /* @__PURE__ */ e("svg", {
		width: t,
		height: t,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		className: n,
		children: /* @__PURE__ */ e("line", {
			x1: "5",
			y1: "12",
			x2: "19",
			y2: "12"
		})
	});
}
function i({ size: n = 24, className: r }) {
	return /* @__PURE__ */ t("svg", {
		width: n,
		height: n,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		className: r,
		children: [/* @__PURE__ */ e("line", {
			x1: "18",
			y1: "6",
			x2: "6",
			y2: "18"
		}), /* @__PURE__ */ e("line", {
			x1: "6",
			y1: "6",
			x2: "18",
			y2: "18"
		})]
	});
}
function a({ size: t = 24, className: n }) {
	return /* @__PURE__ */ e("svg", {
		width: t,
		height: t,
		viewBox: "0 0 24 24",
		fill: "currentColor",
		className: n,
		children: /* @__PURE__ */ e("path", { d: "M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" })
	});
}
function o({ size: t = 24, className: n }) {
	return /* @__PURE__ */ e("svg", {
		width: t,
		height: t,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: n,
		children: /* @__PURE__ */ e("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" })
	});
}
function s({ size: t = 24, className: n }) {
	return /* @__PURE__ */ e("svg", {
		width: t,
		height: t,
		viewBox: "0 0 24 24",
		fill: "currentColor",
		className: n,
		children: /* @__PURE__ */ e("rect", {
			x: "4",
			y: "4",
			width: "16",
			height: "16",
			rx: "2"
		})
	});
}
function c({ size: t = 24, className: n }) {
	return /* @__PURE__ */ e("svg", {
		width: t,
		height: t,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: n,
		children: /* @__PURE__ */ e("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" })
	});
}
//#endregion
export { i as IconClose, a as IconLightning, c as IconLoaderCircle, r as IconMinus, o as IconPaperclip, n as IconPlus, s as IconStop };
