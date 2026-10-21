// 三事 · Simple — 页面交互
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

/* ===== 今日清单：勾选 → 焦点环联动 ===== */
const ringFill = document.getElementById("ringFill");
const ringDone = document.getElementById("ringDone");
const ringTotal = document.getElementById("ringTotal");

function feedItems() {
  return Array.from(document.querySelectorAll(".feed-item"));
}

function refreshRing() {
  const items = feedItems();
  const done = items.filter((i) => i.dataset.status === "done").length;
  ringDone.textContent = done;
  ringTotal.textContent = "/ " + items.length;
  ringFill.style.setProperty("--p", items.length ? (done / items.length).toFixed(3) : "0");
  return { total: items.length, done, left: items.length - done };
}

function bindCheck(item) {
  const check = item.querySelector(".feed-item__check");
  const chip = item.querySelector(".feed-item__chip");
  check.addEventListener("click", () => {
    const wasDone = item.dataset.status === "done";
    if (wasDone) {
      item.dataset.status = item.dataset.base;
      chip.textContent = item.dataset.base === "live" ? "进行中" : "待办";
      chip.classList.toggle("is-live", item.dataset.base === "live");
      chip.classList.remove("is-done");
      check.setAttribute("aria-pressed", "false");
      check.setAttribute("aria-label", "完成这件事");
      refreshRing();
      showToast("已恢复为待办");
    } else {
      item.dataset.status = "done";
      chip.textContent = "已完成";
      chip.classList.add("is-done");
      chip.classList.remove("is-live");
      check.setAttribute("aria-pressed", "true");
      check.setAttribute("aria-label", "恢复为待办");
      const { left } = refreshRing();
      showToast(left ? `已完成 · 还剩 ${left} 件` : "今天的事全部完成，休息一下");
    }
  });
}

document.querySelectorAll(".feed-item").forEach(bindCheck);

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems().forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.status !== filter;
    });
  });
});

/* ===== 新增一件事 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function addTask(text) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.status = "todo";
  li.dataset.base = "todo";
  li.innerHTML = `
    <button class="feed-item__check" type="button" aria-label="完成这件事" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12.5l5 5L20 6.5" />
      </svg>
    </button>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 新添加 <em class="feed-item__chip">待办</em></span>
    </div>
    <span class="feed-item__time">15′</span>`;
  li.querySelector(".feed-item__name").textContent = text;
  bindCheck(li);
  feedList.prepend(li);
  refreshRing();
}

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  if (!text) {
    showToast("先写一句要做的事");
    return;
  }
  addTask(text);
  quickInput.value = "";
  const { left } = refreshRing();
  showToast(`已添加 · 今天共 ${left} 件未完成`);
});

/* ===== 换一件专注 ===== */
const focusName = document.getElementById("focusName");
const cycleBtn = document.getElementById("cycleBtn");

cycleBtn.addEventListener("click", () => {
  const pending = feedItems().filter((i) => i.dataset.status !== "done");
  if (!pending.length) {
    showToast("今天的事都完成了，安心休息");
    return;
  }
  const idx = pending.findIndex((i) => i.querySelector(".feed-item__name").textContent === focusName.textContent);
  const next = pending[(idx + 1) % pending.length];
  focusName.textContent = next.querySelector(".feed-item__name").textContent;
  showToast("当前专注：" + focusName.textContent);
});

/* ===== 专注 25 分钟计时 ===== */
const focusTimerEl = document.getElementById("focusTimer");
const focusBtn = document.getElementById("focusBtn");
let focusLeft = 25 * 60;
let focusTick = null;

function fmt(sec) {
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

focusBtn.addEventListener("click", () => {
  if (focusTick) {
    clearInterval(focusTick);
    focusTick = null;
    focusBtn.textContent = "继续专注";
    showToast("已暂停 · 进度保留在 " + fmt(focusLeft));
    return;
  }
  focusBtn.textContent = "暂停专注";
  showToast("专注开始 · 25 分钟，别看手机");
  focusTick = setInterval(() => {
    focusLeft -= 1;
    focusTimerEl.textContent = fmt(Math.max(focusLeft, 0));
    if (focusLeft <= 0) {
      clearInterval(focusTick);
      focusTick = null;
      focusBtn.textContent = "再来一轮";
      focusTimerEl.textContent = "25:00";
      focusLeft = 25 * 60;
      showToast("专注完成 · 休息 5 分钟");
    }
  }, 1000);
});

refreshRing();
