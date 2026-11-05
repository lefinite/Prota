# pinyin-pro 3.29.5

`pinyin-match.js` bundles only the `match` export, using esbuild (ESM, minified).
The data and matcher are local so search works without a CDN or network request.
Source: https://www.npmjs.com/package/pinyin-pro/v/3.29.5
License: MIT, included in `LICENSE`.

Rebuild from the npm tarball with the repository's esbuild:

```js
import { build } from 'esbuild';
await build({
    stdin: { contents: "export { match } from '/path/to/package/dist/esm/index.mjs';" },
    bundle: true, format: 'esm', minify: true,
    outfile: 'portal/modules/page-search/vendor/pinyin-match.js',
    banner: { js: '/*! pinyin-pro 3.29.5 | MIT | https://github.com/zh-lx/pinyin-pro | See LICENSE */' }
});
```
