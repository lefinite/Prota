// 胶片时光 · Retro — 页面交互
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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 咔嚓一张：计数 + 闪光 ===== */
const snapBtn = document.getElementById("snapBtn");
const shotCount = document.getElementById("shotCount");
const flash = document.getElementById("flash");

snapBtn.addEventListener("click", () => {
  let count = Number(shotCount.textContent);
  if (count >= 36) {
    showToast("本卷已拍完 · 换卷后可预约冲扫");
    return;
  }
  count += 1;
  shotCount.textContent = String(count);
  if (!prefersReducedMotion) {
    flash.classList.remove("is-flash");
    void flash.offsetWidth; /* 重置动画 */
    flash.classList.add("is-flash");
  }
  if (count >= 36) {
    showToast("36 张拍满 · 本卷完成，记得回卷");
  } else {
    showToast(`咔嚓！第 ${count} 张已定格`);
  }
});

/* ===== 测光：光圈 chip 联动快门 ===== */
const apChips = document.querySelectorAll(".ap-chip");
const shutterValue = document.getElementById("shutterValue");
const shutterHint = document.getElementById("shutterHint");

apChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    apChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const shutter = chip.dataset.shutter;
    shutterValue.textContent = shutter;
    shutterHint.textContent = shutter;
    showToast(`光圈 ${chip.textContent} · 推荐快门 ${shutter} 秒`);
  });
});

/* ===== 收藏底片 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入最爱底片" : "已移出最爱");
  });
});

/* ===== chip 筛选底片 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chips .chip");

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

/* ===== 重命名胶卷 ===== */
const renameInput = document.getElementById("renameInput");
const filmName = document.getElementById("filmName");

renameInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = renameInput.value.trim();
  if (!value) {
    renameInput.focus();
    return;
  }
  filmName.textContent = value.toUpperCase();
  renameInput.value = "";
  showToast(`本卷已命名 · ${value}`);
});

/* ===== 预约冲扫 ===== */
document.getElementById("bookBtn").addEventListener("click", () => {
  showToast("已预约周六 14:00 · 老联通冲扫店");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const heroSection = document.querySelector(".film-hero");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "相机") {
      heroSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    } else if (name === "快门") {
      snapBtn.click();
    } else if (name === "胶卷") {
      document.querySelector(".feed").scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
