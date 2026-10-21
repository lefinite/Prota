// 微聊 · WeChat — 页面交互
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

/* ===== 发消息：追加气泡 ===== */
const bubbles = document.querySelector(".bubbles");
const msgInput = document.getElementById("msgInput");

function sendMsg(text) {
  const row = document.createElement("div");
  row.className = "bubble bubble--out";
  row.innerHTML = `
    <p class="bubble__text"></p>
    <span class="bubble__avatar av-2">我</span>`;
  row.querySelector(".bubble__text").textContent = text;
  bubbles.appendChild(row);
  bubbles.scrollIntoView({ block: "nearest" });
}

document.getElementById("sendBtn").addEventListener("click", () => {
  const text = (msgInput.value || "").trim();
  if (!text) {
    showToast("先说点什么");
    return;
  }
  sendMsg(text);
  msgInput.value = "";
  showToast("已发送");
});

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("sendBtn").click();
});

/* ===== 快捷短语 ===== */
document.querySelectorAll("[data-quick]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendMsg(btn.dataset.quick);
    showToast("已发送快捷回复");
  });
});

/* ===== Feed 筛选 ===== */
const convs = Array.from(document.querySelectorAll(".conv"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    convs.forEach((conv) => {
      if (filter === "all") {
        conv.hidden = false;
      } else if (filter === "unread") {
        conv.hidden = !conv.querySelector(".badge");
      } else {
        conv.hidden = conv.dataset.kind !== filter;
      }
    });
  });
});

/* ===== 会话点击：清角标 ===== */
convs.forEach((conv) => {
  conv.addEventListener("click", () => {
    const badge = conv.querySelector(".badge");
    if (badge) badge.remove();
    showToast(`进入「${conv.querySelector(".conv__name").textContent}」`);
  });
});

/* ===== 搜索栏点击 ===== */
document.querySelector(".search-bar__field").addEventListener("click", () => {
  msgInput.focus();
  showToast("搜索：输入名字或关键字");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.dataset.tab}」`);
  });
});
