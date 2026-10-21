// 巷口周刊 · Editorial — 页面交互
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

/* ===== 栏目 chip 筛选目录 ===== */
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

/* ===== 书签 toggle ===== */
function bindMark(mark, silent) {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    if (!silent) showToast(on ? "已加入书签" : "已移出书签");
  });
}
document.querySelectorAll(".feed-item__mark").forEach((mark) => bindMark(mark));

/* ===== 订阅：校验邮箱 ===== */
const subscribeInput = document.getElementById("subscribeInput");

document.getElementById("subscribeBtn").addEventListener("click", () => {
  const value = (subscribeInput.value || "").trim();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    showToast("请先填写有效的邮箱地址");
    subscribeInput.focus();
    return;
  }
  subscribeInput.value = "";
  showToast("订阅成功，下一期预告将发给你");
});

subscribeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("subscribeBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "目录") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "本期") {
      document.querySelector(".cover-card").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
