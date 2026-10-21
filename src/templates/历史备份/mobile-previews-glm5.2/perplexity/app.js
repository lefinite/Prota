// mobile-previews/perplexity — 知光研究 · Perplexity
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 搜索提交 / 操作 Toast

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

// 搜索输入交互
const searchInput = document.querySelector(".search-input");
const searchSubmit = document.querySelector(".search-submit");
if (searchInput && searchSubmit) {
  searchSubmit.addEventListener("click", () => {
    const query = searchInput.value.trim();
    if (query) {
      showToast(`搜索：${query}`);
    } else {
      showToast("请输入搜索内容");
    }
  });
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchSubmit.click();
    }
  });
}

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

// 历史记录项点击
document.querySelectorAll(".history-item").forEach((item) => {
  item.addEventListener("click", () => {
    const title = item.querySelector(".history-item__title")?.textContent || "研究";
    showToast(`打开「${title}」`);
  });
});

// 话题卡片点击
document.querySelectorAll(".topic-card").forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.querySelector(".topic-card__title")?.textContent || "话题";
    showToast(`查看「${title}」`);
  });
});

// 来源卡片点击
document.querySelectorAll(".source-chip").forEach((chip) => {
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    const domain = chip.querySelector(".source-chip__domain")?.textContent || "来源";
    showToast(`访问 ${domain}`);
  });
});
