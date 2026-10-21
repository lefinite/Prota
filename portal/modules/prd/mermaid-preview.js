import { renderAlignedFlowchart } from './flowchart-layout.js?v=20261013-auto-polish-v1';
import { openDiagramViewer } from './diagram-viewer.js?v=20261013-auto-polish-v1';

let runtime;
let sequence = 0;
const cache = new Map();

function loadRuntime() {
    runtime ||= import('./vendor/mermaid/mermaid.bundle.mjs').then(({ default: mermaid }) => {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'base',
            fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
            themeVariables: {
                primaryColor: '#f8fafc', primaryTextColor: '#243247',
                primaryBorderColor: '#cbd5e1', lineColor: '#8492a6',
                secondaryColor: '#eff6ff', tertiaryColor: '#f8fafc',
                edgeLabelBackground: '#ffffff', fontSize: '14px',
                nodeBorder: '#cbd5e1', clusterBkg: '#f8fafc', clusterBorder: '#e2e8f0'
            },
            flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis', nodeSpacing: 44, rankSpacing: 64, padding: 20 }
        });
        return mermaid;
    }).catch((error) => { runtime = null; throw error; });
    return runtime;
}

async function renderSource(source) {
    if (!cache.has(source)) {
        const pending = loadRuntime().then(async (mermaid) => {
            const id = `prd-mermaid-${++sequence}`;
            const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
            let flowData;
            if (diagram.type.startsWith('flowchart') && diagram.db.getData) {
                const data = diagram.db.getData();
                flowData = data;
                data.direction = diagram.db.getDirection?.() || data.direction;
                const aligned = renderAlignedFlowchart(data, id);
                if (aligned) return aligned;
            }
            const svg = (await mermaid.render(id, source)).svg;
            return flowData ? styleNativeFlowchart(svg, flowData) : svg;
        }).catch((error) => { cache.delete(source); throw error; });
        cache.set(source, pending);
        if (cache.size > 32) cache.delete(cache.keys().next().value);
    }
    return cache.get(source);
}

function styleNativeFlowchart(svg, data) {
    // Advanced layouts retain Mermaid's renderer, but ordinary default nodes
    // still use the same visual vocabulary. Explicit document styles win.
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const elements = new Map(Array.from(parsed.querySelectorAll('[id]'), (node) => [node.id, node]));
    data.nodes.forEach((node) => {
        if (node.isGroup || node.cssStyles?.length || node.cssCompiledStyles?.length || node.labelStyle
            || (node.look && node.look !== 'classic')) return;
        const decision = node.shape === 'diamond';
        if (!decision && !['rect', 'squareRect', 'rounded'].includes(node.shape)) return;
        const group = elements.get(node.domId);
        const shape = group?.querySelector('.label-container') || group?.querySelector('rect, polygon');
        if (!shape) return;
        const terminal = !data.edges.some((edge) => edge.start === node.id);
        shape.style.fill = decision ? '#eff4fc' : terminal ? '#edf6f0' : '#ffffff';
        shape.style.stroke = decision ? '#9aafd1' : terminal ? '#a2bdaa' : '#cbd5e1';
        shape.style.strokeWidth = '1.4px';
        if (shape.tagName.toLowerCase() === 'rect') {
            shape.setAttribute('rx', '12');
            shape.setAttribute('ry', '12');
        }
    });
    return new XMLSerializer().serializeToString(parsed.documentElement);
}

function scopeSvg(svg) {
    // Cached diagrams can appear twice in a document; each copy needs its own
    // marker and label IDs so arrows and accessibility references stay local.
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const prefix = `prd-diagram-${++sequence}-`;
    const ids = new Map(Array.from(parsed.querySelectorAll('[id]'), (node) => [node.id, prefix + node.id]));
    parsed.querySelectorAll('style').forEach((style) => {
        Array.from(ids).sort((a, b) => b[0].length - a[0].length).forEach(([id, next]) => {
            style.textContent = style.textContent.replaceAll(`#${id}`, `#${next}`);
        });
    });
    parsed.querySelectorAll('*').forEach((node) => {
        for (const attr of Array.from(node.attributes)) {
            let value = attr.value;
            if (attr.name === 'id') value = ids.get(value) || value;
            else if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') {
                value = value.split(' ').map((id) => ids.get(id) || id).join(' ');
            } else {
                ids.forEach((next, id) => {
                    value = value.replaceAll(`url(#${id})`, `url(#${next})`);
                    if (value === `#${id}`) value = `#${next}`;
                });
            }
            node.setAttribute(attr.name, value);
        }
    });
    return new XMLSerializer().serializeToString(parsed.documentElement);
}

export async function mountMermaidDiagrams(container) {
    if (!container) return;
    await Promise.all(Array.from(container.querySelectorAll('[data-prd-mermaid]'), async (card) => {
        if (card.dataset.mermaidMounted) return;
        card.dataset.mermaidMounted = 'loading';
        const source = card.querySelector('[data-mermaid-source]')?.textContent || '';
        const canvas = card.querySelector('[data-mermaid-canvas]');
        if (!canvas) return;
        try {
            const svg = await renderSource(source);
            if (!card.isConnected) return;
            canvas.innerHTML = scopeSvg(svg);
            canvas.setAttribute('role', 'button');
            canvas.setAttribute('tabindex', '0');
            canvas.setAttribute('aria-label', '展开流程图，可放大缩小和拖动');
            const open = (event) => {
                event.preventDefault();
                event.stopPropagation();
                openDiagramViewer(scopeSvg(svg));
            };
            canvas.addEventListener('click', open);
            canvas.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') open(event);
            });
            canvas.addEventListener('dblclick', (event) => event.stopPropagation());
            const hint = document.createElement('p');
            hint.className = 'prd-mermaid-diagram__hint';
            hint.textContent = '点击查看大图';
            card.appendChild(hint);
            card.dataset.mermaidMounted = 'ready';
            card.querySelector('[data-mermaid-status]')?.remove();
        } catch {
            if (!card.isConnected) return;
            card.dataset.mermaidMounted = 'error';
            const status = card.querySelector('[data-mermaid-status]');
            if (status) status.textContent = '流程图暂时无法显示，请检查图表内容后重试。';
        }
    }));
}
