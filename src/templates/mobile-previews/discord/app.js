// 星舰公会 · Discord — 页面交互
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

/* ===== 语音房：加入 / 离开 ===== */
const voiceCard = document.getElementById("voiceCard");
const joinBtn = document.getElementById("joinBtn");
const voiceState = document.getElementById("voiceState");

joinBtn.addEventListener("click", () => {
  const live = voiceCard.classList.toggle("is-live");
  if (live) {
    joinBtn.textContent = "离开语音";
    joinBtn.classList.add("is-connected");
    voiceState.textContent = "4 人 · 你已连接";
    showToast("已加入 #集合点 · 语音频道");
  } else {
    joinBtn.textContent = "加入语音";
    joinBtn.classList.remove("is-connected");
    voiceState.textContent = "3 人在线";
    showToast("已离开语音频道");
  }
});

/* ===== 语音房计时器（已连接时长）===== */
const voiceTimer = document.getElementById("voiceTimer");
let elapsed = 23 * 60 + 47;

setInterval(() => {
  elapsed += 1;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  voiceTimer.textContent = `${mm}:${ss}`;
}, 1000);

/* ===== 闭麦 toggle ===== */
const muteBtn = document.getElementById("muteBtn");

muteBtn.addEventListener("click", () => {
  const muted = muteBtn.classList.toggle("is-on");
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.textContent = muted ? "解除闭麦" : "闭麦";
  showToast(muted ? "麦克风已静音" : "麦克风已开启");
});

/* ===== 提及条 ===== */
const mentionPill = document.getElementById("mentionPill");

mentionPill.addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
  showToast("已定位到提及消息");
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

/* ===== 表情回应 toggle ===== */
document.querySelectorAll(".feed-item__react").forEach((react) => {
  react.addEventListener("click", () => {
    const on = react.classList.toggle("is-on");
    react.setAttribute("aria-pressed", String(on));
    const count = react.querySelector("i");
    const n = Number(count.textContent || "0") + (on ? 1 : -1);
    count.textContent = String(Math.max(n, 0));
    showToast(on ? "已添加 ❤️ 回应" : "已取消回应");
  });
});

/* ===== 发送消息：插入到频道顶部 ===== */
const msgInput = document.getElementById("msgInput");
const feedList = document.getElementById("feedList");

function sendMessage() {
  const text = (msgInput.value || "").trim() || "收到，明早准时到！";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "chat";
  li.innerHTML = `
    <span class="feed-item__avatar" style="--role: var(--accent)">你</span>
    <div class="feed-item__body">
      <span class="feed-item__head">
        <b class="feed-item__name" style="--role: var(--accent)">你</b>
        <time>刚刚</time>
      </span>
      <span class="feed-item__text"></span>
    </div>
    <button class="feed-item__react" type="button" aria-label="添加表情回应" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 21s-7.5-4.7-9.5-9C1 8.5 3 5 6.5 5c2 0 3.4 1 4.4 2.4h2.2C14.1 6 15.5 5 17.5 5 21 5 23 8.5 21.5 12c-2 4.3-9.5 9-9.5 9Z" />
      </svg>
      <i>0</i>
    </button>`;
  li.querySelector(".feed-item__text").textContent = text;
  const react = li.querySelector(".feed-item__react");
  react.addEventListener("click", () => {
    const on = react.classList.toggle("is-on");
    react.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  msgInput.value = "";
  showToast("已发送到 #集合点");
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

/* ===== 成员头像点击：查看状态 ===== */
document.querySelectorAll(".member").forEach((member) => {
  member.addEventListener("click", () => {
    if (member.classList.contains("member--empty")) {
      showToast("邀请链接已复制，快来拉新团员");
      return;
    }
    const dot = member.querySelector(".member__dot");
    const state = dot
      ? { "member__dot--online": "在线", "member__dot--idle": "挂机", "member__dot--dnd": "请勿打扰" }[
          Array.from(dot.classList).find((c) => c.startsWith("member__dot--"))
        ] || "在线"
      : "在线";
    showToast(`成员状态：${state}${member.classList.contains("is-speaking") ? " · 正在说话" : ""}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "消息") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
      const badge = tab.querySelector(".tabbar__badge");
      if (badge) badge.remove();
    } else if (name === "语音") {
      if (!voiceCard.classList.contains("is-live")) joinBtn.click();
      voiceCard.scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
