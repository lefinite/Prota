// mobile-previews/pinterest — 灵感画板
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 分类筛选 / 按钮 Toast / 保存交互

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1600);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 保存按钮交互动画
document.querySelectorAll(".pin__save, .hero-pin__save").forEach((btn) => {
  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    const isSaved = this.classList.toggle("is-saved");
    if (isSaved) {
      this.style.background = "var(--accent)";
      this.style.color = "var(--accent-on)";
      showToast("已保存");
    } else {
      this.style.background = "";
      this.style.color = "";
      showToast("已取消保存");
    }
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 分类筛选
const chips = document.querySelectorAll("#filterChips .chip");
const pinItems = document.querySelectorAll("#pinList .pin");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    pinItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});
