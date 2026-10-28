// Protocol fixture only; production always launches the built upstream CLI.
let buffer = '';
let active = null;
const output = record => process.stdout.write(JSON.stringify(record) + '\n');
const response = (command, data = {}) => output({ id: command.id, type: 'response', command: command.type, success: true, data });
process.stdin.on('data', bytes => {
    buffer += bytes.toString('utf8');
    let lf;
    while ((lf = buffer.indexOf('\n')) >= 0) {
        const command = JSON.parse(buffer.slice(0, lf));
        buffer = buffer.slice(lf + 1);
        if (command.type === 'get_state') response(command, { isStreaming: Boolean(active), pid: process.pid });
        else if (command.type === 'prompt') {
            if (command.message === 'crash') process.exit(7);
            if (command.message === 'handled') { response(command, { disposition: 'handled' }); continue; }
            if (command.message === 'no-accept' || command.message === 'native-dialog') {
                active = setTimeout(() => {}, 60_000);
                if (command.message === 'native-dialog') output({ type: 'extension_ui_request', id: 'native-dialog', method: 'select', title: 'Native settings' });
                continue;
            }
            output({ type: 'agent_start' });
            output({ type: 'agent_end' });
            active = setTimeout(() => {
                active = null;
                output({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }],
                    stopReason: command.message === 'error' ? 'error' : 'stop', errorMessage: command.message === 'error' ? 'provider failed' : undefined } });
                output({ type: 'agent_settled', aborted: false });
            }, command.message === 'hang' ? 60_000 : 70);
            response(command, { disposition: 'started' });
        } else if (command.type === 'abort') {
            clearTimeout(active); active = null;
            response(command);
            output({ type: 'agent_settled', aborted: true });
        } else response(command);
    }
});
process.stdin.on('end', () => { clearTimeout(active); process.exit(0); });
