import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const outfile = process.argv[2];
if (!outfile) throw Error('Usage: node scripts/build-share-mcp.mjs OUTPUT');
await build({entryPoints:[fileURLToPath(new URL('../server/share_mcp.mjs', import.meta.url))], outfile,
    bundle:true, platform:'node', target:'node22', format:'esm', packages:'bundle',
    banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"},
    minify:true, legalComments:'eof'});
