// 酸厂 · Neobrutalism — 页面交互
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

/* ===== 抢票 ===== */
let stock = 8;
const grabBtn = document.getElementById("grabBtn");

grabBtn.addEventListener("click", () => {
  if (stock <= 0) {
    grabBtn.textContent = "售 罄";
    showToast("本场已售罄，已帮你蹲回流票");
    return;
  }
  stock -= 1;
  showToast(`抢到了！¥180 × 1 · 余票 ${stock} 张`);
  if (stock === 0) {
    grabBtn.textContent = "售 罄";
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

/* ===== 城市切换 ===== */
const cityChips = document.querySelectorAll(".chips--city .chip");
cityChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    cityChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`已切换到 ${chip.textContent} · ${5 + Math.floor(Math.random() * 12)} 场在售`);
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 行点击：想看 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`已把「${item.querySelector(".feed-item__name").textContent}」加入想看`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "扫码") {
      showToast("对准检票口的二维码即可核销");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
