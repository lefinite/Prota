// 模型广场 · Hugging Face 风 — 页面交互
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

/* ===== chip 筛选：按任务类别过滤模型流 ===== */
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

/* ===== 收藏 toggle（精选卡 + 模型流共用） ===== */
document.querySelectorAll(".model-hero__star, .feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏 🤗" : "已取消收藏");
  });
});

/* ===== 搜索：回车在模型流顶部插入一条结果 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function searchModel() {
  const text = quickInput.value.trim();
  if (!text) {
    showToast("输入模型名或任务关键词试试");
    quickInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "nlp";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🔍</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 搜索命中</span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const s = e.currentTarget;
    const on = s.classList.toggle("is-on");
    s.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  quickInput.value = "";
  showToast(`已固定搜索结果：${text}`);
}

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchModel();
});

/* ===== 上传模型 ===== */
const uploadBtn = document.getElementById("uploadBtn");
let uploadProgress = 0;

uploadBtn.addEventListener("click", () => {
  uploadProgress = 0;
  showToast("已创建空仓库，开始上传权重文件……");
  const timer = setInterval(() => {
    uploadProgress += 25;
    if (uploadProgress >= 100) {
      clearInterval(timer);
      showToast("上传完成 · orbit 系列又添一员 🤗");
    }
  }, 600);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "上传") {
      quickInput.focus();
      showToast("输入仓库名，或直接上传本地权重");
    } else if (name === "收藏") {
      showToast("收藏夹里有 3 个模型");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
