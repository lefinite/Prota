/* =========================================================
   Readify Enterprise Console — Arco Design (React)
   使用 @arco-design/web-react 原生组件构建企业控制台。
   通过 CDN UMD 加载：window.arco, window.React, window.ReactDOM
   ========================================================= */

const {
  useState,
  useMemo,
  useEffect,
  useCallback
} = React;

// ---- Arco components (destructured from UMD global) ----
const {
  Layout,
  Menu,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Avatar,
  Space,
  Tabs,
  Modal,
  Drawer,
  Form,
  Tooltip,
  Message,
  Empty,
  Typography,
  Progress,
  Statistic,
  Breadcrumb,
  Grid,
  Badge,
  Card,
  Divider,
  Dropdown
} = arco;
// 子组件别名（UMD 顶层未直接导出，挂在父组件上）
const MenuItem = Menu.Item;
const Option = Select.Option;
const TabPane = Tabs.TabPane;
const {
  Row,
  Col
} = Grid;
const {
  Text,
  Title
} = Typography;

/* =========================================================
   Mock data
   ========================================================= */
const AVATAR_COLORS = ['#165dff', '#722ed1', '#f53f3f', '#ff7d00', '#00b42a', '#0fc6c2', '#3491fa', '#eb2f96', '#86909c', '#d91ad9', '#14c9c9', '#7bc616'];
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function colorFor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
const initialMembers = [{
  key: '1',
  name: '张明轩',
  email: 'mingxuan.z@readify.io',
  role: 'owner',
  status: 'active',
  lastActive: '刚刚',
  joined: '2024-03-12'
}, {
  key: '2',
  name: '李思琪',
  email: 'siqi.li@readify.io',
  role: 'admin',
  status: 'active',
  lastActive: '2 分钟前',
  joined: '2024-04-01'
}, {
  key: '3',
  name: '王浩然',
  email: 'haoran.w@readify.io',
  role: 'admin',
  status: 'active',
  lastActive: '15 分钟前',
  joined: '2024-04-18'
}, {
  key: '4',
  name: '陈雨桐',
  email: 'yutong.chen@readify.io',
  role: 'member',
  status: 'active',
  lastActive: '1 小时前',
  joined: '2024-05-02'
}, {
  key: '5',
  name: '刘子涵',
  email: 'zihan.liu@readify.io',
  role: 'member',
  status: 'pending',
  lastActive: '—',
  joined: '2024-08-08'
}, {
  key: '6',
  name: 'Sarah Chen',
  email: 'sarah.c@readify.io',
  role: 'member',
  status: 'active',
  lastActive: '3 小时前',
  joined: '2024-06-15'
}, {
  key: '7',
  name: '赵宇航',
  email: 'yuhang.zhao@readify.io',
  role: 'guest',
  status: 'active',
  lastActive: '昨天',
  joined: '2024-07-01'
}, {
  key: '8',
  name: '孙佳琪',
  email: 'jiaqi.sun@readify.io',
  role: 'member',
  status: 'disabled',
  lastActive: '—',
  joined: '2024-05-20'
}, {
  key: '9',
  name: '周梓萱',
  email: 'zixuan.zhou@readify.io',
  role: 'member',
  status: 'active',
  lastActive: '5 小时前',
  joined: '2024-06-28'
}, {
  key: '10',
  name: 'Marcus Lee',
  email: 'marcus.l@readify.io',
  role: 'guest',
  status: 'pending',
  lastActive: '—',
  joined: '2024-08-09'
}, {
  key: '11',
  name: '吴俊杰',
  email: 'junjie.w@readify.io',
  role: 'member',
  status: 'active',
  lastActive: '20 分钟前',
  joined: '2024-07-10'
}, {
  key: '12',
  name: '郑欣怡',
  email: 'xinyi.zheng@readify.io',
  role: 'member',
  status: 'active',
  lastActive: '2 天前',
  joined: '2024-07-22'
}];
const ROLE_LABEL = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  guest: '访客'
};
const ROLE_COLOR = {
  owner: 'gold',
  admin: 'purple',
  member: 'arcoblue',
  guest: 'gray'
};
const STATUS_META = {
  active: {
    label: '活跃',
    color: 'green'
  },
  pending: {
    label: '待激活',
    color: 'orange'
  },
  disabled: {
    label: '已停用',
    color: 'gray'
  }
};
const statSets = {
  '7d': [{
    label: '活跃成员',
    value: 847,
    delta: '+12.5%',
    up: true,
    icon: 'users'
  }, {
    label: '总任务数',
    value: 3294,
    delta: '+8.2%',
    up: true,
    icon: 'tasks'
  }, {
    label: '完成任务',
    value: 2481,
    delta: '+15.3%',
    up: true,
    icon: 'check'
  }, {
    label: '待处理审批',
    value: 23,
    delta: '-5.1%',
    up: false,
    icon: 'alert'
  }],
  '30d': [{
    label: '活跃成员',
    value: 1204,
    delta: '+18.7%',
    up: true,
    icon: 'users'
  }, {
    label: '总任务数',
    value: 12847,
    delta: '+24.1%',
    up: true,
    icon: 'tasks'
  }, {
    label: '完成任务',
    value: 9832,
    delta: '+19.6%',
    up: true,
    icon: 'check'
  }, {
    label: '待处理审批',
    value: 67,
    delta: '+3.2%',
    up: false,
    icon: 'alert'
  }],
  '90d': [{
    label: '活跃成员',
    value: 2109,
    delta: '+42.3%',
    up: true,
    icon: 'users'
  }, {
    label: '总任务数',
    value: 38492,
    delta: '+51.8%',
    up: true,
    icon: 'tasks'
  }, {
    label: '完成任务',
    value: 29104,
    delta: '+47.2%',
    up: true,
    icon: 'check'
  }, {
    label: '待处理审批',
    value: 158,
    delta: '+11.4%',
    up: false,
    icon: 'alert'
  }]
};
const chartData = [{
  d: '周一',
  au: 62,
  task: 38
}, {
  d: '周二',
  au: 78,
  task: 52
}, {
  d: '周三',
  au: 85,
  task: 61
}, {
  d: '周四',
  au: 71,
  task: 44
}, {
  d: '周五',
  au: 92,
  task: 73
}, {
  d: '周六',
  au: 45,
  task: 22
}, {
  d: '周日',
  au: 38,
  task: 18
}];
const ICON_PATHS = {
  users: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  tasks: 'M22 5.18L10.59 16.6l-4.24-4.24-1.41 1.41L10.59 19.41 23.41 6.59z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  alert: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  members: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  billing: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  security: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'
};
function Icon({
  name,
  style
}) {
  return React.createElement('svg', {
    viewBox: '0 0 24 24',
    style: Object.assign({
      width: 16,
      height: 16,
      fill: 'currentColor'
    }, style || {})
  }, React.createElement('path', {
    d: ICON_PATHS[name] || ''
  }));
}

/* =========================================================
   Sidebar
   ========================================================= */
function Sidebar({
  collapsed,
  open,
  onNavigate,
  current
}) {
  const items = [{
    key: 'overview',
    label: '概览',
    icon: 'members'
  }, {
    key: 'members',
    label: '成员管理',
    icon: 'users'
  }, {
    key: 'billing',
    label: '订阅与账单',
    icon: 'billing'
  }, {
    key: 'security',
    label: '安全与审计',
    icon: 'security'
  }, {
    key: 'settings',
    label: '系统设置',
    icon: 'settings'
  }];
  return /*#__PURE__*/React.createElement("aside", {
    className: 'sidebar' + (collapsed ? ' collapsed' : '') + (open ? ' open' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-mark"
  }, "R"), /*#__PURE__*/React.createElement("div", {
    className: "brand-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-name"
  }, "Readify"), /*#__PURE__*/React.createElement("div", {
    className: "brand-plan"
  }, "Enterprise \xB7 Starter"))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-nav"
  }, /*#__PURE__*/React.createElement(Menu, {
    selectedKeys: [current],
    onClickMenuItem: onNavigate,
    style: {
      borderRight: 'none'
    }
  }, items.map(it => /*#__PURE__*/React.createElement(MenuItem, {
    key: it.key
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: it.icon,
    style: {
      width: 16,
      height: 16
    }
  }), it.label))))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "upgrade-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "upgrade-title"
  }, "\u5347\u7EA7\u5230 Team"), /*#__PURE__*/React.createElement("div", {
    className: "upgrade-desc"
  }, "\u89E3\u9501 SSO\u3001\u5BA1\u8BA1\u65E5\u5FD7\u4E0E\u65E0\u9650\u5E2D\u4F4D\u3002"), /*#__PURE__*/React.createElement(Button, {
    type: "secondary",
    size: "mini",
    long: true,
    onClick: () => onNavigate('billing')
  }, "\u67E5\u770B\u65B9\u6848")), /*#__PURE__*/React.createElement("div", {
    className: "user-chip",
    onClick: () => Message.info('个人中心即将上线')
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 30,
    style: {
      backgroundColor: colorFor('Ping'),
      flexShrink: 0
    }
  }, "P"), /*#__PURE__*/React.createElement("div", {
    className: "user-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "user-name"
  }, "Ping Z."), /*#__PURE__*/React.createElement("div", {
    className: "user-role"
  }, "\u5DE5\u4F5C\u533A\u6240\u6709\u8005")))));
}

/* =========================================================
   StatCard
   ========================================================= */
function StatCard({
  data
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, data.label), /*#__PURE__*/React.createElement("div", {
    className: "stat-icon"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: data.icon
  }))), /*#__PURE__*/React.createElement(Statistic, {
    title: null,
    value: data.value,
    styleValue: {
      fontSize: 28,
      fontWeight: 700
    },
    groupSeparator: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'delta ' + (data.up ? 'up' : 'down')
  }, data.up ? '↑' : '↓', " ", data.delta), /*#__PURE__*/React.createElement("span", null, "\u5BF9\u6BD4\u4E0A\u4E00\u5468\u671F")));
}

/* =========================================================
   Usage Chart (custom SVG, Arco-colored)
   ========================================================= */
function UsageChart() {
  var W = 680,
    H = 220,
    padL = 32,
    padB = 28,
    padT = 12,
    padR = 12;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;
  var maxV = Math.max.apply(null, chartData.map(function (d) {
    return Math.max(d.au, d.task);
  }));
  var colW = plotW / chartData.length;
  var barW = colW * 0.28;
  var hoverState = useState(null);
  var hover = hoverState[0];
  var setHover = hoverState[1];
  var y = function (v) {
    return padT + plotH - v / maxV * plotH;
  };
  var gridY = [0, maxV * 0.5, maxV];
  var h = React.createElement;
  var gridLines = gridY.map(function (gv, i) {
    return h('g', {
      key: 'g' + i
    }, [h('line', {
      key: 'l',
      x1: padL,
      y1: y(gv),
      x2: W - padR,
      y2: y(gv),
      stroke: 'var(--color-neutral-2)',
      strokeWidth: 1
    }), h('text', {
      key: 't',
      x: padL - 8,
      y: y(gv) + 4,
      textAnchor: 'end',
      fontSize: 11,
      fill: 'var(--color-text-3)'
    }, Math.round(gv))]);
  });
  var bars = chartData.map(function (d, i) {
    var cx = padL + colW * i + colW / 2;
    var bx1 = cx - barW - 2;
    var bx2 = cx + 2;
    var bh1 = d.au / maxV * plotH;
    var bh2 = d.task / maxV * plotH;
    var isHover = hover === i;
    var children = [h('rect', {
      key: 'bg',
      x: padL + colW * i,
      y: padT,
      width: colW,
      height: plotH,
      fill: 'transparent'
    }), h('rect', {
      key: 'b1',
      x: bx1,
      y: padT + plotH - bh1,
      width: barW,
      height: bh1,
      rx: 3,
      fill: 'rgb(var(--primary-6))',
      opacity: isHover ? 1 : 0.9
    }), h('rect', {
      key: 'b2',
      x: bx2,
      y: padT + plotH - bh2,
      width: barW,
      height: bh2,
      rx: 3,
      fill: 'var(--color-neutral-4)',
      opacity: isHover ? 1 : 0.75
    }), h('text', {
      key: 'lbl',
      x: cx,
      y: H - 8,
      textAnchor: 'middle',
      fontSize: 12,
      fill: 'var(--color-text-2)'
    }, d.d)];
    if (isHover) {
      children.push(h('g', {
        key: 'tip'
      }, [h('rect', {
        key: 'tb',
        x: cx - 58,
        y: padT + 4,
        width: 116,
        height: 40,
        rx: 6,
        fill: 'rgba(0,0,0,.78)'
      }), h('text', {
        key: 'tt1',
        x: cx,
        y: padT + 20,
        textAnchor: 'middle',
        fontSize: 11,
        fill: '#fff'
      }, d.au + ' 活跃 · ' + d.task + ' 任务'), h('text', {
        key: 'tt2',
        x: cx,
        y: padT + 35,
        textAnchor: 'middle',
        fontSize: 11,
        fill: 'rgba(255,255,255,.7)'
      }, d.d)]));
    }
    return h('g', {
      key: 'bar' + i,
      onMouseEnter: function () {
        setHover(i);
      },
      onMouseLeave: function () {
        setHover(null);
      }
    }, children);
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "chart"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    preserveAspectRatio: "xMidYMid meet"
  }, gridLines, bars));
}

/* =========================================================
   Overview View
   ========================================================= */
function OverviewView({
  onNavigate
}) {
  const [range, setRange] = useState('7d');
  const stats = statSets[range];
  const activities = [{
    who: '李思琪',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, "\u674E\u601D\u742A"), " \u9080\u8BF7\u4E86 ", /*#__PURE__*/React.createElement("strong", null, "Marcus Lee"), " \u52A0\u5165\u5DE5\u4F5C\u533A"),
    time: '2 分钟前',
    color: '#165dff'
  }, {
    who: '王浩然',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, "\u738B\u6D69\u7136"), " \u53D1\u5E03\u4E86\u65B0\u6587\u6863\u300CQ3 \u4EA7\u54C1\u8DEF\u7EBF\u56FE\u300D"),
    time: '23 分钟前',
    color: '#00b42a'
  }, {
    who: '系统',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, "\u5B58\u50A8\u4F7F\u7528\u8FBE\u5230 ", /*#__PURE__*/React.createElement("strong", null, "48%"), "\uFF0C\u5EFA\u8BAE\u5173\u6CE8"),
    time: '1 小时前',
    color: '#ff7d00'
  }, {
    who: 'Sarah Chen',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Sarah Chen"), " \u66F4\u65B0\u4E86\u6210\u5458\u6743\u9650"),
    time: '3 小时前',
    color: '#722ed1'
  }, {
    who: '陈雨桐',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, "\u9648\u96E8\u6850"), " \u5B8C\u6210\u4E86\u4EFB\u52A1\u300C\u6570\u636E\u5BFC\u51FA\u5BA1\u6838\u300D"),
    time: '5 小时前',
    color: '#86909c'
  }, {
    who: '刘子涵',
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, "\u5218\u5B50\u6DB5"), " \u7684\u9080\u8BF7\u5F85\u6FC0\u6D3B"),
    time: '昨天',
    color: '#3491fa'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "page-title"
  }, "\u6982\u89C8"), /*#__PURE__*/React.createElement("p", {
    className: "page-sub"
  }, "\u6B22\u8FCE\u56DE\u6765\uFF0C\u8FD9\u662F\u4F60\u7684\u5DE5\u4F5C\u533A\u4ECA\u65E5\u5065\u5EB7\u5EA6\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "page-head-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "download"
    }),
    onClick: () => Message.success('报告已开始生成，完成后将通过邮件发送')
  }, "\u5BFC\u51FA\u62A5\u544A"), /*#__PURE__*/React.createElement(Button, {
    type: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus"
    }),
    onClick: () => onNavigate('members')
  }, "\u9080\u8BF7\u6210\u5458"))), /*#__PURE__*/React.createElement(Tabs, {
    activeTab: range,
    onChange: setRange,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(TabPane, {
    key: "7d",
    title: "\u8FD1 7 \u5929"
  }), /*#__PURE__*/React.createElement(TabPane, {
    key: "30d",
    title: "\u8FD1 30 \u5929"
  }), /*#__PURE__*/React.createElement(TabPane, {
    key: "90d",
    title: "\u8FD1 90 \u5929"
  })), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid"
  }, stats.map(s => /*#__PURE__*/React.createElement(StatCard, {
    key: s.label,
    data: s
  }))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, "\u6D3B\u8DC3\u4F7F\u7528\u8D8B\u52BF"), /*#__PURE__*/React.createElement("p", {
    className: "panel-sub"
  }, "\u6BCF\u65E5\u6D3B\u8DC3\u6210\u5458\uFF08DAU\uFF09\u4E0E\u65B0\u5EFA\u4EFB\u52A1\u6570")), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("i", {
    className: "dot dot-primary"
  }), "\u65E5\u6D3B\u6210\u5458"), /*#__PURE__*/React.createElement("span", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("i", {
    className: "dot dot-muted"
  }), "\u65B0\u5EFA\u4EFB\u52A1"))), /*#__PURE__*/React.createElement(UsageChart, null)), /*#__PURE__*/React.createElement("div", {
    className: "two-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, "\u6700\u8FD1\u6D3B\u52A8"), /*#__PURE__*/React.createElement(Button, {
    type: "text",
    size: "small",
    onClick: () => Message.info('活动日志视图即将上线')
  }, "\u67E5\u770B\u5168\u90E8")), /*#__PURE__*/React.createElement("div", null, activities.map((a, i) => /*#__PURE__*/React.createElement("div", {
    className: "activity-item",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "activity-dot",
    style: {
      backgroundColor: a.color + '1a',
      color: a.color
    }
  }, initials(a.who)), /*#__PURE__*/React.createElement("div", {
    className: "activity-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "activity-text"
  }, a.text), /*#__PURE__*/React.createElement("div", {
    className: "activity-time"
  }, a.time)))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, "\u5F53\u524D\u8BA2\u9605")), /*#__PURE__*/React.createElement("div", {
    className: "plan-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "plan-top"
  }, /*#__PURE__*/React.createElement(Tag, {
    color: "arcoblue",
    bordered: true
  }, "Starter"), /*#__PURE__*/React.createElement("span", {
    className: "plan-price"
  }, "\xA5299", /*#__PURE__*/React.createElement("small", null, "/\u6708"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "usage-row"
  }, /*#__PURE__*/React.createElement("span", null, "\u5E2D\u4F4D\u4F7F\u7528"), /*#__PURE__*/React.createElement(Text, {
    type: "secondary"
  }, "12 / 20")), /*#__PURE__*/React.createElement(Progress, {
    percent: 60,
    color: "rgb(var(--primary-6))"
  }), /*#__PURE__*/React.createElement("div", {
    className: "usage-row",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u5B58\u50A8\u7A7A\u95F4"), /*#__PURE__*/React.createElement(Text, {
    type: "secondary"
  }, "48.2 / 100 GB")), /*#__PURE__*/React.createElement(Progress, {
    percent: 48
  }), /*#__PURE__*/React.createElement("div", {
    className: "usage-row",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "API \u8C03\u7528"), /*#__PURE__*/React.createElement(Text, {
    type: "secondary"
  }, "12.4K / 50K")), /*#__PURE__*/React.createElement(Progress, {
    percent: 25
  })), /*#__PURE__*/React.createElement(Button, {
    long: true,
    type: "outline",
    onClick: () => onNavigate('billing')
  }, "\u7BA1\u7406\u8BA2\u9605")))));
}

/* =========================================================
   Members View (Arco Table)
   ========================================================= */
function MembersView({
  members,
  setMembers
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [drawerMember, setDrawerMember] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form] = Form.useForm();
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (q && m.name.toLowerCase().indexOf(q) < 0 && m.email.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }, [members, search, statusFilter, roleFilter]);
  const updateRole = (key, role) => {
    setMembers(prev => prev.map(m => m.key === key ? {
      ...m,
      role
    } : m));
    const m = members.find(x => x.key === key);
    Message.success(`${m.name} 的角色已更新为「${ROLE_LABEL[role]}」`);
  };
  const toggleStatus = key => {
    setMembers(prev => prev.map(m => {
      if (m.key !== key) return m;
      const next = m.status === 'active' ? 'disabled' : 'active';
      if (next === 'disabled') Message.error(`${m.name} 已停用`);else Message.success(`${m.name} 已重新激活`);
      return {
        ...m,
        status: next,
        lastActive: next === 'active' ? '刚刚' : m.lastActive
      };
    }));
    setDrawerMember(null);
  };
  const bulkDisable = () => {
    let count = 0;
    setMembers(prev => prev.map(m => {
      if (selectedKeys.indexOf(m.key) >= 0 && m.status === 'active') {
        count++;
        return {
          ...m,
          status: 'disabled'
        };
      }
      return m;
    }));
    setSelectedKeys([]);
    if (count > 0) Message.error(`已停用 ${count} 名成员`);
  };
  const sendInvite = values => {
    const email = values.email.trim();
    const name = email.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    setMembers(prev => [{
      key: String(Date.now()),
      name,
      email,
      role: values.role || 'member',
      status: 'pending',
      lastActive: '—',
      joined: new Date().toISOString().slice(0, 10)
    }, ...prev]);
    form.resetFields();
    setInviteOpen(false);
    Message.success(`邀请已发送至 ${email}`);
  };
  const columns = [{
    title: '成员',
    dataIndex: 'name',
    width: 240,
    render: (_, record) => /*#__PURE__*/React.createElement(Space, null, /*#__PURE__*/React.createElement(Avatar, {
      size: 30,
      style: {
        backgroundColor: colorFor(record.name)
      }
    }, initials(record.name)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 500
      }
    }, record.name), /*#__PURE__*/React.createElement(Text, {
      type: "secondary",
      style: {
        fontSize: 12
      }
    }, record.email)))
  }, {
    title: '角色',
    dataIndex: 'role',
    width: 130,
    render: (role, record) => /*#__PURE__*/React.createElement(Select, {
      value: role,
      size: "small",
      style: {
        width: 100
      },
      disabled: record.role === 'owner',
      onChange: v => updateRole(record.key, v)
    }, Object.keys(ROLE_LABEL).map(r => /*#__PURE__*/React.createElement(Option, {
      key: r,
      value: r
    }, ROLE_LABEL[r])))
  }, {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: s => /*#__PURE__*/React.createElement(Tag, {
      color: STATUS_META[s].color
    }, STATUS_META[s].label)
  }, {
    title: '最后活跃',
    dataIndex: 'lastActive',
    width: 120,
    render: t => /*#__PURE__*/React.createElement(Text, {
      type: "secondary"
    }, t)
  }, {
    title: '加入时间',
    dataIndex: 'joined',
    width: 120,
    render: t => /*#__PURE__*/React.createElement(Text, {
      type: "secondary"
    }, t)
  }, {
    title: '',
    key: 'op',
    width: 60,
    render: (_, record) => /*#__PURE__*/React.createElement(Button, {
      type: "text",
      size: "small",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "settings"
      }),
      onClick: () => setDrawerMember(record)
    })
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "page-title"
  }, "\u6210\u5458\u7BA1\u7406"), /*#__PURE__*/React.createElement("p", {
    className: "page-sub"
  }, "\u7BA1\u7406\u5DE5\u4F5C\u533A\u6210\u5458\u3001\u89D2\u8272\u4E0E\u8BBF\u95EE\u6743\u9650\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "page-head-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    disabled: selectedKeys.length === 0,
    onClick: bulkDisable
  }, "\u505C\u7528"), /*#__PURE__*/React.createElement(Button, {
    type: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus"
    }),
    onClick: () => setInviteOpen(true)
  }, "\u9080\u8BF7\u6210\u5458"))), /*#__PURE__*/React.createElement("div", {
    className: "toolbar"
  }, /*#__PURE__*/React.createElement(Input.Search, {
    placeholder: "\u6309\u59D3\u540D\u6216\u90AE\u7BB1\u641C\u7D22\u2026",
    style: {
      width: 280
    },
    value: search,
    onChange: v => setSearch(v),
    allowClear: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "toolbar-right"
  }, /*#__PURE__*/React.createElement(Select, {
    value: statusFilter,
    onChange: setStatusFilter,
    style: {
      width: 130
    }
  }, /*#__PURE__*/React.createElement(Option, {
    value: "all"
  }, "\u5168\u90E8\u72B6\u6001"), /*#__PURE__*/React.createElement(Option, {
    value: "active"
  }, "\u6D3B\u8DC3"), /*#__PURE__*/React.createElement(Option, {
    value: "pending"
  }, "\u5F85\u6FC0\u6D3B"), /*#__PURE__*/React.createElement(Option, {
    value: "disabled"
  }, "\u5DF2\u505C\u7528")), /*#__PURE__*/React.createElement(Select, {
    value: roleFilter,
    onChange: setRoleFilter,
    style: {
      width: 130
    }
  }, /*#__PURE__*/React.createElement(Option, {
    value: "all"
  }, "\u5168\u90E8\u89D2\u8272"), /*#__PURE__*/React.createElement(Option, {
    value: "owner"
  }, "\u6240\u6709\u8005"), /*#__PURE__*/React.createElement(Option, {
    value: "admin"
  }, "\u7BA1\u7406\u5458"), /*#__PURE__*/React.createElement(Option, {
    value: "member"
  }, "\u6210\u5458"), /*#__PURE__*/React.createElement(Option, {
    value: "guest"
  }, "\u8BBF\u5BA2")))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Table, {
    columns: columns,
    data: filtered,
    rowSelection: {
      selectedRowKeys: selectedKeys,
      onChange: setSelectedKeys,
      getCheckboxProps: r => ({
        disabled: r.role === 'owner'
      })
    },
    pagination: {
      pageSize: 10,
      showTotal: t => `共 ${t} 名成员`,
      size: 'mini'
    },
    noDataElement: /*#__PURE__*/React.createElement(Empty, {
      description: "\u6CA1\u6709\u5339\u914D\u7684\u6210\u5458"
    }),
    scroll: {
      x: 800
    }
  })), /*#__PURE__*/React.createElement(Modal, {
    title: "\u9080\u8BF7\u65B0\u6210\u5458",
    visible: inviteOpen,
    onCancel: () => setInviteOpen(false),
    onOk: () => form.submit(),
    okText: "\u53D1\u9001\u9080\u8BF7",
    cancelText: "\u53D6\u6D88",
    unmountOnExit: true
  }, /*#__PURE__*/React.createElement(Form, {
    form: form,
    layout: "vertical",
    onSubmit: sendInvite,
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Form.Item, {
    label: "\u90AE\u7BB1\u5730\u5740",
    field: "email",
    rules: [{
      required: true,
      message: '请填写邮箱地址'
    }]
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "name@company.com"
  })), /*#__PURE__*/React.createElement(Form.Item, {
    label: "\u89D2\u8272",
    field: "role",
    initialValue: "member"
  }, /*#__PURE__*/React.createElement(Select, null, /*#__PURE__*/React.createElement(Option, {
    value: "member"
  }, "\u6210\u5458 \u2014 \u53EF\u67E5\u770B\u548C\u7F16\u8F91\u5185\u5BB9"), /*#__PURE__*/React.createElement(Option, {
    value: "admin"
  }, "\u7BA1\u7406\u5458 \u2014 \u53EF\u7BA1\u7406\u6210\u5458\u548C\u8BBE\u7F6E"), /*#__PURE__*/React.createElement(Option, {
    value: "guest"
  }, "\u8BBF\u5BA2 \u2014 \u53EA\u8BFB\u8BBF\u95EE"))), /*#__PURE__*/React.createElement(Form.Item, {
    label: "\u9644\u8A00\uFF08\u53EF\u9009\uFF09",
    field: "message"
  }, /*#__PURE__*/React.createElement(Input.TextArea, {
    placeholder: "\u6B22\u8FCE\u52A0\u5165\u6211\u4EEC\u7684\u5DE5\u4F5C\u533A\u2026"
  })))), /*#__PURE__*/React.createElement(Drawer, {
    title: "\u6210\u5458\u8BE6\u60C5",
    visible: !!drawerMember,
    onCancel: () => setDrawerMember(null),
    footer: drawerMember && /*#__PURE__*/React.createElement(Button, {
      long: true,
      type: drawerMember.status === 'active' ? 'outline' : 'primary',
      status: drawerMember.status === 'active' ? 'danger' : undefined,
      onClick: () => toggleStatus(drawerMember.key)
    }, drawerMember.status === 'active' ? '停用账号' : '重新激活'),
    width: 380
  }, drawerMember && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 48,
    style: {
      backgroundColor: colorFor(drawerMember.name)
    }
  }, initials(drawerMember.name)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600
    }
  }, drawerMember.name), /*#__PURE__*/React.createElement(Text, {
    type: "secondary",
    style: {
      fontSize: 13
    }
  }, drawerMember.email))), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Title, {
    heading: 6
  }, "\u8D26\u6237"), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u72B6\u6001",
    v: /*#__PURE__*/React.createElement(Tag, {
      color: STATUS_META[drawerMember.status].color
    }, STATUS_META[drawerMember.status].label)
  }), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u89D2\u8272",
    v: ROLE_LABEL[drawerMember.role]
  }), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u52A0\u5165\u65F6\u95F4",
    v: drawerMember.joined
  }), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u6700\u540E\u6D3B\u8DC3",
    v: drawerMember.lastActive
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Title, {
    heading: 6
  }, "\u6743\u9650"), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u5185\u5BB9\u8BBF\u95EE",
    v: drawerMember.role === 'guest' ? '只读' : '可编辑'
  }), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u6210\u5458\u7BA1\u7406",
    v: drawerMember.role === 'owner' || drawerMember.role === 'admin' ? '是' : '否'
  }), /*#__PURE__*/React.createElement(KvRow, {
    k: "\u8D26\u5355\u8BBF\u95EE",
    v: drawerMember.role === 'owner' ? '是' : '否'
  }))));
}
function KvRow({
  k,
  v
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement(Text, {
    type: "secondary"
  }, k), /*#__PURE__*/React.createElement("span", null, v));
}

/* =========================================================
   Placeholder views
   ========================================================= */
function PlaceholderView({
  title,
  desc,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    style: {
      width: 56,
      height: 56
    }
  }), /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("p", null, desc));
}

/* =========================================================
   App root
   ========================================================= */
function App() {
  const [view, setView] = useState('overview');
  const [members, setMembers] = useState(initialMembers);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const handleNavigate = key => {
    setView(key);
    setSidebarOpen(false);
  };
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const el = document.getElementById('global-search');
        if (el) el.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement(Sidebar, {
    collapsed: collapsed,
    open: sidebarOpen,
    onNavigate: handleNavigate,
    current: view
  }), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar-left"
  }, /*#__PURE__*/React.createElement(Button, {
    type: "text",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "menu"
    }),
    onClick: () => {
      setCollapsed(!collapsed);
      setSidebarOpen(!sidebarOpen);
    }
  }), /*#__PURE__*/React.createElement(Breadcrumb, {
    style: {
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb.Item, null, "\u5DE5\u4F5C\u533A"), /*#__PURE__*/React.createElement(Breadcrumb.Item, null, {
    overview: '企业控制台',
    members: '成员管理',
    billing: '订阅与账单',
    security: '安全与审计',
    settings: '系统设置'
  }[view]))), /*#__PURE__*/React.createElement("div", {
    className: "topbar-right"
  }, /*#__PURE__*/React.createElement(Input.Search, {
    id: "global-search",
    placeholder: "\u641C\u7D22\u6210\u5458\u3001\u8BBE\u7F6E\u3001\u6587\u6863\u2026",
    style: {
      width: 260
    },
    value: search,
    onChange: v => setSearch(v)
  }), /*#__PURE__*/React.createElement(Badge, {
    dot: true
  }, /*#__PURE__*/React.createElement(Button, {
    type: "text",
    shape: "circle",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "bell"
    }),
    onClick: () => Message.info('暂无新通知')
  })))), /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, view === 'overview' && /*#__PURE__*/React.createElement(OverviewView, {
    onNavigate: handleNavigate
  }), view === 'members' && /*#__PURE__*/React.createElement(MembersView, {
    members: members,
    setMembers: setMembers
  }), view === 'billing' && /*#__PURE__*/React.createElement(PlaceholderView, {
    title: "\u8BA2\u9605\u4E0E\u8D26\u5355",
    desc: "\u53D1\u7968\u3001\u652F\u4ED8\u65B9\u5F0F\u4E0E\u5957\u9910\u5347\u7EA7\u5C06\u5728\u8BE5\u89C6\u56FE\u5C55\u793A\u3002",
    icon: "billing"
  }), view === 'security' && /*#__PURE__*/React.createElement(PlaceholderView, {
    title: "\u5B89\u5168\u4E0E\u5BA1\u8BA1",
    desc: "SSO \u914D\u7F6E\u3001\u4F1A\u8BDD\u7BA1\u7406\u4E0E\u5BA1\u8BA1\u65E5\u5FD7\u5C06\u5728\u6B64\u5C55\u793A\u3002",
    icon: "security"
  }), view === 'settings' && /*#__PURE__*/React.createElement(PlaceholderView, {
    title: "\u7CFB\u7EDF\u8BBE\u7F6E",
    desc: "\u5DE5\u4F5C\u533A\u540D\u79F0\u3001\u9ED8\u8BA4\u8BED\u8A00\u4E0E\u65F6\u533A\u8BBE\u7F6E\u5C06\u5728\u6B64\u5C55\u793A\u3002",
    icon: "settings"
  }))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));