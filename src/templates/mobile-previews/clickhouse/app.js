// 夜航 · ClickHouse 设计系统 — 页面交互
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

/* ===== 日志状态 chip 筛选 ===== */
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

/* ===== 关注查询 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    star.setAttribute("aria-label", on ? "取消关注" : "关注");
    showToast(on ? "已关注，慢于 1s 会推送告警" : "已取消关注");
  });
});

/* ===== 执行查询：写入日志 + 随机延迟 ===== */
const sqlInput = document.getElementById("sqlInput");
const feedList = document.getElementById("feedList");

function runQuery() {
  const sql = (sqlInput.value || "").trim();
  if (!sql) {
    showToast("先输入一条 SQL");
    sqlInput.focus();
    return;
  }
  const table = (sql.match(/from\s+([a-z_]+)/i) || [, "manual_query"])[1];
  const ms = Math.round(Math.random() * 640 + 40);
  const slow = ms > 500;
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = slow ? "slow" : "ok";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />
      </svg>
    </span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">${clock} · 手动执行 <em class="feed-item__chip ${slow ? "feed-item__chip--slow" : "feed-item__chip--ok"}">${slow ? "慢" : "OK"}</em></span>
    </div>
    <b class="feed-item__lat">${ms}ms</b>
    <button class="feed-item__star" type="button" aria-label="关注" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `${table} · 手动`;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  sqlInput.value = "";
  showToast(slow ? `执行完成 · ${ms}ms，已标记慢查询` : `执行完成 · ${ms}ms`);
}

document.getElementById("runBtn").addEventListener("click", runQuery);
sqlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runQuery();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "总览") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "查询" || name === "告警") {
      document.getElementById("feedSection").scrollIntoView({ behavior: "smooth" });
    } else if (name === "执行") {
      sqlInput.focus();
      showToast("输入 SQL，回车执行");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
