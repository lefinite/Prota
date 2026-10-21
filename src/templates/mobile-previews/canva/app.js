// 织图 · Canva — 页面交互
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

/* ===== 通用：data-toast 按钮（含设计 tiles 与模板入口）===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== chip 筛选（项目分类）===== */
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
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到「我的精选」" : "已取消收藏");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 创建设计：写进项目列表顶部 ===== */
const nameInput = document.getElementById("nameInput");
const feedList = document.getElementById("feedList");
const thumbClasses = [
  "feed-item__thumb--lavender",
  "feed-item__thumb--coral",
  "feed-item__thumb--sky",
  "feed-item__thumb--mint",
  "feed-item__thumb--tangerine"
];
let thumbIndex = 0;

function createDesign() {
  const name = (nameInput.value || "").trim() || "未命名设计";
  const thumbClass = thumbClasses[thumbIndex % thumbClasses.length];
  thumbIndex += 1;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "personal";
  li.innerHTML = `
    <span class="feed-item__thumb ${thumbClass}" aria-hidden="true">✦</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 1080×1350</span>
    </div>
    <b class="feed-item__state">草稿</b>
    <button class="feed-item__star" type="button" aria-label="收藏项目" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = name;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  nameInput.value = "";
  showToast(`已创建「${name}」· 打开编辑器`);
}

document.getElementById("createBtn").addEventListener("click", createDesign);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createDesign();
});

/* ===== 底部 Tab ===== */
const appContent = document.getElementById("appContent");
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "首页") {
      appContent.scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "创建") {
      nameInput.focus();
      createDesign();
    } else if (name === "项目") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
      showToast("12 个项目 · 3 个协作中");
    } else if (name === "模板") {
      showToast("模板库 · 本周上新 320 套");
    } else {
      showToast("团队 · 3 位成员，2 个品牌套件");
    }
  });
});
