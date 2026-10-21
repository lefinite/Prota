// 方块道场 · Tetris — 页面交互
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

/* ===== 盘面绘制（10×8 迷你盘）===== */
const board = document.getElementById("board");
const COLS = 10;
const ROWS = 8;
const CELL = 26;

/* 底部堆叠（从下往上 4 行）*/
const stack = [
  "PP..CC..O.",
  "PGG.CC.OO.",
  "YGG.CRRROO",
  "YYGRRRRRRO"
];
const colorMap = {
  C: "b-cyan",
  Y: "b-yellow",
  P: "b-purple",
  G: "b-green",
  R: "b-red",
  O: "b-orange",
  B: "b-blue"
};

function cellAt(col, row, color, falling) {
  const el = document.createElement("i");
  el.className = `cell ${colorMap[color]}${falling ? " falling" : ""}`;
  el.style.left = col * CELL + "px";
  el.style.top = row * CELL + "px";
  if (falling) {
    el.style.animationDelay = (row % 2) * -0.4 + "s";
  }
  return el;
}

stack.forEach((row, r) => {
  row.split("").forEach((c, i) => {
    if (colorMap[c]) {
      board.appendChild(cellAt(i, ROWS - stack.length + r, c, false));
    }
  });
});

/* 正在降落的 S 形块（绿）*/
const fallingShape = [
  [0, 0, 1],
  [0, 1, 1],
  [0, 1, 0]
];
fallingShape.forEach((row, r) => {
  row.forEach((v, c) => {
    if (v) board.appendChild(cellAt(3 + c, 0 + r, "G", true));
  });
});

/* ===== DROP：入堆 + 消行 ===== */
const lineNum = document.getElementById("lineNum");
const scoreNum = document.getElementById("scoreNum");
let lines = 38;
let score = 42800;

document.getElementById("dropBtn").addEventListener("click", () => {
  /* 落块定格 */
  document.querySelectorAll(".falling").forEach((el) => {
    el.classList.remove("falling");
    el.style.animationDelay = "0s";
  });
  lines += 1;
  score += 800;
  lineNum.textContent = lines;
  scoreNum.textContent = score.toLocaleString("en-US");
  showToast(`+800 分 · ${lines} 行 · TETRIS!`);
  setTimeout(() => {
    location.reload();
  }, 1400);
});

/* ===== 模式 chip ===== */
const modeChips = document.querySelectorAll(".chips--mode .chip");
modeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    modeChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`模式：${chip.textContent}`);
  });
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

/* ===== START ===== */
document.getElementById("startBtn").addEventListener("click", () => {
  showToast("3 · 2 · 1 · GO!");
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
