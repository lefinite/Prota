import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const productRoot = fileURLToPath(new URL('..', import.meta.url));
const execute = promisify(execFile);

// Python and Node serialize against the same durable coordinator lock.
export async function userEditBoundary(action, root, lease, pid = process.pid) {
    const { stdout } = await execute(process.env.PYTHON || 'python3',
        ['-m', 'server.user_edit_reconcile', action, '--root', root, '--lease', lease, '--pid', String(pid)],
        { cwd: productRoot, maxBuffer: 1024 * 1024, timeout: 60000 });
    return JSON.parse(stdout);
}
