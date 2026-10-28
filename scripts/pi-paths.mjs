import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const piSource = path.join(productRoot, 'vendor/pi');
export const piRuntime = path.join(productRoot, 'runtime/pi');
export const piVersion = JSON.parse(readFileSync(path.join(productRoot, 'pi-version.json'), 'utf8'));
export const piPackageName = '@earendil-works/pi-coding-agent';
export const piCliRelative = `node_modules/${piPackageName}/dist/bundle/cli.js`;

export function assertNodeVersion(version = process.versions.node) {
    const [major, minor] = version.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 19)) throw new Error('Pi requires Node.js >=22.19.0');
}
