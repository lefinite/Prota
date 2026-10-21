// mobile-previews/posthog — 事件追踪
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 事件筛选 / 按钮 Toast / 橙色悬停惊喜

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 30000);

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1600);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// PostHog 签名交互：悬停时橙色惊喜
function applyPostHogHover(element) {
  element.addEventListener("mouseenter", function() {
    if (window.matchMedia("(hover: hover)").matches) {
      // 悬停时橙色文字惊喜
      const hasTextElements = this.querySelectorAll(".event-item__title, .metric-card__value, .chip");
      if (hasTextElements.length > 0) {
        hasTextElements.forEach(el => {
          el.style.color = "var(--accent)";
        });
      } else {
        this.style.color = "var(--accent)";
      }
    }
  });

  element.addEventListener("mouseleave", function() {
    const hasTextElements = this.querySelectorAll(".event-item__title, .metric-card__value, .chip");
    if (hasTextElements.length > 0) {
      hasTextElements.forEach(el => {
        el.style.color = "";
      });
    } else {
      this.style.color = "";
    }
  });
}

// 应用签名交互
document.querySelectorAll(".event-item, .metric-card, .chip").forEach(applyPostHogHover);

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 事件筛选
const chips = document.querySelectorAll("#filterChips .chip");
const eventItems = document.querySelectorAll("#eventList .event-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    eventItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 模拟实时事件流
function addRealTimeEvent() {
  const eventList = document.getElementById("eventList");
  if (!eventList) return;

  const eventTypes = [
    { type: "pageview", icon: "📄", title: "pageview", path: "/docs" },
    { type: "click", icon: "🖱️", title: "button_click", path: "cta_demo" },
    { type: "pageview", icon: "📄", title: "pageview", path: "/api" },
    { type: "click", icon: "🖱️", title: "link_click", path: "nav_features" }
  ];

  const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const newEvent = document.createElement("li");
  newEvent.className = "event-item";
  newEvent.dataset.type = randomEvent.type;
  newEvent.innerHTML = `
    <span class="event-item__icon">${randomEvent.icon}</span>
    <div class="event-item__main">
      <span class="event-item__title">${randomEvent.title}</span>
      <span class="event-item__sub">${randomEvent.path} · 刚刚</span>
    </div>
    <span class="badge badge--success">成功</span>
  `;

  // 应用悬停效果
  applyPostHogHover(newEvent);

  eventList.insertBefore(newEvent, eventList.firstChild);

  // 保持最多 7 个事件
  while (eventList.children.length > 7) {
    eventList.removeChild(eventList.lastChild);
  }

  // 检查当前筛选状态
  const activeChip = document.querySelector("#filterChips .chip.is-active");
  if (activeChip && activeChip.dataset.filter !== "all" && activeChip.dataset.filter !== randomEvent.type) {
    newEvent.classList.add("is-hidden");
  }
}

// 每 5 秒添加一个新事件
setInterval(addRealTimeEvent, 5000);
