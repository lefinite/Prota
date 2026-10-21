// ONE REP 一练 — 页面交互
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

/* ===== 收藏动作 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入常用动作" : "已移出常用动作");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 完成一组：推进 5×5 进度并写日志 ===== */
const setSteps = Array.from(document.querySelectorAll("#setSteps li"));
const setBtn = document.getElementById("setBtn");
const feedList = document.getElementById("feedList");
const weightInput = document.getElementById("weightInput");
const targetWeight = document.getElementById("targetWeight");
const prTag = document.querySelector(".hero-lift__pr");
const heroNote = document.querySelector(".hero-lift__note");
let doneSets = 3;
let currentWeight = 102.5;

function logSet(weight, isLast) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "done";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 9v6M8 6v12M12 4v16M16 7v10M20 10v4" />
      </svg>
    </span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta"></span>
    </div>
    <b class="feed-item__state is-done">完成</b>
    <button class="feed-item__star" type="button" aria-label="收藏该动作" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `深蹲 5×5 · ${weight.toFixed(1)} KG`;
  li.querySelector(".feed-item__meta").textContent =
    `刚刚 · 第 ${doneSets} 组 · RPE ${8 + (Math.random() > 0.6 ? 1 : 0)}`;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);

  if (isLast) {
    showToast(`深蹲收工：5×5 @ ${weight.toFixed(1)} KG`);
  }
}

setBtn.addEventListener("click", () => {
  if (doneSets >= 5) {
    showToast("本项已完成，去卧推区吧");
    return;
  }
  doneSets += 1;
  setSteps[doneSets - 1].classList.add("is-done");
  setSteps.forEach((s, i) => s.setAttribute("aria-hidden", "true"));
  document.getElementById("setSteps").setAttribute("aria-label", `组次进度 ${doneSets} / 5`);
  const isLast = doneSets >= 5;
  heroNote.textContent = isLast
    ? "5×5 全部完成 · 组间拉伸 90s 后进入卧推"
    : `5×5 · 上次 100 KG · 第 ${doneSets} 组进行中`;
  logSet(currentWeight, isLast);
  if (isLast && currentWeight > 100) {
    prTag.textContent = "PR SET";
    showToast(`新纪录：${currentWeight.toFixed(1)} KG × 5`);
  }
});

/* ===== 输入回车：更新目标重量 ===== */
weightInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const v = Number(weightInput.value.trim());
  if (v && v > 0 && v < 500) {
    currentWeight = v;
    targetWeight.textContent = v.toFixed(1);
    showToast(`目标重量已更新为 ${v.toFixed(1)} KG`);
    weightInput.value = "";
  } else {
    showToast("请输入 0–500 之间的重量");
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    if (name === "加练") {
      weightInput.focus();
      showToast("加练一个动作：输入重量后回车");
      return;
    }
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    if (name === "记录") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "训练") {
      document.querySelector(".app-content").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
