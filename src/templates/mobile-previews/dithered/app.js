// 银盐 · Dithered — 页面交互
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

/* ===== 胶片格指示条：36 格，已拍 12 张 ===== */
const TOTAL = 36;
let remaining = 24; // 剩余张数
let shot = TOTAL - remaining; // 已拍张数

const frameStrip = document.getElementById("frameStrip");
const frameCount = document.getElementById("frameCount");

function renderStrip() {
  frameStrip.innerHTML = "";
  for (let i = 0; i < TOTAL; i++) {
    const dot = document.createElement("i");
    dot.className = "frame-dot";
    if (i < shot) dot.classList.add("is-shot");
    else if (i === shot) dot.classList.add("is-current");
    frameStrip.appendChild(dot);
  }
  frameStrip.setAttribute(
    "aria-label",
    `36 格胶片张数指示条，已拍 ${shot} 张，剩 ${remaining} 张`
  );
  frameCount.textContent = String(remaining);
}

renderStrip();

/* ===== 过片：拍下一张 ===== */
const advanceBtn = document.getElementById("advanceBtn");
const noteInput = document.getElementById("noteInput");
const feedList = document.getElementById("feedList");

function advance() {
  if (remaining <= 0) {
    showToast("本卷已拍完 · 请回卷送冲");
    return;
  }
  remaining -= 1;
  shot += 1;
  renderStrip();

  // 翻牌动画
  frameCount.classList.remove("is-flip");
  void frameCount.offsetWidth; // 重启动画
  frameCount.classList.add("is-flip");

  // 备注作为新底片插入列表顶部
  const note = (noteInput.value || "").trim() || `第 ${shot} 张 · 匿名底片`;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "expired"; // 本卷为过期卷
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">f5.6</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">第 ${shot} 张 · 1/125s <em class="feed-item__chip">正常</em></span>
    </div>
    <b class="feed-item__tag">±0</b>
    <button class="feed-item__star" type="button" aria-label="标记为候选底片" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = note;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);

  noteInput.value = "";
  if (remaining === 0) {
    advanceBtn.disabled = true;
    advanceBtn.textContent = "本卷拍完";
    showToast("咔哒 · 第 36 张，本卷拍完，该回卷了");
  } else {
    showToast(`咔哒 · 已过片，剩 ${remaining} 张`);
  }
}

advanceBtn.addEventListener("click", advance);
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") advance();
});

/* ===== 暗房计时器：启动 / 暂停 ===== */
const devTimer = document.getElementById("devTimer");
const devBtn = document.getElementById("devBtn");
let devSeconds = 4 * 60 + 12;
let devRunning = false;
let devInterval = null;

function renderDev() {
  const mm = String(Math.floor(devSeconds / 60)).padStart(2, "0");
  const ss = String(devSeconds % 60).padStart(2, "0");
  devTimer.textContent = `${mm}:${ss}`;
}

devBtn.addEventListener("click", () => {
  devRunning = !devRunning;
  devBtn.setAttribute("aria-pressed", String(devRunning));
  devBtn.classList.toggle("is-running", devRunning);
  devBtn.textContent = devRunning ? "暂停" : "启动";
  if (devRunning) {
    showToast("彩显计时开始 · 38.3℃");
    devInterval = setInterval(() => {
      devSeconds = Math.max(devSeconds - 1, 0);
      renderDev();
      if (devSeconds === 0) {
        clearInterval(devInterval);
        devRunning = false;
        devBtn.classList.remove("is-running");
        devBtn.textContent = "完成";
        showToast("彩显完成 · 请立即倒药水漂洗");
      }
    }, 1000);
  } else {
    clearInterval(devInterval);
    showToast("计时已暂停");
  }
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

/* ===== 候选底片 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已标记为候选底片" : "已取消候选");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "快门") {
      advance();
      document.querySelector(".counter-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "胶卷") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
