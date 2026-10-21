// 自动流 · Zapier — 页面交互
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

/* ===== 手动运行（链路逐段点亮）===== */
const links = document.querySelectorAll(".link");
const steps = document.querySelectorAll(".step");
let running = false;

document.getElementById("runBtn").addEventListener("click", () => {
  if (running) return;
  running = true;
  links.forEach((l) => (l.style.backgroundPosition = ""));
  showToast("手动运行：读取表单最新提交…");

  steps.forEach((s, i) => {
    setTimeout(() => {
      s.style.borderColor = "var(--accent)";
      s.style.transition = "border-color 200ms";
      if (i < links.length) links[i].style.background = "var(--accent)";
      if (i === steps.length - 1) {
        showToast("✓ 运行成功 · 工单 #4821 已建并通知值班组");
        setTimeout(() => {
          steps.forEach((s2) => (s2.style.borderColor = ""));
          links.forEach((l) => (l.style.background = ""));
          running = false;
        }, 1600);
      }
    }, 500 + i * 600);
  });
});

/* ===== Feed 筛选 ===== */
const zaprows = Array.from(document.querySelectorAll(".zaprow"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    zaprows.forEach((row) => {
      row.hidden = filter !== "all" && row.dataset.kind !== filter;
    });
  });
});

/* ===== 开关 toggle ===== */
document.querySelectorAll(".switch input").forEach((cb) => {
  cb.addEventListener("change", () => {
    const row = cb.closest(".zaprow");
    const led = row.querySelector(".zaprow__led");
    const meta = row.querySelector(".zaprow__meta");
    if (cb.checked) {
      row.dataset.kind = "on";
      led.classList.add("on");
      meta.textContent = "刚刚启用 · 监听中";
      showToast("Zap 已开启，正在监听触发");
    } else {
      row.dataset.kind = "off";
      led.classList.remove("on");
      meta.textContent = "已暂停 · 刚刚";
      showToast("Zap 已暂停");
    }
  });
});

/* ===== AI 帮我搭 ===== */
const ideaInput = document.getElementById("ideaInput");

document.getElementById("genBtn").addEventListener("click", () => {
  const idea = (ideaInput.value || "").trim();
  if (!idea) {
    showToast("先描述一件事，如：发票邮件自动归档");
    return;
  }
  showToast(`AI 草稿：邮件 → 提取 → 表格（3 步）已生成`);
  ideaInput.value = "";
});

ideaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("genBtn").click();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      ideaInput.focus();
      showToast("说一句话，AI 帮你搭工作流");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
