// 时序 Cal · Cal.com — 页面交互
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

/* ===== chip 筛选（预约类型）===== */
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

/* ===== 置顶 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶到列表最前" : "已取消置顶");
  });
});

/* ===== 新建预约：写进列表顶部 ===== */
const linkInput = document.getElementById("linkInput");
const feedList = document.getElementById("feedList");

function createBooking() {
  const raw = (linkInput.value || "").trim();
  const name = raw && !/^cal\.link/i.test(raw) ? raw : "临时预约";
  const durations = ["15m", "30m", "45m"];
  const len = durations[Math.floor(Math.random() * durations.length)];
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "video";
  li.innerHTML = `
    <span class="feed-item__avatar" aria-hidden="true">新</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">待定时间 · 视频 <em class="feed-item__chip">待确认</em></span>
    </div>
    <b class="feed-item__len">${len}</b>
    <button class="feed-item__star" type="button" aria-label="置顶此预约" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = name;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶到列表最前" : "已取消置顶");
  });
  feedList.prepend(li);
  linkInput.value = "";
  showToast("预约已创建 · 等待对方选时间");
}

document.getElementById("createBtn").addEventListener("click", createBooking);
linkInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createBooking();
});

/* ===== 底部 Tab ===== */
const appContent = document.getElementById("appContent");
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "今日") {
      appContent.scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "日程") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "新建") {
      linkInput.focus();
      showToast("输入预约名，回车即创建");
    } else if (name === "空闲") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
      showToast("空闲时段已保护 · 勿扰开启");
    } else {
      showToast("我的 · 3 个日历已连接");
    }
  });
});
