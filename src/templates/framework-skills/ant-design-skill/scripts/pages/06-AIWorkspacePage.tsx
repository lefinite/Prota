import React, { useState } from 'react';
import { Avatar, Button, Card, Input, List, Space, Steps, Tag, Typography } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';

// Prototype template: AI / Agent 工作区。生成时要体现垂类上下文，而不是做通用 ChatGPT 克隆。
type Message = { role: 'user' | 'assistant'; content: string };

const initialMessages: Message[] = [
  { role: 'user', content: '帮我分析这次客户反馈里，哪些问题最影响续费？' },
  { role: 'assistant', content: '我整理了 42 条近期反馈。最影响续费的不是功能缺失，而是“首次配置复杂”和“分析结果难以直接复用”两个问题，合计覆盖 61% 的负向反馈。右侧已经列出证据和建议动作。' },
];

export default function AIWorkspacePage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [value, setValue] = useState('');
  const [thinking, setThinking] = useState(false);

  const send = () => {
    if (!value.trim()) return;
    setMessages((items) => [...items, { role: 'user', content: value }]);
    setValue('');
    setThinking(true);
    setTimeout(() => {
      setMessages((items) => [...items, { role: 'assistant', content: '进一步看，首次配置问题主要集中在数据源接入和默认参数理解。我建议原型优先验证“模板化配置 + 一键推荐参数”，这样最容易直接影响首次成功率。' }]);
      setThinking(false);
    }, 900);
  };

  return (
    <div style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Space><Typography.Title level={3} style={{ margin: 0 }}>客户反馈分析 Agent</Typography.Title><Tag color="purple">已连接 42 条反馈</Tag></Space>
          <Typography.Text type="secondary">围绕续费、产品体验和高频问题主动分析，并保留证据来源</Typography.Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(520px, 1fr) 340px', gap: 16, alignItems: 'stretch' }}>
          <Card title="分析上下文" styles={{ body: { padding: 16 } }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div><Typography.Text type="secondary">分析范围</Typography.Text><div><Typography.Text strong>企业版客户 · 近 30 天</Typography.Text></div></div>
              <div><Typography.Text type="secondary">数据来源</Typography.Text><div>工单 26 · 访谈 9 · 销售记录 7</div></div>
              <div><Typography.Text type="secondary">目标</Typography.Text><div>找到影响续费的核心问题</div></div>
              <Button block>调整分析范围</Button>
            </Space>
          </Card>

          <Card styles={{ body: { padding: 0, height: 600, display: 'flex', flexDirection: 'column' } }}>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              <List
                split={false}
                dataSource={messages}
                renderItem={(item) => (
                  <List.Item style={{ border: 0, alignItems: 'flex-start' }}>
                    <Space align="start" size={12}>
                      <Avatar icon={item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />} />
                      <div style={{ maxWidth: 720 }}>
                        <Typography.Text strong>{item.role === 'assistant' ? '分析 Agent' : '你'}</Typography.Text>
                        <div style={{ marginTop: 6, lineHeight: 1.7 }}>{item.content}</div>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
              {thinking && <Typography.Text type="secondary">Agent 正在查看反馈证据并归纳问题…</Typography.Text>}
            </div>
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 16 }}>
              <Input.TextArea value={value} onChange={(e) => setValue(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} placeholder="继续追问，或让 Agent 给出方案…" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><Button type="primary" icon={<SendOutlined />} onClick={send}>发送</Button></div>
            </div>
          </Card>

          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="当前结论">
              <Space direction="vertical" size={12}>
                <div><Tag color="red">高影响</Tag><Typography.Text strong>首次配置复杂</Typography.Text><div><Typography.Text type="secondary">18 / 42 条反馈涉及</Typography.Text></div></div>
                <div><Tag color="orange">高影响</Tag><Typography.Text strong>结果难直接复用</Typography.Text><div><Typography.Text type="secondary">12 / 42 条反馈涉及</Typography.Text></div></div>
              </Space>
            </Card>
            <Card title="Agent 工作状态">
              <Steps direction="vertical" size="small" current={3} items={[{ title: '读取反馈' }, { title: '聚类问题' }, { title: '核对证据' }, { title: '生成结论' }]} />
            </Card>
            <Card title="证据"><Typography.Text>“第一次配置不知道选什么参数，希望系统直接给推荐值。”</Typography.Text><div style={{ marginTop: 10 }}><Typography.Text type="secondary">客户访谈 · 星河资本 · 08-06</Typography.Text></div></Card>
          </Space>
        </div>
      </Space>
    </div>
  );
}
