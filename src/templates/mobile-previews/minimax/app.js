// 创作舱 · MiniMax — 页面交互
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

/* ===== 模型切换：换渐变 Hero + 文案 ===== */
const heroCard = document.getElementById("heroCard");
const heroTag = document.getElementById("heroTag");
const heroKicker = document.getElementById("heroKicker");
const heroTitle = document.getElementById("heroTitle");
const heroMeta = document.getElementById("heroMeta");
const modelPills = document.querySelectorAll(".model-pill");
const starSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
  '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" /></svg>';

modelPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    modelPills.forEach((p) => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    heroCard.dataset.grad = pill.dataset.grad;
    heroTag.textContent = pill.dataset.tag;
    heroKicker.textContent = pill.dataset.kicker;
    heroMeta.textContent = pill.dataset.meta;
    const [line1, line2] = pill.dataset.title.split("|");
    heroTitle.innerHTML = "";
    heroTitle.append(line1);
    heroTitle.append(document.createElement("br"));
    heroTitle.append(line2 || "");
    showToast(`已切换到「${pill.textContent.trim()}」`);
  });
});

/* ===== Hero 试用按钮 ===== */
document.getElementById("heroTryBtn").addEventListener("click", () => {
  quickInput.focus();
  showToast("模型已就绪，输入创意开始生成");
});

/* ===== 灵感填入 ===== */
const quickInput = document.getElementById("quickInput");

document.querySelectorAll(".insp-row").forEach((row) => {
  row.addEventListener("click", () => {
    quickInput.value = row.dataset.prompt;
    quickInput.focus();
    showToast("灵感已填入，可直接生成");
  });
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
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到灵感库" : "已取消收藏");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 立即生成：排队 → 生成中 → 已完成 ===== */
const feedList = document.getElementById("feedList");

function currentModel() {
  const active = document.querySelector(".model-pill.is-active");
  return active ? active.textContent.trim() : "海螺视频";
}

function generate() {
  const text = (quickInput.value || "").trim() || "未命名创意";
  const model = currentModel();
  const kind = (document.querySelector(".model-pill.is-active") || {}).dataset
    .kind || "video";

  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = kind;
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">✨</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · ${model}</span>
    </div>
    <em class="pill-status pill-status--queue">排队中</em>
    <button class="feed-item__star" type="button" aria-label="收藏" aria-pressed="false">
      ${starSvg}
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  quickInput.value = "";
  showToast("已加入生成队列 · 预计 40 秒");

  const statusEl = li.querySelector(".pill-status");
  setTimeout(() => {
    if (!statusEl.isConnected) return;
    statusEl.className = "pill-status pill-status--run";
    statusEl.textContent = "生成中";
  }, 2000);
  setTimeout(() => {
    if (!statusEl.isConnected) return;
    statusEl.className = "pill-status pill-status--done";
    statusEl.textContent = "已完成";
    showToast("生成完成，可到「作品」查看");
  }, 4600);
}

document.getElementById("genBtn").addEventListener("click", generate);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generate();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "作品") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "创作") {
      quickInput.focus();
      showToast("输入创意描述，即刻开拍");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
