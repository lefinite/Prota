// 暮集 · Sunset Warm — 页面交互
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

/* ===== 心情 chip ===== */
const moodChips = document.querySelectorAll(".chips--mood .chip");
moodChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    moodChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
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

/* ===== 喜欢 toggle ===== */
document.querySelectorAll(".feed-item__like").forEach((btn) => {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    const count = btn.querySelector("i");
    count.textContent = parseInt(count.textContent, 10) + (on ? 1 : -1);
  });
});

/* ===== 收入暮集 ===== */
const noteInput = document.getElementById("noteInput");
const feedList = document.querySelector(".feed__list");

document.getElementById("collectBtn").addEventListener("click", () => {
  const mood = document.querySelector(".chips--mood .is-active").textContent.trim();
  const text = (noteInput.value || "").trim() || "记下今天的天空";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "mood";
  li.innerHTML = `
    <span class="feed-item__glyph">🌇</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · ${mood}</span>
    </div>
    <button class="feed-item__like" type="button" aria-label="喜欢" aria-pressed="false">♥ <i>0</i></button>`;
  li.querySelector(".feed-item__name").textContent = text;
  const like = li.querySelector(".feed-item__like");
  like.addEventListener("click", () => {
    const on = like.classList.toggle("is-on");
    like.querySelector("i").textContent = on ? "1" : "0";
  });
  feedList.prepend(li);
  noteInput.value = "";
  showToast("已收入暮集 · 第 48 张");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "记录") {
      noteInput.focus();
      showToast("此刻天色如何？");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
