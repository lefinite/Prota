// mobile-previews/slack — Connect · Slack Design System
// 保留：状态栏时间逻辑
// 页面：Sidebar 导航 / 消息 hover 时间 / 反应切换 / 输入框 / Toast

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

// Sidebar 导航切换
const sidebarItems = document.querySelectorAll(".sidebar-item");
sidebarItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    sidebarItems.forEach((i) => i.classList.remove("sidebar-item--active"));
    item.classList.add("sidebar-item--active");
    const channelName = item.querySelector(".sidebar-item__text");
    showToast(channelName ? `切换到 ${channelName.textContent}` : "已切换");

    // 更新频道头部
    const channelNameEl = document.querySelector(".channel-header__name");
    if (channelNameEl && channelName) {
      channelNameEl.textContent = channelName.textContent.startsWith("#")
        ? channelName.textContent
        : "# " + channelName.textContent;
    }
  });
});

// 消息 hover 时间显示（Slack 风格：时间仅在 hover 时显示）
const messages = document.querySelectorAll(".message");
messages.forEach((msg) => {
  msg.addEventListener("mouseenter", () => {
    const timeEl = msg.querySelector(".message-time");
    if (timeEl) timeEl.style.opacity = "1";
  });
  msg.addEventListener("mouseleave", () => {
    const timeEl = msg.querySelector(".message-time");
    if (timeEl) timeEl.style.opacity = "";
  });
});

// 反应切换
const reactions = document.querySelectorAll(".reaction");
reactions.forEach((reaction) => {
  reaction.addEventListener("click", (e) => {
    e.stopPropagation();
    reaction.classList.toggle("is-active");

    // 模拟数量变化
    const text = reaction.textContent;
    const count = parseInt(text) || 0;
    if (reaction.classList.contains("is-active")) {
      reaction.textContent = text.replace(/\d+/, count + 1);
      showToast("已添加反应");
    } else {
      reaction.textContent = text.replace(/\d+/, Math.max(0, count - 1));
      showToast("已取消反应");
    }
  });
});

// 消息输入框
const composerInput = document.querySelector(".composer-input");
const composerSend = document.querySelector(".composer-send");

if (composerInput && composerSend) {
  // 输入时激活发送按钮
  composerInput.addEventListener("input", () => {
    if (composerInput.value.trim()) {
      composerSend.style.background = "var(--color-aubergine-light)";
    } else {
      composerSend.style.background = "var(--color-aubergine)";
    }
  });

  // 发送消息
  composerSend.addEventListener("click", () => {
    const text = composerInput.value.trim();
    if (text) {
      showToast("消息已发送");
      composerInput.value = "";
      composerSend.style.background = "var(--color-aubergine)";
    }
  });

  // 回车发送
  composerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composerSend.click();
    }
  });
}

// 消息点击高亮
messages.forEach((msg) => {
  msg.addEventListener("click", () => {
    messages.forEach((m) => m.classList.remove("message--highlight"));
    msg.classList.add("message--highlight");
  });
});
