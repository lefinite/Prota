// 拾光 · Pinterest — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ===== pin 保存 toggle（masonry 上的圆形按钮）===== */
document.querySelectorAll(".pin__save").forEach((save) => {
  save.addEventListener("click", () => {
    const on = save.classList.toggle("is-on");
    save.setAttribute("aria-pressed", String(on));
    save.setAttribute("aria-label", on ? "取消保存" : "保存灵感");
    showToast(on ? "已保存到「家装灵感」" : "已取消保存");
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

/* ===== 快速保存 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已保存，稍后整理进画板" : "已取消保存");
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = searchInput.value.trim();
  showToast(text ? `已搜索「${text}」，找到 48 个灵感` : "输入关键词，如：原木风书房");
});

/* ===== 创建画板：基于搜索词建板 ===== */
const feedList = document.getElementById("feedList");

document.getElementById("createBoardBtn").addEventListener("click", () => {
  const name = searchInput.value.trim() || "新的灵感画板";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "saved";
  li.innerHTML = `
    <span class="feed-item__thumb feed-item__thumb--knit" aria-hidden="true"></span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 <em class="tag tag--saved">已保存</em></span>
    </div>
    <button class="feed-item__star is-on" type="button" aria-label="快速保存" aria-pressed="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `画板「${name}」已创建`;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  searchInput.value = "";
  li.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  showToast(`画板「${name}」已创建`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "搜索") {
      searchInput.focus();
      showToast("搜点什么？输入后回车");
    } else if (name === "创建") {
      searchInput.focus();
      showToast("先搜索，再一键建画板");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
