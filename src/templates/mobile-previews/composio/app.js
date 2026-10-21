// flowdeck · Inspired by Composio — 页面交互
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

/* ===== 终端日志：持续追加（最多保留 7 行） ===== */
const termLog = document.getElementById("termLog");
const LOG_POOL = [
  { lv: "ok", text: "副本 api-2 就绪 · 端口 8081" },
  { lv: "run", text: "预热缓存 3,204 个键" },
  { lv: "info", text: "灰度 50% 流量已切换" },
  { lv: "ok", text: "就绪探针通过 · 8/8 pods" },
  { lv: "run", text: "同步连接器元数据 Slack" },
  { lv: "warn", text: "openai 连接器 429 · 已重试 1 次" },
  { lv: "ok", text: "索引重建完成 · 42ms" },
  { lv: "info", text: "旧版本 drain 中 · 0 活跃" },
  { lv: "run", text: "灰度 100% 流量已切换" }
];
let logCursor = 0;

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

function appendLog(entry) {
  if (!termLog) return;
  const li = document.createElement("li");
  li.innerHTML = `<span class="t">${stamp()}</span><span class="lv ${entry.lv}">${entry.lv}</span>${entry.text}`;
  termLog.appendChild(li);
  while (termLog.children.length > 7) {
    termLog.removeChild(termLog.firstElementChild);
  }
}

/* ===== 部署进度：每 2.2s 推进，到 100% 落定 ===== */
const deployState = document.getElementById("deployState");
const deployPct = document.getElementById("deployPct");
const deployFill = document.getElementById("deployFill");
const deployTrack = deployFill.closest(".hero-term__track");
let progress = 68;
let deployedNotified = false;

function renderProgress() {
  const display = Math.round(progress);
  deployPct.textContent = display + "%";
  deployFill.style.setProperty("--w", display + "%");
  deployFill.style.width = display + "%";
  deployTrack.setAttribute("aria-label", "部署进度 " + display + "%");
}

function tickDeploy() {
  if (progress >= 100) return;
  progress = Math.min(100, progress + Math.floor(Math.random() * 4) + 2);
  renderProgress();
  if (progress >= 100) {
    deployState.textContent = "DEPLOYED ✓";
    deployState.classList.add("is-done");
    appendLog({ lv: "ok", text: "deploy #4821 完成 · 总耗时 3m41s" });
    if (!deployedNotified) {
      deployedNotified = true;
      showToast("deploy #4821 部署成功");
    }
  }
}

setInterval(() => {
  if (progress < 100) {
    tickDeploy();
    appendLog(LOG_POOL[logCursor++ % LOG_POOL.length]);
  }
}, 2200);

/* ===== 重新部署 ===== */
document.getElementById("deployBtn").addEventListener("click", () => {
  progress = 4;
  deployedNotified = false;
  deployState.textContent = "DEPLOYING";
  deployState.classList.remove("is-done");
  renderProgress();
  if (termLog) termLog.innerHTML = "";
  appendLog({ lv: "run", text: "触发手动部署 deploy #4822" });
  appendLog({ lv: "info", text: "拉取镜像 api-gateway:v2.8.1" });
  showToast("已触发重新部署 #4822");
});

/* ===== 筛选：chip 状态 + 输入文本 组合过滤 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");
const filterInput = document.getElementById("filterInput");
let activeStatus = "all";

function applyFilter() {
  const keyword = (filterInput.value || "").trim().toLowerCase();
  feedItems.forEach((item) => {
    const statusOk = activeStatus === "all" || item.dataset.kind === activeStatus;
    const textOk = !keyword || (item.dataset.text || "").toLowerCase().includes(keyword);
    item.hidden = !(statusOk && textOk);
  });
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeStatus = chip.dataset.filter;
    applyFilter();
  });
});

filterInput.addEventListener("input", applyFilter);

/* ===== 置顶 toggle ===== */
document.querySelectorAll(".feed-item__pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const on = pin.classList.toggle("is-on");
    pin.setAttribute("aria-pressed", String(on));
    const id = pin.closest(".feed-item").querySelector(".feed-item__id").textContent;
    showToast(on ? `已置顶 ${id}` : "已取消置顶");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "运行") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "触发") {
      filterInput.focus();
      showToast("输入触发器名后回车，立即执行（演示）");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
