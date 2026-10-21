// 夜航 NightOps · Midnight Terminal — 页面交互
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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 终端：逐行打字输出 ===== */
const term = document.getElementById("term");
const termStatus = document.getElementById("termStatus");

const LOG_LINES = [
  { html: '<span class="p">$</span> nightops deploy --env prod' },
  { html: '<span class="dim">▸ building image …</span> <span class="ok">12s</span>' },
  { html: '<span class="dim">▸ tests passed (148/148)</span>' },
  { html: '<span class="dim">▸ pushing registry:web@sha256:9f3a</span>' },
  { html: '<span class="ok">✓ deployed to prod · 42s · 0 downtime</span>' }
];

let termTimers = [];

function renderTerminal(instant = false) {
  termTimers.forEach(clearTimeout);
  termTimers = [];
  term.innerHTML = "";
  termStatus.textContent = "● building";

  LOG_LINES.forEach((line, i) => {
    const el = document.createElement("span");
    el.className = "term__line";
    el.innerHTML = line.html;
    if (instant || reducedMotion) {
      el.style.animation = "none";
      el.style.opacity = "1";
      el.style.transform = "none";
    } else {
      el.style.animationDelay = `${i * 420 + 120}ms`;
    }
    term.appendChild(el);
    if (!instant && !reducedMotion) {
      termTimers.push(setTimeout(() => el.scrollIntoView({ block: "nearest" }), i * 420 + 140));
    }
  });

  const cursor = document.createElement("span");
  cursor.className = "term__cursor";
  term.appendChild(cursor);

  const doneDelay = reducedMotion ? 0 : LOG_LINES.length * 420 + 200;
  termTimers.push(setTimeout(() => {
    termStatus.textContent = "● live";
    if (!instant) showToast("部署完成 · prod · 42s");
  }, doneDelay));
}

renderTerminal();

/* ===== 立即部署：重放终端 + 更新构建进度 ===== */
const deployBtn = document.getElementById("deployBtn");
const buildFill = document.getElementById("buildFill");
const cmdInput = document.getElementById("cmdInput");
let buildWidth = 75;

deployBtn.addEventListener("click", () => {
  renderTerminal();
  buildWidth = Math.min(buildWidth + 8, 100);
  buildFill.style.setProperty("--w", `${buildWidth}%`);
  const percent = Math.round((buildWidth / 100) * 8);
  showToast(`部署已触发 · 构建队列 ${percent}/8`);
});

cmdInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = cmdInput.value.trim();
  if (!value) {
    showToast("请输入 commit hash 或命令");
    cmdInput.focus();
    return;
  }
  renderTerminal();
  cmdInput.value = "";
  showToast(`已执行：${value}`);
});

/* ===== 同步状态 ===== */
document.getElementById("syncBtn").addEventListener("click", () => {
  showToast("状态已同步 · 3 services healthy");
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

/* ===== 置顶关注 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶关注该部署" : "已取消置顶");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "日志") {
      term.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    } else if (name === "部署") {
      cmdInput.focus();
      showToast("输入 commit hash，回车立即部署");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
