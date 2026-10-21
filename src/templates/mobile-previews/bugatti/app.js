// EB 遥测车库 · Bugatti — 页面交互
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

/* ===== chip 筛选（记录类型）===== */
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

/* ===== 行程收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏该行程" : "已取消收藏");
  });
});

/* ===== 开始行程：写入记录顶部 ===== */
const tripInput = document.getElementById("tripInput");
const feedList = document.getElementById("feedList");

function startTrip() {
  const name = (tripInput.value || "").trim() || "夜巡 Mulhouse";
  const km = (Math.random() * 40 + 18).toFixed(1);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "road";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">GO</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 遥测记录中 <em class="feed-item__chip">LIVE</em></span>
    </div>
    <b class="feed-item__value">${km} KM</b>
    <button class="feed-item__star" type="button" aria-label="收藏此行程" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = name;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏该行程" : "已取消收藏");
  });
  feedList.prepend(li);
  tripInput.value = "";
  showToast("遥测已开始 · 正在记录");
}

document.getElementById("startBtn").addEventListener("click", startTrip);
tripInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startTrip();
});

/* ===== 底部 Tab ===== */
const appContent = document.getElementById("appContent");
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "车库") {
      appContent.scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "行程") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "遥测") {
      document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
      showToast("W16 遥测 · 14 通道已连接");
    } else {
      showToast("EB 俱乐部 · Molsheim 车主之夜 10 月 24 日");
    }
  });
});
