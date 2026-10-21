// 霜台 · Vercel — 页面交互
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

/* ===== Deploy：日志流推进 ===== */
const log = document.querySelector(".hero__log");
const stateEl = document.querySelector(".hero__state");
const steps = [
  "▲ Cloning github.com/acme/store",
  "▲ Installing deps · pnpm 9.4 · 24s",
  "▲ Building · Next.js 15.3 · 46s",
  "▲ Uploading · 38 files · edge: 2 fn",
  "✓ Deployed to acme.vercel.app"
];

function deploy() {
  log.querySelectorAll("p:not(.log-ok)").forEach((p) => p.remove());
  stateEl.innerHTML = '<i class="dot dot--prev"></i>Building';
  let i = 0;
  const timer = setInterval(() => {
    if (i >= steps.length) {
      clearInterval(timer);
      stateEl.innerHTML = '<i class="dot dot--ok"></i>Ready';
      showToast("部署完成 · acme.vercel.app");
      return;
    }
    const p = document.createElement("p");
    if (steps[i].startsWith("✓")) {
      p.className = "log-ok";
    }
    p.textContent = steps[i];
    log.appendChild(p);
    i += 1;
  }, 600);
}

document.getElementById("deployBtn").addEventListener("click", () => {
  showToast("开始部署 main → Production");
  deploy();
});

document.getElementById("redeploy").addEventListener("click", () => {
  showToast("Redeploying d4c8f2e …");
  deploy();
});

/* ===== Feed 筛选 ===== */
const deps = Array.from(document.querySelectorAll(".dep"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    deps.forEach((dep) => {
      dep.hidden = filter !== "all" && dep.dataset.kind !== filter;
    });
  });
});

/* ===== 环境 chip ===== */
const envChips = document.querySelectorAll(".chips--env .chip");
envChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    envChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

/* ===== 行点击 ===== */
deps.forEach((dep) => {
  dep.addEventListener("click", () => {
    showToast(`部署详情：${dep.querySelector("b").textContent}`);
  });
});

/* ===== 命令输入 ===== */
const cmdInput = document.getElementById("cmdInput");
cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    showToast(`$ ${cmdInput.value} · 已加入队列`);
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "Deploy") {
      document.getElementById("deployBtn").click();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
