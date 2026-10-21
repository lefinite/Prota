// 清单 · Clean 设计系统 — 页面交互
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

/* ===== 任务 chip 筛选 ===== */
const feedItems = () => Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems().forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 计数与进度联动 ===== */
const doneCount = document.getElementById("doneCount");
const totalCount = document.getElementById("totalCount");
const todayFill = document.getElementById("todayFill");

function refreshCount() {
  const items = feedItems();
  const done = items.filter((i) => i.classList.contains("is-done")).length;
  doneCount.textContent = String(done);
  totalCount.textContent = `/${items.length}`;
  todayFill.style.setProperty("--w", `${items.length ? Math.round((done / items.length) * 100) : 0}%`);
}

/* ===== 完成切换：勾选 + 划线 ===== */
function bindBox(box) {
  box.addEventListener("click", () => {
    const item = box.closest(".feed-item");
    const done = item.classList.toggle("is-done");
    box.setAttribute("aria-pressed", String(done));
    box.setAttribute("aria-label", done ? "取消完成" : "完成任务");
    const meta = item.querySelector(".feed-item__meta");
    if (meta) {
      const kindText = meta.textContent.split("·")[0].trim();
      meta.childNodes[0].textContent = `${kindText} · ${done ? "已完成" : "进行中"} `;
    }
    refreshCount();
  });
}

document.querySelectorAll(".feed-item__box").forEach(bindBox);
refreshCount();

/* ===== 添加任务 ===== */
const taskInput = document.getElementById("taskInput");
const feedList = document.getElementById("feedList");

function addTask() {
  const text = (taskInput.value || "").trim();
  if (!text) {
    showToast("先写下要做的事");
    taskInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "life";
  li.innerHTML = `
    <button class="feed-item__box" type="button" aria-label="完成任务" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </button>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">生活 · 进行中</span>
    </div>`;
  li.querySelector(".feed-item__name").textContent = text;
  bindBox(li.querySelector(".feed-item__box"));
  feedList.prepend(li);
  taskInput.value = "";
  refreshCount();
  showToast("已添加到今天");
}

document.getElementById("addBtn").addEventListener("click", addTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

/* ===== 清除已完成 ===== */
document.getElementById("clearBtn").addEventListener("click", () => {
  const done = feedItems().filter((i) => i.classList.contains("is-done"));
  if (!done.length) {
    showToast("没有已完成的任务");
    return;
  }
  done.forEach((i) => i.remove());
  refreshCount();
  showToast(`已清除 ${done.length} 项，干得漂亮`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "今天") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "计划") {
      document.getElementById("feedSection").scrollIntoView({ behavior: "smooth" });
    } else if (name === "添加") {
      taskInput.focus();
      showToast("写下任务，回车保存");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
