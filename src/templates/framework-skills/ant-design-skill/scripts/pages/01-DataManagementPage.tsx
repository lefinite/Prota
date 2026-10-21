import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';

// Prototype template: 数据管理 / 列表运营页
// 生成时优先替换业务字段、状态、筛选和 Mock Data；不要机械保留所有区块。

type CustomerStatus = '跟进中' | '已成交' | '待联系' | '暂停跟进';

type Customer = {
  key: string;
  name: string;
  contact: string;
  owner: string;
  level: 'A级' | 'B级' | 'C级';
  status: CustomerStatus;
  amount: number;
  updatedAt: string;
};

const initialData: Customer[] = [
  { key: '1', name: '杭州知行资产管理有限公司', contact: '周敏 · 138****2608', owner: '王嘉诚', level: 'A级', status: '跟进中', amount: 428600, updatedAt: '今天 10:24' },
  { key: '2', name: '浙江启明科技股份有限公司', contact: '陈璐 · 186****7742', owner: '李楠', level: 'B级', status: '待联系', amount: 86000, updatedAt: '今天 09:18' },
  { key: '3', name: '宁波远航供应链有限公司', contact: '孙驰 · 159****1256', owner: '王嘉诚', level: 'A级', status: '已成交', amount: 782300, updatedAt: '昨天 17:42' },
  { key: '4', name: '上海沐川数字科技有限公司', contact: '林可 · 137****5319', owner: '赵宁', level: 'C级', status: '暂停跟进', amount: 32000, updatedAt: '08-07 14:30' },
  { key: '5', name: '杭州澄澈企业服务中心', contact: '吴尧 · 188****2190', owner: '李楠', level: 'B级', status: '跟进中', amount: 164800, updatedAt: '08-06 11:06' },
  { key: '6', name: '金华新禾文化传媒有限公司', contact: '何清 · 135****6604', owner: '赵宁', level: 'C级', status: '待联系', amount: 24000, updatedAt: '08-05 16:55' },
];

const statusColor: Record<CustomerStatus, string> = {
  跟进中: 'processing',
  已成交: 'success',
  待联系: 'default',
  暂停跟进: 'warning',
};

export default function DataManagementPage() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<CustomerStatus | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const data = useMemo(() => {
    return initialData.filter((item) => {
      const hitKeyword = !keyword || item.name.includes(keyword) || item.contact.includes(keyword);
      const hitStatus = !status || item.status === status;
      return hitKeyword && hitStatus;
    });
  }, [keyword, status]);

  const columns = [
    {
      title: '客户',
      dataIndex: 'name',
      width: 280,
      render: (_: string, record: Customer) => (
        <Space size={12}>
          <Avatar icon={<UserOutlined />} />
          <div>
            <Typography.Text strong>{record.name}</Typography.Text>
            <div><Typography.Text type="secondary">{record.contact}</Typography.Text></div>
          </div>
        </Space>
      ),
    },
    { title: '客户等级', dataIndex: 'level', width: 100, render: (value: string) => <Tag>{value}</Tag> },
    { title: '负责人', dataIndex: 'owner', width: 100 },
    { title: '状态', dataIndex: 'status', width: 110, render: (value: CustomerStatus) => <Tag color={statusColor[value]}>{value}</Tag> },
    { title: '累计成交', dataIndex: 'amount', width: 130, render: (value: number) => `¥${value.toLocaleString()}` },
    { title: '最后更新', dataIndex: 'updatedAt', width: 130 },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Customer) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => {
            setEditing(record);
            setDrawerOpen(true);
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="ds-page-shell" style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>客户管理</Typography.Title>
            <Typography.Text type="secondary">统一管理客户线索、跟进状态与成交进展</Typography.Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setDrawerOpen(true); }}>
            新增客户
          </Button>
        </div>

        <Card styles={{ body: { padding: 16 } }}>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索客户名称 / 联系人"
              style={{ width: 280 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              allowClear
              placeholder="客户状态"
              style={{ width: 150 }}
              value={status}
              onChange={setStatus}
              options={['跟进中', '已成交', '待联系', '暂停跟进'].map((value) => ({ label: value, value }))}
            />
            <Button onClick={() => { setKeyword(''); setStatus(undefined); }}>重置</Button>
          </Space>
        </Card>

        <Card styles={{ body: { padding: 0 } }}>
          <Table<Customer>
            rowKey="key"
            columns={columns}
            dataSource={data}
            pagination={{ pageSize: 6, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 1050 }}
          />
        </Card>
      </Space>

      <Drawer
        title={editing ? `编辑客户 · ${editing.name}` : '新增客户'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={() => { message.success('已保存（Demo）'); setDrawerOpen(false); }}>保存</Button>}
      >
        <Form layout="vertical" initialValues={editing ?? { level: 'B级', status: '待联系' }}>
          <Form.Item label="客户名称" name="name" required><Input placeholder="请输入企业或客户名称" /></Form.Item>
          <Form.Item label="联系人" name="contact"><Input placeholder="联系人 / 手机号" /></Form.Item>
          <Form.Item label="客户等级" name="level"><Select options={['A级', 'B级', 'C级'].map((v) => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item label="跟进状态" name="status"><Select options={['跟进中', '已成交', '待联系', '暂停跟进'].map((v) => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item label="备注" name="memo"><Input.TextArea rows={4} placeholder="记录客户需求、下一步动作等" /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
