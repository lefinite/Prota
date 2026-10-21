import { getWorkspaceRoot, workspaceLocked } from './workspace.mjs';
if (workspaceLocked()) throw new Error('工作区正在切换，请等待完成。');
process.stdout.write(getWorkspaceRoot() + '\n');
