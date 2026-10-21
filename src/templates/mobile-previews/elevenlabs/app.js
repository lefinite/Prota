// 声弦 · ElevenLabs — 页面交互
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

/* ===== 播放 / 暂停：声波律动 + 时间走动 ===== */
const waveform = document.getElementById("waveform");
const playBtn = document.getElementById("playBtn");
const playTime = document.getElementById("playTime");
let playing = false;
let seconds = 2 * 60 + 14; // 02:14
let playTimer = null;

function fmt(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function stopPlayback() {
  playing = false;
  clearInterval(playTimer);
  waveform.classList.remove("is-playing");
  playBtn.classList.remove("is-playing");
  playBtn.setAttribute("aria-pressed", "false");
}

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.classList.toggle("is-playing", playing);
  playBtn.setAttribute("aria-pressed", String(playing));
  waveform.classList.toggle("is-playing", playing);

  if (!playing) {
    clearInterval(playTimer);
    showToast("已暂停，进度已保存");
    return;
  }
  showToast("开始播放 · 沉稳男声");
  playTimer = setInterval(() => {
    seconds = Math.min(seconds + 1, 18 * 60 + 40);
    playTime.textContent = fmt(seconds);
    if (seconds >= 18 * 60 + 40) {
      stopPlayback();
      showToast("本节已读完");
    }
  }, 1000);
});

/* ===== 记录 chip 筛选 ===== */
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

/* ===== 音色收藏 toggle ===== */
document.querySelectorAll(".voice-star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏该音色" : "已取消收藏");
  });
});

/* ===== 下载 / 重试 ===== */
document.querySelectorAll(".feed-item__dl").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.closest(".feed-item").querySelector(".feed-item__name").textContent;
    const failed = name.includes("draft");
    if (failed) {
      showToast(`正在重试 ${name}……`);
    } else {
      showToast(`${name} 已开始下载`);
    }
  });
});

/* ===== 生成语音：入列 → 生成中 → 已生成 ===== */
const textInput = document.getElementById("textInput");
const feedList = document.getElementById("feedList");

function slugify(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 14).replace(/\s+/g, "-") : "untitled";
}

function generateAudio() {
  const name = slugify(textInput.value || "新片段试听") + ".wav";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "doing";
  li.innerHTML = `
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">沉稳男声 · 排队中 <em class="feed-item__chip" data-tone="doing">生成中</em></span>
    </div>
    <div class="feed-item__spinner" aria-hidden="true"></div>`;
  li.querySelector(".feed-item__name").textContent = name;
  feedList.prepend(li);
  textInput.value = "";
  showToast("已提交生成，约需 20 秒");

  setTimeout(() => {
    li.dataset.kind = "done";
    const chip = li.querySelector(".feed-item__chip");
    chip.dataset.tone = "ok";
    chip.textContent = "已生成";
    const meta = li.querySelector(".feed-item__meta");
    meta.innerHTML = "沉稳男声 · 00:52 ";
    meta.appendChild(chip);
    li.querySelector(".feed-item__spinner").outerHTML = `
      <button class="feed-item__dl" type="button" aria-label="下载">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v11M7.5 11.5L12 16l4.5-4.5M5 20h14" />
        </svg>
      </button>`;
    showToast(`${name} 已生成`);
  }, 1800);
}

document.getElementById("genBtn").addEventListener("click", generateAudio);

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateAudio();
});

/* ===== 试听样音 ===== */
document.getElementById("previewBtn").addEventListener("click", () => {
  if (!playing) playBtn.click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "工作台") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "音色") {
      document.getElementById("voiceList").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
