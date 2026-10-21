// 幕间 · Dramatic — 页面交互
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

/* ===== 开演倒计时 ===== */
const showClock = document.getElementById("showClock");
let secondsLeft = 2 * 3600 + 14 * 60 + 36;

setInterval(() => {
  if (secondsLeft <= 0) return;
  secondsLeft -= 1;
  const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  showClock.textContent = `${h}:${m}:${s}`;
  if (secondsLeft === 0) {
    showToast("演出开始，请入座");
  }
}, 1000);

/* ===== 票档选择 ===== */
const seatRows = document.querySelectorAll(".seat-row");
const buyBtn = document.getElementById("buyBtn");
let selectedSeat = null;

function selectSeat(row) {
  seatRows.forEach((r) => {
    r.classList.remove("is-on");
    r.setAttribute("aria-pressed", "false");
  });
  row.classList.add("is-on");
  row.setAttribute("aria-pressed", "true");
  selectedSeat = `${row.dataset.seat} · ${row.dataset.price} 元`;
  buyBtn.textContent = "立即购票";
  buyBtn.classList.remove("is-locked");
  showToast(`已选 ${row.dataset.seat} · ¥${row.dataset.price}`);
}

seatRows.forEach((row) => {
  row.addEventListener("click", () => selectSeat(row));
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectSeat(row);
    }
  });
});

/* ===== 立即购票 ===== */
buyBtn.addEventListener("click", () => {
  if (!selectedSeat) {
    showToast("先在「余票」里选一个票档");
    document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const locked = buyBtn.classList.toggle("is-locked");
  if (locked) {
    buyBtn.textContent = "已锁定 · 去支付";
    showToast(`已锁定 ${selectedSeat}，15 分钟内有效`);
  } else {
    buyBtn.textContent = "立即购票";
    showToast("已释放锁座，可重新选择");
  }
});

/* ===== 加入候补 ===== */
const waitBtn = document.getElementById("waitBtn");

waitBtn.addEventListener("click", () => {
  const on = waitBtn.classList.toggle("is-on");
  waitBtn.setAttribute("aria-pressed", String(on));
  waitBtn.textContent = on ? "已在候补" : "加入候补";
  showToast(on ? "已加入候补名单" : "已退出候补名单");
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

/* ===== 想看 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    const name = heart.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `已把「${name}」加入想看` : `已从想看移除「${name}」`);
  });
});

/* ===== 搜索：回车给一个明确反馈 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = (searchInput.value || "").trim();
    if (!q) {
      showToast("输入剧目、剧团或剧场名");
      return;
    }
    showToast(`正在找「${q}」相关的演出……`);
    searchInput.blur();
  }
});

/* ===== 锁定今晚的票 ===== */
document.getElementById("lockBtn").addEventListener("click", () => {
  if (selectedSeat) {
    buyBtn.click();
  } else {
    buyBtn.click(); // 复用购票流程：未选票档会引导去选
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "剧目") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "购票") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else if (name === "灯光") {
      document.querySelector(".spotlight-card").scrollIntoView({ behavior: "smooth" });
      showToast("开演前 30 分钟会提醒入场");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
