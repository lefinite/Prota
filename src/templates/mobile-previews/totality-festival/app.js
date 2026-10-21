// 全蚀 · Totality Festival — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 倒计时 ===== */
const cdD = document.getElementById("cdD");
const cdH = document.getElementById("cdH");
const cdM = document.getElementById("cdM");
let secs = 88 * 86400 + 6 * 3600 + 42 * 60;

setInterval(() => {
  secs = Math.max(0, secs - 1);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  cdD.textContent = String(d).padStart(2, "0");
  cdH.textContent = String(h).padStart(2, "0");
  cdM.textContent = String(m).padStart(2, "0");
  if (secs === 0) showToast("🌑 食甚开始 · 全场静默");
}, 1000);

/* ===== Feed 筛选 ===== */
const slots = Array.from(document.querySelectorAll(".slot"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    slots.forEach((slot) => {
      slot.hidden = filter !== "all" && slot.dataset.kind !== filter;
    });
  });
});

/* ===== 提前量 chip ===== */
const aheadChips = document.querySelectorAll(".chips--ahead .chip");
aheadChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    aheadChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 设提醒 ===== */
const remindInput = document.getElementById("remindInput");

document.getElementById("remindBtn").addEventListener("click", () => {
  const name = remindInput.value.trim();
  const ahead = document.querySelector(".chips--ahead .is-active").textContent;
  if (!name) {
    showToast("输入艺人名，如：LOW ORBIT");
    return;
  }
  showToast(`已设提醒：${name} 开演${ahead}震动+亮屏`);
  remindInput.value = "";
});

remindInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("remindBtn").click();
});

/* ===== 时段点击 ===== */
slots.forEach((slot) => {
  slot.addEventListener("click", () => {
    showToast(`加入日程：${slot.querySelector(".slot__name").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "日全食") {
      showToast("食甚 17:08 · 最佳观测点：沙丘西侧（营地图已标注）");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
