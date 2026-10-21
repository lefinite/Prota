// 问津 · OpenAI 风格 — 页面交互
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

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 置顶 toggle ===== */
document.querySelectorAll(".pin").forEach((pin) => {
  pin.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶该对话" : "已取消置顶");
  });
});

/* ===== 会话点击 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`已打开「${item.querySelector(".feed-item__name").textContent}」`);
  });
});

/* ===== 建议 chip 填入 ===== */
const askInput = document.getElementById("askInput");
document.querySelectorAll("[data-suggest]").forEach((chip) => {
  chip.addEventListener("click", () => {
    askInput.value = chip.dataset.suggest;
    askInput.focus();
  });
});

/* ===== 发送：流式回复 ===== */
const thread = document.querySelector(".hero__thread");
const replies = [
  "整理好了：共 2 项决策、3 项待办，责任人已标注。",
  "已完成对比，主要差异在定价模型与免费额度。",
  "单测骨架已生成，覆盖 6 个分支，含边界用例。"
];
let replyIdx = 0;

function send() {
  const text = (askInput.value || "").trim();
  if (!text) {
    showToast("先输入内容，或点一个建议");
    return;
  }
  const userMsg = document.createElement("div");
  userMsg.className = "msg msg--user";
  userMsg.innerHTML = "<p></p>";
  userMsg.querySelector("p").textContent = text;
  thread.appendChild(userMsg);
  askInput.value = "";
  showToast("正在思考……");

  setTimeout(() => {
    const aiMsg = document.createElement("div");
    aiMsg.className = "msg msg--ai";
    aiMsg.innerHTML = "<p></p>";
    thread.appendChild(aiMsg);
    const p = aiMsg.querySelector("p");
    const reply = replies[replyIdx % replies.length];
    replyIdx += 1;
    let i = 0;
    const timer = setInterval(() => {
      p.textContent = reply.slice(0, i) + (i < reply.length ? "▍" : "");
      i += 1;
      if (i > reply.length) clearInterval(timer);
    }, 60);
  }, 700);
}

document.getElementById("sendBtn").addEventListener("click", send);
askInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新对话") {
      askInput.focus();
      showToast("新对话已开启，随便问");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
