// 图纸间 · Mono Blueprint — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 图元选择 ===== */
const elements = document.querySelectorAll(".hero__element");
let selected = null;

elements.forEach((el) => {
  el.addEventListener("click", () => {
    elements.forEach((e) => e.classList.remove("is-sel"));
    el.classList.add("is-sel");
    selected = el;
    showToast(`已选中：${el.dataset.name}`);
  });
});

/* ===== 缩放（双击视口循环）===== */
const viewport = document.querySelector(".hero__viewport");
const zoomLabel = document.getElementById("zoomLabel");
const zooms = [100, 150, 200, 50];
let zi = 0;

viewport.addEventListener("dblclick", () => {
  zi = (zi + 1) % zooms.length;
  zoomLabel.textContent = `ZOOM ${zooms[zi]}%`;
  showToast(`视图缩放至 ${zooms[zi]}%`);
});

/* ===== 工具 chip ===== */
const toolChips = document.querySelectorAll(".chips--tool .chip");
toolChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    toolChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 批注闭合 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const state = item.querySelector(".feed-item__state");
    const pin = item.querySelector(".feed-item__pin");
    if (state.classList.contains("feed-item__state--open")) {
      state.classList.remove("feed-item__state--open");
      state.textContent = "已闭合";
      pin.classList.add("feed-item__pin--done");
      item.dataset.kind = "ok";
      showToast("批注已闭合，同步给设计院");
    }
  });
});

/* ===== 放置批注 ===== */
const markInput = document.getElementById("markInput");
const feedList = document.querySelector(".feed__list");
let markCount = 5;

document.getElementById("markBtn").addEventListener("click", () => {
  const text = (markInput.value || "").trim() || "现场复核";
  if (!selected) {
    showToast("请先在图上点选一个图元");
    return;
  }
  markCount += 1;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "open";
  li.innerHTML = `
    <span class="feed-item__pin" aria-hidden="true">M${markCount}</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">你 · 刚刚 · ${selected.dataset.name}</span>
    </div>
    <em class="feed-item__state feed-item__state--open">待处理</em>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.addEventListener("click", () => {
    const s = li.querySelector(".feed-item__state");
    if (s.classList.contains("feed-item__state--open")) {
      s.classList.remove("feed-item__state--open");
      s.textContent = "已闭合";
      li.dataset.kind = "ok";
    }
  });
  feedList.prepend(li);
  markInput.value = "";
  showToast(`批注 M${markCount} 已放置在 ${selected.dataset.name}`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "测量") {
      showToast("点选两点测量距离，双击视口缩放");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
