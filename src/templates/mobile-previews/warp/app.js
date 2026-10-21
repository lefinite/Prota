// 炭火 · Warp — 页面交互
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

/* ===== 打字机效果（当前块）===== */
const typeTarget = document.getElementById("typeTarget");
const typed = "just db-migrate ";
let ti = 0;

const typer = setInterval(() => {
  if (ti >= typed.length) {
    clearInterval(typer);
    return;
  }
  typeTarget.textContent += typed[ti];
  ti += 1;
}, 130);

/* ===== 执行命令（块状输出）===== */
const activeBlock = document.querySelector(".block.is-active");
const cmdInput = document.getElementById("cmdInput");

function runCommand(cmd) {
  const cmdEl = document.createElement("div");
  cmdEl.className = "block__cmd mono";
  cmdEl.innerHTML = '<span class="ps1">❯</span> ';
  cmdEl.appendChild(document.createTextNode(cmd));
  activeBlock.replaceChildren(cmdEl);

  const out = document.createElement("div");
  out.className = "block__out mono";
  activeBlock.appendChild(out);

  const lines = [
    ["mut", "→ 3 migrations pending"],
    ["ok", "✓ 001_add_orders_idx · 84ms"],
    ["ok", "✓ 002_split_address · 121ms"],
    ["ok", "✓ done in 0.4s"]
  ];
  lines.forEach(([cls, text], i) => {
    setTimeout(() => {
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = text;
      out.appendChild(p);
      activeBlock.scrollIntoView({ block: "nearest" });
    }, 450 + i * 450);
  });

  setTimeout(() => {
    const prompt = document.createElement("div");
    prompt.className = "block__cmd mono";
    prompt.innerHTML = '<span class="ps1">❯</span><span class="caret">▍</span>';
    activeBlock.appendChild(prompt);
  }, 450 + lines.length * 450 + 200);

  showToast(`已执行：${cmd}`);
}

document.getElementById("runBtn").addEventListener("click", () => {
  runCommand(cmdInput.value.trim() || "just db-migrate");
  cmdInput.value = "";
});

document.getElementById("execBtn").addEventListener("click", () => {
  runCommand(cmdInput.value.trim() || "pnpm test --filter orders");
  cmdInput.value = "";
});

cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("execBtn").click();
});

/* ===== 提示 chip ===== */
document.querySelectorAll("[data-hint]").forEach((btn) => {
  btn.addEventListener("click", () => {
    runCommand(btn.dataset.hint);
  });
});

/* ===== Feed 筛选 ===== */
const cmds = Array.from(document.querySelectorAll(".cmd"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    cmds.forEach((cmd) => {
      cmd.hidden = filter !== "all" && cmd.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏 toggle + 点击执行 ===== */
cmds.forEach((cmd) => {
  cmd.addEventListener("click", () => {
    runCommand(cmd.querySelector("b").textContent);
  });
  cmd.querySelector(".cmd__star").addEventListener("click", (e) => {
    e.stopPropagation();
    const star = e.currentTarget;
    const on = star.textContent === "★";
    star.textContent = on ? "☆" : "★";
    star.setAttribute("aria-pressed", String(!on));
    showToast(on ? "已取消收藏" : "已收藏该命令");
  });
});

/* ===== AI chip ===== */
const aiChips = document.querySelectorAll(".chips--ai .chip");
aiChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    cmdInput.value = chip.textContent;
    cmdInput.focus();
    showToast("已按描述生成命令，可直接执行");
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "AI") {
      cmdInput.focus();
      showToast("描述意图，AI 生成命令并解释");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
