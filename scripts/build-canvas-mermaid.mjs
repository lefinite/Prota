import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({stdin:{contents:"export {renderMermaidSvg} from './portal/modules/prd/mermaid-preview.js';",resolveDir:root,sourcefile:'canvas-mermaid-entry.js'},bundle:true,format:'iife',globalName:'ProtaCanvasMermaid',platform:'browser',minify:true,legalComments:'inline',outfile:path.join(root,'src/templates/infinite-canvas/canvas-mermaid.js'),banner:{js:'/* Generated from the PRD Mermaid rendering pipeline. Rebuild: node scripts/build-canvas-mermaid.mjs. Mermaid 11.12.0 (MIT); bundled notices retained. */'}});
