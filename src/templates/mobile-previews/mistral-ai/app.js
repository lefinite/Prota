// 权重工坊 · Mistral AI — 页面交互
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

/* ===== 温度滑杆 ===== */
const tempSlider = document.getElementById("tempSlider");
const tempValue = document.getElementById("tempValue");

tempSlider.addEventListener("input", () => {
  tempValue.textContent = Number(tempSlider.value).toFixed(1);
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入常驻模型" : "已移出常驻模型");
  });
});

/* ===== 运行推理 ===== */
const quickInput = document.getElementById("quickInput");

function runInference() {
  const prompt = (quickInput.value || "").trim();
  if (!prompt) {
    quickInput.focus();
    showToast("先输入提示词");
    return;
  }
  quickInput.value = "";
  showToast(`推理已开始 · 温度 ${tempSlider.value} · 平均 42 tok/s`);
}

document.getElementById("runBtn").addEventListener("click", runInference);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runInference();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "模型") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "运行") {
      quickInput.focus();
      showToast("推理台就绪 · 回车即运行");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
