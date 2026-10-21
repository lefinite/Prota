// LEVELS 代谢 · levels — 页面交互
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

/* ===== 传感器同步：轻微抖动当前血糖 ===== */
const GLUCOSE_MIN = 72;
const GLUCOSE_MAX = 150;

const glucoseState = { value: 96 };
const glucoseValue = document.getElementById("glucoseValue");
const glucoseTrend = document.getElementById("glucoseTrend");
const glucoseMarker = document.getElementById("glucoseMarker");

function renderGlucose(prev) {
  const v = glucoseState.value;
  const diff = Math.round(v - prev);
  glucoseValue.innerHTML = `${Math.round(v)}<span>mg/dL</span>`;
  glucoseTrend.textContent = `${diff >= 0 ? "平稳 +" : "回落 −"}${Math.abs(diff)}`;
  // 量程 60–180 → 标尺位置
  const x = Math.min(96, Math.max(4, ((v - 60) / 120) * 100));
  glucoseMarker.style.setProperty("--x", `${x.toFixed(1)}%`);
}

document.getElementById("syncBtn").addEventListener("click", () => {
  const prev = glucoseState.value;
  glucoseState.value = Math.min(
    GLUCOSE_MAX,
    Math.max(GLUCOSE_MIN, glucoseState.value + (Math.random() - 0.5) * 10)
  );
  renderGlucose(prev);
  document.getElementById("syncSub").textContent = "8 月 15 日 · 刚刚同步";
  showToast("传感器数据已同步 · 每 5 分钟一次");
});

/* ===== chip 筛选（全部/早餐/午餐/加餐/反应偏高）===== */
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

/* ===== 收藏常吃 toggle ===== */
function wireStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入常吃清单" : "已移出常吃清单");
  });
}

document.querySelectorAll(".feed-item__star").forEach(wireStar);

/* ===== 记录餐食：写入列表顶部 ===== */
const mealInput = document.getElementById("mealInput");
const feedList = document.getElementById("feedList");

function logMeal() {
  const text = (mealInput.value || "").trim() || "一份加餐";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "snack";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🥗</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 反应将在 2 小时后生成</span>
    </div>
    <em class="feed-item__chip" data-level="mid">记录中</em>
    <button class="feed-item__star" type="button" aria-label="收藏常吃" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  wireStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  mealInput.value = "";
  showToast("已记录 · 2 小时后查看血糖反应");
}

document.getElementById("logBtn").addEventListener("click", logMeal);
mealInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logMeal();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "拍照记录") {
      mealInput.focus();
      showToast("拍照识别已就绪 · 也可直接输入食物名");
    } else if (name === "今日") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
