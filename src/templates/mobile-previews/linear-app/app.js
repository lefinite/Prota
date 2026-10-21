// Nova 冲刺 · Linear 风 — 页面交互
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

/* ===== 命令条（Cmd-K 签名交互） ===== */
const cmdBtn = document.getElementById("cmdBtn");
const cmdBar = document.getElementById("cmdBar");
const cmdInput = document.getElementById("cmdInput");
const fabNew = document.getElementById("fabNew");

function openCmdBar() {
  cmdBar.hidden = false;
  cmdBtn.setAttribute("aria-expanded", "true");
  setTimeout(() => cmdInput.focus(), 30);
}

function closeCmdBar() {
  cmdBar.hidden = true;
  cmdBtn.setAttribute("aria-expanded", "false");
  cmdInput.value = "";
}

cmdBtn.addEventListener("click", () => {
  if (cmdBar.hidden) {
    openCmdBar();
    showToast("命令面板已打开 · Esc 关闭");
  } else {
    closeCmdBar();
  }
});

cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCmdBar();
    return;
  }
  if (e.key !== "Enter") return;
  const text = cmdInput.value.trim();
  if (!text) {
    showToast("输入命令或 issue 编号，如 NOVA-142");
    return;
  }
  showToast(`正在执行：${text}`);
  closeCmdBar();
});

document.querySelectorAll(".cmd-hint").forEach((hint) => {
  hint.addEventListener("click", () => {
    showToast(`命令「${hint.dataset.cmd}」已执行`);
    closeCmdBar();
  });
});

/* ===== chip 筛选：issue 状态 ===== */
const issues = Array.from(document.querySelectorAll(".issue"));
const chips = document.querySelectorAll(".feed .chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    issues.forEach((item) => {
      const kinds = (item.dataset.kind || "").split(" ");
      item.hidden = filter !== "all" && !kinds.includes(filter);
    });
  });
});

/* ===== issue 勾选：完成 / 重开，并同步周期计数 ===== */
const cycleStats = document.querySelector(".cycle-card__stats");
const fill = document.querySelector(".cycle-card__fill");
const rateEl = document.querySelector(".cycle-card__rate");

const sprint = { done: 34, total: 59 }; /* 冲刺全量基线，Feed 只是其中一页 */
const cycleTrack = document.querySelector(".cycle-card__track");

function renderCycle() {
  const pct = Math.round((sprint.done / sprint.total) * 100);
  const doneEl = cycleStats.querySelector("span:first-child b");
  if (doneEl) doneEl.textContent = sprint.done;
  if (cycleTrack) cycleTrack.setAttribute("aria-valuenow", String(pct));
  if (fill) fill.style.setProperty("--w", `${pct}%`);
  if (rateEl) rateEl.textContent = `${pct}%`;
}

document.querySelectorAll(".issue__check").forEach((check) => {
  check.addEventListener("click", () => {
    const row = check.closest(".issue");
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    const name = row.querySelector(".issue__name");
    name.classList.toggle("issue__name--done", on);
    const kinds = row.dataset.kind.split(" ");
    if (on && !kinds.includes("done")) kinds.push("done");
    if (!on) {
      const i = kinds.indexOf("done");
      if (i > -1) kinds.splice(i, 1);
    }
    row.dataset.kind = kinds.join(" ");
    sprint.done = Math.max(0, sprint.done + (on ? 1 : -1));
    renderCycle();
    showToast(on ? "Issue 已完成" : "Issue 已重开");
  });
});

renderCycle();

/* ===== 订阅 toggle ===== */
document.querySelectorAll(".issue__bell").forEach((bell) => {
  bell.addEventListener("click", () => {
    const on = bell.classList.toggle("is-on");
    bell.setAttribute("aria-pressed", String(on));
    showToast(on ? "已订阅该 issue 的更新" : "已取消订阅");
  });
});

/* ===== 新建 issue ===== */
const newIssueBtn = document.getElementById("newIssueBtn");

function createIssue() {
  openCmdBar();
  showToast("输入标题后回车，即可创建 issue");
}

newIssueBtn.addEventListener("click", createIssue);
fabNew.addEventListener("click", createIssue);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  if (tab === fabNew) return; /* FAB 已单独处理 */
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "Issues") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
