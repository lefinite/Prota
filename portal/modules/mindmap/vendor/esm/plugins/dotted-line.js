//#region src/components/MindMap/plugins/dotted-line.ts
var e = {
	name: "dotted-line",
	parseLine(e) {
		let t = e.match(/^(\s*)-\.\s+(.+)/);
		return t ? {
			indent: t[1].replace(/\t/g, "  ").length,
			text: t[2].trim(),
			dottedLine: !0
		} : null;
	},
	serializeListMarker(e, t) {
		return e.dottedLine ? "-. " : t;
	},
	transformEdge(e, t, n) {
		return n.dottedLine ? {
			...e,
			strokeDasharray: "6 4"
		} : e;
	}
};
//#endregion
export { e as dottedLinePlugin };
