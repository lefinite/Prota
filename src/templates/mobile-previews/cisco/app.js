// 网枢 NOC · Cisco — 页面交互
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

/* ===== chip 筛选（事件状态）===== */
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

/* ===== 认领 toggle ===== */
document.querySelectorAll(".feed-item__claim").forEach((claim) => {
  claim.addEventListener("click", () => {
    const on = claim.classList.toggle("is-on");
    claim.setAttribute("aria-pressed", String(on));
    claim.textContent = on ? "已认领" : "认领";
    showToast(on ? "事件已认领 · 指派给你" : "已取消认领，回到待处理");
  });
});

/* ===== 部署变更：受控进度反馈 ===== */
const deployBtn = document.getElementById("deployBtn");
let deploying = false;

deployBtn.addEventListener("click", () => {
  if (deploying) return;
  deploying = true;
  const original = deployBtn.textContent;
  deployBtn.textContent = "排队中…";
  deployBtn.setAttribute("aria-busy", "true");
  setTimeout(() => {
    deployBtn.textContent = original;
    deployBtn.removeAttribute("aria-busy");
    deploying = false;
    showToast("变更单 #4172 已排队 · 等待二级审批");
  }, 900);
});

/* ===== 搜索：回车给出行内反馈 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = searchInput.value.trim();
    showToast(q ? `正在检索「${q}」· 命中 3 条事件` : "输入节点名、IP 或事件编号");
  }
});

/* ===== 底部 Tab ===== */
const appContent = document.getElementById("appContent");
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "总览") {
      appContent.scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "拓扑") {
      showToast("拓扑视图 · 42 节点 / 6 条骨干链路");
    } else if (name === "告警") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
      showToast("2 条活动告警 · 1 条升级待处理");
    } else {
      showToast("值班中 · 你是今夜 NOC 一线，02:00 交接");
    }
  });
});
