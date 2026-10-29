import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const product = new URL('../', import.meta.url);
const server = http.createServer(async (req, res) => {
    try {
        const file = new URL(`.${new URL(req.url, 'http://localhost').pathname}`, product);
        if (!file.href.startsWith(product.href)) throw new Error('Outside product');
        const body = await readFile(fileURLToPath(file));
        const type = file.pathname.endsWith('.css') ? 'text/css'
            : /\.m?js$/.test(file.pathname) ? 'text/javascript' : 'text/html';
        res.writeHead(200, { 'Content-Type': type }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.route(/fonts\.google/, route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/portal/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.shell?.patchAgentTimeline));
    for (const width of [583, 1280]) {
        await page.setViewportSize({ width, height: 806 });
        const result = await page.evaluate(async () => {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;background:#080d17;z-index:99999';
            host.innerHTML = '<div class="agent-timeline"></div>';
            document.body.append(host);
            const timeline = host.firstElementChild;
            // Exercise the real renderer with isolated state, without changing a live session.
            const shell = Object.create(window.shell);
            const events = Array.from({ length: 24 }, (_, i) => ({ id: `message-${i}`,
                type: 'assistant_message', createdAt: new Date().toISOString(),
                payload: { text: `历史消息 ${i}：查看之前的过程，底部继续生成新内容。` } }));
            events.push({ id: 'thinking', type: 'assistant_thinking', createdAt: new Date().toISOString(),
                payload: { text: '持续生成的思考内容\n'.repeat(40) } });
            const group = { id: 'scroll-fixture', runId: 'scroll-fixture', active: true, events };
            Object.assign(shell, { agentTimeline: timeline, agentTimelineEvents: events,
                agentRunState: { active: true, runId: group.runId }, agentJumpLatestBtn: null,
                agentAutoScroll: false, _needsFullTimelineRebuild: false,
                buildAgentTimelineGroups: () => [group] });
            shell.fullRenderAgentTimeline([group]);
            await new Promise(requestAnimationFrame);
            timeline.scrollTop = 120;
            await new Promise(requestAnimationFrame);
            const initial = timeline.scrollTop;
            const initialAnchor = Array.from(timeline.querySelectorAll('.agent-assistant-message'))
                .find((element) => element.getBoundingClientRect().bottom > timeline.getBoundingClientRect().top);
            const anchorId = initialAnchor?.dataset.eventId;
            const initialAnchorTop = initialAnchor?.getBoundingClientRect().top;
            const positions = [];
            const anchorPositions = [];
            const initialHeight = timeline.scrollHeight;
            for (let i = 0; i < 60; i++) {
                const streamEvent = { id: `stream-${i}`, type: 'assistant_message', createdAt: new Date().toISOString(),
                    payload: { partial: true, text: `底部新消息 ${i}：新增内容不应移动上方阅读位置。` } };
                events.push(streamEvent);
                shell._pendingAssistantMessagePatches = new Map([[streamEvent.id, streamEvent]]);
                shell._scheduleAssistantMessagePatch();
                if (i % 7 === 0) shell._needsFullTimelineRebuild = true;
                shell.patchAgentTimeline();
                if (i % 11 === 0) shell.renderAgentTimeline();
                await new Promise(requestAnimationFrame);
                positions.push(timeline.scrollTop);
                const anchor = timeline.querySelector(`.agent-assistant-message[data-event-id="${CSS.escape(anchorId)}"]`);
                anchorPositions.push(anchor?.getBoundingClientRect().top ?? initialAnchorTop);
            }
            const growth = timeline.scrollHeight - initialHeight;
            const drift = Math.max(...positions.map(top => Math.abs(top - initial)));
            const anchorDrift = Math.max(...anchorPositions.map(top => Math.abs(top - initialAnchorTop)));
            const anchor = timeline.querySelector(`.agent-assistant-message[data-event-id="${CSS.escape(anchorId)}"]`);
            const anchorTopBeforeAboveUpdate = anchor.getBoundingClientRect().top;
            const scrollTopBeforeAboveUpdate = timeline.scrollTop;
            events[0].payload.partial = true;
            events[0].payload.text += ' 上方内容继续生成，不应推动正在阅读的段落。'.repeat(8);
            shell._pendingAssistantMessagePatches = new Map([[events[0].id, events[0]]]);
            shell._scheduleAssistantMessagePatch();
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            const aboveUpdateAnchorDrift = Math.abs(
                anchor.getBoundingClientRect().top - anchorTopBeforeAboveUpdate
            );
            const aboveUpdateScrollAdjustment = Math.abs(timeline.scrollTop - scrollTopBeforeAboveUpdate);
            shell.agentAutoScroll = true;
            shell.patchAgentTimeline();
            shell.scrollAgentTimelineToLatest(true, true);
            await new Promise(requestAnimationFrame);
            const bottomGap = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
            const process = timeline.querySelector('.agent-process');
            const frameless = getComputedStyle(process).borderTopWidth === '0px';
            const processWidth = process.getBoundingClientRect().width;
            const availableWidth = timeline.clientWidth - 36;
            host.remove();
            return {
                growth,
                drift,
                anchorDrift,
                aboveUpdateAnchorDrift,
                aboveUpdateScrollAdjustment,
                bottomGap,
                frameless,
                processWidth,
                availableWidth
            };
        });
        assert.ok(result.growth > 500, 'Fixture must grow below the reader');
        assert.ok(result.drift <= 1, `History moved ${result.drift}px at ${width}px`);
        assert.ok(result.anchorDrift <= 1, `Visible history jumped ${result.anchorDrift}px at ${width}px`);
        assert.ok(result.aboveUpdateAnchorDrift <= 1,
            `Visible history jumped ${result.aboveUpdateAnchorDrift}px when content above streamed at ${width}px`);
        assert.ok(result.aboveUpdateScrollAdjustment > 0,
            'The reader position must compensate when content above grows');
        assert.ok(result.bottomGap <= 1, 'Follow latest must still reach the bottom');
        assert.ok(result.frameless, 'Process groups must remain frameless');
        assert.ok(Math.abs(result.processWidth - result.availableWidth) <= 1,
            `Process width ${result.processWidth}px should use ${result.availableWidth}px`);
        console.log(`PASS ${width}px: visible drift ${result.anchorDrift}px (above ${result.aboveUpdateAnchorDrift}px), scroll drift ${result.drift}px, content growth ${result.growth}px, bottom gap ${result.bottomGap}px, process width ${result.processWidth}px`);
    }
} finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
