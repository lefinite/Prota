import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Both Gateway health and the desktop launcher must use exactly the same inputs.
// Relative names make the fingerprint stable when a release is moved or exported.
export function agentBuild(directory) {
    const files = new Set(['pi-version.json', 'runtime/pi/manifest.json',
        'scripts/pi-paths.mjs', 'scripts/pi-integrity.mjs', 'scripts/verify-pi.mjs']);
    function collect(relative) {
        for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
            const name = `${relative}/${entry.name}`;
            if (entry.isDirectory()) collect(name);
            else if (entry.isFile() && /\.(?:mjs|js|ts)$/.test(entry.name)) files.add(name);
        }
    }
    collect('server');
    collect('integrations/pi');
    const hash = createHash('sha256');
    for (const name of [...files].sort()) {
        hash.update(name + '\0');
        if (fs.existsSync(path.join(directory, name))) hash.update(fs.readFileSync(path.join(directory, name)));
        else hash.update('[missing]');
        hash.update('\0');
    }
    return hash.digest('hex');
}
