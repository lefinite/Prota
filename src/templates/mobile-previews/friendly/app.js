// 小炉 · Friendly — 页面交互
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

/* ===== 二发倒计时：真走秒 + 圆环进度 ===== */
const proofTime = document.getElementById("proofTime");
const proofToggle = document.getElementById("proofToggle");
const proofCard = document.getElementById("proofCard");

const TOTAL = 48 * 60; // 总发酵时长 48 分
let left = 32 * 60 + 10; // 剩余 32:10
let running = true;
let finished = false;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderProof() {
  proofTime.textContent = fmt(left);
  const p = Math.round(((TOTAL - left) / TOTAL) * 100);
  proofCard.style.setProperty("--p", p);
}

renderProof();

setInterval(() => {
  if (!running || finished) return;
  left -= 1;
  if (left <= 0) {
    left = 0;
    finished = true;
    running = false;
    proofToggle.textContent = "二发完成";
    proofToggle.setAttribute("aria-pressed", "false");
    showToast("二发完成 · 面团可以入炉了");
  }
  renderProof();
}, 1000);

proofToggle.addEventListener("click", () => {
  if (finished) {
    showToast("这炉已经发好了，去入炉吧");
    return;
  }
  running = !running;
  proofToggle.textContent = running ? "暂停计时" : "继续计时";
  proofToggle.setAttribute("aria-pressed", String(running));
  showToast(running ? "计时继续 · 面团在慢慢长大" : "已暂停 · 围着围裙去歇会儿");
});

/* ===== 开始烘烤 ===== */
document.getElementById("bakeBtn").addEventListener("click", () => {
  if (!finished && left > 0) {
    showToast(`二发还剩 ${fmt(left)}，急什么呀`);
    return;
  }
  showToast("已入炉 · 230°C 烘烤 20:00，5 分钟前来提醒");
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

/* ===== 再烤一次 toggle ===== */
document.querySelectorAll(".feed-item__redo").forEach((redo) => {
  redo.addEventListener("click", () => {
    const on = redo.classList.toggle("is-on");
    redo.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入周末烘焙清单" : "已从清单移出");
  });
});

/* ===== 烘焙备注输入 ===== */
const bakeInput = document.getElementById("bakeInput");

bakeInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = bakeInput.value.trim();
  if (!text) {
    showToast("写一句给这炉面包的话吧");
    return;
  }
  bakeInput.value = "";
  showToast("已写进今天的烘焙日记");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "烤箱") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "计时") {
      proofToggle.focus();
      showToast("计时器就在这，随时暂停");
    } else {
      showToast(`去看看「${name}」`);
    }
  });
});
