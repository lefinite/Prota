// 丛簿 · MongoDB 风格 — 页面交互
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

/* ===== 遥测实时跳动 ===== */
const opsNum = document.getElementById("opsNum");
const lag2 = document.getElementById("lag2");
const lag3 = document.getElementById("lag3");
const lagFill = document.getElementById("lagFill");

setInterval(() => {
  const ops = 11000 + Math.round(Math.random() * 4000);
  opsNum.textContent = ops.toLocaleString("en-US");
  const l2 = (Math.random() * 1.4).toFixed(1);
  const l3 = (Math.random() * 1.8).toFixed(1);
  lag2.textContent = l2 + "s";
  lag3.textContent = l3 + "s";
  const maxLag = Math.max(parseFloat(l2), parseFloat(l3));
  lagFill.style.setProperty("--w", Math.min(100, maxLag * 20) + "%");
}, 2200);

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 数据库 chip ===== */
const dbChips = document.querySelectorAll(".chips--db .chip");
let db = "orders";
dbChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    dbChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    db = chip.textContent;
    document.getElementById("queryInput").placeholder = `db.${db}.find({ ... })`;
  });
});

/* ===== EXPLAIN ===== */
const queryInput = document.getElementById("queryInput");

document.getElementById("explainBtn").addEventListener("click", () => {
  const q = queryInput.value.trim() || `db.${db}.find({})`;
  showToast(`EXPLAIN 完成 · IXSCAN · 命中索引 _id_ · 2ms`);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "slow";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🧭</span>
    <div class="feed-item__body">
      <span class="feed-item__name mono">explain: ${db}</span>
      <span class="feed-item__meta">刚刚 · IXSCAN · totalDocsExamined 12</span>
    </div>
    <em class="state state--ok">2ms</em>`;
  document.querySelector(".feed__list").prepend(li);
});

queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("explainBtn").click();
});

/* ===== 节点点击：查看详情 ===== */
document.querySelectorAll(".hero__nodes li").forEach((node) => {
  node.addEventListener("click", () => {
    const name = node.querySelector("b").textContent;
    showToast(`${name} · rs.status() 正常 · 最近心跳 2s 前`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "查询") {
      queryInput.focus();
      showToast("输入查询语句，回车执行 EXPLAIN");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
