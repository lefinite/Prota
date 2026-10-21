// IBM 运维台 · Carbon 风 — 页面交互
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

/* ===== chip 筛选：按优先级过滤工单 ===== */
const tickets = Array.from(document.querySelectorAll(".ticket"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    tickets.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 解决工单 toggle ===== */
document.querySelectorAll(".ticket__check").forEach((check) => {
  check.addEventListener("click", () => {
    const row = check.closest(".ticket");
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    const tag = row.querySelector(".cds-tag");
    if (tag) {
      tag.className = on ? "cds-tag cds-tag--success" : "cds-tag";
      tag.textContent = on ? "已解决" : "处理中";
    }
    showToast(on ? "工单已标记为已解决" : "工单已重新打开");
  });
});

/* ===== 搜索工单 ===== */
const quickInput = document.getElementById("quickInput");

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  if (!text) {
    showToast("请输入工单 ID 或关键词");
    return;
  }
  const hit = tickets.find((t) =>
    t.querySelector(".ticket__meta").textContent.toLowerCase().includes(text.toLowerCase())
  );
  if (hit) {
    hit.scrollIntoView({ behavior: "smooth", block: "center" });
    hit.style.background = "var(--surface-warm)";
    setTimeout(() => {
      hit.style.background = "";
    }, 1200);
    showToast("已定位到匹配工单");
  } else {
    showToast("没有匹配的工单，试试 INC33421");
  }
});

/* ===== 分派工单 ===== */
const assignBtn = document.getElementById("assignBtn");
let assigned = 0;

assignBtn.addEventListener("click", () => {
  const next = tickets.find((t) => !t.dataset.assigned);
  if (next) {
    next.dataset.assigned = "1";
    assigned += 1;
    showToast(`已分派给值班组 · 本轮共 ${assigned} 单`);
  } else {
    showToast("所有工单均已分派");
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "工单") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
