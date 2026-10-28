import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { productRoot, piSource, piRuntime, piVersion, piPackageName, assertNodeVersion } from './pi-paths.mjs';
import { runtimeInventory } from './pi-integrity.mjs';
import { verifyPi } from './verify-pi.mjs';

assertNodeVersion();
function git(args) {
    return execFileSync('git', ['-C', piSource, ...args], { encoding: 'utf8' }).trim();
}
if (piVersion.repository !== 'https://github.com/earendil-works/pi.git'
    || git(['remote', 'get-url', 'origin']) !== piVersion.repository) {
    throw new Error('Pi source must reference the official upstream repository');
}
if (git(['rev-parse', 'HEAD']) !== piVersion.commit
    || git(['rev-parse', `${piVersion.tag}^{commit}`]) !== piVersion.commit) {
    throw new Error('Pi submodule must match the release tag and commit in pi-version.json');
}
if (git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Pi upstream source has local modifications');
function npm(args, cwd = piSource) {
    const npmCli = process.env.npm_execpath;
    if (process.platform === 'win32' && !npmCli) throw new Error('Run this script with npm run pi:build on Windows');
    execFileSync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args,
        { cwd, stdio: 'inherit', env: { ...process.env, HUSKY: '0' } });
}

npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
// Use the immutable model catalog pinned by upstream's release, rather than
// regenerating model metadata from mutable vendor endpoints during a build.
const { revision } = JSON.parse(fs.readFileSync(path.join(piSource, 'nix/model-catalog.json'), 'utf8'));
if (!/^sha256-[a-f0-9]{64}$/.test(revision)) throw new Error('Invalid upstream model catalog pin');
const response = await fetch(`https://pi.dev/api/models/revisions/${revision}?types=chat,image,classifier`,
    { signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error(`Cannot fetch pinned Pi catalog: HTTP ${response.status}`);
const catalog = Buffer.from(await response.arrayBuffer());
if (`sha256-${createHash('sha256').update(catalog).digest('hex')}` !== revision) throw new Error('Pi model catalog hash mismatch');
const { hydrateModelCatalogBytes } = await import(pathToFileURL(path.join(piSource, 'scripts/update-model-catalog-pin.mjs')));
hydrateModelCatalogBytes(piSource, catalog);
npm(['run', 'build:offline']);

const staging = `${piRuntime}.staging`;
const previous = `${piRuntime}.previous`;
fs.mkdirSync(path.dirname(piRuntime), { recursive: true });
fs.rmSync(staging, { recursive: true, force: true });
const artifactsDir = path.join(productRoot, 'runtime/pi-artifacts');
const { produceArtifactSet } = await import(pathToFileURL(path.join(piSource, 'scripts/package-artifacts.mjs')));
const { installConsumer } = await import(pathToFileURL(path.join(piSource, 'scripts/local-package-install.mjs')));
const artifactSet = produceArtifactSet({ repoRoot: piSource, outDir: artifactsDir, build: false, force: true });
installConsumer({ artifactSet, directory: staging, packageNames: [piPackageName] });
const { build } = await import(pathToFileURL(path.join(piSource, 'node_modules/esbuild/lib/main.js')));
const extensionBuild = await build({ entryPoints: [path.join(productRoot, 'integrations/pi/prota-extension.ts')],
    outfile: path.join(staging, 'extensions/prota-extension.mjs'), bundle: true,
    platform: 'node', format: 'esm', target: 'node22.19',
    nodePaths: [path.join(piSource, 'node_modules')], logLevel: 'warning', metafile: true });
const extensionSources = {};
for (const input of Object.keys(extensionBuild.metafile.inputs).sort()) {
    const absolute = path.resolve(input);
    const relative = path.relative(productRoot, absolute).replaceAll('\\', '/');
    if (relative.startsWith('../') || relative.startsWith('vendor/') || relative.split('/').includes('node_modules')) continue;
    extensionSources[relative] = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
}
fs.copyFileSync(path.join(piSource, 'LICENSE'), path.join(staging, 'LICENSE.pi'));
const manifest = { schemaVersion: 1, ...piVersion, platform: process.platform, arch: process.arch,
    modelCatalogRevision: revision, extension: { protocolVersion: 1, sources: extensionSources }, files: runtimeInventory(staging) };
fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await verifyPi(staging);
// The known-good runtime remains available until the replacement passed smoke.
fs.rmSync(previous, { recursive: true, force: true });
if (fs.existsSync(piRuntime)) fs.renameSync(piRuntime, previous);
try { fs.renameSync(staging, piRuntime); }
catch (error) {
    if (fs.existsSync(previous)) fs.renameSync(previous, piRuntime);
    throw error;
}
fs.rmSync(previous, { recursive: true, force: true });
console.log(`Built and verified Pi ${piVersion.version} from ${piVersion.commit}`);
