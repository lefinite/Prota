// Priceless 钱包 · Editorial Cream — 页面交互
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

/* ===== chip 筛选 ===== */
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

/* ===== 收藏商户 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏商户 · 优惠优先提醒" : "已取消收藏");
  });
});

/* ===== 立即支付：金额入账 + 额度推进 ===== */
const payInput = document.getElementById("payInput");
const payBtn = document.getElementById("payBtn");
const spendFill = document.querySelector(".spend-card__fill");
const spendLimitLabel = document.querySelector(".spend-card__limit-label");
let monthlyUsed = 6420;
const monthlyCap = 20000;

payBtn.addEventListener("click", () => {
  const raw = (payInput.value || "").trim();
  const amount = Number.parseFloat(raw);
  if (!raw) {
    showToast("先输入支付金额");
    payInput.focus();
    return;
  }
  if (Number.isNaN(amount) || amount <= 0) {
    showToast("金额格式不对，如：128.00");
    return;
  }
  monthlyUsed += amount;
  const ratio = Math.min(100, (monthlyUsed / monthlyCap) * 100);
  spendFill.style.setProperty("--w", `${ratio}%`);
  spendLimitLabel.textContent = `¥${monthlyUsed.toLocaleString("zh-CN")} / ¥20,000`;
  payInput.value = "";
  showToast(`支付请求已发送 · ¥${amount.toFixed(2)} · 验证码 8829`);
});

payInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") payBtn.click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "支付") {
      document.querySelector(".action-area").scrollIntoView({ behavior: "smooth", block: "center" });
      payInput.focus();
    } else if (name === "优惠") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("2 条 Priceless 优惠可用");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
