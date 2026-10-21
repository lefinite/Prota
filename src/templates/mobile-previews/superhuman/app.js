// 疾邮 · Superhuman 风格 — 页面交互
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

/* ===== 行点击：归档（键盘优先哲学）===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const name = item.querySelector(".feed-item__name");
    const unread = item.querySelector(".feed-item__flag");
    if (unread) {
      unread.remove();
      name.classList.add("is-read");
      item.dataset.kind = "read";
      showToast(`已归档「${name.textContent}」（E）`);
    } else {
      showToast("已标记为未读");
    }
  });
});

/* ===== 快速短语 ===== */
const replyInput = document.getElementById("replyInput");
document.querySelectorAll("[data-quick]").forEach((chip) => {
  chip.addEventListener("click", () => {
    replyInput.value = chip.dataset.quick;
    replyInput.focus();
  });
});

/* ===== 发送 ===== */
let processed = 23;

document.getElementById("sendBtn").addEventListener("click", () => {
  if (!replyInput.value.trim()) {
    showToast("写点什么再发送，⌘+Enter 也行");
    return;
  }
  processed += 1;
  replyInput.value = "";
  showToast(`已发送 · 今天第 ${processed} 封，平均 18 秒`);
});

replyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("sendBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "撰写") {
      replyInput.focus();
      showToast("C 撰写 · R 回复 · ⌘K 搜索");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
