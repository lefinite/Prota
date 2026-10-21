// 旧声 · Vintage — 页面交互
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

/* ===== 唱机播放/暂停 ===== */
const vinyl = document.getElementById("vinyl");
const playBtn = document.getElementById("playBtn");
const needle = document.querySelector(".needle");
let spinning = true;

playBtn.addEventListener("click", () => {
  spinning = !spinning;
  vinyl.classList.toggle("is-spin", spinning);
  playBtn.classList.toggle("is-paused", !spinning);
  needle.style.setProperty("--r", spinning ? "40deg" : "8deg");
  showToast(spinning ? "唱针落下 · 继续播放 B 面" : "唱针抬起 · 已暂停");
});

/* ===== 指针随播放摆动 ===== */
setInterval(() => {
  if (!spinning) return;
  needle.style.setProperty("--r", 20 + Math.round(Math.random() * 40) + "deg");
}, 3000);

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

/* ===== 想要 toggle ===== */
document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.textContent = on ? "★" : "☆";
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已记到「想要」清单" : "已从清单划去");
  });
});

/* ===== 年代 chip ===== */
const eraChips = document.querySelectorAll(".chips--era .chip");
eraChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    eraChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 到店留碟 ===== */
const findInput = document.getElementById("findInput");

document.getElementById("holdBtn").addEventListener("click", () => {
  const text = (findInput.value || "").trim() || "未具名唱片";
  showToast(`已留碟：「${text}」保留至周六打烊`);
});

findInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("holdBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "扫碟") {
      showToast("对准封套条码，即刻查版本与行情");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
