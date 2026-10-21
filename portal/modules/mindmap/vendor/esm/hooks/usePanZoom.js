import { useCallback as e, useEffect as t, useMemo as n, useRef as r, useState as i } from "react";
//#region src/components/MindMap/hooks/usePanZoom.ts
function a(a, o) {
	let [s, c] = i({
		x: 0,
		y: 0
	}), [l, u] = i(1), d = r(0), f = r(l), p = r(s);
	t(() => {
		f.current = l, p.current = s;
	});
	let m = n(() => {
		if (o.length === 0) return {
			x: 0,
			y: 0
		};
		let e = Infinity, t = -Infinity, n = Infinity, r = -Infinity;
		for (let i of o) e = Math.min(e, i.x - i.width / 2), t = Math.max(t, i.x + i.width / 2), n = Math.min(n, i.y - i.height / 2), r = Math.max(r, i.y + i.height / 2);
		return {
			x: (e + t) / 2,
			y: (n + r) / 2
		};
	}, [o]), h = e((e, t, n) => {
		cancelAnimationFrame(d.current);
		let r = f.current, i = p.current.x, a = p.current.y, o = performance.now(), s = (l) => {
			let f = l - o, p = Math.min(f / 200, 1), m = 1 - (1 - p) ** 3;
			u(r + (e - r) * m), c({
				x: i + (t - i) * m,
				y: a + (n - a) * m
			}), p < 1 && (d.current = requestAnimationFrame(s));
		};
		d.current = requestAnimationFrame(s);
	}, []), g = e(() => {
		let e = a.current;
		if (!e || o.length === 0) return;
		let t = e.clientWidth, n = e.clientHeight, r = Infinity, i = -Infinity, s = Infinity, c = -Infinity;
		for (let e of o) r = Math.min(r, e.x - e.width / 2), i = Math.max(i, e.x + e.width / 2), s = Math.min(s, e.y - e.height / 2), c = Math.max(c, e.y + e.height / 2);
		let l = i - r, u = c - s, d = Math.min((t - 120) / l, (n - 120) / u, 1.5), f = (r + i) / 2, p = (s + c) / 2;
		return {
			zoom: d,
			panX: t / 2 - f * d,
			panY: n / 2 - p * d
		};
	}, [a, o]);
	return t(() => {
		let e = a.current;
		if (!e) return;
		let t = (t) => {
			t.preventDefault();
			let n = e.getBoundingClientRect(), r = t.clientX - n.left, i = t.clientY - n.top, a = t.deltaY;
			t.deltaMode === 1 && (a *= 16);
			let o = 1.001 ** -a, s = Math.min(Math.max(f.current * o, .1), 5);
			c({
				x: r - (r - p.current.x) * (s / f.current),
				y: i - (i - p.current.y) * (s / f.current)
			}), u(s);
		};
		return e.addEventListener("wheel", t, { passive: !1 }), () => e.removeEventListener("wheel", t);
	}, [a]), {
		pan: s,
		setPan: c,
		zoom: l,
		setZoom: u,
		animateTo: h,
		autoFit: g,
		zoomIn: e(() => {
			let e = Math.min(f.current * 1.15, 5), t = a.current, n = t.clientWidth / 2, r = t.clientHeight / 2;
			h(e, n - (n - p.current.x) * (e / f.current), r - (r - p.current.y) * (e / f.current));
		}, [a, h]),
		zoomOut: e(() => {
			let e = Math.max(f.current * .87, .1), t = a.current, n = t.clientWidth / 2, r = t.clientHeight / 2;
			h(e, n - (n - p.current.x) * (e / f.current), r - (r - p.current.y) * (e / f.current));
		}, [a, h]),
		contentCenter: m,
		panToNode: e((e) => {
			let t = a.current;
			if (!t) return;
			let n = o.find((t) => t.id === e);
			if (!n) return;
			let r = t.clientWidth, i = t.clientHeight, s = n.x * f.current + p.current.x, c = n.y * f.current + p.current.y;
			s > 100 && s < r - 100 && c > 100 && c < i - 100 || h(f.current, r / 2 - n.x * f.current, i / 2 - n.y * f.current);
		}, [
			a,
			o,
			h
		])
	};
}
//#endregion
export { a as usePanZoom };
