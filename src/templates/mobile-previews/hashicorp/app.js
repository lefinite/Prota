// Pilot · HashiCorp — 页面交互
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

/* ===== Terraform：批准计划 ===== */
const approveBtn = document.getElementById("approveBtn");
let approved = false;

approveBtn.addEventListener("click", () => {
  if (approved) {
    showToast("该计划已批准 · 等待自动执行窗口");
    return;
  }
  approved = true;
  approveBtn.textContent = "已批准";
  approveBtn.disabled = true;
  const foot = approveBtn.closest(".product-card").querySelector(".product-card__foot span");
  foot.textContent = "审批完成 2/2 · 执行窗口 23:30";
  showToast("计划已批准 · 已加入执行队列");
});

/* ===== Vault：立即轮换 ===== */
document.getElementById("rotateBtn").addEventListener("click", () => {
  showToast("轮换任务已入队 · 32 个密钥预计 40 秒");
});

/* ===== 工作负载筛选 ===== */
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

/* ===== 负载电源 toggle：优雅下线 / 恢复 ===== */
document.querySelectorAll(".feed-item__power").forEach((power) => {
  power.addEventListener("click", () => {
    const item = power.closest(".feed-item");
    const name = item.querySelector(".feed-item__name").textContent;
    const state = item.querySelector(".state");
    const off = power.classList.toggle("is-off");
    power.setAttribute("aria-pressed", String(off));

    if (off) {
      item.dataset.kind = "paused";
      state.className = "state state--paused";
      state.textContent = "已暂停";
      power.setAttribute("aria-label", `恢复 ${name}`);
      showToast(`已暂停 ${name} · 优雅下线中`);
    } else {
      item.dataset.kind = "ok";
      state.className = "state state--ok";
      state.textContent = "运行中";
      power.setAttribute("aria-label", `暂停 ${name}`);
      showToast(`${name} 已恢复调度`);
    }
  });
});

/* ===== 运维指令输入 ===== */
const quickInput = document.getElementById("quickInput");

function runCommand() {
  const cmd = (quickInput.value || "").trim();
  if (!cmd) {
    showToast("输入 nomad / consul / vault 指令后回车");
    quickInput.focus();
    return;
  }
  showToast(`已下发：${cmd}`);
  quickInput.value = "";
}

/* 执行计划：跑一次 terraform apply */
document.getElementById("applyBtn").addEventListener("click", () => {
  if (!approved) {
    showToast("计划尚未批准 · 先在上方完成审批");
    document.querySelector(".product-card--tf").scrollIntoView({ behavior: "smooth" });
    return;
  }
  showToast("terraform apply 已开始 · 任务 #8842");
});

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runCommand();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "任务") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "密钥") {
      document.querySelector(".product-card--vault").scrollIntoView({ behavior: "smooth" });
    } else if (name === "命令") {
      quickInput.focus();
      showToast("终端就绪 · 输入指令后回车");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
