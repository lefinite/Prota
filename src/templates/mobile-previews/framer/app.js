// 墨界 · Framer — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 产品截图卡：打开预览 ===== */
const shotCard = document.getElementById("shotCard");

function openShot() {
  showToast("作品集 v3 已在画布打开");
}

shotCard.addEventListener("click", openShot);
shotCard.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openShot();
  }
});

/* ===== 发布到生产：管线逐级点亮 + 新版本入列 ===== */
const deployBtn = document.getElementById("deployBtn");
const commitInput = document.getElementById("commitInput");
const pipe = document.getElementById("pipe");
const pipeSteps = Array.from(pipe.querySelectorAll(".pipe__step"));
const feedList = document.getElementById("feedList");

let deploying = false;

function resetPipe() {
  pipeSteps.forEach((step) => {
    step.classList.remove("is-done", "is-doing", "is-live");
  });
}

function appendRelease(msg) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "live";
  li.innerHTML = `
    <span class="feed-item__ver" aria-hidden="true">v143</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">main · 刚刚</span>
    </div>
    <em class="feed-item__chip">Live</em>
    <button class="feed-item__pin" type="button" aria-label="置顶此版本" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = msg;
  li.querySelector(".feed-item__pin").addEventListener("click", (e) => {
    const pin = e.currentTarget;
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "v143 已置顶" : "已取消置顶");
  });
  feedList.prepend(li);
  pipeSteps.forEach((s) => (s.hidden = false));
}

function runDeploy() {
  if (deploying) return;
  deploying = true;
  deployBtn.disabled = true;
  deployBtn.textContent = "发布中…";
  resetPipe();

  const msg = commitInput.value.trim() || "调整页脚间距";
  const stepDelay = reduceMotion ? 0 : 650;

  pipeSteps.forEach((step, i) => {
    setTimeout(() => {
      if (i > 0) {
        pipeSteps[i - 1].classList.remove("is-doing");
        pipeSteps[i - 1].classList.add("is-done");
      }
      step.classList.add(i === pipeSteps.length - 1 ? "is-live" : "is-doing");
    }, stepDelay * i + (stepDelay ? 100 : 0));
  });

  setTimeout(() => {
    appendRelease(msg);
    commitInput.value = "";
    deployBtn.disabled = false;
    deployBtn.textContent = "发布到生产";
    deploying = false;
    showToast("v143 已发布到生产 · 耗时 41s");
  }, stepDelay * pipeSteps.length + (stepDelay ? 150 : 0));
}

deployBtn.addEventListener("click", runDeploy);
commitInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runDeploy();
});

/* ===== chip 筛选 ===== */
const feedItems = () => Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems().forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 置顶版本 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "版本已置顶，回滚时优先推荐" : "已取消置顶");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "项目") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } else if (name === "部署") {
      commitInput.focus();
      showToast("写下提交说明，一键发布");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
