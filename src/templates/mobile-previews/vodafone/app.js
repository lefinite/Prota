// 寰联 · Vodafone — 页面交互
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

/* ===== 充话费 ===== */
document.getElementById("topupBtn").addEventListener("click", () => {
  showToast("已充值 ¥100 · 到账 92.50 元（渠道优惠）");
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

/* ===== 业务办理 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const name = item.querySelector(".feed-item__name").textContent;
    const cta = item.querySelector(".feed-item__cta").textContent;
    showToast(`${cta}：${name.split(" ·")[0]} · 短信确认后生效`);
  });
});

/* ===== 查询输入 ===== */
const queryInput = document.getElementById("queryInput");
const answers = {
  话费: "当前余额 ¥38.20 · 本月已消费 ¥96.40",
  流量: "剩余 42.6GB · 今日已用 0.8GB（5G）",
  发票: "电子发票将开具到 138****4821"
};

queryInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !queryInput.value.trim()) return;
  const q = queryInput.value.trim();
  const hit = Object.keys(answers).find((k) => q.includes(k));
  showToast(hit ? answers[hit] : `已转人工客服，为你查询「${q}」`);
  queryInput.value = "";
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "客服") {
      queryInput.focus();
      showToast("输入问题，智能客服 7×24 在线");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
