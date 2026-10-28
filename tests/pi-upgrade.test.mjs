import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease, newerVersion } from '../scripts/update-pi.mjs';

test('Pi release selection rejects main, draft, prerelease and unpublished tags', () => {
    for (const release of [
        { tag_name: 'main', published_at: true },
        { tag_name: 'v1.5.0-beta.1', published_at: true },
        { tag_name: 'v1.5.0', published_at: true, draft: true },
        { tag_name: 'v1.5.0', published_at: true, prerelease: true },
        { tag_name: 'v1.5.0' }
    ]) assert.throws(() => validateRelease(release), /published stable/);
    assert.equal(validateRelease({ tag_name: 'v1.5.0', published_at: true }), '1.5.0');
});

test('upstream comparison is numeric and never automatically selects equal or older releases', () => {
    assert.equal(newerVersion('1.10.0', '1.9.0'), true);
    assert.equal(newerVersion('2.0.0', '1.9.99'), true);
    assert.equal(newerVersion('1.4.0', '1.4.0'), false);
    assert.equal(newerVersion('1.3.99', '1.4.0'), false);
});
