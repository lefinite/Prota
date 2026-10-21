import React from 'react';
import { Card, DatePicker, Progress, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

// Prototype template: Dashboard。图表区域可替换为 @ant-design/charts；本模板用轻量 CSS 图形保证 Demo 可直接预览。
const trend = [42, 58, 51, 70, 64, 83, 79, 96, 88, 108, 116, 124];

export default function DashboardPage() {
  const max = Math.max(...trend);
  return (
    <div className="ds-page-shell" style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>运营数据概览</Typography.Title>
            <Typography.Text type="secondary">关注增长、活跃与转化，不堆无意义指标</Typography.Text>
          </div>
          <Space>
            <Select defaultValue="all" style={{ width: 120 }} options={[{ label: '全部平台', value: 'all' }, { label: 'App', value: 'app' }, { label: 'Web', value: 'web' }]} />
            <DatePicker.RangePicker />
          </Space>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          <Card><Statistic title="日活用户" value={20432} suffix={<Typography.Text type="success"><ArrowUpOutlined /> 8.4%</Typography.Text>} /></Card>
          <Card><Statistic title="新增用户" value={2318} suffix={<Typography.Text type="success"><ArrowUpOutlined /> 12.1%</Typography.Text>} /></Card>
          <Card><Statistic title="次日留存" value={28.7} precision={1} suffix="%" /><Progress percent={82} showInfo={false} size="small" /></Card>
          <Card><Statistic title="AI 功能使用率" value={7.6} precision={1} suffix={<><span>%</span> <Typography.Text type="danger"><ArrowDownOutlined /> 0.5%</Typography.Text></>} /></Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 16 }}>
          <Card title="近 12 天活跃趋势">
            <div style={{ height: 260, display: 'flex', gap: 10, alignItems: 'flex-end', padding: '16px 8px 0' }}>
              {trend.map((value, index) => (
                <div key={index} style={{ flex: 1, minWidth: 12 }} title={`${value} × 100 人`}>
                  <div style={{ height: `${(value / max) * 220}px`, background: '#1677ff', borderRadius: '5px 5px 2px 2px', opacity: index === trend.length - 1 ? 1 : 0.7 }} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="关键提醒">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div><Typography.Text strong>AI 问答使用率偏低</Typography.Text><div><Typography.Text type="secondary">仅 0.8%，主要流失发生在首次入口曝光之后</Typography.Text></div></div>
              <div><Typography.Text strong>海外新增增长明显</Typography.Text><div><Typography.Text type="secondary">过去 7 天较前一周期提升 18.6%</Typography.Text></div></div>
              <div><Typography.Text strong>Android 留存需要关注</Typography.Text><div><Typography.Text type="secondary">D1 比 iOS 低 4.2 个百分点</Typography.Text></div></div>
            </Space>
          </Card>
        </div>

        <Card title="渠道表现">
          <Table
            size="middle"
            pagination={false}
            dataSource={[
              { key: 'ios', channel: 'iOS', newUsers: 812, active: 6821, retention: '32.4%', status: '增长' },
              { key: 'android', channel: 'Android', newUsers: 964, active: 7436, retention: '28.2%', status: '关注' },
              { key: 'web', channel: 'Web', newUsers: 421, active: 4210, retention: '25.8%', status: '稳定' },
              { key: 'plugin', channel: '插件', newUsers: 121, active: 1965, retention: '34.1%', status: '增长' },
            ]}
            columns={[
              { title: '渠道', dataIndex: 'channel' },
              { title: '新增用户', dataIndex: 'newUsers' },
              { title: '活跃用户', dataIndex: 'active' },
              { title: '次日留存', dataIndex: 'retention' },
              { title: '状态', dataIndex: 'status', render: (v) => <Tag color={v === '关注' ? 'warning' : v === '增长' ? 'success' : 'default'}>{v}</Tag> },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}
