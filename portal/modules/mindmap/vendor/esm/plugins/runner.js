//#region src/components/MindMap/plugins/runner.ts
function e(e, t, n) {
	for (let r of e) r.preParseMarkdown && (t = r.preParseMarkdown(t, n));
	return t;
}
function t(e, t, n, r) {
	for (let i of e) if (i.parseLine) {
		let e = i.parseLine(t, n, r);
		if (e) return e;
	}
	return null;
}
function n(e, t, n, r, i) {
	let a = 0;
	for (let o of e) if (o.collectFollowLines) {
		let e = o.collectFollowLines(t, n + a, r, i);
		a += e;
	}
	return a;
}
function r(e, t, n, r) {
	for (let i of e) i.transformNodeData && (t = i.transformNodeData(t, n, r));
	return t;
}
function i(e, t, n) {
	for (let r of e) r.postParseTree && (t = r.postParseTree(t, n));
	return t;
}
function a(e, t) {
	let n = "";
	for (let r of e) if (r.serializePreamble) {
		let e = r.serializePreamble(t);
		e && (n += e);
	}
	return n;
}
function o(e, t, n) {
	let r = n;
	for (let n of e) if (n.serializeListMarker) {
		let e = n.serializeListMarker(t, r);
		if (e !== r) {
			r = e;
			break;
		}
	}
	return r;
}
function s(e, t, n) {
	for (let r of e) r.serializeNodeText && (n = r.serializeNodeText(t, n));
	return n;
}
function c(e, t, n) {
	let r = [];
	for (let i of e) if (i.serializeFollowLines) {
		let e = i.serializeFollowLines(t, n);
		e && r.push(...e);
	}
	return r;
}
function l(e, t, n, r, i) {
	for (let a of e) if (a.adjustNodeSize) {
		let e = a.adjustNodeSize(t, n, r, i);
		n = e.width, r = e.height;
	}
	return {
		width: n,
		height: r
	};
}
function u(e, t, n, r) {
	for (let i of e) i.filterChildren && (n = i.filterChildren(t, n, r));
	return n;
}
function d(e, t, n, r) {
	for (let i of e) i.transformEdge && (t = i.transformEdge(t, n, r));
	return t;
}
function f(e, t, n, r) {
	let i = [];
	for (let a of e) a.generateExtraEdges && i.push(...a.generateExtraEdges(t, n, r));
	return i;
}
function p(e, t, n, r) {
	let i = {};
	for (let a of e) if (a.transformNodeColor) {
		let e = a.transformNodeColor(t, n, r);
		i = {
			...i,
			...e
		};
	}
	return i;
}
function m(e, t, n) {
	let r = [];
	for (let i of e) if (i.renderNodeDecoration) {
		let e = i.renderNodeDecoration(t, n);
		e && r.push(e);
	}
	return r;
}
function h(e, t, n) {
	for (let r of e) if (r.renderInlineToken) {
		let e = r.renderInlineToken(t, n);
		if (e) return e;
	}
	return null;
}
function g(e, t, n, r) {
	let i = [];
	for (let a of e) if (a.renderOverlay) {
		let e = a.renderOverlay(t, n, r);
		e && i.push(e);
	}
	return i;
}
function _(e, t, n, r, i) {
	let a = "";
	for (let o of e) o.exportNodeDecoration && (a += o.exportNodeDecoration(t, n, r, i));
	return a;
}
function v(e, t, n, r) {
	let i = "";
	for (let a of e) a.exportOverlay && (i += a.exportOverlay(t, n, r));
	return i;
}
//#endregion
export { l as runAdjustNodeSize, n as runCollectFollowLines, _ as runExportNodeDecoration, v as runExportOverlay, u as runFilterChildren, f as runGenerateExtraEdges, t as runParseLine, i as runPostParseTree, e as runPreParseMarkdown, h as runRenderInlineToken, m as runRenderNodeDecoration, g as runRenderOverlay, c as runSerializeFollowLines, o as runSerializeListMarker, s as runSerializeNodeText, a as runSerializePreamble, d as runTransformEdge, p as runTransformNodeColor, r as runTransformNodeData };
