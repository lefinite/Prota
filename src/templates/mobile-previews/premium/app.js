// 藏阁 · Premium — 页面交互
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

/* ===== 结拍倒计时 ===== */
const countdownEl = document.getElementById("lotCountdown");
let lotSeconds = 4 * 3600 + 12 * 60 + 36;

function renderCountdown() {
  if (!countdownEl) return;
  const h = String(Math.floor(lotSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((lotSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(lotSeconds % 60).padStart(2, "0");
  countdownEl.textContent = `距结拍 ${h}:${m}:${s}`;
}

renderCountdown();
setInterval(() => {
  if (lotSeconds > 0) {
    lotSeconds -= 1;
    renderCountdown();
  }
}, 1000);

/* ===== chip 筛选（关注 = 收藏态）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      const match =
        filter === "all"
          ? true
          : filter === "star"
            ? item.classList.contains("is-starred")
            : item.dataset.kind === filter;
      item.hidden = !match;
    });
  });
});

/* ===== 关注拍品 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const item = star.closest(".feed-item");
    const on = star.classList.toggle("is-on");
    item.classList.toggle("is-starred", on);
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注，出价变动会提醒你" : "已取消关注");
  });
});

/* ===== 立即出价：校验并抬高当前价 ===== */
let currentBidValue = 2150000;
const currentBidEl = document.getElementById("currentBid");
const bidInput = document.getElementById("bidInput");

function placeBid() {
  const amount = Number(bidInput.value.replace(/[^\d]/g, ""));
  if (!amount) {
    showToast("请输入出价金额，如 2,200,000");
    bidInput.focus();
    return;
  }
  if (amount <= currentBidValue) {
    showToast(`出价需高于当前 ¥${currentBidValue.toLocaleString("zh-CN")}`);
    return;
  }
  currentBidValue = amount;
  currentBidEl.textContent = "¥ " + amount.toLocaleString("zh-CN");
  bidInput.value = "";
  showToast("出价已提交 · 当前领先");
}

document.getElementById("bidBtn").addEventListener("click", placeBid);
bidInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") placeBid();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "拍场") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "图录") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "委托") {
      bidInput.focus();
      showToast("输入意向估价，顾问会跟进");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
