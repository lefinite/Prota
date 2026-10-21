// mobile-previews/superhuman — Superhuman Inbox
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 邮件筛选 / 星标切换 / Toast 反馈

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 邮件筛选
const chips = document.querySelectorAll("#filterChips .chip");
const emails = document.querySelectorAll("#emailList .email");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    emails.forEach((email) => {
      const show = filter === "all" ||
                   (filter === "unread" && email.dataset.type === "unread") ||
                   (filter === "starred" && email.dataset.starred === "true");
      email.classList.toggle("is-hidden", !show);
    });
  });
});

// 星标切换
document.querySelectorAll(".email__star").forEach((starBtn) => {
  starBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const emailItem = starBtn.closest(".email");
    const isStarred = starBtn.classList.toggle("is-starred");
    emailItem.dataset.starred = isStarred ? "true" : "false";
    // 更新 toast 消息
    const toast = starBtn.dataset.toast || (isStarred ? "已加星" : "已取消加星");
    showToast(toast);
  });
});
