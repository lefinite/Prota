// 驼厩 · Ollama 风格 — 页面交互
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

/* ===== 模型切换运行 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    const name = item.querySelector(".feed-item__name").textContent;
    document.querySelectorAll(".feed-item__dot").forEach((d) => d.classList.remove("is-on"));
    const dot = item.querySelector(".feed-item__dot");
    if (dot) dot.classList.add("is-on");
    const heroName = document.querySelector(".hero__name");
    const heroMeta = document.querySelector(".hero__meta");
    heroName.textContent = name;
    heroMeta.textContent = item.querySelector(".feed-item__meta").textContent + " · 已加载到内存";
    showToast(`已切换运行 ${name}`);
  });
});

/* ===== 对话（模拟 token 流）===== */
document.getElementById("chatBtn").addEventListener("click", () => {
  const reply = "好的，我们用 llama3.2 来回答。";
  let i = 0;
  showToast("▍");
  const timer = setInterval(() => {
    i += 1;
    toast.textContent = "▍ " + reply.slice(0, i);
    if (i >= reply.length) {
      clearInterval(timer);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-show"), 1200);
    }
  }, 90);
});

/* ===== 拉取模型 ===== */
const pullInput = document.getElementById("pullInput");

function pullModel() {
  const name = (pullInput.value || "").trim() || "llama3.2:1b";
  showToast(`正在拉取 ${name} … 1.3 GB`);
  setTimeout(() => {
    showToast(`${name} 拉取完成，可离线使用`);
    pullInput.value = "";
  }, 1600);
}

document.getElementById("pullBtn").addEventListener("click", pullModel);
pullInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pullModel();
});

document.querySelectorAll("[data-fill]").forEach((chip) => {
  chip.addEventListener("click", () => {
    pullInput.value = chip.dataset.fill;
    pullInput.focus();
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "拉取") {
      pullInput.focus();
      showToast("输入模型名，回车拉取");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
