/**
 * MindMap editor-app — runs INSIDE the editor.html iframe.
 *
 * Imports the prebuilt LOCAL bundle (vendor/mindmap-react.bundle.mjs) which
 * contains React + ReactDOM + @xiangfa/mindmap (Prota-patched) — no runtime
 * CDN. Mounts the interactive MindMap component so the user edits directly on
 * the canvas.
 *
 * XMind-style keyboard adapter + auto-focus:
 *   - Enter = add sibling, Tab = add child (the library defaults Enter to
 *     "child", so we capture keydown and rewrite both via getData/setData).
 *   - After creating a node we call ref.startEdit(newId) (a Prota-added ref
 *     method backed by the library's setPendingEditId) so the new node's text
 *     input is focused immediately — the user can type right away, no manual
 *     double-click needed.
 *   - defaultDirection is "right" (all children on the right); the parent can
 *     switch to "both" (balanced left/right) via a `direction` message.
 */

import {
    React,
    createRoot,
    MindMap,
    MindMapTextEditor,
    allPlugins,
    toMarkdownMultiRoot
} from './vendor/mindmap-react.bundle.mjs?v=20260701-xmind-v8';

const { useState, useRef, useEffect, useCallback } = React;

const post = (message) => {
    window.parent.postMessage(JSON.stringify(message), window.location.origin);
};

const parseMessage = (event) => {
    if (event.origin !== window.location.origin) return null;
    try {
        return typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
        return null;
    }
};

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Insert a new sibling right after the node `id` (works across multi-root trees).
const insertAfterSibling = (roots, id, node) => {
    const rootIdx = roots.findIndex((r) => r.id === id);
    if (rootIdx >= 0) {
        const next = roots.slice();
        next.splice(rootIdx + 1, 0, node);
        return next;
    }
    const walk = (item) => {
        if (!item.children) return item;
        const idx = item.children.findIndex((c) => c.id === id);
        if (idx >= 0) {
            const children = item.children.slice();
            children.splice(idx + 1, 0, node);
            return { ...item, children };
        }
        return { ...item, children: item.children.map(walk) };
    };
    return roots.map(walk);
};

// Append a new child to the node `id`.
const appendChild = (roots, id, node) => {
    const walk = (item) => {
        if (item.id === id) return { ...item, children: [...(item.children || []), node] };
        return item.children ? { ...item, children: item.children.map(walk) } : item;
    };
    return roots.map(walk);
};

// Locate a node's position in a multi-root tree (for arrow-key navigation).
const locateNode = (nodes, id, parent) => {
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx >= 0) return { parent, siblings: nodes, index: idx, node: nodes[idx] };
    for (const n of nodes) {
        if (n.children) {
            const found = locateNode(n.children, id, n);
            if (found) return found;
        }
    }
    return null;
};

// XMind-style arrow navigation: Left = parent, Right = first child,
// Up = previous sibling, Down = next sibling. Returns the target id or null.
const navigateNode = (roots, id, dir) => {
    const loc = locateNode(roots, id, null);
    if (!loc) return null;
    const { parent, siblings, index, node } = loc;
    if (dir === 'left') return parent ? parent.id : null;
    if (dir === 'right') return (node.children && node.children[0]) ? node.children[0].id : null;
    if (dir === 'up') return index > 0 ? siblings[index - 1].id : null;
    if (dir === 'down') return index < siblings.length - 1 ? siblings[index + 1].id : null;
    return null;
};

const ARROW_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function EditorApp() {
    const [markdown, setMarkdown] = useState('');
    const [ready, setReady] = useState(false);
    const ref = useRef(null);
    const selectedRef = useRef(null);
    const debounceRef = useRef(null);
    const latestMarkdownRef = useRef('');

    const emit = useCallback((data, immediate = false) => {
        let md = '';
        try {
            md = Array.isArray(data) ? toMarkdownMultiRoot(data) : '';
        } catch {
            md = '';
        }
        latestMarkdownRef.current = md;
        const flush = () => post({ event: 'datachange', markdown: latestMarkdownRef.current });
        window.clearTimeout(debounceRef.current);
        if (immediate) {
            flush();
        } else {
            debounceRef.current = window.setTimeout(flush, 300);
        }
    }, []);

    // Select + start editing a freshly created node so the next Enter chains
    // after it (XMind behavior). setData updates the tree synchronously but
    // the library recomputes its nodeMap on the next React commit, so we wait
    // two frames + a short timeout before selectNode/startEdit.
    const activateNewNode = useCallback((nodeId) => {
        const activate = () => {
            ref.current?.selectNode?.(nodeId);
            ref.current?.startEdit?.(nodeId);
        };
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            window.setTimeout(activate, 30);
        }));
    }, []);

    // postMessage protocol with the parent controller.
    useEffect(() => {
        const handler = (event) => {
            const msg = parseMessage(event);
            if (!msg) return;
            if (msg.action === 'load') {
                latestMarkdownRef.current = msg.markdown || '';
                setMarkdown(msg.markdown || '');
                setReady(true);
                window.requestAnimationFrame(() => post({ event: 'loaded' }));
            } else if (msg.action === 'flush') {
                // Force-commit any in-progress node edit BEFORE serializing.
                // While the user is typing, the text lives only in the editor's
                // `editText` state — it is NOT yet in the data tree, so
                // getData()/onDataChange skip it until the library runs
                // commitEdit (triggered by input blur / Enter). Blurring the
                // focused input forces that commit; we then wait one render
                // cycle so onDataChange has updated latestMarkdownRef, and
                // re-read getData() once more to be safe before posting.
                //
                // The parent sends a monotonic token; we echo it back so it can
                // tell THIS flush response apart from a stale debounced post.
                window.clearTimeout(debounceRef.current);
                const token = msg.token;
                const postLatest = () => {
                    let md = latestMarkdownRef.current;
                    try {
                        const data = ref.current?.getData?.();
                        if (Array.isArray(data) && data.length) {
                            md = toMarkdownMultiRoot(data) || md;
                        }
                    } catch { /* keep latestMarkdownRef value */ }
                    latestMarkdownRef.current = md;
                    post({ event: 'datachange', markdown: md, flushToken: token });
                };
                const active = document.activeElement;
                if (active && active.tagName === 'INPUT') {
                    active.blur();
                    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
                        window.setTimeout(postLatest, 30);
                    }));
                } else {
                    postLatest();
                }
            } else if (msg.action === 'direction') {
                ref.current?.setDirection?.(msg.dir);
            }
        };
        window.addEventListener('message', handler);
        post({ event: 'prota-ready' });
        return () => {
            window.removeEventListener('message', handler);
            window.clearTimeout(debounceRef.current);
        };
    }, []);

    // Last-resort safety net: if the iframe is torn down (drawer closed, page
    // navigated) while a debounced save is pending, flush the latest committed
    // markdown synchronously so the parent still receives it.
    useEffect(() => {
        const onBeforeUnload = () => {
            window.clearTimeout(debounceRef.current);
            post({ event: 'datachange', markdown: latestMarkdownRef.current });
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        window.addEventListener('pagehide', onBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('pagehide', onBeforeUnload);
        };
    }, []);

    // XMind-style keyboard adapter (capture phase, before the component).
    useEffect(() => {
        if (!ready) return;
        const onKey = (event) => {
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            const id = selectedRef.current;
            if (!id || event.ctrlKey || event.metaKey || event.altKey) return;

            const arrowDir = ARROW_KEYS[event.key];
            if (arrowDir) {
                // Arrow keys move the selection between nodes (XMind-style):
                // Left = parent, Right = first child, Up/Down = siblings.
                event.preventDefault();
                event.stopPropagation();
                const data = ref.current?.getData() || [];
                const targetId = navigateNode(data, id, arrowDir);
                if (targetId) {
                    ref.current?.selectNode?.(targetId);
                    selectedRef.current = targetId;
                }
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                const data = ref.current?.getData() || [];
                const node = { id: genId(), text: '' };
                const next = insertAfterSibling(data, id, node);
                ref.current?.setData(next);
                selectedRef.current = node.id;
                activateNewNode(node.id);
                emit(next, false);
            } else if (event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                const data = ref.current?.getData() || [];
                const node = { id: genId(), text: '' };
                const next = appendChild(data, id, node);
                ref.current?.setData(next);
                selectedRef.current = node.id;
                activateNewNode(node.id);
                emit(next, false);
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [ready, emit, activateNewNode]);

    const handleEvent = useCallback((evt) => {
        if (evt?.type === 'nodeSelect') selectedRef.current = evt.nodeId ?? null;
    }, []);

    const handleDataChange = useCallback((data) => emit(data, false), [emit]);

    if (!ready) return null;

    return React.createElement(MindMap, {
        ref,
        markdown,
        defaultDirection: 'right',
        theme: 'light',
        locale: 'zh-CN',
        toolbar: { zoom: true },
        textEditor: MindMapTextEditor,
        plugins: allPlugins,
        onEvent: handleEvent,
        onDataChange: handleDataChange
    });
}

createRoot(document.getElementById('root')).render(React.createElement(EditorApp));
