// 夜航船 · Storytelling — 页面交互
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

/* ===== 阅读进度：继续阅读 → 翻页推进 ===== */
const storyFill = document.getElementById("storyFill");
const storyTrack = document.getElementById("storyTrack");
const storyPct = document.getElementById("storyPct");
const storyMins = document.getElementById("storyMins");
const readBtn = document.getElementById("readBtn");

const TOTAL_MINS = 50; // 整卷约 50 分钟
let pct = 64;

function renderProgress() {
  const mins = Math.max(0, Math.round(((100 - pct) / 100) * TOTAL_MINS));
  storyFill.style.setProperty("--w", `${pct}%`);
  storyPct.textContent = `${pct}%`;
  storyMins.textContent = String(mins);
  storyTrack.setAttribute("aria-valuenow", String(pct));
}

renderProgress();

readBtn.addEventListener("click", () => {
  if (pct >= 100) {
    showToast("本卷已读完 · 卷三《雾散时分》下周一开航");
    return;
  }
  pct = Math.min(100, pct + 8);
  renderProgress();
  showToast(pct >= 100 ? "本卷读完，灯还亮着" : `读到 ${pct}% · 海雾正浓`);
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
document.querySelectorAll(".feed-item__star").forEach((mark) => {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收进书签" : "已移出书签");
  });
});

/* ===== 给作者留言 ===== */
const quickInput = document.getElementById("quickInput");
const noteBtn = document.getElementById("noteBtn");

function publishNote() {
  const text = quickInput.value.trim();
  if (!text) {
    showToast("写一句再发表，作者会看到的");
    quickInput.focus();
    return;
  }
  showToast(`感想已发表：「${text.slice(0, 12)}${text.length > 12 ? "…" : ""}」`);
  quickInput.value = "";
}

noteBtn.addEventListener("click", publishNote);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") publishNote();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "书架") {
      document.querySelector(".story-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "发现") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
