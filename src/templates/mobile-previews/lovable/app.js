// Lovable 工坊 · Warm Parchment — 页面交互
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

/* ===== 建议胶囊：点一下填进输入框 ===== */
const promptInput = document.getElementById("promptInput");

document.querySelectorAll(".pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    promptInput.value = pill.dataset.pill;
    promptInput.focus();
    showToast("点子已填入，可以直接改");
  });
});

/* ===== 生成应用：新项目入列 + 进度推进 ===== */
const feedList = document.getElementById("feedList");
const buildFill = document.getElementById("buildFill");
let buildProgress = 72;

function bumpBuild() {
  if (buildProgress >= 100) return;
  buildProgress = Math.min(100, buildProgress + 14);
  buildFill.style.setProperty("--w", `${buildProgress}%`);
}

function addProject(name) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "building";
  li.innerHTML = `
    <span class="feed-item__thumb" aria-hidden="true">✨</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 新项目 <em class="feed-item__chip" data-state="building">构建中</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏项目" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = name;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
}

function generate() {
  const text = (promptInput.value || "").trim();
  if (!text) {
    showToast("先描述一下想做的应用");
    promptInput.focus();
    return;
  }
  addProject(text.length > 14 ? `${text.slice(0, 14)}…` : text);
  promptInput.value = "";
  bumpBuild();
  showToast("开始构建 · 预计 40 秒出预览");
}

document.getElementById("generateBtn").addEventListener("click", generate);
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generate();
});

document.getElementById("newBtn").addEventListener("click", () => {
  addProject("未命名项目 · 从模板开始");
  bumpBuild();
  showToast("已从模板创建 · 去 AI 构建台描述细节");
});

/* ===== chip 筛选 ===== */
const feedItems = () => Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems().forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏 toggle ===== */
function bindStars() {
  document.querySelectorAll(".feed-item__star").forEach((star) => {
    if (star.dataset.bound) return;
    star.dataset.bound = "1";
    star.addEventListener("click", () => {
      const on = star.classList.toggle("is-on");
      star.setAttribute("aria-pressed", String(on));
      showToast(on ? "已收藏项目" : "已取消收藏");
    });
  });
}

bindStars();
const feedObserver = new MutationObserver(bindStars);
feedObserver.observe(feedList, { childList: true });

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      document.querySelector(".builder-card").scrollIntoView({ behavior: "smooth", block: "center" });
      promptInput.focus();
    } else if (name === "项目") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
