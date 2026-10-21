// 青鸟工作区 · Slack — 页面交互
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

/* ===== 语音房加入 ===== */
const huddleBtn = document.getElementById("huddleBtn");

huddleBtn.addEventListener("click", () => {
  const joined = huddleBtn.getAttribute("aria-pressed") === "true";
  huddleBtn.setAttribute("aria-pressed", String(!joined));
  huddleBtn.innerHTML = joined
    ? '<i aria-hidden="true"></i>语音房'
    : '<i aria-hidden="true"></i>已加入 · 4 人在场';
  showToast(joined ? "已离开语音房" : "已加入语音房 · 麦克风已静音");
});

/* ===== 表情回应 toggle ===== */
document.querySelectorAll(".reaction").forEach((reaction) => {
  reaction.addEventListener("click", () => {
    const on = reaction.classList.toggle("is-active");
    reaction.setAttribute("aria-pressed", String(on));
    const count = reaction.querySelector("b");
    count.textContent = Number(count.textContent) + (on ? 1 : -1);
    showToast(on ? "已添加回应" : "已取消回应");
  });
});

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    document.querySelectorAll(".msg").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 发送消息：追加到频道顶部下方 ===== */
const msgInput = document.getElementById("msgInput");
const feedList = document.getElementById("feedList");
const sendBtn = document.getElementById("sendBtn");

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) {
    showToast("写点什么再发送吧");
    msgInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "msg";
  li.dataset.kind = "unread";
  const now = new Date();
  const time = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  li.innerHTML = `
    <span class="avatar">你</span>
    <div class="msg__body">
      <div class="msg__head">
        <b class="msg__name">你</b>
        <span class="msg__time"></span>
      </div>
      <p class="msg__text"></p>
      <div class="msg__reactions">
        <button class="reaction" type="button" aria-pressed="false">✅ <b>0</b></button>
      </div>
    </div>`;
  li.querySelector(".msg__time").textContent = time;
  li.querySelector(".msg__text").textContent = text;
  li.querySelector(".reaction").addEventListener("click", (e) => {
    const r = e.currentTarget;
    const on = r.classList.toggle("is-active");
    r.setAttribute("aria-pressed", String(on));
    const count = r.querySelector("b");
    count.textContent = Number(count.textContent) + (on ? 1 : -1);
  });
  feedList.appendChild(li);
  msgInput.value = "";
  showToast("已发送到 # 产品设计评审");
}

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (tab.hasAttribute("data-badge")) {
      tab.removeAttribute("data-badge");
      showToast(`已打开私信 · 3 条未读`);
    } else if (name === "主页") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
