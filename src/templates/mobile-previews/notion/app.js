// 一页 · Notion — 页面交互
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

/* ===== 今日笔记：勾选待办（签名交互）===== */
const todos = Array.from(document.querySelectorAll("[data-todo]"));
const todoLeft = document.getElementById("todoLeft");

function renderTodoCount() {
  const left = todos.filter((t) => t.getAttribute("aria-checked") !== "true").length;
  todoLeft.textContent = String(left);
  if (left === 0) showToast("今日待办清零，去晒个太阳吧");
}

todos.forEach((todo) => {
  todo.addEventListener("click", () => {
    const checked = todo.getAttribute("aria-checked") === "true";
    todo.setAttribute("aria-checked", String(!checked));
    renderTodoCount();
  });
});

renderTodoCount();

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

/* ===== 加入快速访问 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入快速访问" : "已从快速访问移除");
  });
});

/* ===== 新建页面：插入最近列表顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function createPage() {
  const text = (quickInput.value || "").trim();
  if (!text) {
    showToast("先给页面起个标题");
    quickInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "doing";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">📄</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 个人空间 <em class="feed-item__chip feed-item__chip--doing">进行中</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="加入快速访问" aria-pressed="false">
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
  feedItems.unshift(li);
  quickInput.value = "";
  showToast(`「${text}」已创建，输入 / 可插入模块`);
}

document.getElementById("newPageBtn").addEventListener("click", createPage);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createPage();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      quickInput.focus();
      showToast("新页面已就绪，输入标题后回车");
    } else if (name === "搜索") {
      document.querySelector(".brand-bar__icon").focus();
      showToast("搜索：试试输入「周报」或 @小林");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
