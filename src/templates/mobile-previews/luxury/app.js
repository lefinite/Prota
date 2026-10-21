// NOIR 私人沙龙 · Black Lacquer & Champagne — 页面交互
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
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2000);
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入私享收藏" : "已移出收藏");
  });
});

/* ===== 管家留言：写进日程顶部（待确认） ===== */
const conciergeInput = document.getElementById("conciergeInput");
const feedList = document.getElementById("feedList");

function sendNote() {
  const text = (conciergeInput.value || "").trim();
  if (!text) {
    showToast("请先写下您的需求");
    conciergeInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "pending";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">笺</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 管家确认中 <em class="feed-item__chip" data-state="pending">待确认</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏日程" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  conciergeInput.value = "";
  showToast("留言已送达管家 · 1 小时内回复");
}

conciergeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendNote();
});

/* ===== 预约私人顾问：新增一条已预约 ===== */
document.getElementById("bookBtn").addEventListener("click", () => {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "booked";
  const slot = ["明晚 19:00", "周六 10:30", "下周二 15:00"][Math.floor(Math.random() * 3)];
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">谈</span>
    <div class="feed-item__body">
      <span class="feed-item__name">私人顾问面谈 · 静安沙龙</span>
      <span class="feed-item__meta">${slot} · 60 分钟 <em class="feed-item__chip" data-state="booked">已预约</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏日程" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  li.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast(`已预约 ${slot} · 顾问将提前致电`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "预约") {
      document.getElementById("bookBtn").click();
    } else if (name === "系列") {
      document.querySelector(".collection-card").scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
