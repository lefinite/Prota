import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function runtimeInventory(directory) {
    const files = {};
    function visit(relative = '') {
        for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
            const name = relative ? `${relative}/${entry.name}` : entry.name;
            if (name === 'manifest.json') continue;
            const absolute = path.join(directory, name);
            if (entry.isDirectory()) visit(name);
            else if (entry.isSymbolicLink()) {
                const link = fs.readlinkSync(absolute);
                const target = path.relative(directory, fs.realpathSync(absolute));
                if (target.startsWith('..') || path.isAbsolute(target)) throw new Error(`Runtime link escapes package: ${name}`);
                files[name] = { link: link.replaceAll('\\', '/') };
            } else if (entry.isFile()) {
                files[name] = { sha256: createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') };
            } else throw new Error(`Unsupported runtime entry: ${name}`);
        }
    }
    visit();
    return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

export function verifyInventory(directory, manifest) {
    const actual = runtimeInventory(directory);
    if (!manifest.files || !Object.keys(manifest.files).length) throw new Error('Empty Pi runtime manifest');
    const paths = new Set([...Object.keys(actual), ...Object.keys(manifest.files)]);
    for (const name of paths) {
        if (JSON.stringify(actual[name]) !== JSON.stringify(manifest.files[name])) {
            throw new Error(`Pi runtime integrity mismatch: ${name}`);
        }
    }
}
