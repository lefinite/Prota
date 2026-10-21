// 围桌 · Webex — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 发言计时 ===== */
const speakBadge = document.getElementById("speakBadge");
let speak = 192; // 秒

setInterval(() => {
  speak += 1;
  const m = String(Math.floor(speak / 60)).padStart(2, "0");
  const s = String(speak % 60).padStart(2, "0");
  speakBadge.textContent = `发言 ${m}:${s}`;
}, 1000);

/* ===== 静音 toggle ===== */
const muteBtn = document.getElementById("muteBtn");
let muted = true;

muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.classList.toggle("is-on", muted);
  showToast(muted ? "已静音 · 举手可申请发言" : "已开麦 · 注意背景音");
});

/* ===== Feed 筛选 ===== */
const meets = Array.from(document.querySelectorAll(".meet"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    meets.forEach((meet) => {
      meet.hidden = filter !== "all" && meet.dataset.kind !== filter;
    });
  });
});

/* ===== 会议类型 chip ===== */
const kindChips = document.querySelectorAll(".chips--kind .chip");
let kind = "即时会";
kindChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    kindChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    kind = chip.textContent.trim();
  });
});

/* ===== 开始会议 ===== */
const titleInput = document.getElementById("titleInput");

document.getElementById("startBtn").addEventListener("click", () => {
  const title = (titleInput.value || "").trim() || "快速会议";
  const li = document.createElement("li");
  li.className = "meet";
  li.dataset.kind = "live";
  li.innerHTML = `
    <div class="meet__when mono">NOW</div>
    <div class="meet__body">
      <span class="meet__name"></span>
      <span class="meet__meta">刚刚开始 · 会议室「木兰」</span>
    </div>
    <em class="live-dot"></em>`;
  li.querySelector(".meet__name").textContent = `${title}（${kind}）· 1 人`;
  document.querySelector(".feed__list").prepend(li);
  titleInput.value = "";
  showToast(`${kind}已创建 · 链接已复制可邀人`);
});

titleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("startBtn").click();
});

/* ===== 会议行点击 ===== */
meets.forEach((meet) => {
  meet.addEventListener("click", () => {
    const name = meet.querySelector(".meet__name").textContent;
    showToast(meet.dataset.kind === "live" ? `已回到「${name.split(" ·")[0]}」` : `回放：${name.split(" ·")[0]}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "发起") {
      titleInput.focus();
      showToast("输入标题，一键拉起即时会");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
