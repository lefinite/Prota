// 格致 · Shadcn 风格 — 页面交互
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

/* ===== Tabs 切换 ===== */
const heroTabs = document.querySelectorAll(".hero-tab");
const panels = {
  task: document.getElementById("panel-task"),
  burn: document.getElementById("panel-burn"),
  member: document.getElementById("panel-member")
};

heroTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    heroTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    Object.values(panels).forEach((p) => (p.hidden = true));
    panels[tab.dataset.tab].hidden = false;
  });
});

/* ===== 任务勾选：同步完成度 ===== */
const tasks = document.querySelectorAll(".task");
const burnFill = document.getElementById("burnFill");
let done = 24;
let total = 47;

tasks.forEach((task) => {
  const checkbox = task.querySelector('input:not([disabled])');
  if (!checkbox) return;
  checkbox.addEventListener("change", () => {
    const name = task.querySelector(".task__name");
    const badge = task.querySelector(".badge");
    if (checkbox.checked) {
      done += 1;
      name.classList.add("is-done");
      badge.textContent = "完成";
      badge.className = "badge badge--secondary";
      task.dataset.kind = "done";
      showToast(`「${name.textContent}」已完成`);
    } else {
      done -= 1;
      name.classList.remove("is-done");
      badge.textContent = "进行中";
      badge.className = "badge";
      task.dataset.kind = "doing";
    }
    const pct = Math.round((done / total) * 100);
    burnFill.style.setProperty("--w", pct + "%");
    burnFill.parentElement.parentElement.querySelector(".labels span").textContent = `完成度 ${pct}%`;
  });
});

/* ===== Feed 筛选 ===== */
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    tasks.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 故事点 chip ===== */
const pointChips = document.querySelectorAll(".chips--point .chip");
pointChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    pointChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 新建任务 ===== */
const taskInput = document.getElementById("taskInput");
const taskTable = document.getElementById("taskTable");

function createTask() {
  const text = (taskInput.value || "").trim();
  if (!text) {
    showToast("先填任务标题");
    return;
  }
  const point = document.querySelector(".chips--point .is-active").textContent;
  total += 1;
  const li = document.createElement("li");
  li.className = "task";
  li.dataset.kind = "todo";
  li.innerHTML = `
    <label><input type="checkbox"><i></i></label>
    <div class="task__body">
      <span class="task__name"></span>
      <span class="task__meta">NEW-1 · 你 · ${point}</span>
    </div>
    <span class="badge badge--outline">待办</span>`;
  li.querySelector(".task__name").textContent = text;
  const cb = li.querySelector("input");
  cb.addEventListener("change", () => {
    if (cb.checked) {
      done += 1;
      li.querySelector(".task__name").classList.add("is-done");
      li.querySelector(".badge").textContent = "完成";
      li.querySelector(".badge").className = "badge badge--secondary";
      li.dataset.kind = "done";
    }
  });
  taskTable.prepend(li);
  taskInput.value = "";
  showToast("任务已创建并进入待办");
}

document.getElementById("createBtn").addEventListener("click", createTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createTask();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      taskInput.focus();
      showToast("输入标题 + 估点，回车创建");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
