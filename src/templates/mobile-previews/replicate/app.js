// 模型工坊 · Replicate — 页面交互
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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 运行模拟：进度推进 + 队列插入 ===== */
const runBtn = document.getElementById("runBtn");
const runBar = document.getElementById("runBar");
const runElapsed = document.getElementById("runElapsed");
const heroId = document.getElementById("heroId");
const promptInput = document.getElementById("promptInput");
const feedList = document.getElementById("feedList");
let runTimer = null;
let elapsed = 42;

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderProgress(pct, secs) {
  runBar.style.setProperty("--w", pct + "%");
  runElapsed.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}

function appendRunRow(prompt) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "image";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🎨</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta"></span>
    </div>
    <em class="feed-item__badge" data-state="done">成功</em>
    <button class="feed-item__like" type="button" aria-label="收藏该模型" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = "flux-schnell";
  li.querySelector(".feed-item__meta").textContent = prompt;
  li.querySelector(".feed-item__like").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
}

function startRun() {
  if (runTimer) return;
  const prompt = (promptInput.value || "").trim() || "霓虹雨夜的东京街头, 35mm";
  let pct = 0;
  elapsed = 0;
  heroId.textContent = "run_" + Math.random().toString(36).slice(2, 8);
  runBtn.textContent = "运行中…";

  const finish = () => {
    clearInterval(runTimer);
    runTimer = null;
    renderProgress(100, elapsed);
    runBtn.textContent = "运行模型";
    appendRunRow(`${prompt.slice(0, 12)}… · 4s`);
    promptInput.value = "";
    showToast("运行完成 · 生成 1 张 · 耗时 00:58");
  };

  if (prefersReducedMotion) {
    elapsed = 58;
    finish();
    return;
  }
  runTimer = setInterval(() => {
    pct = Math.min(100, pct + 4);
    elapsed = Math.round((pct / 100) * 58);
    renderProgress(pct, elapsed);
    if (pct >= 100) finish();
  }, 60);
}

runBtn.addEventListener("click", startRun);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startRun();
});

/* ===== 复制命令 ===== */
document.getElementById("copyBtn").addEventListener("click", () => {
  showToast("curl 命令已复制到剪贴板");
});

/* ===== 模型点赞 toggle ===== */
document.querySelectorAll(".hot-card__like, .feed-item__like").forEach((like) => {
  like.addEventListener("click", () => {
    const on = like.classList.toggle("is-on");
    like.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏模型" : "已取消收藏");
  });
});

/* ===== chip 筛选运行 ===== */
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

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "运行") {
      promptInput.focus();
      showToast("输入提示词，回车即可运行");
    } else if (name === "API") {
      document.querySelector(".api-card").scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
