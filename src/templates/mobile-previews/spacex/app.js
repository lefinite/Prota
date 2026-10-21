// 任务控制 · SpaceX — 页面交互
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
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2000);
}

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== T- 倒计时：真实秒级走时 ===== */
const mission = document.querySelector(".mission");
const countdownEl = document.getElementById("countdown");
const phaseFill = document.getElementById("phaseFill");
let tSeconds = 4 * 60 + 37; // T-00:04:37
let liftOff = false;

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderCountdown() {
  const sign = liftOff ? "T+" : "T-";
  const s = Math.abs(tSeconds);
  countdownEl.textContent = `${sign}${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function renderPhases() {
  const frac = liftOff ? 1 : 1 - tSeconds / (4 * 60 + 37);
  phaseFill.style.width = Math.min(Math.max(frac, 0.06), 1) * 100 + "%";
}

/* 点火时刻：切换阶段并写入事件日志 */
const feedList = document.getElementById("feedList");

function markLiftOff() {
  liftOff = true;
  mission.classList.add("is-lift-off");
  document.getElementById("phaseCheck").classList.replace("is-live", "is-done");
  document.getElementById("phaseIgnition").classList.add("is-live");
  const ignitionLog = document.querySelector('.log[data-kind="wait"]');
  if (ignitionLog) {
    ignitionLog.dataset.kind = "live";
    const state = ignitionLog.querySelector(".log__state");
    state.className = "log__state is-live";
    state.innerHTML = "<i></i>进行中";
  }
  const li = document.createElement("li");
  li.className = "log";
  li.dataset.kind = "live";
  li.innerHTML = `
    <span class="log__time">T+00:00:00</span>
    <span class="log__event">升空 · LIFTOFF</span>
    <em class="log__state is-live"><i></i>进行中</em>`;
  feedList.appendChild(li);
  showToast("升空 · LIFTOFF");
}

setInterval(() => {
  if (!liftOff) {
    tSeconds -= 1;
    if (tSeconds <= 0) {
      tSeconds = 0;
      renderCountdown();
      markLiftOff();
      return;
    }
  } else {
    tSeconds += 1;
  }
  renderCountdown();
  renderPhases();
}, 1000);

renderCountdown();
renderPhases();

/* ===== 订阅发射提醒 ===== */
const subscribeBtn = document.getElementById("subscribeBtn");

subscribeBtn.addEventListener("click", () => {
  const on = subscribeBtn.classList.toggle("is-on");
  subscribeBtn.textContent = on ? "已订阅 · 点击取消" : "订阅发射提醒";
  showToast(on ? "已订阅 · T-10 分钟提醒你" : "已取消订阅");
});

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    document.querySelectorAll(".log").forEach((item) => {
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
    if (name === "任务") {
      mission.scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换 · ${name}`);
    }
  });
});
