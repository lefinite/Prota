// mobile-previews/huggingface — Model Hub · Hugging Face Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 模型分类筛选 / 按钮 Toast / 点赞交互

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
    const label = tab.querySelector("span:last-child");
    showToast(label ? `${label.textContent}` : "Tab switched");
  });
});

// 模型分类筛选
const taskFilters = document.querySelectorAll("#taskFilters .cat-chip");
const modelCards = document.querySelectorAll("#modelList .model-card");
taskFilters.forEach((chip) => {
  chip.addEventListener("click", () => {
    taskFilters.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    modelCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !show);
    });
  });
});

// 点赞按钮交互
const likeButtons = document.querySelectorAll(".btn-like");
likeButtons.forEach((btn) => {
  btn.addEventListener("click", function() {
    const svg = this.querySelector("svg");
    const isLiked = this.classList.toggle("is-liked");

    if (isLiked) {
      this.style.background = "#fee2e2";
      this.style.borderColor = "#fecaca";
      this.style.color = "#dc2626";
      svg.style.fill = "#dc2626";
      // Update count
      const countSpan = this.childNodes[this.childNodes.length - 1];
      if (countSpan && countSpan.nodeType === 3) {
        const currentText = countSpan.textContent.trim();
        const num = parseFloat(currentText);
        if (!isNaN(num)) {
          const newNum = num + 0.1;
          countSpan.textContent = " " + (newNum >= 1 ? Math.floor(newNum) + "k" : newNum + "k");
        }
      }
    } else {
      this.style.background = "";
      this.style.borderColor = "";
      this.style.color = "";
      svg.style.fill = "";
    }
  });
});
