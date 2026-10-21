//#region src/components/MindMap/plugins/front-matter.ts
var e = {
	name: "front-matter",
	preParseMarkdown(e, t) {
		let n = e.match(/^---\n([\s\S]*?)\n---\n?/);
		if (!n) return e;
		let r = n[1];
		for (let e of r.split("\n")) {
			let n = e.match(/^(\w[\w-]*)\s*:\s*(.+)/);
			n && (t.frontMatter[n[1].trim()] = n[2].trim());
		}
		return e.slice(n[0].length);
	},
	serializePreamble(e) {
		return "";
	}
};
//#endregion
export { e as frontMatterPlugin };
