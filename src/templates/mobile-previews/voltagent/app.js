// 伏特 · VoltAgent — 页面交互
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

/* ===== 运行流水推进 ===== */
const term = document.querySelector(".hero__term");
const cursorLine = term.querySelector(".cursor");
const steps = [
  ["c-ok", "✓ summarize · 1,204 tokens · 3.1s"],
  ["c-em", "▸ eval-guard · 抽查 12 条断言…"],
  ["c-ok", "✓ eval-guard · 12/12 passed"],
  ["c-em", "▸ mailer · 渲染 digest.md …"],
  ["c-ok", "✓ mailer · 已发送至 you@work.dev"],
  ["c-mut", "✓ run_9f2a 完成 · 58s · $0.021"]
];
let si = 0;
let running = true;

const runner = setInterval(() => {
  if (!running || si >= steps.length) {
    clearInterval(runner);
    if (si >= steps.length) showToast("编排完成 · 明晚 22:00 见");
    return;
  }
  const [cls, text] = steps[si];
  const p = document.createElement("p");
  p.className = "line " + cls;
  p.textContent = text;
  term.insertBefore(p, cursorLine);
  si += 1;
}, 1800);

/* ===== 暂停/恢复 ===== */
const pauseBtn = document.getElementById("pauseBtn");

pauseBtn.addEventListener("click", () => {
  running = !running;
  pauseBtn.textContent = running ? "暂停编排" : "恢复编排";
  showToast(running ? "编排已恢复" : "编排已暂停（状态已保存）");
});

/* ===== Feed 筛选 ===== */
const agents = Array.from(document.querySelectorAll(".agent"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    agents.forEach((agent) => {
      agent.hidden = filter !== "all" && agent.dataset.kind !== filter;
    });
  });
});

/* ===== 触发器 chip ===== */
const tplChips = document.querySelectorAll(".chips--tpl .chip");
tplChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    tplChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`触发方式：${chip.textContent}`);
  });
});

/* ===== 运行编排 ===== */
const flowInput = document.getElementById("flowInput");

document.getElementById("runBtn").addEventListener("click", () => {
  const text = (flowInput.value || "").trim() || "手动触发";
  showToast(`已入队：${text}`);
  flowInput.value = "";
});

flowInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("runBtn").click();
});

/* ===== 行点击 ===== */
agents.forEach((agent) => {
  agent.addEventListener("click", () => {
    showToast(`Agent 详情：${agent.querySelector("b").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "运行") {
      flowInput.focus();
      showToast("输入编排代码，回车运行");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
