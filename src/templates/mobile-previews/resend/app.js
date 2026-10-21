// 夜航邮 · Resend — 页面交互
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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 发送测试邮件：校验 + 插入批次 ===== */
const testInput = document.getElementById("testInput");
const sendBtn = document.getElementById("sendBtn");
const feedList = document.getElementById("feedList");
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

sendBtn.addEventListener("click", () => {
  const value = testInput.value.trim();
  if (!emailRe.test(value)) {
    showToast("请输入有效的收件邮箱");
    testInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "done";
  li.innerHTML = `
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta"><code></code> · 1 人 · 刚刚</span>
    </div>
    <em class="feed-item__badge" data-state="done">已送达</em>
    <button class="feed-item__mute" type="button" aria-label="静音该批次" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `测试邮件 → ${value}`;
  li.querySelector("code").textContent = "eml_" + Math.random().toString(36).slice(2, 6);
  li.querySelector(".feed-item__mute").addEventListener("click", (e) => {
    const mute = e.currentTarget;
    const on = mute.classList.toggle("is-on");
    mute.setAttribute("aria-pressed", String(on));
    showToast(on ? "该批次已静音" : "已恢复提醒");
  });
  feedList.prepend(li);
  testInput.value = "";
  showToast("测试邮件已送达 · 1.2s");
});

testInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

/* ===== 批次静音 toggle ===== */
document.querySelectorAll(".feed-item__mute").forEach((mute) => {
  mute.addEventListener("click", () => {
    const on = mute.classList.toggle("is-on");
    mute.setAttribute("aria-pressed", String(on));
    showToast(on ? "该批次已静音" : "已恢复提醒");
  });
});

/* ===== chip 筛选批次 ===== */
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

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const feedSection = document.querySelector(".feed");
const heroSection = document.querySelector(".deliv-hero");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "概览") {
      heroSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    } else if (name === "新建") {
      testInput.focus();
      showToast("填入邮箱即可发送测试邮件");
    } else if (name === "批次") {
      feedSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
