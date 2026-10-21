// 便签白板 · Miro — 页面交互
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

/* ===== 便签颜色选择 ===== */
const colorDots = document.querySelectorAll(".color-dot");
let stickyColor = "yellow";

colorDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    colorDots.forEach((d) => {
      d.classList.remove("is-active");
      d.setAttribute("aria-pressed", "false");
    });
    dot.classList.add("is-active");
    dot.setAttribute("aria-pressed", "true");
    stickyColor = dot.dataset.color;
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

/* ===== 点赞 toggle ===== */
function bindHeart(heart) {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已点赞这条动态" : "已取消点赞");
  });
}

document.querySelectorAll(".feed-item__heart").forEach(bindHeart);

/* ===== 高票便签投票 toggle ===== */
document.querySelectorAll(".vote-row").forEach((row) => {
  row.addEventListener("click", () => {
    const numEl = row.querySelector(".vote-row__num");
    const icon = numEl.querySelector("i");
    const count = numEl.childNodes[1];
    const on = row.getAttribute("aria-pressed") !== "true";
    row.setAttribute("aria-pressed", String(on));
    const votes = Number(row.dataset.votes) + (on ? 1 : 0);
    count.nodeValue = ` ${votes}`;
    icon.textContent = on ? "▲" : "△";
    showToast(on ? "投票成功，已 +1" : "已撤回投票");
  });
});

/* ===== 贴便签：画板 + 动态双写 ===== */
const stickyGrid = document.getElementById("stickyGrid");
const feedList = document.getElementById("feedList");
const quickInput = document.getElementById("quickInput");
const heartSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
  '<path d="M12 20.5s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 9.3 5.3c-1.8 4.3-9.3 9-9.3 9z" /></svg>';

const tilts = ["-1.4deg", "1.1deg", "-0.8deg", "1.5deg"];

function stickNote() {
  const text = (quickInput.value || "").trim();
  if (!text) {
    quickInput.focus();
    showToast("先写下便签内容");
    return;
  }

  const sticky = document.createElement("div");
  sticky.className = `sticky sticky--${stickyColor} sticky--new`;
  sticky.style.setProperty("--tilt", tilts[Math.floor(Math.random() * tilts.length)]);
  sticky.textContent = text;
  stickyGrid.prepend(sticky);
  while (stickyGrid.children.length > 6) {
    stickyGrid.lastElementChild.remove();
  }

  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "doing";
  li.innerHTML = `
    <i class="feed-item__avatar avatar avatar--a" aria-hidden="true">我</i>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 需求池</span>
    </div>
    <em class="state-chip state-chip--doing">进行中</em>
    <button class="feed-item__heart" type="button" aria-label="赞" aria-pressed="false">
      ${heartSvg}
    </button>`;
  li.querySelector(".feed-item__name").textContent = `我 添加便签「${text}」`;
  bindHeart(li.querySelector(".feed-item__heart"));
  feedList.prepend(li);
  feedItems.unshift(li);

  quickInput.value = "";
  stickyGrid.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("便签已贴上白板");
}

document.getElementById("stickBtn").addEventListener("click", stickNote);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") stickNote();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "动态") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "便签") {
      quickInput.focus();
      showToast("选颜色、写内容，回车贴上白板");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
