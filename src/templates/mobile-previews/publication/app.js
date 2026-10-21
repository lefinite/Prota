// 城市晚报 · Publication — 页面交互
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

/* ===== chip 筛选（版面）===== */
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

/* ===== 收藏报道 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏，可在「我的」里回看" : "已取消收藏");
  });
});

/* ===== 订阅数字报：校验邮箱 ===== */
const mailInput = document.getElementById("mailInput");

function subscribe() {
  const value = mailInput.value.trim();
  if (!value || !value.includes("@") || value.startsWith("@") || value.endsWith("@")) {
    showToast("请输入有效邮箱，如 reader@citynews.cn");
    mailInput.focus();
    return;
  }
  mailInput.value = "";
  showToast("订阅成功，早报明早 6:30 送达");
}

document.getElementById("subBtn").addEventListener("click", subscribe);
mailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") subscribe();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "头版") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "版面") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "视听") {
      showToast("视听版上线中，先看今日播客《夜市声景》");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
