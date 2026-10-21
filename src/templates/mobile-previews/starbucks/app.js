// 咖啡驿站 · Starbucks — 页面交互
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

/* ===== 点单：加入 / 移出订单 ===== */
const addBtns = document.querySelectorAll(".feed-item__add");
const checkoutBtn = document.getElementById("checkoutBtn");
const frapBadge = document.getElementById("frapBadge");
const frapBtn = document.getElementById("frapBtn");

let total = 0;
let count = 0;

function renderOrder() {
  checkoutBtn.textContent = count > 0 ? `去结算 · ¥${total}` : "去结算 · ¥0";
  frapBadge.hidden = count === 0;
  frapBadge.textContent = String(count);
}

addBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const row = btn.closest(".feed-item");
    const price = Number(row.dataset.price);
    const name = row.querySelector(".feed-item__name").textContent;
    const added = btn.classList.toggle("is-added");
    btn.setAttribute("aria-pressed", String(added));
    btn.setAttribute("aria-label", added ? `把${name}移出订单` : `把${name}加入订单`);
    if (added) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10" /></svg>';
      total += price;
      count += 1;
      showToast(`${name} 已加入订单 · ¥${price}`);
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>';
      total = Math.max(0, total - price);
      count = Math.max(0, count - 1);
      showToast(`${name} 已移出订单`);
    }
    renderOrder();
  });
});

renderOrder();

/* ===== 结算 / Frap 快捷下单 ===== */
checkoutBtn.addEventListener("click", () => {
  if (count === 0) {
    showToast("先从「为你常点」里挑一杯吧");
    return;
  }
  showToast(`订单已提交：${count} 件 · ¥${total}，预计 8 分钟取餐`);
});

frapBtn.addEventListener("click", () => {
  if (count === 0) {
    showToast("Frap 快捷单：从常点里选一杯，一按就下单");
    return;
  }
  showToast(`快捷单已提交：${count} 件 · ¥${total}，星星 +${count * 25}`);
});

/* ===== 杯型选择 ===== */
const sizes = document.querySelectorAll(".size");

sizes.forEach((size) => {
  size.addEventListener("click", () => {
    sizes.forEach((s) => s.classList.remove("is-active"));
    size.classList.add("is-active");
    showToast(`已选${size.dataset.size}`);
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

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "点单") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "星礼") {
      document.querySelector(".stars-card").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
