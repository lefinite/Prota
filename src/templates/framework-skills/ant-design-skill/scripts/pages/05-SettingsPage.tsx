import React, { useState } from 'react';
import { Button, Card, Divider, Form, InputNumber, message, Select, Space, Switch, Typography } from 'antd';

// Prototype template: 设置 / 配置页
export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      message.success('设置已保存（Demo）');
    }, 700);
  };

  return (
    <div className="ds-page-shell" style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>AI 拆条设置</Typography.Title>
            <Typography.Text type="secondary">控制默认分析策略和导出规则，新项目将自动继承这些设置</Typography.Text>
          </div>

          <Card title="生成策略">
            <Form layout="vertical">
              <Form.Item label="目标内容风格" extra="影响 AI 对片段价值和标题风格的判断">
                <Select defaultValue="professional" style={{ width: 320 }} options={[{ label: '专业观点', value: 'professional' }, { label: '热点传播', value: 'viral' }, { label: '知识科普', value: 'education' }]} />
              </Form.Item>
              <Form.Item label="推荐片段长度">
                <Space><InputNumber min={30} max={600} defaultValue={60} addonAfter="秒" /><span>至</span><InputNumber min={30} max={600} defaultValue={180} addonAfter="秒" /></Space>
              </Form.Item>
              <Form.Item label="优先保留完整观点">
                <Switch defaultChecked />
                <Typography.Text type="secondary" style={{ marginLeft: 12 }}>避免为了固定时长截断完整论述</Typography.Text>
              </Form.Item>
            </Form>
          </Card>

          <Card title="内容安全">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><Typography.Text strong>敏感内容检测</Typography.Text><div><Typography.Text type="secondary">导出前检查风险词、承诺收益和不当表述</Typography.Text></div></div><Switch defaultChecked /></div>
              <Divider style={{ margin: 0 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><Typography.Text strong>高风险片段自动拦截</Typography.Text><div><Typography.Text type="secondary">标记为“需人工确认”，不进入批量导出</Typography.Text></div></div><Switch defaultChecked /></div>
            </Space>
          </Card>

          <Card title="默认导出">
            <Form layout="vertical">
              <Form.Item label="视频比例"><Select defaultValue="9:16" style={{ width: 240 }} options={[{ label: '9:16 竖屏', value: '9:16' }, { label: '16:9 横屏', value: '16:9' }, { label: '1:1 方形', value: '1:1' }]} /></Form.Item>
              <Form.Item label="自动生成字幕"><Switch defaultChecked /></Form.Item>
            </Form>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button type="primary" loading={saving} onClick={save}>保存设置</Button></div>
        </Space>
      </div>
    </div>
  );
}
