// 玄武 · xAI — 页面交互
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

/* ===== Loss 实时下降 ===== */
const lossEl = document.querySelector(".hero__loss");
const bars = document.querySelectorAll(".hero__bars i");
const stepEl = document.querySelector(".hero__stats b");
let loss = 0.8421;
let steps = 412000;

setInterval(() => {
  loss = Math.max(0.62, loss - Math.random() * 0.002);
  steps += 400;
  lossEl.textContent = loss.toFixed(4);
  stepEl.textContent = (steps / 1000).toFixed(0) + "K";
  const last = bars[bars.length - 1];
  last.style.setProperty("--h", 36 + Math.round(Math.random() * 6) + "%");
}, 2000);

/* ===== CHECKPOINT ===== */
document.getElementById("ckptBtn").addEventListener("click", () => {
  showToast("ckpt_412k 已写入 · 3.2TB · 分片 256");
});

/* ===== Feed 筛选 ===== */
const evals = Array.from(document.querySelectorAll(".eval"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    evals.forEach((ev) => {
      ev.hidden = filter !== "all" && ev.dataset.kind !== filter;
    });
  });
});

/* ===== 指标行点击：对比 ===== */
evals.forEach((ev) => {
  ev.addEventListener("click", () => {
    const name = ev.querySelector(".eval__name").textContent;
    const score = ev.querySelector("b").textContent;
    showToast(`${name} ${score} · 与上一版对比 +1.2`);
  });
});

/* ===== 控制台 ===== */
const cmdInput = document.getElementById("cmdInput");

document.getElementById("cmdBtn").addEventListener("click", () => {
  const cmd = cmdInput.value.trim() || "xctl status";
  showToast(`$ ${cmd} → OK（演示）`);
  cmdInput.value = "";
});

cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("cmdBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "NEW") {
      cmdInput.focus();
      showToast("$ xctl run new --config …");
    } else {
      showToast(`已切换到 ${name}`);
    }
  });
});
