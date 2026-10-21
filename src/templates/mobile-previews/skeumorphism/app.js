// 回声牌 · Skeuomorphism — 页面交互
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

/* ===== 走带机：播放 / 停止 / 计数器 ===== */
const deck = document.getElementById("deck");
const playBtn = document.getElementById("playBtn");
const counterEl = document.getElementById("tapeCounter");
let counter = 137;
let counterTick = null;

function pad4(n) {
  return String(n).padStart(4, "0");
}

function setPlaying(on, quiet) {
  deck.classList.toggle("is-playing", on);
  playBtn.setAttribute("aria-pressed", String(on));
  if (counterTick) {
    clearInterval(counterTick);
    counterTick = null;
  }
  if (on) {
    counterTick = setInterval(() => {
      counter = (counter + 1) % 10000;
      counterEl.textContent = pad4(counter);
    }, 1400);
    if (!quiet) showToast("正在播放 A 面 · 「午夜快递」");
  }
}

playBtn.addEventListener("click", () => {
  setPlaying(!deck.classList.contains("is-playing"));
});

/* 倒带 / 快进：机械手感——计数器快速回卷 */
function spin(to, label) {
  const from = counter;
  const step = to === from ? 0 : to > from ? 1 : -1;
  let cur = from;
  const spinTick = setInterval(() => {
    cur += step * 7;
    if ((step > 0 && cur >= to) || (step < 0 && cur <= to)) {
      cur = to;
      clearInterval(spinTick);
    }
    counter = ((cur % 10000) + 10000) % 10000;
    counterEl.textContent = pad4(counter);
  }, 40);
  setPlaying(false, true);
  showToast(label);
}

document.getElementById("rewBtn").addEventListener("click", () => spin(0, "倒带中……已回到 0000"));
document.getElementById("ffBtn").addEventListener("click", () => spin(999, "快进到 0999 · B 面开头的空白"));

/* 操作区主按钮与走带机联动 */
const deckPlay = document.getElementById("deckPlay");

deckPlay.addEventListener("click", () => {
  const on = !deck.classList.contains("is-playing");
  setPlaying(on);
  deckPlay.textContent = on ? "停止走带" : "播放 A 面";
});

document.getElementById("rewindAll").addEventListener("click", () => {
  spin(0, "咔哒——倒带完成");
  deckPlay.textContent = "播放 A 面";
});

/* ===== 均衡旋钮：三档步进 ===== */
const knobLabels = ["低", "中", "高"];

document.querySelectorAll(".knob").forEach((knob) => {
  knob.addEventListener("click", () => {
    const next = (Number(knob.dataset.pos) + 1) % 3;
    knob.dataset.pos = next;
    knob.querySelector("b").textContent = knobLabels[next];
    showToast(`${knob.getAttribute("aria-label").slice(0, 2)}已调到「${knobLabels[next]}」`);
  });
});

/* ===== 杜比降噪开关 ===== */
document.querySelectorAll(".switch").forEach((sw) => {
  sw.addEventListener("click", () => {
    const on = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(on));
    showToast(on ? "杜比降噪已开启 · 咝咝声走开" : "杜比降噪已关闭 · 听点原汁原味");
  });
});

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    document.querySelectorAll(".feed-item").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 最爱 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    heart.setAttribute("aria-label", on ? "移出最爱" : "收进最爱");
    const name = heart.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `「${name}」已收进最爱` : `「${name}」已移出最爱`);
  });
});

/* ===== 磁带命名 ===== */
const tapeInput = document.getElementById("tapeInput");
const tapeTitle = document.getElementById("tapeTitle");

tapeInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = tapeInput.value.trim();
  if (!text) {
    showToast("先想一个名字，再按回车");
    return;
  }
  tapeTitle.textContent = text;
  tapeInput.value = "";
  showToast("标签已换好：「" + text + "」");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-pressed"));
    tab.classList.add("is-pressed");
    const name = tab.dataset.tab;
    if (name === "磁带") {
      document.querySelector(".deck").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`咔哒——已切到「${name}」`);
    }
  });
});
