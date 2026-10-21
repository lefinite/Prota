// mobile-previews/dramatic — Cinema Spotlight
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 影评筛选 / 按钮 Toast / 点赞交互

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 30000);

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1800);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 影评筛选
const chips = document.querySelectorAll("#filterChips .chip");
const reviewItems = document.querySelectorAll("#reviewList .review");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    reviewItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 点赞按钮交互
document.querySelectorAll(".review-like").forEach((btn) => {
  btn.addEventListener("click", function() {
    const span = this.querySelector("span");
    const count = parseInt(span.textContent);
    // Toggle like state
    if (this.classList.contains("is-liked")) {
      this.classList.remove("is-liked");
      span.textContent = count - 1;
    } else {
      this.classList.add("is-liked");
      span.textContent = count + 1;
      showToast("已点赞");
    }
  });
});
