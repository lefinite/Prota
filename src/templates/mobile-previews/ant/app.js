// 蚁巢 · Ant 企业协同 — 页面交互
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

/* ===== 审批：通过 / 驳回 ===== */
const steps = document.querySelectorAll(".steps li");
const heroTitle = document.querySelector(".hero__title");
const kpiNum = document.querySelector(".kpi__num.is-accent");

document.getElementById("approveBtn").addEventListener("click", () => {
  const current = document.querySelector(".steps li.is-current");
  if (current) {
    current.classList.remove("is-current");
    current.classList.add("is-done");
    const next = current.nextElementSibling;
    if (next) {
      next.classList.add("is-current");
      showToast(`「${heroTitle.textContent}」已流转至：${next.querySelector("span").textContent}`);
    } else {
      showToast("流程已完结，单据归档");
    }
  } else {
    showToast("当前无待办步骤");
  }
});

document.getElementById("rejectBtn").addEventListener("click", () => {
  showToast(`已驳回「${heroTitle.textContent}」，抄送申请人`);
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

/* ===== 行点击：标记已处理 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const badge = item.querySelector(".badge");
    if (badge && !badge.classList.contains("badge--success")) {
      badge.className = "badge badge--success";
      badge.textContent = "已通过";
      const n = parseInt(kpiNum.textContent, 10);
      kpiNum.textContent = Math.max(0, n - 1);
      showToast("已处理，待办 -1");
    }
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  feedItems.forEach((item) => {
    const text = item.textContent;
    item.hidden = q && !text.includes(q);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.dataset.tab}」`);
  });
});
