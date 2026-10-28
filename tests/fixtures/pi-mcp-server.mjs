import readline from 'node:readline';
const input = readline.createInterface({ input: process.stdin });
for await (const line of input) {
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    let result;
    if (message.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'prota-test', version: '1' } };
    else if (message.method === 'tools/list') result = { tools: [{ name: 'echo', description: 'Return supplied text', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] };
    else if (message.method === 'tools/call') result = { content: [{ type: 'text', text: `${message.params.arguments.text}:${process.env.FIXTURE_TOKEN === 'explicit-fixture-token' ? 'credential-ok' : 'credential-missing'}` }] };
    else if (message.method === 'ping') result = {};
    else { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }) + '\n'); continue; }
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
}
