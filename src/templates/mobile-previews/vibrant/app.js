// 橙集 · Vibrant — 页面交互
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

/* ===== 预约入场 ===== */
const rsvpBtn = document.getElementById("rsvpBtn");
const rsvpCount = document.querySelectorAll(".hero__stats b")[1];
let rsvp = 12000;

rsvpBtn.addEventListener("click", () => {
  if (rsvpBtn.textContent === "已预约 ✓") {
    showToast("已经预约过啦，周日见！");
    return;
  }
  rsvp += 1;
  rsvpCount.textContent = (rsvp / 10000).toFixed(1) + "万";
  rsvpBtn.textContent = "已预约 ✓";
  showToast("预约成功 · 凭码入场，可参与集章");
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.textContent = on ? "★" : "☆";
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入必逛清单" : "已移出清单");
  });
});

/* ===== 摊位类别 chip ===== */
const catChips = document.querySelectorAll(".chips--cat .chip");
let cat = "手作";
catChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    catChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    cat = chip.textContent;
  });
});

/* ===== 申请摊位 ===== */
const stallInput = document.getElementById("stallInput");

document.getElementById("applyBtn").addEventListener("click", () => {
  const name = (stallInput.value || "").trim();
  if (!name) {
    showToast("先给摊位起个名字");
    return;
  }
  showToast(`「${name}」（${cat}类）申请已提交 · 3 日内回复`);
  stallInput.value = "";
});

stallInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("applyBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "集章") {
      showToast("到摊位扫码集章 · 7/10，还差 3 个帆布袋");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
