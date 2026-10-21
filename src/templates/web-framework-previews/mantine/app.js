/* ============================================================
   Mantine Ops — 交互逻辑
   导航 / 范围切换 / KPI / 趋势图 / 时间线 / 任务 / 成员表 / 看板 / 弹窗 / 抽屉 / 主题
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const AVA_COLORS = ["#4c6ef5", "#7048e8", "#1c7ed6", "#37b24d", "#f59f00", "#f03e3e", "#0ca678", "#e8590c"];

  /* ---------- 数据 ---------- */
  const NAV_LABEL = { overview: "运营概览", members: "成员管理", tasks: "任务中心", billing: "订阅账单", security: "安全审计" };

  const KPI = {
    "7d": [
      { label: "日活成员", value: "1,284", trend: "+12.4%", up: true, color: "blue", spark: [40, 55, 48, 62, 58, 72, 80] },
      { label: "新建任务", value: "326", trend: "+8.1%", up: true, color: "violet", spark: [30, 42, 38, 50, 46, 60, 66] },
      { label: "待处理", value: "28", trend: "-5", up: false, color: "orange", spark: [60, 55, 50, 48, 44, 40, 35] },
      { label: "完成任务", value: "94", trend: "+11", up: true, color: "green", spark: [35, 40, 48, 52, 60, 68, 78] },
    ],
    "30d": [
      { label: "日活成员", value: "1,420", trend: "+18.7%", up: true, color: "blue", spark: [30, 38, 45, 42, 55, 60, 72, 68, 78, 85] },
      { label: "新建任务", value: "1,204", trend: "+22.3%", up: true, color: "violet", spark: [25, 30, 36, 40, 48, 52, 60, 64, 72, 80] },
      { label: "待处理", value: "46", trend: "+12", up: false, color: "orange", spark: [40, 42, 38, 50, 48, 55, 52, 60, 58, 64] },
      { label: "完成任务", value: "1,158", trend: "+204", up: true, color: "green", spark: [30, 35, 42, 50, 55, 62, 68, 74, 80, 88] },
    ],
    "90d": [
      { label: "日活成员", value: "1,560", trend: "+24.1%", up: true, color: "blue", spark: [25, 30, 28, 35, 40, 48, 55, 62, 70, 78] },
      { label: "新建任务", value: "3,680", trend: "+31.4%", up: true, color: "violet", spark: [20, 25, 30, 35, 42, 48, 55, 60, 68, 76] },
      { label: "待处理", value: "62", trend: "+18", up: false, color: "orange", spark: [30, 35, 33, 40, 45, 50, 48, 55, 58, 62] },
      { label: "完成任务", value: "3,418", trend: "+512", up: true, color: "green", spark: [22, 28, 35, 40, 48, 54, 62, 68, 75, 82] },
    ],
  };

  const TREND = {
    "7d": { active: [110, 130, 125, 145, 160, 150, 168], tasks: [42, 55, 48, 62, 70, 60, 72], labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] },
    "30d": { active: Array.from({ length: 30 }, (_, i) => 100 + Math.round(Math.sin(i / 2) * 30 + i)), tasks: Array.from({ length: 30 }, (_, i) => 40 + Math.round(Math.cos(i / 3) * 20 + i / 2)), labels: Array.from({ length: 30 }, (_, i) => String(i + 1)) },
    "90d": { active: Array.from({ length: 12 }, (_, i) => 110 + i * 12 + Math.round(Math.sin(i) * 20)), tasks: Array.from({ length: 12 }, (_, i) => 42 + i * 8 + Math.round(Math.cos(i) * 15)), labels: ["第1周", "第2周", "第3周", "第4周", "第5周", "第6周", "第7周", "第8周", "第9周", "第10周", "第11周", "第12周"] },
  };

  const ACTIVITY = [
    { who: "林晓", color: AVA_COLORS[0], text: "创建了任务 <b>Q3 增长复盘</b>", time: "10 分钟前" },
    { who: "陈默", color: AVA_COLORS[2], text: "完成了任务 <b>客户分层标签</b>", time: "32 分钟前" },
    { who: "Maya", color: AVA_COLORS[1], text: "邀请了 <b>韩青</b> 加入工作区", time: "1 小时前" },
    { who: "苏野", color: AVA_COLORS[4], text: "更新了 <b>Scale 套餐</b> 的席位", time: "3 小时前" },
    { who: "叶舟", color: AVA_COLORS[6], text: "评论了任务 <b>夜间自动化规则</b>", time: "昨天" },
  ];

  const TASKS = [
    { title: "审核「深蓝科技」续费订单", meta: "市场部 · 今天 10:24", pri: "high", done: true },
    { title: "复核 Q3 发票申请（3 张）", meta: "财务部 · 11:00 到期", pri: "high", done: false },
    { title: "邀请新成员「林晓」加入工作区", meta: "来自 王芳 的申请", pri: "mid", done: false },
    { title: "配置「夜间自动化」规则", meta: "系统建议", pri: "mid", done: false },
    { title: "更新客户分层标签", meta: "本周待办", pri: "low", done: false },
  ];

  const BOARD = {
    todo: [
      { title: "落地 SSO 接入方案", meta: "优先级 高" },
      { title: "审核规则词库扩充", meta: "优先级 中" },
    ],
    doing: [
      { title: "成员导出性能优化", meta: "陈默 · 进行中" },
      { title: "订阅账单页改版", meta: "Maya · 进行中" },
    ],
    done: [
      { title: "邀请邮件模板更新", meta: "已完成" },
      { title: "审计日志接入", meta: "已完成" },
    ],
  };

  const STATUS_MAP = {
    active: { text: "活跃", cls: "m-badge-success" },
    pending: { text: "待激活", cls: "m-badge-warn" },
    disabled: { text: "已停用", cls: "m-badge-danger" },
  };
  const ROLE_MAP = { owner: "所有者", admin: "管理员", member: "成员", guest: "访客" };

  let members = [
    { name: "Maya Zhang", email: "maya@acme.com", role: "owner", status: "active", last: "刚刚", joined: "2024-01-12" },
    { name: "陈默", email: "chenmo@acme.com", role: "admin", status: "active", last: "5 分钟前", joined: "2024-03-04" },
    { name: "林晓", email: "linxiao@acme.com", role: "admin", status: "active", last: "1 小时前", joined: "2024-04-18" },
    { name: "苏野", email: "suye@acme.com", role: "member", status: "active", last: "今天", joined: "2024-06-09" },
    { name: "叶舟", email: "yezhou@acme.com", role: "member", status: "pending", last: "—", joined: "2024-08-02" },
    { name: "韩青", email: "hanqing@acme.com", role: "member", status: "pending", last: "—", joined: "2024-08-05" },
    { name: "王芳", email: "fang@acme.com", role: "guest", status: "active", last: "昨天", joined: "2024-07-21" },
    { name: "周明哲", email: "zhou@acme.com", role: "member", status: "disabled", last: "2 周前", joined: "2024-02-15" },
  ];

  let currentRange = "7d";

  /* ---------- Toast ---------- */
  function toast(msg, type = "") {
    const wrap = $("#toast-wrap");
    const el = document.createElement("div");
    el.className = "m-toast " + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      setTimeout(() => el.remove(), 260);
    }, 2200);
  }

  /* ---------- 渲染：KPI ---------- */
  function renderKPI() {
    const grid = $("#kpi-grid");
    const icos = {
      blue: '<svg class="m-icon" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
      violet: '<svg class="m-icon" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
      orange: '<svg class="m-icon" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
      green: '<svg class="m-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    };
    grid.innerHTML = KPI[currentRange].map((k) => {
      const spark = k.spark.map((h) => `<span style="height:${h}%"></span>`).join("");
      return `
        <div class="m-kpi-card">
          <div class="m-kpi-top">
            <div class="m-kpi-label">${k.label}</div>
            <div class="m-kpi-icon ${k.color}">${icos[k.color] || ""}</div>
          </div>
          <div class="m-kpi-value">${k.value}</div>
          <div class="m-kpi-trend ${k.up ? "up" : "down"}">${k.up ? "▲" : "▼"} ${k.trend} <span>较上周期</span></div>
          <div class="m-kpi-spark">${spark}</div>
        </div>`;
    }).join("");
  }

  /* ---------- 渲染：趋势图（SVG） ---------- */
  function renderChart() {
    const t = TREND[currentRange];
    const chart = $("#chart");
    const W = 600, H = 240, padL = 36, padR = 12, padT = 12, padB = 24;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = t.active.length;
    const max = Math.max(...t.active, ...t.tasks) * 1.15;
    const x = (i) => padL + (innerW * i) / Math.max(1, n - 1);
    const y = (v) => padT + innerH - (v / max) * innerH;
    const toPath = (arr) => arr.map((v, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const toArea = (arr) => toPath(arr) + ` L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    const ticks = 4;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const gy = padT + (innerH * i) / ticks;
      const val = Math.round(max - (max * i) / ticks);
      grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--m-border)" stroke-width="1"/>`;
      grid += `<text x="${padL - 8}" y="${gy + 3}" text-anchor="end" font-size="10" fill="var(--m-subtle)">${val}</text>`;
    }
    const xlab = t.labels.filter((_, i) => n <= 12 || i % Math.ceil(n / 8) === 0)
      .map((l, _i, arr) => { const i = t.labels.indexOf(l); return `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--m-subtle)">${l}</text>`; }).join("");
    const dots = t.active.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--m-primary)"/>`).join("");
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${grid}
      <path d="${toArea(t.tasks)}" fill="var(--m-primary)" opacity=".06"/>
      <path d="${toPath(t.active)}" fill="none" stroke="var(--m-primary)" stroke-width="2.5"/>
      <path d="${toPath(t.tasks)}" fill="none" stroke="var(--m-subtle)" stroke-width="2" stroke-dasharray="4 4"/>
      ${dots}
      ${xlab}
    </svg>`;
  }

  /* ---------- 渲染：时间线 ---------- */
  function renderActivity() {
    $("#activity-list").innerHTML = ACTIVITY.map((a) => `
      <li class="m-timeline-item">
        <div class="m-tl-dot" style="background:${a.color}">${a.who.slice(0, 1)}</div>
        <div class="m-tl-body">
          <div class="m-tl-text">${a.text}</div>
          <div class="m-tl-meta">${a.time}</div>
        </div>
      </li>`).join("");
  }

  /* ---------- 渲染：待办任务 ---------- */
  function renderTasks() {
    $("#task-list").innerHTML = TASKS.map((t, i) => `
      <li class="m-task-item ${t.done ? "done" : ""}" data-idx="${i}">
        <div class="m-task-check ${t.done ? "done" : ""}" data-toggle></div>
        <div class="m-task-info">
          <div class="m-task-title">${t.title}</div>
          <div class="m-task-meta">${t.meta}</div>
          <span class="m-task-pri ${t.pri}">${t.pri === "high" ? "高优先级" : t.pri === "mid" ? "中优先级" : "低优先级"}</span>
        </div>
      </li>`).join("");
  }

  /* ---------- 渲染：任务看板 ---------- */
  function renderBoard() {
    const cols = [
      { key: "todo", title: "待开始", items: BOARD.todo },
      { key: "doing", title: "进行中", items: BOARD.doing },
      { key: "done", title: "已完成", items: BOARD.done },
    ];
    $("#task-board").innerHTML = cols.map((c) => `
      <div class="m-board-col">
        <div class="m-board-head"><span class="m-board-title">${c.title}</span><span class="m-badge m-badge-light">${c.items.length}</span></div>
        ${c.items.map((it) => `<div class="m-board-card"><div class="m-board-card-title">${it.title}</div><div class="m-board-card-meta">${it.meta}</div></div>`).join("") || '<div class="m-muted" style="font-size:12px;padding:6px 2px">暂无任务</div>'}
      </div>`).join("");
  }

  /* ---------- 渲染：成员表 ---------- */
  let memberFilter = { q: "", status: "all", role: "all" };
  function filteredMembers() {
    return members.filter((m) => {
      if (memberFilter.status !== "all" && m.status !== memberFilter.status) return false;
      if (memberFilter.role !== "all" && m.role !== memberFilter.role) return false;
      if (memberFilter.q) {
        const q = memberFilter.q.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }
  function renderMembers() {
    const list = filteredMembers();
    const body = $("#member-tbody");
    body.innerHTML = list.map((m, i) => {
      const st = STATUS_MAP[m.status];
      const ro = ROLE_MAP[m.role];
      return `
        <tr data-email="${m.email}">
          <td class="m-col-check"><label class="m-check"><input type="checkbox" class="m-row-check" /><span></span></label></td>
          <td><div class="m-cell-user"><span class="m-avatar" style="background:${AVA_COLORS[i % AVA_COLORS.length]}">${m.name.slice(0, 1)}</span><div><div class="m-cell-name">${m.name}</div><div class="m-cell-email">${m.email}</div></div></div></td>
          <td><span class="m-role-pill ${m.role === "owner" ? "owner" : ""}">${ro}</span></td>
          <td><span class="m-badge ${st.cls}">${st.text}</span></td>
          <td class="m-muted">${m.last}</td>
          <td class="m-muted">${m.joined}</td>
          <td class="m-col-actions"><button class="m-btn m-btn-subtle m-btn-xs" data-stop>详情</button></td>
        </tr>`;
    }).join("") || `<tr><td colspan="7" class="m-muted" style="padding:40px;text-align:center">没有匹配的成员</td></tr>`;
    $("#member-count").textContent = `共 ${list.length} 名成员`;
    updateBulk();
  }
  function updateBulk() {
    const n = $$(".m-row-check:checked").length;
    $("#bulk-disable").disabled = n === 0;
  }

  /* ---------- 视图切换 ---------- */
  function switchView(name) {
    if (!NAV_LABEL[name]) return;
    $$(".m-view").forEach((v) => v.classList.toggle("m-hidden", v.dataset.view !== name));
    $$(".m-navlink").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
    $("#bc-current").textContent = NAV_LABEL[name];
    $(".m-scroll").scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 弹窗 / 抽屉 ---------- */
  function openModal() { $("#invite-modal").classList.remove("m-hidden"); }
  function closeModal() { $("#invite-modal").classList.add("m-hidden"); }
  function openDrawer(email) {
    const m = members.find((x) => x.email === email);
    if (!m) return;
    const st = STATUS_MAP[m.status];
    const idx = members.indexOf(m);
    $("#drawer-body").innerHTML = `
      <div class="m-drawer-profile">
        <div class="m-avatar m-avatar-gradient" style="background:${AVA_COLORS[idx % AVA_COLORS.length]}">${m.name.slice(0, 1)}</div>
        <div><div style="font-weight:700;font-size:16px">${m.name}</div><div class="m-muted" style="font-size:13px">${m.email}</div></div>
      </div>
      <div class="m-drawer-row"><span class="m-muted">角色</span><span>${ROLE_MAP[m.role]}</span></div>
      <div class="m-drawer-row"><span class="m-muted">状态</span><span class="m-badge ${st.cls}">${st.text}</span></div>
      <div class="m-drawer-row"><span class="m-muted">最后活跃</span><span>${m.last}</span></div>
      <div class="m-drawer-row"><span class="m-muted">加入时间</span><span>${m.joined}</span></div>`;
    $("#toggle-status").textContent = m.status === "disabled" ? "重新启用" : "停用账号";
    $("#toggle-status").dataset.email = email;
    $("#member-drawer").classList.remove("m-hidden");
    $("#member-drawer").setAttribute("aria-hidden", "false");
    $("#drawer-overlay").classList.remove("m-hidden");
  }
  function closeDrawer() {
    $("#member-drawer").classList.add("m-hidden");
    $("#member-drawer").setAttribute("aria-hidden", "true");
    $("#drawer-overlay").classList.add("m-hidden");
  }

  /* ---------- 事件 ---------- */
  function bind() {
    // 导航
    $$(".m-navlink").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); switchView(a.dataset.nav); }));

    // 范围切换
    $$("#range-segmented .m-seg").forEach((b) => b.addEventListener("click", () => {
      $$("#range-segmented .m-seg").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      currentRange = b.dataset.range;
      renderKPI(); renderChart();
    }));

    // 任务勾选
    $("#task-list").addEventListener("click", (e) => {
      const item = e.target.closest(".m-task-item");
      if (!item) return;
      const t = TASKS[+item.dataset.idx];
      if (e.target.closest("[data-toggle]") || e.target.closest(".m-task-title")) {
        t.done = !t.done;
        renderTasks();
      }
    });

    // 成员搜索 / 筛选
    $("#member-search").addEventListener("input", (e) => { memberFilter.q = e.target.value.trim(); renderMembers(); });
    $("#filter-status").addEventListener("change", (e) => { memberFilter.status = e.target.value; renderMembers(); });
    $("#filter-role").addEventListener("change", (e) => { memberFilter.role = e.target.value; renderMembers(); });

    // 全选
    $("#check-all").addEventListener("change", (e) => {
      $$(".m-row-check").forEach((c) => { c.checked = e.target.checked; });
      updateBulk();
    });
    $("#member-tbody").addEventListener("change", (e) => {
      if (e.target.classList.contains("m-row-check")) updateBulk();
    });
    $("#member-tbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-email]");
      if (!tr) return;
      if (e.target.closest("[data-stop]")) { openDrawer(tr.dataset.email); return; }
      openDrawer(tr.dataset.email);
    });
    $("#bulk-disable").addEventListener("click", () => {
      const targets = $$(".m-row-check:checked").map((c) => c.closest("tr").dataset.email);
      members = members.map((m) => targets.includes(m.email) ? { ...m, status: "disabled" } : m);
      renderMembers();
      toast(`已停用 ${targets.length} 个账号`, "success");
    });

    // 弹窗
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-action]");
      if (a) {
        const act = a.dataset.action;
        if (act === "invite") { openModal(); return; }
        if (act === "close-modal") { closeModal(); return; }
        if (act === "send-invite") {
          const email = $("#invite-email").value.trim();
          if (!email) { toast("请填写邮箱地址", "error"); return; }
          closeModal();
          $("#invite-email").value = ""; $("#invite-msg").value = "";
          toast(`邀请已发送至 ${email}`, "success");
          return;
        }
        if (act === "close-drawer") { closeDrawer(); return; }
        if (act === "toggle-status") {
          const m = members.find((x) => x.email === a.dataset.email);
          if (m) {
            m.status = m.status === "disabled" ? "active" : "disabled";
            renderMembers();
            closeDrawer();
            toast(m.status === "disabled" ? "账号已停用" : "账号已启用", "success");
          }
          return;
        }
        if (act === "export") { toast("报告生成中，完成后将发送邮件", "info"); return; }
        if (act === "upgrade") { toast("正在跳转套餐升级页…", "info"); return; }
        if (act === "manage-plan") { toast("订阅管理面板即将打开", "info"); return; }
        if (act === "view-all-activity") { toast("完整活动日志加载中…", "info"); return; }
        if (act === "new-task") { toast("新建任务面板即将上线", "info"); return; }
      }
    });
    $("#drawer-overlay").addEventListener("click", closeDrawer);
    $("#invite-modal").addEventListener("click", (e) => { if (e.target.id === "invite-modal") closeModal(); });

    // 主题切换
    $("#theme-toggle").addEventListener("click", () => {
      const app = $("#app");
      const dark = app.getAttribute("data-theme") === "dark";
      app.setAttribute("data-theme", dark ? "light" : "dark");
      renderChart();
      toast(dark ? "已切换至浅色主题" : "已切换至深色主题", "info");
    });

    // 侧栏折叠（移动端）
    $("#aside-toggle").addEventListener("click", () => $("#aside").classList.toggle("open"));

    // 全局快捷键
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeModal(); closeDrawer(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#global-search").focus(); }
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    $("#app").setAttribute("data-theme", "light");
    renderKPI();
    renderChart();
    renderActivity();
    renderTasks();
    renderBoard();
    renderMembers();
    bind();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
