import { useCallback as e, useEffect as t, useRef as n, useState as r } from "react";
//#region src/components/MindMap/hooks/useCanvasPan.ts
function i({ svgRef: i, pan: a, setPan: o }) {
	let [s, c] = r(!1), l = n({
		x: 0,
		y: 0,
		panX: 0,
		panY: 0
	}), u = n(!1), d = e((e) => {
		e.button === 0 && (u.current = !1, c(!0), l.current = {
			x: e.clientX,
			y: e.clientY,
			panX: a.x,
			panY: a.y
		});
	}, [a]), f = e((e) => {
		s && (u.current = !0, o({
			x: l.current.panX + (e.clientX - l.current.x),
			y: l.current.panY + (e.clientY - l.current.y)
		}));
	}, [s, o]), p = e(() => {
		c(!1);
	}, []), m = n(a);
	return t(() => {
		m.current = a;
	}), t(() => {
		let e = i.current;
		if (!e) return;
		function t(e) {
			if (e.touches.length !== 1) return;
			e.preventDefault();
			let t = e.touches[0];
			u.current = !1, c(!0), l.current = {
				x: t.clientX,
				y: t.clientY,
				panX: m.current.x,
				panY: m.current.y
			};
		}
		function n(e) {
			if (e.touches.length !== 1) return;
			e.preventDefault(), u.current = !0;
			let t = e.touches[0];
			o({
				x: l.current.panX + (t.clientX - l.current.x),
				y: l.current.panY + (t.clientY - l.current.y)
			});
		}
		function r(e) {
			e.touches.length === 0 && c(!1);
		}
		return e.addEventListener("touchstart", t, { passive: !1 }), e.addEventListener("touchmove", n, { passive: !1 }), e.addEventListener("touchend", r, { passive: !1 }), e.addEventListener("touchcancel", r, { passive: !1 }), () => {
			e.removeEventListener("touchstart", t), e.removeEventListener("touchmove", n), e.removeEventListener("touchend", r), e.removeEventListener("touchcancel", r);
		};
	}, [i, o]), {
		draggingCanvas: s,
		didDragRef: u,
		handleCanvasMouseDown: d,
		handleMouseMove: f,
		handleMouseUp: p
	};
}
//#endregion
export { i as useCanvasPan };
