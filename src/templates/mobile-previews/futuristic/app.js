// 星轨 · Futuristic — 页面交互
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

/* ===== Hero：追踪此目标 ===== */
const trackBtn = document.getElementById("trackBtn");
const issBtn = document.getElementById("issBtn");
let heroTracked = false;

function setHeroTracked(on) {
  heroTracked = on;
  trackBtn.classList.toggle("is-on", on);
  trackBtn.setAttribute("aria-pressed", String(on));
  trackBtn.textContent = on ? "已追踪 ISS · 19:42 提醒" : "追踪此目标";
}

trackBtn.addEventListener("click", () => {
  setHeroTracked(!heroTracked);
  showToast(heroTracked ? "已追踪 ISS · 过境前 10 分钟提醒" : "已取消追踪 ISS");
});

issBtn.addEventListener("click", () => {
  setHeroTracked(true);
  showToast("ISS 已加入跟踪列表 · 今晚 19:42");
});

/* ===== chip 筛选 ===== */
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

/* ===== Feed 行内追踪 toggle ===== */
document.querySelectorAll(".feed-item__track").forEach((btn) => {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    const name = btn.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `已追踪 ${name}` : `已取消追踪 ${name}`);
  });
});

/* ===== NORAD 检索 ===== */
const noradInput = document.getElementById("noradInput");

noradInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const code = noradInput.value.trim();
  if (!code) {
    showToast("输入 NORAD 编号，例如 25544");
    return;
  }
  noradInput.value = "";
  showToast(`目标 ${code} 已锁定 · 今晚 19:42 可见`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "天空") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "扫描") {
      noradInput.focus();
      showToast("输入编号，扫描今晚的天空");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
