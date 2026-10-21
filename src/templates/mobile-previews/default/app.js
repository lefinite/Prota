// 简记 · Neutral Modern — 页面交互
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

/* ===== 收藏 / 核对 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已标记核对" : "已取消核对");
  });
});

/* ===== 记一笔：把快捷输入写进明细顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function logQuickNote() {
  const text = (quickInput.value || "").trim() || "快捷记一笔";
  const amount = (Math.random() * 60 + 8).toFixed(2);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "expense";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">✏️</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 快捷记录</span>
    </div>
    <b class="feed-item__amount">-${amount}</b>
    <button class="feed-item__star" type="button" aria-label="标记已核对" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
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
  quickInput.value = "";
  showToast("已记一笔 · 待分类");
}

document.getElementById("logBtn").addEventListener("click", logQuickNote);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logQuickNote();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "明细") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "记账") {
      quickInput.focus();
      showToast("输入后回车，即刻记一笔");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
