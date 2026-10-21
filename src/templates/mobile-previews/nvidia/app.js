// 算力舱 GEARBAY · NVIDIA — 页面交互
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

/* ===== SM 利用率实时抖动（控制台氛围）===== */
const utilNum = document.getElementById("utilNum");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  setInterval(() => {
    const util = 94 + Math.floor(Math.random() * 6);
    utilNum.textContent = String(Math.min(util, 100));
  }, 2600);
}

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

/* ===== 关注任务 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    const name = star.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `已关注 ${name}，完成即推送` : `已取消关注 ${name}`);
  });
});

/* ===== 启动新任务：压入队列顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");
const launchBtn = document.getElementById("launchBtn");

function sanitizeName(raw) {
  return raw.replace(/[^0-9a-zA-Z_]/g, "_").slice(0, 24);
}

function launchTask() {
  const raw = quickInput.value.trim();
  if (!raw) {
    showToast("输入任务名称，如 llm_sft_v4");
    quickInput.focus();
    return;
  }
  const name = sanitizeName(raw);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "queue";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">≡</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">已提交 · 等待 GPU-2 分配 <em class="feed-item__chip feed-item__chip--queue">排队</em></span>
    </div>
    <b class="feed-item__amount">0%</b>
    <button class="feed-item__star" type="button" aria-label="关注任务" aria-pressed="false">
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
  feedItems.unshift(li);
  quickInput.value = "";
  showToast(`${name} 已提交，队列第 3 位`);
}

launchBtn.addEventListener("click", launchTask);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") launchTask();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "任务") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "新建") {
      quickInput.focus();
      showToast("输入任务名称后回车，即刻提交");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
