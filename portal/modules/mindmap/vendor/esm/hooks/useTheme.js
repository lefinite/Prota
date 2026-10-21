import { getTheme as e } from "../utils/theme.js";
import { useMemo as t, useSyncExternalStore as n } from "react";
//#region src/components/MindMap/hooks/useTheme.ts
var r = typeof window < "u" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function i(e) {
	return r?.addEventListener("change", e), () => r?.removeEventListener("change", e);
}
function a() {
	return r?.matches ?? !1;
}
function o(r = "auto") {
	let o = n(i, a, () => !1), s = r === "auto" ? o ? "dark" : "light" : r;
	return t(() => e(s), [s]);
}
//#endregion
export { o as useTheme };
