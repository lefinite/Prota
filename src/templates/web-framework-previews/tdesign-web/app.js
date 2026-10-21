/* ============================================================
   TDesign Web · 内容运营控制台 — 交互逻辑
   纯原生 JS：状态管理、渲染、筛选、分页、Drawer、Dialog、Toast。
   ============================================================ */

(function () {
  'use strict';

  // ---- Helpers ----
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const fmt = (n) => n.toLocaleString('zh-CN');
  const fmtMoney = (n) => '¥' + fmt(n);

  // ---- Channel meta ----
  const CHANNELS = {
    wechat: { label: '微信生态', short: '微', color: '#07C160' },
    douyin: { label: '抖音', short: '抖', color: '#000000' },
    xiaohongshu: { label: '小红书', short: '红', color: '#FF2442' },
    bilibili: { label: '哔哩哔哩', short: 'B', color: '#00A1D6' },
    app: { label: '自有App', short: 'A', color: '#0052D9' },
  };

  // ---- Status meta ----
  const STATUS = {
    running: { label: '投放中', tag: 'tag-primary', dot: true },
    review: { label: '待审核', tag: 'tag-warning', dot: true },
    ended: { label: '已结束', tag: 'tag-default' },
    paused: { label: '已暂停', tag: 'tag-default' },
    rejected: { label: '审核驳回', tag: 'tag-error' },
    draft: { label: '草稿', tag: 'tag-default' },
  };

  // ---- Mock Data: 投放计划 ----
  let plans = [
    {
      id: 'CP-20260810-0312', name: '暑期阅读季·会员限时直降', channel: 'wechat', type: '图文',
      status: 'running', audience: '拉新用户', exposure: 486200, click: 6.8, conv: 3.2,
      cost: 18600, budget: 30000, range: '08/05 ~ 08/20', updated: '10分钟前',
      desc: '面向微信生态新用户，推送会员月卡限时优惠，结合公众号推文与朋友圈广告。',
    },
    {
      id: 'CP-20260810-0288', name: '夜读电台·情感品类专项', channel: 'douyin', type: '短视频',
      status: 'running', audience: '活跃用户', exposure: 1284600, click: 5.2, conv: 2.1,
      cost: 42300, budget: 50000, range: '08/01 ~ 08/31', updated: '32分钟前',
      desc: '抖音信息流投放，主打情感夜读场景，匹配 25-35 岁女性用户群体。',
    },
    {
      id: 'CP-20260809-0156', name: '儿童绘本·开学季预热', channel: 'xiaohongshu', type: '图文',
      status: 'review', audience: '高价值会员', exposure: 0, click: 0, conv: 0,
      cost: 0, budget: 20000, range: '08/15 ~ 09/05', updated: '2小时前',
      desc: '小红书达人种草，覆盖育儿垂类，配合开学节点推儿童绘本礼盒。',
    },
    {
      id: 'CP-20260808-0102', name: '名家领读·文学经典专场', channel: 'bilibili', type: '直播',
      status: 'running', audience: '活跃用户', exposure: 312800, click: 8.1, conv: 4.5,
      cost: 15800, budget: 25000, range: '08/08 ~ 08/18', updated: '1小时前',
      desc: 'B站直播推流，邀请知名作家连麦，直播间挂载图书购买链接。',
    },
    {
      id: 'CP-20260807-0091', name: '沉睡用户召回·Push专项', channel: 'app', type: '落地页',
      status: 'running', audience: '沉睡召回', exposure: 925600, click: 4.3, conv: 1.8,
      cost: 8200, budget: 15000, range: '08/07 ~ 08/14', updated: '今天 09:20',
      desc: '自有 App 内 Push 推送与开屏广告，召回 30 天未活跃用户。',
    },
    {
      id: 'CP-20260806-0078', name: '听书会员·通勤场景拉新', channel: 'douyin', type: '短视频',
      status: 'review', audience: '拉新用户', exposure: 0, click: 0, conv: 0,
      cost: 0, budget: 35000, range: '08/12 ~ 08/26', updated: '昨天 18:45',
      desc: '抖音短视频矩阵投放，主打通勤听书场景，素材已就绪待审核上线。',
    },
    {
      id: 'CP-20260805-0065', name: '暑假读书营·社群裂变', channel: 'wechat', type: '落地页',
      status: 'paused', audience: '活跃用户', exposure: 158400, click: 7.2, conv: 5.1,
      cost: 6800, budget: 12000, range: '08/05 ~ 08/19', updated: '昨天 14:10',
      desc: '微信社群裂变活动，用户邀请好友得读书币，已达预期暂停优化中。',
    },
    {
      id: 'CP-20260804-0052', name: '知识付费专栏·年中盘点', channel: 'xiaohongshu', type: '图文',
      status: 'ended', audience: '高价值会员', exposure: 268900, click: 6.5, conv: 3.8,
      cost: 14200, budget: 14000, range: '07/20 ~ 08/04', updated: '08/04 23:59',
      desc: '小红书图文投放，年中知识专栏合集推荐，已按计划结束。',
    },
    {
      id: 'CP-20260803-0041', name: '有声书·悬疑品类爆款', channel: 'bilibili', type: '短视频',
      status: 'ended', audience: '拉新用户', exposure: 892300, click: 9.2, conv: 3.4,
      cost: 38600, budget: 40000, range: '07/15 ~ 08/03', updated: '08/03 22:00',
      desc: 'B站悬疑有声书爆款投放，转化率超预期，已结案归档。',
    },
    {
      id: 'CP-20260802-0033', name: '会员日·每月8号特惠', channel: 'app', type: '落地页',
      status: 'rejected', audience: '高价值会员', exposure: 0, click: 0, conv: 0,
      cost: 0, budget: 10000, range: '08/08', updated: '08/02 16:30',
      desc: '自有 App 会员日落地页，因活动规则描述不合规被审核驳回，待修改后重新提交。',
    },
    {
      id: 'CP-20260801-0028', name: '外刊精读·职场提升季', channel: 'wechat', type: '图文',
      status: 'ended', exposure: 421500, click: 5.8, conv: 2.9, audience: '活跃用户',
      cost: 19800, budget: 20000, range: '07/18 ~ 08/01', updated: '08/01 20:00',
      desc: '公众号图文投放，外刊精读专栏推广，面向职场白领人群。',
    },
    {
      id: 'CP-20260730-0019', name: '儿童英语启蒙·启蒙阶段', channel: 'douyin', type: '短视频',
      status: 'ended', exposure: 645200, click: 7.1, conv: 3.1, audience: '拉新用户',
      cost: 31200, budget: 32000, range: '07/10 ~ 07/30', updated: '07/30 23:00',
      desc: '抖音亲子赛道投放，儿童英语启蒙绘本套装推广。',
    },
  ];

  // ---- Pipeline health data ----
  const PIPELINE = [
    { channel: 'wechat', name: '微信生态', ok: 78, warn: 15, err: 7, rate: 96.2 },
    { channel: 'douyin', name: '抖音', ok: 82, warn: 12, err: 6, rate: 97.8 },
    { channel: 'xiaohongshu', name: '小红书', ok: 68, warn: 22, err: 10, rate: 93.1 },
    { channel: 'bilibili', name: '哔哩哔哩', ok: 91, warn: 6, err: 3, rate: 99.1 },
    { channel: 'app', name: '自有App', ok: 95, warn: 4, err: 1, rate: 99.6 },
  ];

  // ---- State ----
  const state = {
    view: 'dashboard',
    ftab: 'all',
    search: '',
    channel: 'all',
    sort: 'time-desc',
    page: 1,
    pageSize: 6,
    selected: new Set(),
    trend: 'exposure',
    createAudience: 'new',
  };

  // ============================================================
  // Toast
  // ============================================================
  function toast(msg, type = 'info') {
    const wrap = $('#toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icons = {
      success: '<svg class="toast-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
      warning: '<svg class="toast-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      error: '<svg class="toast-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
      info: '<svg class="toast-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    };
    el.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  // ============================================================
  // KPI Strip
  // ============================================================
  function renderKPI() {
    const data = [
      { label: '累计曝光', value: '386.4', unit: '万', delta: 12.6, up: true,
        ico: '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
        bg: 'var(--td-brand-bg)', color: 'var(--td-brand)' },
      { label: '平均转化率', value: '3.24', unit: '%', delta: 0.4, up: true,
        ico: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
        bg: 'var(--td-success-bg)', color: 'var(--td-success)' },
      { label: '今日消耗', value: '12,860', unit: '元', delta: 8.2, up: false,
        ico: '<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
        bg: 'var(--td-warning-bg)', color: 'var(--td-warning)' },
      { label: '活跃计划', value: '7', unit: '/ 12', delta: 2, up: true, isCount: true,
        ico: '<svg viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
        bg: 'var(--td-info-bg)', color: 'var(--td-info)' },
    ];

    const html = data.map(k => `
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">${k.label}</span>
          <span class="kpi-ico" style="background:${k.bg};color:${k.color}">${k.ico}</span>
        </div>
        <div class="kpi-value">${k.value}<span class="unit">${k.unit}</span></div>
        <div class="kpi-bottom">
          <span class="delta ${k.up ? 'up' : 'down'}">
            <svg viewBox="0 0 24 24" fill="currentColor">${k.up ? '<path d="M7 14l5-5 5 5z"/>' : '<path d="M7 10l5 5 5-5z"/>'}</svg>
            ${k.isCount ? '+' : ''}${k.delta}${k.isCount ? '' : '%'}
          </span>
          <span class="delta-text">较昨日</span>
        </div>
      </div>
    `).join('');

    $('#kpi-strip').innerHTML = html;
  }

  // ============================================================
  // Trend Chart (SVG area chart)
  // ============================================================
  const TREND_DATA = {
    exposure: [62, 71, 68, 79, 85, 82, 91, 88, 96, 103, 99, 112, 118, 128],
    conversion: [2.1, 2.3, 2.0, 2.5, 2.8, 2.6, 3.0, 2.9, 3.2, 3.4, 3.1, 3.5, 3.3, 3.6],
  };
  const TREND_META = {
    exposure: { num: '1,284,690', label: '累计曝光', delta: 12.6, up: true },
    conversion: { num: '3.6%', label: '平均转化率', delta: 0.4, up: true },
  };

  function renderTrend() {
    const key = state.trend;
    const data = TREND_DATA[key];
    const meta = TREND_META[key];
    const w = 100, h = 100;
    const max = Math.max(...data) * 1.1;
    const min = Math.min(...data) * 0.85;
    const stepX = w / (data.length - 1);
    const pts = data.map((v, i) => [i * stepX, h - ((v - min) / (max - min)) * (h - 10) - 5]);
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    const areaPath = linePath + ' L' + w + ',' + h + ' L0,' + h + ' Z';
    const convClass = key === 'conversion' ? ' conv' : '';

    // grid lines
    let grid = '';
    for (let i = 1; i <= 3; i++) {
      const y = (h / 4) * i;
      grid += `<line class="tc-grid" x1="0" y1="${y}" x2="${w}" y2="${y}" vector-effect="non-scaling-stroke"/>`;
    }

    $('#trend-chart').innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        ${grid}
        <path class="tc-area${convClass}" d="${areaPath}"/>
        <path class="tc-line${convClass}" d="${linePath}" vector-effect="non-scaling-stroke"/>
      </svg>
    `;

    $('#trend-num').textContent = meta.num;
    $('#trend-label').textContent = meta.label;
    const deltaEl = $('#trend-delta');
    deltaEl.className = 'trend-delta ' + (meta.up ? 'up' : 'down');
    deltaEl.innerHTML = `
      <svg viewBox="0 0 24 24">${meta.up ? '<path d="M7 14l5-5 5 5z"/>' : '<path d="M7 10l5 5 5-5z"/>'}</svg>
      <span>${meta.delta}${key === 'conversion' ? 'pp' : '%'}</span>
      <span class="trend-delta-text">较上周期</span>
    `;
  }

  // ============================================================
  // Pipeline list
  // ============================================================
  function renderPipeline() {
    const html = PIPELINE.map(p => {
      const ch = CHANNELS[p.channel];
      return `
        <div class="pipe-item">
          <div class="pipe-channel" style="background:${ch.color}20;color:${ch.color}">${ch.short}</div>
          <div class="pipe-info">
            <div class="pipe-name">${p.name}</div>
            <div class="pipe-progress">
              <div class="pipe-seg ok" style="width:${p.ok}%"></div>
              <div class="pipe-seg warn" style="width:${p.warn}%"></div>
              <div class="pipe-seg err" style="width:${p.err}%"></div>
            </div>
            <div class="pipe-meta">
              <span>正常 ${p.ok}%</span><span>·</span>
              <span>预警 ${p.warn}%</span><span>·</span>
              <span>异常 ${p.err}%</span>
            </div>
          </div>
          <div class="pipe-rate">${p.rate}%</div>
        </div>
      `;
    }).join('');
    $('#pipe-list').innerHTML = html;
  }

  // ============================================================
  // Recent table (dashboard)
  // ============================================================
  function renderRecent() {
    const recent = [...plans].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
    $('#recent-tbody').innerHTML = recent.map(p => {
      const ch = CHANNELS[p.channel];
      const st = STATUS[p.status];
      return `
        <tr data-id="${p.id}">
          <td>
            <div class="plan-cell">
              <div class="plan-thumb" style="background:${ch.color}">${ch.short}</div>
              <div class="plan-meta">
                <div class="plan-name">${p.name}</div>
                <div class="plan-id">${p.id}</div>
              </div>
            </div>
          </td>
          <td><span class="channel-tag"><span class="channel-icon" style="background:${ch.color}">${ch.short}</span>${ch.label}</span></td>
          <td><span class="tag ${st.tag}">${st.dot ? '<i class="tag-dot"></i>' : ''}${st.label}</span></td>
          <td>${p.audience}</td>
          <td class="num-col">${p.exposure ? fmt(p.exposure) : '—'}</td>
          <td class="num-col">${p.conv ? p.conv + '%' : '—'}</td>
          <td class="num-col">${p.cost ? fmtMoney(p.cost) : '—'}</td>
          <td style="color:var(--td-text-secondary)">${p.updated}</td>
        </tr>
      `;
    }).join('');
  }

  // ============================================================
  // Content table (with filter + pagination)
  // ============================================================
  function getFiltered() {
    let list = plans.filter(p => {
      if (state.ftab !== 'all' && p.status !== state.ftab) return false;
      if (state.channel !== 'all' && p.channel !== state.channel) return false;
      if (state.search && !p.name.toLowerCase().includes(state.search.toLowerCase()) && !p.id.toLowerCase().includes(state.search.toLowerCase())) return false;
      return true;
    });
    if (state.sort === 'exposure-desc') list.sort((a, b) => b.exposure - a.exposure);
    else if (state.sort === 'cost-desc') list.sort((a, b) => b.cost - a.cost);
    else list.sort((a, b) => b.id.localeCompare(a.id));
    return list;
  }

  function renderContent() {
    const all = plans;
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.pageSize;
    const pageData = filtered.slice(start, start + state.pageSize);

    // tab counts
    $('#ftab-count-all').textContent = all.length;
    $('#ftab-count-running').textContent = all.filter(p => p.status === 'running').length;
    $('#ftab-count-review').textContent = all.filter(p => p.status === 'review').length;
    $('#ftab-count-ended').textContent = all.filter(p => p.status === 'ended').length;

    // table body
    if (pageData.length === 0) {
      $('#content-tbody').innerHTML = `
        <tr><td colspan="10" style="text-align:center;padding:48px;color:var(--td-text-placeholder)">
          <div style="margin-bottom:8px;font-size:28px;opacity:.5">📭</div>
          暂无符合条件的投放计划
        </td></tr>
      `;
    } else {
      $('#content-tbody').innerHTML = pageData.map(p => {
        const ch = CHANNELS[p.channel];
        const st = STATUS[p.status];
        const checked = state.selected.has(p.id) ? 'checked' : '';
        return `
          <tr data-id="${p.id}">
            <td class="td-check"><input type="checkbox" class="row-check" data-id="${p.id}" ${checked}/></td>
            <td>
              <div class="plan-cell">
                <div class="plan-thumb" style="background:${ch.color}">${ch.short}</div>
                <div class="plan-meta">
                  <div class="plan-name">${p.name}</div>
                  <div class="plan-id">${p.id}</div>
                </div>
              </div>
            </td>
            <td><span class="channel-tag"><span class="channel-icon" style="background:${ch.color}">${ch.short}</span>${ch.label}</span></td>
            <td><span class="tag ${st.tag}">${st.dot ? '<i class="tag-dot"></i>' : ''}${st.label}</span></td>
            <td class="num-col">${p.exposure ? fmt(p.exposure) : '—'}</td>
            <td class="num-col">${p.click ? p.click + '%' : '—'}</td>
            <td class="num-col">${p.conv ? p.conv + '%' : '—'}</td>
            <td class="num-col">${p.cost ? fmtMoney(p.cost) : '—'}</td>
            <td style="color:var(--td-text-secondary);white-space:nowrap">${p.range}</td>
            <td class="th-actions">
              <div class="row-actions">
                <button class="row-action-btn" data-action="view-detail" data-id="${p.id}">详情</button>
                <span class="row-action-divider"></span>
                <button class="row-action-btn" data-action="row-more" data-id="${p.id}">更多</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // footer
    $('#content-footer-info').textContent = `共 ${filtered.length} 条`;

    // pagination
    let pagerHtml = `<button class="page-btn" id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      pagerHtml += `<button class="page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    pagerHtml += `<button class="page-btn" id="next-page" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>`;
    $('#pager').innerHTML = pagerHtml;

    // update batch bar
    updateBatchBar();
  }

  function updateBatchBar() {
    const bar = $('#batch-bar');
    if (state.selected.size > 0) {
      bar.classList.remove('hidden');
      $('#batch-count').textContent = state.selected.size;
    } else {
      bar.classList.add('hidden');
    }
    // header checkbox
    const filtered = getFiltered();
    const allChecked = filtered.length > 0 && filtered.every(p => state.selected.has(p.id));
    const checkAll = $('#check-all');
    if (checkAll) checkAll.checked = allChecked;
  }

  // ============================================================
  // Detail Drawer
  // ============================================================
  function openDrawer(id) {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    const ch = CHANNELS[p.channel];
    const st = STATUS[p.status];

    $('#drawer-title').textContent = p.name;
    $('#drawer-status').outerHTML = `<span class="tag ${st.tag} drawer-status" id="drawer-status">${st.dot ? '<i class="tag-dot"></i>' : ''}${st.label}</span>`;

    const costPct = p.budget > 0 ? Math.round((p.cost / p.budget) * 100) : 0;

    $('#drawer-body').innerHTML = `
      <div class="dd-section">
        <div class="dd-metrics">
          <div class="dd-metric">
            <div class="dd-metric-label">累计曝光</div>
            <div class="dd-metric-value">${p.exposure ? fmt(p.exposure) : '—'}</div>
          </div>
          <div class="dd-metric">
            <div class="dd-metric-label">转化率</div>
            <div class="dd-metric-value">${p.conv ? p.conv + '<span class="unit">%</span>' : '—'}</div>
          </div>
          <div class="dd-metric">
            <div class="dd-metric-label">已消耗</div>
            <div class="dd-metric-value">${p.cost ? fmtMoney(p.cost) : '—'}</div>
          </div>
          <div class="dd-metric">
            <div class="dd-metric-label">预算进度</div>
            <div class="dd-metric-value">${costPct}<span class="unit">%</span></div>
          </div>
        </div>
      </div>
      <div class="dd-section">
        <div class="dd-section-title">基本信息</div>
        <dl class="dd-desc-list">
          <dt>计划ID</dt><dd style="font-family:var(--td-font-mono);font-size:12px">${p.id}</dd>
          <dt>投放渠道</dt><dd>${ch.label}</dd>
          <dt>内容类型</dt><dd>${p.type}</dd>
          <dt>目标受众</dt><dd>${p.audience}</dd>
          <dt>投放周期</dt><dd>${p.range}</dd>
          <dt>预算上限</dt><dd>${fmtMoney(p.budget)}</dd>
        </dl>
      </div>
      <div class="dd-section">
        <div class="dd-section-title">计划说明</div>
        <p style="margin:0;font-size:13px;line-height:1.7;color:var(--td-text-secondary)">${p.desc}</p>
      </div>
      <div class="dd-section">
        <div class="dd-section-title">操作记录</div>
        <div class="dd-timeline">
          <div class="dd-timeline-item">
            <div class="dd-timeline-dot ${p.status === 'running' ? '' : 'success'}"></div>
            <div class="dd-timeline-content">
              <div class="dd-timeline-title">${st.label === '投放中' ? '计划开始投放' : '状态更新为「' + st.label + '」'}</div>
              <div class="dd-timeline-time">${p.updated}</div>
            </div>
          </div>
          <div class="dd-timeline-item">
            <div class="dd-timeline-dot success"></div>
            <div class="dd-timeline-content">
              <div class="dd-timeline-title">审核通过</div>
              <div class="dd-timeline-time">陈思远 · ${p.range.split('~')[0].trim()} 前一天</div>
            </div>
          </div>
          <div class="dd-timeline-item">
            <div class="dd-timeline-dot success"></div>
            <div class="dd-timeline-content">
              <div class="dd-timeline-title">计划已创建</div>
              <div class="dd-timeline-time">系统自动记录</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // footer actions depend on status
    let footer = '';
    if (p.status === 'running') {
      footer = `
        <button class="btn btn-danger-outline btn-sm" data-action="drawer-end" data-id="${p.id}">结束投放</button>
        <button class="btn btn-outline btn-sm" data-action="drawer-pause" data-id="${p.id}">暂停</button>
        <button class="btn btn-primary btn-sm" data-action="drawer-edit" data-id="${p.id}">编辑</button>
      `;
    } else if (p.status === 'review') {
      footer = `
        <button class="btn btn-danger-outline btn-sm" data-action="drawer-reject" data-id="${p.id}">驳回</button>
        <button class="btn btn-primary btn-sm" data-action="drawer-approve" data-id="${p.id}">审核通过</button>
      `;
    } else if (p.status === 'paused') {
      footer = `
        <button class="btn btn-danger-outline btn-sm" data-action="drawer-end" data-id="${p.id}">结束投放</button>
        <button class="btn btn-primary btn-sm" data-action="drawer-resume" data-id="${p.id}">恢复投放</button>
      `;
    } else {
      footer = `<button class="btn btn-outline btn-sm" data-action="drawer-duplicate" data-id="${p.id}">复制新建</button>`;
    }
    $('#drawer-footer').innerHTML = footer;

    $('#drawer-mask').classList.remove('hidden');
    $('#detail-drawer').classList.remove('hidden');
    $('#detail-drawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    $('#drawer-mask').classList.add('hidden');
    $('#detail-drawer').classList.add('hidden');
    $('#detail-drawer').setAttribute('aria-hidden', 'true');
  }

  // ============================================================
  // Create Dialog
  // ============================================================
  function openCreate() {
    $('#create-mask').classList.remove('hidden');
    $('#create-dialog').classList.remove('hidden');
    setTimeout(() => $('#create-name').focus(), 100);
  }

  function closeCreate() {
    $('#create-mask').classList.add('hidden');
    $('#create-dialog').classList.add('hidden');
  }

  function submitCreate(asDraft) {
    const name = $('#create-name').value.trim();
    if (!name) {
      toast('请填写计划名称', 'warning');
      $('#create-name').focus();
      return;
    }
    const channel = $('#create-channel').value;
    const type = $('#create-type').value;
    const budget = parseInt($('#create-budget').value) || 5000;
    const audienceMap = { new: '拉新用户', active: '活跃用户', sleep: '沉睡召回', vip: '高价值会员' };
    const audience = audienceMap[state.createAudience] || '拉新用户';
    const ch = CHANNELS[channel];

    const now = new Date();
    const dateStr = 'CP-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 9000) + 1000);

    const newPlan = {
      id: dateStr, name, channel, type,
      status: asDraft ? 'draft' : 'review',
      audience, exposure: 0, click: 0, conv: 0, cost: 0,
      budget, range: $('#create-range').value || '待定',
      updated: '刚刚',
      desc: $('#create-note').value.trim() || `面向${audience}的${type}投放计划，投放渠道为${ch.label}。`,
    };
    plans.unshift(newPlan);

    // reset form
    $('#create-name').value = '';
    $('#create-note').value = '';
    closeCreate();
    toast(asDraft ? '草稿已保存' : '已提交审核', 'success');

    // switch to content view and refresh
    if (!asDraft) {
      switchView('content');
      state.ftab = 'review';
      state.page = 1;
      $$('.ftab').forEach(b => b.classList.toggle('active', b.dataset.ftab === 'review'));
      renderContent();
    }
  }

  // ============================================================
  // Plan actions
  // ============================================================
  function updatePlanStatus(id, status, msg) {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    p.status = status;
    p.updated = '刚刚';
    renderContent();
    renderRecent();
    if (msg) toast(msg, 'success');
    closeDrawer();
  }

  // ============================================================
  // View switching
  // ============================================================
  function switchView(name) {
    state.view = name;
    $$('.td-view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
    $$('.menu-item').forEach(m => m.classList.toggle('active', m.dataset.nav === name));
  }

  // ============================================================
  // Event binding
  // ============================================================
  function bindEvents() {
    // Nav
    $$('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.nav);
        if (window.innerWidth <= 768) $('#sider').classList.remove('show');
      });
    });

    // Sider toggle
    $('#sider-toggle').addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        $('#sider').classList.toggle('show');
      } else {
        $('#sider').classList.toggle('collapsed');
      }
    });

    // Refresh
    $$('[data-action="refresh"]').forEach(btn => btn.addEventListener('click', () => {
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="animation:spin 1s linear infinite"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>刷新中';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = orig;
        renderKPI();
        renderRecent();
        toast('数据已刷新', 'success');
      }, 800);
    }));

    // Trend segment
    $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
      $$('.seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.trend = b.dataset.trend;
      renderTrend();
    }));

    // Filter tabs
    $$('.ftab').forEach(b => b.addEventListener('click', () => {
      $$('.ftab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.ftab = b.dataset.ftab;
      state.page = 1;
      state.selected.clear();
      renderContent();
    }));

    // Search (debounced)
    let searchTimer;
    $('#table-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        renderContent();
      }, 250);
    });

    $('#filter-channel').addEventListener('change', (e) => {
      state.channel = e.target.value;
      state.page = 1;
      renderContent();
    });

    $('#sort-by').addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderContent();
    });

    // Table: row checkbox
    $('#content-tbody').addEventListener('change', (e) => {
      if (e.target.classList.contains('row-check')) {
        const id = e.target.dataset.id;
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        updateBatchBar();
      }
    });

    // Select all
    $('#check-all').addEventListener('change', (e) => {
      const filtered = getFiltered();
      if (e.target.checked) filtered.forEach(p => state.selected.add(p.id));
      else filtered.forEach(p => state.selected.delete(p.id));
      renderContent();
    });

    // Row actions
    $('#content-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'view-detail') openDrawer(id);
      else if (action === 'row-more') {
        openDrawer(id);
      }
    });

    // Pagination
    $('#pager').addEventListener('click', (e) => {
      if (e.target.id === 'prev-page' && state.page > 1) state.page--;
      else if (e.target.id === 'next-page') state.page++;
      else if (e.target.dataset.page) state.page = parseInt(e.target.dataset.page);
      else return;
      renderContent();
    });

    // Batch actions
    $('[data-action="clear-selection"]').addEventListener('click', () => {
      state.selected.clear();
      renderContent();
    });
    $('[data-action="batch-pause"]').addEventListener('click', () => {
      let count = 0;
      state.selected.forEach(id => {
        const p = plans.find(x => x.id === id);
        if (p && p.status === 'running') { p.status = 'paused'; p.updated = '刚刚'; count++; }
      });
      state.selected.clear();
      renderContent();
      renderRecent();
      toast(`已暂停 ${count} 条投放计划`, count > 0 ? 'success' : 'warning');
    });
    $('[data-action="batch-end"]').addEventListener('click', () => {
      let count = 0;
      state.selected.forEach(id => {
        const p = plans.find(x => x.id === id);
        if (p && (p.status === 'running' || p.status === 'paused')) { p.status = 'ended'; p.updated = '刚刚'; count++; }
      });
      state.selected.clear();
      renderContent();
      renderRecent();
      toast(`已结束 ${count} 条投放计划`, count > 0 ? 'success' : 'warning');
    });

    // Export
    $('[data-action="export"]').addEventListener('click', () => {
      toast('正在导出投放数据，请稍候…', 'info');
      setTimeout(() => toast('导出完成，文件已下载', 'success'), 1200);
    });

    // Create dialog
    $$('[data-action="open-create"]').forEach(b => b.addEventListener('click', openCreate));
    $$('[data-action="close-create"]').forEach(b => b.addEventListener('click', closeCreate));
    $('#create-mask').addEventListener('click', closeCreate);
    $('[data-action="create-submit"]').addEventListener('click', () => submitCreate(false));
    $('[data-action="create-draft"]').addEventListener('click', () => submitCreate(true));

    // Audience chips
    $$('.chip[data-audience]').forEach(c => c.addEventListener('click', () => {
      $$('.chip[data-audience]').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.createAudience = c.dataset.audience;
    }));

    // Drawer
    $$('[data-action="close-drawer"]').forEach(b => b.addEventListener('click', closeDrawer));
    $('#drawer-mask').addEventListener('click', closeDrawer);

    // Drawer dynamic actions
    $('#drawer-footer').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      switch (action) {
        case 'drawer-end': updatePlanStatus(id, 'ended', '投放计划已结束'); break;
        case 'drawer-pause': updatePlanStatus(id, 'paused', '已暂停投放'); break;
        case 'drawer-resume': updatePlanStatus(id, 'running', '已恢复投放'); break;
        case 'drawer-edit': toast('编辑功能开发中', 'info'); break;
        case 'drawer-approve': updatePlanStatus(id, 'running', '审核已通过，开始投放'); break;
        case 'drawer-reject': updatePlanStatus(id, 'rejected', '已驳回该计划'); break;
        case 'drawer-duplicate': toast('已复制到新建草稿', 'success'); closeDrawer(); break;
      }
    });

    // Recent table row click -> detail
    $('#recent-tbody').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) openDrawer(tr.dataset.id);
    });

    // Global search
    $('#global-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        switchView('content');
        $('#table-search').value = e.target.value;
        state.search = e.target.value;
        state.page = 1;
        renderContent();
        toast(`搜索"${e.target.value}"`, 'info');
      }
    });

    // Escape to close overlays
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#create-dialog').classList.contains('hidden')) closeCreate();
        else if (!$('#detail-drawer').classList.contains('hidden')) closeDrawer();
      }
    });
  }

  // ---- Init ----
  function init() {
    renderKPI();
    renderTrend();
    renderPipeline();
    renderRecent();
    renderContent();
    bindEvents();
  }

  // spin keyframe
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
