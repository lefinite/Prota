// Fin 帮助台 · Intercom — 页面交互
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

/* ===== 关注会话 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注该会话" : "已取消关注");
  });
});

/* ===== 发送回复：写入会话列表顶部 ===== */
const replyInput = document.getElementById("replyInput");
const feedList = document.getElementById("feedList");

function wireStar(button) {
  button.addEventListener("click", () => {
    const on = button.classList.toggle("is-on");
    button.setAttribute("aria-pressed", String(on));
  });
}

function sendReply() {
  const text = (replyInput.value || "").trim() || "坐席回复已发送";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "fin";
  li.innerHTML = `
    <span class="feed-item__avatar" aria-hidden="true">我</span>
    <div class="feed-item__body">
      <span class="feed-item__name">刚刚 · 我的回复</span>
      <span class="feed-item__meta"></span>
    </div>
    <em class="feed-item__chip" data-state="fin">Fin 已回</em>
    <button class="feed-item__star" type="button" aria-label="关注该会话" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__meta").textContent = text;
  wireStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  replyInput.value = "";
  showToast("回复已发送 · 平均响应 41 秒");
}

document.getElementById("sendBtn").addEventListener("click", sendReply);
replyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendReply();
});

/* ===== 让 Fin 接管：把首个「待人工」转为 Fin 已回，解决率 +1% ===== */
const heroPct = document.getElementById("heroPct");
const segFin = document.getElementById("segFin");
const segHuman = document.getElementById("segHuman");
const finCount = document.getElementById("finCount");
const humanCount = document.getElementById("humanCount");

let resolvedPct = 83;
let finTotal = 1208;
let humanTotal = 160;

document.getElementById("finBtn").addEventListener("click", () => {
  const target = feedList.querySelector('.feed-item[data-kind="pending"]');
  if (target) {
    target.dataset.kind = "fin";
    const stateChip = target.querySelector(".feed-item__chip");
    stateChip.dataset.state = "fin";
    stateChip.textContent = "Fin 已回";
    humanTotal = Math.max(0, humanTotal - 1);
    finTotal += 1;
  }
  resolvedPct = Math.min(99, resolvedPct + 1);

  const humanPct = Math.max(1, Math.round((100 - resolvedPct) * 0.65));
  const escPct = Math.max(1, 100 - resolvedPct - humanPct);

  heroPct.innerHTML = `${resolvedPct}<span>%</span>`;
  segFin.style.setProperty("--w", `${resolvedPct}%`);
  segHuman.style.setProperty("--w", `${humanPct}%`);
  document.querySelector(".hero__seg--esc").style.setProperty("--w", `${escPct}%`);
  document.querySelector(".hero__bar").setAttribute(
    "aria-label",
    `Fin 解决 ${resolvedPct}%，待人工 ${humanPct}%，升级 ${escPct}%`
  );
  finCount.textContent = finTotal.toLocaleString("zh-CN");
  humanCount.textContent = humanTotal.toLocaleString("zh-CN");
  showToast("Fin 已接管 1 个会话，正在生成草稿");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新会话") {
      replyInput.focus();
      showToast("输入内容，回车即可发送");
    } else if (name === "收件箱") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
