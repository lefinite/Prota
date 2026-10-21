// 问渠 · Perplexity — 页面交互
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

/* ===== 引用角标：点开对应来源 ===== */
document.querySelectorAll(".cite").forEach((cite) => {
  cite.addEventListener("click", () => showToast(cite.dataset.source || "已定位到引用来源"));
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

/* ===== 收藏线程 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "线程已收藏" : "已取消收藏");
  });
});

/* ===== 相关追问：一键填入提问框 ===== */
const askInput = document.getElementById("askInput");
const feedList = document.getElementById("feedList");

document.querySelectorAll(".follow").forEach((btn) => {
  btn.addEventListener("click", () => {
    askInput.value = btn.dataset.fill || "";
    askInput.focus();
    showToast("追问已填入，直接提问");
  });
});

/* ===== 提问：把新问题写进线程顶部 ===== */
function askQuestion() {
  const text = (askInput.value || "").trim() || "从当前来源继续深挖一层";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "streaming";
  li.innerHTML = `
    <span class="feed-item__glyph mono" aria-hidden="true">Q</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">并行检索中 <em class="tag tag--live">生成中</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="收藏线程" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  li.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  askInput.value = "";
  runResearchSteps();
  showToast("Searching…");
}

document.getElementById("askBtn").addEventListener("click", askQuestion);
askInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") askQuestion();
});

/* ===== 深度研究：步骤推进（reduced-motion 时瞬时完成）===== */
const researchSteps = Array.from(document.querySelectorAll("#researchSteps li"));
const trackFill = document.querySelector(".track__fill");
let stepTimers = [];

function runResearchSteps() {
  stepTimers.forEach(clearTimeout);
  stepTimers = [];

  if (!researchSteps.length) {
    showToast("答案已生成，来源 3 篇");
    return;
  }

  researchSteps.forEach((li) => li.classList.remove("is-done", "is-doing"));
  if (trackFill) {
    trackFill.style.setProperty("--w", "8%");
  }

  if (reduceMotion) {
    researchSteps.forEach((li) => li.classList.add("is-done"));
    researchSteps[researchSteps.length - 1].classList.remove("is-done");
    researchSteps[researchSteps.length - 1].classList.add("is-doing");
    if (trackFill) trackFill.style.setProperty("--w", "68%");
    return;
  }

  researchSteps.forEach((li, i) => {
    stepTimers.push(
      setTimeout(() => {
        li.classList.add("is-doing");
        if (trackFill) trackFill.style.setProperty("--w", `${18 + i * 20}%`);
      }, i * 620)
    );
    if (i < researchSteps.length - 1) {
      stepTimers.push(setTimeout(() => {
        li.classList.remove("is-doing");
        li.classList.add("is-done");
      }, i * 620 + 480));
    }
  });
  stepTimers.push(setTimeout(() => showToast("交叉验证 2 / 4 · 已核对 9 处事实"), 2100));
}

runResearchSteps();

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "线程") {
      document.querySelector(".feed").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    } else if (name === "提问") {
      askInput.focus();
      showToast("Ask anything.");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
