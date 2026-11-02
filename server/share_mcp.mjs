/** Read-only SDK server. The caller supplies one authenticated published policy. */
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { z } from 'zod';
import { readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, sep, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const MAX_OUTPUT = 192 * 1024;
const MAX_IMAGE = 2 * 1024 * 1024;
const id = z.string().min(1).max(2048);
const pageInput = z.object({pageId:id}).strict();
const pagination = {cursor:z.string().regex(/^\d{1,9}$/).optional(), limit:z.number().int().min(1).max(100).default(30)};
const text = value => {
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded) > MAX_OUTPUT) throw Error('Result too large; read the indexed context resource in segments.');
    return {content:[{type:'text', text:encoded}]};
};
const paginate = (items, {cursor, limit}) => {
    const offset = Number(cursor || 0), end = offset + limit;
    return {items:items.slice(offset, end), nextCursor:end < items.length ? String(end) : null};
};

async function closedFile(root, relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some(p => !p || p.startsWith('.')) || relative.startsWith('/')) throw Error('Resource unavailable.');
    const base = await realpath(root), file = resolve(base, relative);
    if (!file.startsWith(base + sep)) throw Error('Resource unavailable.');
    let current = base;
    for (const part of relative.split('/')) {
        current = resolve(current, part);
        if ((await lstat(current)).isSymbolicLink()) throw Error('Resource unavailable.');
    }
    if (!(await realpath(file)).startsWith(base + sep)) throw Error('Resource unavailable.');
    return file;
}

export async function serveMcp(req, res, policy, contentRoot, privateRoot = resolve(dirname(contentRoot), 'mcp-context')) {
    const manifestPath = await closedFile(privateRoot, policy.mcpSnapshot + '/manifest.json');
    if ((await lstat(manifestPath)).size > 8 * 1024 * 1024) throw Error('Context index too large.');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const page = pageId => {
        const result = manifest.pages.find(p => p.pageId === pageId);
        if (!result) throw Error('Page unavailable in this share.');
        return result;
    };
    const resource = resourceId => {
        if (!Object.hasOwn(manifest.resources, resourceId)) throw Error('Resource unavailable in this share.');
        return manifest.resources[resourceId];
    };
    const metadata = (resourceId, r) => ({resourceId, pageId:r.pageId, kind:r.kind, mimeType:r.mimeType, size:r.size, sha256:r.sha256, text:r.text});
    const bytes = async r => {
        const file = await closedFile(r.source === 'content' ? contentRoot : privateRoot, r.relativePath);
        const stat = await lstat(file);
        if (stat.size !== r.size || stat.size > 32 * 1024 * 1024) throw Error('Resource integrity check failed.');
        const data = await readFile(file);
        if (createHash('sha256').update(data).digest('hex') !== r.sha256) throw Error('Resource integrity check failed.');
        return data;
    };
    const server = new McpServer({name:'prota-share', version:'1.0.0'}, {instructions:'Read-only frozen share. Start with get_overview, list_pages, get_page_context, then read_resource/get_visual. Prototype code describes implementation; inferred interactions are not formal requirements.'});
    const tool = (name, description, schema, callback) => server.registerTool(name,
        {description, inputSchema:schema, annotations:{readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false}},
        async args => {
            try { return await callback(args); }
            catch { return {isError:true, content:[{type:'text', text:'Requested content is unavailable, invalid, too large, or outside this share. Use list_resources and bounded pagination.'}]}; }
        });
    tool('get_overview', 'Overview and reading order for this immutable share.', z.object({}).strict(), () => text({
        project:manifest.project, shareType:manifest.shareType, generatedAt:manifest.generatedAt, snapshotId:manifest.snapshotId,
        versionLocked:true, pageCount:manifest.pages.length, resourceCount:Object.keys(manifest.resources).length,
        missing:manifest.missing, externalDependencies:manifest.externalDependencies,
        readingOrder:['list_pages','get_page_context','list_resources','read_resource','get_visual']}));
    tool('list_pages', 'Pages with selected versions, hierarchy and board counts.', z.object(pagination).strict(), args => text({
        ...paginate(manifest.pages.map(p => ({pageId:p.pageId,name:p.name,version:p.version,targetDevice:p.targetDevice,
            parentId:p.parentId,order:p.order,boardCount:p.boards.length})), args), folders:manifest.folders}));
    tool('get_page_context', 'Documents, entry point, annotations, canvas nodes/edges and exact board revision mapping.', pageInput,
        ({pageId}) => {
            const p = page(pageId);
            if (Buffer.byteLength(JSON.stringify(p)) <= MAX_OUTPUT) return text(p);
            return text({pageId,version:p.version,entryResourceId:p.entryResourceId,contextResourceId:p.contextResourceId,
                contextAvailable:true,reason:'Large structured context: read contextResourceId in segments.'});
        });
    tool('list_resources', 'Only resource IDs authorized in this share; binary files are described, not read as text.',
        z.object({...pagination,pageId:id.optional(),kind:id.optional()}).strict(), args => {
            if (args.pageId) page(args.pageId);
            return text(paginate(Object.entries(manifest.resources).filter(([,r]) => (!args.pageId || args.pageId === r.pageId) && (!args.kind || args.kind === r.kind))
                .map(([rid,r]) => metadata(rid,r)), args));
        });
    tool('read_resource', 'UTF-8 text by line. For long individual lines use returned nextColumn with startColumn.',
        z.object({resourceId:id, startLine:z.number().int().min(1).default(1), maxLines:z.number().int().min(1).max(500).default(100),
            startColumn:z.number().int().min(0).default(0)}).strict(), async ({resourceId,startLine,maxLines,startColumn}) => {
            const r = resource(resourceId);
            if (!r.text) return text({...metadata(resourceId,r), reason:'Binary resource; use get_visual for supported images.'});
            const lines = (await bytes(r)).toString('utf8').split('\n');
            let line = startLine - 1, column = startColumn, output = '', count = 0;
            if (line >= lines.length) return text({resourceId,text:'',nextLine:null,eof:true});
            if (column > lines[line].length || (column && /[\uDC00-\uDFFF]/.test(lines[line][column] || ''))) throw Error('Invalid text boundary.');
            while (line < lines.length && count < maxLines && output.length < 32000) {
                const available = 32000 - output.length;
                let end = Math.min(lines[line].length, column + available);
                if (end < lines[line].length && /[\uDC00-\uDFFF]/.test(lines[line][end])) end--;
                output += lines[line].slice(column, end);
                if (end < lines[line].length) { column = end; break; }
                line++; column = 0; count++;
                if (line < lines.length) output += '\n';
            }
            return text({...metadata(resourceId,r),startLine,text:output,nextLine:line < lines.length ? line + 1 : null,
                nextColumn:column,eof:line >= lines.length});
        });
    tool('get_visual', 'Actual indexed images or honest screenshot availability. boardId accepts an instance ID, or an unambiguous business board ID.',
        z.object({pageId:id,boardId:id.optional(),visualId:id.optional()}).strict(), async ({pageId,boardId,visualId}) => {
            const p = page(pageId);
            const matches = boardId ? p.boards.filter(b => b.boardId === boardId) : [];
            const instance = boardId ? p.boards.find(b => b.instanceId === boardId) : null;
            if (!instance && matches.length > 1) return text({pageId,visualAvailable:false,reason:'Multiple instances: pass an instanceId as boardId.',instances:matches.map(b=>({instanceId:b.instanceId,boardVersionId:b.boardVersionId,boardRevisionId:b.boardRevisionId}))});
            const board = instance || matches[0];
            if (boardId && !board) throw Error('Board unavailable.');
            if (!visualId) return text({pageId,visualAvailable:false,reason:p.visualMissingReason,entryResourceId:board?.entryResourceId || p.entryResourceId});
            const r = resource(visualId);
            if (r.pageId !== pageId || (board && !board.resourceIds.includes(visualId)) || !['image/png','image/jpeg','image/webp','image/gif'].includes(r.mimeType) || r.size > MAX_IMAGE) throw Error('Image unavailable.');
            return {content:[{type:'text',text:JSON.stringify({resourceId:visualId,sourceKind:'published-image-asset',isPageScreenshot:false})},
                {type:'image',mimeType:r.mimeType,data:(await bytes(r)).toString('base64')}]};
        });
    const handler = createMcpHandler(() => server, {legacy:'stateless', maxRequestBodySize:262144});
    let closed = false;
    const close = () => { if (!closed) {closed = true; void handler.close().catch(() => {});} };
    res.on('close', close);
    try {
        // Never give the SDK the capability URL: protocol diagnostics must not echo it.
        req.url = '/mcp';
        await toNodeHandler({fetch:async (...args) => {
            const response = await handler.fetch(...args);
            response.headers.set('Cache-Control', 'private, no-store');
            response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
            response.headers.set('X-Content-Type-Options', 'nosniff');
            return response;
        }}, {maxRequestBodySize:262144})(req, res, req.body);
    } finally { close(); }
}
