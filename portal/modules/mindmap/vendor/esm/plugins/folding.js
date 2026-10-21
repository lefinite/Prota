//#region src/components/MindMap/plugins/folding.ts
var e = {
	name: "folding",
	parseLine(e) {
		let t = e.match(/^(\s*)\+\s+(.+)/);
		return t ? {
			indent: t[1].replace(/\t/g, "  ").length,
			text: t[2].trim(),
			collapsed: !0
		} : null;
	},
	serializeListMarker(e, t) {
		return e.collapsed ? "+ " : t;
	},
	filterChildren(e, t, n) {
		return !n.readonly || !e.collapsed || n.foldOverrides[e.id] ? t : [];
	}
};
//#endregion
export { e as foldingPlugin };
