#!/usr/bin/env node
// All login, setup and publishing commands use the same product dependency.
import { spawnSync } from 'node:child_process';
import { resolveVercelCLI } from '../server/vercel-cli.mjs';

try {
    const entry = resolveVercelCLI();
    const args = process.argv.slice(2);
    if (!(args.length === 1 && args[0] === '--prota-check')) {
        const result = spawnSync(process.execPath, [entry, ...args], { stdio: 'inherit' });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
