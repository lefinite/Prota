// 霁光 · Glass Aurora — 页面交互
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

/* ===== 今日灵感：换一条 ===== */
const headlines = [
  "把通勤路上的十分钟，写成三行小诗",
  "给相册里最模糊的一张照片，起个名字",
  "用今天听到的三个词，编一段对话",
  "把烦恼折叠成一只纸船，写好放生说明",
  "以「窗外的云」为主角，写 60 字微小说",
  "模仿你最喜欢的歌，给它写句没唱出的歌词"
];
const headlineEl = document.getElementById("headline");
const refreshBtn = document.getElementById("refreshBtn");
let headlineIndex = 0;

refreshBtn.addEventListener("click", () => {
  let next = headlineIndex;
  while (next === headlineIndex) {
    next = Math.floor(Math.random() * headlines.length);
  }
  headlineIndex = next;
  headlineEl.style.animation = "none";
  void headlineEl.offsetWidth; // 重新触发入场动画
  headlineEl.style.animation = "";
  headlineEl.textContent = headlines[headlineIndex];
  showToast("灵感已更新 · 灵感值 +2");
});

/* ===== 晨间呼吸：4-7-8 节奏 ===== */
const breathCircle = document.getElementById("breathCircle");
const breathState = document.getElementById("breathState");
const breathBtn = document.getElementById("breathBtn");
let breathTimer = null;

breathBtn.addEventListener("click", () => {
  if (breathTimer) {
    clearInterval(breathTimer);
    breathTimer = null;
    breathCircle.classList.remove("is-calm");
    breathState.textContent = "吸气 4 秒";
    breathBtn.textContent = "开始一轮";
    showToast("呼吸练习已暂停 · 随时回来");
    return;
  }

  const phases = [
    ["吸气 4 秒", 4],
    ["屏息 7 秒", 7],
    ["呼气 8 秒", 8]
  ];
  let phase = 0;
  breathCircle.classList.add("is-calm");
  breathBtn.textContent = "停下来";
  breathState.textContent = phases[0][0];
  showToast("跟着光圈 · 开始 4-7-8 呼吸");

  breathTimer = setInterval(() => {
    phase = (phase + 1) % phases.length;
    breathState.textContent = phases[phase][0];
  }, 4000);
});

/* ===== 灵感胶囊：抽一颗 ===== */
const capsuleList = [
  "一句晨间开场白",
  "周末微旅行企划",
  "给旧照片配注解",
  "今天的日程彩蛋"
];
document.getElementById("capsuleBtn").addEventListener("click", () => {
  const pick = capsuleList[Math.floor(Math.random() * capsuleList.length)];
  showToast(`抽中「${pick}」· 已放入今日灵感`);
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏进灵感库" : "已从灵感库移出");
  });
});

/* ===== 生成灵感：把提问写进记录顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

const HEART_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9C1.3 8 3.4 4.5 7 4.5c2.2 0 3.9 1.3 5 3 1.1-1.7 2.8-3 5-3 3.6 0 5.7 3.5 4.3 7-1.8 4.4-9.3 9-9.3 9z" /></svg>';

function askAurora() {
  const text = (quickInput.value || "").trim() || "今天值得记录的一件小事";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "write";
  li.innerHTML = `
    <span class="feed-item__glyph feed-item__glyph--violet" aria-hidden="true">✨</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · AI 生成 <em class="feed-item__chip">新灵感</em></span>
    </div>
    <button class="feed-item__heart" type="button" aria-label="收藏这条灵感" aria-pressed="false">${HEART_SVG}</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__heart").addEventListener("click", (e) => {
    const heart = e.currentTarget;
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏进灵感库" : "已从灵感库移出");
  });
  feedList.prepend(li);
  quickInput.value = "";
  showToast("霁光已生成 · 稍后可在灵感库查看");
}

document.getElementById("askBtn").addEventListener("click", askAurora);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") askAurora();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "胶囊") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else if (name === "提问") {
      quickInput.focus();
      showToast("输入一句话，霁光来接住它");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
