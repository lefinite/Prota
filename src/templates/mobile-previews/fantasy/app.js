// 星陨旅人 · Fantasy — 页面交互
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

/* ===== 冒险推进：EXP 增长 → 升级 ===== */
const xpFill = document.getElementById("xpFill");
let xp = 62;

document.getElementById("adventureBtn").addEventListener("click", () => {
  xp = Math.min(100, xp + 9);
  xpFill.style.setProperty("--w", xp + "%");
  xpFill.parentElement.querySelector("b").textContent = "EXP " + xp + "%";
  if (xp >= 100) {
    showToast("✦ 升级！LV.27 → LV.28，获得技能点 ×2");
    xp = 8;
    setTimeout(() => {
      xpFill.style.setProperty("--w", xp + "%");
      xpFill.parentElement.querySelector("b").textContent = "EXP " + xp + "%";
    }, 900);
  } else {
    showToast(`冒险推进：获得 320 EXP（${xp}%）`);
  }
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

/* ===== 委托接取 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const name = item.querySelector(".feed-item__name").textContent;
    const badge = item.querySelector(".quest");
    if (badge && !badge.classList.contains("quest--main")) {
      badge.className = "quest quest--main";
      badge.textContent = "已接取";
      showToast(`已接取委托「${name}」，罗盘已更新`);
    }
  });
});

/* ===== 队伍 chip ===== */
const partyChips = document.querySelectorAll(".chips--party .chip");
partyChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.textContent.includes("招募")) return;
    partyChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.dataset.tab}」`);
  });
});
