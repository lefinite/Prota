// 织页 · Webflow — 页面交互
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

/* ===== Publish ===== */
document.getElementById("publishBtn").addEventListener("click", () => {
  showToast("发布中… 正在构建 8 个页面");
  setTimeout(() => {
    showToast("已发布 v43 · CDN 全球生效");
  }, 1600);
});

/* ===== 画布层点击（选中态跟随）===== */
const layers = document.querySelectorAll(".layer");
const sel = document.querySelector(".hero__sel");
const crumb = document.querySelector(".hero__breadcrum");

layers.forEach((layer) => {
  layer.addEventListener("click", () => {
    const label = layer.querySelector(".mono").textContent;
    crumb.textContent = `Home / ${label}`;
    const top = layer.offsetTop;
    sel.style.top = top + "px";
    sel.style.height = layer.offsetHeight + "px";
    sel.style.bottom = "auto";
    showToast(`已选中：${label}`);
  });
});

/* ===== Feed 筛选 ===== */
const pages = Array.from(document.querySelectorAll(".page"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    pages.forEach((page) => {
      page.hidden = filter !== "all" && page.dataset.kind !== filter;
    });
  });
});

/* ===== 模板 chip ===== */
const tplChips = document.querySelectorAll(".chips--tpl .chip");
let tpl = "空白页";
tplChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    tplChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    tpl = chip.textContent;
  });
});

/* ===== 创建页面 ===== */
const pageInput = document.getElementById("pageInput");

document.getElementById("createBtn").addEventListener("click", () => {
  const name = (pageInput.value || "").trim();
  if (!name) {
    showToast("给页面起个名字");
    return;
  }
  const li = document.createElement("li");
  li.className = "page";
  li.dataset.kind = "draft";
  li.innerHTML = `
    <span class="page__thumb t-ab" aria-hidden="true"></span>
    <div class="page__body">
      <span class="page__name"></span>
      <span class="page__meta mono">/${name.toLowerCase().replace(/\s+/g, "-")} · ${tpl} · 未发布</span>
    </div>
    <em class="page__st mono st-draft">DRAFT</em>`;
  li.querySelector(".page__name").textContent = name;
  document.querySelector(".feed__list").prepend(li);
  pageInput.value = "";
  showToast(`已创建「${name}」（${tpl}）`);
});

pageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("createBtn").click();
});

/* ===== 页面行点击 ===== */
pages.forEach((page) => {
  page.addEventListener("click", () => {
    showToast(`在设计器中打开：${page.querySelector(".page__name").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "画布") {
      showToast("进入设计器 · 点选任意图层");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
