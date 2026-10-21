// 喵语学堂 · Duolingo — 页面交互
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

/* ===== 技能树状态机：闯关解锁 ===== */
const LESSONS = [
  { label: "你好", done: true },
  { label: "谢谢", done: false },
  { label: "再见", done: false }
];
const XP_PER_LESSON = 15;
const GOAL = 80;

let currentLesson = LESSONS.findIndex((l) => !l.done); // 1
let xp = 50;

const tree = document.querySelector(".lesson-card__tree");
const xpFill = document.getElementById("xpFill");
const xpNum = document.getElementById("xpNum");
const xpBar = document.getElementById("xpBar");
const xpBadge = document.getElementById("xpBadge");

function renderTree() {
  tree.innerHTML = "";
  LESSONS.forEach((lesson, index) => {
    const el = document.createElement(index === currentLesson ? "button" : "div");
    el.className = "bubble";
    el.setAttribute("role", "listitem");

    const glyph =
      index < currentLesson
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>'
        : index === currentLesson
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M12 6.5V4" /></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="10.5" width="13" height="9" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>';

    el.innerHTML = `${glyph}<span class="bubble__label">${lesson.label}</span>`;

    if (index < currentLesson) {
      el.classList.add("is-done");
      el.setAttribute("aria-label", `第 ${index + 1} 课「${lesson.label}」已完成`);
    } else if (index === currentLesson) {
      el.classList.add("is-current");
      el.type = "button";
      el.setAttribute("aria-label", `第 ${index + 1} 课「${lesson.label}」，当前课程，点击闯关`);
      el.addEventListener("click", winLesson);
    } else {
      el.classList.add("is-locked");
      el.setAttribute("aria-label", `第 ${index + 1} 课「${lesson.label}」，未解锁`);
    }

    tree.appendChild(el);

    if (index < LESSONS.length - 1) {
      const link = document.createElement("i");
      link.className = "bubble-link";
      if (index < currentLesson) link.classList.add("is-done");
      link.setAttribute("aria-hidden", "true");
      tree.appendChild(link);
    }
  });
}

function renderXp() {
  const pct = Math.min(Math.round((xp / GOAL) * 100), 100);
  xpFill.style.setProperty("--w", `${pct}%`);
  xpNum.textContent = `${xp} / ${GOAL} XP`;
  xpBar.setAttribute("aria-valuenow", String(Math.min(xp, GOAL)));
  xpBadge.textContent = `${xp} XP`;
}

function winLesson() {
  if (currentLesson >= LESSONS.length) return;
  const lesson = LESSONS[currentLesson];
  lesson.done = true;
  currentLesson += 1;
  xp += XP_PER_LESSON;
  renderTree();
  renderXp();

  if (currentLesson >= LESSONS.length) {
    showToast("本章全部通关！喵！解锁下一单元");
  } else if (xp >= GOAL) {
    showToast(`「${lesson.label}」通关，每日目标达成！`);
  } else {
    showToast(`「${lesson.label}」通关，+${XP_PER_LESSON} XP`);
  }
}

renderTree();
renderXp();

document.getElementById("startBtn").addEventListener("click", () => {
  const bubble = tree.querySelector(".bubble.is-current");
  if (bubble) {
    bubble.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("点击绿色泡泡开始闯关");
  } else {
    showToast("本单元已全部通关，明天见！");
  }
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
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    const word = heart.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `「${word}」已收藏` : `「${word}」已取消收藏`);
  });
});

/* ===== 加进单词本 ===== */
const wordInput = document.getElementById("wordInput");
const feedList = document.getElementById("feedList");

function addWord() {
  const word = (wordInput.value || "").trim() || "いただきます";
  const first = [...word][0] || "喵";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "new";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true"></span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">我添加的 <em class="feed-item__chip" data-level="new">新词</em></span>
    </div>
    <button class="feed-item__heart" type="button" aria-label="收藏" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M12 21s-7.5-4.7-9.5-9C1 8.5 3 5 6.5 5c2 0 3.4 1 4.4 2.4h2.2C14.1 6 15.5 5 17.5 5 21 5 23 8.5 21.5 12c-2 4.3-9.5 9-9.5 9Z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__glyph").textContent = first;
  li.querySelector(".feed-item__name").textContent = word;
  const heart = li.querySelector(".feed-item__heart");
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  wordInput.value = "";
  showToast(`「${word}」已加进单词本`);
}

document.getElementById("addBtn").addEventListener("click", addWord);
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWord();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "闯关") {
      document.querySelector(".lesson-card").scrollIntoView({ behavior: "smooth" });
      showToast("今天的关卡就在上面");
    } else if (name === "单词") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
