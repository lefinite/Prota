/**
 * Readify PRD Module - UI Renderer & Markdown Compiler
 * Compiles markdown content to HTML, renders editor layout, and manages TOC大纲目录
 */

import { mountMermaidDiagrams } from './mermaid-preview.js?v=20261013-auto-polish-v1';

export class PRDRenderer {
    /**
     * @param {PRDManager} manager - The state manager instance
     */
    constructor(manager) {
        this.manager = manager;
        this._lastPrdHeadingsHash = null;
        this._tocCleanup = null;
    }

    /**
     * Helper to safely escape HTML characters
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getLocalStorageItem(key, fallback = '') {
        try {
            return window.localStorage.getItem(key) ?? fallback;
        } catch {
            return fallback;
        }
    }

    setLocalStorageItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // TOC pinning is a best-effort preference; ignore quota failures.
        }
    }

    /**
    /**
     * Resolves local/relative paths in Markdown documents.
     */
    resolveMarkdownUrl(rawUrl = '') {
        const url = String(rawUrl || '')
            .trim()
            .replace(/^&lt;|&gt;$/g, '')
            .replace(/^<|>$/g, '');
        if (!url || /^(javascript|vbscript):/i.test(url)) return '#';
        if (/^(https?:|data:image\/|blob:|mailto:|tel:|#|\/)/i.test(url)) return url;

        const basePath = this.manager.state.path || '';
        const baseDir = basePath.split('/').slice(0, -1).join('/');
        const joined = `${baseDir}/${url}`;
        const parts = [];
        joined.split('/').forEach((part) => {
            if (!part || part === '.') return;
            if (part === '..') {
                parts.pop();
                return;
            }
            parts.push(part);
        });
        return '/' + parts.join('/');
    }

    /**
     * Inline formatting: strong, italic, code, links, del, and image resolution
     */
    formatMarkdownInline(text = '') {
        let html = this.escapeHtml(text);
        const codeSpans = [];
        html = html.replace(/`([^`]+)`/g, (_, code) => {
            const index = codeSpans.push(`<code>${code}</code>`) - 1;
            return `@@READIFY_CODE_${index}@@`;
        });
        html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_, alt, url) => {
            const src = this.resolveMarkdownUrl(url);
            return `<img class="prd-document__image" src="${this.escapeHtml(src)}" alt="${alt}">`;
        });
        html = html.replace(/(^|[^!])\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_, prefix, label, url) => {
            const href = this.resolveMarkdownUrl(url);
            return `${prefix}<a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        });
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        html = html.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
        html = html.replace(/@@READIFY_CODE_(\d+)@@/g, (_, index) => codeSpans[Number(index)] || '');
        return html;
    }

    /** Updates one Markdown task marker without changing the rest of the line. */
    setMarkdownTaskChecked(markdown, lineIndex, checked) {
        const source = String(markdown || '');
        const lines = source.replace(/\r\n?/g, '\n').split('\n');
        if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) return source;
        const taskPattern = /^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;
        if (!taskPattern.test(lines[lineIndex])) return source;
        lines[lineIndex] = lines[lineIndex].replace(taskPattern, `$1${checked ? 'x' : ' '}$3`);
        return lines.join('\n');
    }

    /**
     * Check if a raw markdown line is a table row
     */
    isMarkdownTableRow(line = '') {
        const trimmed = String(line || '').trim();
        return trimmed.includes('|') && trimmed.replace(/\|/g, '').trim().length > 0;
    }

    /**
     * Check if a raw markdown line is a table divider (|---|---|)
     */
    isMarkdownTableDivider(line = '') {
        return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''));
    }

    /**
     * Parse a markdown table row into cells
     */
    parseMarkdownTableRow(line = '') {
        return String(line || '')
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());
    }

    /**
     * Renders a Markdown table into standard HTML table wraps
     */
    renderMarkdownTable(headers = [], rows = [[]], lineIndex = 0) {
        const head = headers.map((cell) => `<th>${this.formatMarkdownInline(cell)}</th>`).join('');
        const body = rows.map((row) => `
            <tr>${headers.map((_, index) => `<td>${this.formatMarkdownInline(row[index] || '')}</td>`).join('')}</tr>
        `).join('');
        return `<div class="prd-table-wrap" data-line="${lineIndex}"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    /**
     * Main Core: Parser loop that compiles markdown text to HTML
     */
    /**
     * Highlights code block using simple regex tokenization rules matching Dracula theme
     */
    highlightCode(code, lang) {
        let html = this.escapeHtml(code);
        
        // 1. Extract Comments to prevent matching inside them
        const comments = [];
        html = html.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, (match) => {
            const id = `@@COMMENT_${comments.length}@@`;
            comments.push(match);
            return id;
        });

        // 2. Extract Strings
        const strings = [];
        html = html.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => {
            const id = `@@STRING_${strings.length}@@`;
            strings.push(match);
            return id;
        });

        // 3. Match Keywords and replace with placeholders
        const keywordsList = [
            'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
            'switch', 'case', 'break', 'continue', 'default', 'class', 'export', 'import',
            'from', 'extends', 'new', 'this', 'typeof', 'instanceof', 'in', 'of', 'try',
            'catch', 'finally', 'throw', 'async', 'await', 'def', 'elif', 'print', 'as',
            'self', 'and', 'or', 'not', 'is', 'lambda', 'pass', 'except', 'raise', 'with'
        ];
        const keywordsRegex = new RegExp(`\\b(${keywordsList.join('|')})\\b`, 'g');
        const keywords = [];
        html = html.replace(keywordsRegex, (match) => {
            const id = `@@KEYWORD_${keywords.length}@@`;
            keywords.push(match);
            return id;
        });

        // 4. Match Booleans and Constants
        const constantsList = ['true', 'false', 'null', 'undefined', 'None'];
        const constantsRegex = new RegExp(`\\b(${constantsList.join('|')})\\b`, 'g');
        const constants = [];
        html = html.replace(constantsRegex, (match) => {
            const id = `@@CONSTANT_${constants.length}@@`;
            constants.push(match);
            return id;
        });

        // 5. Match Numbers
        const numbers = [];
        html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, (match) => {
            const id = `@@NUMBER_${numbers.length}@@`;
            numbers.push(match);
            return id;
        });

        // 6. Match Functions (word followed by optional spaces and '(')
        const functions = [];
        html = html.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, (match) => {
            const id = `@@FUNCTION_${functions.length}@@`;
            functions.push(match);
            return id;
        });

        // Restore everything with appropriate token class wraps
        html = html.replace(/@@FUNCTION_(\d+)@@/g, (_, idx) => {
            return `<span class="token function">${functions[Number(idx)]}</span>`;
        });

        html = html.replace(/@@NUMBER_(\d+)@@/g, (_, idx) => {
            return `<span class="token number">${numbers[Number(idx)]}</span>`;
        });

        html = html.replace(/@@CONSTANT_(\d+)@@/g, (_, idx) => {
            return `<span class="token boolean">${constants[Number(idx)]}</span>`;
        });

        html = html.replace(/@@KEYWORD_(\d+)@@/g, (_, idx) => {
            return `<span class="token keyword">${keywords[Number(idx)]}</span>`;
        });

        html = html.replace(/@@STRING_(\d+)@@/g, (_, idx) => {
            return `<span class="token string">${strings[Number(idx)]}</span>`;
        });

        html = html.replace(/@@COMMENT_(\d+)@@/g, (_, idx) => {
            return `<span class="token comment">${comments[Number(idx)]}</span>`;
        });

        return html;
    }

    /**
     * Main Core: Parser loop that compiles markdown text to HTML
     */
    renderMarkdownDocument(markdown) {
        const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        const html = [];
        let paragraph = [];
        let paragraphStartLine = -1;
        let listStack = [];
        let listOpenItem = false;
        let codeLines = null;
        let codeStartLine = -1;
        let codeLanguage = '';
        let headingCount = 0;
        const isShareMode = Boolean(
            this.manager?.host?.isShareMode
            || (typeof window !== 'undefined' && (window.__READIFY_SHARE__ || window.location?.pathname?.includes('/shares/')))
        );

        const flushParagraph = () => {
            if (!paragraph.length) return;
            html.push(`<p data-line="${paragraphStartLine}">${paragraph.map((line) => this.formatMarkdownInline(line)).join('<br>')}</p>`);
            paragraph = [];
            paragraphStartLine = -1;
        };

        const flushList = (targetIndent = -1) => {
            while (listStack.length > 0 && listStack[listStack.length - 1].indent > targetIndent) {
                const list = listStack.pop();
                if (listOpenItem) {
                    html.push('</li>');
                    listOpenItem = false;
                }
                html.push(`</${list.type === 'ordered' ? 'ol' : 'ul'}>`);
                if (listStack.length > 0) {
                    listOpenItem = true;
                }
            }
        };

        const flushCode = () => {
            if (!codeLines) return;
            const codeText = codeLines.join('\n');
            const lang = (codeLanguage || 'text').toLowerCase();
            if (lang === 'mermaid') {
                html.push(`<figure class="prd-mermaid-diagram" data-line="${codeStartLine}" data-prd-mermaid>
                    <pre hidden data-mermaid-source>${this.escapeHtml(codeText)}</pre>
                    <p data-mermaid-status role="status">正在绘制流程图…</p>
                    <div data-mermaid-canvas aria-label="流程图"></div>
                </figure>`);
                codeLines = null;
                codeStartLine = -1;
                codeLanguage = '';
                return;
            }
            const highlighted = this.highlightCode(codeText, lang);
            html.push(`
                <div class="prd-code-block">
                    <div class="prd-code-header">
                        <span class="prd-code-lang">${lang}</span>
                        <button class="prd-code-copy-btn" type="button">复制</button>
                    </div>
                    <pre data-line="${codeStartLine}"><code>${highlighted}</code></pre>
                </div>
            `);
            codeLines = null;
            codeStartLine = -1;
            codeLanguage = '';
        };

        const pushListItem = (type, indent, text, lineIndex, taskState = null) => {
            flushParagraph();
            flushList(indent);
            
            if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
                const tag = type === 'ordered' ? 'ol' : 'ul';
                html.push(listStack.length > 0 ? `\n<${tag}>` : `<${tag}>`);
                listStack.push({ type, indent });
            } else if (listStack[listStack.length - 1].type !== type) {
                const list = listStack.pop();
                if (listOpenItem) {
                    html.push('</li>');
                }
                html.push(`</${list.type === 'ordered' ? 'ol' : 'ul'}>`);
                const tag = type === 'ordered' ? 'ol' : 'ul';
                html.push(`<${tag}>`);
                listStack.push({ type, indent });
            } else {
                if (listOpenItem) {
                    html.push('</li>');
                }
            }
            
            const taskClass = taskState ? ' class="prd-task-list-item"' : '';
            const taskCheckbox = taskState
                ? `<input class="prd-task-list-item__checkbox" data-prd-task-checkbox type="checkbox"${isShareMode ? ' disabled' : ''}${taskState.checked ? ' checked' : ''} aria-label="${taskState.checked ? '已完成' : '未完成'}">`
                : '';
            html.push(`<li${taskClass} data-line="${lineIndex}">${taskCheckbox}${this.formatMarkdownInline(text)}`);
            listOpenItem = true;
        };

        const renderDrawioBlock = (path, title, lineIndex) => {
            const safePath = this.escapeHtml(path);
            const safeTitle = this.escapeHtml(title || '流程图');
            const readOnly = Boolean(this.manager.host.isShareMode || window.__READIFY_SHARE__);
            return `
                <figure class="prd-diagram-card" data-line="${lineIndex}" data-prd-diagram-path="${safePath}">
                    <span class="prd-diagram-card__preview" data-prd-diagram-preview="${safePath}">
                        <span class="prd-diagram-card__loading">
                            <span class="prd-diagram-card__loading-mark"></span>
                            正在加载流程图预览
                        </span>
                        <span class="prd-diagram-card__pan-layer" data-prd-diagram-pan="${safePath}" role="button" tabindex="0" aria-label="${readOnly ? '拖动查看流程图，点击查看详情' : '拖动查看流程图，点击进入编辑'}"></span>
                        <span class="prd-diagram-card__pan-hint" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M8 11V7a2 2 0 1 1 4 0v3"></path>
                                <path d="M12 10V5a2 2 0 1 1 4 0v6"></path>
                                <path d="M16 10V8a2 2 0 1 1 4 0v6c0 4-3 7-7 7h-1c-3 0-5-1-7-4l-2-3a2 2 0 0 1 3-2l2 2"></path>
                            </svg>
                            拖动查看
                        </span>
                    </span>
                    <span class="prd-diagram-card__caption">
                        <span class="prd-diagram-card__identity">
                            <span class="prd-diagram-card__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="6" height="6" rx="1.5"></rect>
                                    <rect x="15" y="3" width="6" height="6" rx="1.5"></rect>
                                    <rect x="9" y="15" width="6" height="6" rx="1.5"></rect>
                                    <path d="M6 9v2.5h12V9M12 11.5V15"></path>
                                </svg>
                            </span>
                            <span>
                                <strong>${safeTitle}</strong>
                                <small>${readOnly ? '拖动查看 · 点击查看详情' : '拖动查看 · 点击进入编辑'}</small>
                            </span>
                        </span>
                        <span class="prd-diagram-card__enter" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 5h5v5"></path>
                                <path d="M10 14 19 5"></path>
                                <path d="M19 14v5h-5"></path>
                                <path d="M5 10V5h5"></path>
                                <path d="M5 14v5h5"></path>
                            </svg>
                        </span>
                    </span>
                    <button class="prd-diagram-card__open" type="button" data-prd-open-diagram="${safePath}" aria-label="${readOnly ? `查看流程图：${safeTitle}` : `打开流程图：${safeTitle}`}"></button>
                </figure>
            `;
        };

        const renderMindmapBlock = (path, title, lineIndex) => {
            const safePath = this.escapeHtml(path);
            const safeTitle = this.escapeHtml(title || '思维导图');
            const readOnly = Boolean(this.manager.host.isShareMode || window.__READIFY_SHARE__);
            return `
                <figure class="prd-mindmap-card" data-line="${lineIndex}" data-prd-mindmap-path="${safePath}">
                    <span class="prd-mindmap-card__preview" data-prd-mindmap-preview="${safePath}">
                        <span class="prd-mindmap-card__loading">
                            <span class="prd-mindmap-card__loading-mark"></span>
                            正在加载思维导图预览
                        </span>
                        <span class="prd-mindmap-card__pan-layer" data-prd-mindmap-pan="${safePath}" role="button" tabindex="0" aria-label="${readOnly ? '拖动查看思维导图，点击查看详情' : '拖动查看思维导图，点击进入编辑'}"></span>
                        <span class="prd-mindmap-card__pan-hint" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M8 11V7a2 2 0 1 1 4 0v3"></path>
                                <path d="M12 10V5a2 2 0 1 1 4 0v6"></path>
                                <path d="M16 10V8a2 2 0 1 1 4 0v6c0 4-3 7-7 7h-1c-3 0-5-1-7-4l-2-3a2 2 0 0 1 3-2l2 2"></path>
                            </svg>
                            拖动查看
                        </span>
                    </span>
                    <span class="prd-mindmap-card__caption">
                        <span class="prd-mindmap-card__identity">
                            <span class="prd-mindmap-card__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="2.2"></circle>
                                    <circle cx="5" cy="6" r="1.8"></circle>
                                    <circle cx="5" cy="18" r="1.8"></circle>
                                    <circle cx="19" cy="6" r="1.8"></circle>
                                    <circle cx="19" cy="18" r="1.8"></circle>
                                    <path d="M10 11 6.4 7.2M10 13 6.4 16.8M14 11l3.6-3.8M14 13l3.6 3.8"></path>
                                </svg>
                            </span>
                            <span>
                                <strong>${safeTitle}</strong>
                                <small>${readOnly ? '拖动查看 · 点击查看详情' : '拖动查看 · 点击进入编辑'}</small>
                            </span>
                        </span>
                        <span class="prd-mindmap-card__enter" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 5h5v5"></path>
                                <path d="M10 14 19 5"></path>
                                <path d="M19 14v5h-5"></path>
                                <path d="M5 10V5h5"></path>
                                <path d="M5 14v5h5"></path>
                            </svg>
                        </span>
                    </span>
                    <button class="prd-mindmap-card__open" type="button" data-prd-open-mindmap="${safePath}" aria-label="${readOnly ? `查看思维导图：${safeTitle}` : `打开思维导图：${safeTitle}`}"></button>
                </figure>
            `;
        };

        for (let index = 0; index < lines.length; index += 1) {
            const rawLine = lines[index];
            const trimmed = rawLine.trim();

            if (codeLines) {
                if (trimmed.startsWith('```')) {
                    flushCode();
                } else {
                    codeLines.push(rawLine);
                }
                continue;
            }

            if (trimmed.startsWith('```')) {
                flushParagraph();
                flushList(-1);
                const lang = trimmed.slice(3).trim();
                codeLines = [];
                codeStartLine = index;
                codeLanguage = lang;
                continue;
            }

            if (!trimmed) {
                flushParagraph();
                continue;
            }

            const drawioMatch = /^:::drawio\s+path=(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+title=(?:"([^"]+)"|'([^']+)'|(.+)))?\s*$/.exec(trimmed);
            if (drawioMatch) {
                flushParagraph();
                flushList(-1);
                const path = drawioMatch[1] || drawioMatch[2] || drawioMatch[3] || '';
                const title = drawioMatch[4] || drawioMatch[5] || drawioMatch[6] || '流程图';
                html.push(renderDrawioBlock(path, title.trim(), index));
                continue;
            }

            const mindmapMatch = /^:::mindmap\s+path=(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+title=(?:"([^"]+)"|'([^']+)'|(.+)))?\s*$/.exec(trimmed);
            if (mindmapMatch) {
                flushParagraph();
                flushList(-1);
                const path = mindmapMatch[1] || mindmapMatch[2] || mindmapMatch[3] || '';
                const title = mindmapMatch[4] || mindmapMatch[5] || mindmapMatch[6] || '思维导图';
                html.push(renderMindmapBlock(path, title.trim(), index));
                continue;
            }

            if (/^-{3,}$/.test(trimmed)) {
                flushParagraph();
                flushList(-1);
                html.push(`<hr data-line="${index}">`);
                continue;
            }

            const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
            if (quoteMatch) {
                flushParagraph();
                flushList(-1);
                html.push(`<blockquote data-line="${index}">${this.formatMarkdownInline(quoteMatch[1])}</blockquote>`);
                continue;
            }

            const tableDivider = lines[index + 1] || '';
            if (this.isMarkdownTableRow(rawLine) && this.isMarkdownTableDivider(tableDivider)) {
                flushParagraph();
                flushList(-1);
                const headers = this.parseMarkdownTableRow(rawLine);
                const tableStartLine = index;
                index += 2;
                const rows = [];
                while (index < lines.length && this.isMarkdownTableRow(lines[index])) {
                    rows.push(this.parseMarkdownTableRow(lines[index]));
                    index += 1;
                }
                index -= 1;
                html.push(this.renderMarkdownTable(headers, rows, tableStartLine));
                continue;
            }

            const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
            if (headingMatch) {
                flushParagraph();
                flushList(-1);
                const level = Math.min(headingMatch[1].length, 4);
                const headingId = `prd-heading-${headingCount}`;
                headingCount++;
                html.push(`<h${level} id="${headingId}" data-line="${index}">${this.formatMarkdownInline(headingMatch[2])}</h${level}>`);
                continue;
            }

            const unorderedMatch = /^(\s*)[-*+]\s+(.+)$/.exec(rawLine);
            if (unorderedMatch) {
                const taskMatch = /^\[([ xX])\]\s+(.+)$/.exec(unorderedMatch[2]);
                const content = taskMatch ? taskMatch[2] : unorderedMatch[2];
                const taskState = taskMatch ? { checked: taskMatch[1].toLowerCase() === 'x' } : null;
                pushListItem('unordered', unorderedMatch[1].length, content, index, taskState);
                continue;
            }

            const orderedMatch = /^(\s*)\d+\.\s+(.+)$/.exec(rawLine);
            if (orderedMatch) {
                pushListItem('ordered', orderedMatch[1].length, orderedMatch[2], index);
                continue;
            }

            flushList(-1);
            if (paragraph.length === 0) {
                paragraphStartLine = index;
            }
            paragraph.push(trimmed);
        }

        flushCode();
        flushParagraph();
        flushList(-1);
        return html.join('');
    }

    /**
     * Helper to format document size
     */
    formatDocSize(size) {
        if (size === null || size === undefined) return '';
        if (size < 1024) return `${size} B`;
        return `${(size / 1024).toFixed(1)} KB`;
    }

    /**
     * Helper to format document update date
     */
    formatDocDate(doc) {
        if (doc.updatedAtMs) {
            const date = new Date(doc.updatedAtMs);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        if (doc.updatedAt) {
            try {
                const date = new Date(doc.updatedAt);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            } catch {
                return doc.updatedAt;
            }
        }
        return '';
    }

    /**
     * Renders PRD metadata (dirty badge, breadcrumbs, and file switcher)
     */
    renderPrdMeta(state) {
        const isShareMode = this.manager.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');
        const page = this.manager.host.getPageRecord();
        const pageName = page?.name || this.manager.host.activePageId || '当前页面';
        const versionLabel = this.manager.host.activeVersion ? this.manager.host.activeVersion.toUpperCase() : '';
        const activeFileName = this.getPrdFileName(state?.path || this.manager.host.getPrdRelativePath()) || 'product-doc.md';
        const baseLabel = `${pageName} / ${versionLabel}`;
        
        const dirtyLabel = state?.dirty ? '<span class="prd-meta__dirty">未保存</span>' : '';
        const documents = Array.isArray(state?.documents) ? state.documents : [];
        
        const dropdownItemsHtml = documents.map(doc => {
            const isActive = doc.path === state.path;
            const timeLabel = this.formatDocDate(doc);
            
            const actionsHtml = isShareMode ? '' : `
                    <div class="prd-dropdown-item__actions">
                        <button type="button" class="prd-dropdown-item__delete-btn" title="物理删除文件" data-prd-delete-path="${this.escapeHtml(doc.path)}" data-prd-delete-filename="${this.escapeHtml(doc.filename)}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
            `;
            
            return `
                <li class="prd-dropdown-item${isActive ? ' is-active' : ''}">
                    <div class="prd-dropdown-item__left" data-prd-switch-path="${this.escapeHtml(doc.path)}">
                        <div class="prd-dropdown-item__name-row">
                            <span class="prd-dropdown-item__name" title="${this.escapeHtml(doc.filename)}">${this.escapeHtml(doc.label || doc.filename)}</span>
                        </div>
                        ${timeLabel ? `<div class="prd-dropdown-item__details"><span>${timeLabel}</span></div>` : ''}
                    </div>
                    ${actionsHtml}
                </li>
            `;
        }).join('');
        
        return `
            <div class="prd-meta">
                <span class="prd-meta__breadcrumb" title="${this.escapeHtml(baseLabel)}">${this.escapeHtml(baseLabel)}</span>
                <span class="prd-meta__divider">·</span>
                <div class="prd-meta__switcher-wrapper">
                    <button class="prd-meta__manage-btn" data-prd-manage-trigger title="管理/切换 PRD 文档">
                        <span>${this.escapeHtml(activeFileName)}</span>
                        <svg class="prd-meta__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    
                    <div class="prd-dropdown-menu" data-prd-dropdown hidden>
                        <ul class="prd-dropdown-list">
                            ${dropdownItemsHtml || `
                                <li class="prd-dropdown-empty">
                                    暂无 PRD 文档
                                </li>
                            `}
                        </ul>
                        ${isShareMode ? '' : `
                        <div class="prd-dropdown-footer">
                            <button type="button" class="prd-dropdown-create-btn" data-prd-create-document>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M12 5v14"></path>
                                    <path d="M5 12h14"></path>
                                </svg>
                                <span>新增文件</span>
                            </button>
                        </div>
                        `}
                    </div>
                </div>
                ${dirtyLabel}
            </div>
        `;
    }

    /**
     * Renders the comprehensive dual-pane Editor Layout
     */
    renderPrdMarkdownEditor(state) {
        // Resolve draft or content safely
        const draft = state.editMode ? (state.draftContent ?? state.content ?? '') : (state.content ?? '');
        const currentLayout = this.manager.host.prdEditorLayout || 'source';
        const hasDiagram = /(^|\n)\s*:::(drawio|mindmap)\s+path=/m.test(draft);
        
        const formatButtons = [
            ['heading', 'H2', '标题'],
            ['bold', 'B', '加粗'],
            ['italic', 'I', '斜体'],
            ['quote', '>', '引用'],
            ['unordered', '•', '无序列表'],
            ['ordered', '1.', '有序列表'],
            ['task', '☑', '待办列表'],
            ['inline-code', '{}', '行内代码'],
            ['code-block', '</>', '代码块'],
            ['link', '↗', '链接'],
            ['table', '▦', '表格'],
            ['hr', '—', '分割线']
        ];
        const layoutButtons = [
            ['source', '源码'],
            ['split', '双栏'],
            ['preview', '预览']
        ];

        return `
            <section class="prd-editor-shell prd-editor-shell--${this.escapeHtml(currentLayout)}" data-prd-editor-shell>
                <div class="prd-slash-menu" data-prd-slash-menu hidden></div>
                <div class="prd-editor-toolbar prd-editor-global-toolbar">
                    <div class="prd-editor-toolbar__group" aria-label="Markdown 格式">
                        ${formatButtons.map(([format, label, title]) => `
                            <button class="prd-editor-tool" type="button" data-prd-format="${this.escapeHtml(format)}" title="${this.escapeHtml(title)}">
                                ${this.escapeHtml(label)}
                            </button>
                        `).join('')}
                    </div>
                    <div class="prd-editor-toolbar__spacer"></div>
                    <div class="prd-editor-layout">
                        ${layoutButtons.map(([lyt, label]) => `
                            <button class="prd-editor-layout__btn${lyt === currentLayout ? ' is-active' : ''}" type="button" data-prd-layout="${this.escapeHtml(lyt)}">
                                ${this.escapeHtml(label)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="prd-editor-grid prd-editor-grid--${this.escapeHtml(currentLayout)}${hasDiagram ? ' has-diagram-preview' : ''}">
                    <div class="prd-editor-pane prd-editor-pane--source">
                        <textarea class="prd-editor-textarea" data-prd-editor placeholder="在此以 Markdown 格式编写 PRD...键入 '/' 可快速唤起格式菜单。" spellcheck="false">${this.escapeHtml(draft)}</textarea>
                    </div>
                    
                    <div class="prd-editor-pane prd-editor-pane--preview">
                        <div class="prd-editor-preview prd-document">
                            ${draft.trim() ? this.renderMarkdownDocument(draft) : '<p class="prd-editor-preview-empty">这里会显示 Markdown 预览。</p>'}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Renders floating Slash Commands Menu in editor
     */
    renderPrdSlashCommandMenu(commands = [], menuContainer, selectedIndex = 0) {
        if (!menuContainer) return;
        if (commands.length === 0) {
            menuContainer.hidden = true;
            return;
        }

        menuContainer.innerHTML = commands.map((cmd, idx) => `
            <button class="prd-slash-menu__item${idx === selectedIndex ? ' is-active' : ''}" type="button" data-prd-slash-command="${this.escapeHtml(cmd.id)}">
                <span class="prd-slash-menu__label">${this.escapeHtml(cmd.label)}</span>
                <span class="prd-slash-menu__description">${this.escapeHtml(cmd.description)}</span>
            </button>
        `).join('');

        menuContainer.hidden = false;

        // Auto-scroll selected item into view
        const activeItem = menuContainer.querySelector('.prd-slash-menu__item.is-active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Resolves the current active draft or file content
     */
    getPrdDraftContent(state) {
        return typeof state.draftContent === 'string' ? state.draftContent : String(state.content || '');
    }

    getPrdFileName(path = '') {
        const rawName = String(path || '').split('/').pop() || '';
        try {
            return decodeURIComponent(rawName);
        } catch {
            return rawName;
        }
    }

    getPrdDocumentLabel(path = '') {
        return this.getPrdFileName(path) || 'product-doc.md';
    }

    /**
     * Enriches responsive classes on images in output container
     */
    preparePrdImages(container) {
        if (!container) return;
        void mountMermaidDiagrams(container);
        const images = container.querySelectorAll('.prd-document img, .prd-editor-preview img, img');
        images.forEach(img => {
            img.className = 'prd-document__image';
            img.loading = 'lazy';
            
            // Set size helpers based on query or alt markers
            const alt = String(img.alt || '').toLowerCase();
            if (alt.includes('portrait') || alt.includes('vertical')) {
                img.classList.add('prd-document__image--portrait');
            } else if (alt.includes('phone') || alt.includes('mobile')) {
                img.classList.add('prd-document__image--phone');
            } else if (alt.includes('square')) {
                img.classList.add('prd-document__image--square');
            } else if (alt.includes('wide') || alt.includes('landscape')) {
                img.classList.add('prd-document__image--wide');
            } else {
                // Dynamically classify based on dimensions once loaded if no alt markers are found
                const classifyImage = () => {
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    if (w && h) {
                        const ratio = h / w;
                        if (ratio > 1.2) {
                            img.classList.add('prd-document__image--phone');
                        } else if (ratio >= 0.85 && ratio <= 1.15) {
                            img.classList.add('prd-document__image--square');
                        }
                    }
                };
                if (img.complete) {
                    classifyImage();
                } else {
                    img.addEventListener('load', classifyImage, { once: true });
                }
            }
        });

        // Set copying functionality for block code-copy buttons
        const copyBtns = container.querySelectorAll('.prd-code-copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const codeEl = btn.parentElement?.nextElementSibling?.querySelector('code');
                if (codeEl) {
                    try {
                        await navigator.clipboard.writeText(codeEl.textContent);
                        const labelSpan = btn.querySelector('span') || btn;
                        if (labelSpan) {
                            const prevText = labelSpan.textContent;
                            labelSpan.textContent = '已复制!';
                            btn.style.color = '#50fa7b';
                            setTimeout(() => {
                                labelSpan.textContent = prevText;
                                btn.style.color = '';
                            }, 1800);
                        }
                    } catch (err) {
                        console.error('Copy text failed:', err);
                    }
                }
            });
        });
    }

    /**
     * Complete Outline & TOC Generator with Scroll Spy highlighters
     */
    generatePrdToc(container, drawerContainer, state) {
        if (!drawerContainer || !container) return;
        
        // Remove existing TOC if document is not in valid status
        if (this.manager.host.docDrawerMode !== 'prd' || state.status !== 'ready') {
            const existingToc = drawerContainer.querySelector('.prd-toc-floating');
            if (existingToc) existingToc.remove();
            drawerContainer.classList.remove('has-pinned-toc');
            this._lastPrdHeadingsHash = null;
            return;
        }

        const headings = Array.from(container.querySelectorAll('.prd-document h1, .prd-document h2, .prd-document h3, .prd-document h4'));
        if (headings.length === 0) {
            const existingToc = drawerContainer.querySelector('.prd-toc-floating');
            if (existingToc) existingToc.remove();
            this._lastPrdHeadingsHash = null;
            return;
        }

        // Tag heading DOMs with stable IDs
        headings.forEach((heading, idx) => {
            if (!heading.id) {
                heading.id = `prd-heading-${idx}`;
            }
        });

        const headingsHash = headings.map(h => `${h.tagName}:${h.textContent.trim()}`).join('|');
        
        let tocFloating = drawerContainer.querySelector('.prd-toc-floating');
        let card = tocFloating?.querySelector('.prd-toc-card');
        
        if (this._lastPrdHeadingsHash !== headingsHash || !tocFloating || !card) {
            this._lastPrdHeadingsHash = headingsHash;
            
            if (tocFloating) {
                tocFloating.remove();
            }

            tocFloating = document.createElement('div');
            tocFloating.className = 'prd-toc-floating';
            
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'prd-toc-toggle';
            toggleBtn.title = '文档大纲目录';
            toggleBtn.type = 'button';
            toggleBtn.setAttribute('aria-label', '展开文档目录');
            toggleBtn.setAttribute('aria-expanded', 'false');
            const railLineHeight = headings.length > 50 ? 2 : 3;
            const availableRailHeight = Math.max(160, Math.min(360, window.innerHeight - 240));
            const railGap = headings.length > 1
                ? Math.max(2, Math.min(10, (availableRailHeight - railLineHeight * headings.length) / (headings.length - 1)))
                : 0;
            toggleBtn.innerHTML = `
                <span class="prd-toc-rail" aria-hidden="true" style="--prd-toc-rail-gap: ${railGap}px; --prd-toc-line-height: ${railLineHeight}px;">
                    ${headings.map((heading, index) => {
                        const level = Math.min(parseInt(heading.tagName.substring(1), 10), 4);
                        return `<span class="prd-toc-rail__line prd-toc-rail__line--level-${level}${index === 0 ? ' is-active' : ''}"></span>`;
                    }).join('')}
                </span>
            `;

            card = document.createElement('div');
            card.className = 'prd-toc-card';
            card.setAttribute('role', 'navigation');
            card.setAttribute('aria-label', '文档目录');
            card.innerHTML = `
                <div class="prd-toc-card__header">
                    <span>目录</span>
                </div>
                <div class="prd-toc-card__body">
                    <ul class="prd-toc-list">
                        ${headings.map(heading => {
                            const level = parseInt(heading.tagName.substring(1), 10);
                            const text = heading.textContent.trim().replace(/^#+\s*/, '');
                            return `
                                <li class="prd-toc-item prd-toc-item--level-${level}" data-target-id="${heading.id}" data-heading-text="${this.escapeHtml(text)}">
                                    <a href="#${heading.id}" class="prd-toc-link">${this.escapeHtml(text)}</a>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            `;

            tocFloating.appendChild(toggleBtn);
            tocFloating.appendChild(card);
            drawerContainer.appendChild(tocFloating);
            drawerContainer.classList.remove('has-pinned-toc');

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                tocFloating.classList.toggle('prd-toc-floating--expanded');
                toggleBtn.setAttribute('aria-expanded', String(tocFloating.classList.contains('prd-toc-floating--expanded')));
            });

            let hoverCloseTimer = null;
            const cancelHoverClose = () => {
                if (hoverCloseTimer) {
                    clearTimeout(hoverCloseTimer);
                    hoverCloseTimer = null;
                }
            };
            const openFromRail = () => {
                cancelHoverClose();
                tocFloating.classList.add('prd-toc-floating--hovered');
            };
            const scheduleHoverClose = () => {
                cancelHoverClose();
                hoverCloseTimer = setTimeout(() => {
                    tocFloating.classList.remove('prd-toc-floating--hovered');
                    hoverCloseTimer = null;
                }, 80);
            };

            toggleBtn.addEventListener('mouseenter', openFromRail);
            toggleBtn.addEventListener('mouseleave', scheduleHoverClose);
            card.addEventListener('mouseenter', cancelHoverClose);
            card.addEventListener('mouseleave', scheduleHoverClose);
            
            const links = card.querySelectorAll('.prd-toc-link');
            links.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = link.parentElement.dataset.targetId;
                    const targetEl = container.querySelector('#' + targetId);
                    const currentLayout = this.manager.host.prdEditorLayout || 'source';

                    if (state.editMode) {
                        if (currentLayout === 'split' || currentLayout === 'preview') {
                            const scrollContainer = container.querySelector('.prd-editor-preview');
                            if (scrollContainer && targetEl) {
                                const containerRect = scrollContainer.getBoundingClientRect();
                                const targetRect = targetEl.getBoundingClientRect();
                                const relativeTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
                                scrollContainer.scrollTo({
                                    top: relativeTop - 10,
                                    behavior: 'smooth'
                                });
                            }
                        }
                    } else {
                        const scrollContainer = container;
                        if (targetEl && scrollContainer) {
                            const containerRect = scrollContainer.getBoundingClientRect();
                            const targetRect = targetEl.getBoundingClientRect();
                            const relativeTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
                            scrollContainer.scrollTo({
                                top: relativeTop - 10,
                                behavior: 'smooth'
                            });
                        }
                    }

                    if (state.editMode && (currentLayout === 'source' || currentLayout === 'split')) {
                        const textarea = container.querySelector('[data-prd-editor]');
                        if (textarea) {
                            const headingText = link.parentElement.dataset.headingText;
                            if (headingText) {
                                const textContent = textarea.value;
                                const linesContent = textContent.split('\n');
                                let foundLineIdx = -1;
                                for (let i = 0; i < linesContent.length; i++) {
                                    const line = linesContent[i].trim();
                                    if (/^#{1,6}\s+/.test(line)) {
                                        const cleanLine = line.replace(/^#{1,6}\s+/, '').trim();
                                        if (cleanLine === headingText || cleanLine.includes(headingText) || headingText.includes(cleanLine)) {
                                            foundLineIdx = i;
                                            break;
                                        }
                                    }
                                }
                                if (foundLineIdx !== -1) {
                                    const charIndex = linesContent.slice(0, foundLineIdx).join('\n').length + (foundLineIdx > 0 ? 1 : 0);
                                    textarea.focus();
                                    textarea.setSelectionRange(charIndex, charIndex + linesContent[foundLineIdx].length);
                                    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
                                    textarea.scrollTo({
                                        top: foundLineIdx * lineHeight - 40,
                                        behavior: 'smooth'
                                    });
                                }
                            }
                        }
                    }

                    tocFloating.classList.remove('prd-toc-floating--expanded');
                    tocFloating.classList.remove('prd-toc-floating--hovered');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                });
            });
        }

        // Reattach scroll spies on editor and preview panes
        if (this._tocCleanup) {
            this._tocCleanup();
            this._tocCleanup = null;
        }

        const closeOnClickOutside = (e) => {
            if (tocFloating && !tocFloating.contains(e.target)) {
                tocFloating.classList.remove('prd-toc-floating--expanded');
                tocFloating.classList.remove('prd-toc-floating--hovered');
                tocFloating.querySelector('.prd-toc-toggle')?.setAttribute('aria-expanded', 'false');
            }
        };
        document.addEventListener('click', closeOnClickOutside);

        const textarea = state.editMode ? container.querySelector('[data-prd-editor]') : null;
        const previewContainer = state.editMode ? container.querySelector('.prd-editor-preview') : null;
        const scrollers = state.editMode ? [textarea, previewContainer].filter(Boolean) : [container];

        if (scrollers.length > 0) {
            const tocItems = Array.from(card.querySelectorAll('.prd-toc-item'));
            const railLines = Array.from(tocFloating.querySelectorAll('.prd-toc-rail__line'));
            const handleScrollSpy = (e) => {
                let activeHeadingId = null;
                const currentLayout = this.manager.host.prdEditorLayout || 'source';
                const isTextareaScroll = e && e.target === textarea;
                
                const useTextarea = state.editMode && (currentLayout === 'source' || isTextareaScroll) && textarea;
                
                if (useTextarea) {
                    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
                    const topVisibleLine = Math.floor(textarea.scrollTop / lineHeight);
                    
                    let bestHeadingId = null;
                    for (const heading of headings) {
                        const lineStr = heading.dataset.line;
                        if (lineStr) {
                            const lineNum = parseInt(lineStr, 10);
                            if (lineNum <= topVisibleLine + 10) {
                                bestHeadingId = heading.id;
                            } else {
                                break;
                            }
                        }
                    }
                    if (bestHeadingId) {
                        activeHeadingId = bestHeadingId;
                    } else if (headings.length > 0) {
                        activeHeadingId = headings[0].id;
                    }
                } else {
                    const domScroller = state.editMode ? previewContainer : container;
                    if (domScroller && domScroller.offsetHeight > 0) {
                        const containerRect = domScroller.getBoundingClientRect();
                        for (const heading of headings) {
                            const rect = heading.getBoundingClientRect();
                            if (rect.top - containerRect.top <= 120) {
                                activeHeadingId = heading.id;
                            } else {
                                break;
                            }
                        }
                        if (!activeHeadingId && headings.length > 0) {
                            activeHeadingId = headings[0].id;
                        }
                    }
                }

                tocItems.forEach(item => {
                    item.classList.toggle('is-active', item.dataset.targetId === activeHeadingId);
                });

                const activeIndex = headings.findIndex(heading => heading.id === activeHeadingId);
                railLines.forEach((line, index) => line.classList.toggle('is-active', index === Math.max(0, activeIndex)));
            };

            scrollers.forEach(scroller => scroller.addEventListener('scroll', handleScrollSpy, { passive: true }));
            
            // Clean up bindings
            this._tocCleanup = () => {
                document.removeEventListener('click', closeOnClickOutside);
                scrollers.forEach(scroller => scroller.removeEventListener('scroll', handleScrollSpy));
            };

            // Call immediately to highlight starting heading
            handleScrollSpy();
        } else {
            this._tocCleanup = () => {
                document.removeEventListener('click', closeOnClickOutside);
            };
        }
    }
}
