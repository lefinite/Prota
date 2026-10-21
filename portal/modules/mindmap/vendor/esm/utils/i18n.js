//#region src/components/MindMap/utils/i18n.ts
var e = {
	newNode: "新节点",
	zoomIn: "放大",
	zoomOut: "缩小",
	resetView: "重置视图",
	layoutLeft: "向左排版",
	layoutBoth: "左右排版",
	layoutRight: "向右排版",
	textMode: "文本模式",
	viewMode: "视图模式",
	fullscreen: "全屏",
	exitFullscreen: "退出全屏",
	newRootNode: "新建主节点",
	export: "导出",
	exportSVG: "导出为 SVG",
	exportPNG: "导出为 PNG",
	exportMarkdown: "导出为 Markdown",
	layout: "布局",
	aiPlaceholder: "让 AI 生成思维导图...",
	aiGenerating: "生成中...",
	aiError: "生成失败",
	close: "关闭"
}, t = {
	newNode: "New Node",
	zoomIn: "Zoom In",
	zoomOut: "Zoom Out",
	resetView: "Reset View",
	layoutLeft: "Left Layout",
	layoutBoth: "Both Layout",
	layoutRight: "Right Layout",
	textMode: "Text Mode",
	viewMode: "View Mode",
	fullscreen: "Fullscreen",
	exitFullscreen: "Exit Fullscreen",
	newRootNode: "New Root Node",
	export: "Export",
	exportSVG: "Export as SVG",
	exportPNG: "Export as PNG",
	exportMarkdown: "Export as Markdown",
	layout: "Layout",
	aiPlaceholder: "Ask AI to generate a mind map...",
	aiGenerating: "Generating...",
	aiError: "Generation failed",
	close: "Close"
}, n = {
	"zh-CN": e,
	"en-US": t
};
function r() {
	if (typeof navigator > "u") return "en-US";
	let e = navigator.language || "";
	if (n[e]) return e;
	if (e.startsWith("zh")) return "zh-CN";
	let t = e.split("-")[0];
	for (let e of Object.keys(n)) if (e.startsWith(t)) return e;
	return "en-US";
}
function i(t = "zh-CN", r) {
	let i = n[t] ?? e;
	return r ? {
		...i,
		...r
	} : i;
}
//#endregion
export { r as detectLocale, i as resolveMessages };
