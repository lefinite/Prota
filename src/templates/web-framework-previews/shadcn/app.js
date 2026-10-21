/**
 * Readify Enterprise Console — app.js
 * Native JS state-driven, equivalent to shadcn/ui interaction patterns.
 */
(function () {
  'use strict';

  /* ===== Mock Data ===== */
  var AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#3b82f6', '#ef4444',
    '#84cc16', '#f97316', '#14b8a6', '#a855f7'
  ];

  function initials(name) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }

  function colorFor(str) {
    var sum = 0;
    for (var i = 0; i < str.length; i++) sum += str.charCodeAt(i);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  var ROLE_LABEL = { admin: '管理员', editor: '编辑', viewer: '读者' };
  var STATUS_LABEL = { active: '活跃', disabled: '已停用', pending: '待激活' };

  var members = [
    { id: 1, name: '张明轩', email: 'mingxuan.z@readify.io', role: 'admin', status: 'active', joined: '2024-03-12', lastRead: '数字媒体艺术概论', articles: 47 },
    { id: 2, name: '李思琪', email: 'siqi.li@readify.io', role: 'admin', status: 'active', joined: '2024-04-01', lastRead: '用户体验设计原则', articles: 32 },
    { id: 3, name: '王浩然', email: 'haoran.w@readify.io', role: 'editor', status: 'active', joined: '2024-04-18', lastRead: '前端性能优化实战', articles: 18 },
    { id: 4, name: '陈雨桐', email: 'yutong.chen@readify.io', role: 'editor', status: 'active', joined: '2024-05-02', lastRead: '设计心理学', articles: 24 },
    { id: 5, name: '刘子涵', email: 'zihan.liu@readify.io', role: 'viewer', status: 'pending', joined: '2024-08-08', lastRead: '—', articles: 0 },
    { id: 6, name: 'Sarah Chen', email: 'sarah.c@readify.io', role: 'editor', status: 'active', joined: '2024-06-15', lastRead: 'AI 产品设计指南', articles: 15 },
    { id: 7, name: '赵宇航', email: 'yuhang.zhao@readify.io', role: 'viewer', status: 'active', joined: '2024-07-01', lastRead: '原子习惯', articles: 8 },
    { id: 8, name: '孙佳琪', email: 'jiaqi.sun@readify.io', role: 'editor', status: 'disabled', joined: '2024-05-20', lastRead: '—', articles: 12 },
    { id: 9, name: '周梓萱', email: 'zixuan.zhou@readify.io', role: 'viewer', status: 'active', joined: '2024-06-28', lastRead: '深度工作', articles: 6 },
    { id: 10, name: 'Marcus Lee', email: 'marcus.l@readify.io', role: 'viewer', status: 'pending', joined: '2024-08-09', lastRead: '—', articles: 0 }
  ];

  var contents = [
    { id: 1, title: '数字媒体艺术概论：从概念到实践', author: '张明轩', category: '艺术设计', views: 2847, status: 'published', updatedAt: '2024-08-09' },
    { id: 2, title: '用户体验设计的十个核心原则', author: '李思琪', category: '设计', views: 1923, status: 'published', updatedAt: '2024-08-08' },
    { id: 3, title: '前端性能优化实战手册', author: '王浩然', category: '技术', views: 1654, status: 'published', updatedAt: '2024-08-07' },
    { id: 4, title: 'AI 时代的阅读体验设计', author: 'Sarah Chen', category: '设计', views: 1432, status: 'published', updatedAt: '2024-08-06' },
    { id: 5, title: '如何打造个人知识管理系统', author: '陈雨桐', category: '效率', views: 1287, status: 'review', updatedAt: '2024-08-10' },
    { id: 6, title: '2024 年设计趋势展望', author: '李思琪', category: '设计', views: 876, status: 'draft', updatedAt: '2024-08-05' },
    { id: 7, title: '色彩心理学在界面设计中的应用', author: '张明轩', category: '设计', views: 743, status: 'published', updatedAt: '2024-08-04' },
    { id: 8, title: 'React Server Components 深度解析', author: '王浩然', category: '技术', views: 654, status: 'draft', updatedAt: '2024-08-03' }
  ];

  var activities = [
    { icon: 'blue', initial: '张', text: '<strong>张明轩</strong> 发布了新文章「数字媒体艺术概论」', time: '12 分钟前' },
    { icon: 'green', initial: '李', text: '<strong>李思琪</strong> 邀请了 <strong>刘子涵</strong> 加入工作区', time: '1 小时前' },
    { icon: 'purple', initial: '王', text: '<strong>王浩然</strong> 更新了「前端性能优化实战」', time: '3 小时前' },
    { icon: 'amber', initial: '系', text: '系统自动备份完成，共 <strong>1,284</strong> 篇文章', time: '5 小时前' },
    { icon: 'green', initial: '陈', text: '<strong>陈雨桐</strong> 将「设计心理学」提交审核', time: '昨天' },
    { icon: 'blue', initial: 'S', text: '<strong>Sarah Chen</strong> 评论了「AI 产品设计指南」', time: '昨天' }
  ];

  var topContent = [
    { title: '数字媒体艺术概论：从概念到实践', meta: '张明轩 · 艺术设计', views: '2.8K' },
    { title: '用户体验设计的十个核心原则', meta: '李思琪 · 设计', views: '1.9K' },
    { title: '前端性能优化实战手册', meta: '王浩然 · 技术', views: '1.6K' },
    { title: 'AI 时代的阅读体验设计', meta: 'Sarah Chen · 设计', views: '1.4K' },
    { title: '如何打造个人知识管理系统', meta: '陈雨桐 · 效率', views: '1.3K' }
  ];

  var trendData = [
    { label: '周一', value: 62 }, { label: '周二', value: 78 },
    { label: '周三', value: 85 }, { label: '周四', value: 71 },
    { label: '周五', value: 92 }, { label: '周六', value: 45 },
    { label: '周日', value: 38 }
  ];

  var categoryData = [
    { name: '设计', count: 487, pct: 100 },
    { name: '技术', count: 312, pct: 64 },
    { name: '效率', count: 198, pct: 41 },
    { name: '艺术', count: 156, pct: 32 },
    { name: '商业', count: 131, pct: 27 }
  ];

  /* ===== State ===== */
  var state = {
    view: 'dashboard',
    selectedMembers: {},
    drawerMember: null,
    currentSettingsSection: 'general'
  };

  /* ===== Helpers ===== */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ===== Toast ===== */
  function toast(msg, type) {
    var container = $('#toastContainer');
    var t = el('div', { class: 'toast' + (type ? ' toast--' + type : '') }, [msg]);
    container.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateY(12px)';
      t.style.transition = 'all 0.2s ease';
      setTimeout(function () { t.remove(); }, 200);
    }, 3000);
  }

  /* ===== Navigation ===== */
  function switchView(view) {
    state.view = view;
    $$('.view').forEach(function (v) { v.classList.remove('view--active'); });
    var target = $('#view-' + view);
    if (target) target.classList.add('view--active');

    $$('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.view === view);
    });

    var titles = {
      dashboard: { title: '控制台', subtitle: '欢迎回来，Ping。以下是你的工作区概况。' },
      members: { title: '成员管理', subtitle: '管理工作区成员和权限。' },
      content: { title: '内容管理', subtitle: '查看和管理所有文章。' },
      analytics: { title: '数据分析', subtitle: '查看阅读数据和趋势。' },
      settings: { title: '工作区设置', subtitle: '配置你的工作区。' }
    };
    var t = titles[view] || titles.dashboard;
    $('#viewTitle').textContent = t.title;
    $('#viewSubtitle').textContent = t.subtitle;

    // Mobile: close sidebar
    $('#sidebar').classList.remove('active');
  }

  /* ===== Render: Activity ===== */
  function renderActivity() {
    var list = $('#activityList');
    list.innerHTML = '';
    activities.forEach(function (a) {
      var item = el('div', { class: 'activity-item' }, [
        el('div', { class: 'activity-icon activity-icon--' + a.icon }, a.initial),
        el('div', { class: 'activity-content' }, [
          el('div', { class: 'activity-text', html: a.text }),
          el('div', { class: 'activity-time' }, a.time)
        ])
      ]);
      list.appendChild(item);
    });
  }

  /* ===== Render: Top Content ===== */
  function renderTopContent() {
    var list = $('#topContentList');
    list.innerHTML = '';
    topContent.forEach(function (c, i) {
      var item = el('div', { class: 'content-item' }, [
        el('div', { class: 'content-rank' + (i === 0 ? ' content-rank--top' : '') }, String(i + 1)),
        el('div', { class: 'content-info' }, [
          el('div', { class: 'content-title' }, c.title),
          el('div', { class: 'content-meta' }, c.meta)
        ]),
        el('div', { class: 'content-stat' }, c.views)
      ]);
      list.appendChild(item);
    });
  }

  /* ===== Render: Recent Members ===== */
  function renderRecentMembers() {
    var tbody = $('#recentMembersBody');
    tbody.innerHTML = '';
    members.slice(0, 5).forEach(function (m) {
      var statusBadge = m.status === 'active' ? 'badge-success' : m.status === 'pending' ? 'badge-warning' : 'badge-muted';
      var tr = el('tr', {}, [
        el('td', {}, [
          el('div', { class: 'member-cell' }, [
            el('div', { class: 'member-cell-avatar', style: 'background:' + colorFor(m.name) }, initials(m.name)),
            el('span', { class: 'member-cell-name' }, m.name)
          ])
        ]),
        el('td', {}, [ROLE_LABEL[m.role]]),
        el('td', { style: 'color:var(--muted-foreground)' }, m.lastRead),
        el('td', {}, [String(m.articles)]),
        el('td', {}, [el('span', { class: 'badge ' + statusBadge }, STATUS_LABEL[m.status])])
      ]);
      tbody.appendChild(tr);
    });
  }

  /* ===== Render: Members View ===== */
  function renderMembers() {
    var tbody = $('#membersBody');
    tbody.innerHTML = '';
    var selected = Object.keys(state.selectedMembers).length;

    members.forEach(function (m) {
      var isChecked = !!state.selectedMembers[m.id];
      var statusBadge = m.status === 'active' ? 'badge-success' : m.status === 'pending' ? 'badge-warning' : 'badge-muted';
      var checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = isChecked;
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) state.selectedMembers[m.id] = true;
        else delete state.selectedMembers[m.id];
        updateBulkButton();
      });

      var tr = el('tr', {}, [
        el('td', { class: 'col-check' }, [checkbox]),
        el('td', {}, [
          el('div', { class: 'member-cell' }, [
            el('div', { class: 'member-cell-avatar', style: 'background:' + colorFor(m.name) }, initials(m.name)),
            el('span', { class: 'member-cell-name' }, m.name)
          ])
        ]),
        el('td', { style: 'color:var(--muted-foreground)' }, m.email),
        el('td', {}, [ROLE_LABEL[m.role]]),
        el('td', { style: 'color:var(--muted-foreground)' }, m.joined),
        el('td', {}, [el('span', { class: 'badge ' + statusBadge }, STATUS_LABEL[m.status])]),
        el('td', {}, [
          el('button', {
            class: 'btn btn-ghost btn-xs',
            onclick: function () { openDrawer(m); }
          }, '详情')
        ])
      ]);
      tbody.appendChild(tr);
    });

    $('#memberCount').textContent = members.length + ' 名成员';
    updateBulkButton();
  }

  function updateBulkButton() {
    var count = Object.keys(state.selectedMembers).length;
    var btn = $('#btnBulkActions');
    btn.disabled = count === 0;
    btn.textContent = count > 0 ? '批量操作 (' + count + ')' : '批量操作';
  }

  /* ===== Render: Content View ===== */
  function renderContent() {
    var tbody = $('#contentBody');
    tbody.innerHTML = '';

    contents.forEach(function (c) {
      var statusBadge = c.status === 'published' ? 'badge-success' : c.status === 'draft' ? 'badge-muted' : 'badge-warning';
      var statusText = c.status === 'published' ? '已发布' : c.status === 'draft' ? '草稿' : '审核中';

      var tr = el('tr', {}, [
        el('td', {}, [el('span', { style: 'font-weight:500' }, c.title)]),
        el('td', { style: 'color:var(--muted-foreground)' }, c.author),
        el('td', {}, [el('span', { class: 'badge badge-muted' }, c.category)]),
        el('td', {}, [String(c.views)]),
        el('td', {}, [el('span', { class: 'badge ' + statusBadge }, statusText)]),
        el('td', { style: 'color:var(--muted-foreground)' }, c.updatedAt),
        el('td', {}, [
          el('button', {
            class: 'btn btn-ghost btn-xs',
            onclick: function () { toast('编辑功能演示'); }
          }, '编辑')
        ])
      ]);
      tbody.appendChild(tr);
    });

    $('#contentCount').textContent = contents.length + ' 篇文章';
  }

  /* ===== Render: Chart ===== */
  function renderChart() {
    var chart = $('#trendChart');
    chart.innerHTML = '';
    var maxVal = Math.max.apply(null, trendData.map(function (d) { return d.value; }));

    trendData.forEach(function (d) {
      var height = Math.round(d.value / maxVal * 180);
      var bar = el('div', { class: 'chart-bar' }, [
        el('div', { class: 'chart-bar-fill', style: 'height:' + height + 'px', 'data-value': d.value }),
        el('div', { class: 'chart-bar-label' }, d.label)
      ]);
      chart.appendChild(bar);
    });
  }

  /* ===== Render: Category Bars ===== */
  function renderCategoryBars() {
    var container = $('#categoryBars');
    container.innerHTML = '';

    categoryData.forEach(function (c) {
      var bar = el('div', { class: 'category-bar' }, [
        el('div', { class: 'category-bar-header' }, [
          el('span', { class: 'category-bar-label' }, c.name),
          el('span', { class: 'category-bar-value' }, c.count + ' 篇')
        ]),
        el('div', { class: 'category-bar-track' }, [
          el('div', { class: 'category-bar-fill', style: 'width:' + c.pct + '%' })
        ])
      ]);
      container.appendChild(bar);
    });
  }

  /* ===== Drawer ===== */
  function openDrawer(m) {
    state.drawerMember = m;
    var body = $('#drawerBody');
    body.innerHTML = '';

    body.appendChild(el('div', { class: 'drawer-profile' }, [
      el('div', { class: 'drawer-avatar', style: 'background:' + colorFor(m.name) }, initials(m.name)),
      el('div', { class: 'drawer-name' }, m.name),
      el('div', { class: 'drawer-email' }, m.email)
    ]));

    body.appendChild(el('div', { class: 'drawer-section' }, [
      el('div', { class: 'drawer-section-title' }, '账户信息'),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '角色'), el('span', { class: 'drawer-row-value' }, ROLE_LABEL[m.role])]),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '状态'), el('span', { class: 'drawer-row-value' }, [el('span', { class: 'badge ' + (m.status === 'active' ? 'badge-success' : m.status === 'pending' ? 'badge-warning' : 'badge-muted') }, STATUS_LABEL[m.status])])]),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '加入时间'), el('span', { class: 'drawer-row-value' }, m.joined)]),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '文章数'), el('span', { class: 'drawer-row-value' }, String(m.articles))])
    ]));

    body.appendChild(el('div', { class: 'drawer-section' }, [
      el('div', { class: 'drawer-section-title' }, '权限'),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '内容访问'), el('span', { class: 'drawer-row-value' }, m.role === 'viewer' ? '只读' : '可编辑')]),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '成员管理'), el('span', { class: 'drawer-row-value' }, m.role === 'admin' ? '是' : '否')]),
      el('div', { class: 'drawer-row' }, [el('span', { class: 'drawer-row-label' }, '设置修改'), el('span', { class: 'drawer-row-value' }, m.role === 'admin' ? '是' : '否')])
    ]));

    var actionBtn = $('#drawerAction');
    actionBtn.textContent = m.status === 'active' ? '停用账号' : '重新激活';
    actionBtn.className = 'btn btn-block ' + (m.status === 'active' ? 'btn-outline' : 'btn-primary');

    $('#drawerOverlay').classList.add('active');
    $('#memberDrawer').classList.add('active');
  }

  function closeDrawer() {
    $('#drawerOverlay').classList.remove('active');
    $('#memberDrawer').classList.remove('active');
    state.drawerMember = null;
  }

  /* ===== Invite Modal ===== */
  function openInviteModal() {
    $('#inviteModal').classList.add('active');
    setTimeout(function () { $('#inviteEmail').focus(); }, 100);
  }

  function closeInviteModal() {
    $('#inviteModal').classList.remove('active');
    $('#inviteEmail').value = '';
  }

  function sendInvite() {
    var email = $('#inviteEmail').value.trim();
    if (!email) {
      toast('请输入邮箱地址', 'error');
      return;
    }

    var role = $('#inviteRole').value;
    var name = email.split('@')[0].split(/[._-]/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');

    members.push({
      id: Date.now(),
      name: name,
      email: email,
      role: role,
      status: 'pending',
      joined: new Date().toISOString().slice(0, 10),
      lastRead: '—',
      articles: 0
    });

    activities.unshift({
      icon: 'green', initial: '你',
      text: '<strong>你</strong> 邀请了 <strong>' + name + '</strong> 加入工作区',
      time: '刚刚'
    });

    closeInviteModal();
    renderMembers();
    renderRecentMembers();
    renderActivity();
    toast('邀请已发送至 ' + email, 'success');
  }

  /* ===== Settings ===== */
  function switchSettingsSection(section) {
    state.currentSettingsSection = section;
    $$('.settings-nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.section === section);
    });
    $$('.settings-section').forEach(function (s) {
      s.classList.toggle('active', s.id === 'section-' + section);
    });
  }

  /* ===== Init ===== */
  function init() {
    // Render initial views
    renderActivity();
    renderTopContent();
    renderRecentMembers();
    renderMembers();
    renderContent();
    renderChart();
    renderCategoryBars();

    // Sidebar nav
    $$('.nav-item').forEach(function (n) {
      n.addEventListener('click', function (e) {
        e.preventDefault();
        switchView(n.dataset.view);
      });
    });

    // Mobile sidebar toggle
    $('#sidebarToggle').addEventListener('click', function () {
      $('#sidebar').classList.toggle('active');
    });

    // Invite modal
    $('#btnInvite').addEventListener('click', openInviteModal);
    $('#closeInviteModal').addEventListener('click', closeInviteModal);
    $('#cancelInvite').addEventListener('click', closeInviteModal);
    $('#sendInvite').addEventListener('click', sendInvite);

    // Drawer
    $('#closeDrawer').addEventListener('click', closeDrawer);
    $('#drawerOverlay').addEventListener('click', closeDrawer);
    $('#drawerAction').addEventListener('click', function () {
      var m = state.drawerMember;
      if (!m) return;
      if (m.status === 'active') {
        m.status = 'disabled';
        toast(m.name + ' 已停用', 'error');
      } else {
        m.status = 'active';
        toast(m.name + ' 已重新激活', 'success');
      }
      closeDrawer();
      renderMembers();
      renderRecentMembers();
    });

    // Settings nav
    $$('.settings-nav-item').forEach(function (n) {
      n.addEventListener('click', function (e) {
        e.preventDefault();
        switchSettingsSection(n.dataset.section);
      });
    });

    // Settings save buttons
    $$('.form-actions .btn-primary').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toast('设置已保存', 'success');
      });
    });

    // Theme options
    $$('.theme-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        $$('.theme-option').forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');
        toast('主题已更新', 'success');
      });
    });

    // Color options
    $$('.color-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        $$('.color-option').forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');
        toast('主色调已更新', 'success');
      });
    });

    // Select All checkbox
    var selectAllCb = $('#selectAll');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', function () {
        var checked = selectAllCb.checked;
        state.selectedMembers = {};
        if (checked) {
          members.forEach(function (m) { state.selectedMembers[m.id] = true; });
        }
        renderMembers();
      });
    }

    // Bulk actions
    $('#btnBulkActions').addEventListener('click', function () {
      var count = Object.keys(state.selectedMembers).length;
      if (count === 0) return;
      toast('已对 ' + count + ' 名成员执行操作', 'info');
      state.selectedMembers = {};
      renderMembers();
    });

    // Add member button (in members view)
    $('#btnAddMember').addEventListener('click', openInviteModal);

    // New content button
    $('#btnNewContent').addEventListener('click', function () {
      toast('新建文章功能演示', 'info');
    });

    // Export button
    $('#btnExport').addEventListener('click', function () {
      toast('报告已开始生成，完成后将发送至邮箱', 'success');
    });

    // Search inputs
    $('#memberSearch').addEventListener('input', function (e) {
      // Simple filter demo
      var q = e.target.value.toLowerCase();
      $$('#membersBody tr').forEach(function (tr) {
        var name = tr.querySelector('.member-cell-name');
        if (name) {
          tr.style.display = name.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
        }
      });
    });

    // Content search
    $('#contentSearch').addEventListener('input', function (e) {
      var q = e.target.value.toLowerCase();
      $$('#contentBody tr').forEach(function (tr) {
        var title = tr.querySelector('span');
        if (title) {
          tr.style.display = title.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
        }
      });
    });

    // Filter role
    $('#filterRole').addEventListener('change', function (e) {
      var role = e.target.value;
      renderMembers();
      if (role) {
        $$('#membersBody tr').forEach(function (tr, i) {
          if (members[i] && members[i].role !== role) {
            tr.style.display = 'none';
          }
        });
      }
    });

    // Filter content status
    $('#filterStatus').addEventListener('change', function (e) {
      var status = e.target.value;
      renderContent();
      if (status) {
        $$('#contentBody tr').forEach(function (tr, i) {
          if (contents[i] && contents[i].status !== status) {
            tr.style.display = 'none';
          }
        });
      }
    });

    // ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeInviteModal();
        closeDrawer();
      }
    });

    // Click overlay closes modal
    $('#inviteModal').addEventListener('click', function (e) {
      if (e.target === this) closeInviteModal();
    });

    // Goto links
    $$('[data-goto]').forEach(function (el) {
      el.addEventListener('click', function () {
        switchView(el.dataset.goto);
      });
    });

    // Notification badge demo
    var notifBtn = $('button[aria-label="通知"]');
    if (notifBtn) {
      notifBtn.addEventListener('click', function () {
        toast('3 条新通知', 'info');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
