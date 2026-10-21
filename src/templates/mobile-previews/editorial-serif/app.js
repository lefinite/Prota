// 长夜 · Editorial Serif — 页面交互
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

/* ===== 字号切换 ===== */
const FONT_SIZES = ["舒适", "标准", "大号"];
let fontIndex = 1;
const appContent = document.getElementById("appContent");

document.getElementById("fontToggle").addEventListener("click", () => {
  fontIndex = (fontIndex + 1) % FONT_SIZES.length;
  const size = [15, 16, 18][fontIndex];
  appContent.style.fontSize = `${size}px`;
  showToast(`已切换到${FONT_SIZES[fontIndex]}字号`);
});

/* ===== 订阅源 chip 筛选 ===== */
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

/* ===== 关注 toggle ===== */
document.querySelectorAll(".feed-item__follow").forEach((follow) => {
  follow.addEventListener("click", () => {
    const on = follow.classList.toggle("is-on");
    follow.textContent = on ? "已关注" : "关注";
    follow.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注该订阅源" : "已取消关注");
  });
});

/* ===== 读书笔记 ===== */
const noteInput = document.getElementById("noteInput");

document.getElementById("resumeBtn").addEventListener("click", () => {
  if (noteInput.value.trim()) {
    showToast("笔记已保存，进入续读");
    noteInput.value = "";
  } else {
    showToast("正在打开《关于慢的辩护》");
  }
});

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("resumeBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "订阅") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "书房") {
      appContent.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
