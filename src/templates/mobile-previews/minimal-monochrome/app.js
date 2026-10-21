// 拾字 · Minimal Monochrome — 页面交互
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

/* ===== 续读：进度条真实推进 ===== */
const heroProgress = document.getElementById("heroProgress");
const heroCard = document.querySelector(".hero-card");
let progress = 62;

function renderProgress() {
  heroProgress.style.setProperty("--w", `${progress}%`);
  heroCard.querySelector(".hero-card__pct").textContent = `${progress}%`;
  heroCard.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(progress));
  const left = Math.max(0, Math.round((18 * (100 - progress)) / 100));
  heroCard.querySelector(".hero-card__left").textContent = left === 0 ? "已完成" : `读完还需约 ${left} 分钟`;
}

document.getElementById("continueBtn").addEventListener("click", () => {
  progress = Math.min(100, progress + 9);
  renderProgress();
  showToast(progress === 100 ? "全文读完 · 已移入归档" : `已读到 ${progress}% · 继续保持`);
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__mark").forEach((mark) => {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到「产品设计」" : "已取消收藏");
  });
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

/* ===== 保存新文章 ===== */
const articleInput = document.getElementById("articleInput");
const feedList = document.getElementById("feedList");

function saveArticle() {
  const text = articleInput.value.trim();
  if (!text) {
    showToast("先粘贴一个链接或标题");
    articleInput.focus();
    return;
  }
  const title = text.startsWith("http") ? `网页文章 · ${text.slice(0, 14)}…` : text;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "unread";
  li.innerHTML = `
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">稍后读 · 刚刚保存<em class="state-chip">未读</em></span>
    </div>
    <button class="feed-item__mark" type="button" aria-label="收藏文章" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M7 3h10a1.5 1.5 0 0 1 1.5 1.5V21l-6.5-4-6.5 4V4.5A1.5 1.5 0 0 1 7 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = title;
  li.querySelector(".feed-item__mark").addEventListener("click", (e) => {
    const mark = e.currentTarget;
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  articleInput.value = "";
  showToast("已保存到清单");
}

document.getElementById("saveBtn").addEventListener("click", saveArticle);
articleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveArticle();
});

/* ===== 全部标为已读 ===== */
document.getElementById("readAllBtn").addEventListener("click", () => {
  let changed = 0;
  feedItems.forEach((item) => {
    if (item.dataset.kind === "unread") {
      item.dataset.kind = "read";
      changed += 1;
    }
    const chipEl = item.querySelector(".state-chip");
    if (chipEl) {
      chipEl.textContent = "已读";
      chipEl.classList.add("is-read");
    }
  });
  showToast(changed ? `已将 ${changed} 篇标为已读` : "清单本就全部已读");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "清单") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "添加") {
      articleInput.focus();
      showToast("粘贴链接或标题，回车保存");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
