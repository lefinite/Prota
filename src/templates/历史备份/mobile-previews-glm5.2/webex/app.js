// mobile-previews/webex — TeamSync Collaboration
// Status bar time + toast + tab switching + space filtering

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

// Buttons with data-toast
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// Tab switching
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--meet")) {
      showToast("Starting new meeting...");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--meet")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `Switched to ${label.textContent}` : "Tab changed");
  });
});

// Space tabs filtering
const spaceTabs = document.querySelectorAll(".space-tabs .space-tab");
const spaceItems = document.querySelectorAll("#spaceList .space-item");
spaceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    spaceTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    const filter = tab.dataset.filter;
    spaceItems.forEach((item) => {
      if (filter === "all") {
        item.style.display = "flex";
      } else if (filter === "unread") {
        item.style.display = item.dataset.unread === "true" ? "flex" : "none";
      } else if (filter === "favorites") {
        // For demo, show first 2 as "favorites"
        const index = Array.from(spaceItems).indexOf(item);
        item.style.display = index < 2 ? "flex" : "none";
      }
    });
  });
});
