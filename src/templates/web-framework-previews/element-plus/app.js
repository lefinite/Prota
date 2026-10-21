/* ============================================================
 * 数据中心 - 示例工作台控制台
 * Element Plus 企业控制台：侧栏菜单、指标卡、趋势图、
 * 平台分布饼图、平台对比柱状图、TOP10 表格
 * ============================================================ */

(function () {
  "use strict";

  function statIcon(label) {
    var paths = {
      "累计观看人次": '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
      "独立观众数": '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
      "直播场次": '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m10 9 4.5 3-4.5 3V9ZM17 9l4-2v10l-4-2"/>',
      "互动次数": '<path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.4-4.2A8.5 8.5 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[label] + "</svg>";
  }

  /* ---------- 常量 ---------- */
  var PLATFORM_MAP = {
    wechat: "微信视频号",
    douyin: "抖音",
    xiaohongshu: "小红书",
    custom: "自定义推流"
  };

  var PLATFORM_COLORS = {
    wechat: "#409eff",
    douyin: "#e6a23c",
    xiaohongshu: "#f56c6c",
    custom: "#67c23a"
  };

  var STATUS_MAP = {
    pending: { label: "未开始", tagClass: "el-tag--warning", dotColor: "#e6a23c" },
    living: { label: "直播中", tagClass: "el-tag--primary", dotColor: "#409eff", living: true },
    ended: { label: "已结束", tagClass: "el-tag--info", dotColor: "#909399" }
  };

  var ANCHOR_COLORS = [
    "#409eff", "#67c23a", "#e6a23c", "#f56c6c",
    "#909399", "#9254de", "#36cfc9", "#ff85c0"
  ];

  /* ---------- 数据集 ---------- */
  var DATA_SETS = {
    today: {
      rangeLabel: "今日",
      stats: [
        { label: "累计观看人次", icon: "👁", iconClass: "icon-primary", value: "3.27", unit: "万", trend: 12.4, trendLabel: "较昨日", spark: [120, 200, 150, 380, 290, 510, 680, 590, 720, 850, 910, 980], color: "#409eff" },
        { label: "独立观众数", icon: "👤", iconClass: "icon-success", value: "1.85", unit: "万", trend: 8.1, trendLabel: "较昨日", spark: [80, 120, 100, 200, 180, 280, 320, 300, 380, 420, 450, 480], color: "#67c23a" },
        { label: "直播场次", icon: "🎥", iconClass: "icon-warning", value: "24", unit: "场", trend: 3, trendLabel: "较昨日", spark: [2, 3, 1, 4, 3, 5, 4, 3, 6, 5, 4, 6], color: "#e6a23c" },
        { label: "互动次数", icon: "💬", iconClass: "icon-danger", value: "8,642", unit: "次", trend: -2.3, trendLabel: "较昨日", spark: [300, 450, 380, 620, 550, 780, 700, 650, 820, 760, 690, 720], color: "#f56c6c" }
      ],
      trend: {
        labels: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
        cumulative: [1200, 2800, 4500, 9800, 15600, 21300, 26800, 32700],
        unique: [800, 1600, 2600, 5400, 8200, 11500, 14600, 18500]
      },
      platform: [
        { key: "wechat", count: 14 },
        { key: "douyin", count: 6 },
        { key: "xiaohongshu", count: 3 },
        { key: "custom", count: 1 }
      ],
      platformTrend: {
        labels: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
        series: {
          wechat: [600, 1400, 2200, 4800, 7600, 10400, 13000, 15800],
          douyin: [400, 900, 1500, 3200, 5100, 7000, 8800, 10800],
          xiaohongshu: [150, 350, 600, 1300, 2100, 2800, 3600, 4400],
          custom: [50, 150, 200, 500, 800, 1100, 1400, 1700]
        }
      }
    },
    "7d": {
      rangeLabel: "近 7 天",
      stats: [
        { label: "累计观看人次", icon: "👁", iconClass: "icon-primary", value: "28.6", unit: "万", trend: 15.7, trendLabel: "环比上周", spark: [3200, 4100, 3800, 5200, 4600, 5800, 6200], color: "#409eff" },
        { label: "独立观众数", icon: "👤", iconClass: "icon-success", value: "16.2", unit: "万", trend: 11.2, trendLabel: "环比上周", spark: [1800, 2300, 2100, 2900, 2600, 3300, 3500], color: "#67c23a" },
        { label: "直播场次", icon: "🎥", iconClass: "icon-warning", value: "156", unit: "场", trend: 6.8, trendLabel: "环比上周", spark: [18, 22, 20, 25, 21, 28, 22], color: "#e6a23c" },
        { label: "互动次数", icon: "💬", iconClass: "icon-danger", value: "62,410", unit: "次", trend: 9.5, trendLabel: "环比上周", spark: [7200, 8500, 7800, 9600, 8900, 10500, 9900], color: "#f56c6c" }
      ],
      trend: {
        labels: ["08-04", "08-05", "08-06", "08-07", "08-08", "08-09", "08-10"],
        cumulative: [32000, 41000, 38000, 52000, 46000, 58000, 62000],
        unique: [18000, 23000, 21000, 29000, 26000, 33000, 35000]
      },
      platform: [
        { key: "wechat", count: 89 },
        { key: "douyin", count: 38 },
        { key: "xiaohongshu", count: 21 },
        { key: "custom", count: 8 }
      ],
      platformTrend: {
        labels: ["08-04", "08-05", "08-06", "08-07", "08-08", "08-09", "08-10"],
        series: {
          wechat: [16000, 20500, 19000, 26000, 23000, 29000, 31000],
          douyin: [10000, 12800, 12000, 16400, 14500, 18200, 19500],
          xiaohongshu: [4200, 5400, 4900, 6800, 6000, 7600, 8100],
          custom: [1800, 2300, 2100, 2800, 2500, 3200, 3400]
        }
      }
    },
    "30d": {
      rangeLabel: "近 30 天",
      stats: [
        { label: "累计观看人次", icon: "👁", iconClass: "icon-primary", value: "128.4", unit: "万", trend: 22.3, trendLabel: "环比上月", spark: [28000, 32000, 30000, 36000, 34000, 40000, 38000, 44000, 42000, 48000, 46000, 52000], color: "#409eff" },
        { label: "独立观众数", icon: "👤", iconClass: "icon-success", value: "72.1", unit: "万", trend: 18.6, trendLabel: "环比上月", spark: [16000, 18000, 17000, 20000, 19000, 22000, 21000, 24000, 23000, 26000, 25000, 28000], color: "#67c23a" },
        { label: "直播场次", icon: "🎥", iconClass: "icon-warning", value: "648", unit: "场", trend: 12.1, trendLabel: "环比上月", spark: [50, 55, 52, 58, 56, 62, 60, 65, 63, 68, 66, 70], color: "#e6a23c" },
        { label: "互动次数", icon: "💬", iconClass: "icon-danger", value: "274,800", unit: "次", trend: 16.9, trendLabel: "环比上月", spark: [62000, 70000, 66000, 78000, 74000, 82000, 80000, 88000, 86000, 94000, 92000, 100000], color: "#f56c6c" }
      ],
      trend: {
        labels: ["07-12", "07-15", "07-18", "07-21", "07-24", "07-27", "07-30", "08-02", "08-05", "08-08"],
        cumulative: [32000, 38000, 35000, 42000, 40000, 46000, 44000, 50000, 48000, 54000],
        unique: [18000, 21000, 20000, 24000, 22000, 26000, 25000, 28000, 27000, 30000]
      },
      platform: [
        { key: "wechat", count: 372 },
        { key: "douyin", count: 158 },
        { key: "xiaohongshu", count: 88 },
        { key: "custom", count: 30 }
      ],
      platformTrend: {
        labels: ["07-12", "07-15", "07-18", "07-21", "07-24", "07-27", "07-30", "08-02", "08-05", "08-08"],
        series: {
          wechat: [16000, 19000, 17500, 21000, 20000, 23000, 22000, 25000, 24000, 27000],
          douyin: [10000, 12000, 11000, 13000, 12500, 14000, 13500, 15500, 15000, 16500],
          xiaohongshu: [4200, 5000, 4600, 5500, 5200, 6000, 5800, 6500, 6300, 7000],
          custom: [1800, 2000, 1900, 2500, 2300, 3000, 2700, 3500, 3200, 4000]
        }
      }
    },
    "90d": {
      rangeLabel: "近 90 天",
      stats: [
        { label: "累计观看人次", icon: "👁", iconClass: "icon-primary", value: "372.8", unit: "万", trend: 35.2, trendLabel: "环比上季", spark: [280000, 300000, 320000, 340000, 330000, 360000], color: "#409eff" },
        { label: "独立观众数", icon: "👤", iconClass: "icon-success", value: "208.5", unit: "万", trend: 28.7, trendLabel: "环比上季", spark: [160000, 170000, 180000, 185000, 195000, 205000], color: "#67c23a" },
        { label: "直播场次", icon: "🎥", iconClass: "icon-warning", value: "1,892", unit: "场", trend: 19.4, trendLabel: "环比上季", spark: [580, 620, 650, 680, 700, 730], color: "#e6a23c" },
        { label: "互动次数", icon: "💬", iconClass: "icon-danger", value: "812,600", unit: "次", trend: 31.8, trendLabel: "环比上季", spark: [240000, 260000, 280000, 290000, 310000, 320000], color: "#f56c6c" }
      ],
      trend: {
        labels: ["05-12", "05-26", "06-09", "06-23", "07-07", "07-21", "08-04", "08-10"],
        cumulative: [95000, 110000, 125000, 140000, 155000, 170000, 180000, 195000],
        unique: [55000, 62000, 70000, 78000, 85000, 92000, 97000, 105000]
      },
      platform: [
        { key: "wechat", count: 1086 },
        { key: "douyin", count: 462 },
        { key: "xiaohongshu", count: 258 },
        { key: "custom", count: 86 }
      ],
      platformTrend: {
        labels: ["05-12", "05-26", "06-09", "06-23", "07-07", "07-21", "08-04", "08-10"],
        series: {
          wechat: [47000, 55000, 62000, 70000, 77000, 85000, 90000, 97000],
          douyin: [30000, 35000, 39000, 43000, 48000, 52000, 55000, 59000],
          xiaohongshu: [12000, 14000, 16000, 18000, 20000, 22000, 23000, 25000],
          custom: [6000, 7000, 8000, 9000, 10000, 11000, 12000, 14000]
        }
      }
    }
  };

  /* ---------- TOP 榜数据 ---------- */
  var RANK_DATA = [
    { rank: 1, name: "年度投资策略报告会", anchor: "刘洋", platform: "douyin", status: "ended", viewers: 31200, unique: 18600, interaction: 5842, duration: "120分钟" },
    { rank: 2, name: "SCRM系统产品发布会", anchor: "赵旭平", platform: "wechat", status: "ended", viewers: 23410, unique: 14200, interaction: 4120, duration: "150分钟" },
    { rank: 3, name: "企业数字化转型峰会", anchor: "张明", platform: "wechat", status: "living", viewers: 12856, unique: 8200, interaction: 2680, duration: "进行中" },
    { rank: 4, name: "理财实战公开课第三期", anchor: "李娜", platform: "douyin", status: "living", viewers: 8421, unique: 5600, interaction: 1820, duration: "进行中" },
    { rank: 5, name: "私域流量获客实战", anchor: "陈晨", platform: "wechat", status: "ended", viewers: 7230, unique: 4800, interaction: 1340, duration: "100分钟" },
    { rank: 6, name: "小红书内容运营专场", anchor: "王芳", platform: "xiaohongshu", status: "ended", viewers: 6850, unique: 4100, interaction: 980, duration: "120分钟" },
    { rank: 7, name: "企业微信私域增长训练营", anchor: "周强", platform: "wechat", status: "ended", viewers: 5620, unique: 3500, interaction: 760, duration: "90分钟" },
    { rank: 8, name: "抖音直播带货方法论", anchor: "孙丽", platform: "douyin", status: "ended", viewers: 4980, unique: 3100, interaction: 620, duration: "80分钟" },
    { rank: 9, name: "品牌数字化营销沙龙", anchor: "吴敏", platform: "wechat", status: "ended", viewers: 4320, unique: 2800, interaction: 510, duration: "110分钟" },
    { rank: 10, name: "短视频引流实战分享", anchor: "郑华", platform: "xiaohongshu", status: "ended", viewers: 3860, unique: 2400, interaction: 430, duration: "75分钟" }
  ];

  /* ---------- 状态 ---------- */
  var currentRange = "7d";
  var searchKeyword = "";

  /* ---------- DOM ---------- */
  var aside = document.getElementById("aside");
  var elContainer = document.querySelector(".el-container");
  var collapseBtn = document.getElementById("collapseBtn");
  var statRow = document.getElementById("statRow");
  var trendChart = document.getElementById("trendChart");
  var pieChart = document.getElementById("pieChart");
  var pieLegend = document.getElementById("pieLegend");
  var platformChart = document.getElementById("platformChart");
  var rankTableBody = document.getElementById("rankTableBody");
  var trendSubtitle = document.getElementById("trendSubtitle");
  var messageWrap = document.getElementById("messageWrap");
  var tableSearch = document.getElementById("tableSearch");

  /* ---------- 工具函数 ---------- */
  function fmt(n) {
    return n.toLocaleString("zh-CN");
  }

  function showMessage(text, type) {
    var msg = document.createElement("div");
    msg.className = "el-message" + (type ? " el-message--" + type : " el-message--info");
    var icon = type === "success"
      ? '<svg class="el-message__icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="m8 12 3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="el-message__icon" viewBox="0 0 24 24" fill="none" style="color:var(--el-color-primary)"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    msg.innerHTML = icon + '<span>' + text + "</span>";
    messageWrap.appendChild(msg);
    requestAnimationFrame(function () {
      msg.classList.add("is-visible");
    });
    setTimeout(function () {
      msg.classList.remove("is-visible");
      setTimeout(function () { msg.remove(); }, 300);
    }, 2500);
  }

  function niceCeil(val) {
    if (val <= 0) return 10;
    var mag = Math.pow(10, Math.floor(Math.log10(val)));
    var norm = val / mag;
    var nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 2.5) nice = 2.5;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
  }

  function fmtAxis(val) {
    if (val >= 10000) return (val / 10000).toFixed(val >= 100000 ? 0 : 1) + "万";
    return Math.round(val);
  }

  /* ---------- 指标卡渲染 ---------- */
  function renderStats(data) {
    var html = "";
    data.stats.forEach(function (s, idx) {
      var up = s.trend >= 0;
      var arrow = up ? "↑" : "↓";
      var cls = up ? "trend-up" : "trend-down";
      var sparkId = "spark-" + idx;
      html += '<div class="stat-card">';
      html += '  <div class="stat-card-top">';
      html += '    <span class="stat-card-label">' + s.label + "</span>";
      html += '    <span class="stat-card-icon ' + s.iconClass + '">' + statIcon(s.label) + "</span>";
      html += "  </div>";
      html += '  <div class="stat-card-value-row">';
      html += '    <span class="stat-card-value">' + s.value + "</span>";
      html += '    <span class="stat-card-unit">' + s.unit + "</span>";
      html += "  </div>";
      html += '  <div class="stat-card-trend">';
      html += '    <span class="' + cls + '">' + arrow + " " + Math.abs(s.trend) + "%</span>";
      html += '    <span class="trend-label">' + s.trendLabel + "</span>";
      html += "  </div>";
      html += '  <div class="stat-mini-chart" id="' + sparkId + '"></div>';
      html += "</div>";
      (function (id, sparkData, color) {
        setTimeout(function () { renderSparkline(id, sparkData, color); }, 0);
      })(sparkId, s.spark, s.color);
    });
    statRow.innerHTML = html;
  }

  /* ---------- Sparkline ---------- */
  function renderSparkline(containerId, data, color) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var w = container.clientWidth || 200;
    var h = 60;
    var pt = 4, pb = 4;
    var plotW = w;
    var plotH = h - pt - pb;
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var range = max - min || 1;

    var pts = data.map(function (v, i) {
      var x = data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1);
      var y = pt + plotH - ((v - min) / range) * plotH;
      return { x: x, y: y };
    });

    var linePath = pts.map(function (p, i) {
      return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }).join(" ");

    var areaPath = linePath +
      " L" + pts[pts.length - 1].x.toFixed(1) + "," + (pt + plotH) +
      " L" + pts[0].x.toFixed(1) + "," + (pt + plotH) + " Z";

    var gid = containerId + "-grad";

    container.innerHTML =
      '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>' +
      "</linearGradient></defs>" +
      '<path d="' + areaPath + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + linePath + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      "</svg>";
  }

  /* ---------- 双折线趋势图 ---------- */
  function renderTrendChart(data) {
    var container = trendChart;
    var w = Math.max(container.clientWidth - 40, 400);
    var h = 300;
    var pL = 56, pR = 20, pT = 20, pB = 36;
    var plotW = w - pL - pR;
    var plotH = h - pT - pB;

    var labels = data.trend.labels;
    var s1 = data.trend.cumulative;
    var s2 = data.trend.unique;

    var allVals = s1.concat(s2);
    var max = niceCeil(Math.max.apply(null, allVals));
    var yTicks = 5;

    function xS(i) { return pL + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1)); }
    function yS(v) { return pT + plotH - (v / max) * plotH; }

    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%">';

    // 网格 + Y 轴标签
    for (var t = 0; t <= yTicks; t++) {
      var val = (max * t) / yTicks;
      var y = yS(val);
      svg += '<line x1="' + pL + '" y1="' + y.toFixed(1) + '" x2="' + (pL + plotW) + '" y2="' + y.toFixed(1) + '" stroke="#ebeef5" stroke-width="1"/>';
      svg += '<text x="' + (pL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="#909399">' + fmtAxis(val) + "</text>";
    }

    // X 轴标签
    labels.forEach(function (label, i) {
      var x = xS(i);
      svg += '<text x="' + x.toFixed(1) + '" y="' + (pT + plotH + 20) + '" text-anchor="middle" font-size="12" fill="#909399">' + label + "</text>";
    });

    // 累计观看面积
    var areaPath = s1.map(function (v, i) {
      return (i === 0 ? "M" : "L") + xS(i).toFixed(1) + "," + yS(v).toFixed(1);
    }).join(" ");
    areaPath += " L" + xS(s1.length - 1).toFixed(1) + "," + (pT + plotH) + " L" + xS(0).toFixed(1) + "," + (pT + plotH) + " Z";

    svg += '<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#409eff" stop-opacity="0.25"/>' +
      '<stop offset="100%" stop-color="#409eff" stop-opacity="0.02"/>' +
      "</linearGradient></defs>";
    svg += '<path d="' + areaPath + '" fill="url(#trendGrad)"/>';

    // 累计观看折线
    svg += '<path d="' + s1.map(function (v, i) { return (i === 0 ? "M" : "L") + xS(i).toFixed(1) + "," + yS(v).toFixed(1); }).join(" ") + '" fill="none" stroke="#409eff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    s1.forEach(function (v, i) {
      svg += '<circle cx="' + xS(i).toFixed(1) + '" cy="' + yS(v).toFixed(1) + '" r="4" fill="#fff" stroke="#409eff" stroke-width="2"/>';
    });

    // 独立观众虚线
    svg += '<path d="' + s2.map(function (v, i) { return (i === 0 ? "M" : "L") + xS(i).toFixed(1) + "," + yS(v).toFixed(1); }).join(" ") + '" fill="none" stroke="#67c23a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6,4"/>';
    s2.forEach(function (v, i) {
      svg += '<circle cx="' + xS(i).toFixed(1) + '" cy="' + yS(v).toFixed(1) + '" r="3" fill="#fff" stroke="#67c23a" stroke-width="1.5"/>';
    });

    svg += "</svg>";
    container.innerHTML = svg;
  }

  /* ---------- 环形饼图 ---------- */
  function renderPieChart(data) {
    var size = 200;
    var cx = size / 2, cy = size / 2;
    var outerR = 82, innerR = 56;

    var total = data.platform.reduce(function (s, p) { return s + p.count; }, 0);

    var svg = '<svg viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '">';
    var startAngle = -Math.PI / 2;
    var legendHtml = "";

    data.platform.forEach(function (p) {
      var pct = p.count / total;
      var angle = pct * Math.PI * 2;
      var endAngle = startAngle + angle;

      var x1 = cx + outerR * Math.cos(startAngle);
      var y1 = cy + outerR * Math.sin(startAngle);
      var x2 = cx + outerR * Math.cos(endAngle);
      var y2 = cy + outerR * Math.sin(endAngle);
      var xi1 = cx + innerR * Math.cos(endAngle);
      var yi1 = cy + innerR * Math.sin(endAngle);
      var xi2 = cx + innerR * Math.cos(startAngle);
      var yi2 = cy + innerR * Math.sin(startAngle);

      var largeArc = angle > Math.PI ? 1 : 0;
      var color = PLATFORM_COLORS[p.key];

      var d = "M" + x1.toFixed(2) + "," + y1.toFixed(2) +
        " A" + outerR + "," + outerR + " 0 " + largeArc + " 1 " + x2.toFixed(2) + "," + y2.toFixed(2) +
        " L" + xi1.toFixed(2) + "," + yi1.toFixed(2) +
        " A" + innerR + "," + innerR + " 0 " + largeArc + " 0 " + xi2.toFixed(2) + "," + yi2.toFixed(2) + " Z";

      svg += '<path d="' + d + '" fill="' + color + '" stroke="#fff" stroke-width="2"/>';

      legendHtml += '<div class="pie-legend-item">' +
        '<div class="pie-legend-left">' +
        '<span class="pie-legend-dot" style="background:' + color + '"></span>' +
        '<span class="pie-legend-name">' + PLATFORM_MAP[p.key] + "</span>" +
        "</div>" +
        '<div class="pie-legend-right">' +
        '<span class="pie-legend-value">' + p.count + " 场</span>" +
        '<span class="pie-legend-percent">' + (pct * 100).toFixed(1) + "%</span>" +
        "</div></div>";

      startAngle = endAngle;
    });

    svg += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-size="13" fill="#909399">总场次</text>';
    svg += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="22" font-weight="700" fill="#303133">' + total + "</text>";
    svg += "</svg>";

    pieChart.innerHTML = svg;
    pieLegend.innerHTML = legendHtml;
  }

  /* ---------- 分组柱状图 ---------- */
  function renderPlatformChart(data) {
    var container = platformChart;
    var w = Math.max(container.clientWidth - 40, 600);
    var h = 320;
    var pL = 56, pR = 20, pT = 20, pB = 36;
    var plotW = w - pL - pR;
    var plotH = h - pT - pB;

    var labels = data.platformTrend.labels;
    var platforms = Object.keys(data.platformTrend.series);
    var groupCount = labels.length;
    var barGroupCount = platforms.length;

    var allVals = [];
    platforms.forEach(function (pk) { allVals = allVals.concat(data.platformTrend.series[pk]); });
    var max = niceCeil(Math.max.apply(null, allVals));

    var groupWidth = plotW / groupCount;
    var barWidth = Math.min(14, (groupWidth - 8) / barGroupCount);
    var groupPad = (groupWidth - barWidth * barGroupCount) / 2;

    function yS(v) { return pT + plotH - (v / max) * plotH; }

    var yTicks = 5;
    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%">';

    for (var t = 0; t <= yTicks; t++) {
      var val = (max * t) / yTicks;
      var y = yS(val);
      svg += '<line x1="' + pL + '" y1="' + y.toFixed(1) + '" x2="' + (pL + plotW) + '" y2="' + y.toFixed(1) + '" stroke="#ebeef5" stroke-width="1"/>';
      svg += '<text x="' + (pL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="#909399">' + fmtAxis(val) + "</text>";
    }

    labels.forEach(function (label, gi) {
      var groupX = pL + gi * groupWidth;
      platforms.forEach(function (pk, pi) {
        var val = data.platformTrend.series[pk][gi];
        var barX = groupX + groupPad + pi * barWidth;
        var barY = yS(val);
        var barH = pT + plotH - barY;
        svg += '<rect x="' + barX.toFixed(1) + '" y="' + barY.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="2" fill="' + PLATFORM_COLORS[pk] + '"/>';
      });
      var labelX = groupX + groupWidth / 2;
      svg += '<text x="' + labelX.toFixed(1) + '" y="' + (pT + plotH + 20) + '" text-anchor="middle" font-size="12" fill="#909399">' + label + "</text>";
    });

    svg += "</svg>";
    container.innerHTML = svg;
  }

  /* ---------- TOP 表格渲染 ---------- */
  function renderRankTable() {
    var filtered = RANK_DATA.filter(function (item) {
      if (!searchKeyword) return true;
      var kw = searchKeyword.toLowerCase();
      return item.name.toLowerCase().indexOf(kw) !== -1 || item.anchor.toLowerCase().indexOf(kw) !== -1;
    });

    if (filtered.length === 0) {
      rankTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px 0;color:#909399">未找到匹配的直播间</td></tr>';
      return;
    }

    var html = "";
    filtered.forEach(function (item) {
      var status = STATUS_MAP[item.status];
      var rankClass = item.rank <= 3 ? "rank-" + item.rank : "rank-default";
      var rankBadge = item.rank <= 3
        ? '<span class="rank-num ' + rankClass + '">' + item.rank + "</span>"
        : '<span class="rank-num rank-default">' + item.rank + "</span>";

      var colorIdx = item.anchor.charCodeAt(0) % ANCHOR_COLORS.length;
      var dotClass = status.living ? " tag-dot living" : " tag-dot";

      html += "<tr>";
      html += '<td class="col-rank" style="text-align:center">' + rankBadge + "</td>";
      html += '<td class="col-name"><span class="cell-name">' + item.name + "</span></td>";
      html += '<td class="col-anchor"><div class="cell-anchor"><span class="anchor-avatar" style="background:' + ANCHOR_COLORS[colorIdx] + '">' + item.anchor.charAt(0) + "</span>" + item.anchor + "</div></td>";
      html += '<td class="col-platform">' + PLATFORM_MAP[item.platform] + "</td>";
      html += '<td class="col-status"><span class="el-tag ' + status.tagClass + ' el-tag--small"><span class="' + dotClass + '" style="background:' + status.dotColor + '"></span>' + status.label + "</span></td>";
      html += '<td class="cell-number">' + fmt(item.viewers) + "</td>";
      html += '<td class="cell-number">' + fmt(item.unique) + "</td>";
      html += '<td class="cell-number">' + fmt(item.interaction) + "</td>";
      html += '<td class="col-duration" style="font-size:13px;color:#606266">' + item.duration + "</td>";
      html += "</tr>";
    });
    rankTableBody.innerHTML = html;
  }

  /* ---------- 全量渲染 ---------- */
  function renderAll(range) {
    currentRange = range;
    var data = DATA_SETS[range];
    if (!data) return;

    var subtitle = range === "today"
      ? "今日分时段累计观看与独立观众"
      : data.rangeLabel + "每日累计观看与独立观众";
    trendSubtitle.textContent = subtitle;

    renderStats(data);
    renderTrendChart(data);
    renderPieChart(data);
    renderPlatformChart(data);
  }

  /* ---------- 事件绑定 ---------- */

  // 侧边栏收起
  collapseBtn.addEventListener("click", function () {
    aside.classList.toggle("is-collapsed");
    elContainer.classList.toggle("aside-collapsed");
    setTimeout(function () { renderAll(currentRange); }, 320);
  });

  // 菜单项切换
  document.querySelectorAll(".el-menu-item").forEach(function (item) {
    item.addEventListener("click", function () {
      if (item.classList.contains("is-active")) return;
      document.querySelectorAll(".el-menu-item").forEach(function (m) { m.classList.remove("is-active"); });
      item.classList.add("is-active");
      var text = item.querySelector(".menu-text");
      var label = text ? text.textContent : "该页面";
      showMessage("「" + label + "」为演示导航，暂未开放数据");
    });
  });

  // 顶部操作按钮
  document.querySelectorAll(".header-action").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var label = btn.getAttribute("aria-label") || "操作";
      showMessage(label + "功能演示");
    });
  });

  // 时间范围切换
  document.querySelectorAll(".el-radio-button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".el-radio-button").forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-checked", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-checked", "true");
      renderAll(btn.dataset.range);
    });
  });

  // 导出报表（两段式反馈）
  document.getElementById("btnExport").addEventListener("click", function () {
    var btn = this;
    if (btn.classList.contains("is-loading")) return;
    btn.classList.add("is-loading");
    var orig = btn.innerHTML;
    btn.innerHTML = '<span class="el-icon-loading"></span><span>导出中…</span>';
    setTimeout(function () {
      btn.classList.remove("is-loading");
      btn.innerHTML = orig;
      showMessage("报表已导出到本地", "success");
    }, 1200);
  });

  // 刷新
  document.getElementById("btnRefresh").addEventListener("click", function () {
    var btn = this;
    if (btn.classList.contains("is-loading")) return;
    btn.classList.add("is-loading");
    var icon = btn.querySelector(".refresh-icon");
    if (icon) icon.classList.add("is-spinning");
    setTimeout(function () {
      btn.classList.remove("is-loading");
      if (icon) icon.classList.remove("is-spinning");
      renderAll(currentRange);
      renderRankTable();
      showMessage("数据已刷新", "success");
    }, 800);
  });

  // 表格搜索
  var searchTimer;
  tableSearch.addEventListener("input", function () {
    clearTimeout(searchTimer);
    var kw = this.value;
    searchTimer = setTimeout(function () {
      searchKeyword = kw;
      renderRankTable();
    }, 200);
  });

  // 表格行点击
  rankTableBody.addEventListener("click", function (e) {
    var row = e.target.closest("tr");
    if (!row || row.children.length === 1) return;
    var nameCell = row.querySelector(".cell-name");
    if (nameCell) {
      showMessage("查看「" + nameCell.textContent + "」详情（演示）");
    }
  });

  // 用户区域点击
  document.querySelector(".header-user").addEventListener("click", function () {
    showMessage("个人中心 · 演示");
  });

  // resize 重绘
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderAll(currentRange); }, 200);
  });

  /* ---------- 初始化 ---------- */
  renderRankTable();
  renderAll(currentRange);
})();
