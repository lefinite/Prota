// 歪歪手帐 · Doodle — 页面交互
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

/* ===== 心情表情：点击换表情（手绘 SVG path 组）===== */
const MOODS = [
  {
    word: "有点小确幸",
    mouth: "M24 41q8 7 16 0",
    browL: "M20 20q4 -2.5 8 0",
    browR: "M36 20q4 -2.5 8 0",
    blush: true
  },
  {
    word: "哇！好惊喜",
    mouth: "M26 40q6 -9 12 0q-6 4 -12 0",
    browL: "M20 19q4 -4 8 -1",
    browR: "M36 18q4 -3 8 1",
    blush: true
  },
  {
    word: "有点小 emo",
    mouth: "M24 44q8 -6 16 0",
    browL: "M20 22q4 2.5 8 0",
    browR: "M36 22q4 2.5 8 0",
    blush: false
  }
];

const moodFace = document.getElementById("moodFace");
const moodWord = document.getElementById("moodWord");
const faceMouth = document.getElementById("faceMouth");
const faceBrowL = document.getElementById("faceBrowL");
const faceBrowR = document.getElementById("faceBrowR");
const faceBlushL = document.getElementById("faceBlushL");
const faceBlushR = document.getElementById("faceBlushR");
let moodIndex = 0;

moodFace.addEventListener("click", () => {
  moodIndex = (moodIndex + 1) % MOODS.length;
  const mood = MOODS[moodIndex];
  faceMouth.setAttribute("d", mood.mouth);
  faceBrowL.setAttribute("d", mood.browL);
  faceBrowR.setAttribute("d", mood.browR);
  faceBlushL.style.opacity = mood.blush ? "1" : "0";
  faceBlushR.style.opacity = mood.blush ? "1" : "0";
  moodWord.textContent = mood.word;
  showToast(`心情已换：${mood.word}`);
});

/* ===== 贴纸盖章 toggle ===== */
document.querySelectorAll(".sticker").forEach((sticker) => {
  sticker.addEventListener("click", () => {
    const on = sticker.classList.toggle("is-on");
    sticker.setAttribute("aria-pressed", String(on));
    const label = sticker.querySelector("span").textContent;
    showToast(on ? `「${label}」已盖章` : `「${label}」已撕下`);
  });
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

/* ===== 收藏图钉 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    showToast(on ? "已钉进收藏页" : "已从收藏页取下");
  });
});

/* ===== 写手帐：贴进流水顶部 ===== */
const doodleInput = document.getElementById("doodleInput");
const feedList = document.getElementById("feedList");

function pasteEntry() {
  const text = (doodleInput.value || "").trim() || "今天的云像棉花糖";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = moodIndex === 2 ? "low" : moodIndex === 0 ? "calm" : "joy";
  const kindName = { joy: "开心", calm: "平静", low: "低落" }[li.dataset.kind];
  li.innerHTML = `
    <span class="feed-item__glyph wob-a" aria-hidden="true">✏️</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 <em class="feed-item__chip" data-level="${li.dataset.kind}">${kindName}</em></span>
    </div>
    <button class="feed-item__pin" type="button" aria-label="钉进收藏" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3-1-7z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  const pin = li.querySelector(".feed-item__pin");
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  doodleInput.value = "";
  showToast("已贴进今天的手帐");
}

document.getElementById("pasteBtn").addEventListener("click", pasteEntry);
doodleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pasteEntry();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "涂鸦") {
      doodleInput.focus();
      showToast("先写一句话，再给它画个画");
    } else if (name === "贴纸") {
      document.querySelector(".mood-card__stickers").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
