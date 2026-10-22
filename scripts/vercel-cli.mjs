#!/usr/bin/env node
// All login, setup and publishing commands use the same product dependency.
import { spawn } from 'node:child_process';
import { resolveVercelCLI } from '../server/vercel-cli.mjs';

try {
    const entry = resolveVercelCLI();
    const args = process.argv.slice(2);
    if (!(args.length === 1 && args[0] === '--prota-check')) {
        const child = spawn(process.execPath, [entry, ...args], { stdio: 'inherit' });
        for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
        child.on('error', error => { console.error(error.message); process.exitCode = 1; });
        child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
