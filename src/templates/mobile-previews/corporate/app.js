// 核签 · Corporate — 页面交互
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

/* ===== 盖章 toggle ===== */
function bindSeal(seal) {
  seal.addEventListener("click", () => {
    const on = seal.classList.toggle("is-on");
    seal.setAttribute("aria-pressed", String(on));
    showToast(on ? "已盖章 · 申请人已收到通知" : "已撤销盖章");
  });
}

document.querySelectorAll(".seal").forEach(bindSeal);

/* ===== 批准并盖章：把当前 Hero 单据写入待签列表顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");
const feedTitleCount = document.querySelector(".feed__title b");
let signedCount = 0;

function approveDoc() {
  const note = (quickInput.value || "").trim();
  signedCount += 1;

  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "purchase";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">华</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · ${note ? "意见：" + note : "无附加意见"} <em class="feed-item__chip" data-level="ok">已签</em></span>
    </div>
    <b class="feed-item__amount">86,400</b>
    <button class="seal is-on" type="button" aria-label="盖章签批" aria-pressed="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.2 12.4l2.6 2.6 5-5.6" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = "华东区 · Q4 差旅预算追加";
  bindSeal(li.querySelector(".seal"));
  feedList.prepend(li);
  quickInput.value = "";

  if (feedTitleCount) {
    feedTitleCount.textContent = Math.max(0, 6 - signedCount);
  }
  showToast("已批准盖章 · 意见已同步给发起人");
}

document.getElementById("approveBtn").addEventListener("click", approveDoc);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") approveDoc();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "待签") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "发起") {
      quickInput.focus();
      showToast("填写意见后回车，即刻签发");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
