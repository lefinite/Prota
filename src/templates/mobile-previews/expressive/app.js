// 跳格子 · Expressive — 页面交互
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

/* ===== 购买贴纸包：带走人数 +1 ===== */
const soldCount = document.getElementById("soldCount");

document.getElementById("buyPack").addEventListener("click", () => {
  const n = parseInt(soldCount.textContent.replace(/,/g, ""), 10) + 1;
  soldCount.textContent = n.toLocaleString("zh-CN");
  soldCount.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
    { duration: 360, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
  );
  showToast("独角兽便利店已进你的贴纸库 🦄");
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
    const num = count.textContent;
    const isK = num.endsWith("k");
    let v = parseFloat(num);
    v = on ? v + (isK ? 0.1 : 1) : v - (isK ? 0.1 : 1);
    count.textContent = isK ? v.toFixed(1) + "k" : String(Math.round(v));
  });
});

/* ===== 风格 chip ===== */
const styleChips = document.querySelectorAll(".chips--style .chip");
let style = "手绘风";
styleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    styleChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    style = chip.textContent;
  });
});

/* ===== 开画上架 ===== */
const ideaInput = document.getElementById("ideaInput");
const feedList = document.querySelector(".feed__list");

function publish() {
  const name = (ideaInput.value || "").trim() || "无名贴纸";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "free";
  const faces = ["🌟", "🎈", "🍄", "🍉", "🪩"];
  const face = faces[Math.floor(Math.random() * faces.length)];
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">${face}</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">@你 · 刚刚 · ${style} · 免费</span>
    </div>
    <button class="feed-item__like" type="button" aria-label="喜欢" aria-pressed="false"><span>♥</span><i>0</i></button>`;
  li.querySelector(".feed-item__name").textContent = name;
  const like = li.querySelector(".feed-item__like");
  like.addEventListener("click", () => {
    const on = like.classList.toggle("is-on");
    like.setAttribute("aria-pressed", String(on));
    const c = like.querySelector("i");
    c.textContent = on ? "1" : "0";
  });
  feedList.prepend(li);
  ideaInput.value = "";
  showToast(`《${name}》已上架（${style}）`);
}

document.getElementById("publishBtn").addEventListener("click", publish);
ideaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") publish();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "开画") {
      ideaInput.focus();
      showToast("起个名字，选个风格，开画！");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
