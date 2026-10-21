/* ============================================================
   运营控制台 · Material Design 3 — 交互逻辑
   导航抽屉 / 视图切换 / KPI / 趋势图 / 成员表 / 订阅 / 活动 / 设置 / 弹窗 / Snackbar
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var AVA = ["#6750a4", "#7d5260", "#2563eb", "#2e7d32", "#ed6c02", "#0288d1", "#9c27b0", "#00897b"];

  var VIEW_TITLE = { overview: "概览", members: "成员管理", subscriptions: "订阅与计费", activity: "活动日志", settings: "工作区设置" };

  /* ---------- 数据 ---------- */
  var KPI = {
    "7d": [
      { label: "活跃成员", value: "847", delta: "+12.5%", up: true, color: "c-purple", spark: [40, 55, 48, 62, 58, 72, 80] },
      { label: "新增任务", value: "326", delta: "+8.1%", up: true, color: "c-blue", spark: [30, 42, 38, 50, 46, 60, 66] },
      { label: "待处理", value: "23", delta: "-5.1%", up: false, color: "c-orange", spark: [60, 55, 50, 48, 44, 40, 35] },
      { label: "完成任务", value: "303", delta: "+11.2%", up: true, color: "c-green", spark: [35, 40, 48, 52, 60, 68, 78] }
    ],
    "30d": [
      { label: "活跃成员", value: "1,204", delta: "+18.7%", up: true, color: "c-purple", spark: [30, 38, 45, 42, 55, 60, 72, 68, 78, 85] },
      { label: "新增任务", value: "1,284", delta: "+24.1%", up: true, color: "c-blue", spark: [25, 30, 36, 40, 48, 52, 60, 64, 72, 80] },
      { label: "待处理", value: "67", delta: "+3.2%", up: false, color: "c-orange", spark: [40, 42, 38, 50, 48, 55, 52, 60, 58, 64] },
      { label: "完成任务", value: "1,217", delta: "+19.6%", up: true, color: "c-green", spark: [30, 35, 42, 50, 55, 62, 68, 74, 80, 88] }
    ],
    "90d": [
      { label: "活跃成员", value: "2,109", delta: "+42.3%", up: true, color: "c-purple", spark: [25, 30, 28, 35, 40, 48, 55, 62, 70, 78] },
      { label: "新增任务", value: "3,849", delta: "+51.8%", up: true, color: "c-blue", spark: [20, 25, 30, 35, 42, 48, 55, 60, 68, 76] },
      { label: "待处理", value: "158", delta: "+11.4%", up: false, color: "c-orange", spark: [30, 35, 33, 40, 45, 50, 48, 55, 58, 62] },
      { label: "完成任务", value: "3,691", delta: "+47.2%", up: true, color: "c-green", spark: [22, 28, 35, 40, 48, 54, 62, 68, 75, 82] }
    ]
  };

  var TREND = {
    "7d": { au: [62, 78, 85, 71, 92, 45, 38], task: [38, 52, 61, 44, 73, 22, 18], labels: ["一", "二", "三", "四", "五", "六", "日"] },
    "30d": { au: Array.from({ length: 14 }, function (_, i) { return 50 + Math.round(Math.sin(i / 1.5) * 22 + i * 2); }), task: Array.from({ length: 14 }, function (_, i) { return 30 + Math.round(Math.cos(i / 2) * 18 + i); }), labels: Array.from({ length: 14 }, function (_, i) { return String(i * 2 + 1); }) },
    "90d": { au: Array.from({ length: 12 }, function (_, i) { return 60 + i * 8 + Math.round(Math.sin(i) * 18); }), task: Array.from({ length: 12 }, function (_, i) { return 35 + i * 6 + Math.round(Math.cos(i) * 14); }), labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"] }
  };

  var ACTIVITY = [
    { who: "李思琪", color: AVA[0], text: "<strong>李思琪</strong> 邀请了 <strong>Marcus Lee</strong> 加入工作区", time: "2 分钟前" },
    { who: "系统", color: AVA[4], text: "存储使用达到 <strong>48%</strong>，建议关注", time: "1 小时前" },
    { who: "Sarah", color: AVA[2], text: "<strong>Sarah Chen</strong> 更新了成员权限", time: "3 小时前" },
    { who: "陈雨桐", color: AVA[3], text: "<strong>陈雨桐</strong> 完成了任务「数据导出审核」", time: "5 小时前" },
    { who: "王浩然", color: AVA[5], text: "<strong>王浩然</strong> 发布了文档「Q3 路线图」", time: "昨天" }
  ];

  var TIMELINE = [
    { color: AVA[0], text: "<strong>张明轩</strong> 修改了工作区名称", time: "今天 14:20" },
    { color: AVA[3], text: "系统执行了 <strong>每日数据备份</strong>", time: "今天 04:00" },
    { color: AVA[2], text: "<strong>Sarah Chen</strong> 启用了双因素认证策略", time: "昨天 18:45" },
    { color: AVA[4], text: "<strong>李思琪</strong> 导出了成员报表", time: "昨天 11:12" },
    { color: AVA[5], text: "API 用量达到 <strong>25%</strong>", time: "2 天前" },
    { color: AVA[1], text: "<strong>王浩然</strong> 创建了新项目「增长实验」", time: "3 天前" }
  ];

  var STATUS = { active: { t: "活跃", c: "status-active" }, pending: { t: "待激活", c: "status-pending" }, disabled: { t: "已停用", c: "status-disabled" } };
  var ROLE = { owner: "所有者", admin: "管理员", member: "成员", guest: "访客" };

  var members = [
    { name: "张明轩", email: "mingxuan.z@readify.io", role: "owner", status: "active", last: "刚刚", joined: "2024-03-12" },
    { name: "李思琪", email: "siqi.li@readify.io", role: "admin", status: "active", last: "2 分钟前", joined: "2024-04-01" },
    { name: "王浩然", email: "haoran.w@readify.io", role: "admin", status: "active", last: "15 分钟前", joined: "2024-04-18" },
    { name: "陈雨桐", email: "yutong.chen@readify.io", role: "member", status: "active", last: "1 小时前", joined: "2024-05-02" },
    { name: "Sarah Chen", email: "sarah.c@readify.io", role: "member", status: "active", last: "3 小时前", joined: "2024-06-15" },
    { name: "刘子涵", email: "zihan.liu@readify.io", role: "member", status: "pending", last: "—", joined: "2024-08-08" },
    { name: "赵宇航", email: "yuhang.zhao@readify.io", role: "guest", status: "active", last: "昨天", joined: "2024-07-01" },
    { name: "孙佳琪", email: "jiaqi.sun@readify.io", role: "member", status: "disabled", last: "—", joined: "2024-05-20" }
  ];

  var invoices = [
    { no: "INV-20260801-012", date: "2026-08-01", amount: "¥899.00", status: "已支付" },
    { no: "INV-20260701-008", date: "2026-07-01", amount: "¥899.00", status: "已支付" },
    { no: "INV-20260601-005", date: "2026-06-01", amount: "¥899.00", status: "已支付" },
    { no: "INV-20260501-003", date: "2026-05-01", amount: "¥299.00", status: "已支付" }
  ];

  var period = "7d";
  var memberFilter = { q: "", status: "all" };
  var selected = {};

  /* ---------- Snackbar ---------- */
  function snack(msg) {
    var host = $("#snackbar-host");
    var el = document.createElement("div");
    el.className = "md-snackbar";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(function () { el.remove(); }, 300);
    }, 2400);
  }

  /* ---------- KPI ---------- */
  function renderKPI() {
    var grid = $("#kpi-grid");
    grid.innerHTML = KPI[period].map(function (k) {
      var spark = k.spark.map(function (h) { return '<span style="height:' + h + '%"></span>'; }).join("");
      return '<div class="kpi-card">'
        + '<div class="kpi-top"><div class="kpi-label">' + k.label + '</div><div class="kpi-icon ' + k.color + '">' + iconFor(k.label) + '</div></div>'
        + '<div class="kpi-value">' + k.value + '</div>'
        + '<div class="kpi-foot"><span class="kpi-delta ' + (k.up ? "up" : "down") + '">' + (k.up ? "▲" : "▼") + " " + k.delta + "</span><span>对比上一周期</span></div>"
        + '<div class="kpi-spark">' + spark + "</div></div>";
    }).join("");
  }
  function iconFor(label) {
    var p = {
      "活跃成员": "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
      "新增任务": "M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z",
      "待处理": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
      "完成任务": "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
    };
    return '<svg viewBox="0 0 24 24"><path d="' + (p[label] || "") + '"/></svg>';
  }

  /* ---------- Chart ---------- */
  function renderChart() {
    var t = TREND[period];
    var box = $("#chart");
    var W = 640, H = 240, padL = 36, padR = 12, padT = 12, padB = 26;
    var iw = W - padL - padR, ih = H - padT - padB;
    var n = t.au.length, max = Math.max.apply(null, t.au.concat(t.task)) * 1.12;
    var x = function (i) { return padL + (iw * i) / Math.max(1, n - 1); };
    var y = function (v) { return padT + ih - (v / max) * ih; };
    var path = function (arr) { return arr.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" "); };
    var area = path(t.au) + " L " + x(n - 1).toFixed(1) + " " + (padT + ih) + " L " + x(0).toFixed(1) + " " + (padT + ih) + " Z";
    var grid = "";
    for (var i = 0; i <= 4; i++) { var gy = padT + (ih * i) / 4; grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--outline-variant)"/><text x="' + (padL - 8) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="var(--on-surface-variant)">' + Math.round(max - (max * i) / 4) + "</text>"; }
    var dots = t.au.map(function (v, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="var(--primary)"/>'; }).join("");
    var xl = t.labels.map(function (l, i) { return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--on-surface-variant)">' + l + "</text>"; }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + grid + '<path d="' + area + '" fill="var(--primary)" opacity=".08"/><path d="' + path(t.au) + '" fill="none" stroke="var(--primary)" stroke-width="2.5"/><path d="' + path(t.task) + '" fill="none" stroke="var(--tertiary)" stroke-width="2" stroke-dasharray="4 4"/>' + dots + xl + "</svg>";
  }

  /* ---------- Activity / Timeline / Invoices ---------- */
  function renderActivity() {
    $("#activity-list").innerHTML = ACTIVITY.map(function (a) {
      return '<li class="activity-item"><div class="activity-dot" style="background:' + a.color + "1f;color:" + a.color + '">' + a.who.slice(0, 1) + '</div><div class="activity-body"><div class="activity-text">' + a.text + '</div><div class="activity-time">' + a.time + "</div></div></li>";
    }).join("");
  }
  function renderTimeline() {
    $("#timeline-list").innerHTML = TIMELINE.map(function (a) {
      return '<li class="timeline-item"><span class="timeline-dot" style="background:' + a.color + '"></span><div class="timeline-body"><div class="timeline-text">' + a.text + '</div><div class="timeline-meta">' + a.time + "</div></div></li>";
    }).join("");
  }
  function renderInvoices() {
    $("#invoice-list").innerHTML = invoices.map(function (iv) {
      return '<div class="invoice-item"><div><div class="invoice-no">' + iv.no + '</div><div class="invoice-date">' + iv.date + '</div></div><div style="text-align:right"><div>' + iv.amount + '</div><div class="invoice-date">' + iv.status + "</div></div></div>";
    }).join("");
  }

  /* ---------- Members ---------- */
  function filteredMembers() {
    return members.filter(function (m) {
      if (memberFilter.status !== "all" && m.status !== memberFilter.status) return false;
      if (memberFilter.q) { var q = memberFilter.q.toLowerCase(); if (m.name.toLowerCase().indexOf(q) < 0 && m.email.toLowerCase().indexOf(q) < 0) return false; }
      return true;
    });
  }
  function renderMembers() {
    var list = filteredMembers();
    var body = $("#member-tbody");
    body.innerHTML = list.map(function (m, i) {
      var st = STATUS[m.status], ck = selected[m.email] ? "checked" : "";
      return '<tr class="' + (selected[m.email] ? "is-selected" : "") + '" data-email="' + m.email + '">'
        + '<td class="col-check"><div class="md-checkbox ' + ck + '" data-toggle="' + m.email + '"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div></td>'
        + '<td><div class="cell-user"><span class="md-avatar md-avatar-sm" style="background:' + AVA[i % AVA.length] + '">' + m.name.slice(0, 1) + '</span><div><div class="cell-name">' + m.name + '</div><div class="cell-email">' + m.email + "</div></div></div></td>"
        + '<td><span class="role-pill ' + (m.role === "owner" ? "owner" : "") + '">' + ROLE[m.role] + "</span></td>"
        + '<td><span class="status-chip ' + st.c + '">' + st.t + "</span></td>"
        + '<td class="on-surface-variant">' + m.last + '</td>'
        + '<td class="on-surface-variant">' + m.joined + "</td>"
        + '<td class="col-actions"><button class="md-icon-btn md-icon-sm" data-act="toggle" data-email="' + m.email + '" title="切换状态"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button></td>'
        + "</tr>";
    }).join("") || '<tr><td colspan="7" class="on-surface-variant" style="padding:40px;text-align:center">没有匹配的成员</td></tr>';
    $("#member-count").textContent = "共 " + list.length + " 名成员";
    syncCheckAll();
  }
  function syncCheckAll() {
    var onPage = filteredMembers();
    var allSel = onPage.length > 0 && onPage.every(function (m) { return selected[m.email]; });
    var some = onPage.some(function (m) { return selected[m.email]; });
    var ca = $("#check-all");
    ca.classList.toggle("checked", allSel);
  }

  /* ---------- 视图切换 ---------- */
  function switchView(name) {
    if (!VIEW_TITLE[name]) return;
    $$(".md-view").forEach(function (v) { v.classList.toggle("hidden", v.dataset.view !== name); });
    $$("[data-nav]").forEach(function (b) { b.classList.toggle("active", b.dataset.nav === name); });
    $("#topbar-title-text").textContent = VIEW_TITLE[name];
    $("#fab").classList.toggle("hidden", name !== "overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 抽屉 ---------- */
  function openDrawer() { $("#nav-drawer").classList.add("open"); $("#nav-scrim").classList.add("show"); }
  function closeDrawer() { $("#nav-drawer").classList.remove("open"); $("#nav-scrim").classList.remove("show"); }

  /* ---------- 邀请弹窗 ---------- */
  function openInvite() { $("#invite-dialog").classList.remove("hidden"); }
  function closeInvite() { $("#invite-dialog").classList.add("hidden"); }

  /* ---------- 事件 ---------- */
  function bind() {
    // 导航（rail + drawer 共用 data-nav）
    document.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-nav]");
      if (nav) { e.preventDefault(); switchView(nav.dataset.nav); closeDrawer(); return; }

      var act = e.target.closest("[data-action]");
      if (act) {
        var a = act.dataset.action;
        if (a === "toggle-nav") { ($("#nav-drawer").classList.contains("open") ? closeDrawer() : openDrawer()); return; }
        if (a === "invite") { openInvite(); return; }
        if (a === "close-dialog") { closeInvite(); return; }
        if (a === "send-invite") {
          var email = $("#invite-email").value.trim();
          if (!email || email.indexOf("@") < 0) { snack("请输入有效的邮箱地址"); return; }
          members.unshift({ name: email.split("@")[0], email: email, role: $("#invite-role").value, status: "pending", last: "—", joined: "今日" });
          closeInvite(); $("#invite-email").value = "";
          renderMembers();
          snack("邀请已发送至 " + email);
          return;
        }
        if (a === "export") { snack("报表生成中，完成后将发送邮件"); return; }
        if (a === "upgrade" || a === "manage-plan") { switchView("subscriptions"); return; }
        if (a === "view-all-activity") { switchView("activity"); return; }
        if (a === "go-settings") { switchView("settings"); return; }
        if (a === "switch-plan") { snack("已切换到 " + act.dataset.plan + " 套餐（演示）", ); return; }
        if (a === "view-all-invoices") { snack("完整发票列表即将上线"); return; }
        if (a === "save-settings") { snack("设置已保存"); return; }
        if (a === "discard-settings") { snack("已放弃更改"); return; }
        if (a === "delete-workspace") { snack("危险操作已拦截（演示）"); return; }
      }

      // switch
      var sw = e.target.closest(".md-switch");
      if (sw) { sw.classList.toggle("active"); sw.setAttribute("aria-checked", sw.classList.contains("active")); return; }

      // 行内：成员复选框 / 状态切换
      var cb = e.target.closest("[data-toggle]");
      if (cb && cb.classList.contains("md-checkbox")) {
        var em = cb.dataset.toggle;
        selected[em] = !selected[em];
        renderMembers();
        return;
      }
      var tog = e.target.closest("[data-act='toggle']");
      if (tog) {
        var em2 = tog.dataset.email;
        var m = members.filter(function (x) { return x.email === em2; })[0];
        if (m) { m.status = m.status === "active" ? "disabled" : "active"; m.last = m.status === "active" ? "刚刚" : m.last; renderMembers(); snack(m.status === "disabled" ? "已停用 " + m.name : "已启用 " + m.name); }
        return;
      }
    });

    // 全选
    $("#check-all").addEventListener("click", function () {
      var onPage = filteredMembers();
      var allSel = onPage.every(function (m) { return selected[m.email]; });
      onPage.forEach(function (m) { selected[m.email] = !allSel; });
      renderMembers();
    });

    // 周期切换
    $("#period-seg").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      $$("#period-seg .seg-btn").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      period = b.dataset.tab;
      renderKPI(); renderChart();
    });

    // 成员搜索 / 筛选
    $("#member-search").addEventListener("input", function (e) { memberFilter.q = e.target.value.trim(); renderMembers(); });
    $("#filter-chips").addEventListener("click", function (e) {
      var c = e.target.closest("[data-value]"); if (!c) return;
      $$("#filter-chips .md-chip-filter").forEach(function (x) { x.classList.remove("active"); });
      c.classList.add("active");
      memberFilter.status = c.dataset.value;
      renderMembers();
    });

    // 抽屉遮罩关闭
    $("#nav-scrim").addEventListener("click", closeDrawer);

    // 顶栏滚动投影
    window.addEventListener("scroll", function () {
      $("#topbar").classList.toggle("elevated", window.scrollY > 4);
    });

    // ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeInvite(); closeDrawer(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); var s = $("#global-search"); if (s) s.focus(); }
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    renderKPI(); renderChart(); renderActivity(); renderTimeline(); renderInvoices(); renderMembers(); bind();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
