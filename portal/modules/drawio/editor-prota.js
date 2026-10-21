(() => {
    const THEME_ID = 'prota-drawio-theme';
    const THEME_HREF = `${window.location.origin}/portal/modules/drawio/editor-prota.css?v=20260630-drawio-modes-v17`;
    const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';
    let movingTheme = false;
    let controlState = {
        currentPath: '',
        filename: '流程图',
        diagrams: [],
        readOnly: false,
        canExit: false,
        editorMode: 'compact',
        panelFullscreen: false,
        browserFullscreen: false
    };
    let lastControlsSignature = '';
    let openDiagramMenu = null;
    let compactPanelsInitialized = false;
    let compactPanelCloseTimer = null;

    // draw.io v30 focuses an invisible textarea when a shape is selected.
    // Space then reaches its typing shim instead of the native pan shortcut.
    // Capture it before the shim and expose the state to draw.io's pan handler.
    let spacePressed = false;
    const nativeIsSpaceDown = window.EditorUi?.prototype.isSpaceDown;
    if (nativeIsSpaceDown) {
        window.EditorUi.prototype.isSpaceDown = function () {
            return spacePressed || nativeIsSpaceDown.call(this);
        };
    }
    const releaseSpace = () => {
        spacePressed = false;
        document.querySelectorAll('.geDiagramContainer').forEach((canvas) => {
            canvas.style.cursor = '';
        });
    };
    document.addEventListener('keydown', (event) => {
        if (!nativeIsSpaceDown || event.code !== 'Space' || event.isComposing
            || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target;
        const isShim = target?.classList?.contains('mxTypingShim');
        const isEditing = !isShim && (target?.isContentEditable
            || target?.closest?.('input, textarea, select, [contenteditable="true"]'));
        if (isEditing || target?.closest?.('.geDialog, .mxWindow, .geMenubarContainer, .geToolbarContainer')) return;
        const canvas = target?.closest?.('.geDiagramContainer')
            || (target === document.body ? document.querySelector('.geDiagramContainer') : null);
        if (!canvas) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        spacePressed = true;
        canvas.style.cursor = 'grab';
    }, true);
    document.addEventListener('keyup', (event) => {
        if (event.code !== 'Space' || !spacePressed) return;
        event.preventDefault();
        releaseSpace();
    }, true);
    window.addEventListener('blur', releaseSpace);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) releaseSpace();
    });

    const getTheme = () => {
        let theme = document.getElementById(THEME_ID);

        if (!theme) {
            theme = document.createElement('link');
            theme.id = THEME_ID;
            theme.rel = 'stylesheet';
            theme.href = THEME_HREF;
            document.head.appendChild(theme);
        }

        return theme;
    };

    const keepThemeLast = () => {
        if (movingTheme) return;

        const theme = getTheme();
        if (document.head.lastElementChild !== theme) {
            movingTheme = true;
            document.head.appendChild(theme);
            movingTheme = false;
        }

        document.documentElement.dataset.protaDrawioTheme = 'drawio-modes-v13';
        document.body?.classList.toggle('prota-drawio-preview', previewMode);
    };

    const normalizeMenuChrome = (root = document) => {
        const rows = [];
        const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
        const shortcuts = new Map([
            ['查找/替换', `${modifier}F`],
            ['打印...', `${modifier}P`],
            ['保存', `${modifier}S`]
        ]);

        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.('tr.mxPopupMenuItem')) {
            rows.push(root);
        }
        root.querySelectorAll?.('tr.mxPopupMenuItem').forEach((row) => rows.push(row));

        rows.forEach((row) => {
            const cells = row.children;
            const labelCell = cells[1];
            const shortcutCell = cells[2];
            const check = labelCell
                ? Array.from(labelCell.children).find((child) =>
                    child.tagName === 'DIV'
                    && child.style.position === 'absolute'
                    && child.style.backgroundImage
                )
                : null;
            const chevron = shortcutCell
                ? Array.from(shortcutCell.children).find((child) =>
                    child.tagName === 'DIV'
                    && child.style.backgroundImage
                )
                : null;
            const label = labelCell?.textContent?.trim() || '';

            row.classList.toggle('prota-menu-row--checked', Boolean(check));
            row.classList.toggle('prota-menu-row--submenu', Boolean(chevron));
            check?.classList.add('prota-menu-check');
            chevron?.classList.add('prota-menu-chevron');
            if (shortcutCell && !chevron && !shortcutCell.textContent.trim() && shortcuts.has(label)) {
                shortcutCell.dataset.protaShortcut = shortcuts.get(label);
                shortcutCell.classList.add('prota-menu-shortcut');
            }
        });
    };

    const icon = (name) => {
        if (name === 'exit') {
            return '<path d="m15 18-6-6 6-6"></path><path d="M9 12h12"></path><path d="M3 4v16"></path>';
        }
        if (name === 'save') {
            return '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path><path d="M17 21v-8H7v8M7 3v5h8"></path>';
        }
        if (name === 'zoomIn') {
            return '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4M11 8v6M8 11h6"></path>';
        }
        if (name === 'zoomOut') {
            return '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4M8 11h6"></path>';
        }
        if (name === 'panel') {
            return '<path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>';
        }

        return controlState.browserFullscreen
            ? '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"></path>'
            : '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 4v16"></path>';
    };

    const emitAction = (action, extra = {}) => {
        window.parent.postMessage(JSON.stringify({
            event: 'prota-action',
            action,
            ...extra
        }), window.location.origin);
    };

    const getGraphBounds = (container) => {
        // Prefer the draw.io graph model bounds when available: they describe
        // the actual diagram extent in graph coordinates and are unaffected by
        // the SVG viewport transform, page background rectangles, or transient
        // container size changes during compact-panel collapse.
        const editorUi = window.editorUi || window.ui || window.app;
        const graph = editorUi?.editor?.graph || editorUi?.graph;
        if (graph) {
            try {
                const view = graph.view;
                const scale = view?.getScale?.() || 1;
                const translate = view?.translate || { x: 0, y: 0 };
                const graphBounds = graph.getGraphBounds?.();
                if (graphBounds && Number.isFinite(graphBounds.width) && Number.isFinite(graphBounds.height)) {
                    const left = (graphBounds.x + translate.x) * scale;
                    const top = (graphBounds.y + translate.y) * scale;
                    const width = graphBounds.width * scale;
                    const height = graphBounds.height * scale;
                    const containerRect = container.getBoundingClientRect();
                    return {
                        left: containerRect.left + left,
                        top: containerRect.top + top,
                        right: containerRect.left + left + width,
                        bottom: containerRect.top + top + height
                    };
                }
            } catch {
                // Fall back to DOM measurement below for upstream variants.
            }
        }

        const svg = container.querySelector('svg');
        if (!svg) return null;
        const containerRect = container.getBoundingClientRect();
        let elements = Array.from(svg.querySelectorAll('[data-cell-id], [cell-id]'));
        if (elements.length === 0) {
            elements = Array.from(svg.querySelectorAll('g'))
                .filter((element) => Array.from(element.children).some((child) =>
                    ['RECT', 'PATH', 'ELLIPSE', 'POLYGON', 'POLYLINE'].includes(child.tagName)
                ));
        }
        // Exclude only the full-page background rectangle. A real shape that
        // happens to sit near the edge must still contribute to the bounds so
        // the diagram centers where it actually is, not where the page is.
        const rects = elements
            .map((element) => element.getBoundingClientRect())
            .filter((rect) =>
                Number.isFinite(rect.left)
                && rect.width > 1
                && rect.height > 1
            )
            .filter((rect, index, array) => {
                if (array.length <= 1) return true;
                const isFullPageBackground =
                    rect.width >= containerRect.width * 0.92
                    && rect.height >= containerRect.height * 0.92;
                return !isFullPageBackground;
            });
        if (rects.length === 0) return null;
        return rects.reduce((bounds, rect) => ({
            left: Math.min(bounds.left, rect.left),
            top: Math.min(bounds.top, rect.top),
            right: Math.max(bounds.right, rect.right),
            bottom: Math.max(bounds.bottom, rect.bottom)
        }), {
            left: Number.POSITIVE_INFINITY,
            top: Number.POSITIVE_INFINITY,
            right: Number.NEGATIVE_INFINITY,
            bottom: Number.NEGATIVE_INFINITY
        });
    };

    const centerCanvas = () => {
        const editorUi = window.editorUi || window.ui || window.app;
        const graph = editorUi?.editor?.graph || editorUi?.graph;
        try {
            if (graph?.fit) graph.fit(24);
        } catch {
            // DOM centering below remains the fallback for upstream variants.
        }
        const containers = Array.from(document.querySelectorAll('.geDiagramContainer'));
        containers.forEach((container) => {
            const center = () => {
                const containerRect = container.getBoundingClientRect();
                const graphBounds = getGraphBounds(container);
                if (graphBounds) {
                    if (previewMode) {
                        return;
                    }
                    const graphCenterX = (graphBounds.left + graphBounds.right) / 2;
                    const graphCenterY = (graphBounds.top + graphBounds.bottom) / 2;
                    const viewportCenterX = containerRect.left + containerRect.width / 2;
                    const viewportCenterY = containerRect.top + containerRect.height / 2;
                    // Each pass recomputes the delta from the live viewport,
                    // so converging toward centered instead of accumulating
                    // drift when compact panels resize the viewport mid-flight.
                    const deltaLeft = graphCenterX - viewportCenterX;
                    const deltaTop = graphCenterY - viewportCenterY;
                    container.scrollLeft = Math.max(0, container.scrollLeft + deltaLeft);
                    container.scrollTop = Math.max(0, container.scrollTop + deltaTop);
                    return;
                }
                container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
                container.scrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
            };
            requestAnimationFrame(center);
            window.setTimeout(center, 160);
            window.setTimeout(center, 480);
            window.setTimeout(center, 960);
        });
    };

    const collapseCompactPanels = () => {
        if (controlState.editorMode !== 'compact' || compactPanelsInitialized) return;
        window.clearInterval(compactPanelCloseTimer);
        document.body.classList.add('prota-compact-initializing');
        let attempts = 0;
        let quietPasses = 0;
        let sawPanel = false;
        const panelGroups = [
            {
                labels: ['形状', 'Shapes'],
                selector: '.mxWindow:has(.geSidebarContainer:not(.geFormatContainer))'
            },
            {
                labels: ['格式', 'Format'],
                selector: '.mxWindow:has(.geFormatContainer)'
            }
        ];
        const findToolbarToggle = (labels, panel) => Array.from(document.querySelectorAll(
            '.geMenubarContainer [title], .geToolbarContainer [title]'
        )).find((element) => {
            if (panel.contains(element)) return false;
            const title = element.getAttribute('title')?.trim() || '';
            return labels.some((label) => title === label || title.startsWith(`${label} (`));
        });
        const closeVisiblePanel = ({ labels, selector }) => {
            const panel = document.querySelector(selector);
            if (!panel || panel.offsetParent === null) return false;
            const toggle = findToolbarToggle(labels, panel);
            if (toggle) {
                toggle.click();
                return true;
            }
            const title = panel.querySelector('.mxWindowTitle');
            const controls = Array.from(title?.children || []).filter((child) => child.tagName === 'DIV');
            const close = controls.find((control) => {
                const label = `${control.title || ''} ${control.getAttribute('aria-label') || ''}`;
                return /关闭|close/i.test(label);
            });
            if (close) {
                close.click();
                return true;
            }
            panel.style.display = 'none';
            return true;
        };
        const collapse = () => {
            if (controlState.editorMode !== 'compact') {
                window.clearInterval(compactPanelCloseTimer);
                compactPanelCloseTimer = null;
                document.body.classList.remove('prota-compact-initializing');
                return;
            }
            attempts += 1;
            if (panelGroups.some(({ selector }) => document.querySelector(selector))) {
                sawPanel = true;
            }
            const closedAny = panelGroups.map(closeVisiblePanel).some(Boolean);
            quietPasses = closedAny ? 0 : quietPasses + 1;
            centerCanvas();
            if (attempts >= 30 || (sawPanel && quietPasses >= 8)) {
                window.clearInterval(compactPanelCloseTimer);
                compactPanelCloseTimer = null;
                compactPanelsInitialized = true;
                document.body.classList.remove('prota-compact-initializing');
            }
        };
        collapse();
        compactPanelCloseTimer = window.setInterval(collapse, 180);
    };

    const closeDiagramMenu = () => {
        openDiagramMenu?.remove();
        openDiagramMenu = null;
        document.querySelector('.prota-drawio-file-trigger')?.setAttribute('aria-expanded', 'false');
    };

    const openDiagramSwitcher = (trigger, diagrams) => {
        closeDiagramMenu();
        const menu = document.createElement('div');
        menu.className = 'prota-drawio-file-menu';
        menu.setAttribute('role', 'menu');

        diagrams.forEach((diagram) => {
            const item = document.createElement('button');
            const selected = diagram.path === controlState.currentPath;
            item.type = 'button';
            item.className = `prota-drawio-file-option${selected ? ' is-selected' : ''}`;
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('aria-checked', String(selected));
            item.innerHTML = `
                <span>${diagram.label || diagram.filename || '流程图'}</span>
                ${selected ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.2 2.7 2.7 6.3-6.3"></path></svg>' : ''}
            `;
            item.addEventListener('click', () => {
                closeDiagramMenu();
                if (!selected) emitAction('switchDiagram', { path: diagram.path });
            });
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        const rect = trigger.getBoundingClientRect();
        const menuWidth = Math.max(160, rect.width);
        menu.style.width = `${menuWidth}px`;
        menu.style.left = `${Math.min(rect.left, window.innerWidth - menuWidth - 8)}px`;
        menu.style.top = `${rect.bottom + 6}px`;
        trigger.setAttribute('aria-expanded', 'true');
        openDiagramMenu = menu;
    };

    const normalizeDialogs = (root = document) => {
        const dialogs = [];
        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.('.geDialog, .picker-dialog')) dialogs.push(root);
        root.querySelectorAll?.('.geDialog, .picker-dialog').forEach((dialog) => dialogs.push(dialog));
        dialogs.forEach((dialog) => {
            requestAnimationFrame(() => {
                dialog.classList.toggle(
                    'prota-dialog-scrollable',
                    dialog.scrollHeight > window.innerHeight - 48
                );
            });
        });
    };

    const renderIntegratedControls = () => {
        const menubar = document.querySelector('.geMenubarContainer');
        if (!menubar) return false;
        const nativeButtonContainer = menubar.querySelector('.geButtonContainer');

        const saveButton = nativeButtonContainer?.querySelector('.geEmbedBtn');
        if (saveButton && !saveButton.classList.contains('prota-drawio-save-button')) {
            saveButton.classList.add('prota-drawio-save-button');
            saveButton.setAttribute('aria-label', '保存');
            saveButton.title = saveButton.title || '保存';
            saveButton.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path>
                    <path d="M17 21v-8H7v8M7 3v5h8"></path>
                </svg>
            `;
        }

        document.querySelectorAll('.geSidebarFooter .gePrimaryBtn').forEach((button) => {
            if (button.textContent.includes('更多图形') && button.textContent.trim() !== '更多图形') {
                button.textContent = '更多图形';
            }
        });

        let controls = menubar.querySelector('.prota-drawio-integrated-controls');
        const signature = JSON.stringify(controlState);
        if (controls && lastControlsSignature === signature) return true;

        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'prota-drawio-integrated-controls';
            controls.setAttribute('aria-label', '流程图文件与窗口操作');
            menubar.appendChild(controls);
        }

        controls.replaceChildren();
        lastControlsSignature = signature;
        const diagrams = Array.isArray(controlState.diagrams) ? controlState.diagrams : [];
        menubar.classList.toggle('prota-has-file-switch', diagrams.length > 0);
        document.body.classList.toggle('prota-drawio-readonly', Boolean(controlState.readOnly));
        document.body.classList.toggle('prota-drawio-full', controlState.editorMode === 'full');

        let leftControls = menubar.querySelector('.prota-drawio-left-controls');
        if (!leftControls) {
            leftControls = document.createElement('div');
            leftControls.className = 'prota-drawio-left-controls';
            menubar.insertBefore(leftControls, menubar.firstChild);
        }
        leftControls.replaceChildren();
        if (controlState.canExit) {
            const exitButton = document.createElement('button');
            exitButton.type = 'button';
            exitButton.className = 'prota-drawio-exit-button';
            exitButton.title = '退出流程图';
            exitButton.setAttribute('aria-label', '退出流程图');
            exitButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon('exit')}</svg>`;
            exitButton.addEventListener('click', () => emitAction('exitDiagram'));
            leftControls.appendChild(exitButton);
        }

        const modeSwitch = document.createElement('span');
        modeSwitch.className = 'prota-drawio-mode-switch';
        modeSwitch.setAttribute('aria-label', '编辑器界面模式');
        [
            ['compact', '简洁'],
            ['full', '完整']
        ].forEach(([mode, label]) => {
            const modeButton = document.createElement('button');
            modeButton.type = 'button';
            modeButton.className = `prota-drawio-mode-button${controlState.editorMode === mode ? ' is-active' : ''}`;
            modeButton.textContent = label;
            modeButton.setAttribute('aria-pressed', String(controlState.editorMode === mode));
            modeButton.addEventListener('click', () => {
                if (controlState.editorMode !== mode) emitAction('switchEditorMode', { mode });
            });
            modeSwitch.appendChild(modeButton);
        });
        leftControls.appendChild(modeSwitch);



        const windowActions = document.createElement('span');
        windowActions.className = 'prota-drawio-window-actions';

        const createButton = (action, name, title) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'prota-drawio-window-button';
            button.title = title;
            button.setAttribute('aria-label', title);
            button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon(name)}</svg>`;
            button.addEventListener('click', () => emitAction(action));
            return button;
        };

        windowActions.appendChild(createButton(
            'panelFullscreen',
            'panel',
            controlState.panelFullscreen ? '退出面板最大化' : '面板最大化'
        ));
        windowActions.appendChild(createButton(
            'browserFullscreen',
            'browser',
            controlState.browserFullscreen ? '退出浏览器全屏' : '浏览器全屏'
        ));
        if (!controlState.readOnly) {
            windowActions.appendChild(createButton('saveDiagram', 'save', '保存'));
        }
        controls.appendChild(windowActions);
        collapseCompactPanels();
        window.setTimeout(centerCanvas, 0);

        return true;
    };

    keepThemeLast();
    document.body?.classList.toggle('prota-drawio-preview', previewMode);

    const observer = new MutationObserver((mutations) => {
        const addedRuntimeStyle = mutations.some((mutation) =>
            Array.from(mutation.addedNodes).some((node) =>
                node.nodeType === Node.ELEMENT_NODE
                && node.id !== THEME_ID
                && ['LINK', 'STYLE'].includes(node.tagName)
            )
        );

        if (addedRuntimeStyle) keepThemeLast();
    });

    observer.observe(document.head, { childList: true });
    window.addEventListener('load', keepThemeLast, { once: true });

    const startMenuObserver = () => {
        normalizeMenuChrome();
        normalizeDialogs();
        renderIntegratedControls();

        const menuObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) normalizeMenuChrome(node);
                    if (node.nodeType === Node.ELEMENT_NODE) normalizeDialogs(node);
                });
            });
            renderIntegratedControls();
        });

        menuObserver.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) startMenuObserver();
    else document.addEventListener('DOMContentLoaded', startMenuObserver, { once: true });

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;

        let message;
        try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }

        if (message?.event === 'prota-controls') {
            const previousMode = controlState.editorMode;
            controlState = { ...controlState, ...(message.data || {}) };
            if (previousMode !== controlState.editorMode) {
                compactPanelsInitialized = false;
                window.clearInterval(compactPanelCloseTimer);
                compactPanelCloseTimer = null;
                document.body.classList.remove('prota-compact-initializing');
            }
            renderIntegratedControls();
            centerCanvas();
        } else if (message?.event === 'prota-center') {
            centerCanvas();
        }
    });

    document.addEventListener('click', closeDiagramMenu);
    window.addEventListener('resize', closeDiagramMenu);

    window.parent.postMessage(JSON.stringify({ event: 'prota-ready' }), window.location.origin);
})();
