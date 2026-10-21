// 星流收款 · Stripe — 页面交互
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

/* ===== 逐笔对账：勾选后待办数同步 ===== */
const checkBtns = document.querySelectorAll(".feed-item__check");
const reconCount = document.getElementById("reconCount");

function renderReconCount() {
  const open = Array.from(checkBtns).filter((b) => !b.classList.contains("is-on")).length;
  reconCount.textContent = String(open);
}

renderReconCount();

checkBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const row = btn.closest(".feed-item");
    const orderId = row.querySelector(".feed-item__name").textContent.split("·")[1].trim();
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    renderReconCount();
    showToast(on ? `${orderId} 已对账` : `${orderId} 已恢复待对账`);
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

/* ===== 收款码：金额输入 + 生成 ===== */
const quickInput = document.getElementById("quickInput");
const qrBtn = document.getElementById("qrBtn");

quickInput.addEventListener("input", () => {
  // 只留数字与一个小数点，最多两位小数
  let value = quickInput.value.replace(/[^\d.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join("")}`;
  if (value.includes(".")) {
    const [int, dec] = value.split(".");
    value = `${int}.${dec.slice(0, 2)}`;
  }
  quickInput.value = value;
});

function generateCode() {
  const amount = Number(quickInput.value);
  if (!amount || amount <= 0) {
    showToast("先输入金额，再生成收款码");
    quickInput.focus();
    return;
  }
  showToast(`收款码已生成 · ¥${amount.toFixed(2)}，1 分钟内有效`);
}

qrBtn.addEventListener("click", generateCode);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateCode();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "流水") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "结算") {
      document.querySelector(".cards").scrollIntoView({ behavior: "smooth" });
    } else if (name === "今日") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
