// 燃拍 · Energetic — 页面交互
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

/* ===== 项目 chip 筛选动态 ===== */
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

/* ===== 喝彩 toggle ===== */
document.querySelectorAll(".feed-item__cheer").forEach((cheer) => {
  cheer.addEventListener("click", () => {
    const on = cheer.classList.toggle("is-on");
    cheer.setAttribute("aria-pressed", String(on));
    showToast(on ? "已为队友喝彩 +1" : "已收回喝彩");
  });
});

/* ===== 完成打卡：进度环 + 燃烧数字一起涨 ===== */
const ringFill = document.getElementById("ringFill");
const burnAmount = document.querySelector(".burn-card__amount");
const burnFoot = document.querySelector(".burn-card__foot b");
const checkinInput = document.getElementById("checkinInput");
const RING_CIRC = 339.292;

function updateRing(burned, goal) {
  const pct = Math.min(burned / goal, 1);
  ringFill.style.setProperty("--dash", String(RING_CIRC * (1 - pct)));
  burnAmount.textContent = burned.toLocaleString("zh-CN");
  const left = Math.max(goal - burned, 0);
  burnFoot.textContent = left > 0 ? `还差 ${left.toLocaleString("zh-CN")} · ${Math.round(pct * 100)}%` : `目标达成 · 100%`;
}

document.getElementById("checkinBtn").addEventListener("click", () => {
  const burn = 246 + Math.floor(Math.random() * 120); // 本次打卡消耗
  const current = Number(burnAmount.textContent.replace(/,/g, ""));
  const goal = 1650;
  updateRing(current + burn, goal);
  checkinInput.value = "";
  showToast(`打卡成功，+${burn} 千卡！`);
});

checkinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("checkinBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "运动") {
      checkinInput.focus();
      showToast("选好项目，出发！");
    } else if (name === "今日") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "战队") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
