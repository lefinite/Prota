// 北岸智识 · Inspired by Cohere — 页面交互
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

/* ===== chip 筛选（检索历史） ===== */
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

/* ===== 置顶 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "已置顶到检索历史顶部" : "已取消置顶");
  });
});

/* ===== 发起检索：置信度动画 + 新历史入列 ===== */
const askInput = document.getElementById("askInput");
const askBtn = document.getElementById("askBtn");
const feedList = document.getElementById("feedList");
const confNum = document.getElementById("confNum");
const confFill = document.getElementById("confFill");
const PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" /></svg>';

function runRetrieval() {
  const question = (askInput.value || "").trim();
  if (!question) {
    askInput.focus();
    showToast("先输入一个问题，再发起检索");
    return;
  }

  askBtn.disabled = true;
  askBtn.textContent = "检索中…";
  confNum.textContent = "--%";

  window.setTimeout(() => {
    const hits = Math.floor(Math.random() * 5) + 3; // 3~7 篇
    const confidence = Math.floor(Math.random() * 9) + 88; // 88~96%
    confNum.textContent = confidence + "%";
    confFill.style.setProperty("--w", confidence + "%");
    confFill.style.width = confidence + "%";
    confFill.closest(".conf-track").setAttribute(
      "aria-label",
      "检索置信度 " + confidence + "%"
    );

    const li = document.createElement("li");
    li.className = "feed-item";
    li.dataset.kind = "done";
    li.innerHTML = `
      <span class="feed-item__glyph" aria-hidden="true">🧠</span>
      <div class="feed-item__body">
        <span class="feed-item__name"></span>
        <span class="feed-item__meta">刚刚 · 全库检索 <em class="feed-item__chip">已完成</em></span>
      </div>
      <button class="feed-item__pin" type="button" aria-label="置顶该检索" aria-pressed="false">${PIN_SVG}</button>`;
    li.querySelector(".feed-item__name").textContent = question;
    li.querySelector(".feed-item__pin").addEventListener("click", (e) => {
      const pin = e.currentTarget;
      const on = pin.classList.toggle("is-on");
      pin.setAttribute("aria-pressed", String(on));
    });
    feedList.prepend(li);

    askInput.value = "";
    askBtn.disabled = false;
    askBtn.textContent = "检索";
    showToast(`检索完成 · 命中 ${hits} 篇文档`);
  }, 650);
}

askBtn.addEventListener("click", runRetrieval);
askInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runRetrieval();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "提问") {
      askInput.focus();
      showToast("输入问题后回车，智能体即刻作答");
    } else if (name === "检索历史") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
