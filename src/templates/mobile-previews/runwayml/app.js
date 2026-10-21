// 幕轨 · Runway 风格 — 页面交互
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

/* ===== 生成进度推进 ===== */
const badge = document.querySelector(".hero__badge");
const runFrame = document.querySelector(".frame.is-run");
let pct = 62;

const renderTimer = setInterval(() => {
  pct = Math.min(100, pct + Math.round(Math.random() * 7 + 2));
  badge.textContent = `RENDERING ${pct}%`;
  if (pct >= 100) {
    clearInterval(renderTimer);
    badge.textContent = "DONE · 10s";
    runFrame.classList.remove("is-run");
    runFrame.classList.add("is-done");
    const next = runFrame.nextElementSibling;
    if (next) next.classList.add("is-run");
    showToast("镜头 03 渲染完成 · 已加入时间线");
  }
}, 1800);

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

/* ===== 画幅 chip ===== */
const ratioChips = document.querySelectorAll(".chips--ratio .chip");
ratioChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    ratioChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`画幅：${chip.textContent}`);
  });
});

/* ===== 分镜点击 ===== */
document.querySelectorAll(".frame").forEach((frame) => {
  frame.addEventListener("click", () => {
    document.querySelectorAll(".frame").forEach((f) => f.classList.remove("is-run"));
    frame.classList.add("is-run");
    showToast(`跳到镜头 ${frame.querySelector("span").textContent}`);
  });
});

/* ===== 新生成 ===== */
const promptInput = document.getElementById("promptInput");
const feedList = document.querySelector(".feed__list");

function generate() {
  const text = (promptInput.value || "").trim() || "新的空镜";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "video";
  const hue = Math.floor(Math.random() * 360);
  li.innerHTML = `
    <div class="feed-item__thumb" style="background: linear-gradient(140deg, hsl(${hue} 30% 18%), hsl(${hue + 40} 30% 32%))" aria-hidden="true"></div>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta mono">10s · 1080p · 排队中</span>
    </div>
    <em class="state st-run">0%</em>`;
  li.querySelector(".feed-item__name").textContent = text;
  feedList.prepend(li);
  promptInput.value = "";
  showToast("已加入渲染队列 · 消耗 40 credits");

  let p = 0;
  const em = li.querySelector(".state");
  const t = setInterval(() => {
    p = Math.min(100, p + Math.round(Math.random() * 14 + 5));
    em.textContent = p + "%";
    if (p >= 100) {
      clearInterval(t);
      em.textContent = "✓";
      em.className = "state st-done";
      li.dataset.kind = "video";
    }
  }, 700);
}

document.getElementById("genBtn").addEventListener("click", generate);
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generate();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "生成") {
      promptInput.focus();
      showToast("描述镜头，或拖入参考帧");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
