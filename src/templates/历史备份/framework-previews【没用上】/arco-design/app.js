const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let workflows = [
  { id: 1, name: '客户线索自动分配', status: '运行中', trigger: '新增线索时', today: '328', rate: '99.1%', last: '2 分钟前', owner: '林知夏' },
  { id: 2, name: '售后工单智能分类', status: '运行中', trigger: '每 5 分钟', today: '216', rate: '97.6%', last: '5 分钟前', owner: '周景明' },
  { id: 3, name: '每日销售简报', status: '运行中', trigger: '每天 09:00', today: '1', rate: '100%', last: '今天 09:00', owner: '陈雨桐' },
  { id: 4, name: '高风险订单预警', status: '异常', trigger: '订单创建时', today: '89', rate: '83.2%', last: '8 分钟前', owner: '林知夏' },
  { id: 5, name: '内容素材归档', status: '草稿', trigger: '手动触发', today: '0', rate: '--', last: '尚未运行', owner: '赵一澄' },
  { id: 6, name: '离职账号权限回收', status: '已停用', trigger: '成员离职时', today: '0', rate: '100%', last: '7 天前', owner: '周景明' }
];

let activeTab = '全部';
let selected = new Set();
let activePage = 1;
let actionTarget = null;

const statusClass = status => ({ '运行中': 'running-tag', '异常': 'danger-tag', '草稿': 'draft-tag', '已停用': 'disabled-tag' }[status]);
const ownerInitial = name => name.slice(-1);

function filteredRows() {
  const q = $('#tableSearch').value.trim().toLowerCase();
  const topQ = $('#globalSearch').value.trim().toLowerCase();
  const status = $('#statusFilter').value;
  const owner = $('#ownerFilter').value;
  return workflows.filter(row => {
    const tabPass = activeTab === '全部' || row.status === activeTab;
    const haystack = `${row.name} ${row.owner}`.toLowerCase();
    return tabPass && (!status || row.status === status) && (!owner || row.owner === owner) && (!q || haystack.includes(q)) && (!topQ || row.name.toLowerCase().includes(topQ));
  });
}

function renderRows() {
  const rows = filteredRows();
  $('#workflowRows').innerHTML = rows.map(row => `
    <tr data-id="${row.id}">
      <td><input class="row-check" type="checkbox" data-id="${row.id}" aria-label="选择${row.name}" ${selected.has(row.id) ? 'checked' : ''}></td>
      <td><button class="workflow-name ${row.status === '异常' ? 'alert-name' : ''}" data-detail="${row.id}">${row.name}</button></td>
      <td><span class="tag ${statusClass(row.status)}"><i></i>${row.status}</span></td>
      <td>${row.trigger}</td><td>${row.today}</td>
      <td class="${row.status === '异常' ? 'rate-danger' : row.rate !== '--' ? 'rate-success' : ''}">${row.rate}</td>
      <td>${row.last}</td>
      <td><span class="owner-cell"><i class="mini-avatar">${ownerInitial(row.owner)}</i>${row.owner}</span></td>
      <td><span class="row-action"><button class="btn text" data-detail="${row.id}">详情</button><button class="row-more" data-actions="${row.id}" aria-label="更多操作"><svg><use href="#i-more"/></svg></button></span></td>
    </tr>`).join('');
  const empty = rows.length === 0;
  $('#emptyState').hidden = !empty;
  $('table').hidden = empty;
  $('#filterFeedback').textContent = empty ? '无匹配结果' : `当前显示 ${rows.length} 条`;
  $('#selectAll').checked = rows.length > 0 && rows.every(row => selected.has(row.id));
  bindRowEvents();
  updateSelection();
}

function bindRowEvents() {
  $$('.row-check').forEach(box => box.addEventListener('change', () => {
    const id = Number(box.dataset.id);
    box.checked ? selected.add(id) : selected.delete(id);
    updateSelection();
  }));
  $$('[data-detail]').forEach(btn => btn.addEventListener('click', () => openDetail(Number(btn.dataset.detail))));
  $$('[data-actions]').forEach(btn => btn.addEventListener('click', event => openActionMenu(event, Number(btn.dataset.actions))));
}

function updateSelection() {
  const count = selected.size;
  $('#selectionBar').hidden = count === 0;
  $('#selectedCount').textContent = count;
  $('#batchEntry').disabled = count === 0;
  const visible = filteredRows();
  $('#selectAll').checked = visible.length > 0 && visible.every(row => selected.has(row.id));
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<svg><use href="#${type === 'success' ? 'i-check' : 'i-warning'}"/></svg><span>${message}</span>`;
  $('#toastStack').appendChild(item);
  setTimeout(() => item.remove(), 2600);
}

function openActionMenu(event, id) {
  event.stopPropagation();
  actionTarget = workflows.find(row => row.id === id);
  const menu = $('#actionMenu');
  const actionText = actionTarget.status === '已停用' ? '启用' : '停用';
  menu.innerHTML = `<button data-menu="view">查看详情</button><button data-menu="edit">编辑</button><button data-menu="copy">复制</button><button data-menu="toggle">${actionText}</button><hr><button class="danger-text" data-menu="delete">删除</button>`;
  const rect = event.currentTarget.getBoundingClientRect();
  menu.style.left = `${Math.min(rect.right - 142, innerWidth - 150)}px`;
  menu.style.top = `${rect.bottom + 3}px`;
  menu.hidden = false;
  $$('[data-menu]', menu).forEach(btn => btn.addEventListener('click', () => handleMenu(btn.dataset.menu)));
}

function handleMenu(action) {
  $('#actionMenu').hidden = true;
  if (!actionTarget) return;
  if (action === 'view') openDetail(actionTarget.id);
  if (action === 'edit') toast(`已打开「${actionTarget.name}」编辑配置`);
  if (action === 'copy') toast(`已复制「${actionTarget.name}」`);
  if (action === 'toggle') {
    const enabled = actionTarget.status === '已停用';
    actionTarget.status = enabled ? '运行中' : '已停用';
    toast(`工作流已${enabled ? '启用' : '停用'}`);
    renderRows();
  }
  if (action === 'delete') {
    $('#deleteName').textContent = actionTarget.name;
    $('#confirmMask').hidden = false;
  }
}

function openDetail(id) {
  if (id !== 4) {
    const row = workflows.find(item => item.id === id);
    toast(`已载入「${row.name}」详情`);
    return;
  }
  $('#drawerMask').hidden = false;
  $('#detailDrawer').classList.add('open');
  $('#detailDrawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  $('#detailDrawer').classList.remove('open');
  $('#detailDrawer').setAttribute('aria-hidden', 'true');
  setTimeout(() => $('#drawerMask').hidden = true, 220);
}

function resetFilters() {
  $('#tableSearch').value = '';
  $('#globalSearch').value = '';
  $('#statusFilter').value = '';
  $('#ownerFilter').value = '';
  $('#dateFilter').value = '';
  activeTab = '全部';
  $$('#statusTabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === '全部'));
  renderRows();
}

$('#createBtn').addEventListener('click', () => {
  $('#modalMask').hidden = false;
  setTimeout(() => $('[name=name]').focus(), 0);
});
$$('.close-overlay').forEach(btn => btn.addEventListener('click', () => $('#modalMask').hidden = true));
$('#modalMask').addEventListener('click', e => { if (e.target === e.currentTarget) $('#modalMask').hidden = true; });
$('[name=description]').addEventListener('input', e => e.currentTarget.nextElementSibling.textContent = `${e.currentTarget.value.length} / 200`);
$('#createForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget;
  let valid = true;
  ['name', 'trigger', 'owner'].forEach(name => {
    const input = form.elements[name];
    input.closest('.form-item').classList.toggle('invalid', !input.value.trim());
    if (!input.value.trim()) valid = false;
  });
  if (!valid) { toast('请完善必填信息', 'error'); return; }
  $('#modalMask').hidden = true;
  form.reset();
  $$('.form-item.invalid').forEach(item => item.classList.remove('invalid'));
  toast('工作流已创建并保存为草稿');
});
$$('#createForm input, #createForm select').forEach(input => input.addEventListener('input', () => input.closest('.form-item').classList.remove('invalid')));

$('#closeDrawer').addEventListener('click', closeDrawer);
$('#drawerMask').addEventListener('click', closeDrawer);
$('#rerunBtn').addEventListener('click', e => {
  e.currentTarget.innerHTML = '<span class="spinner"></span>正在运行';
  e.currentTarget.disabled = true;
  setTimeout(() => { e.currentTarget.innerHTML = '<svg><use href="#i-refresh"/></svg>重新运行'; e.currentTarget.disabled = false; toast('已重新发起运行，请稍后查看结果'); }, 900);
});
$('#editWorkflow').addEventListener('click', () => toast('已进入工作流编辑模式'));
$('.copy-id').addEventListener('click', () => toast('工作流 ID 已复制'));

$('#statusTabs').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  $$('#statusTabs button').forEach(item => item.classList.toggle('active', item === btn));
  activePage = 1;
  renderRows();
});
['tableSearch', 'globalSearch'].forEach(id => $(`#${id}`).addEventListener('input', renderRows));
['statusFilter', 'ownerFilter'].forEach(id => $(`#${id}`).addEventListener('change', () => { renderRows(); toast('筛选条件已更新'); }));
$('#dateFilter').addEventListener('change', () => { renderRows(); toast('已按更新时间筛选'); });
$('#resetFilters').addEventListener('click', resetFilters);
$('#selectAll').addEventListener('change', e => {
  filteredRows().forEach(row => e.target.checked ? selected.add(row.id) : selected.delete(row.id));
  renderRows();
});
$('#clearSelection').addEventListener('click', () => { selected.clear(); renderRows(); });
$('#refreshBtn').addEventListener('click', e => {
  const button = e.currentTarget;
  $('#loadingOverlay').hidden = false;
  button.querySelector('svg').style.animation = 'spin .7s linear infinite';
  setTimeout(() => {
    $('#loadingOverlay').hidden = true;
    button.querySelector('svg').style.animation = '';
    $('#syncTime').textContent = '刚刚';
    toast('数据已刷新');
  }, 700);
});

$('#noticeBtn').addEventListener('click', e => { e.stopPropagation(); $('#noticePopover').hidden = !$('#noticePopover').hidden; });
document.addEventListener('click', e => {
  if (!e.target.closest('#noticePopover') && !e.target.closest('#noticeBtn')) $('#noticePopover').hidden = true;
  if (!e.target.closest('#actionMenu') && !e.target.closest('[data-actions]')) $('#actionMenu').hidden = true;
});

$$('.pager [data-page]').forEach(btn => btn.addEventListener('click', () => {
  activePage = Number(btn.dataset.page);
  $$('.pager [data-page]').forEach(item => item.classList.toggle('active', Number(item.dataset.page) === activePage));
  const start = (activePage - 1) * 6 + 1;
  $('#rangeText').textContent = `第 ${start}–${start + 5} 条，共 24 条`;
  toast(`已切换至第 ${activePage} 页`);
}));
$('#pageSize').addEventListener('change', e => { const size = Number(e.target.value.match(/\d+/)[0]); $('#rangeText').textContent = `第 1–${Math.min(size, 24)} 条，共 24 条`; toast(`每页显示 ${size} 条`); });

const chartData = {
  7: { labels: ['8月6日','8月7日','8月8日','8月9日','8月10日','8月11日','8月12日'], success: [726,875,811,1002,946,1138,1057], fail:[31,46,37,61,49,67,55] },
  30: { labels: ['7月14日','7月19日','7月24日','7月29日','8月3日','8月8日','8月12日'], success: [690,804,768,924,881,1009,1057], fail:[42,38,51,45,63,58,55] },
  90: { labels: ['5月','5月下旬','6月','6月下旬','7月','7月下旬','8月'], success: [528,612,706,755,826,940,1057], fail:[66,59,62,48,52,61,55] }
};

function renderChart(range) {
  const data = chartData[range];
  const toY = value => 96 - (value / 1200) * 88;
  const points = data.success.map((v, i) => `${i * 160},${toY(v).toFixed(1)}`).join(' ');
  const failPoints = data.fail.map((v, i) => `${i * 160},${(90 - v / 7).toFixed(1)}`).join(' ');
  $('#successLine').setAttribute('points', points);
  $('#failLine').setAttribute('points', failPoints);
  $('#areaPath').setAttribute('d', `M${points.replaceAll(' ', ' L')} L960 96 L0 96Z`);
  $('#chartLabels').innerHTML = data.labels.map(label => `<span>${label}</span>`).join('');
  $('#chartPoints').innerHTML = data.success.map((v, i) => `<circle class="point" data-index="${i}" cx="${i*160}" cy="${toY(v).toFixed(1)}" r="3.5" fill="#fff" stroke="#165DFF"/>`).join('');
  $$('.point').forEach(point => {
    point.addEventListener('mouseenter', e => {
      const i = Number(e.target.dataset.index);
      const tip = $('#chartTooltip');
      tip.innerHTML = `<strong>${data.labels[i]}</strong><br>成功运行：${data.success[i]}<br>失败运行：${data.fail[i]}`;
      tip.style.left = `${35 + (i / 6) * ($('#chartWrap').clientWidth - 35)}px`;
      tip.style.top = `${Number(e.target.getAttribute('cy')) + 4}px`;
      tip.hidden = false;
    });
    point.addEventListener('mouseleave', () => $('#chartTooltip').hidden = true);
  });
}

$('#rangeSelector').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $$('#rangeSelector button').forEach(item => item.classList.toggle('active', item === btn));
  renderChart(Number(btn.dataset.range));
  toast(`趋势范围已切换为 ${btn.textContent}`);
});

$$('.close-confirm').forEach(btn => btn.addEventListener('click', () => $('#confirmMask').hidden = true));
$('#confirmDelete').addEventListener('click', () => {
  workflows = workflows.filter(row => row.id !== actionTarget.id);
  selected.delete(actionTarget.id);
  $('#confirmMask').hidden = true;
  renderRows();
  toast('工作流已删除');
});
$('#confirmMask').addEventListener('click', e => { if (e.target === e.currentTarget) $('#confirmMask').hidden = true; });

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#globalSearch').focus(); }
  if (e.key === 'Escape') { $('#modalMask').hidden = true; $('#confirmMask').hidden = true; closeDrawer(); }
});

renderRows();
renderChart(7);
