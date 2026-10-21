// 云裔 · Together AI — 页面交互
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

/* ===== 吞吐实时波动 ===== */
const numEl = document.querySelector(".hero__num");
let tps = 18402;

setInterval(() => {
  tps = Math.max(9000, tps + Math.round((Math.random() - 0.48) * 2400));
  numEl.textContent = tps.toLocaleString("en-US");
}, 2400);

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

/* ===== 模型 chip ===== */
const modelChips = document.querySelectorAll(".chips--model .chip");
modelChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    modelChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 部署端点（进度模拟）===== */
document.getElementById("deployBtn").addEventListener("click", () => {
  showToast("部署中：拉取权重 · 冷启动 2 个实例…");
  setTimeout(() => {
    showToast("端点已就绪 · https://api.yunyi.dev/v1");
  }, 2000);
});

/* ===== 试运行 ===== */
const promptInput = document.getElementById("promptInput");

document.getElementById("tryBtn").addEventListener("click", () => {
  if (!promptInput.value.trim()) {
    showToast("输入请求体后试运行");
    return;
  }
  showToast("200 OK · 412ms · 386 tokens · $0.0008");
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "chat";
  li.innerHTML = `
    <span class="feed-item__model m1">70b</span>
    <div class="feed-item__body">
      <span class="feed-item__name mono">POST /v1/chat/completions</span>
      <span class="feed-item__meta">试运行 · 412ms · 200</span>
    </div>
    <em class="feed-item__cost mono">$0.0008</em>`;
  document.querySelector(".feed__list").prepend(li);
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("tryBtn").click();
});

/* ===== 行点击 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast("请求详情已展开（Headers / Body / Trace）");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "部署") {
      document.getElementById("deployBtn").click();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
