/* ============================================================
 * Demo Studio 企业控制台 · Chakra UI 视觉语言
 * 纯原生 DOM state 落地 React 组件等价交互
 * ============================================================ */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SVG_NS = "http://www.w3.org/2000/svg";
  var SVG_TAGS = { svg: 1, path: 1, circle: 1, rect: 1, line: 1, polyline: 1, polygon: 1, g: 1, defs: 1, use: 1 };

  function appendChild(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { appendChild(parent, c); }); return; }
    if (typeof child === "string" || typeof child === "number") {
      parent.appendChild(document.createTextNode(String(child)));
    } else {
      parent.appendChild(child);
    }
  }

  function el(tag, attrs, children) {
    var node = SVG_TAGS[tag] ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") node.setAttribute("class", v);
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "style" && typeof v === "object") {
          for (var sk in v) node.style[sk] = v[sk];
        }
        else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "checked" || k === "disabled" || k === "selected") {
          if (v === true) node.setAttribute(k, "");
          else if (v === false) { /* skip */ }
          else node.setAttribute(k, v);
          if (k === "checked" && v) node.checked = true;
        }
        else node.setAttribute(k, v);
      }
    }
    if (children != null) appendChild(node, children);
    return node;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  /* ---------- Avatar ---------- */
  function avatarColor(id) {
    var n = 0;
    for (var i = 0; i < id.length; i++) n += id.charCodeAt(i);
    return "av-" + ((n % 8) + 1);
  }

  function initials(name) {
    return name ? name.charAt(0) : "?";
  }

  /* ---------- Toast ---------- */
  var toastWrap = $("#toastWrap");

  function toast(msg, type) {
    type = type || "success";
    var icons = {
      success: '<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
      error: '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'
    };
    var t = el("div", { class: "ck-toast ck-toast-" + type }, [
      el("span", { class: "ck-toast-icon", html: '<svg viewBox="0 0 24 24" class="ck-icon">' + icons[type] + "</svg>" }),
      el("span", { text: msg })
    ]);
    toastWrap.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(40px)";
      t.style.transition = "opacity .25s, transform .25s";
      setTimeout(function () { t.remove(); }, 260);
    }, 2600);
  }

  /* ============================================================
   * 数据（Mock）
   * ============================================================ */
  var DEPARTMENTS = ["直播一部", "直播二部", "电商事业部", "内容运营部", "客户成功部"];

  var MEMBERS = [
    { id: "M1042", name: "林婉清", phone: "138****2841", dept: "直播一部", role: "资深业务员", status: "active", liveRooms: 38, gmv: 4286000, joinAt: "2023-03-12", quota: 5000000 },
    { id: "M1037", name: "赵子轩", phone: "139****6025", dept: "直播二部", role: "业务员", status: "active", liveRooms: 24, gmv: 2154000, joinAt: "2023-06-08", quota: 3000000 },
    { id: "M1051", name: "韩梅梅", phone: "137****9182", dept: "电商事业部", role: "业务组长", status: "active", liveRooms: 56, gmv: 6732000, joinAt: "2022-11-21", quota: 6000000 },
    { id: "M1019", name: "陈志远", phone: "135****3370", dept: "内容运营部", role: "业务员", status: "suspended", liveRooms: 9, gmv: 386000, joinAt: "2024-01-15", quota: 2000000 },
    { id: "M1063", name: "吴雅婷", phone: "188****0457", dept: "直播一部", role: "业务员", status: "pending", liveRooms: 0, gmv: 0, joinAt: "2025-08-09", quota: 1500000 },
    { id: "M1028", name: "黄俊杰", phone: "186****7733", dept: "客户成功部", role: "资深业务员", status: "active", liveRooms: 31, gmv: 3418000, joinAt: "2023-01-30", quota: 4000000 },
    { id: "M1055", name: "罗静雯", phone: "133****5519", dept: "直播二部", role: "业务员", status: "active", liveRooms: 17, gmv: 1247000, joinAt: "2024-04-02", quota: 2500000 },
    { id: "M1060", name: "宋浩然", phone: "131****8842", dept: "电商事业部", role: "业务员", status: "pending", liveRooms: 0, gmv: 0, joinAt: "2025-08-10", quota: 1500000 },
    { id: "M1044", name: "高思琪", phone: "159****2267", dept: "内容运营部", role: "业务组长", status: "active", liveRooms: 42, gmv: 3892000, joinAt: "2022-08-17", quota: 4500000 },
    { id: "M1071", name: "蔡明辉", phone: "152****6608", dept: "直播一部", role: "业务员", status: "suspended", liveRooms: 5, gmv: 142000, joinAt: "2024-09-23", quota: 2000000 }
  ];

  var ACTIVITIES = [
    { name: "韩梅梅", color: "av-3", text: "完成了直播 <strong>「618 品牌盛典」</strong>，GMV <strong>¥86,400</strong>", time: "12 分钟前" },
    { name: "赵子轩", color: "av-2", text: "新增了直播间 <strong>「夏季新品发布」</strong>，等待审核", time: "38 分钟前" },
    { name: "陈志远", color: "av-4", text: "账号被 <strong>停用</strong>，触发风控规则 R-014", time: "1 小时前" },
    { name: "吴雅婷", color: "av-5", text: "提交了 <strong>入职资料</strong>，待审批", time: "2 小时前" },
    { name: "黄俊杰", color: "av-6", text: "更新了客户 <strong>「示例客户」</strong> 的合作方案", time: "4 小时前" }
  ];

  /* ---------- 状态 ---------- */
  var state = {
    view: "overview",
    search: "",
    deptFilter: "all",
    statusFilter: "all",
    page: 1,
    pageSize: 6,
    selected: {},
    members: MEMBERS.slice()
  };

  /* ============================================================
   * 渲染：概览
   * ============================================================ */
  function renderOverview() {
    var peakIdx = 0, peakVal = 0;
    var chartData = [
      { d: "周一", v: 32 },
      { d: "周二", v: 45 },
      { d: "周三", v: 38 },
      { d: "周四", v: 61 },
      { d: "周五", v: 72 },
      { d: "周六", v: 95 },
      { d: "周日", v: 54 }
    ];
    chartData.forEach(function (c, i) { if (c.v > peakVal) { peakVal = c.v; peakIdx = i; } });
    var maxV = Math.max.apply(null, chartData.map(function (c) { return c.v; }));

    var kpis = [
      { label: "在播直播间", value: "24", unit: "场", trend: "+18%", up: true, icon: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4Z", iconClass: "ck-kpi-icon-blue", note: "较上周" },
      { label: "今日 GMV", value: "28.6", unit: "万", trend: "+12.4%", up: true, icon: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16h-.05C7.92 5.55 6.5 6.75 6.5 8.78c0 2.28 1.88 3.41 4.66 4.08 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.92 3.84V23h3v-2.15c1.95-.37 3.5-1.44 3.5-3.57 0-2.84-2.43-3.81-4.9-4.4Z", iconClass: "ck-kpi-icon-green", note: "较昨日" },
      { label: "活跃业务员", value: "142", unit: "人", trend: "+6", up: true, icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Z", iconClass: "ck-kpi-icon-orange", note: "本周新增" },
      { label: "待审核任务", value: "7", unit: "项", trend: "-3", up: false, icon: "M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3Zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66Z", iconClass: "ck-kpi-icon-teal", note: "较昨日" }
    ];

    var kpiRow = el("div", { class: "ck-kpi-row" }, kpis.map(function (k) {
      return el("div", { class: "ck-kpi" }, [
        el("div", { class: "ck-kpi-top" }, [
          el("span", { class: "ck-kpi-label", text: k.label }),
          el("span", { class: "ck-kpi-icon " + k.iconClass, html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="' + k.icon + '"/></svg>' })
        ]),
        el("div", { class: "ck-kpi-value", html: escapeHTML(k.value) + '<span class="unit">' + escapeHTML(k.unit) + '</span>' }),
        el("div", { class: "ck-kpi-foot" }, [
          el("span", { class: "ck-trend " + (k.up ? "ck-trend-up" : "ck-trend-down"), html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="' + (k.up ? "M7 14l5-5 5 5z" : "M7 10l5 5 5-5z") + '"/></svg>' + escapeHTML(k.trend) }),
          el("span", { class: "ck-trend-note", text: k.note })
        ])
      ]);
    }));

    /* 图表 */
    var chart = el("div", { class: "ck-card" }, [
      el("div", { class: "ck-chart-head ck-card-pad", style: "padding-bottom:0" }, [
        el("div", null, [
          el("div", { class: "ck-card-title", text: "本周直播场次趋势" }),
          el("div", { class: "ck-card-sub", text: "每日开播场次 · 峰值出现在周六" })
        ]),
        el("div", { class: "ck-segment" }, [
          el("button", { class: "ck-seg-btn is-active", text: "本周" }),
          el("button", { class: "ck-seg-btn", text: "上周" }),
          el("button", { class: "ck-seg-btn", text: "本月" })
        ])
      ]),
      el("div", { class: "ck-chart" }, [
        el("div", { class: "ck-chart-bars" }, chartData.map(function (c, i) {
          return el("div", { class: "ck-chart-bar" + (i === peakIdx ? " is-peak" : "") }, [
            el("div", { class: "ck-chart-bar-track" }, [
              el("div", { class: "ck-chart-bar-fill", style: "height:" + (c.v / maxV * 100) + "%" }, [
                el("div", { class: "ck-chart-bar-tooltip", text: c.v + " 场" })
              ])
            ]),
            el("span", { class: "ck-chart-bar-label", text: c.d })
          ]);
        }))
      ])
    ]);

    /* 活动流 */
    var actList = el("div", { class: "ck-card" }, [
      el("div", { class: "ck-card-head" }, [
        el("div", { class: "ck-card-title", text: "最近动态" }),
        el("a", { class: "ck-btn-link", text: "查看全部" })
      ]),
      el("div", null, ACTIVITIES.map(function (a) {
        return el("div", { class: "ck-act-item" }, [
          el("div", { class: "ck-act-avatar " + a.color, text: initials(a.name) }),
          el("div", { class: "ck-act-body" }, [
            el("div", { class: "ck-act-text", html: '<strong>' + escapeHTML(a.name) + '</strong> ' + a.text }),
            el("div", { class: "ck-act-time", text: a.time })
          ])
        ]);
      }))
    ]);

    var grid = el("div", { class: "ck-grid-2" }, [chart, actList]);

    return [
      pageHead("概览", "实时掌握直播业务核心指标与团队动态", "工作台 / 概览"),
      kpiRow,
      grid
    ];
  }

  /* ============================================================
   * 渲染：业务员管理
   * ============================================================ */
  function renderMembers() {
    var filtered = state.members.filter(function (m) {
      var matchSearch = !state.search ||
        m.name.indexOf(state.search) >= 0 ||
        m.id.toLowerCase().indexOf(state.search.toLowerCase()) >= 0 ||
        m.phone.indexOf(state.search) >= 0;
      var matchDept = state.deptFilter === "all" || m.dept === state.deptFilter;
      var matchStatus = state.statusFilter === "all" || m.status === state.statusFilter;
      return matchSearch && matchDept && matchStatus;
    });

    var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * state.pageSize;
    var pageData = filtered.slice(start, start + state.pageSize);
    var allOnPageSelected = pageData.length > 0 && pageData.every(function (m) { return state.selected[m.id]; });

    var nodes = [
      pageHead("业务员管理", "管理团队成员、账号状态与业绩目标", "工作台 / 业务员管理", el("button", {
        class: "ck-btn ck-btn-primary",
        onclick: openCreateDrawer,
        html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z"/></svg>新增业务员'
      }))
    ];

    /* 工具栏 */
    var toolbar = el("div", { class: "ck-toolbar" }, [
      el("div", { class: "ck-search-inline" }, [
        el("span", { class: "ck-search-inline-icon", html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"/></svg>' }),
        el("input", {
          class: "ck-input",
          type: "text",
          placeholder: "搜索姓名 / 工号 / 手机号",
          value: state.search,
          oninput: function (e) { state.search = e.target.value; state.page = 1; rerenderMembers(); }
        })
      ]),
      el("select", {
        class: "ck-select",
        onchange: function (e) { state.deptFilter = e.target.value; state.page = 1; rerenderMembers(); }
      }, [["all", "全部部门"]].concat(DEPARTMENTS.map(function (d) { return [d, d]; })).map(function (o) {
        return el("option", { value: o[0], selected: state.deptFilter === o[0], text: o[1] });
      })),
      el("div", { class: "ck-segment" }, [["all", "全部"], ["active", "在岗"], ["pending", "待审批"], ["suspended", "已停用"]].map(function (s) {
        return el("button", {
          class: "ck-seg-btn" + (state.statusFilter === s[0] ? " is-active" : ""),
          text: s[1],
          onclick: function () { state.statusFilter = s[0]; state.page = 1; rerenderMembers(); }
        });
      })),
      el("div", { style: "flex:1" }),
      Object.keys(state.selected).length > 0 ? el("span", { class: "ck-badge ck-badge-info", text: "已选 " + Object.keys(state.selected).length + " 项" }) : null,
      Object.keys(state.selected).length > 0 ? el("button", { class: "ck-btn ck-btn-sm", onclick: function () {
        Object.keys(state.selected).forEach(function (id) { toggleMemberStatus(id); });
        toast("已批量更新 " + Object.keys(state.selected).length + " 名成员状态", "success");
      }, html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3Z"/></svg>批量启用' }) : null
    ]);
    nodes.push(toolbar);

    /* 表格 */
    var tableWrap = el("div", { class: "ck-card", style: "overflow:hidden" });

    if (filtered.length === 0) {
      tableWrap.appendChild(emptyState("没有符合条件的业务员", "尝试调整搜索关键词或筛选条件"));
      nodes.push(tableWrap);
      return nodes;
    }

    var table = el("table", { class: "ck-table" });
    var thead = el("thead", null, [el("tr", null, [
      el("th", { style: "width:36px" }, [el("input", {
        type: "checkbox",
        class: "ck-check",
        checked: allOnPageSelected,
        onchange: function (e) {
          pageData.forEach(function (m) {
            if (e.target.checked) state.selected[m.id] = true;
            else delete state.selected[m.id];
          });
          rerenderMembers();
        }
      })]),
      el("th", { text: "成员" }),
      el("th", { text: "部门" }),
      el("th", { text: "状态" }),
      el("th", { text: "直播间", style: "text-align:right" }),
      el("th", { text: "累计 GMV", style: "text-align:right" }),
      el("th", { text: "目标完成", style: "min-width:130px" }),
      el("th", { text: "操作", style: "text-align:right" })
    ])]);
    table.appendChild(thead);

    var tbody = el("tbody", null, pageData.map(function (m) {
      var pct = m.quota > 0 ? Math.min(100, Math.round(m.gmv / m.quota * 100)) : 0;
      var progColor = pct >= 80 ? "var(--success)" : pct >= 40 ? "var(--warning)" : "var(--danger)";
      var statusInfo = {
        active: { cls: "ck-badge-success", text: "在岗", dot: "var(--success)" },
        pending: { cls: "ck-badge-warning", text: "待审批", dot: "var(--warning)" },
        suspended: { cls: "ck-badge-danger", text: "已停用", dot: "var(--danger)" }
      }[m.status];

      return el("tr", null, [
        el("td", null, [el("input", {
          type: "checkbox",
          class: "ck-check",
          checked: !!state.selected[m.id],
          onchange: function (e) {
            if (e.target.checked) state.selected[m.id] = true;
            else delete state.selected[m.id];
            rerenderMembers();
          }
        })]),
        el("td", null, [el("div", { class: "ck-cell-name" }, [
          el("div", { class: "ck-cell-avatar " + avatarColor(m.id), text: initials(m.name) }),
          el("div", { class: "ck-cell-meta" }, [
            el("span", { style: "font-weight:600", text: m.name }),
            el("span", { class: "ck-cell-id", text: m.id + " · " + m.phone })
          ])
        ])]),
        el("td", null, [
          el("div", { text: m.dept }),
          el("div", { class: "ck-cell-id", text: m.role })
        ]),
        el("td", null, [el("span", { class: "ck-badge " + statusInfo.cls }, [
          el("span", { class: "ck-dot", style: "background:" + statusInfo.dot }),
          el("span", { text: statusInfo.text })
        ])]),
        el("td", { class: "ck-num", style: "text-align:right", text: String(m.liveRooms) }),
        el("td", { class: "ck-num", style: "text-align:right", text: "¥" + formatNum(m.gmv) }),
        el("td", null, [
          el("div", { style: "display:flex;align-items:center;gap:8px" }, [
            el("div", { class: "ck-prog", style: "flex:1" }, [el("div", { class: "ck-prog-fill", style: "width:" + pct + "%;background:" + progColor })]),
            el("span", { style: "font-size:12px;font-weight:600;color:var(--text-secondary);min-width:32px;text-align:right", text: pct + "%" })
          ])
        ]),
        el("td", { style: "text-align:right;white-space:nowrap" }, [
          el("button", { class: "ck-btn-link", onclick: function () { openDetailDialog(m); }, text: "详情" }),
          m.status === "active"
            ? el("button", { class: "ck-btn-link", style: "color:var(--danger)", onclick: function () { openSuspendDialog(m); }, text: "停用" })
            : el("button", { class: "ck-btn-link", style: "color:var(--success)", onclick: function () { toggleMemberStatus(m.id); toast("已启用 " + m.name, "success"); }, text: "启用" })
        ])
      ]);
    }));
    table.appendChild(tbody);
    tableWrap.appendChild(el("div", { class: "ck-table-wrap" }, [table]));

    /* 分页 */
    var pager = el("div", { class: "ck-pager" }, [
      el("div", { class: "ck-pager-info", html: "共 <strong>" + filtered.length + "</strong> 名业务员 · 第 " + state.page + " / " + totalPages + " 页" }),
      el("div", { class: "ck-pager-btns" }, [
        el("button", { class: "ck-pg-btn", disabled: state.page <= 1, onclick: function () { state.page--; rerenderMembers(); }, html: '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' }),
        range(1, totalPages).map(function (p) {
          return el("button", { class: "ck-pg-btn" + (p === state.page ? " is-active" : ""), text: String(p), onclick: function () { state.page = p; rerenderMembers(); } });
        }),
        el("button", { class: "ck-pg-btn", disabled: state.page >= totalPages, onclick: function () { state.page++; rerenderMembers(); }, html: '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' })
      ])
    ]);
    tableWrap.appendChild(pager);

    nodes.push(tableWrap);
    return nodes;
  }

  /* ============================================================
   * 占位视图（直播管理 / 审核中心 / 数据中心 / 系统设置）
   * ============================================================ */
  function renderPlaceholder(title, desc, hint) {
    return [
      pageHead(title, desc, "工作台 / " + title),
      el("div", { class: "ck-card ck-card-pad" }, [
        emptyState(hint || "该模块正在建设中", "可通过左侧导航切换到已完成的模块")
      ])
    ];
  }

  /* ============================================================
   * 公共渲染辅助
   * ============================================================ */
  function pageHead(title, desc, crumb, action) {
    return el("div", { class: "ck-page-head" }, [
      el("div", null, [
        crumb ? el("div", { class: "ck-breadcrumb", html: '<a href="#">工作台</a><span>/</span><span>' + escapeHTML(crumb.split(" / ")[1] || title) + '</span>' }) : null,
        el("h1", { class: "ck-page-title", text: title }),
        desc ? el("p", { class: "ck-page-desc", text: desc }) : null
      ]),
      action || null
    ].filter(Boolean));
  }

  function emptyState(title, desc) {
    return el("div", { class: "ck-empty" }, [
      el("div", { class: "ck-empty-icon", html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"/></svg>' }),
      el("div", { class: "ck-empty-title", text: title }),
      desc ? el("div", { class: "ck-empty-desc", text: desc }) : null
    ]);
  }

  function formatNum(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + " 万";
    return n.toLocaleString("zh-CN");
  }

  function range(a, b) {
    var r = [];
    for (var i = a; i <= b; i++) r.push(i);
    return r;
  }

  /* ============================================================
   * 交互：业务员状态 / 详情 / 停用 / 新建
   * ============================================================ */
  function toggleMemberStatus(id) {
    var m = findMember(id);
    if (!m) return;
    if (m.status === "active") m.status = "suspended";
    else if (m.status === "suspended") m.status = "active";
    if (state.view === "members") rerenderMembers();
  }

  function findMember(id) {
    return state.members.filter(function (m) { return m.id === id; })[0];
  }

  /* ---------- 详情 Dialog ---------- */
  function openDetailDialog(m) {
    var statusInfo = {
      active: { cls: "ck-badge-success", text: "在岗", dot: "var(--success)" },
      pending: { cls: "ck-badge-warning", text: "待审批", dot: "var(--warning)" },
      suspended: { cls: "ck-badge-danger", text: "已停用", dot: "var(--danger)" }
    }[m.status];
    var pct = m.quota > 0 ? Math.min(100, Math.round(m.gmv / m.quota * 100)) : 0;

    var body = el("div", null, [
      el("div", { style: "display:flex;align-items:center;gap:14px;margin-bottom:18px" }, [
        el("div", { class: "ck-cell-avatar " + avatarColor(m.id), style: "width:48px;height:48px;font-size:18px", text: initials(m.name) }),
        el("div", null, [
          el("div", { style: "font-size:17px;font-weight:700", text: m.name }),
          el("div", { style: "font-size:12.5px;color:var(--text-muted);margin-top:2px", text: m.id + " · " + m.role })
        ]),
        el("div", { style: "margin-left:auto" }, [el("span", { class: "ck-badge " + statusInfo.cls }, [
          el("span", { class: "ck-dot", style: "background:" + statusInfo.dot }), el("span", { text: statusInfo.text })
        ])])
      ]),
      infoGrid([
        ["手机号", m.phone],
        ["所属部门", m.dept],
        ["入职日期", m.joinAt],
        ["管理直播间", m.liveRooms + " 场"],
        ["累计 GMV", "¥" + formatNum(m.gmv)],
        ["年度目标", "¥" + formatNum(m.quota)]
      ]),
      el("div", { style: "margin-top:16px" }, [
        el("div", { style: "display:flex;justify-content:space-between;margin-bottom:6px" }, [
          el("span", { style: "font-size:12.5px;font-weight:600;color:var(--text-secondary)", text: "目标完成度" }),
          el("span", { style: "font-size:12.5px;font-weight:700", text: pct + "%" })
        ]),
        el("div", { class: "ck-prog" }, [el("div", { class: "ck-prog-fill", style: "width:" + pct + "%" })])
      ])
    ]);

    openDialog("成员详情", body, [
      el("button", { class: "ck-btn", onclick: closeOverlay, text: "关闭" }),
      el("button", { class: "ck-btn ck-btn-primary", onclick: function () {
        closeOverlay();
        toast("已跳转到 " + m.name + " 的完整档案", "success");
      }, text: "查看完整档案" })
    ]);
  }

  function infoGrid(rows) {
    return el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px 20px" }, rows.map(function (r) {
      return el("div", null, [
        el("div", { style: "font-size:11.5px;color:var(--text-muted);margin-bottom:3px", text: r[0] }),
        el("div", { style: "font-size:13.5px;font-weight:600", text: r[1] })
      ]);
    }));
  }

  /* ---------- 停用 Dialog ---------- */
  function openSuspendDialog(m) {
    var body = el("div", null, [
      el("p", { text: "停用后，" + m.name + "（" + m.id + "）将无法登录控制台、开播或管理直播间。你确定要继续吗？" }),
      el("div", { class: "ck-field", style: "margin-top:14px;margin-bottom:0" }, [
        el("label", { class: "ck-label", text: "停用原因" }),
        el("select", { class: "ck-select ck-input-block" }, [
          el("option", { text: "触发风控规则" }),
          el("option", { text: "主动离职 / 调岗" }),
          el("option", { text: "账号异常" }),
          el("option", { text: "其他" })
        ])
      ])
    ]);
    openDialog("停用成员", body, [
      el("button", { class: "ck-btn", onclick: closeOverlay, text: "取消" }),
      el("button", { class: "ck-btn ck-btn-danger", onclick: function () {
        m.status = "suspended";
        delete state.selected[m.id];
        closeOverlay();
        toast("已停用 " + m.name, "success");
        rerenderMembers();
      }, text: "确认停用" })
    ], true);
  }

  /* ---------- 新建 Drawer ---------- */
  function openCreateDrawer() {
    var form = { name: "", phone: "", dept: DEPARTMENTS[0], role: "业务员", quota: "1500000" };

    var body = el("div", null, [
      el("div", { class: "ck-field" }, [
        el("label", { class: "ck-label", html: '姓名<span class="req">*</span>' }),
        el("input", { class: "ck-input ck-input-block", placeholder: "请输入业务员姓名", oninput: function (e) { form.name = e.target.value; } })
      ]),
      el("div", { class: "ck-field" }, [
        el("label", { class: "ck-label", html: '手机号<span class="req">*</span>' }),
        el("input", { class: "ck-input ck-input-block", placeholder: "11 位手机号", oninput: function (e) { form.phone = e.target.value; } }),
        el("div", { class: "ck-hint", text: "将作为登录账号，初始密码通过短信发送" })
      ]),
      el("div", { class: "ck-field" }, [
        el("label", { class: "ck-label", text: "所属部门" }),
        el("select", { class: "ck-select ck-input-block", onchange: function (e) { form.dept = e.target.value; } },
          DEPARTMENTS.map(function (d) { return el("option", { value: d, text: d }); }))
      ]),
      el("div", { class: "ck-field" }, [
        el("label", { class: "ck-label", text: "岗位角色" }),
        el("div", { class: "ck-radio-row" }, ["业务员", "业务组长", "资深业务员"].map(function (r) {
          return el("label", { class: "ck-radio" }, [
            el("input", { type: "radio", name: "role", value: r, checked: r === form.role, onchange: function (e) { if (e.target.checked) form.role = r; } }),
            el("span", { text: r })
          ]);
        }))
      ]),
      el("div", { class: "ck-field" }, [
        el("label", { class: "ck-label", text: "年度 GMV 目标（元）" }),
        el("input", { class: "ck-input ck-input-block", type: "text", value: form.quota, oninput: function (e) { form.quota = e.target.value; } })
      ]),
      el("div", { class: "ck-field", style: "margin-bottom:0" }, [
        el("label", { class: "ck-label", text: "备注" }),
        el("textarea", { class: "ck-textarea", placeholder: "可选，填写岗位职责或特殊说明" })
      ])
    ]);

    openDrawer("新增业务员", "创建后账号状态为「待审批」", body, [
      el("button", { class: "ck-btn", onclick: closeOverlay, text: "取消" }),
      el("button", { class: "ck-btn ck-btn-primary", onclick: function () {
        if (!form.name.trim() || !form.phone.trim()) {
          toast("请填写姓名和手机号", "error");
          return;
        }
        var newId = "M" + (1072 + state.members.length);
        state.members.unshift({
          id: newId, name: form.name.trim(), phone: form.phone.trim(),
          dept: form.dept, role: form.role, status: "pending",
          liveRooms: 0, gmv: 0, joinAt: "2025-08-10", quota: parseInt(form.quota, 10) || 1500000
        });
        closeOverlay();
        toast("已创建业务员 " + form.name.trim() + "，等待审批", "success");
        state.page = 1;
        state.statusFilter = "all";
        rerenderMembers();
      }, html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>创建' })
    ]);
  }

  /* ============================================================
   * Overlay 基础设施（Drawer / Dialog）
   * ============================================================ */
  var overlay = $("#overlay");
  var currentLayer = null;

  function openDrawer(title, sub, bodyNode, footNodes) {
    closeOverlay(true);
    var drawer = el("div", { class: "ck-drawer" }, [
      el("div", { class: "ck-drawer-head" }, [
        el("div", null, [
          el("div", { class: "ck-drawer-title", text: title }),
          sub ? el("div", { class: "ck-drawer-sub", text: sub }) : null
        ].filter(Boolean)),
        el("button", { class: "ck-icon-btn", onclick: closeOverlay, html: '<svg viewBox="0 0 24 24" class="ck-icon"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' })
      ]),
      el("div", { class: "ck-drawer-body" }, [bodyNode]),
      el("div", { class: "ck-drawer-foot" }, footNodes)
    ]);
    showOverlay(drawer);
  }

  function openDialog(title, bodyNode, footNodes) {
    closeOverlay(true);
    var dialog = el("div", { class: "ck-dialog" }, [
      el("div", { class: "ck-dialog-head" }, [el("div", { class: "ck-dialog-title", text: title })]),
      el("div", { class: "ck-dialog-body" }, [bodyNode]),
      el("div", { class: "ck-dialog-foot" }, footNodes)
    ]);
    showOverlay(dialog);
  }

  function showOverlay(layer) {
    overlay.hidden = false;
    currentLayer = layer;
    document.body.appendChild(layer);
  }

  function closeOverlay(silent) {
    overlay.hidden = true;
    if (currentLayer) { currentLayer.remove(); currentLayer = null; }
  }

  overlay.addEventListener("click", closeOverlay);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && currentLayer) closeOverlay();
  });

  /* ============================================================
   * 主渲染 & 路由
   * ============================================================ */
  var content = $("#content");

  function render() {
    content.innerHTML = "";
    var nodes;
    switch (state.view) {
      case "overview": nodes = renderOverview(); break;
      case "members": nodes = renderMembers(); break;
      case "live": nodes = renderPlaceholder("直播管理", "管理所有直播间、排期与推流配置", "直播管理模块正在建设中"); break;
      case "review": nodes = renderPlaceholder("审核中心", "处理内容审核、风控与申诉任务", "审核中心模块正在建设中"); break;
      case "data": nodes = renderPlaceholder("数据中心", "查看直播数据、转化漏斗与团队排行", "数据中心模块正在建设中"); break;
      case "settings": nodes = renderPlaceholder("系统设置", "配置组织架构、权限与集成", "系统设置模块正在建设中"); break;
      default: nodes = renderOverview();
    }
    nodes.forEach(function (n) { if (n) content.appendChild(n); });
  }

  function rerenderMembers() {
    if (state.view !== "members") return;
    render();
  }

  /* ---------- 导航 ---------- */
  $$("#nav .ck-nav-item").forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      state.view = item.dataset.view;
      $$("#nav .ck-nav-item").forEach(function (n) { n.classList.toggle("is-active", n === item); });
      $("#sidebar").classList.remove("is-open");
      render();
    });
  });

  /* ---------- 移动端菜单 ---------- */
  var menuToggle = $("#menuToggle");
  var sidebar = $("#sidebar");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.toggle("is-open");
    });
  }

  /* 移动端：点击主区域关闭抽屉式侧边栏 */
  $(".ck-main").addEventListener("click", function () {
    if (sidebar.classList.contains("is-open")) {
      sidebar.classList.remove("is-open");
    }
  });

  /* ---------- 全局搜索快捷键 ---------- */
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      var gs = $("#globalSearch");
      if (gs) gs.focus();
    }
  });

  /* ---------- 启动 ---------- */
  render();
})();
