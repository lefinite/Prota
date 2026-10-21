// 发布台 · Application — 页面交互
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

/* ===== 流水线推进（signature）=====
 * 阶段：0 拉取 / 1 构建 / 2 测试 / 3 灰度（停在审批）/ 4 生产（点 CTA 后推进）
 * state: "running" → "waiting" → "done" */
const STAGES = ["拉取", "构建", "测试", "灰度", "生产"];
const stageEls = Array.from(document.querySelectorAll(".pipeline__stage"));
const pipelineFill = document.getElementById("pipelineFill");
const pipelineStatus = document.getElementById("pipelineStatus");
const pipelineElapsed = document.getElementById("pipelineElapsed");

let stageIndex = 0;
let pipelineState = "running";
let elapsedSec = 12 * 60 + 47;
let elapsedTimer = null;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function paintPipeline() {
  stageEls.forEach((el, i) => {
    el.classList.toggle("is-done", i < stageIndex || (pipelineState === "done" && i === STAGES.length - 1));
    el.classList.toggle("is-active", pipelineState !== "done" && i === stageIndex);
  });
  const fillPct = pipelineState === "done" ? 100 : (stageIndex / (STAGES.length - 1)) * 100;
  pipelineFill.style.width = `${fillPct}%`;
}

function paintElapsed() {
  const m = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const s = String(elapsedSec % 60).padStart(2, "0");
  pipelineElapsed.textContent = `${m}:${s}`;
}

function tickElapsed() {
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    elapsedSec += 1;
    paintElapsed();
  }, 1000);
}

function advancePipeline() {
  if (pipelineState !== "running") return;
  if (stageIndex < 3) {
    stageIndex += 1;
    paintPipeline();
    setTimeout(advancePipeline, reduceMotion ? 200 : 1000);
  } else {
    pipelineState = "waiting";
    pipelineStatus.textContent = "灰度批次 25% · 等待审批后推进生产";
    clearInterval(elapsedTimer);
  }
}

paintPipeline();
paintElapsed();
tickElapsed();
setTimeout(advancePipeline, reduceMotion ? 100 : 700);

/* ===== 同步按钮：重跑流水线 ===== */
const syncBtn = document.getElementById("syncBtn");

syncBtn.addEventListener("click", () => {
  syncBtn.classList.remove("is-spinning");
  void syncBtn.offsetWidth;
  syncBtn.classList.add("is-spinning");
  stageIndex = 0;
  pipelineState = "running";
  pipelineStatus.textContent = "已拉取最新提交 · 正在构建";
  releaseBtn.classList.remove("is-queued");
  releaseBtn.textContent = "发布到生产";
  paintPipeline();
  tickElapsed();
  showToast("已同步 main 分支最新提交");
  setTimeout(advancePipeline, reduceMotion ? 100 : 700);
});

/* ===== 发布到生产：灰度 → 生产 ===== */
const releaseBtn = document.getElementById("releaseBtn");

releaseBtn.addEventListener("click", () => {
  if (pipelineState === "waiting") {
    pipelineState = "done";
    stageIndex = STAGES.length - 1;
    paintPipeline();
    pipelineStatus.textContent = "生产环境已更新 · 全量流量已切换";
    releaseBtn.classList.add("is-queued");
    releaseBtn.textContent = "已发布 ✓";
    tickElapsed();
    showToast("已发布到生产 · 健康检查通过");
  } else if (pipelineState === "running") {
    releaseBtn.classList.add("is-queued");
    releaseBtn.textContent = "等待灰度完成…";
    showToast("灰度尚未完成，已加入审批队列");
  } else {
    showToast("当前版本 v2.14.0 已在生产环境");
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
      item.hidden = filter !== "all" && item.dataset.status !== filter;
    });
  });
});

/* ===== 置顶 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶关注" : "已取消置顶");
  });
});

/* ===== 发布说明：回车即暂存 ===== */
const releaseNote = document.getElementById("releaseNote");

releaseNote.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && releaseNote.value.trim()) {
    showToast("变更说明已暂存，将随下次发布提交");
    releaseNote.blur();
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const heroCard = document.querySelector(".hero-card");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "流水线" || name === "概览") {
      heroCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      if (name === "流水线") showToast("流水线 #2417 · 灰度批次 25%");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
