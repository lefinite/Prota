// 快马 · Expo 风格 — 页面交互
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

/* ===== 构建进度模拟 ===== */
const buildPct = document.getElementById("buildPct");
const buildStage = document.getElementById("buildStage");
const mainBuild = document.getElementById("mainBuild");
const stages = [
  "Running · Install dependencies",
  "Running · Run prebuild",
  "Running · Gradle bundleRelease",
  "Running · Sign artifact",
  "Finished · Artifact uploaded"
];
let pct = 64;

const timer = setInterval(() => {
  pct = Math.min(100, pct + Math.round(Math.random() * 9 + 3));
  buildPct.textContent = pct + "%";
  buildStage.textContent = stages[Math.min(stages.length - 1, Math.floor(pct / 21))];
  if (pct >= 100) {
    clearInterval(timer);
    buildStage.textContent = stages[stages.length - 1];
    mainBuild.classList.remove("is-running");
    buildPct.textContent = "✓";
    showToast("android-production 构建完成，安装包已就绪");
  }
}, 1400);

/* ===== profile chip ===== */
const picks = document.querySelectorAll("[data-pick]");
let profile = "production";
picks.forEach((chip) => {
  chip.addEventListener("click", () => {
    picks.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    profile = chip.dataset.pick;
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

/* ===== 发起构建 ===== */
const commitInput = document.getElementById("commitInput");
const feedList = document.querySelector(".feed__list");

function startBuild() {
  const msg = (commitInput.value || "").trim() || "chore: bump version";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "run";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">⚡</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta mono">刚刚 · ${profile}</span>
    </div>
    <em class="state state--run">排队中</em>`;
  li.querySelector(".feed-item__name").textContent = `android · ${profile} · ${msg}`;
  feedList.prepend(li);
  li.hidden = !feedItems.every((i) => !i.hidden) ? false : false;
  commitInput.value = "";
  showToast(`已提交构建：${profile} · ${msg}`);

  let p = 0;
  const t = setInterval(() => {
    p = Math.min(100, p + Math.round(Math.random() * 16 + 6));
    li.querySelector(".state").textContent = p + "%";
    if (p >= 100) {
      clearInterval(t);
      const em = li.querySelector(".state");
      em.textContent = "成功";
      em.className = "state state--ok";
      li.dataset.kind = "ok";
      showToast("新构建完成 ✓");
    }
  }, 800);
}

document.getElementById("startBuild").addEventListener("click", startBuild);
commitInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startBuild();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      commitInput.focus();
      showToast("输入 commit message，一键上云");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
