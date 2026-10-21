/*
 * Simi 控制台 · 运营中心
 * Semi Design 风格交互逻辑（原生 DOM 实现）
 */

(function () {
  "use strict";

  function semiIcon(name) {
    var paths = {
      gmv: '<path d="M7 4h10M8 8l4 4 4-4M12 12v8M8 15h8"/>',
      orders: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      customers: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
      task: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>',
      success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + "</svg>";
  }

  /* ============ Mock 数据 ============ */

  var KPI = [
    {
      key: "gmv",
      label: "总成交额（GMV）",
      value: "1,284,560",
      unit: "元",
      delta: 12.5,
      icon: "￥",
      iconColor: "blue",
      dominant: true,
      spark: [40, 55, 48, 62, 70, 65, 80, 88],
    },
    {
      key: "orders",
      label: "订单总数",
      value: "8,642",
      unit: "笔",
      delta: 8.3,
      icon: "▤",
      iconColor: "green",
      spark: [30, 38, 35, 50, 48, 60, 58, 72],
    },
    {
      key: "customers",
      label: "活跃客户",
      value: "1,205",
      unit: "家",
      delta: -2.1,
      icon: "◉",
      iconColor: "orange",
      spark: [60, 58, 62, 55, 50, 52, 48, 45],
    },
    {
      key: "task",
      label: "待处理任务",
      value: "23",
      unit: "项",
      delta: 0,
      icon: "✓",
      iconColor: "purple",
      spark: [20, 25, 22, 28, 24, 26, 23, 23],
    },
  ];

  var CHART = {
    orders: {
      current: [320, 410, 380, 520, 480, 610, 560, 680, 720, 640, 780, 820],
      previous: [280, 340, 320, 410, 390, 480, 450, 520, 560, 510, 600, 630],
    },
    revenue: {
      current: [42, 58, 51, 72, 66, 85, 78, 96, 104, 92, 112, 128],
      previous: [36, 45, 40, 55, 52, 64, 60, 72, 78, 70, 84, 92],
    },
    users: {
      current: [180, 210, 195, 240, 230, 280, 260, 310, 340, 320, 380, 410],
      previous: [150, 170, 165, 200, 190, 220, 210, 250, 270, 260, 300, 320],
    },
  };

  var CHART_LABELS = [
    "7/20", "7/23", "7/26", "7/29", "8/01", "8/04",
    "8/07", "8/10", "8/13", "8/16", "8/19", "8/22",
  ];

  var TODOS = [
    { id: 1, title: "审核「青木科技」企业资质材料", priority: "p0", due: "今天 18:00", done: false },
    { id: 2, title: "双十二大促方案提交评审", priority: "p1", due: "明天", done: false },
    { id: 3, title: "处理远洋传媒订单补款 #SM-0810-031", priority: "p0", due: "今天", done: false },
    { id: 4, title: "确认 Q3 财务结算明细", priority: "p1", due: "8/12", done: false },
    { id: 5, title: "会员日方案评审", priority: "p2", due: "已完成", done: true },
    { id: 6, title: "整理客户分层运营报告", priority: "p2", due: "8/15", done: false },
    { id: 7, title: "更新 API 配额扩容申请", priority: "p1", due: "8/14", done: false },
  ];

  var ORDERS = [
    { id: "SM-20260810-031", customer: "远洋传媒", avatarColor: "#0077fa", product: "直播推流服务 · 企业版", amount: 28800, status: "warning", statusText: "待补款", time: "2026-08-10 09:12", owner: "陈思远", ownerColor: "#fa541c" },
    { id: "SM-20260810-028", customer: "青木科技", avatarColor: "#00b368", product: "CDN 加速 · 2TB", amount: 6420, status: "success", statusText: "已完成", time: "2026-08-10 08:45", owner: "林晓彤", ownerColor: "#7b61ff" },
    { id: "SM-20260809-115", customer: "星河文创", avatarColor: "#7b61ff", product: "内容审核 API · 100万次", amount: 12800, status: "pending", statusText: "处理中", time: "2026-08-09 16:30", owner: "王哲彦", ownerColor: "#00b368" },
    { id: "SM-20260809-098", customer: "云栈数据", avatarColor: "#fa8c16", product: "对象存储 · 标准型", amount: 3600, status: "success", statusText: "已完成", time: "2026-08-09 14:08", owner: "赵敏华", ownerColor: "#0077fa" },
    { id: "SM-20260808-076", customer: "浪潮智联", avatarColor: "#13c2c2", product: "短信服务 · 50万条", amount: 9800, status: "error", statusText: "已取消", time: "2026-08-08 11:22", owner: "陈思远", ownerColor: "#fa541c" },
    { id: "SM-20260808-052", customer: "青木科技", avatarColor: "#00b368", product: "直播推流服务 · 标准版", amount: 9600, status: "success", statusText: "已完成", time: "2026-08-08 09:50", owner: "林晓彤", ownerColor: "#7b61ff" },
  ];

  var STATUS_TAG = {
    success: "tag-green",
    pending: "tag-blue",
    warning: "tag-orange",
    error: "tag-red",
  };

  var PRIORITY_TEXT = {
    p0: "P0",
    p1: "P1",
    p2: "P2",
  };

  var crumbMap = {
    overview: "数据概览",
    business: "业务管理",
    tasks: "任务中心",
    customers: "客户档案",
    orders: "订单流水",
    finance: "财务结算",
    members: "成员权限",
    settings: "系统设置",
  };

  /* ============ 工具 ============ */

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function toast(text, type) {
    var container = $("#toastContainer");
    var el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    var icon = type === "success" ? "success" : type === "error" ? "error" : "info";
    el.innerHTML = '<span class="toast-icon">' + semiIcon(icon) + "</span><span>" + text + "</span>";
    container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s";
      setTimeout(function () {
        el.remove();
      }, 250);
    }, 2400);
  }

  function formatMoney(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* ============ 渲染 KPI ============ */

  function renderKPI() {
    var grid = $("#kpiGrid");
    grid.innerHTML = KPI.map(function (k) {
      var deltaCls = k.delta > 0 ? "up" : k.delta < 0 ? "down" : "flat";
      var deltaArrow = k.delta > 0 ? "↑" : k.delta < 0 ? "↓" : "—";
      var sparkPath = sparklinePath(k.spark || []);
      return (
        '<div class="kpi-card' + (k.dominant ? " kpi-dominant" : "") + '">' +
        '<div class="kpi-head">' +
        '<span class="kpi-label">' + k.label + "</span>" +
        '<span class="kpi-icon ' + k.iconColor + '">' + semiIcon(k.key) + "</span>" +
        "</div>" +
        '<div class="kpi-value">' + k.value + '<span class="unit">' + k.unit + "</span></div>" +
        '<div class="kpi-foot">' +
        '<span class="kpi-delta ' + deltaCls + '">' + deltaArrow + " " + Math.abs(k.delta) + "%</span>" +
        "<span>较上周期</span>" +
        "</div>" +
        (sparkPath ? '<svg class="kpi-sparkline" width="64" height="24" viewBox="0 0 64 24"><path d="' + sparkPath + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "") +
        "</div>"
      );
    }).join("");
  }

  function sparklinePath(data) {
    if (!data.length) return "";
    var w = 64, h = 24, pad = 2;
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var range = max - min || 1;
    var step = (w - pad * 2) / (data.length - 1);
    return data
      .map(function (v, i) {
        var x = pad + i * step;
        var y = h - pad - ((v - min) / range) * (h - pad * 2);
        return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");
  }

  /* ============ 渲染图表 ============ */

  var currentMetric = "orders";

  function renderChart() {
    var wrap = $("#chartWrap");
    var data = CHART[currentMetric];
    var W = 720, H = 240, padL = 40, padR = 16, padT = 16, padB = 28;
    var cw = W - padL - padR;
    var ch = H - padT - padB;
    var allVals = data.current.concat(data.previous);
    var max = Math.max.apply(null, allVals);
    var niceMax = Math.ceil(max / 100) * 100 || Math.ceil(max * 1.1);
    var step = cw / (data.current.length - 1);

    function toPoints(arr) {
      return arr.map(function (v, i) {
        return [padL + i * step, padT + ch - (v / niceMax) * ch];
      });
    }

    function linePath(pts) {
      return pts
        .map(function (p, i) {
          return (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1);
        })
        .join(" ");
    }

    function areaPath(pts) {
      return linePath(pts) + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (padT + ch) + " L" + pts[0][0].toFixed(1) + " " + (padT + ch) + " Z";
    }

    var curPts = toPoints(data.current);
    var prevPts = toPoints(data.previous);

    var yTicks = [];
    for (var i = 0; i <= 4; i++) {
      var val = (niceMax / 4) * i;
      var y = padT + ch - (val / niceMax) * ch;
      yTicks.push({ val: val, y: y });
    }

    var xLabels = CHART_LABELS
      .map(function (l, i) {
        if (i % 2 === 0) {
          return '<text x="' + (padL + i * step).toFixed(1) + '" y="' + (H - 8) + '" fill="#86909C" font-size="10" text-anchor="middle">' + l + "</text>";
        }
        return "";
      })
      .join("");

    var grid = yTicks
      .map(function (t) {
        return (
          '<line x1="' + padL + '" y1="' + t.y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + t.y.toFixed(1) + '" stroke="#F0F2F5" stroke-width="1"/>' +
          '<text x="' + (padL - 8) + '" y="' + (t.y + 3).toFixed(1) + '" fill="#C9CDD4" font-size="10" text-anchor="end">' + Math.round(t.val) + "</text>"
        );
      })
      .join("");

    var dots = curPts
      .map(function (p) {
        return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#fff" stroke="#0077FA" stroke-width="1.5"/>';
      })
      .join("");

    wrap.innerHTML =
      '<svg width="100%" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" style="overflow:visible">' +
      grid +
      '<path d="' + areaPath(curPts) + '" fill="url(#semi-grad)" opacity="0.18"/>' +
      '<defs><linearGradient id="semi-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0077FA"/><stop offset="100%" stop-color="#0077FA" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + linePath(prevPts) + '" fill="none" stroke="#C9CDD4" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<path d="' + linePath(curPts) + '" fill="none" stroke="#0077FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots +
      xLabels +
      "</svg>";
  }

  /* ============ 渲染待办 ============ */

  function renderTodos() {
    var list = $("#todoList");
    list.innerHTML = TODOS.map(function (t) {
      return (
        '<li class="todo-item' + (t.done ? " done" : "") + '" data-id="' + t.id + '">' +
        '<span class="todo-check">✓</span>' +
        '<div class="todo-body">' +
        '<div class="todo-title">' + t.title + "</div>" +
        '<div class="todo-meta">' +
        '<span class="todo-priority ' + t.priority + '">' + PRIORITY_TEXT[t.priority] + "</span>" +
        "<span>·</span>" +
        "<span>" + t.due + "</span>" +
        "</div>" +
        "</div>" +
        "</li>"
      );
    }).join("");

    $all(".todo-item", list).forEach(function (el) {
      el.addEventListener("click", function () {
        var id = parseInt(el.dataset.id, 10);
        var item = TODOS.find(function (t) { return t.id === id; });
        if (item && !item.done) {
          item.done = true;
          el.classList.add("done");
          toast("已完成： " + item.title, "success");
        }
      });
    });
  }

  /* ============ 渲染订单表格 ============ */

  var orderState = { keyword: "", status: "all", selected: new Set() };

  function filteredOrders() {
    return ORDERS.filter(function (o) {
      var kw = orderState.keyword.trim().toLowerCase();
      var kwMatch = !kw || o.id.toLowerCase().indexOf(kw) > -1 || o.customer.toLowerCase().indexOf(kw) > -1;
      var stMatch = orderState.status === "all" || o.status === orderState.status;
      return kwMatch && stMatch;
    });
  }

  function renderOrders() {
    var tbody = $("#orderTbody");
    var empty = $("#emptyState");
    var table = $("#orderTable");
    var list = filteredOrders();

    if (!list.length) {
      table.style.display = "none";
      empty.style.display = "block";
      $("#pageInfo").textContent = "共 0 条";
      $("#footerSelected").textContent = "";
      return;
    }

    table.style.display = "";
    empty.style.display = "none";
    $("#pageInfo").textContent = "共 " + list.length + " 条";

    tbody.innerHTML = list
      .map(function (o) {
        var sel = orderState.selected.has(o.id) ? " selected" : "";
        var checked = orderState.selected.has(o.id) ? " checked" : "";
        var firstChar = o.customer.charAt(0);
        return (
          '<tr class="order-row' + sel + '" data-id="' + o.id + '">' +
          '<td class="col-check"><input type="checkbox" class="row-check"' + checked + " /></td>" +
          '<td><span class="order-id">' + o.id + "</span></td>" +
          '<td><div class="customer-cell"><span class="customer-avatar" style="background:' + o.avatarColor + '">' + firstChar + "</span>" + o.customer + "</div></td>" +
          "<td>" + o.product + "</td>" +
          '<td class="num-value">' + formatMoney(o.amount) + "</td>" +
          '<td><span class="tag ' + STATUS_TAG[o.status] + '"><i class="tag-dot"></i>' + o.statusText + "</span></td>" +
          '<td style="color:#86909C;font-size:12px">' + o.time + "</td>" +
          '<td><div class="customer-cell"><span class="customer-avatar" style="background:' + o.ownerColor + ';width:22px;height:22px;font-size:10px">' + o.owner.charAt(0) + "</span>" + o.owner + "</div></td>" +
          '<td class="op-col"><button class="row-op detail-btn">详情</button><button class="row-op danger del-btn">删除</button></td>' +
          "</tr>"
        );
      })
      .join("");

    bindRowEvents();
    updateFooterSelected();
  }

  function bindRowEvents() {
    $all(".order-row").forEach(function (row) {
      var cb = $(".row-check", row);
      cb.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = row.dataset.id;
        if (cb.checked) {
          orderState.selected.add(id);
          row.classList.add("selected");
        } else {
          orderState.selected.delete(id);
          row.classList.remove("selected");
        }
        updateFooterSelected();
        syncCheckAll();
      });

      var detailBtn = $(".detail-btn", row);
      detailBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toast("查看订单详情：" + row.dataset.id);
      });

      var delBtn = $(".del-btn", row);
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = row.dataset.id;
        row.style.transition = "opacity 0.2s";
        row.style.opacity = "0";
        setTimeout(function () {
          var idx = ORDERS.findIndex(function (o) { return o.id === id; });
          if (idx > -1) ORDERS.splice(idx, 1);
          orderState.selected.delete(id);
          renderOrders();
          toast("已删除订单 " + id, "success");
        }, 200);
      });
    });
  }

  function updateFooterSelected() {
    var el = $("#footerSelected");
    var n = orderState.selected.size;
    el.textContent = n ? "已选择 " + n + " 项" : "";
  }

  function syncCheckAll() {
    var all = $("#checkAll");
    var list = filteredOrders();
    var allChecked = list.length > 0 && list.every(function (o) { return orderState.selected.has(o.id); });
    all.checked = allChecked;
    all.indeterminate = !allChecked && orderState.selected.size > 0;
  }

  /* ============ 事件绑定 ============ */

  function bindEvents() {
    // 时间范围
    $all(".range-option").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all(".range-option").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        // 模拟数据微调
        toast("已切换到「" + btn.textContent + "」数据范围");
        renderChart();
      });
    });

    // 图表指标
    $all("#chartSeg .seg-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("#chartSeg .seg-item").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentMetric = btn.dataset.metric;
        renderChart();
      });
    });

    // 导出
    $("#exportBtn").addEventListener("click", function () {
      toast("报表生成中，稍后将发送到您的邮箱", "success");
    });

    // 创建任务
    $("#createBtn").addEventListener("click", openSheet);
    $("#sheetClose").addEventListener("click", closeSheet);
    $("#sheetCancel").addEventListener("click", closeSheet);
    $("#sheetMask").addEventListener("click", closeSheet);

    $("#sheetSubmit").addEventListener("click", function () {
      var name = $("#taskName").value.trim();
      var btn = this;
      if (!name) {
        toast("请输入任务名称", "error");
        $("#taskName").focus();
        return;
      }
      btn.classList.add("loading");
      btn.disabled = true;
      setTimeout(function () {
        btn.classList.remove("loading");
        btn.disabled = false;
        closeSheet();
        toast("任务「" + name + "」创建成功", "success");
        // 加入待办
        var newTodo = {
          id: Date.now(),
          title: name,
          priority: "p1",
          due: $("#taskDue").value || "未设置",
          done: false,
        };
        TODOS.unshift(newTodo);
        renderTodos();
      }, 900);
    });

    // 任务类型
    $all("#taskType .seg-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("#taskType .seg-item").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
      });
    });

    // tag input
    var tagField = $("#tagInputField");
    tagField.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && this.value.trim()) {
        e.preventDefault();
        var tag = document.createElement("span");
        tag.className = "tag tag-blue";
        tag.textContent = this.value.trim() + " ×";
        tag.style.cursor = "pointer";
        tag.addEventListener("click", function () { tag.remove(); });
        this.parentNode.insertBefore(tag, this);
        this.value = "";
      }
    });

    // 现有 tag 关闭
    $all("#tagInput .tag").forEach(function (t) {
      t.addEventListener("click", function () { t.remove(); });
    });

    // 告警关闭
    $("#alertClose").addEventListener("click", function () {
      $("#alertBanner").classList.add("hidden");
    });

    // 侧栏折叠
    $("#siderToggle").addEventListener("click", function () {
      var root = $(".semi-root");
      if (window.innerWidth <= 768) {
        root.classList.toggle("sider-mobile-open");
      } else {
        root.classList.toggle("sider-collapsed");
      }
    });

    // 导航切换
    $all("#siderNav .nav-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        $all("#siderNav .nav-item").forEach(function (n) { n.classList.remove("active"); });
        item.classList.add("active");
        var key = item.dataset.key;
        $("#crumbCurrent").textContent = crumbMap[key] || "数据概览";
        $(".page-title").textContent = crumbMap[key] || "数据概览";
        if (window.innerWidth <= 768) {
          $(".semi-root").classList.remove("sider-mobile-open");
        }
      });
    });

    // 全局搜索
    $("#globalSearch").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && this.value.trim()) {
        toast("搜索：" + this.value.trim());
        $("#orderSearch").value = this.value.trim();
        orderState.keyword = this.value.trim();
        renderOrders();
      }
    });

    // 订单搜索
    $("#orderSearch").addEventListener("input", function () {
      orderState.keyword = this.value;
      renderOrders();
    });

    // 状态筛选
    $("#statusFilter").addEventListener("change", function () {
      orderState.status = this.value;
      renderOrders();
    });

    // 重置筛选
    $("#resetFilter").addEventListener("click", function () {
      $("#orderSearch").value = "";
      $("#statusFilter").value = "all";
      orderState.keyword = "";
      orderState.status = "all";
      renderOrders();
      toast("已重置筛选");
    });

    // 清空筛选（空状态）
    $("#clearSearch").addEventListener("click", function () {
      $("#resetFilter").click();
    });

    // 全选
    $("#checkAll").addEventListener("change", function () {
      var list = filteredOrders();
      if (this.checked) {
        list.forEach(function (o) { orderState.selected.add(o.id); });
      } else {
        orderState.selected.clear();
      }
      renderOrders();
    });

    // 通知弹层
    $("#noticeBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      $("#noticePopover").classList.toggle("show");
    });

    document.addEventListener("click", function (e) {
      var pop = $("#noticePopover");
      if (pop.classList.contains("show") && !pop.contains(e.target) && e.target !== $("#noticeBtn")) {
        pop.classList.remove("show");
      }
    });

    // 分页（演示）
    $all(".page-btn:not(:disabled)").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (/^\d+$/.test(this.textContent)) {
          $all(".page-btn").forEach(function (b) { b.classList.remove("active"); });
          this.classList.add("active");
          toast("加载第 " + this.textContent + " 页");
        }
      });
    });
  }

  function openSheet() {
    $("#sheetMask").classList.add("show");
    $("#createSheet").classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    $("#sheetMask").classList.remove("show");
    $("#createSheet").classList.remove("show");
    document.body.style.overflow = "";
  }

  /* ============ 启动 ============ */

  function init() {
    renderKPI();
    renderChart();
    renderTodos();
    renderOrders();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
