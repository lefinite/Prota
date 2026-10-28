import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFiles } from '../server/preview/validator.mjs';
const files = (html, extra = {}) => new Map(Object.entries({ 'index.html': html, ...extra }).map(([name, data]) => [name, Buffer.from(data)]));
test('accepts tolerant HTML and remote resources without execution', async () => {
    await validateFiles(files('<h1>Hello</h1><img src="https://example.invalid/test.png"><script>throw new Error("never executed")</script>'));
});
test('holds empty entry, missing dependencies, incomplete JS and path escapes', async () => {
    for (const input of [files(''), files('<script src="app.js"></script>'), files('<h1>Hi</h1><script>function (</script>'), files('<img src="../private.png">'), files('<img src="/assets/x.png">'), files('<link href="a.css">', { 'a.css': 'body { background:url(missing.png) }' })]) await assert.rejects(validateFiles(input));
    await assert.rejects(validateFiles(files('<h1>Hi</h1>', { 'app.js': 'const x = ;' })));
    await validateFiles(files('<h1>Hi</h1><script src="app.js"></script>', { 'app.js': 'import "./other.js"', 'other.js': 'export const x = 1' }));
});
