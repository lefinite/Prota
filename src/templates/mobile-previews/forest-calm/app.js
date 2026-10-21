// 森息 · 森系自然 — 页面交互
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

/* ===== 呼吸练习：播放 / 暂停（与 CSS 8 秒周期同步切换文案）===== */
const breathCard = document.getElementById("breathCard");
const breathWord = document.getElementById("breathWord");
const breathToggle = document.getElementById("breathToggle");

let breathing = true;
let phase = 0; // 0 = 吸气 4s，1 = 呼气 4s
let breathTimer = null;

function tickBreathWord() {
  phase = 1 - phase;
  breathWord.textContent = phase === 0 ? "吸气" : "呼气";
}

breathTimer = setInterval(tickBreathWord, 4000);

breathToggle.addEventListener("click", () => {
  breathing = !breathing;
  breathCard.classList.toggle("is-paused", !breathing);
  breathToggle.setAttribute("aria-pressed", String(breathing));
  breathToggle.textContent = breathing ? "暂停练习" : "继续练习";
  if (breathing) {
    breathTimer = setInterval(tickBreathWord, 4000);
    breathWord.textContent = "吸气";
    phase = 0;
    showToast("继续，跟圆环慢慢呼吸");
  } else {
    clearInterval(breathTimer);
    breathWord.textContent = "休息";
    showToast("已暂停 · 想继续时随时回来");
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
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收入最爱 toggle ===== */
document.querySelectorAll(".feed-item__mark").forEach((mark) => {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收入最爱练习" : "已移出最爱");
  });
});

/* ===== 睡前备注输入 ===== */
const nightInput = document.getElementById("nightInput");

nightInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = nightInput.value.trim();
  if (!text) {
    showToast("写下一个小小的心愿也好");
    return;
  }
  showToast("已记下，今晚练习开始前会提醒你");
  nightInput.value = "";
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "练习") {
      breathToggle.focus();
      showToast("跟着圆环，先来一次深呼吸");
    } else if (name === "今日") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已走进「${name}」`);
    }
  });
});
