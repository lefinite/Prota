/**
 * Readify Demo Shell Logic
 * Handles page/version switching and project management
 */

const AGENT_STATUS_COPY = {
    disconnected: { label: '未连接', entry: '未连接' },
    testing_connection: { label: '测试连接中', entry: '测试中' },
    ready: { label: 'Ready', entry: '就绪' },
    running: { label: '运行中', entry: '执行中' },
    waiting_approval: { label: '等待审批', entry: '待审批' },
    waiting_user_answer: { label: '等待回答', entry: '待回答' },
    interrupted: { label: '已中断', entry: '已中断' },
    succeeded: { label: '已完成', entry: '已完成' },
    failed: { label: '执行失败', entry: '失败' }
};

const AGENT_ACTIVITY_COPY = {
    starting: ['Booting up', 'Getting bearings', 'Warming circuits'],
    thinking: ['Thinking', 'Pondering', 'Scheming politely', 'Shenaniganing'],
    tool: ['Wrangling tools', 'Tooling around', 'Doing the thing'],
    waiting_tool: ['Awaiting tools', 'Watching the gears', 'Waiting on results'],
    compacting: ['Compacting context', 'Folding memories', 'Tidying context'],
    approval: ['Awaiting permission', 'Holding for approval'],
    question: ['Waiting on you', 'Paused for input'],
    streaming: ['Composing', 'Writing it down'],
    done: ['Done'],
    failed: ['Stopped']
};

const AGENT_SKILL_FALLBACK = [];

const AGENT_COMMAND_FALLBACK = [];
