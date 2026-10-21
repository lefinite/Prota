import React, { useState } from 'react';
import { Button, Card, Drawer, List, message, Progress, Space, Tag, Typography } from 'antd';
import { ExportOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';

// Prototype template: 项目处理 / AI 任务工作台
const clips = [
  { id: '01', time: '01:22 - 03:15', title: '降息预期如何影响 A 股', summary: '分析流动性改善对成长板块和券商板块的短期影响，并提示仍需关注企业盈利修复。', score: 92, status: '可发布' },
  { id: '02', time: '05:08 - 07:44', title: '科技成长板块的三个观察指标', summary: '从成交额、机构仓位和盈利预期三个角度总结科技成长方向的观察框架。', score: 87, status: '待确认' },
  { id: '03', time: '11:35 - 13:10', title: '下半年资产配置建议', summary: '建议均衡配置高股息、科技成长与部分黄金资产，降低单一赛道波动风险。', score: 95, status: '可发布' },
];

export default function ProjectWorkspacePage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [selected, setSelected] = useState<(typeof clips)[number] | null>(null);

  const rerun = () => {
    setRunning(true);
    setProgress(18);
    const timer = setInterval(() => {
      setProgress((value) => {
        if (value >= 94) {
          clearInterval(timer);
          setRunning(false);
          message.success('AI 分析完成（Demo）');
          return 100;
        }
        return value + 19;
      });
    }, 350);
  };

  return (
    <div className="ds-page-shell" style={{ padding: 24, background: '#f5f6f8', minHeight: '100vh' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Space><Typography.Title level={3} style={{ margin: 0 }}>8 月宏观策略直播 · AI 拆条</Typography.Title><Tag color={running ? 'processing' : 'success'}>{running ? '分析中' : '已完成'}</Tag></Space>
            <Typography.Text type="secondary">视频 42:18 · 上传于今天 09:16 · 已识别 8 个可发布片段</Typography.Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} loading={running} onClick={rerun}>重新分析</Button>
            <Button type="primary" icon={<ExportOutlined />}>导出全部</Button>
          </Space>
        </div>

        {running && <Card><Space direction="vertical" style={{ width: '100%' }}><Typography.Text>正在识别高价值主题并生成片段…</Typography.Text><Progress percent={progress} /></Space></Card>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(520px, 1.5fr)', gap: 16 }}>
          <Card title="原始视频" styles={{ body: { padding: 16 } }}>
            <div style={{ height: 330, borderRadius: 8, background: '#111827', display: 'grid', placeItems: 'center', color: '#fff' }}>
              <div style={{ textAlign: 'center' }}>
                <PlayCircleOutlined style={{ fontSize: 52, opacity: 0.9 }} />
                <div style={{ marginTop: 12 }}>2026 下半年宏观策略直播</div>
                <div style={{ opacity: 0.6, marginTop: 4 }}>42:18</div>
              </div>
            </div>
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 16 }}>
              <Typography.Text strong>分析设置</Typography.Text>
              <Typography.Text type="secondary">目标平台：抖音 / 视频号 · 推荐片段长度：60～180 秒 · 风格：专业观点</Typography.Text>
            </Space>
          </Card>

          <Card title={<Space>AI 拆条结果 <Tag>{clips.length} / 8 个重点片段</Tag></Space>}>
            <List
              dataSource={clips}
              renderItem={(item) => (
                <List.Item actions={[<Button key="edit" type="link" onClick={() => setSelected(item)}>编辑</Button>, <Button key="export" type="link">导出</Button>] }>
                  <List.Item.Meta
                    title={<Space><Typography.Text strong>{item.title}</Typography.Text><Tag color={item.status === '可发布' ? 'success' : 'warning'}>{item.status}</Tag></Space>}
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Text type="secondary">{item.time} · AI 推荐分 {item.score}</Typography.Text>
                        <Typography.Text>{item.summary}</Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      </Space>

      <Drawer title={selected?.title ?? '编辑片段'} width={560} open={!!selected} onClose={() => setSelected(null)} extra={<Button type="primary" onClick={() => { message.success('片段已更新（Demo）'); setSelected(null); }}>保存</Button>}>
        {selected && <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div><Typography.Text type="secondary">时间范围</Typography.Text><div>{selected.time}</div></div>
          <div><Typography.Text type="secondary">标题</Typography.Text><div style={{ marginTop: 6, padding: 10, border: '1px solid #d9d9d9', borderRadius: 6 }}>{selected.title}</div></div>
          <div><Typography.Text type="secondary">AI 摘要</Typography.Text><div style={{ marginTop: 6, padding: 10, border: '1px solid #d9d9d9', borderRadius: 6 }}>{selected.summary}</div></div>
        </Space>}
      </Drawer>
    </div>
  );
}
