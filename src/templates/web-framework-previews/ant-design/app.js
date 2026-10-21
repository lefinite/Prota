/* ============================================================
 * 直播间管理 - 示例工作台
 * 完整增删改查交互：列表、搜索、新建、编辑、删除、批量删除、分页
 * ============================================================ */

(function () {
  "use strict";

  /* ---------- 常量映射 ---------- */
  var STATUS_MAP = {
    pending: { label: "未开始", className: "tag-pending" },
    living: { label: "直播中", className: "tag-living" },
    ended: { label: "已结束", className: "tag-ended" },
    disabled: { label: "已禁用", className: "tag-disabled" }
  };

  var PLATFORM_MAP = {
    wechat: "微信视频号",
    douyin: "抖音",
    xiaohongshu: "小红书",
    custom: "自定义推流"
  };

  var ANCHOR_COLORS = [
    "#1677ff", "#52a41a", "#722ed1", "#13c2c2",
    "#eb2f96", "#fa8c16", "#2f54eb", "#fa541c"
  ];

  /* ---------- 默认数据 ---------- */
  var DEFAULT_DATA = [
    {
      id: "LR-20260801-001",
      name: "企业数字化转型峰会",
      anchor: "张明",
      platform: "wechat",
      status: "living",
      viewers: 12856,
      startTime: "2026-08-10 14:00",
      duration: 180,
      desc: "邀请行业专家深度解析企业数字化转型路径与实践案例",
      pushUrl: ""
    },
    {
      id: "LR-20260801-002",
      name: "理财实战公开课第三期",
      anchor: "李娜",
      platform: "douyin",
      status: "living",
      viewers: 8421,
      startTime: "2026-08-10 19:30",
      duration: 90,
      desc: "从零开始学理财，掌握家庭资产配置核心方法",
      pushUrl: ""
    },
    {
      id: "LR-20260802-003",
      name: "小红书内容运营专场",
      anchor: "王芳",
      platform: "xiaohongshu",
      status: "pending",
      viewers: 0,
      startTime: "2026-08-12 20:00",
      duration: 120,
      desc: "小红书爆款笔记创作技巧与账号涨粉策略分享",
      pushUrl: ""
    },
    {
      id: "LR-20260728-004",
      name: "SCRM系统产品发布会",
      anchor: "赵旭平",
      platform: "wechat",
      status: "ended",
      viewers: 23410,
      startTime: "2026-07-28 10:00",
      duration: 150,
      desc: "全新 SCRM 系统正式发布，助力企业私域增长",
      pushUrl: ""
    },
    {
      id: "LR-20260805-005",
      name: "私域流量获客实战",
      anchor: "陈晨",
      platform: "wechat",
      status: "pending",
      viewers: 0,
      startTime: "2026-08-15 15:00",
      duration: 100,
      desc: "私域获客方法论与实操案例全解",
      pushUrl: ""
    },
    {
      id: "LR-20260720-006",
      name: "年度投资策略报告会",
      anchor: "刘洋",
      platform: "douyin",
      status: "ended",
      viewers: 31200,
      startTime: "2026-07-20 19:00",
      duration: 120,
      desc: "回顾上半年市场表现，展望下半年投资机会",
      pushUrl: ""
    },
    {
      id: "LR-20260803-007",
      name: "自定义推流测试间",
      anchor: "测试员",
      platform: "custom",
      status: "disabled",
      viewers: 156,
      startTime: "2026-08-08 10:00",
      duration: 60,
      desc: "用于测试第三方推流地址的临时直播间",
      pushUrl: "rtmp://push.example.com/live/test007"
    },
    {
      id: "LR-20260806-008",
      name: "新员工入职培训直播",
      anchor: "孙莉",
      platform: "wechat",
      status: "pending",
      viewers: 0,
      startTime: "2026-08-20 09:30",
      duration: 90,
      desc: "面向新入职员工的的企业文化与制度培训",
      pushUrl: ""
    },
    {
      id: "LR-20260715-009",
      name: "金融科技前沿论坛",
      anchor: "张明",
      platform: "xiaohongshu",
      status: "ended",
      viewers: 9870,
      startTime: "2026-07-15 14:00",
      duration: 200,
      desc: "探讨金融科技最新发展趋势与监管政策",
      pushUrl: ""
    },
    {
      id: "LR-20260804-010",
      name: "客户答疑专场直播",
      anchor: "李娜",
      platform: "douyin",
      status: "pending",
      viewers: 0,
      startTime: "2026-08-18 16:00",
      duration: 80,
      desc: "集中解答客户常见问题，演示产品核心功能",
      pushUrl: ""
    },
    {
      id: "LR-20260710-011",
      name: "品牌周年庆典直播",
      anchor: "王芳",
      platform: "wechat",
      status: "ended",
      viewers: 45600,
      startTime: "2026-07-10 20:00",
      duration: 180,
      desc: "品牌成立周年庆典，感恩回馈新老用户",
      pushUrl: ""
    },
    {
      id: "LR-20260807-012",
      name: "数据分析入门课程",
      anchor: "赵旭平",
      platform: "douyin",
      status: "pending",
      viewers: 0,
      startTime: "2026-08-22 19:00",
      duration: 110,
      desc: "数据分析零基础入门，从 Excel 到 BI 工具",
      pushUrl: ""
    }
  ];

  /* ---------- 数据层（localStorage 持久化，带异常防护）---------- */
  var STORAGE_KEY = "demo_studio_live_room_crud";

  function getData() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // file:// 或隐私模式等场景下 localStorage 不可用，降级返回默认数据
      console.error("[live-room-crud] localStorage.getItem 不可用:", e);
      return DEFAULT_DATA.map(function (item) {
        return Object.assign({}, item);
      });
    }
    if (!raw) {
      var init = DEFAULT_DATA.map(function (item) {
        return Object.assign({}, item);
      });
      saveData(init);
      return init;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("[live-room-crud] localStorage 数据解析失败:", e);
      return DEFAULT_DATA.map(function (item) {
        return Object.assign({}, item);
      });
    }
  }

  function saveData(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("[live-room-crud] localStorage.setItem 不可用:", e);
    }
  }

  /* ---------- 应用状态 ---------- */
  var state = {
    allData: [],
    filtered: [],
    searchName: "",
    searchAnchor: "",
    searchStatus: "",
    searchPlatform: "",
    page: 1,
    pageSize: 10,
    selectedIds: [],
    editingId: null,
    deletingIds: []
  };

  /* ---------- 工具函数 ---------- */
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function anchorColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return ANCHOR_COLORS[sum % ANCHOR_COLORS.length];
  }

  function anchorInitial(name) {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  }

  function genId() {
    var d = new Date();
    var pad = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    var dateStr =
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate());
    var seq = String(Math.floor(Math.random() * 900) + 100);
    return "LR-" + dateStr + "-" + seq;
  }

  function nowLocalDateTimeInput() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function formatTimeToInput(timeStr) {
    // "2026-08-10 14:00" -> "2026-08-10T14:00"
    if (!timeStr) return "";
    return timeStr.replace(" ", "T");
  }

  function formatInputToTime(inputVal) {
    // "2026-08-10T14:00" -> "2026-08-10 14:00"
    if (!inputVal) return "";
    return inputVal.replace("T", " ");
  }

  function toast(message, type) {
    var el = $("toast");
    el.textContent = message;
    el.className = "toast";
    if (type) {
      el.classList.add("toast-" + type);
    }
    // force reflow
    void el.offsetWidth;
    el.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2500);
  }

  /* ---------- 筛选 ---------- */
  function applyFilters() {
    state.searchName = $("searchName").value.trim();
    state.searchAnchor = $("searchAnchor").value.trim();
    state.searchStatus = $("searchStatus").value;
    state.searchPlatform = $("searchPlatform").value;
    state.page = 1;
    state.selectedIds = [];
    render();
  }

  function resetFilters() {
    $("searchName").value = "";
    $("searchAnchor").value = "";
    $("searchStatus").value = "";
    $("searchPlatform").value = "";
    state.searchName = "";
    state.searchAnchor = "";
    state.searchStatus = "";
    state.searchPlatform = "";
    state.page = 1;
    state.selectedIds = [];
    render();
  }

  function getFiltered() {
    var list = state.allData;
    var n = state.searchName.toLowerCase();
    var a = state.searchAnchor.toLowerCase();
    var s = state.searchStatus;
    var p = state.searchPlatform;

    return list.filter(function (item) {
      if (n && item.name.toLowerCase().indexOf(n) === -1) return false;
      if (a && item.anchor.toLowerCase().indexOf(a) === -1) return false;
      if (s && item.status !== s) return false;
      if (p && item.platform !== p) return false;
      return true;
    });
  }

  /* ---------- 渲染：统计 ---------- */
  function renderStats() {
    var living = state.allData.filter(function (i) {
      return i.status === "living";
    }).length;
    var pending = state.allData.filter(function (i) {
      return i.status === "pending";
    }).length;
    $("statLiving").textContent = living;
    $("statPending").textContent = pending;
  }

  /* ---------- 渲染：表格 ---------- */
  function renderTable() {
    var filtered = getFiltered();
    state.filtered = filtered;

    var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    var start = (state.page - 1) * state.pageSize;
    var pageData = filtered.slice(start, start + state.pageSize);

    var tbody = $("roomTableBody");
    var countEl = $("tableCount");

    countEl.textContent = "共 " + filtered.length + " 条";

    if (pageData.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="table-empty">' +
        '<span class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 14h4l2 2h4l2-2h4M8 9h8"/></svg></span>' +
        "<p>暂无符合条件的直播间数据</p>" +
        "</td></tr>";
      renderPagination(filtered.length, totalPages);
      renderBatchBar();
      renderCheckAll();
      return;
    }

    var html = "";
    pageData.forEach(function (item) {
      var statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;
      var checked =
        state.selectedIds.indexOf(item.id) !== -1 ? "checked" : "";
      var isSelected = checked ? "is-selected" : "";

      var actionHtml = "";
      if (item.status === "disabled") {
        actionHtml =
          '<button class="btn-link" onclick="window.__liveRoom__.openEdit(\'' +
          item.id +
          "')\">编辑</button>" +
          '<button class="btn-link" onclick="window.__liveRoom__.toggleStatus(\'' +
          item.id +
          "')\">启用</button>" +
          '<button class="btn-link btn-link-danger" onclick="window.__liveRoom__.confirmDelete([\'' +
          item.id +
          "'])\">删除</button>";
      } else {
        actionHtml =
          '<button class="btn-link" onclick="window.__liveRoom__.openEdit(\'' +
          item.id +
          "')\">编辑</button>" +
          '<button class="btn-link" onclick="window.__liveRoom__.toggleStatus(\'' +
          item.id +
          "')\">" +
          (item.status === "living" ? "结束直播" : item.status === "pending" ? "开始直播" : "查看详情") +
          "</button>" +
          '<button class="btn-link btn-link-danger" onclick="window.__liveRoom__.confirmDelete([\'' +
          item.id +
          "'])\">删除</button>";
      }

      html +=
        '<tr class="' +
        isSelected +
        '" data-id="' +
        escapeHtml(item.id) +
        '">' +
        '<td class="col-check"><input type="checkbox" ' +
        checked +
        ' data-id="' +
        escapeHtml(item.id) +
        '" aria-label="选择' +
        escapeHtml(item.name) +
        '" /></td>' +
        '<td><span class="cell-id">' +
        escapeHtml(item.id) +
        "</span></td>" +
        '<td><span class="cell-name">' +
        escapeHtml(item.name) +
        "</span></td>" +
        '<td><span class="cell-anchor"><span class="anchor-badge" style="background:' +
        anchorColor(item.anchor) +
        '">' +
        escapeHtml(anchorInitial(item.anchor)) +
        "</span>" +
        escapeHtml(item.anchor) +
        "</span></td>" +
        '<td><span class="platform-tag">' +
        escapeHtml(PLATFORM_MAP[item.platform] || item.platform) +
        "</span></td>" +
        '<td><span class="tag ' +
        statusInfo.className +
        '">' +
        statusInfo.label +
        "</span></td>" +
        '<td class="cell-viewers">' +
        item.viewers.toLocaleString() +
        "</td>" +
        '<td><span class="cell-time">' +
        escapeHtml(item.startTime) +
        "</span></td>" +
        '<td class="col-actions"><div class="action-group">' +
        actionHtml +
        "</div></td>" +
        "</tr>";
    });

    tbody.innerHTML = html;

    // 绑定 checkbox
    tbody.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleSelect(cb.dataset.id, cb.checked);
      });
    });

    renderPagination(filtered.length, totalPages);
    renderBatchBar();
    renderCheckAll();
  }

  /* ---------- 渲染：分页 ---------- */
  function renderPagination(total, totalPages) {
    $("pageTotal").textContent = total;
    var container = $("pageButtons");
    container.innerHTML = "";

    // 上一页
    var prevBtn = document.createElement("button");
    prevBtn.className = "page-btn";
    prevBtn.innerHTML = "‹";
    prevBtn.disabled = state.page <= 1;
    prevBtn.addEventListener("click", function () {
      if (state.page > 1) {
        state.page--;
        renderTable();
      }
    });
    container.appendChild(prevBtn);

    // 页码按钮（最多显示 7 个）
    var pages = getPageNumbers(state.page, totalPages);
    pages.forEach(function (p) {
      if (p === "...") {
        var ell = document.createElement("span");
        ell.className = "page-ellipsis";
        ell.textContent = "…";
        container.appendChild(ell);
      } else {
        var btn = document.createElement("button");
        btn.className = "page-btn" + (p === state.page ? " is-current" : "");
        btn.textContent = p;
        btn.addEventListener("click", function () {
          state.page = p;
          renderTable();
        });
        container.appendChild(btn);
      }
    });

    // 下一页
    var nextBtn = document.createElement("button");
    nextBtn.className = "page-btn";
    nextBtn.innerHTML = "›";
    nextBtn.disabled = state.page >= totalPages;
    nextBtn.addEventListener("click", function () {
      if (state.page < totalPages) {
        state.page++;
        renderTable();
      }
    });
    container.appendChild(nextBtn);
  }

  function getPageNumbers(current, total) {
    if (total <= 7) {
      var arr = [];
      for (var i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", total];
    }
    if (current >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  /* ---------- 选择与批量 ---------- */
  function toggleSelect(id, checked) {
    if (checked) {
      if (state.selectedIds.indexOf(id) === -1) {
        state.selectedIds.push(id);
      }
    } else {
      state.selectedIds = state.selectedIds.filter(function (x) {
        return x !== id;
      });
    }
    renderBatchBar();
    renderCheckAll();
    updateRowSelection();
  }

  function updateRowSelection() {
    var rows = $("roomTableBody").querySelectorAll("tr[data-id]");
    rows.forEach(function (row) {
      var id = row.getAttribute("data-id");
      var cb = row.querySelector('input[type="checkbox"]');
      if (state.selectedIds.indexOf(id) !== -1) {
        row.classList.add("is-selected");
        if (cb) cb.checked = true;
      } else {
        row.classList.remove("is-selected");
        if (cb) cb.checked = false;
      }
    });
  }

  function renderCheckAll() {
    var checkAll = $("checkAll");
    var visibleIds = getVisibleIds();
    if (visibleIds.length === 0) {
      checkAll.checked = false;
      checkAll.indeterminate = false;
      return;
    }
    var allChecked = visibleIds.every(function (id) {
      return state.selectedIds.indexOf(id) !== -1;
    });
    var someChecked = visibleIds.some(function (id) {
      return state.selectedIds.indexOf(id) !== -1;
    });
    checkAll.checked = allChecked;
    checkAll.indeterminate = !allChecked && someChecked;
  }

  function getVisibleIds() {
    var start = (state.page - 1) * state.pageSize;
    return state.filtered.slice(start, start + state.pageSize).map(function (i) {
      return i.id;
    });
  }

  function toggleCheckAll(checked) {
    var visibleIds = getVisibleIds();
    if (checked) {
      visibleIds.forEach(function (id) {
        if (state.selectedIds.indexOf(id) === -1) {
          state.selectedIds.push(id);
        }
      });
    } else {
      state.selectedIds = state.selectedIds.filter(function (id) {
        return visibleIds.indexOf(id) === -1;
      });
    }
    renderTable();
  }

  function clearSelection() {
    state.selectedIds = [];
    renderTable();
  }

  function renderBatchBar() {
    var bar = $("batchBar");
    $("batchCount").textContent = state.selectedIds.length;
    if (state.selectedIds.length > 0) {
      bar.classList.add("is-visible");
    } else {
      bar.classList.remove("is-visible");
    }
  }

  function batchDelete() {
    if (state.selectedIds.length === 0) return;
    confirmDelete(state.selectedIds.slice());
  }

  /* ---------- 新建 / 编辑 ---------- */
  function openCreate() {
    state.editingId = null;
    $("modalTitle").textContent = "新建直播间";
    $("formId").value = "";
    $("formName").value = "";
    $("formAnchor").value = "";
    $("formPlatform").value = "";
    $("formStartTime").value = "";
    $("formDuration").value = "";
    $("formDesc").value = "";
    $("formPushUrl").value = "";
    clearErrors();
    openModal("roomModal");
    $("formName").focus();
  }

  function openEdit(id) {
    var item = state.allData.find(function (x) {
      return x.id === id;
    });
    if (!item) return;
    state.editingId = id;
    $("modalTitle").textContent = "编辑直播间";
    $("formId").value = item.id;
    $("formName").value = item.name;
    $("formAnchor").value = item.anchor;
    $("formPlatform").value = item.platform;
    $("formStartTime").value = formatTimeToInput(item.startTime);
    $("formDuration").value = item.duration || "";
    $("formDesc").value = item.desc || "";
    $("formPushUrl").value = item.pushUrl || "";
    clearErrors();
    openModal("roomModal");
    $("formName").focus();
  }

  function clearErrors() {
    ["errName", "errAnchor", "errPlatform", "errStartTime"].forEach(function (eid) {
      var el = $(eid);
      el.textContent = "";
      el.classList.remove("is-visible");
    });
  }

  function showError(errId, msg) {
    var el = $(errId);
    el.textContent = msg;
    el.classList.add("is-visible");
  }

  function validateForm() {
    clearErrors();
    var valid = true;
    var name = $("formName").value.trim();
    var anchor = $("formAnchor").value.trim();
    var platform = $("formPlatform").value;
    var startTime = $("formStartTime").value;

    if (!name) {
      showError("errName", "请输入直播间名称");
      valid = false;
    }
    if (!anchor) {
      showError("errAnchor", "请输入主播姓名");
      valid = false;
    }
    if (!platform) {
      showError("errPlatform", "请选择直播平台");
      valid = false;
    }
    if (!startTime) {
      showError("errStartTime", "请选择计划开始时间");
      valid = false;
    }
    return valid;
  }

  function submitForm() {
    if (!validateForm()) return;

    var name = $("formName").value.trim();
    var anchor = $("formAnchor").value.trim();
    var platform = $("formPlatform").value;
    var startTime = formatInputToTime($("formStartTime").value);
    var duration = $("formDuration").value
      ? parseInt($("formDuration").value, 10)
      : null;
    var desc = $("formDesc").value.trim();
    var pushUrl = $("formPushUrl").value.trim();

    if (state.editingId) {
      // 编辑
      var idx = state.allData.findIndex(function (x) {
        return x.id === state.editingId;
      });
      if (idx !== -1) {
        state.allData[idx] = Object.assign({}, state.allData[idx], {
          name: name,
          anchor: anchor,
          platform: platform,
          startTime: startTime,
          duration: duration,
          desc: desc,
          pushUrl: pushUrl
        });
      }
      saveData(state.allData);
      closeModal("roomModal");
      toast("直播间「" + name + "」已更新", "success");
      render();
    } else {
      // 新建
      var newItem = {
        id: genId(),
        name: name,
        anchor: anchor,
        platform: platform,
        status: "pending",
        viewers: 0,
        startTime: startTime,
        duration: duration,
        desc: desc,
        pushUrl: pushUrl
      };
      state.allData.unshift(newItem);
      saveData(state.allData);
      closeModal("roomModal");
      toast("直播间「" + name + "」创建成功", "success");
      state.page = 1;
      render();
    }
  }

  /* ---------- 状态切换 ---------- */
  function toggleStatus(id) {
    var idx = state.allData.findIndex(function (x) {
      return x.id === id;
    });
    if (idx === -1) return;
    var item = state.allData[idx];
    var label = "";
    if (item.status === "pending") {
      item.status = "living";
      label = "已开始直播";
    } else if (item.status === "living") {
      item.status = "ended";
      label = "已结束直播";
    } else if (item.status === "disabled") {
      item.status = "pending";
      label = "已启用";
    } else {
      // ended -> 查看详情（演示中仅提示）
      toast("该直播间已结束，累计观看 " + item.viewers.toLocaleString() + " 人");
      return;
    }
    saveData(state.allData);
    toast("直播间「" + item.name + "」" + label, "success");
    render();
  }

  /* ---------- 删除 ---------- */
  function confirmDelete(ids) {
    state.deletingIds = ids.slice();
    var tip = $("deleteTip");
    if (ids.length === 1) {
      var item = state.allData.find(function (x) {
        return x.id === ids[0];
      });
      tip.innerHTML =
        "确定要删除直播间「<strong>" +
        escapeHtml(item ? item.name : "") +
        "」吗？</strong>删除后不可恢复，关联的观看数据将被保留但无法再进入该直播间。";
    } else {
      tip.innerHTML =
        "确定要删除选中的 <strong>" +
        ids.length +
        " 个直播间</strong>吗？删除后不可恢复，关联的观看数据将被保留但无法再进入这些直播间。";
    }
    openModal("deleteModal");
  }

  function executeDelete() {
    var count = state.deletingIds.length;
    state.allData = state.allData.filter(function (x) {
      return state.deletingIds.indexOf(x.id) === -1;
    });
    state.selectedIds = state.selectedIds.filter(function (id) {
      return state.deletingIds.indexOf(id) === -1;
    });
    saveData(state.allData);
    closeModal("deleteModal");
    state.deletingIds = [];
    toast("成功删除 " + count + " 个直播间", "success");
    render();
  }

  /* ---------- Modal 控制 ---------- */
  function openModal(id) {
    var mask = $(id);
    mask.classList.add("is-open");
    mask.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    var mask = $(id);
    mask.classList.remove("is-open");
    mask.setAttribute("aria-hidden", "true");
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    renderStats();
    renderTable();
  }

  function refreshData() {
    state.allData = getData();
    render();
    toast("数据已刷新", "success");
  }

  /* ---------- 侧边栏收起 ---------- */
  function toggleSidebar() {
    var sidebar = $("sidebar");
    sidebar.classList.toggle("is-collapsed");
  }

  /* ---------- 初始化 ---------- */
  function init() {
    state.allData = getData();

    // 搜索
    $("btnSearch").addEventListener("click", applyFilters);
    $("btnReset").addEventListener("click", resetFilters);

    // 回车搜索
    ["searchName", "searchAnchor"].forEach(function (id) {
      $(id).addEventListener("keypress", function (e) {
        if (e.key === "Enter") applyFilters();
      });
    });
    $("searchStatus").addEventListener("change", applyFilters);
    $("searchPlatform").addEventListener("change", applyFilters);

    // 新建
    $("btnCreate").addEventListener("click", openCreate);

    // 刷新
    $("btnRefresh").addEventListener("click", refreshData);

    // 全选
    $("checkAll").addEventListener("change", function () {
      toggleCheckAll(this.checked);
    });

    // 批量
    $("btnBatchDelete").addEventListener("click", batchDelete);
    $("btnBatchClear").addEventListener("click", clearSelection);

    // 分页大小
    $("pageSize").addEventListener("change", function () {
      state.pageSize = parseInt(this.value, 10);
      state.page = 1;
      renderTable();
    });

    // Modal：新建/编辑
    $("modalClose").addEventListener("click", function () {
      closeModal("roomModal");
    });
    $("modalCancel").addEventListener("click", function () {
      closeModal("roomModal");
    });
    $("modalSubmit").addEventListener("click", submitForm);

    // Modal：删除确认
    $("deleteClose").addEventListener("click", function () {
      closeModal("deleteModal");
    });
    $("deleteCancel").addEventListener("click", function () {
      closeModal("deleteModal");
    });
    $("deleteConfirm").addEventListener("click", executeDelete);

    // 点击遮罩关闭
    $("roomModal").addEventListener("click", function (e) {
      if (e.target === this) closeModal("roomModal");
    });
    $("deleteModal").addEventListener("click", function (e) {
      if (e.target === this) closeModal("deleteModal");
    });

    // ESC 关闭
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal("roomModal");
        closeModal("deleteModal");
      }
    });

    // 侧边栏收起
    $("collapseTrigger").addEventListener("click", toggleSidebar);

    // 首次渲染
    render();
  }

  /* ---------- 暴露给 onclick ---------- */
  window.__liveRoom__ = {
    openEdit: openEdit,
    toggleStatus: toggleStatus,
    confirmDelete: confirmDelete
  };

  // DOM 就绪后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
