// 流光 · Gradient — 页面交互
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

/* ===== 今日飞轮：打卡 → 渐变环 + XP 联动 ===== */
const wheel = document.getElementById("wheel");
const todayText = document.getElementById("todayText");
const habits = Array.from(document.querySelectorAll(".habit"));
const XP_PER_HABIT = 330;
const XP_LEVEL_UP = 3000;

let xp = 2340;
let level = 8;
let leveled = false;

const xpFill = document.getElementById("xpFill");
const xpText = document.getElementById("xpText");
const xpTrack = document.querySelector(".xp-track");
const xpNote = document.getElementById("xpNote");
const levelBadge = document.querySelector(".level-card__badge");

function renderWheel() {
  const total = habits.length;
  const done = habits.filter((h) => h.classList.contains("is-done")).length;
  const percent = Math.round((done / total) * 100);
  wheel.style.setProperty("--ring-p", `${percent}%`);
  wheel.setAttribute("aria-label", `今日完成 ${done} 项，共 ${total} 项`);
  todayText.textContent = `${done} / ${total} 项已点亮`;
}

function renderXp() {
  const percent = Math.min(100, Math.round((xp / XP_LEVEL_UP) * 100));
  xpFill.style.setProperty("--w", `${percent}%`);
  xpText.textContent = `${xp.toLocaleString()} / ${XP_LEVEL_UP} XP`;
  xpTrack.setAttribute("aria-valuenow", String(Math.min(xp, XP_LEVEL_UP)));

  if (leveled) {
    xpNote.textContent = "已到 Lv.9 · 下一级能量槽明早刷新";
  } else {
    const need = Math.ceil((XP_LEVEL_UP - xp) / XP_PER_HABIT);
    xpNote.textContent = `再点亮 ${need} 项习惯，升到 Lv.9`;
  }
}

habits.forEach((habit) => {
  const check = habit.querySelector(".habit__check");
  check.addEventListener("click", () => {
    const done = habit.classList.toggle("is-done");
    check.setAttribute("aria-pressed", String(done));
    const name = habit.dataset.habit;

    if (done) {
      xp += XP_PER_HABIT;
      showToast(`已点亮「${name}」· 能量 +${XP_PER_HABIT}`);

      if (!leveled && xp >= XP_LEVEL_UP) {
        leveled = true;
        level = 9;
        levelBadge.textContent = `Lv.${level}`;
        setTimeout(() => showToast("升级！Lv.9 · 飞轮换上了新光环"), 900);
      }
    } else {
      xp = Math.max(2340, xp - XP_PER_HABIT);
      showToast(`已取消「${name}」`);
    }

    renderWheel();
    renderXp();
  });
});

/* 初始：环从 0% 平滑长到当前进度 */
wheel.style.setProperty("--ring-p", "0%");
requestAnimationFrame(() => {
  requestAnimationFrame(() => renderWheel());
});
renderXp();

/* ===== 动态筛选 ===== */
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

/* ===== 鼓劲 toggle ===== */
document.querySelectorAll(".feed-item__cheer").forEach((cheer) => {
  cheer.addEventListener("click", () => {
    const on = cheer.classList.toggle("is-on");
    cheer.setAttribute("aria-pressed", String(on));
    showToast(on ? "已鼓劲 · 对方会看到你的掌声" : "已收回掌声");
  });
});

/* ===== 创建习惯 ===== */
const quickInput = document.getElementById("quickInput");
const habitList = document.getElementById("habitList");

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>';

function createHabit() {
  const text = (quickInput.value || "").trim();
  if (!text) {
    showToast("先写下习惯的名字吧");
    quickInput.focus();
    return;
  }

  const li = document.createElement("li");
  li.className = "habit";
  li.dataset.habit = text;
  li.innerHTML = `
    <button class="habit__check" type="button" aria-pressed="false" aria-label="完成${text}">${CHECK_SVG}</button>
    <div class="habit__body">
      <span class="habit__name"></span>
      <span class="habit__track"><i style="--w: 4%"></i></span>
    </div>
    <em class="habit__streak">1 天</em>`;
  li.querySelector(".habit__name").textContent = text;
  li.querySelector(".habit__check").addEventListener("click", () => {
    const done = li.classList.toggle("is-done");
    li.querySelector(".habit__check").setAttribute("aria-pressed", String(done));
    if (done) {
      xp += XP_PER_HABIT;
      showToast(`已点亮「${text}」· 能量 +${XP_PER_HABIT}`);
      if (!leveled && xp >= XP_LEVEL_UP) {
        leveled = true;
        levelBadge.textContent = "Lv.9";
        setTimeout(() => showToast("升级！Lv.9 · 飞轮换上了新光环"), 900);
      }
    } else {
      xp = Math.max(2340, xp - XP_PER_HABIT);
      showToast(`已取消「${text}」`);
    }
    renderWheel();
    renderXp();
  });
  habitList.prepend(li);
  habits.unshift(li);
  quickInput.value = "";
  showToast(`「${text}」已加入今天 · 第 1 天`);
}

document.getElementById("createBtn").addEventListener("click", createHabit);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createHabit();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "习惯") {
      document.querySelector(".duo-stack").scrollIntoView({ behavior: "smooth" });
    } else if (name === "打卡") {
      const firstUndone = habits.find((h) => !h.classList.contains("is-done"));
      if (firstUndone) {
        firstUndone.querySelector(".habit__check").click();
        firstUndone.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        showToast("今天全部点亮 · 去看看动态吧");
      }
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
