// 炉边 · Warm Editorial — 页面交互
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

/* ===== 阅读进度 ===== */
const stages = ["已读 25% · 刨花与晨光", "已读 60% · 四十年，三万把椅子", "读完了 · 明晚十点见"];
let ri = 0;

document.getElementById("readBtn").addEventListener("click", () => {
  if (ri >= stages.length) {
    showToast("已在剪报架为你留了一份");
    return;
  }
  showToast(stages[ri]);
  ri += 1;
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

/* ===== 剪报 toggle ===== */
document.querySelectorAll(".clip").forEach((clip) => {
  clip.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = clip.classList.toggle("is-on");
    clip.setAttribute("aria-pressed", String(on));
    showToast(on ? "已剪入剪报架" : "已从剪报架取下");
  });
});

/* ===== 行点击阅读 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`打开：${item.querySelector(".feed-item__name").textContent}`);
  });
});

/* ===== 来信 ===== */
const letterInput = document.getElementById("letterInput");

document.getElementById("sendBtn").addEventListener("click", () => {
  const text = (letterInput.value || "").trim();
  if (!text) {
    showToast("先写一句，再寄出");
    return;
  }
  showToast("来信已寄出 · 编辑周五会读");
  letterInput.value = "";
});

letterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("sendBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "朗读") {
      showToast("主播版 · 陈守拙（上）：24 分钟，已开始播放");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
