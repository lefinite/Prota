import React, { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';

// Prototype template: 对象详情页
export default function ObjectDetailPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="ds-page-shell" style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
          <Space align="start">
            <Button type="text" icon={<ArrowLeftOutlined />} />
            <div>
              <Space size={10}>
                <Typography.Title level={3} style={{ margin: 0 }}>杭州知行资产管理有限公司</Typography.Title>
                <Tag color="processing">跟进中</Tag>
                <Tag>A级客户</Tag>
              </Space>
              <Typography.Text type="secondary">机构客户 · 负责人 王嘉诚 · 最近更新 2 小时前</Typography.Text>
            </div>
          </Space>
          <Space>
            <Button icon={<MoreOutlined />}>更多</Button>
            <Button type="primary" icon={<EditOutlined />} onClick={() => setOpen(true)}>编辑客户</Button>
          </Space>
        </div>

        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 24 }}>
            <Statistic title="累计成交" value={428600} prefix="¥" />
            <Statistic title="商机数量" value={6} suffix="个" />
            <Statistic title="最近联系" value="今天 09:42" />
            <Statistic title="预计下次跟进" value="8 月 13 日" />
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 16 }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="基础信息">
              <Descriptions column={2} labelStyle={{ color: '#8c8c8c' }}>
                <Descriptions.Item label="客户类型">机构客户</Descriptions.Item>
                <Descriptions.Item label="所属行业">金融 / 资产管理</Descriptions.Item>
                <Descriptions.Item label="主要联系人">周敏 · 投资者关系负责人</Descriptions.Item>
                <Descriptions.Item label="联系电话">138****2608</Descriptions.Item>
                <Descriptions.Item label="所在地区">浙江 · 杭州</Descriptions.Item>
                <Descriptions.Item label="客户来源">2026 春季线上投教活动</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="当前商机">
              <Descriptions column={2} labelStyle={{ color: '#8c8c8c' }}>
                <Descriptions.Item label="商机名称">企业投教直播年度服务</Descriptions.Item>
                <Descriptions.Item label="当前阶段"><Tag color="blue">方案确认</Tag></Descriptions.Item>
                <Descriptions.Item label="预计金额">¥268,000</Descriptions.Item>
                <Descriptions.Item label="预计签约">2026-08-28</Descriptions.Item>
                <Descriptions.Item label="客户诉求" span={2}>希望支持多会场直播、投顾内容审核与完整数据归因，近期需要完成内部预算确认。</Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>

          <Card title="最近跟进">
            <Timeline
              items={[
                { color: 'blue', children: <><Typography.Text strong>方案沟通完成</Typography.Text><div><Typography.Text type="secondary">今天 09:42 · 与周敏确认直播审核与数据需求</Typography.Text></div></> },
                { children: <><Typography.Text strong>发送第二版报价</Typography.Text><div><Typography.Text type="secondary">08-08 16:20 · 年度方案 ¥268,000</Typography.Text></div></> },
                { children: <><Typography.Text strong>客户进入重点跟进</Typography.Text><div><Typography.Text type="secondary">08-04 11:15 · 客户等级调整为 A</Typography.Text></div></> },
              ]}
            />
            <Button block>添加跟进记录</Button>
          </Card>
        </div>
      </Space>

      <Drawer
        title="编辑客户信息"
        width={520}
        open={open}
        onClose={() => setOpen(false)}
        extra={<Button type="primary" onClick={() => { message.success('已保存（Demo）'); setOpen(false); }}>保存</Button>}
      >
        <Form layout="vertical">
          <Form.Item label="客户名称"><Input defaultValue="杭州知行资产管理有限公司" /></Form.Item>
          <Form.Item label="主要联系人"><Input defaultValue="周敏" /></Form.Item>
          <Form.Item label="客户备注"><Input.TextArea rows={5} defaultValue="重点关注投教直播和审核能力，8 月内计划完成年度采购。" /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
