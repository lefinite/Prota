// 薄荷文档 · Mintlify — 页面交互
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

/* ===== chip 筛选 + 搜索联动 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");
const docSearch = document.getElementById("docSearch");
let activeFilter = "all";

function applyFilters() {
  const query = (docSearch.value || "").trim().toLowerCase();
  feedItems.forEach((item) => {
    const kindOk = activeFilter === "all" || item.dataset.kind === activeFilter;
    const text = item.textContent.toLowerCase();
    item.hidden = !(kindOk && (!query || text.includes(query)));
  });
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeFilter = chip.dataset.filter;
    applyFilters();
  });
});

docSearch.addEventListener("input", applyFilters);

/* ===== 收藏 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到书签" : "已移出书签");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 新建文档：以草稿身份置顶 ===== */
const newDocInput = document.getElementById("newDocInput");
const feedList = document.getElementById("feedList");
const starSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
  '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" /></svg>';

function createDoc() {
  const title = (newDocInput.value || "").trim();
  if (!title) {
    newDocInput.focus();
    showToast("先给文档起个标题");
    return;
  }

  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "draft";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">{ }</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">drafts/new.md · 刚刚</span>
    </div>
    <em class="doc-badge doc-badge--draft">DRAFT</em>
    <button class="feed-item__star" type="button" aria-label="收藏" aria-pressed="false">
      ${starSvg}
    </button>`;
  li.querySelector(".feed-item__name").textContent = title;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  feedItems.unshift(li);
  newDocInput.value = "";
  activeFilter = "all";
  docSearch.value = "";
  chips.forEach((c) => c.classList.toggle("is-active", c.dataset.filter === "all"));
  applyFilters();
  showToast("草稿已创建，评审通过后自动发布");
}

document.getElementById("createDocBtn").addEventListener("click", createDoc);
newDocInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createDoc();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "搜索") {
      docSearch.focus();
    } else if (name === "变更") {
      document.getElementById("changelogCard").scrollIntoView({ behavior: "smooth" });
    } else if (name === "新建") {
      newDocInput.focus();
      showToast("输入标题，回车即可建稿");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
