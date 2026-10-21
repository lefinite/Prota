// 灵感市集 · Creative — 页面交互
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏 · 上新第一时间叫你" : "已移出收藏");
  });
});

/* ===== 新品提醒开关 ===== */
const remindToggle = document.getElementById("remindToggle");

remindToggle.addEventListener("click", () => {
  const on = remindToggle.classList.toggle("is-on");
  remindToggle.setAttribute("aria-checked", String(on));
  showToast(on ? "新品提醒已开启" : "新品提醒已关闭");
});

/* ===== 换一批：随机打乱上新顺序 ===== */
const feedList = document.getElementById("feedList");
const shuffleBtn = document.getElementById("shuffleBtn");

shuffleBtn.addEventListener("click", () => {
  const rows = Array.from(feedList.children);
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    feedList.appendChild(rows[j]);
    rows.splice(j, 1);
  }
  showToast("已为你换一批上新好物");
});

/* ===== 搜索：关键词高亮匹配 ===== */
const quickInput = document.getElementById("quickInput");

function searchStalls() {
  const keyword = (quickInput.value || "").trim();
  if (!keyword) {
    feedItems.forEach((item) => (item.hidden = false));
    return;
  }
  let hits = 0;
  feedItems.forEach((item) => {
    const name = item.querySelector(".feed-item__name").textContent;
    const meta = item.querySelector(".feed-item__meta").textContent;
    const hit = name.includes(keyword) || meta.includes(keyword);
    item.hidden = !hit;
    if (hit) hits++;
  });
  showToast(`「${keyword}」找到 ${hits} 件好物`);
}

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchStalls();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "市集") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "出摊") {
      quickInput.focus();
      showToast("填好摊位名与品类，即可申请出摊");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
