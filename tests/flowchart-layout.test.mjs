import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFlowchartLayout, getFlowchartSidePort, layoutFlowchart, renderAlignedFlowchart, wrapFlowchartLabel } from '../portal/modules/prd/flowchart-layout.js';

function fixture() {
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({
        id, label: id, shape: ['B', 'C', 'D'].includes(id) ? 'diamond' : 'squareRect'
    }));
    const edges = [
        ['A', 'B'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['C', 'F'],
        ['C', 'B', 'dotted'], ['D', 'F'], ['D', 'B', 'dotted'],
        ['D', 'C'], ['D', 'G'], ['G', 'D'], ['E', 'F']
    ].map(([start, end, pattern = 'normal']) => ({
        start, end, pattern, type: 'arrow_point', arrowTypeStart: 'none', label: `${start} → ${end}`
    }));
    return { nodes, edges, direction: 'TD' };
}

test('30 个节点的简单纵向流程继续使用新版，没有节点数量门槛', () => {
    const nodes = Array.from({ length: 30 }, (_, index) => ({ id: `N${index}`, label: `步骤${index}`, shape: 'squareRect' }));
    const edges = nodes.slice(1).map((node, index) => ({ start: nodes[index].id, end: node.id, type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal' }));
    const svg = renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'large');
    assert.ok(svg);
    assert.equal((svg.match(/class="node flow-node"/g) || []).length, 30);
    assert.equal((svg.match(/class="flow-edge"/g) || []).length, 29);
});

test('同层四个分支正常排布时使用新版', () => {
    const nodes = ['R', 'A', 'B', 'C', 'D', 'Z'].map((id) => ({ id, label: id, shape: 'squareRect' }));
    const edges = ['A', 'B', 'C', 'D'].flatMap((id) => [
        { start: 'R', end: id, type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal' },
        { start: id, end: 'Z', type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal' }
    ]);
    assert.ok(renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'branches'));
});

test('可通过重排解决的交叉先优化，保留新版而不是立即回退', () => {
    const nodes = ['R', 'A', 'B', 'C', 'D'].map((id) => ({ id, label: id, shape: 'squareRect' }));
    const edges = [['R', 'A'], ['R', 'B'], ['A', 'D'], ['B', 'C']].map(([start, end]) => ({
        start, end, type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal'
    }));
    assert.ok(layoutFlowchart({ nodes, edges, direction: 'TD' }));
    const svg = renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'crossing');
    assert.ok(svg);
    assert.match(svg, /data-layout-attempt="2"/);
    const ordered = layoutFlowchart({ nodes, edges, direction: 'TD' }, { reorder: true });
    const byId = new Map(ordered.nodes.map((node) => [node.id, node]));
    assert.equal(byId.get('A').x, byId.get('D').x);
    assert.equal(byId.get('B').x, byId.get('C').x);
    assert.deepEqual(ordered.edges, edges);
});

test('长文案和显式换行自动适配框尺寸，不再受 16 字限制', () => {
    const label = '收到短信验证码后校验手机号并根据账户状态继续执行自动注册或登录';
    const nodes = [{ id: 'A', label, shape: 'diamond' }, { id: 'B', label: '验证成功\n进入书架', shape: 'squareRect' }];
    const edges = [{ start: 'A', end: 'B', type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal', label: '验证通过后继续登录并同步当前账户的阅读数据' }];
    const layout = layoutFlowchart({ nodes, edges, direction: 'TD' });
    assert.ok(layout.nodes[0].height > 112);
    assert.ok(layout.nodes[0].lines.length > 1);
    assert.equal(layout.nodes[0].lines.join(''), label);
    assert.deepEqual(layout.nodes[1].lines, ['验证成功', '进入书架']);
    assert.equal(layout.nodes[0].width, layout.nodes[1].width);
    assert.ok(renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'wrapped'));
    assert.deepEqual(wrapFlowchartLabel('验证成功<br/>进入书架', 200), ['验证成功', '进入书架']);
});

test('仍无法避开的密集交叉在优化尝试后回退，不强行展示坏图', () => {
    const nodes = ['R', 'A', 'B', 'C', 'D', 'E'].map((id) => ({ id, label: id, shape: 'squareRect' }));
    const edges = [['R', 'A'], ['R', 'B'], ['A', 'C'], ['A', 'D'], ['A', 'E'], ['B', 'C'], ['B', 'D'], ['B', 'E']]
        .map(([start, end]) => ({ start, end, type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal' }));
    assert.equal(renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'dense'), null);
});

test('同层连线穿过中间节点时尝试绕行，而不是马上放弃新版', () => {
    const nodes = ['R', 'A', 'B', 'C', 'E'].map((id) => ({ id, label: id, shape: 'squareRect' }));
    const edges = [['R', 'A'], ['R', 'B'], ['R', 'C'], ['A', 'C'], ['C', 'E']]
        .map(([start, end]) => ({ start, end, type: 'arrow_point', arrowTypeStart: 'none', pattern: 'normal' }));
    const svg = renderAlignedFlowchart({ nodes, edges, direction: 'TD' }, 'detour');
    assert.ok(svg);
    assert.match(svg, /data-layout-attempt="4"/);
    assert.equal((svg.match(/class="flow-edge"/g) || []).length, edges.length);
});

test('质量检查拒绝穿框连线、遮挡节点的标签和相互重叠的标签', () => {
    const layout = { width: 500, height: 500, nodes: [{ id: 'middle', x: 250, y: 250, width: 100, height: 60, shape: 'squareRect' }] };
    const edge = { start: 'source', end: 'target' };
    assert.equal(assessFlowchartLayout(layout, [{ edge, points: [{ x: 20, y: 250 }, { x: 480, y: 250 }] }]).reason, 'edge-through-node');
    const route = { edge, points: [{ x: 20, y: 50 }, { x: 480, y: 50 }], labelBox: { left: 220, right: 280, top: 240, bottom: 260 } };
    assert.equal(assessFlowchartLayout(layout, [route]).reason, 'label-over-node');
    route.labelBox = { left: 100, right: 180, top: 35, bottom: 65 };
    const other = { edge: { start: 'other-source', end: 'other-target' }, points: [{ x: 20, y: 100 }, { x: 480, y: 100 }], labelBox: { left: 150, right: 220, top: 40, bottom: 70 } };
    assert.equal(assessFlowchartLayout(layout, [route, other]).reason, 'label-overlap');
});

test('普通连线连接矩形边中点和菱形顶点，不再随回退方向偏移', () => {
    const { nodes } = layoutFlowchart(fixture());
    for (const node of nodes) {
        for (const side of [-1, 1]) {
            for (const count of [1, 2]) {
                for (let index = 0; index < count; index += 1) {
                    assert.deepEqual(getFlowchartSidePort(node, side, index, count), {
                        x: node.x + side * node.width / 2, y: node.y
                    });
                }
            }
        }
    }
});

test('菱形拥挤时端口均匀分散，仍落在菱形边界上，矩形三条线仍居中', () => {
    const { nodes } = layoutFlowchart(fixture());
    const diamond = nodes.find((node) => node.shape === 'diamond');
    const ports = Array.from({ length: 4 }, (_, index) => getFlowchartSidePort(diamond, 1, index, 4));
    assert.equal(new Set(ports.map((port) => port.y)).size, 4);
    for (const port of ports) {
        const boundary = Math.abs(port.x - diamond.x) / (diamond.width / 2)
            + Math.abs(port.y - diamond.y) / (diamond.height / 2);
        assert.ok(Math.abs(boundary - 1) < 0.0001);
    }
    const rectangle = nodes.find((node) => node.shape === 'squareRect');
    assert.equal(getFlowchartSidePort(rectangle, 1, 2, 3).y, rectangle.y);
});

test('实际输出的矩形回环连线落点居中', () => {
    const data = fixture();
    const layout = layoutFlowchart(data);
    const rectangle = layout.nodes.find((node) => node.id === 'G');
    const svg = renderAlignedFlowchart(data, 'test');
    const path = /data-from="G" data-to="D" d="([^"]+)"/.exec(svg)[1];
    assert.ok(path.startsWith(`M ${rectangle.x + rectangle.width / 2} ${rectangle.y}`));
});

test('同一节点的向上线使用上方落点，向下线使用下方落点，与声明顺序无关', () => {
    for (const edges of [fixture().edges, fixture().edges.toReversed()]) {
        const data = { ...fixture(), edges };
        const svg = renderAlignedFlowchart(data, 'test');
        const layout = layoutFlowchart(data);
        const node = layout.nodes.find((entry) => entry.id === 'D');
        const startY = (target) => Number(new RegExp(`data-from="D" data-to="${target}" d="M [\\d.]+ ([\\d.]+)`).exec(svg)[1]);
        assert.ok(startY('B') < node.y, '向上重试应从上方离开');
        assert.ok(startY('F') > node.y, '向下成功应从下方离开');
    }
});

test('成功路线与密码找回回环使用嵌套通道，避免一横一竖交叉', () => {
    const svg = renderAlignedFlowchart(fixture(), 'test');
    const points = (from, to) => {
        const d = new RegExp(`data-from="${from}" data-to="${to}" d="([^"]+)"`).exec(svg)[1];
        const numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
        return Array.from({ length: numbers.length / 2 }, (_, index) => ({ x: numbers[index * 2], y: numbers[index * 2 + 1] }));
    };
    const success = points('D', 'F');
    const recovery = points('G', 'D');
    assert.ok(Math.max(...success.map((point) => point.x)) > Math.max(...recovery.map((point) => point.x)));
    assert.ok(success[0].y < recovery.at(-1).y);
});

test('验证码与密码分支、注册与找回节点同层对齐，合流终点位于最后一层', () => {
    const { nodes } = layoutFlowchart(fixture());
    const byId = new Map(nodes.map((node) => [node.id, node]));
    assert.equal(byId.get('C').y, byId.get('D').y);
    assert.equal(byId.get('E').y, byId.get('G').y);
    assert.ok(byId.get('F').y > byId.get('E').y);
    assert.ok(byId.get('B').y < byId.get('C').y);
    assert.equal(new Set(nodes.map((node) => node.width)).size, 1);
    assert.equal(byId.get('A').x, byId.get('B').x);
    assert.equal(byId.get('A').x, byId.get('F').x);
});

test('布局保留全部连线方向与条件，不把重试关系改成成功关系', () => {
    const data = fixture();
    const original = structuredClone(data);
    const svg = renderAlignedFlowchart(data, 'test');
    assert.equal((svg.match(/class="flow-edge"/g) || []).length, data.edges.length);
    for (const edge of data.edges) {
        assert.ok(svg.includes(`data-from="${edge.start}" data-to="${edge.end}"`));
        assert.ok(svg.includes(edge.label));
    }
    assert.equal((svg.match(/stroke-dasharray="5 5"/g) || []).length, 2);
    assert.deepEqual(data, original);
});

test('子图、水平图和自定义样式交回 Mermaid，避免丢失原有语义', () => {
    const data = fixture();
    assert.equal(layoutFlowchart({ ...data, direction: 'LR' }), null);
    assert.equal(layoutFlowchart({ ...data, nodes: [{ ...data.nodes[0], isGroup: true }] }), null);
    data.nodes[0].cssCompiledStyles = ['fill:red'];
    assert.equal(layoutFlowchart(data), null);
});

test('节点和连线文案均按文本转义', () => {
    const data = fixture();
    data.nodes[0].label = '入口 & 确认';
    data.edges[0].label = '<script>bad</script>';
    const svg = renderAlignedFlowchart(data, 'test');
    assert.match(svg, /入口 &amp; 确认/);
    assert.doesNotMatch(svg, /<script>/);
});
