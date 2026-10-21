// mobile-previews/urdu — Khabar Urdu (خبر اردو)
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 分类筛选 / 新闻互动 / 按钮 Toast
// RTL-aware interactions

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

// Button Toast Feedback
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// Tab Navigation
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    if (label) {
      showToast(`«${label.textContent}» پر جانا`);
    }
  });
});

// Category Pills Filter
const categoryPills = document.querySelectorAll(".categories .category-pill");
const newsItems = document.querySelectorAll(".news-item");

const categoryNames = {
  all: "تمام",
  politics: "سیاست",
  sports: "کھیل",
  business: "کاروبار",
  tech: "ٹیکنولوجی"
};

categoryPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    // Update active state
    categoryPills.forEach((p) => p.classList.remove("is-active"));
    pill.classList.add("is-active");

    const category = pill.dataset.category;

    // Filter news items
    newsItems.forEach((item) => {
      if (category === "all" || item.dataset.category === category) {
        item.style.display = "flex";
        item.style.animation = "fade-in-up 0.3s ease-out";
      } else {
        item.style.display = "none";
      }
    });

    // Show toast
    showToast(`زمرہ: ${categoryNames[category] || category}`);
  });
});

// News Item Click
newsItems.forEach((item) => {
  item.addEventListener("click", () => {
    const title = item.querySelector(".news-title");
    if (title) {
      showToast(`خبر کھولیں: ${title.textContent.substring(0, 30)}...`);
    }
  });
});

// Featured Card Click
const featuredCard = document.querySelector(".featured-card");
if (featuredCard) {
  featuredCard.addEventListener("click", () => {
    const title = featuredCard.querySelector(".featured-title");
    if (title) {
      showToast(`مکمل خبر: ${title.textContent.substring(0, 25)}...`);
    }
  });
}
