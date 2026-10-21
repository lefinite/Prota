//#region src/components/MindMap/utils/theme.ts
var e = [
	"#FF6B6B",
	"#4ECDC4",
	"#45B7D1",
	"#96CEB4",
	"#FFEAA7",
	"#DDA0DD",
	"#98D8C8",
	"#F7DC6F",
	"#BB8FCE",
	"#F0B27A"
], t = {
	root: {
		fontSize: 20,
		fontWeight: 600,
		fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
		paddingH: 24,
		paddingV: 12
	},
	node: {
		fontSize: 15,
		fontWeight: 400,
		fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
		paddingH: 8,
		paddingV: 6
	},
	level1: {
		fontSize: 16,
		fontWeight: 500
	},
	connection: { strokeWidth: 2.5 },
	layout: {
		horizontalGap: 80,
		verticalGap: 16
	}
}, n = {
	...t,
	root: {
		...t.root,
		bgColor: "#2C3E50",
		textColor: "#FFFFFF"
	},
	node: {
		...t.node,
		textColor: "#333333"
	},
	canvas: { bgColor: "#fafafa" },
	controls: {
		bgColor: "rgba(255, 255, 255, 0.9)",
		textColor: "#555",
		hoverBg: "rgba(0, 0, 0, 0.08)",
		activeBg: "rgba(0, 0, 0, 0.08)"
	},
	contextMenu: {
		bgColor: "rgba(255, 255, 255, 0.95)",
		textColor: "#333",
		hoverBg: "rgba(0, 0, 0, 0.06)",
		borderColor: "rgba(0, 0, 0, 0.08)",
		shadowColor: "rgba(0, 0, 0, 0.15)"
	},
	addBtn: {
		fill: "rgba(200, 200, 220, 0.6)",
		hoverFill: "rgba(180, 180, 200, 0.8)",
		iconColor: "#666"
	},
	selection: {
		strokeColor: "#4A90D9",
		fillColor: "rgba(74, 144, 217, 0.08)"
	},
	highlight: {
		textColor: "#fac800",
		bgColor: "rgba(252, 211, 77, 0.2)"
	}
}, r = {
	...t,
	root: {
		...t.root,
		bgColor: "#4A6FA5",
		textColor: "#FFFFFF"
	},
	node: {
		...t.node,
		textColor: "#E0E0E0"
	},
	canvas: { bgColor: "#1a1a2e" },
	controls: {
		bgColor: "rgba(30, 30, 45, 0.9)",
		textColor: "#ccc",
		hoverBg: "rgba(255, 255, 255, 0.1)",
		activeBg: "rgba(255, 255, 255, 0.12)"
	},
	contextMenu: {
		bgColor: "rgba(35, 35, 50, 0.95)",
		textColor: "#ddd",
		hoverBg: "rgba(255, 255, 255, 0.08)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		shadowColor: "rgba(0, 0, 0, 0.4)"
	},
	addBtn: {
		fill: "rgba(100, 100, 130, 0.6)",
		hoverFill: "rgba(120, 120, 150, 0.8)",
		iconColor: "#aaa"
	},
	selection: {
		strokeColor: "#5B9BD5",
		fillColor: "rgba(91, 155, 213, 0.15)"
	},
	highlight: {
		textColor: "#fcd34d",
		bgColor: "rgba(251, 191, 36, 0.2)"
	}
};
function i(e) {
	return e === "dark" ? r : n;
}
var a = n;
function o(t, n = e) {
	let r = {
		"--mindmap-canvas-bg": t.canvas.bgColor,
		"--mindmap-root-bg": t.root.bgColor,
		"--mindmap-root-text": t.root.textColor,
		"--mindmap-root-font-size": `${t.root.fontSize}px`,
		"--mindmap-root-font-weight": String(t.root.fontWeight),
		"--mindmap-root-font-family": t.root.fontFamily,
		"--mindmap-node-text": t.node.textColor,
		"--mindmap-node-font-size": `${t.node.fontSize}px`,
		"--mindmap-node-font-weight": String(t.node.fontWeight),
		"--mindmap-node-font-family": t.node.fontFamily,
		"--mindmap-level1-font-size": `${t.level1.fontSize}px`,
		"--mindmap-level1-font-weight": String(t.level1.fontWeight),
		"--mindmap-edge-width": String(t.connection.strokeWidth),
		"--mindmap-selection-stroke": t.selection.strokeColor,
		"--mindmap-selection-fill": t.selection.fillColor,
		"--mindmap-highlight-text": t.highlight.textColor,
		"--mindmap-highlight-bg": t.highlight.bgColor,
		"--mindmap-addbtn-fill": t.addBtn.fill,
		"--mindmap-addbtn-hover": t.addBtn.hoverFill,
		"--mindmap-addbtn-icon": t.addBtn.iconColor,
		"--mindmap-controls-bg": t.controls.bgColor,
		"--mindmap-controls-text": t.controls.textColor,
		"--mindmap-controls-hover": t.controls.hoverBg,
		"--mindmap-ctx-bg": t.contextMenu.bgColor,
		"--mindmap-ctx-text": t.contextMenu.textColor,
		"--mindmap-ctx-hover": t.contextMenu.hoverBg,
		"--mindmap-ctx-border": t.contextMenu.borderColor,
		"--mindmap-ctx-shadow": t.contextMenu.shadowColor
	};
	for (let e = 0; e < n.length; e++) r[`--mindmap-branch-${e}`] = n[e];
	return r;
}
function s(e) {
	return [
		`.mindmap-edge { stroke-width: ${e.connection.strokeWidth}; stroke-linecap: round; fill: none; }`,
		".mindmap-node-underline { stroke-width: 2.5; stroke-linecap: round; }",
		".mindmap-code-bg { fill: rgba(128,128,128,0.12); }",
		`.mindmap-highlight-bg { fill: ${e.highlight.bgColor}; }`,
		`.mindmap-edge-label { pointer-events: none; font-family: ${e.node.fontFamily}; }`
	].join("\n    ");
}
//#endregion
export { e as BRANCH_COLORS, a as THEME, o as generateCSSVariables, s as generateExportStyles, i as getTheme };
