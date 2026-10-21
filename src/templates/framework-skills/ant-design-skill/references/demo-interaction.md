# Demo Interaction Rules

## 1. 目标

原型交互只为演示产品逻辑，不模拟完整后端。

## 2. 优先实现的交互

1. 主操作：新建、开始、提交、导出、生成
2. 对象操作：查看、编辑、启停、审批
3. 页面切换：页面跳转、Tab、Segmented、状态分类
4. 搜索 / 筛选
5. Drawer / Modal
6. AI / 任务运行状态

## 3. 本地状态即可

推荐：

```tsx
const [open, setOpen] = useState(false);
const [selected, setSelected] = useState<string[]>([]);
const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
```

## 4. 模拟异步

```tsx
setStatus('running');
setTimeout(() => {
  setStatus('done');
  message.success('分析完成');
}, 1200);
```

允许这样做。原型无需真实任务系统。

## 5. Drawer / Modal

操作型表单优先 Drawer，快速确认 / 结果预览优先 Modal。

演示要求：

- 标题明确
- 内容足够完整
- 主 / 次操作明确
- 点击后有反馈

不要求真实保存。

## 6. 筛选

简单列表使用本地 filter 即可。只有演示需求真的涉及复杂查询时才做 QueryFilter 展开收起。

## 7. 删除

原型中不必真删数据；可以 `Popconfirm + message.success`，或者本地移除数组项。

## 8. AI / Agent

建议演示：

```text
待开始 → 分析中 → 已完成
```

必要时显示 2～4 个步骤，例如：

- 解析内容
- 识别主题
- 生成结果
- 完成

不要为了“Agent 感”显示几十行伪日志。


## 9. 多页面原型跳转

多页 Demo 不要求 production Router，但必须能演示主要页面关系。

可采用任一简单方式：

- 原型平台自带页面切换 / route
- React Router（环境已具备时）
- `useState` 保存 `currentPage`，在同一 Demo 内切换页面组件
- 点击列表行 / 操作按钮进入详情，详情页通过返回按钮回到列表

最低要求：

- 主路径能点通，例如 `列表 → 详情 → 配置`
- 页面切换后保留一致的产品上下文和视觉 Shell
- 不要求 URL、浏览器历史、权限路由或深链完整正确
- 不要为演示次要功能创建无意义页面
