// 拾页 · Claude 设计系统 — 页面交互
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

/* ===== 目录 chip 筛选（长报道 / 随笔 / 访谈）===== */
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

/* ===== 加入书单 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    star.setAttribute("aria-label", on ? "移出书单" : "加入书单");
    showToast(on ? "已加入书单，离线可读" : "已移出书单");
  });
});

/* ===== 批注：写入批注本并计数 ===== */
const noteInput = document.getElementById("noteInput");
const noteCount = document.getElementById("noteCount");

function saveNote() {
  const text = (noteInput.value || "").trim();
  if (!text) {
    showToast("先写一句批注吧");
    noteInput.focus();
    return;
  }
  noteCount.textContent = String(Number(noteCount.textContent) + 1);
  noteInput.value = "";
  showToast("批注已存入批注本");
}

document.getElementById("shelfBtn").addEventListener("click", () => {
  showToast("本期 4 篇已整批加入书单");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "今日") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "笔记") {
      document.getElementById("catalogSection").scrollIntoView({ behavior: "smooth" });
    } else if (name === "收藏") {
      showToast("本期 4 篇已加入书单");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

/* ===== 输入框回车快捷保存 ===== */
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveNote();
});

/* 把「批注」入口也绑到摘要按钮之外的主流程：长按输入框提示 */
noteInput.addEventListener("focus", () => {
  if (!noteInput.value) noteInput.placeholder = "回车即保存……";
});
noteInput.addEventListener("blur", () => {
  noteInput.placeholder = "写一句批注，存进批注本……";
});
