// 不夜场 PULSE · Neon — 页面交互
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

/* ===== 在线人数滚动（直播间氛围）===== */
const liveCountEl = document.getElementById("liveCount");
let liveCount = 12847;

if (liveCountEl) {
  setInterval(() => {
    liveCount += Math.floor(Math.random() * 14) - 4;
    liveCountEl.textContent = liveCount.toLocaleString("zh-CN");
  }, 2200);
}

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

/* ===== 收藏赛程 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏，开赛提前提醒" : "已取消收藏");
  });
});

/* ===== 本场预测投票（单选 toggle）===== */
const voteBtns = Array.from(document.querySelectorAll(".vote-btn"));
let voted = null;

voteBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (voted === btn) {
      btn.classList.remove("is-on");
      btn.setAttribute("aria-pressed", "false");
      voted = null;
      showToast("已撤回预测");
      return;
    }
    voteBtns.forEach((b) => {
      b.classList.remove("is-on");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("is-on");
    btn.setAttribute("aria-pressed", "true");
    voted = btn;
    showToast(`已预测「${btn.dataset.vote}」夺冠`);
  });
});

/* ===== 发弹幕：写进热词区 ===== */
const quickInput = document.getElementById("quickInput");
const hotwords = document.getElementById("hotwords");

function sendBarrage() {
  const text = (quickInput.value || "").trim();
  if (!text) {
    showToast("先写点什么再发吧");
    quickInput.focus();
    return;
  }
  const em = document.createElement("em");
  em.textContent = `#${text.replace(/^#/, "")}`;
  em.classList.add("is-hot", "is-new");
  hotwords.prepend(em);
  quickInput.value = "";
  showToast("弹幕已发射，冲鸭！");
}

document.getElementById("predictBtn").addEventListener("click", () => {
  const winner = voteBtns.find((b) => b.classList.contains("is-on"));
  if (winner) {
    showToast(`预测「${winner.dataset.vote}」已入池，坐等开奖`);
  } else {
    showToast("先在上面选一支战队");
    voteBtns[0].focus();
  }
});

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBarrage();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "赛程") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "预测") {
      const winner = voteBtns.find((b) => b.classList.contains("is-on"));
      if (!winner) voteBtns[0].focus();
      showToast(winner ? `当前预测「${winner.dataset.vote}」` : "选一支战队加入预测");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
