// 快驿 · Uber — 页面交互
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

/* ===== ETA 倒数 ===== */
const etaNum = document.getElementById("etaNum");
let eta = 4;

setInterval(() => {
  if (eta > 1) {
    eta -= 1;
    etaNum.textContent = eta;
  } else if (eta === 1) {
    etaNum.textContent = "已";
    etaNum.nextElementSibling.textContent = "到达";
    showToast("陈师傅已到达上车点，请留意白色荣威");
    eta = 0;
  }
}, 8000);

/* ===== 取消行程（二次确认）===== */
let confirming = false;

document.getElementById("cancelBtn").addEventListener("click", function () {
  if (!confirming) {
    confirming = true;
    this.textContent = "再点一次确认取消";
    showToast("司机正在赶来，再点一次才会取消（收 ¥8 取消费）");
    setTimeout(() => {
      confirming = false;
      this.textContent = "取消行程";
    }, 4000);
  } else {
    showToast("行程已取消 · 费用将计入下次行程");
    confirming = false;
    this.textContent = "取消行程";
  }
});

/* ===== Feed 筛选 ===== */
const trips = Array.from(document.querySelectorAll(".trip"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    trips.forEach((trip) => {
      trip.hidden = filter !== "all" && trip.dataset.kind !== filter;
    });
  });
});

/* ===== 常用地址 chip ===== */
const presetChips = document.querySelectorAll(".chips--preset .chip");
presetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    presetChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`目的地已设为：${chip.textContent}`);
  });
});

/* ===== 行点击 ===== */
trips.forEach((trip) => {
  trip.addEventListener("click", () => {
    showToast(`行程详情：${trip.querySelector(".trip__name").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "叫车") {
      showToast("输入目的地，即刻派单");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
