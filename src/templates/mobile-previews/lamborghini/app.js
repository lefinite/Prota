// REVUELTO · lamborghini — 页面交互
// 状态栏时间逻辑来自 mobile-frame，原样保留。

const statusTime = document.getElementById("statusTime");

function updateStatusTime() {
  if (!statusTime) return;

  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

updateStatusTime();
setInterval(updateStatusTime, 30000);

/* ===== toast ===== */
const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 1800);
}

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== chip 筛选（全部 / CORSA / SPORT / STRADA）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏路线 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "路线已存入车库" : "已移出收藏路线");
  });
});

/* ===== 驾驶模式：切换速度读数与转速表点亮段数 ===== */
const MODE_LIT = { strada: 6, sport: 9, corsa: 12 };
const speedNum = document.getElementById("speedNum");
const tachSegs = Array.from(document.querySelectorAll(".tach__seg"));
const tach = document.getElementById("tach");

document.querySelectorAll(".mode").forEach((mode) => {
  mode.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((m) => m.classList.remove("is-active"));
    mode.classList.add("is-active");

    const name = mode.dataset.mode;
    const lit = MODE_LIT[name] || 6;
    tachSegs.forEach((seg, i) => {
      seg.classList.toggle("is-lit", i < lit - 3);
      seg.classList.toggle("is-red", i >= lit - 3 && i < lit);
    });
    tach.setAttribute("aria-label", `转速表 · ${name.toUpperCase()} 模式，${lit} 段点亮`);

    // 数字滚动到新模式速度（reduced-motion 下由 CSS transition 规则即时生效）
    animateNumber(speedNum, Number(speedNum.textContent), Number(mode.dataset.speed), 600);
    showToast(`已切换 ${name.toUpperCase()} · 动态响应已重写`);
  });
});

function animateNumber(el, from, to, duration) {
  if (el.dataset.reduced === "1" || prefersReducedMotion()) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ===== 引擎启动 / 熄火 toggle ===== */
const engineBtn = document.getElementById("engineBtn");
const engineLabel = engineBtn.querySelector(".btn-gold__label");
const engineSub = engineBtn.querySelector(".btn-gold__sub");
let engineOn = true;

engineBtn.addEventListener("click", () => {
  engineOn = !engineOn;
  if (engineOn) {
    engineLabel.textContent = "ENGINE START";
    engineSub.textContent = "启动引擎 · V12 点火";
    showToast("V12 已点火 · 怠速 900 RPM");
  } else {
    engineLabel.textContent = "ENGINE STOP";
    engineSub.textContent = "熄火 · 进入驻车监护";
    showToast("引擎已熄火 · 车辆进入驻车监护");
  }
});

/* ===== 六边形 FAB：锁车 / 解锁 ===== */
const lockFab = document.getElementById("lockFab");
let locked = true;

lockFab.addEventListener("click", () => {
  locked = !locked;
  lockFab.classList.toggle("is-unlocked", !locked);
  lockFab.setAttribute("aria-pressed", String(locked));
  lockFab.setAttribute("aria-label", locked ? "锁车" : "解锁");
  showToast(locked ? "车辆已上锁 · 所有车门闭锁" : "车辆已解锁 · 欢迎回来");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll('.tabbar__item:not([data-tab="锁车"])');

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "车况") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "行程") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
