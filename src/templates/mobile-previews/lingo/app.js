// Lingo 星球 · Playful Violet — 页面交互
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏词卡" : "已取消收藏");
  });
});

/* ===== 继续课程：推进连击卡进度 ===== */
const lessonBtn = document.getElementById("lessonBtn");
const streakCount = document.getElementById("streakCount");
const streakFill = document.getElementById("streakFill");
const streakDone = document.getElementById("streakDone");
const streakLeft = document.getElementById("streakLeft");
let doneLessons = 3;
const goalLessons = 5;
let streakDays = 42;

function renderProgress() {
  streakDone.textContent = doneLessons;
  streakFill.style.setProperty("--w", `${(doneLessons / goalLessons) * 100}%`);
  const left = goalLessons - doneLessons;
  streakLeft.textContent =
    left > 0 ? `还差 ${left} 课保住连击 · 约 ${left * 6} 分钟` : "今日目标达成，连击保住了！";
}

lessonBtn.addEventListener("click", () => {
  if (doneLessons >= goalLessons) {
    showToast("今日 5 课已全部完成，明天再来");
    return;
  }
  doneLessons += 1;
  renderProgress();
  if (doneLessons === goalLessons) {
    streakDays += 1;
    streakCount.textContent = streakDays;
    showToast(`今日 5/5 完成 · 连击 ${streakDays} 天 🔥`);
  } else {
    showToast(`完成 1 课 · 今日 ${doneLessons}/${goalLessons}`);
  }
});

/* ===== 添加生词：写进词卡顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function addWord() {
  const text = (quickInput.value || "").trim();
  if (!text) {
    showToast("先输入一个词，如：la lune");
    quickInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "new";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">✏️</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 我的生词 <em class="feed-item__chip" data-state="new">新词</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏单词" aria-pressed="false">
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
  showToast("生词已入星球 · 明天复习");
}

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWord();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "词卡") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "学习") {
      lessonBtn.click();
      lessonBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
