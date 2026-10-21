// 黑鸟训练 BLKBIRD · Nike — 页面交互
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

/* ===== 为训练叫好 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已叫好 · 干得漂亮" : "已取消叫好");
  });
});

/* ===== 开始跑步：主 CTA 变身计时器 ===== */
const runBtn = document.getElementById("runBtn");
let running = false;
let seconds = 0;
let runTimer = null;

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function stopRun() {
  running = false;
  clearInterval(runTimer);
  runBtn.textContent = "开始跑步";
  showToast(`本次计时 ${fmt(seconds)}，成绩已同步到本周跑量`);
}

runBtn.addEventListener("click", () => {
  if (running) {
    stopRun();
    return;
  }
  running = true;
  seconds = 0;
  runBtn.textContent = "暂停 00:00";
  showToast("开跑！黑鸟与你同场");
  runTimer = setInterval(() => {
    seconds += 1;
    runBtn.textContent = `暂停 ${fmt(seconds)}`;
  }, 1000);
});

/* ===== 今晚练什么 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  if (!text) {
    showToast("写下今晚的目标，出发更有劲");
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "done";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">📝</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 自定训练 <em class="feed-item__chip">已完成</em></span>
    </div>
    <b class="feed-item__amount">今日</b>
    <button class="feed-item__star" type="button" aria-label="为这条训练叫好" aria-pressed="false">
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
  showToast(`「${text}」已加入训练记录`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "开跑") {
      runBtn.focus();
      if (!running) runBtn.click();
    } else if (name === "训练") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
