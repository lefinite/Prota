// Dependency-free extraction for the managed Windows Python runtime. Windows tar
// implementations can lose non-ASCII path arguments; Node uses Unicode paths.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

function field(header, start, length) {
    return header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
}
function number(header, start, length) {
    const value = field(header, start, length).trim();
    if (!/^[0-7]*$/.test(value)) throw Error('Invalid runtime archive numeric field');
    return value ? parseInt(value, 8) : 0;
}
function paxFields(buffer) {
    const fields = {};
    for (let offset = 0; offset < buffer.length;) {
        const space = buffer.indexOf(32, offset);
        if (space < 0) throw Error('Invalid runtime archive metadata');
        const length = Number(buffer.subarray(offset, space).toString('ascii'));
        if (!Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > buffer.length) throw Error('Invalid runtime archive metadata');
        const line = buffer.subarray(space + 1, offset + length - 1).toString('utf8');
        const equal = line.indexOf('=');
        if (equal > 0) fields[line.slice(0, equal)] = line.slice(equal + 1);
        offset += length;
    }
    return fields;
}
export function extractRuntime(archive, destination) {
    const data = gunzipSync(fs.readFileSync(archive), { maxOutputLength: 512 * 1024 * 1024 });
    const root = path.resolve(destination);
    let metadata = {}, longName;
    for (let offset = 0; offset + 512 <= data.length;) {
        const header = data.subarray(offset, offset + 512);
        if (header.every(byte => byte === 0)) return;
        let checksum = 0;
        for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
        if (number(header, 148, 8) !== checksum) throw Error('Invalid runtime archive checksum');
        const size = number(header, 124, 12);
        const start = offset + 512;
        if (start + size > data.length) throw Error('Truncated runtime archive');
        const body = data.subarray(start, start + size);
        const type = field(header, 156, 1);
        offset = start + Math.ceil(size / 512) * 512;
        if (type === 'x') { metadata = paxFields(body); continue; }
        if (type === 'g') { if (paxFields(body).path) throw Error('Unsupported global archive path'); continue; }
        if (type === 'L') { longName = body.toString('utf8').replace(/\0.*$/s, ''); continue; }
        const name = metadata.path || longName || [field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join('/');
        metadata = {}; longName = undefined;
        if (!name || name.includes('\\') || name.includes('\0') || /^(?:\/|[A-Za-z]:)/.test(name) || name.split('/').includes('..')) throw Error('Unsafe runtime archive path');
        const target = path.resolve(root, name);
        if (target !== root && !target.startsWith(root + path.sep)) throw Error('Unsafe runtime archive path');
        if (type === '5') { fs.mkdirSync(target, { recursive: true }); continue; }
        // Standalone Windows runtimes contain regular files and directories.
        // Reject links and special files rather than following them outside staging.
        if (type && type !== '0') throw Error('Unsupported runtime archive entry');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body, { flag: 'wx' });
    }
    throw Error('Truncated runtime archive');
}
