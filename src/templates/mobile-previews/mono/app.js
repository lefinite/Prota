// 慢递 · Mono — 页面交互
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

/* ===== 读信：逐行打印效果 ===== */
const heroBody = document.querySelector(".hero__body");
const fullText =
  "「如果那天真的来了，记得先去楼下的面馆加个蛋，然后给爸妈打个电话。代码可以慢慢写，饭要趁热吃。—— 2024 年春，还在等消息的你」";

document.getElementById("openBtn").addEventListener("click", () => {
  heroBody.textContent = "";
  let i = 0;
  const cursor = document.createElement("span");
  cursor.textContent = "_";
  heroBody.appendChild(cursor);
  const timer = setInterval(() => {
    if (i >= fullText.length) {
      clearInterval(timer);
      cursor.remove();
      showToast("letter.txt · 1,432 字 · 读取完成");
      return;
    }
    cursor.insertAdjacentText("beforebegin", fullText[i]);
    i += 1;
  }, 55);
});

/* ===== 时长 chip ===== */
const whenChips = document.querySelectorAll("[data-days]");
let days = 365;
whenChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    whenChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    days = parseInt(chip.dataset.days, 10);
  });
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

/* ===== 封存新信 ===== */
const letterInput = document.getElementById("letterInput");
const feedList = document.querySelector(".feed__list");

function sealLetter() {
  const text = (letterInput.value || "").trim() || "一封没有标题的信";
  const target = new Date(Date.now() + days * 86400000);
  const ymd = target.toISOString().slice(0, 10);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "transit";
  li.innerHTML = `
    <span class="feed-item__glyph">✉</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">→ ${ymd} · 还剩 ${days} 天</span>
    </div>
    <em class="feed-item__pct">0%</em>`;
  li.querySelector(".feed-item__name").textContent = text;
  feedList.prepend(li);
  letterInput.value = "";
  showToast(`sealed: 「${text}」将于 ${ymd} 解锁`);
}

document.getElementById("sealBtn").addEventListener("click", sealLetter);
letterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sealLetter();
});

/* ===== 行点击 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(item.dataset.kind === "locked" ? "权限不足：时间锁未到期" : "信件已展开阅读");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "写信") {
      letterInput.focus();
      showToast("输入内容，回车即封存");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
