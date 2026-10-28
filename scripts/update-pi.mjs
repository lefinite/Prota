import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { productRoot, piSource, piVersion } from './pi-paths.mjs';

const repository = 'https://github.com/earendil-works/pi.git';
export function validateRelease(release) {
    if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name || '') || release.draft || release.prerelease || !release.published_at) {
        throw new Error('Only published stable Pi Releases can be selected');
    }
    return release.tag_name.slice(1);
}

export function newerVersion(candidate, current) {
    const a = candidate.split('.').map(Number), b = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
}

export async function inspectRelease({ tag, token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN } = {}) {
    if (tag && !/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('Pi tag must be a stable release such as v1.4.0');
    const url = 'https://api.github.com/repos/earendil-works/pi/releases/' + (tag ? `tags/${tag}` : 'latest');
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Cannot inspect official Pi release: HTTP ${response.status}`);
    const release = await response.json();
    const version = validateRelease(release);
    if (tag && release.tag_name !== tag) throw new Error('GitHub returned a different release tag');
    return { oldVersion: piVersion.version, oldCommit: piVersion.commit, tag: release.tag_name, version,
        available: newerVersion(version, piVersion.version), releaseUrl: release.html_url,
        releaseSummary: String(release.body || '').slice(0, 16000) };
}

export function applyRelease(release) {
    validateRelease({ tag_name: release.tag, published_at: true, draft: false, prerelease: false });
    if (!newerVersion(release.version, piVersion.version)) throw new Error('Selected release must be newer than the current pin');
    const git = args => execFileSync('git', ['-C', piSource, ...args], { encoding: 'utf8' }).trim();
    if (piVersion.repository !== repository || git(['remote', 'get-url', 'origin']) !== repository) {
        throw new Error('Pi source must use the official upstream repository');
    }
    if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD']) !== piVersion.commit) {
        throw new Error('Pi checkout must be clean and match the current version lock');
    }
    git(['fetch', '--no-tags', 'origin', 'tag', release.tag]);
    const commit = git(['rev-parse', `${release.tag}^{commit}`]);
    const original = fs.readFileSync(path.join(productRoot, 'pi-version.json'));
    try {
        git(['checkout', '--detach', commit]);
        const next = { ...piVersion, tag: release.tag, commit, version: release.version };
        fs.writeFileSync(path.join(productRoot, 'pi-version.json'), JSON.stringify(next, null, 2) + '\n');
        return { ...release, commit };
    } catch (error) {
        git(['checkout', '--detach', piVersion.commit]);
        fs.writeFileSync(path.join(productRoot, 'pi-version.json'), original);
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { check: { type: 'boolean' }, tag: { type: 'string' }, output: { type: 'string' } } });
    let release = await inspectRelease({ tag: values.tag });
    if (values.tag && !values.check) release = applyRelease(release);
    if (values.output) fs.writeFileSync(path.resolve(values.output), JSON.stringify(release, null, 2) + '\n');
    const { releaseSummary, ...metadata } = release;
    console.log(JSON.stringify(metadata, null, 2));
}
