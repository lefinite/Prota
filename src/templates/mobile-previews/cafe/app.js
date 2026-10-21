// 半窗咖啡 · Cafe — 页面交互
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

/* ===== 风味偏好 toggle（豆单风味标签）===== */
document.querySelectorAll(".note-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const on = chip.classList.toggle("is-on");
    chip.setAttribute("aria-pressed", String(on));
    showToast(on ? `已把「${chip.textContent}」加入风味偏好` : `已移除「${chip.textContent}」偏好`);
  });
});

/* ===== chip 筛选（消费记录）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chips .chip");

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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入我的最爱" : "已移出我的最爱");
  });
});

/* ===== 提前点单：写进记录顶部 ===== */
const orderInput = document.getElementById("orderInput");
const feedList = document.getElementById("feedList");

function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入我的最爱" : "已移出我的最爱");
  });
}

function placeOrder() {
  const note = (orderInput.value || "").trim();
  const name = note ? `定制拿铁 · ${note.slice(0, 8)}` : "本店手冲 · 今日豆";
  const price = (Math.random() * 18 + 22).toFixed(0);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "drink";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">☕</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 预计 8 分钟好 <em class="feed-item__chip">制作中</em></span>
    </div>
    <b class="feed-item__amount">-¥${price}</b>
    <button class="feed-item__star" type="button" aria-label="收藏这杯" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = name;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  orderInput.value = "";
  showToast("已下单 · 咖啡师开始制作");
}

document.getElementById("orderBtn").addEventListener("click", placeOrder);
orderInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") placeOrder();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("is-active") && tab.dataset.tab === "点单") {
      orderInput.focus();
      showToast("想喝什么？留言给咖啡师");
      return;
    }
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "点单") {
      orderInput.focus();
    } else if (name === "豆单") {
      document.querySelector(".bean-card").scrollIntoView({ behavior: "smooth" });
      showToast("本周 3 支豆，耶加是主打");
    } else if (name === "会员卡") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
      showToast("还差 2 杯，兑换任意饮品一杯");
    } else {
      showToast("下午好，今天是你到店的第 42 天");
    }
  });
});
