// 紙間 JOURNAL · kami — 页面交互
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

/* ===== chip 筛选（全部 / 未读 / 在读 / 已读完）===== */
const tocItems = Array.from(document.querySelectorAll(".toc-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    tocItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏本篇 toggle ===== */
document.querySelectorAll(".toc-item__mark").forEach((mark) => {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收进「批注」书签" : "已移出书签");
  });
});

/* ===== 批注：保存后清空 ===== */
const noteInput = document.getElementById("noteInput");

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && noteInput.value.trim()) {
    showToast("批注已贴在这一页 · p.62");
    noteInput.value = "";
  }
});

/* ===== 继续阅读：推进第一章进度条 ===== */
const readFill = document.getElementById("readFill");
const pageNow = document.getElementById("pageNow");
const continueBtn = document.getElementById("continueBtn");

let page = 62;
const totalPages = 96;

continueBtn.addEventListener("click", () => {
  if (page >= totalPages) {
    showToast("第一章已读完 · 已记入书架");
    return;
  }
  page = Math.min(totalPages, page + 5);
  const pct = Math.round((page / totalPages) * 100);
  readFill.style.setProperty("--w", `${pct}%`);
  pageNow.textContent = `p.${page}/${totalPages}`;
  if (page >= totalPages) {
    const firstTag = document.querySelector('.toc-item[data-kind="reading"] .toc-item__tag');
    if (firstTag) {
      firstTag.textContent = "已读完";
      firstTag.classList.add("toc-item__tag--muted");
      document.querySelector('.toc-item[data-kind="reading"]').dataset.kind = "done";
    }
    showToast("已读完《深夜编辑室》· 96 页合上");
  } else {
    showToast(`已翻到 p.${page} · 进度 ${pct}%`);
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "本期") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "批注") {
      noteInput.focus();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
