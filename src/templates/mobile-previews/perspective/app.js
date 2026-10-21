// 叠境 · Perspective — 页面交互
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

/* ===== 通用：data-toast 按钮（含等轴测房间）===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 楼栋/户型切换：联动 Hero 三项数据 ===== */
const floors = {
  A2: { name: "A2 户", area: "74", rate: "79", price: "518", note: "A2 户 · 74㎡ · 总价 ¥518万" },
  B3: { name: "B3 户", area: "89", rate: "81", price: "612", note: "B3 户 · 89㎡ · 总价 ¥612万" },
  C1: { name: "C1 户", area: "118", rate: "83", price: "805", note: "C1 户 · 118㎡ · 总价 ¥805万" }
};

const floorChips = document.querySelectorAll(".floor-chip");
const unitTitle = document.querySelector(".space-hero__title");

floorChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    floorChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const data = floors[chip.dataset.floor];
    if (!data) return;
    if (unitTitle) unitTitle.textContent = `3 层 · ${data.name}`;
    document.getElementById("statArea").textContent = data.area;
    document.getElementById("statRate").textContent = data.rate;
    document.getElementById("statPrice").textContent = data.price;
    showToast(data.note);
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

/* ===== 收藏房源 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "房源已收藏，可在对比中查看" : "已取消收藏");
  });
});

/* ===== 预约带看：写进行程顶部 ===== */
const memoInput = document.getElementById("memoInput");
const feedList = document.getElementById("feedList");

function bookVisit() {
  const memo = (memoInput.value || "").trim() || "重点看采光";
  const now = new Date();
  const time = `${String(now.getHours() + 1).padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "today";
  li.innerHTML = `
    <span class="feed-item__time"></span>
    <div class="feed-item__body">
      <span class="feed-item__name">云澜公寓 · B3 户</span>
      <span class="feed-item__meta">陈经纪 · 备注 <em class="tag tag--live">已预约</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏房源" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__time").textContent = time;
  li.querySelector(".feed-item__meta").firstChild.textContent = `陈经纪 · ${memo} `;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  memoInput.value = "";
  li.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  showToast("已预约 · 已通知陈经纪");
}

document.getElementById("bookBtn").addEventListener("click", bookVisit);
memoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") bookVisit();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "带看") {
      document.querySelector(".feed").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    } else if (name === "新增带看") {
      memoInput.focus();
      showToast("写下备注，一键预约带看");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
