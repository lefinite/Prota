// 跳蚤 FLEA — 页面交互
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

/* ===== 想换 toggle（清单勾选 + 好物收藏）===== */
document.querySelectorAll(".wish__item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    showToast(on ? `已加入想换：${btn.textContent}` : `已移出想换：${btn.textContent}`);
  });
});

function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已想换 · 已通知摊主" : "已取消想换");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 发布好物：自增编号写入列表顶部 ===== */
const itemInput = document.getElementById("itemInput");
const publishBtn = document.getElementById("publishBtn");
const feedList = document.getElementById("feedList");
let listingNo = 42;

function publishItem() {
  const text = (itemInput.value || "").trim();
  if (!text) {
    showToast("先写下要出的物，如：理光 XR-10");
    itemInput.focus();
    return;
  }
  listingNo += 1;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "swap";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">${String(listingNo).padStart(3, "0")}</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚发布 · B-12 摊位 · 默认可换</span>
    </div>
    <b class="feed-item__price feed-item__price--swap">可换</b>
    <button class="feed-item__star" type="button" aria-label="想换这件" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  itemInput.value = "";
  showToast(`已发布 · No.${String(listingNo).padStart(3, "0")}`);
}

publishBtn.addEventListener("click", publishItem);
itemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") publishItem();
});

/* ===== 摊位进度：发布 / 续订联动 ===== */
const slotFill = document.getElementById("slotFill");
const slotText = document.getElementById("slotText");
let slotsTaken = 42;

function renderSlots() {
  slotFill.style.setProperty("--w", Math.round((slotsTaken / 60) * 100) + "%");
  slotText.textContent = `${slotsTaken} / 60 摊位已订`;
}

document.querySelectorAll(".duo-card__link").forEach((btn) => {
  btn.addEventListener("click", () => {
    slotsTaken = Math.min(60, slotsTaken + 1);
    renderSlots();
    if (slotsTaken >= 60) showToast("本周摊位已满 · 已加入候补");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    if (name === "发布") {
      itemInput.focus();
      showToast("发布好物：写完按回车");
      return;
    }
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    if (name === "好物") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "市集") {
      document.querySelector(".app-content").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "交换") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
      showToast("交换匹配中 · 已有 3 位摊主想换你的手冲壶");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
