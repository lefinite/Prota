// M LAP · 圈速 — 页面交互
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

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 数据格 count-up（尊重 reduced-motion，直接落位）===== */
document.querySelectorAll("[data-count]").forEach((el) => {
  const target = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimal || 0);
  if (reduceMotion) {
    el.textContent = (target / Math.pow(10, decimals === 2 ? 2 : 0)).toFixed(decimals === 2 ? 2 : 0);
    return;
  }
  const factor = decimals === 2 ? 100 : 1;
  const start = performance.now();
  const dur = 900;
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * eased / factor).toFixed(decimals === 2 ? 2 : 0);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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

/* ===== 标杆圈 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已标记为标杆圈，用于回放对比" : "已取消标杆圈");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== M SETUP 分段器 ===== */
document.querySelectorAll(".seg").forEach((seg) => {
  const buttons = Array.from(seg.querySelectorAll(".seg__btn"));
  const label = seg.parentElement.querySelector(".setup-row__label");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      showToast(`${label ? label.textContent : "SETUP"} → ${btn.textContent} 已下发`);
    });
  });
});

/* ===== 圈速录制：启动 / 结束（功能性计时，不受动效降级影响）===== */
const bestLapEl = document.getElementById("bestLap");
const lapSubEl = document.getElementById("lapSub");
const recBtn = document.getElementById("recBtn");
const recFab = document.querySelector('[data-tab="录制"]');
const feedList = document.getElementById("feedList");
const noteInput = document.getElementById("noteInput");

let recording = false;
let lapStart = 0;
let lapTimer = null;
let lapNo = 12;
const bestMs = 102318; /* 1:42.318 */

function fmt(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

function setRecordingUi(on) {
  recording = on;
  recBtn.textContent = on ? "STOP · FINISH LAP" : "START RECORDING";
  recBtn.classList.toggle("is-rec", on);
  recFab.classList.toggle("is-rec", on);
  bestLapEl.classList.toggle("is-recording", on);
}

function toggleRecording() {
  if (!recording) {
    setRecordingUi(true);
    lapStart = performance.now();
    lapSubEl.textContent = "正在录制 · 保持赛车线，T9 前晚刹 0.3s";
    lapTimer = setInterval(() => {
      bestLapEl.textContent = fmt(performance.now() - lapStart);
    }, 97);
    showToast("遥测录制已开始 · GPS + IMU 20 Hz");
  } else {
    clearInterval(lapTimer);
    const elapsed = performance.now() - lapStart;
    setRecordingUi(false);
    bestLapEl.textContent = fmt(Math.min(elapsed, bestMs));

    lapNo += 1;
    const delta = elapsed - bestMs;
    const note = (noteInput.value || "").trim();
    noteInput.value = "";
    const li = document.createElement("li");
    li.className = "feed-item";
    li.dataset.kind = delta < 0 ? "fastest" : "progress";
    li.innerHTML = `
      <span class="feed-item__glyph" aria-hidden="true">L${String(lapNo).padStart(2, "0")}</span>
      <div class="feed-item__body">
        <span class="feed-item__name"></span>
        <span class="feed-item__meta"></span>
      </div>
      <b class="feed-item__delta ${delta < 0 ? "is-down" : "is-up"}">${delta >= 0 ? "+" : ""}${(delta / 1000).toFixed(3)}</b>
      <button class="feed-item__star" type="button" aria-label="标记为标杆圈" aria-pressed="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
        </svg>
      </button>`;
    li.querySelector(".feed-item__name").textContent = fmt(Math.min(elapsed, bestMs));
    li.querySelector(".feed-item__meta").textContent =
      `刚刚 · ${Math.floor(250 + Math.random() * 18)} KM/H${delta < 0 ? " · 新纪录" : ""}${note ? " · " + note : ""}`;
    bindStar(li.querySelector(".feed-item__star"));
    feedList.prepend(li);

    if (delta < 0) {
      lapSubEl.innerHTML = `第 ${lapNo} 圈刷新个人纪录 · 快 <b>${(-delta / 1000).toFixed(3)}</b>s`;
      showToast("新纪录！圈速已入库");
    } else {
      showToast(`本圈 ${(elapsed / 1000).toFixed(3)}s · 慢 ${delta >= 0 ? "+" : ""}${(delta / 1000).toFixed(3)}s`);
    }
  }
}

recBtn.addEventListener("click", toggleRecording);
recFab.addEventListener("click", toggleRecording);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  if (tab === recFab) return;
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      if (t !== recFab) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "圈速") {
      document.querySelector(".app-content").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "遥测") {
      document.querySelector(".spec-grid").scrollIntoView({ behavior: "smooth" });
      showToast("遥测视图：G 值圆图 + 油门/刹车轨迹");
    } else if (name === "赛道") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
      showToast("ZIC · 14 弯 · 已加载弯心笔记");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
