import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'tools/drawio/generate.mjs');

function fixture() {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-generator-'));
    const project = `.drawio-test-${process.pid}-${Date.now()}`;
    const projectRoot = path.join(root, 'src/pages', project);
    const output = path.join(projectRoot, 'page/docs/diagrams/v1.drawio');
    return {
        inputDir,
        project,
        projectRoot,
        output,
        cleanup() {
            fs.rmSync(inputDir, { recursive: true, force: true });
            fs.rmSync(projectRoot, { recursive: true, force: true });
        }
    };
}

test('标准流程图只显示短标签，并把跨层线与回退线绕到外侧', () => {
    const current = fixture();
    try {
        const input = path.join(current.inputDir, 'diagram.json');
        fs.writeFileSync(input, JSON.stringify({
            title: '播放网络检测',
            type: 'flow',
            layout: 'vertical',
            nodes: [
                { id: 'play', label: '开始播放', description: '用户发起播放请求' },
                { id: 'ready', label: '及时就绪？', shape: 'diamond' },
                { id: 'test', label: '检测网速' },
                { id: 'stable', label: '网络稳定？', shape: 'diamond' },
                { id: 'warn', label: '提示网络差' },
                { id: 'retry', label: '等待重试' },
                { id: 'playing', label: '继续播放' }
            ],
            edges: [
                { source: 'play', target: 'ready' },
                { source: 'ready', target: 'playing', label: '是' },
                { source: 'ready', target: 'test', label: '否' },
                { source: 'test', target: 'stable' },
                { source: 'stable', target: 'playing', label: '是' },
                { source: 'stable', target: 'warn', label: '否' },
                { source: 'warn', target: 'retry' },
                { source: 'retry', target: 'play', label: '重试' }
            ]
        }));

        execFileSync(process.execPath, [generator, '--input', input, '--project', current.project, '--page', 'page', '--version', 'v1', '--output', current.output]);
        const xml = fs.readFileSync(current.output, 'utf8');

        assert.match(xml, /value="开始播放" dataDescription="用户发起播放请求"/);
        assert.doesNotMatch(xml, /<br|font-size:10/);
        assert.equal((xml.match(/<Array as="points">/g) || []).length, 2);
        assert.match(xml, /exitX=1;exitY=0\.5;entryX=1;entryY=0\.5/);
    } finally {
        current.cleanup();
    }
});

test('拒绝句子式节点文案', () => {
    const current = fixture();
    try {
        const input = path.join(current.inputDir, 'invalid.json');
        fs.writeFileSync(input, JSON.stringify({
            title: '无效文案',
            type: 'flow',
            nodes: [{ id: 'start', label: '这是一个非常啰嗦而且完全不应该出现在框里的节点说明文字' }],
            edges: []
        }));
        const result = spawnSync(process.execPath, [generator, '--input', input, '--project', current.project, '--page', 'page', '--version', 'v1', '--output', current.output], { encoding: 'utf8' });

        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /too long/);
        assert.equal(fs.existsSync(current.output), false);
    } finally {
        current.cleanup();
    }
});
