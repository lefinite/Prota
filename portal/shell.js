/**
 * Readify Demo Shell Logic
 * Handles page/version switching and project management
 */

import { UnifiedSettings } from './modules/settings/index.js';
import { PRDModule } from './modules/prd/index.js?v=20261013-auto-polish-v1';
import { DrawioModule } from './modules/drawio/index.js?v=20260701-xmind-v8';
import { MindmapModule } from './modules/mindmap/index.js?v=20260701-xmind-v12';

let workspaceMetadata = null;
if (location.protocol !== 'file:' && !window.__READIFY_SHARE__) {
    try { const response = await fetch('/api/workspace'); if (response.ok) workspaceMetadata = await response.json(); } catch {}
}
function workspaceStorageKey(key) {
    return workspaceMetadata && !workspaceMetadata.legacy ? `${key}:${workspaceMetadata.id}` : key;
}

const WEB_FRAMEWORK_PREVIEW_BASE = '/src/templates/web-framework-previews';
const WEB_FRAMEWORK_SCREENSHOT_VERSION = '20260814-icon-refresh-v1';
const MOBILE_TEMPLATE_PREVIEW_BASE = '/src/templates/mobile-previews';
const MOBILE_TEMPLATE_SCREENSHOT_VERSION = '20260816-v2';

const NEW_PAGE_WEB_FRAMEWORKS = [
    {
        id: 'ant-design-skill',
        name: 'Ant Design',
        technology: 'React',
        description: '成熟专业的企业中后台风格',
        skillPath: 'src/templates/framework-skills/ant-design-skill/SKILL.md',
        previewDir: 'ant-design',
        preview: { background: '#f5f7fa', surface: '#ffffff', accent: '#1677ff', accentSecondary: '#69b1ff', text: '#1f1f1f', border: '#d9d9d9' }
    },
    {
        id: 'shadcn-prototype',
        name: 'shadcn/ui',
        technology: 'React',
        description: '极简现代的 AI 产品风格',
        skillPath: 'src/templates/framework-skills/shadcn-prototype/SKILL.md',
        previewDir: 'shadcn',
        preview: { background: '#fafafa', surface: '#ffffff', accent: '#18181b', accentSecondary: '#71717a', text: '#09090b', border: '#e4e4e7' }
    },
    {
        id: 'mantine-prototype',
        name: 'Mantine',
        technology: 'React',
        description: '清爽灵活的现代产品风格',
        skillPath: 'src/templates/framework-skills/mantine-prototype/SKILL.md',
        previewDir: 'mantine',
        preview: { background: '#f8f9fa', surface: '#ffffff', accent: '#228be6', accentSecondary: '#7950f2', text: '#212529', border: '#dee2e6' }
    },
    {
        id: 'semi-design-prototype',
        name: 'Semi Design',
        technology: 'React',
        description: '抖音系现代企业应用风格',
        skillPath: 'src/templates/framework-skills/semi-design-prototype/SKILL.md',
        previewDir: 'semi-design',
        preview: { background: '#f5f6f7', surface: '#ffffff', accent: '#0064fa', accentSecondary: '#f93920', text: '#1c1f23', border: '#dfe1e6' }
    },
    {
        id: 'arco-design-prototype',
        name: 'Arco Design',
        technology: 'React',
        description: '字节系现代中后台风格',
        skillPath: 'src/templates/framework-skills/arco-design-prototype/SKILL.md',
        previewDir: 'arco-design',
        preview: { background: '#f2f3f5', surface: '#ffffff', accent: '#165dff', accentSecondary: '#00b42a', text: '#1d2129', border: '#e5e6eb' }
    },
    {
        id: 'material-ui-prototype',
        name: 'MUI',
        technology: 'React',
        description: '经典 Google Material 风格',
        skillPath: 'src/templates/framework-skills/material-ui-prototype/SKILL.md',
        previewDir: 'material-ui',
        preview: { background: '#f7f9fc', surface: '#ffffff', accent: '#1976d2', accentSecondary: '#9c27b0', text: '#1a1a1a', border: '#dce1e7' }
    },
    {
        id: 'chakra-ui-prototype',
        name: 'Chakra UI',
        technology: 'React',
        description: '轻量简洁的自由设计风格',
        skillPath: 'src/templates/framework-skills/chakra-ui-prototype/SKILL.md',
        previewDir: 'chakra-ui',
        preview: { background: '#edf2f7', surface: '#ffffff', accent: '#319795', accentSecondary: '#805ad5', text: '#1a202c', border: '#cbd5e0' }
    },
    {
        id: 'tdesign-web-prototype',
        name: 'TDesign',
        technology: 'React',
        description: '腾讯系企业中后台风格',
        skillPath: 'src/templates/framework-skills/tdesign-web-prototype/SKILL.md',
        previewDir: 'tdesign-web',
        preview: { background: '#f3f3f3', surface: '#ffffff', accent: '#0052d9', accentSecondary: '#00a870', text: '#000000', border: '#dcdcdc' }
    },
    {
        id: 'element-plus-prototype',
        name: 'Element Plus',
        technology: 'Vue 3',
        description: '经典 Vue 中后台风格',
        skillPath: 'src/templates/framework-skills/element-plus-prototype/SKILL.md',
        previewDir: 'element-plus',
        preview: { background: '#f5f7fa', surface: '#ffffff', accent: '#409eff', accentSecondary: '#67c23a', text: '#303133', border: '#dcdfe6' }
    }
];


class DemoShell {
    constructor() {
        this.projects = null;
        this.activeProjectId = null;
        this.activePageId = null;
        this.currentView = 'projects';
        this.currentTopView = 'projects';
        this.templatesData = null;
        this.templateFilter = 'all';
        this.templateDeviceFilter = 'mobile';
        this.templateStatusFilter = 'enabled';
        this.templateSearchQuery = '';
        this.templateDesignSpecCache = new Map();
        this.projectSearchQuery = '';
        this.skillStatusFilter = 'enabled';
        this.skillSearchQuery = '';
        this.newPageStyleId = 'default';
        this.newPageFrameworkId = 'ant-design-skill';
        this.newPageTargetDevice = 'mobile';
        this.newPageStyleDropdownOpen = false;
        this.newPageStyleMenuEl = null;
        this.newPageFrameworkZoomEl = null;
        this.newPageGeneratedPrompt = '';
        try {
            const storedFramework = window.localStorage.getItem(workspaceStorageKey('readify:pending-framework'));
            if (NEW_PAGE_WEB_FRAMEWORKS.some((item) => item.id === storedFramework)) {
                this.newPageFrameworkId = storedFramework;
            }
        } catch {}
        this.skillImportModalOpen = false;
        this.templateDetailOpen = false;
        this.projectActionMenuOpenId = null;
        this.activeVersion = null;
        this._panelOpen = false;
        this.shareMenuOpen = false;
        this.shareSettingsOpen = false;
        this.settings = null;
        this.migrateShellLocationStorage();
        this.shareConfig = this.readShareConfig();
        this.isShareMode = Boolean(this.shareConfig.enabled);

        // Annotation mode state
        this.annotationMode = false;
        this._annotationRightClick = null;
        this.currentAnnotations = [];
        this.visibleAnnotations = [];
        this.annotationListScope = this.readAnnotationListScope();
        this.annotationDrawerEnabled = this.isShareMode
            ? false
            : this.readDrawerPreference();
        this.docDrawerMode = this.isShareMode
            ? 'prd'
            : this.readDocDrawerMode();
        this.docDrawerExpanded = this.docDrawerMode === 'prd';
        this.prdDrawerWidth = this.readPrdDrawerWidth();
        if (Number.isFinite(this.prdDrawerWidth)) {
            document.documentElement.style.setProperty('--prd-drawer-width', `${this.prdDrawerWidth}px`);
        }
        this.prdDrawerFullscreen = false;
        this.diagramEditorReturnState = null;
        this.mindmapEditorReturnState = null;
        this._prdDrawerResizeState = null;
        this.prdModule = new PRDModule(this);
        this.drawioModule = new DrawioModule(this);
        this.mindmapModule = new MindmapModule(this);
        this._diagramCardClickHandler = (event) => {
            const trigger = event.target.closest?.('[data-prd-open-diagram]');
            if (!trigger) return;
            event.preventDefault();
            event.stopPropagation();
            this.openEmbeddedDiagram(trigger.dataset.prdOpenDiagram || '');
        };
        document.addEventListener('click', this._diagramCardClickHandler);
        this._mindmapCardClickHandler = (event) => {
            const trigger = event.target.closest?.('[data-prd-open-mindmap]');
            if (!trigger) return;
            event.preventDefault();
            event.stopPropagation();
            this.openEmbeddedMindmap(trigger.dataset.prdOpenMindmap || '');
        };
        document.addEventListener('click', this._mindmapCardClickHandler);
        this.prdEditorLayout = this.readPrdEditorLayout();
        this.prdScreenshotSaving = false;
        this._prdLoadToken = 0;
        this.annotationPanel = null;
        this.annotationLinkPanel = null;
        this.annotationCopyPanel = null;
        this.annotationHoverBox = null;
        this.pendingAnnotation = null;
        this._annotationToggleTs = 0;
        this._annotationRefreshRaf = null;
        this._iframeMutationObserver = null;
        this._iframeRefreshListeners = [];
        this._annotationMarkerNodes = new Map();
        this.activeAnnotationSourceIndex = null;
        this._annotationFocusTimer = null;

        // Feedback collection state
        this.feedbackItems = [];
        this.pendingFeedbackItem = null;

        this.agentDebugMode = new URLSearchParams(window.location.search).has('agentDebug');
        this.agentApiBase = 'http://127.0.0.1:8081';
        this.agentApi = new ReadifyAgent.ApiClient({ baseURL: this.agentApiBase });
        this.agentProviderPresets = AGENT_PROVIDER_PRESET_FALLBACK;
        this.agentAvailableSkills = AGENT_SKILL_FALLBACK;
        this.skillManagementSkills = [];
        this.agentAvailableCommands = AGENT_COMMAND_FALLBACK;
        this.agentSdkInfo = null;
        this.agentSessionId = this.readAgentStorage('session-id', null);
        this.agentSessionProviderConfig = null;
        this.agentSessionScope = 'page';
        this.agentSessionsList = [];
        this.agentSessionSearch = '';
        this.agentSessionPageSize = 30;
        this.agentSessionNextCursor = null;
        this.agentSessionHasMore = false;
        this.agentSessionListLoading = false;
        this._agentSessionListRequestId = 0;
        this._agentSessionSearchTimer = null;
        this.agentWorkbenchOpen = this.isShareMode ? false : this.readAgentStorage('workbench-open', false);
        this.agentPanelWidth = this.readAgentStorage('panel-width', 660);
        this._agentResizeState = null;
        this._resizeAnimationFrame = null;
        this.agentConfigModalOpen = false;
        this.writeAgentStorage('config-open', false);
        this.agentProviderPersistenceReady = false;
        this._agentProviderPersistTimer = null;
        this.agentProviderStore = new ReadifyAgent.ProviderConfigStore({
            presets: this.agentProviderPresets,
            readStorage: (key, fallback) => this.readAgentStorage(key, fallback),
            writeStorage: (key, value) => this.writeAgentStorage(key, value),
            onPersist: () => this.scheduleAgentProviderPersistence()
        });
        this.agentProviderStore.load();
        this.syncAgentProviderStoreState();
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
        this.agentActiveSkill = null;
        this.agentSkillMenuOpen = false;
        this.agentCommandMenuOpen = false;
        this.agentCommandQuery = '';
        this.agentSelectedCommandIndex = 0;
        this.agentInputComposing = false;
        this.agentInputLastCompositionAt = 0;
        this.agentRecentCommands = this.readAgentStorage('recent-commands', []);
        this.agentSessionDrawerOpen = this.readAgentStorage('session-drawer-open', false);
        this.trashModalOpen = false;
        this.pageActionMenuOpenId = null;
        this.agentTimelineEvents = [];
        this.agentTimelineLoading = false;
        this.agentPendingApproval = null;
        this.agentPendingQuestion = null;
        this.agentLastQuestionAnsweredAt = null;
        this.agentConnectionTestResult = null;
        this.agentTestingConnection = false;
        this.agentFetchingModels = false;
        this.agentAttachments = [];
        this.agentAttachmentLimit = 4;
        this.agentAttachmentMaxBytes = 8 * 1024 * 1024;
        this.agentAttachmentDragDepth = 0;
        this._agentImageNoticeResolve = null;
        this.agentPrdContext = null;
        this.agentRunState = this.getDefaultAgentRunState();
        this.agentAutoScroll = true;
        this.agentShowJumpLatest = false;
        this.agentEventStreamAbortController = null;
        this.agentSessionStreamAbortController = null;
        this.agentTicker = null;
        this.agentPetState = '';
        this.agentPetSourceState = '';
        this.agentPetBreakTimer = null;
        this.agentPetHideTimer = null;
        this.agentPetFrameTimer = null;
        this.agentPetFrameIndex = 0;
        this.agentPetGeneration = 0;
        this.agentPetHydrated = false;
        this._agentLiveDemoRefreshTimer = null;
        this._agentLiveProjectRefreshPromise = null;
        this._needsFullTimelineRebuild = true;
        this._agentTimelinePatchRaf = null;
        this._agentRenderedTimelineSignature = '';
        this._agentWorkbenchHydrateRaf = null;
        this._agentWorkbenchHydrateTimer = null;
        this._agentSessionPrewarmIdle = null;
        this._agentFeedbackToggleAnchors = new WeakMap();
        // DOM Elements
        this.sidebar = document.querySelector('.sidebar');
        this.sidebarHeader = document.querySelector('.sidebar-header');
        this.projectNavSection = document.getElementById('projectNavSection');
        this.projectListEl = document.getElementById('projectList');
        this.addProjectBtn = document.getElementById('addProjectBtn');
        this.pageNavSection = document.getElementById('pageNavSection');
        this.backToProjectsBtn = document.getElementById('backToProjectsBtn');
        this.pageListEl = document.getElementById('pageList');
        this.addPageBtn = document.getElementById('addPageBtn');
        this.addFolderBtn = document.getElementById('addFolderBtn');
        this.pageDragState = null;
        this.trashToggleBtn = document.getElementById('trashToggleBtn');
        this.trashCountEl = document.getElementById('trashCount');
        this.trashModal = document.getElementById('trashModal');
        this.trashModalClose = document.getElementById('trashModalClose');
        this.trashEmptyStateEl = document.getElementById('trashEmptyState');
        this.trashListEl = document.getElementById('trashList');
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmModalTitle = document.getElementById('confirmModalTitle');
        this.confirmModalMessage = document.getElementById('confirmModalMessage');
        this.confirmModalOk = document.getElementById('confirmModalOk');
        this.confirmModalCancel = document.getElementById('confirmModalCancel');
        this._confirmResolve = null;
        this.renameModal = document.getElementById('renameModal');
        this.renameModalInput = document.getElementById('renameModalInput');
        this.renameModalOk = document.getElementById('renameModalOk');
        this.renameModalCancel = document.getElementById('renameModalCancel');
        this._renameResolve = null;
        this.currentPageNameEl = document.getElementById('currentPageName');
        this.mainIframe = document.getElementById('mainIframe');
        this.toastEl = document.getElementById('toast');
        this.viewportContainer = document.querySelector('.viewport-container');
        this.viewportStage = document.querySelector('.viewport-stage');
        this.annotationMarkerLayer = document.getElementById('annotationMarkerLayer');
        this.annotationDrawer = document.getElementById('annotationDrawer');
        if (this.annotationDrawer) {
            this.annotationDrawer.classList.remove('has-pinned-toc');
        }
        this.annotationDrawerBody = document.getElementById('annotationDrawerBody');
        this.annotationDrawerMeta = document.getElementById('annotationDrawerMeta');
        this.docDrawerEyebrow = document.getElementById('docDrawerEyebrow');
        this.docDrawerTitle = document.getElementById('docDrawerTitle');
        this.docTabs = Array.from(document.querySelectorAll('[data-doc-tab]'));
        this.prdAiBtn = document.getElementById('prdAiBtn');
        this.prdEditBtn = document.getElementById('prdEditBtn');
        this.prdSaveBtn = document.getElementById('prdSaveBtn');
        this.prdCancelEditBtn = document.getElementById('prdCancelEditBtn');
        this.prdOpenNewTabBtn = document.getElementById('prdOpenNewTabBtn');
        this.prdDownloadBtn = document.getElementById('prdDownloadBtn');
        this.prdExpandBtn = document.getElementById('prdExpandBtn');
        this.prdDrawerResizeHandle = document.getElementById('prdDrawerResizeHandle');
        this.docVisibilityBtn = document.getElementById('docVisibilityBtn');
        this.shareMenuWrapper = document.getElementById('shareMenuWrapper');
        this.shareMenuTrigger = document.getElementById('shareMenuTrigger');
        this.shareMenu = document.getElementById('shareMenu');
        this.openNewTabBtn = document.getElementById('openNewTabBtn');
        
        // Share settings elements
        this.shareSettingsBtn = document.getElementById('shareSettingsBtn');
        this.shareSettingsModal = document.getElementById('shareSettingsModal');
        this.shareSettingsForm = document.getElementById('shareSettingsForm');
        this.publicDomainInput = document.getElementById('publicDomainInput');
        this.staticDomainInput = document.getElementById('staticDomainInput');
        this.gitAutoPushCheckbox = document.getElementById('gitAutoPushCheckbox');
        this.settingsModalClose = document.getElementById('settingsModalClose');
        this.settingsCancelBtn = document.getElementById('settingsCancelBtn');
        this.settingsHelpToggleBtn = document.getElementById('settingsHelpToggleBtn');
        this.settingsHelpLinkBtn = document.getElementById('settingsHelpLinkBtn');
        this.settingsHelpPane = document.getElementById('settingsHelpPane');
        this.settingsHelpOpen = true;
        this.sharePublicSubtext = document.getElementById('sharePublicSubtext');
        this.shareStaticSubtext = document.getElementById('shareStaticSubtext');
        this.vercelAutoConfigBtn = document.getElementById('vercelAutoConfigBtn');
        this.agentWorkbenchToggle = document.getElementById('agentWorkbenchToggle');
        this.agentPetStage = document.getElementById('agentPetStage');
        this.agentPetImage = document.getElementById('agentPetImage');
        this.agentWorkbench = document.getElementById('agentWorkbench');
        if (this.sidebarHeader && this.agentWorkbench && !this.sidebar?.contains(this.agentWorkbench)) {
            this.sidebarHeader.insertAdjacentElement('afterend', this.agentWorkbench);
        }
        this.agentConfigToggle = document.getElementById('agentConfigToggle');
        this.agentModelToggle = document.getElementById('agentModelToggle');
        this.agentModelLabel = document.getElementById('agentModelLabel');
        this.agentModelDropdown = document.getElementById('agentModelDropdown');
        this.agentModelDropdownOpen = false;
        this.agentPlanModeToggle = document.getElementById('agentPlanModeToggle');
        this.agentPermissionToggle = document.getElementById('agentPermissionToggle');
        this.agentPermissionLabel = document.getElementById('agentPermissionLabel');
        this.agentPermissionDropdown = document.getElementById('agentPermissionDropdown');
        this.agentPermissionDropdownOpen = false;
        this.agentClearBtn = null;
        this.agentArchiveBtn = null;
        this.agentWorkbenchClose = document.getElementById('agentWorkbenchClose');
        this.agentResizeHandle = document.getElementById('agentResizeHandle');
        this.agentNewSessionBtn = document.getElementById('agentNewSessionBtn');
        this.agentSessionDrawerToggle = document.getElementById('agentSessionDrawerToggle');
        this.agentSessionSearchInput = document.getElementById('agentSessionSearchInput');
        this.agentSessionSearchToggle = document.getElementById('agentSessionSearchToggle');
        this.agentSessionSidebarHeader = document.getElementById('agentSessionSidebarHeader');
        this.agentSessionSearchOpen = false;
        this.agentSessionList = document.getElementById('agentSessionList');
        this.agentTimeline = document.getElementById('agentTimeline');
        this.agentImagePreviewModal = document.getElementById('agentImagePreviewModal');
        this.agentImagePreviewImage = document.getElementById('agentImagePreviewImage');
        this.agentImagePreviewCaption = document.getElementById('agentImagePreviewCaption');
        this.agentImagePreviewClose = document.getElementById('agentImagePreviewClose');
        this.agentImagePreviewTrigger = null;
        this.agentStatusContext = document.getElementById('agentStatusContext');
        this.agentStatusPill = document.getElementById('agentStatusPill');
        this.agentStatusDetail = null;
        this.agentRunTimer = document.getElementById('agentRunTimer');
        this.agentBindPageBtn = document.getElementById('agentBindPageBtn');
        this.agentAutocompleteDropdown = document.getElementById('agentAutocompleteDropdown');
        this.agentAutocompleteOpen = false;
        this.agentAutocompleteQuery = '';
        this.agentAutocompleteIndex = 0;
        this.agentAutocompleteSelectedPage = null;
        this.agentBackgroundHint = null;
        this.agentConfigModal = document.getElementById('agentConfigModal');
        this.agentConfigClose = document.getElementById('agentConfigClose');
        this.agentProviderSelect = null; // removed; using list UI now
        this.agentApiTypeInput = document.getElementById('agentApiTypeInput');
        this.agentModelInput = document.getElementById('agentModelInput');
        this.agentCustomModelInput = document.getElementById('agentCustomModelInput');
        this.agentModelOptions = document.getElementById('agentModelOptions');
        this.agentBaseUrlInput = document.getElementById('agentBaseUrlInput');
        this.agentEndpointOptions = document.getElementById('agentEndpointOptions');
        this.agentApiKeyInput = document.getElementById('agentApiKeyInput');
        this.agentSdkOptionsInput = document.getElementById('agentSdkOptionsInput');
        this.agentSdkOptionsFormatBtn = document.getElementById('agentSdkOptionsFormatBtn');
        this.agentSdkOptionsResetBtn = document.getElementById('agentSdkOptionsResetBtn');
        this.agentSdkOptionsPresetBtn = document.getElementById('agentSdkOptionsPresetBtn');
        this.agentSdkOptionsStatus = document.getElementById('agentSdkOptionsStatus');
        this.agentTestConnectionBtn = document.getElementById('agentTestConnectionBtn');
        this.agentCheckBalanceBtn = document.getElementById('agentCheckBalanceBtn');
        this.agentFetchModelsBtn = document.getElementById('agentFetchModelsBtn');
        this.agentPresetDocsBtn = document.getElementById('agentPresetDocsBtn');
        this.agentConnectionTestResultEl = document.getElementById('agentConnectionTestResult');
        this.agentBalanceResultEl = document.getElementById('agentBalanceResult');
        this.agentDebugTools = document.getElementById('agentDebugTools');
        // New provider management DOM refs
        this.providerCustomList = document.getElementById('providerCustomList');
        this.providerFormEmpty = document.getElementById('providerFormEmpty');
        this.providerFormContent = document.getElementById('providerFormContent');
        this.agentProviderPresetSelect = document.getElementById('agentProviderPresetSelect');
        this.agentProviderPresetTrigger = document.getElementById('agentProviderPresetTrigger');
        this.agentProviderPresetValue = document.getElementById('agentProviderPresetValue');
        this.agentProviderPresetOptions = document.getElementById('agentProviderPresetOptions');
        this.newProviderDraft = null;
        this.agentProviderNameInput = document.getElementById('agentProviderNameInput');
        this.addCustomProviderBtn = document.getElementById('addCustomProviderBtn');
        this.agentSaveProviderBtn = document.getElementById('agentSaveProviderBtn');
        this.agentDeleteProviderBtn = document.getElementById('agentDeleteProviderBtn');
        this.agentInterruptBtn = null;
        this.agentRetryBtn = null;
        this.agentJumpLatestBtn = document.getElementById('agentJumpLatestBtn');
        this.agentComposer = document.getElementById('agentComposer');
        this.agentActiveSkillBar = document.getElementById('agentActiveSkillBar');
        this.agentSkillMenuToggle = document.getElementById('agentSkillMenuToggle');
        this.agentSkillMenu = document.getElementById('agentSkillMenu');
        this.agentCommandMenu = document.getElementById('agentCommandMenu');
        this.agentInput = document.getElementById('agentInput');
        this.agentImageInput = document.getElementById('agentImageInput');
        this.agentImageUploadBtn = document.getElementById('agentImageUploadBtn');
        this.agentImageNoticeModal = document.getElementById('agentImageNoticeModal');
        this.agentImageNoticeMessage = document.getElementById('agentImageNoticeMessage');
        this.agentImageNoticeProvider = document.getElementById('agentImageNoticeProvider');
        this.agentImageNoticeModel = document.getElementById('agentImageNoticeModel');
        this.agentImageNoticeOk = document.getElementById('agentImageNoticeOk');
        this.agentImageNoticeCancel = document.getElementById('agentImageNoticeCancel');
        this.agentImageNoticeRemember = document.getElementById('agentImageNoticeRemember');
        this.agentAttachmentBar = document.getElementById('agentAttachmentBar');
        this.agentPrdContextBar = document.getElementById('agentPrdContextBar');
        this.agentSendBtn = document.getElementById('agentSendBtn');

        // Version panel elements
        this.versionSelectorWrap = document.querySelector('.version-selector-wrap');
        this.versionWrapper = document.querySelector('.version-panel-wrapper');
        this.versionTrigger = document.getElementById('versionTrigger');
        this.versionTriggerLabel = document.getElementById('versionTriggerLabel');
        this.versionPanel = document.getElementById('versionPanel');
        this.versionPanelList = document.getElementById('versionPanelList');
        this.panelForkBtn = document.getElementById('panelForkBtn');
        this.versionRefreshBtn = document.getElementById('versionRefreshBtn');

        // Page selector elements
        this.pageSelectorWrapper = document.querySelector('.page-selector-wrapper');
        this.pageSelectorTrigger = document.getElementById('pageSelectorTrigger');
        this.pageSelectorPanel = document.getElementById('pageSelectorPanel');
        this.pageSelectorPanelList = document.getElementById('pageSelectorPanelList');
        this._pageSelectorOpen = false;

        // Top-level tabs (项目 / 模板 / Skill)
        this.topTabsEl = document.getElementById('topTabs');
        this.projectsHomeView = document.getElementById('projectsHomeView');
        this.templatesHomeView = document.getElementById('templatesHomeView');
        this.skillsHomeView = document.getElementById('skillsHomeView');
        this.pageViewportContainer = document.getElementById('pageViewportContainer');
        this.projectGridEl = document.getElementById('projectGrid');
        this.projectsEmptyStateEl = document.getElementById('projectsEmptyState');
        this.homeNewProjectBtn = document.getElementById('homeNewProjectBtn');
        this.homeTrashBtn = document.getElementById('homeTrashBtn');
        this.homeTrashCountEl = document.getElementById('homeTrashCount');
        this.projectSearchInput = document.getElementById('projectSearchInput');
        this.templateGridEl = document.getElementById('templateGrid');
        this.templateDeviceFilterEl = document.getElementById('templateDeviceFilter');
        this.mobileTemplateCountEl = document.getElementById('mobileTemplateCount');
        this.webTemplateCountEl = document.getElementById('webTemplateCount');
        this.templatesEmptyStateEl = document.getElementById('templatesEmptyState');
        this.templateSearchInput = document.getElementById('templateSearchInput');
        this.templateStatusFilterEl = document.getElementById('templateStatusFilter');
        this.templateCategoryWrapper = document.getElementById('templateCategoryWrapper');
        this.templateCategoryTrigger = document.getElementById('templateCategoryTrigger');
        this.templateCategoryPopover = document.getElementById('templateCategoryPopover');
        this.templateCategorySearch = document.getElementById('templateCategorySearch');
        this.templateCategoryList = document.getElementById('templateCategoryList');
        this.templateCategoryLabel = document.getElementById('templateCategoryLabel');
        this.templateCategoryPopoverOpen = false;
        this.templateCategorySearchQuery = '';
        this.templatePreviewZoomEl = null;
        this.skillGridEl = document.getElementById('skillGrid');
        this.skillsEmptyStateEl = document.getElementById('skillsEmptyState');
        this.skillSearchInput = document.getElementById('skillSearchInput');
        this.skillStatusFilterEl = document.getElementById('skillStatusFilter');
        this.skillImportBtn = document.getElementById('skillImportBtn');
        this.skillImportModal = document.getElementById('skillImportModal');
        this.skillImportCancelBtn = document.getElementById('skillImportCancel');
        this.skillImportSaveBtn = document.getElementById('skillImportSave');
        this.skillImportDropZone = document.getElementById('skillImportDropZone');
        this.skillImportFolderInput = document.getElementById('skillImportFolderInput');
        this.skillImportDropHint = document.getElementById('skillImportDropHint');
        this.skillImportFolderPanel = document.getElementById('skillImportFolderPanel');
        this.skillImportUrlPanel = document.getElementById('skillImportUrlPanel');
        this.skillImportUrlInput = document.getElementById('skillImportUrlInput');
        this.skillImportSegmented = this.skillImportModal?.querySelectorAll('[data-skill-import-mode]') || null;
        this.skillImportMode = 'folder';
        this.pendingSkillFiles = null;
        this.templateDetailModal = document.getElementById('templateDetailModal');
        this.templateDetailBody = document.getElementById('templateDetailBody');
        this.projectCreateModal = document.getElementById('projectCreateModal');
        this.projectCreateForm = document.getElementById('projectCreateForm');
        this.projectCreateNameInput = document.getElementById('projectCreateName');
        this.projectCreateCancelBtn = document.getElementById('projectCreateCancel');

        this.installFastAgentToggle();
        
        this.jumpBindingTargetSelector = null;
        this.jumpBindingTargetPageId = '';
        this.jumpBindingExistingPageId = '';
        this.annotationLinkSaving = false;

        this.unifiedSettings = new UnifiedSettings(this);
        this.init();
    }

    get prdDocument() {
        return this.prdModule?.manager?.state;
    }
    
    set prdDocument(val) {
        if (this.prdModule?.manager) {
            this.prdModule.manager.state = val;
        }
    }

    get prdSlashCommand() {
        return this.prdModule?.slashCommand;
    }

    set prdSlashCommand(val) {
        if (this.prdModule) {
            this.prdModule.slashCommand = val;
        }
    }

    async loadData() {
        if (this.isShareMode) { this.projects = this.normalizeProjectsData(this.getDefaultData()); return; }
        if (this.unifiedSettings?.workspace?.available === false) { this.projects = { projects: [] }; return; }
        const cacheBuster = `?t=${Date.now()}`;
        try {
            const response = await fetch('/data/projects.json' + cacheBuster);
            if (response.ok) {
                this.projects = this.normalizeProjectsData(await response.json());
            } else {
                this.projects = this.projects || this.normalizeProjectsData(this.getDefaultData());
            }
        } catch (error) {
            console.warn('Projects metadata fetch failed:', error);
            this.projects = this.projects || this.normalizeProjectsData(this.getDefaultData());
        }
    }

    readShareConfig() {
        const raw = window.__READIFY_SHARE__ && typeof window.__READIFY_SHARE__ === 'object'
            ? window.__READIFY_SHARE__
            : {};
        const params = new URLSearchParams(window.location.search);
        const rawShareType = String(raw.shareType || params.get('shareType') || raw.mode || params.get('shareMode') || params.get('share') || 'local').toLowerCase();
        const shareType = raw.public === true || rawShareType === 'public'
            ? 'public'
            : (rawShareType === 'static' ? 'static' : 'local');

        const pageId = String(raw.pageId || params.get('pageId') || params.get('page') || '').trim();
        const version = String(raw.version || params.get('version') || '').trim();
        const folderId = String(raw.folderId || params.get('folderId') || '').trim();
        const isFolderMode = raw.mode === 'folder' || Boolean(folderId && Array.isArray(raw.pages));
        const enabled = Boolean(raw.enabled || pageId || isFolderMode || params.has('share') || params.has('shareMode'));

        return {
            enabled,
            mode: isFolderMode ? 'folder' : 'page',
            projectId: String(raw.projectId || params.get('projectId') || '').trim(),
            projectName: String(raw.projectName || params.get('projectName') || '').trim(),
            pageId,
            pageName: String(raw.pageName || params.get('pageName') || '').trim(),
            version,
            folderId,
            folderName: String(raw.folderName || params.get('folderName') || '').trim(),
            shareType,
            generatedAt: String(raw.generatedAt || '').trim(),
            annotations: Array.isArray(raw.annotations) ? raw.annotations : null,
            prdContent: typeof raw.prdContent === 'string' ? raw.prdContent : null,
            prdPath: typeof raw.prdPath === 'string' ? raw.prdPath : null,
            prdFilename: typeof raw.prdFilename === 'string' ? raw.prdFilename : null,
            diagramContent: typeof raw.diagramContent === 'string' ? raw.diagramContent : null,
            diagramPath: typeof raw.diagramPath === 'string' ? raw.diagramPath : null,
            diagramFilename: typeof raw.diagramFilename === 'string' ? raw.diagramFilename : null,
            diagrams: Array.isArray(raw.diagrams) ? raw.diagrams : null,
            mindmapContent: typeof raw.mindmapContent === 'string' ? raw.mindmapContent : null,
            mindmapPath: typeof raw.mindmapPath === 'string' ? raw.mindmapPath : null,
            mindmapFilename: typeof raw.mindmapFilename === 'string' ? raw.mindmapFilename : null,
            mindmaps: Array.isArray(raw.mindmaps) ? raw.mindmaps : null,
            folders: Array.isArray(raw.folders) ? raw.folders : null,
            pages: Array.isArray(raw.pages) ? raw.pages : null
        };
    }

    applyShareModeData() {
        if (!this.isShareMode || !this.projects) return;

        if (this.shareConfig.mode === 'folder') {
            this.applyShareModeFolderData();
            return;
        }

        // Set activeProjectId first so that this.projects.pages proxy works
        const shareProjectId = this.shareConfig.projectId
            || this.projects.projects?.find(p => !p.deleted)?.id
            || this.projects.projects?.[0]?.id
            || 'readify';
        this.activeProjectId = shareProjectId;

        const requestedPageId = this.shareConfig.pageId;
        let sourcePage = this.getPageRecord(requestedPageId);
        if (!sourcePage) {
            // Check other projects just in case
            for (const proj of this.projects.projects || []) {
                const found = proj.pages?.find(p => p.id === requestedPageId);
                if (found) {
                    sourcePage = found;
                    break;
                }
            }
        }
        if (!sourcePage) {
            sourcePage = this.projects.pages?.[0];
        }
        if (!sourcePage) {
            // Fallback for static/offline shares where project list is empty or doesn't match
            sourcePage = {
                id: requestedPageId || 'dummy',
                name: this.shareConfig.pageName || requestedPageId || 'Demo Page',
                versions: this.shareConfig.version ? [this.shareConfig.version] : ['v1'],
                activeVersion: this.shareConfig.version || 'v1',
                deleted: false,
                deletedAt: null,
                versionStates: {
                    [this.shareConfig.version || 'v1']: {
                        deleted: false,
                        deletedAt: null
                    }
                }
            };
        }

        const availableVersions = this.getAvailableVersions(sourcePage);
        const requestedVersion = this.shareConfig.version;
        const activeVersion = requestedVersion && sourcePage.versions?.includes(requestedVersion)
            ? requestedVersion
            : (availableVersions[0] || sourcePage.versions?.[0] || 'v1');

        const sourceState = sourcePage.versionStates?.[activeVersion] || {
            deleted: false,
            deletedAt: null
        };
        const sharePage = {
            ...sourcePage,
            name: this.shareConfig.pageName || sourcePage.name || sourcePage.id,
            versions: [activeVersion],
            activeVersion,
            deleted: false,
            deletedAt: null,
            versionStates: {
                [activeVersion]: {
                    deleted: Boolean(sourceState.deleted),
                    deletedAt: sourceState.deletedAt || null
                }
            }
        };

        this.shareConfig.pageId = sharePage.id;
        this.shareConfig.version = activeVersion;
        const projectName = (this.projects.projects || []).find(p => p.id === shareProjectId)?.name || shareProjectId;
        this.projects = this.normalizeProjectsData({
            projects: [{
                id: shareProjectId,
                name: projectName,
                deleted: false,
                deletedAt: null,
                pages: [sharePage]
            }],
            activeProjectId: shareProjectId,
            activePageId: sharePage.id
        });
    }

    applyShareModeFolderData() {
        const cfg = this.shareConfig;
        const shareProjectId = cfg.projectId
            || this.projects.projects?.find(p => !p.deleted)?.id
            || this.projects.projects?.[0]?.id
            || 'readify';
        this.activeProjectId = shareProjectId;

        const rawPages = Array.isArray(cfg.pages) ? cfg.pages : [];
        const rawFolders = Array.isArray(cfg.folders) ? cfg.folders : [];

        if (rawPages.length === 0) {
            // Nothing to share — fall back to whatever the host project has.
            return;
        }

        const sharePages = rawPages.map(p => ({
            id: String(p.id),
            name: String(p.name || p.id),
            versions: [String(p.version || 'v1')],
            activeVersion: String(p.version || 'v1'),
            deleted: false,
            deletedAt: null,
            versionStates: {
                [String(p.version || 'v1')]: { deleted: false, deletedAt: null }
            },
            parentId: p.parentId ? String(p.parentId) : null,
            order: Number(p.order) || 0,
            targetDevice: this.normalizePageTargetDevice(p.targetDevice),
            _shareMeta: {
                demoPath: p.demoPath,
                annotations: Array.isArray(p.annotations) ? p.annotations : [],
                prdContent: typeof p.prdContent === 'string' ? p.prdContent : '',
                prdPath: typeof p.prdPath === 'string' ? p.prdPath : '',
                prdFilename: typeof p.prdFilename === 'string' ? p.prdFilename : '',
                documents: Array.isArray(p.documents) ? p.documents : [],
                diagramContent: typeof p.diagramContent === 'string' ? p.diagramContent : '',
                diagramPath: typeof p.diagramPath === 'string' ? p.diagramPath : '',
                diagramFilename: typeof p.diagramFilename === 'string' ? p.diagramFilename : '',
                diagrams: Array.isArray(p.diagrams) ? p.diagrams : [],
                mindmapContent: typeof p.mindmapContent === 'string' ? p.mindmapContent : '',
                mindmapPath: typeof p.mindmapPath === 'string' ? p.mindmapPath : '',
                mindmapFilename: typeof p.mindmapFilename === 'string' ? p.mindmapFilename : '',
                mindmaps: Array.isArray(p.mindmaps) ? p.mindmaps : []
            }
        }));

        const shareFolders = rawFolders.map(f => ({
            id: String(f.id),
            name: String(f.name || '未命名文件夹'),
            parentId: f.parentId ? String(f.parentId) : null,
            order: Number(f.order) || 0,
            collapsed: Boolean(f.collapsed),
            deleted: false,
            deletedAt: null
        }));

        const firstPage = [...sharePages].sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name), 'zh-CN'))[0];
        this.shareConfig.pageId = firstPage.id;
        this.shareConfig.version = firstPage.activeVersion;

        const projectName = cfg.projectName
            || (this.projects.projects || []).find(p => p.id === shareProjectId)?.name
            || shareProjectId;
        this.projects = this.normalizeProjectsData({
            projects: [{
                id: shareProjectId,
                name: projectName,
                deleted: false,
                deletedAt: null,
                pages: sharePages,
                folders: shareFolders
            }],
            activeProjectId: shareProjectId,
            activePageId: firstPage.id
        });
    }

    getActiveFolderSharePageMeta(pageId, version) {
        if (!this.isShareMode || this.shareConfig.mode !== 'folder') return null;
        const page = (this.projects?.pages || []).find(p => p.id === pageId);
        if (!page) return null;
        return page._shareMeta || null;
    }

    getSharePageCount() {
        if (!this.isShareMode) return 0;
        if (Array.isArray(this.shareConfig.pages)) {
            return this.shareConfig.pages.length;
        }
        return this.shareConfig.pageId || this.projects?.pages?.length ? 1 : 0;
    }

    applyShareModeDrawerDefaults() {
        if (!this.isShareMode) return;

        this.annotationDrawerEnabled = false;
        this.docDrawerMode = 'prd';
        this.useDefaultPrdDrawerWidth({ expanded: false });
    }

    applyShareModeChrome() {
        document.body.classList.toggle('is-share-mode', this.isShareMode);
        document.body.classList.toggle('is-share-mode--folder', this.isShareMode && this.shareConfig.mode === 'folder');
        document.body.classList.toggle('is-share-mode--multi-page', this.getSharePageCount() > 1);
        if (!this.isShareMode) return;

        if (this.shareConfig.mode === 'folder') {
            const folderName = this.shareConfig.folderName || 'Shared Folder';
            document.title = `${folderName} · Prota Share`;
        } else {
            const pageName = this.shareConfig.pageName || this.getPageRecord()?.name || this.shareConfig.pageId || 'Prota';
            const versionLabel = this.shareConfig.version ? this.shareConfig.version.toUpperCase() : '';
            document.title = `${pageName}${versionLabel ? ` ${versionLabel}` : ''} · Prota Share`;
        }

        if (!document.querySelector('link[href*="prd.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/portal/modules/prd/prd.css';
            document.head.appendChild(link);
        }
    }

    async discoverVersions(pageId) {
        try {
            const response = await fetch(`/src/pages/${this.activeProjectId || 'readify'}/${pageId}/`);
            if (!response.ok) return null;
            const html = await response.text();
            const versions = [];
            const regex = /href="(v\d+)\/"/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                versions.push(match[1]);
            }
            if (versions.length === 0) return null;
            versions.sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)));
            return versions;
        } catch {
            return null;
        }
    }

    async discoverPages() {
        try {
            const response = await fetch(`/src/pages/${this.activeProjectId || 'readify'}/`);
            if (!response.ok) return null;
            const html = await response.text();
            const pages = [];
            const regex = /href="([^"?#]+)\/"/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                const name = match[1];
                if (!name.startsWith('.') && name !== 'reader') {
                    pages.push(name);
                }
            }
            return pages;
        } catch {
            return null;
        }
    }

    async syncFromDisk() {
        if (this.isShareMode) return;
        try {
            const response = await fetch('/api/sync', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                this.projects = this.normalizeProjectsData(data);
            }
        } catch (error) {
            console.error('Failed to sync from disk:', error);
        }
    }

    normalizeVersionStates(states = {}, versions = []) {
        const normalized = {};
        versions.forEach((version) => {
            const state = states?.[version] || {};
            normalized[version] = {
                deleted: Boolean(state.deleted),
                deletedAt: state.deletedAt || null
            };
        });
        return normalized;
    }

    normalizePageTargetDevice(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'web' ? 'web' : 'mobile';
    }

    getPageDeviceLabel(value = this.newPageTargetDevice) {
        return this.normalizePageTargetDevice(value) === 'web' ? 'Web B 端' : '手机端';
    }

    normalizeProjectsData(data) {
        let rawProjects = Array.isArray(data?.projects) ? data.projects : [];
        if (rawProjects.length === 0 && Array.isArray(data?.pages)) {
            // Old format: wrap pages into a default "readify" project
            rawProjects = [{
                id: 'readify',
                name: 'Readify',
                deleted: false,
                deletedAt: null,
                pages: data.pages
            }];
        }

        const normalizedProjects = rawProjects.map(project => {
            const rawFolders = Array.isArray(project.folders) ? project.folders : [];
            const folderIds = new Set(rawFolders.map(folder => String(folder.id || '')).filter(Boolean));
            const normalizeParentId = (parentId, selfId = '') => {
                const value = String(parentId || '').trim();
                return value && value !== selfId && folderIds.has(value) ? value : null;
            };
            const folders = rawFolders.map((folder, index) => ({
                id: String(folder.id || `folder-${index + 1}`),
                name: String(folder.name || '未命名文件夹'),
                parentId: normalizeParentId(folder.parentId, String(folder.id || '')),
                order: Number.isFinite(Number(folder.order)) ? Number(folder.order) : (index + 1) * 1000,
                collapsed: Boolean(folder.collapsed),
                deleted: Boolean(folder.deleted),
                deletedAt: folder.deletedAt || null
            }));
            const normalizedFolderIds = new Set(folders.filter(folder => !folder.deleted).map(folder => folder.id));
            return {
                id: project.id,
                name: project.name || project.id,
                deleted: Boolean(project.deleted),
                deletedAt: project.deletedAt || null,
                folders,
                pages: (Array.isArray(project.pages) ? project.pages : []).map((page, index) => ({
                    ...page,
                    parentId: normalizedFolderIds.has(String(page.parentId || '')) ? String(page.parentId) : null,
                    order: Number.isFinite(Number(page.order)) ? Number(page.order) : (index + 1) * 1000,
                    targetDevice: this.normalizePageTargetDevice(page.targetDevice),
                    deleted: Boolean(page.deleted),
                    deletedAt: page.deletedAt || null,
                    versions: Array.isArray(page.versions) ? page.versions : [],
                    versionStates: this.normalizeVersionStates(page.versionStates || {}, page.versions || [])
                }))
            };
        });

        const activeProjectId = data?.activeProjectId || normalizedProjects.find(p => !p.deleted)?.id || normalizedProjects[0]?.id || 'readify';

        const result = {
            projects: normalizedProjects,
            activeProjectId: activeProjectId,
            activePageId: data?.activePageId || data?.activePage || ''
        };

        // Proxy properties for backwards compatibility
        Object.defineProperty(result, 'pages', {
            get: () => {
                const activeProj = normalizedProjects.find(p => p.id === this.activeProjectId);
                return activeProj ? activeProj.pages : [];
            },
            configurable: true,
            enumerable: true
        });

        Object.defineProperty(result, 'activePage', {
            get: () => {
                return this.activePageId;
            },
            set: (val) => {
                this.activePageId = val;
            },
            configurable: true,
            enumerable: true
        });

        return result;
    }

    getProjectRecord(projectId = this.activeProjectId) {
        return (this.projects?.projects || []).find((project) => project.id === projectId) || null;
    }

    getPageRecord(pageId = this.activePageId, projectId = this.activeProjectId) {
        const project = this.getProjectRecord(projectId);
        return project?.pages?.find((page) => page.id === pageId) || null;
    }

    resolvePageProject(pageId, version = null, preferredProjectId = this.activeProjectId) {
        if (!pageId) return null;
        const projects = this.projects?.projects || [];
        const hasVersion = (page) => !version || this.isUsablePageVersion(page, version) || page?.versions?.includes(version);
        const findInProject = (projectId) => {
            const project = projects.find((item) => item.id === projectId && !item.deleted);
            const page = project?.pages?.find((item) => item.id === pageId && !item.deleted && hasVersion(item));
            return page ? { project, page } : null;
        };

        return findInProject(preferredProjectId)
            || projects
                .filter((project) => !project.deleted)
                .map((project) => {
                    const page = project.pages?.find((item) => item.id === pageId && !item.deleted && hasVersion(item));
                    return page ? { project, page } : null;
                })
                .find(Boolean)
            || null;
    }

    getActivePagesSorted() {
        return this.getOrderedPageTreeItems()
            .filter((item) => item.type === 'page')
            .map((item) => item.page);
    }

    getActiveFolders(project = this.getProjectRecord()) {
        return [...(project?.folders || [])].filter((folder) => !folder.deleted);
    }

    comparePageTreeItems(left, right) {
        const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0;
        const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN');
    }

    getOrderedPageTreeItems(parentId = null, depth = 0, project = this.getProjectRecord(), { includeCollapsed = true } = {}) {
        if (!project) return [];
        const normalizedParentId = parentId || null;
        const folders = this.getActiveFolders(project)
            .filter((folder) => (folder.parentId || null) === normalizedParentId)
            .map((folder) => ({ type: 'folder', id: folder.id, name: folder.name, order: folder.order, folder, depth }));
        const pages = [...(project.pages || [])]
            .filter((page) => !page.deleted && (page.parentId || null) === normalizedParentId)
            .map((page) => ({ type: 'page', id: page.id, name: page.name || page.id, order: page.order, page, depth }));
        const items = [...folders, ...pages].sort((left, right) => this.comparePageTreeItems(left, right));
        return items.flatMap((item) => {
            if (item.type !== 'folder') return [item];
            if (!includeCollapsed && item.folder.collapsed) return [item];
            return [
                item,
                ...this.getOrderedPageTreeItems(item.folder.id, depth + 1, project, { includeCollapsed })
            ];
        });
    }

    isFolderDescendant(folderId, possibleAncestorId) {
        if (!folderId || !possibleAncestorId || folderId === possibleAncestorId) return folderId === possibleAncestorId;
        const project = this.getProjectRecord();
        let cursor = this.getActiveFolders(project).find((folder) => folder.id === folderId);
        while (cursor?.parentId) {
            if (cursor.parentId === possibleAncestorId) return true;
            cursor = this.getActiveFolders(project).find((folder) => folder.id === cursor.parentId);
        }
        return false;
    }

    createPageFolderId() {
        const existing = new Set(this.getActiveFolders().map((folder) => folder.id));
        let index = Date.now();
        let id = `folder-${index}`;
        while (existing.has(id)) {
            index += 1;
            id = `folder-${index}`;
        }
        return id;
    }

    getNextPageTreeOrder(parentId = null) {
        const project = this.getProjectRecord();
        const siblingOrders = [
            ...this.getActiveFolders(project).filter((folder) => (folder.parentId || null) === (parentId || null)).map((folder) => Number(folder.order) || 0),
            ...(project?.pages || []).filter((page) => !page.deleted && (page.parentId || null) === (parentId || null)).map((page) => Number(page.order) || 0)
        ];
        return (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 1000;
    }

    rebalancePageTreeOrders(parentId = null) {
        const project = this.getProjectRecord();
        if (!project) return;
        const parent = parentId || null;
        const folders = this.getActiveFolders(project)
            .filter((folder) => (folder.parentId || null) === parent)
            .map((folder) => ({ type: 'folder', id: folder.id, name: folder.name, order: folder.order, folder }));
        const pages = (project.pages || [])
            .filter((page) => !page.deleted && (page.parentId || null) === parent)
            .map((page) => ({ type: 'page', id: page.id, name: page.name || page.id, order: page.order, page }));
        [...folders, ...pages]
            .sort((left, right) => this.comparePageTreeItems(left, right))
            .forEach((item, index) => {
                if (item.type === 'folder') item.folder.order = (index + 1) * 1000;
                else item.page.order = (index + 1) * 1000;
            });
    }

    async savePageStructure() {
        if (this.isShareMode) return;
        const project = this.getProjectRecord();
        if (!project) return;
        const payload = {
            projectId: project.id,
            folders: (project.folders || []).map((folder) => ({
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId || null,
                order: Number(folder.order) || 0,
                collapsed: Boolean(folder.collapsed),
                deleted: Boolean(folder.deleted),
                deletedAt: folder.deletedAt || null
            })),
            pages: (project.pages || []).map((page) => ({
                id: page.id,
                parentId: page.parentId || null,
                order: Number(page.order) || 0
            }))
        };
        const response = await fetch('http://localhost:8080/api/page-structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(await response.text() || '保存页面结构失败');
        }
    }

    getAvailableVersions(page) {
        if (!page || !Array.isArray(page.versions)) return [];
        return [...page.versions]
            .sort((left, right) => {
                const leftNumber = Number.parseInt(String(left).replace(/^v/i, ''), 10);
                const rightNumber = Number.parseInt(String(right).replace(/^v/i, ''), 10);
                if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
                    return rightNumber - leftNumber;
                }
                return String(right).localeCompare(String(left));
            });
    }

    readShellNavigationState() {
        try {
            const stored = JSON.parse(window.localStorage.getItem(workspaceStorageKey('readify:shell-navigation')) || 'null');
            return stored && typeof stored === 'object' ? stored : null;
        } catch {
            return null;
        }
    }

    migrateShellLocationStorage() {
        if (this.readShareConfig().enabled) return;
        const storageVersion = '20260617-refresh-location-v3';
        try {
            if (window.localStorage.getItem(workspaceStorageKey('readify:shell-location-cache-version')) === storageVersion) return;
            window.localStorage.removeItem(workspaceStorageKey('readify:shell-navigation'));
            window.localStorage.removeItem(workspaceStorageKey('readify:top-view'));
            window.localStorage.removeItem(workspaceStorageKey('readify:page-version-memory'));
            window.localStorage.setItem(workspaceStorageKey('readify:shell-location-cache-version'), storageVersion);
        } catch {
            // Location memory is optional; blocked storage should not break the shell.
        }
    }

    writeShellNavigationState(view = this.currentView, projectId = this.activeProjectId, pageId = this.activePageId, version = this.activeVersion, topView = this.currentTopView) {
        if (this.isShareMode) return;
        try {
            window.localStorage.setItem(
                workspaceStorageKey('readify:shell-navigation'),
                JSON.stringify({ schemaVersion: 2, topView, view, projectId, pageId, version })
            );
        } catch {
            // Navigation memory is a convenience; private browsing can block it.
        }
    }

    readPageVersionMemory() {
        try {
            const value = JSON.parse(window.localStorage.getItem(workspaceStorageKey('readify:page-version-memory')) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch {
            return {};
        }
    }

    rememberPageVersion(projectId = this.activeProjectId, pageId = this.activePageId, version = this.activeVersion) {
        if (this.isShareMode || !projectId || !pageId || !version) return;
        try {
            const memory = this.readPageVersionMemory();
            memory[projectId] = memory[projectId] && typeof memory[projectId] === 'object'
                ? memory[projectId]
                : {};
            memory[projectId][pageId] = version;
            window.localStorage.setItem(workspaceStorageKey('readify:page-version-memory'), JSON.stringify(memory));
        } catch {
            // Per-page version memory is non-critical.
        }
    }

    isUsablePageVersion(page, version) {
        return Boolean(
            page
            && version
            && Array.isArray(page.versions)
            && page.versions.includes(version)
            && !page.versionStates?.[version]?.deleted
        );
    }

    getRememberedPageVersion(page, projectId = this.activeProjectId) {
        if (this.isShareMode || !page?.id || !projectId) return null;
        const remembered = this.readPageVersionMemory()?.[projectId]?.[page.id];
        return this.isUsablePageVersion(page, remembered) ? remembered : null;
    }

    getPreferredPageVersion(page, fallbackVersion = null) {
        if (!page) return fallbackVersion || null;
        if (this.isUsablePageVersion(page, fallbackVersion)) return fallbackVersion;
        const rememberedVersion = this.getRememberedPageVersion(page);
        if (rememberedVersion) return rememberedVersion;
        if (this.isUsablePageVersion(page, page.activeVersion)) return page.activeVersion;
        return this.getAvailableVersions(page).find((version) => this.isUsablePageVersion(page, version))
            || page.versions?.[0]
            || fallbackVersion
            || null;
    }

    getInitialNavigationTarget() {
        if (this.isShareMode) {
            const sharePage = this.getPageRecord(this.shareConfig.pageId) || this.projects?.pages?.[0];
            const shareVersion = this.shareConfig.version
                || this.getAvailableVersions(sharePage)[0]
                || sharePage?.versions?.[0];
            return { page: sharePage, version: shareVersion };
        }

        const stored = this.readShellNavigationState();
        const validProjectIds = new Set((this.projects?.projects || []).map(p => p.id));
        const storedTopView = ['projects', 'templates', 'skills', 'page'].includes(stored?.topView) ? stored.topView : '';
        const rememberedTop = storedTopView || this.readTopViewMemory();
        const shouldRestorePageView = rememberedTop === 'page' || (!storedTopView && stored?.view === 'pages') || this.currentTopView === 'page';
        if (stored?.projectId && validProjectIds.has(stored.projectId)) {
            this.activeProjectId = stored.projectId;
            this.currentView = shouldRestorePageView ? 'pages' : 'projects';
        } else {
            const activeProj = this.projects?.projects?.find(p => !p.deleted);
            this.activeProjectId = activeProj?.id || 'readify';
            this.currentView = shouldRestorePageView ? 'pages' : 'projects';
        }

        if (this.projects) {
            this.projects.activeProjectId = this.activeProjectId;
        }

        if (stored?.pageId && stored?.version) {
            const storedPage = this.getPageRecord(stored.pageId);
            if (this.isUsablePageVersion(storedPage, stored.version)) {
                return { page: storedPage, version: stored.version };
            }
        }

        if (stored?.pageId) {
            const storedPage = this.getPageRecord(stored.pageId);
            if (storedPage && !storedPage.deleted) {
                return { page: storedPage, version: this.getPreferredPageVersion(storedPage) };
            }
        }

        const topPage = this.getActivePagesSorted()[0] || this.projects?.pages?.[0];
        return { page: topPage, version: this.getPreferredPageVersion(topPage) };
    }

    isPageDeleted(pageId = this.activePageId) {
        return Boolean(this.getPageRecord(pageId)?.deleted);
    }

    isVersionDeleted(pageId = this.activePageId, version = this.activeVersion) {
        const page = this.getPageRecord(pageId);
        return page && !page.versions?.includes(version);
    }

    getAgentContextDeletionState(context = this.getAgentContext(), activeSkill = this.agentActiveSkill) {
        if (activeSkill?.globalContext || context?.globalContext || context?.pageId === '__global__') {
            return { blocked: false, reason: '' };
        }
        if (this.isPageDeleted(context.pageId)) {
            return {
                blocked: true,
                reason: `页面 ${context.pageId} 已删除，相关对话已禁用。`
            };
        }
        return { blocked: false, reason: '' };
    }

    getDefaultData() {
        return window.__PROTA_WORKSPACE_DATA__ || /* __READIFY_DATA_START__ */{"projects": [], "activeProjectId": null, "activePageId": null} /* __READIFY_DATA_END__ */;
    }

    async init() {
        await this.unifiedSettings.bootstrap();
        await this.loadData();
        await this.syncFromDisk();
        if (!this.isShareMode) {
            await this.loadSettings();
        }
        this.applyShareModeData();
        this.applyShareModeDrawerDefaults();
        if (!this.isShareMode) {
            this.agentSessionsList = this.getCachedAgentSessionList();
        }
        this.applyShareModeChrome();
        this.applyAgentPanelWidth();

        if (this.isShareMode) {
            this.currentView = 'pages';
            this.activeProjectId = this.shareConfig.projectId || 'readify';
            this.currentTopView = 'page';
        } else {
            const stored = this.readShellNavigationState();
            const validProjectIds = new Set((this.projects?.projects || []).map(p => p.id));
            const storedTopView = ['projects', 'templates', 'skills', 'page'].includes(stored?.topView) ? stored.topView : '';
            const rememberedTop = storedTopView || this.readTopViewMemory();
            const shouldRestorePageView = rememberedTop === 'page' || (!storedTopView && stored?.view === 'pages');
            if (stored && validProjectIds.has(stored.projectId)) {
                this.currentView = shouldRestorePageView ? 'pages' : 'projects';
                this.activeProjectId = stored.projectId;
            } else {
                this.currentView = shouldRestorePageView ? 'pages' : 'projects';
                this.activeProjectId = (this.projects?.projects || []).find(p => !p.deleted)?.id || 'readify';
            }
            if (this.projects) {
                this.projects.activeProjectId = this.activeProjectId;
            }
            this.currentTopView = shouldRestorePageView ? 'page' : (['projects', 'templates', 'skills'].includes(rememberedTop) ? rememberedTop : 'projects');
        }
        document.body.dataset.topView = this.currentTopView;
        this.topTabsEl?.querySelectorAll('.top-tab').forEach(tab => {
            const active = tab.dataset.topView === this.currentTopView;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        this.renderSidebar();
        this.setupEventListeners();
        if (!this.isShareMode) {
            this.syncAgentConfigForm();
            this.renderAgentWorkbench();
            this.startAgentTicker();
        }

        // Set initial state. Home tabs are project-level surfaces; only page view
        // should hydrate the iframe/page selectors.
        if (this.currentTopView === 'page') {
            const initialTarget = this.getInitialNavigationTarget();
            if (initialTarget.page) {
                this.writeShellNavigationState('pages', this.activeProjectId, initialTarget.page.id, initialTarget.version);
                await this.switchPage(initialTarget.page.id, initialTarget.version);
            } else {
                if (this.mainIframe) this.mainIframe.src = 'about:blank';
                if (this.currentPageNameEl) this.currentPageNameEl.textContent = '暂无页面';
                this.renderVersionPanel(null);
                this.writeShellNavigationState();
            }
        } else {
            if (this.mainIframe) this.mainIframe.src = 'about:blank';
            this.switchTopView(this.currentTopView);
        }
        if (!this.isShareMode) {
            this.bootstrapAgentWorkbench();
        }
        
        this.initMiniTerminal();
    }

    initMiniTerminal() {
        this.miniTerminalContainer = document.getElementById('agentMiniTerminalScroll');
        this.miniTerminalState = null;
        this._termQueue = [];          // { text, type } objects
        this._termDraining = false;    // RAF drain in progress
        this._termRafId = null;
        this.showTerminalWelcome();
        this.initAgentPet();
    }

    initAgentPet() {
        if (this.isShareMode) return;
        if (!this.agentPetStage || !this.agentPetImage) return;
        this.agentPetReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
        this.agentPetSequences = {
            idle: { frames: 6, durations: [420, 170, 320, 420, 280, 520] },
            break: { frames: 6, durations: [420, 170, 320, 420, 280, 520] },
            paused: { frames: 6, durations: [260, 220, 420, 190, 380, 520] },
            waiting: { frames: 6, durations: [260, 220, 420, 190, 380, 520] },
            interrupted: { frames: 6, durations: [150, 130, 260, 360, 420, 680], loop: false },
            running: { frames: 8, durations: [100, 90, 105, 95, 120, 90, 105, 150] }
        };
        Object.entries(this.agentPetSequences).forEach(([state, sequence]) => {
            for (let index = 0; index < sequence.frames; index += 1) {
                const image = new Image();
                image.src = this.getAgentPetFrameAsset(state, index);
            }
        });
        this.agentPetSourceState = this.getAgentVisualState();
        this.hideAgentPet();
    }

    finishAgentPetHydration() {
        if (!this.agentPetStage || this.agentPetHydrated) return;
        this.agentPetHydrated = true;
        const state = this.getAgentVisualState();
        this.agentPetSourceState = state;
        this.hideAgentPet();
        if (state === 'ready') {
            this.scheduleAgentPetBreak();
        } else if (this.agentRunState?.active || state === 'waiting_approval' || state === 'waiting_user_answer') {
            this.syncAgentPetState(state, { force: true });
        }
    }

    clearAgentPetTimers() {
        if (this.agentPetBreakTimer) window.clearTimeout(this.agentPetBreakTimer);
        if (this.agentPetHideTimer) window.clearTimeout(this.agentPetHideTimer);
        this.agentPetBreakTimer = null;
        this.agentPetHideTimer = null;
    }

    stopAgentPetFrames() {
        if (this.agentPetFrameTimer) window.clearTimeout(this.agentPetFrameTimer);
        this.agentPetFrameTimer = null;
        this.agentPetGeneration += 1;
        this.agentPetFrameIndex = 0;
    }

    getAgentPetFrameAsset(state, index) {
        return `assets/prota/pet/frames/${state}-${index}.webp?v=20260813-motion-v3`;
    }

    getAgentPetAsset(state) {
        if (state === 'running' && this.agentPetReducedMotion) return 'assets/prota/pet/running-static.webp';
        return `assets/prota/pet/${state}.webp`;
    }

    playAgentPetFrames(state) {
        const sequence = this.agentPetSequences?.[state];
        if (!sequence || this.agentPetReducedMotion) {
            this.agentPetImage.src = sequence
                ? this.getAgentPetFrameAsset(state, 0)
                : this.getAgentPetAsset(state);
            return;
        }
        this.stopAgentPetFrames();
        const generation = this.agentPetGeneration;
        const renderFrame = () => {
            if (generation !== this.agentPetGeneration || this.agentPetState !== state) return;
            const index = this.agentPetFrameIndex;
            this.agentPetImage.src = this.getAgentPetFrameAsset(state, index);
            const isLast = index === sequence.frames - 1;
            if (isLast && sequence.loop === false) return;
            this.agentPetFrameIndex = (index + 1) % sequence.frames;
            this.agentPetFrameTimer = window.setTimeout(renderFrame, sequence.durations[index]);
        };
        renderFrame();
    }

    showAgentPet(state, { duration = 0 } = {}) {
        if (!this.agentPetStage || !this.agentPetImage) return;
        if (this.agentPetHideTimer) window.clearTimeout(this.agentPetHideTimer);
        this.agentPetHideTimer = null;
        this.agentPetState = state;
        this.agentPetStage.dataset.petState = state;
        this.playAgentPetFrames(state);
        this.agentPetStage.classList.add('is-visible');
        this.agentPetStage.setAttribute('aria-hidden', 'false');
        if (duration > 0) {
            this.agentPetHideTimer = window.setTimeout(() => {
                this.hideAgentPet();
            }, duration);
        }
    }

    hideAgentPet() {
        if (!this.agentPetStage) return;
        this.stopAgentPetFrames();
        this.agentPetStage.classList.remove('is-visible');
        this.agentPetStage.setAttribute('aria-hidden', 'true');
        this.agentPetState = '';
        this.agentPetHideTimer = null;
    }

    scheduleAgentPetBreak() {
        if (!this.agentPetStage || this.agentPetBreakTimer || this.agentPetReducedMotion) return;
        if (!this.agentSessionId) return;
        const delay = 30000 + Math.round(Math.random() * 30000);
        this.agentPetBreakTimer = window.setTimeout(() => {
            this.agentPetBreakTimer = null;
            if (this.getAgentVisualState() !== 'ready' || !this.agentSessionId || document.hidden) {
                this.scheduleAgentPetBreak();
                return;
            }
            this.showAgentPet('break');
            this.agentPetHideTimer = window.setTimeout(() => {
                this.hideAgentPet();
                if (this.getAgentVisualState() === 'ready') this.scheduleAgentPetBreak();
            }, 11000);
        }, delay);
    }

    syncAgentPetState(sourceState, { force = false } = {}) {
        if (!this.agentPetStage || !this.agentPetImage) return;
        if (!this.agentPetHydrated) {
            this.agentPetSourceState = sourceState;
            this.hideAgentPet();
            return;
        }
        if (!force && sourceState === this.agentPetSourceState) return;
        this.agentPetSourceState = sourceState;
        this.clearAgentPetTimers();

        if (sourceState === 'ready') {
            this.hideAgentPet();
            this.scheduleAgentPetBreak();
            return;
        }

        const stateMap = {
            running: ['running', 0],
            testing_connection: ['running', 0],
            paused: ['paused', 0],
            waiting_approval: ['waiting', 0],
            waiting_user_answer: ['waiting', 0],
            interrupted: ['interrupted', 4600],
            succeeded: ['succeeded', 4400],
            failed: ['failed', 5200],
            disconnected: ['disconnected', 3600]
        };
        const presentation = stateMap[sourceState];
        if (!presentation) {
            this.hideAgentPet();
            return;
        }
        this.showAgentPet(presentation[0], { duration: presentation[1] });
    }

    showTerminalWelcome() {
        // Just flush the queue and clear DOM silently — no idle text displayed
        if (!this.miniTerminalContainer) return;
        this._termQueue = [];
        this._termDraining = false;
        if (this._termRafId) { cancelAnimationFrame(this._termRafId); this._termRafId = null; }
        this.miniTerminalContainer.innerHTML = '';
    }

    // Push one line into the queue and start draining if needed
    addMiniTerminalLine(text, type = 'output') {
        if (!this.miniTerminalContainer) return;
        this._termQueue = this._termQueue || [];
        this._termQueue.push({ text: String(text || ''), type });
        if (!this._termDraining) this._drainTermQueue();
    }

    // Push many lines at once (from tool output) into queue
    enqueueTerminalLines(lines, type = 'output') {
        if (!this.miniTerminalContainer) return;
        this._termQueue = this._termQueue || [];
        for (const line of lines) {
            if (line.trim()) this._termQueue.push({ text: String(line).trimEnd(), type });
        }
        if (!this._termDraining) this._drainTermQueue();
    }

    // RAF-based drain: 2 lines per frame for fast streaming
    _drainTermQueue() {
        if (!this._termQueue || this._termQueue.length === 0) {
            this._termDraining = false;
            return;
        }
        this._termDraining = true;
        // Drain up to 2 lines per frame so it feels fast
        const batch = Math.min(2, this._termQueue.length);
        for (let i = 0; i < batch; i++) {
            const item = this._termQueue.shift();
            this._renderTermLine(item.text, item.type);
        }
        this._termRafId = requestAnimationFrame(() => this._drainTermQueue());
    }

    // Actually write one line into the DOM
    _renderTermLine(text, type = 'output') {
        if (!this.miniTerminalContainer) return;
        // The stream is rendered as moving texture inside the Prota wordmark.
        // Keep enough source detail to make code recognisable without widening the entry.
        if (text.length > 40) text = text.substring(0, 37) + '\u2026';
        const lineEl = document.createElement('pre');
        lineEl.className = `agent-terminal-line agent-terminal-line--${type}`;
        lineEl.textContent = text;
        this.miniTerminalContainer.appendChild(lineEl);
        // Four compact rows create a continuous upward flow inside the 28px glyph mask.
        while (this.miniTerminalContainer.children.length > 4) {
            this.miniTerminalContainer.removeChild(this.miniTerminalContainer.firstChild);
        }
    }


    // ── Panel open / close ──────────────────────────────────

    openPanel() {
        this._panelOpen = true;
        this.versionWrapper.classList.add('is-open');
    }

    closePanel() {
        this._panelOpen = false;
        this.versionWrapper.classList.remove('is-open');
    }

    togglePanel() {
        this._panelOpen ? this.closePanel() : this.openPanel();
    }

    // ── Page selector controls ──────────────────────────────

    openPageSelector() {
        this._pageSelectorOpen = true;
        this.pageSelectorWrapper?.classList.add('is-open');
        this.renderPageSelector();
    }

    closePageSelector() {
        this._pageSelectorOpen = false;
        this.pageSelectorWrapper?.classList.remove('is-open');
    }

    togglePageSelector() {
        this._pageSelectorOpen ? this.closePageSelector() : this.openPageSelector();
    }

    renderPageSelector() {
        if (!this.pageSelectorPanelList) return;
        this.pageSelectorPanelList.innerHTML = '';

        const treeItems = this.getOrderedPageTreeItems(null, 0, this.getProjectRecord(), { includeCollapsed: false });
        if (treeItems.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'page-selector-row';
            emptyEl.style.justifyContent = 'center';
            emptyEl.style.color = 'var(--text-secondary)';
            emptyEl.style.fontSize = '0.82rem';
            emptyEl.textContent = '暂无页面';
            this.pageSelectorPanelList.appendChild(emptyEl);
            return;
        }

        treeItems.forEach(item => {
            if (item.type === 'folder') {
                const row = document.createElement('div');
                row.className = 'page-selector-row page-selector-row--folder';
                row.style.setProperty('--level', String(item.depth));
                row.innerHTML = `
                    <button type="button" class="page-selector-row__toggle${item.folder.collapsed ? ' is-collapsed' : ''}" data-page-selector-folder-toggle="${this.escapeHtml(item.id)}" title="${item.folder.collapsed ? '展开文件夹' : '收起文件夹'}" aria-label="${item.folder.collapsed ? '展开文件夹' : '收起文件夹'}" aria-expanded="${item.folder.collapsed ? 'false' : 'true'}">
                        <svg class="folder-icon folder-icon--open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19l2.76-7.35A1 1 0 0 1 8.69 11H20.3a1 1 0 0 1 .94 1.35l-2.26 6a1 1 0 0 1-.94.65H5Z"></path><path d="M3 6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v2H8.69a1 1 0 0 0-.93.65L5 19H3V6Z"></path></svg>
                        <svg class="folder-icon folder-icon--closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"></path></svg>
                    </button>
                    <span class="page-selector-row__label">${this.escapeHtml(item.folder.name || '未命名文件夹')}</span>
                `;
                row.querySelector('[data-page-selector-folder-toggle]')?.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this.togglePageFolderCollapsed(item.id);
                    this.openPageSelector();
                });
                row.addEventListener('click', async () => {
                    await this.togglePageFolderCollapsed(item.id);
                    this.openPageSelector();
                });
                this.pageSelectorPanelList.appendChild(row);
                return;
            }
            const page = item.page;
            const isActive = page.id === this.activePageId;
            const row = document.createElement('div');
            row.className = `page-selector-row${isActive ? ' is-active' : ''}`;
            row.style.setProperty('--level', String(item.depth));

            const label = document.createElement('span');
            label.className = 'page-selector-row__label';
            label.textContent = page.name || page.id;

            row.appendChild(label);

            if (isActive) {
                const badge = document.createElement('span');
                badge.className = 'page-selector-row__badge';
                badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                row.appendChild(badge);
            }

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePageSelector();
                if (!isActive) {
                    this.switchPage(page.id);
                }
            });

            this.pageSelectorPanelList.appendChild(row);
        });
    }

    closeAgentInlineDropdowns({ except = null } = {}) {
        if (except !== 'model' && this.agentModelDropdownOpen) {
            this.agentModelDropdownOpen = false;
            if (this.agentModelDropdown) this.agentModelDropdown.hidden = true;
        }
        if (except !== 'permission' && this.agentPermissionDropdownOpen) {
            this.agentPermissionDropdownOpen = false;
            if (this.agentPermissionDropdown) this.agentPermissionDropdown.hidden = true;
        }
    }

    handleAgentInlineDropdownPointerDown(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const insideModel = Boolean(target.closest('.agent-model-selector-anchor'));
        const insidePermission = Boolean(target.closest('.agent-permission-selector-anchor'));
        const except = insideModel ? 'model' : insidePermission ? 'permission' : null;
        this.closeAgentInlineDropdowns({ except });
    }

    handleAgentInlineDropdownWindowBlur() {
        requestAnimationFrame(() => {
            if (document.activeElement === this.mainIframe) {
                this.closeAgentInlineDropdowns();
            }
        });
    }

    closeAllDropdowns() {
        this.closePanel();
        this.closePageSelector();
        this.closeShareMenu();
        if (this.agentProviderPresetOptions) {
            this.togglePresetSelectDropdown(false);
        }
        this.closeAgentSkillMenu();
        this.closeAgentCommandMenu();
        this.closeAgentAutocomplete();
        this.closeAgentInlineDropdowns();
        if (this.pageActionMenuOpenId) {
            this.pageActionMenuOpenId = null;
            this.renderSidebar();
        }
        const narrowWidth = this.getCssVariable('--agent-panel-narrow-width', 600);
        if (this.agentSessionDrawerOpen && this.agentPanelWidth < narrowWidth) {
            this.agentSessionDrawerOpen = false;
            this.writeAgentStorage('session-drawer-open', false);
            this.renderAgentWorkbench();
        }
    }

    // ── Event wiring ────────────────────────────────────────

    setupEventListeners() {
        // Page selector trigger button → toggle page selector panel
        this.pageSelectorTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._panelOpen) this.closePanel();
            this.togglePageSelector();
        });

        // Version trigger button → toggle panel
        this.versionTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._pageSelectorOpen) this.closePageSelector();
            this.togglePanel();
        });

        // Version refresh button → reload iframe and PRD
        this.versionRefreshBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.mainIframe && this.mainIframe.src) {
                const svg = this.versionRefreshBtn.querySelector('svg');
                this.versionRefreshBtn.classList.remove('spinning');
                void this.versionRefreshBtn.offsetWidth;
                this.versionRefreshBtn.classList.add('spinning');
                setTimeout(() => this.versionRefreshBtn.classList.remove('spinning'), 600);

                try {
                    this.mainIframe.contentWindow.location.reload(true);
                } catch (err) {
                    this.mainIframe.src = this.mainIframe.src;
                }

                if (this.docDrawerMode === 'prd' && this.annotationDrawerEnabled) {
                    this.loadPrdDocument({ force: true });
                }
            }
        });

        // Click outside → close panel
        document.addEventListener('click', (e) => {
            if (this._panelOpen && !this.versionWrapper.contains(e.target)) {
                this.closePanel();
            }
            if (this._pageSelectorOpen && this.pageSelectorWrapper && !this.pageSelectorWrapper.contains(e.target)) {
                this.closePageSelector();
            }
            if (this.shareMenuOpen && !e.target.closest('#shareMenuWrapper')) {
                this.closeShareMenu();
            }
            if (this.agentProviderPresetOptions && !this.agentProviderPresetOptions.hidden && !e.target.closest('#agentProviderPresetSelect')) {
                this.togglePresetSelectDropdown(false);
            }
            if (this.agentSkillMenuOpen && !e.target.closest('.agent-skill-menu-anchor')) {
                this.closeAgentSkillMenu();
            }
            if (this.agentCommandMenuOpen && !e.target.closest('.agent-command-menu-anchor')) {
                this.closeAgentCommandMenu();
            }
            if (this.agentAutocompleteOpen && !e.target.closest('.agent-command-menu-anchor')) {
                this.closeAgentAutocomplete();
            }
            if (this.pageActionMenuOpenId && !e.target.closest('.nav-item__menu') && !e.target.closest('[data-page-more]')) {
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
            }
            if (this.projectActionMenuOpenId && !e.target.closest('.nav-item__menu') && !e.target.closest('[data-project-more]')) {
                this.projectActionMenuOpenId = null;
                this.renderSidebar();
            }
        }, true);

        // Footer fork button → fork from active version
        this.panelForkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.closePanel();
            await this.forkVersion(this.activeVersion);
        });

        // Open in new tab
        document.getElementById('openNewTabBtn').addEventListener('click', () => {
            this.closeShareMenu();
            if (this.mainIframe.src) {
                window.open(this.mainIframe.src, '_blank');
            }
        });

        this.shareMenuTrigger?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleShareMenu();
        });

        this.shareMenu?.addEventListener('click', async (event) => {
            const shareButton = event.target.closest('[data-share-type]');
            if (!shareButton) return;
            event.preventDefault();
            event.stopPropagation();
            await this.createSharePage(shareButton.dataset.shareType || 'local', shareButton);
        });

        this.shareSettingsBtn?.addEventListener('click', () => {
            this.closeShareMenu();
            this.openSettingsModal();
        });

        this.vercelAutoConfigBtn?.addEventListener('click', async () => {
            await this.startVercelAutoConfig();
        });
        
        this.settingsModalClose?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        this.settingsCancelBtn?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        this.shareSettingsModal?.querySelector('[data-settings-close]')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        this.settingsHelpToggleBtn?.addEventListener('click', (e) => this.toggleHelp(e));

        this.shareSettingsForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveSettings();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeShareMenu();
                this.closeSettingsModal();
            }

            // ArrowUp/ArrowDown level micro-adjustment in annotation mode
            if (this.annotationMode && this.pendingAnnotation) {
                const activeEl = document.activeElement;
                const isTyping = activeEl && (
                    activeEl.tagName === 'TEXTAREA' || 
                    activeEl.tagName === 'INPUT' || 
                    activeEl.isContentEditable
                );

                if (event.key === 'ArrowUp' && (!isTyping || event.ctrlKey || event.altKey || event.metaKey)) {
                    event.preventDefault();
                    this.selectParentAnnotationElement();
                } else if (event.key === 'ArrowDown' && (!isTyping || event.ctrlKey || event.altKey || event.metaKey)) {
                    event.preventDefault();
                    this.selectChildAnnotationElement();
                }
            }
        });

        this.addPageBtn?.addEventListener('click', async () => {
            await this.openNewPageAgentFlow();
        });

        this.addFolderBtn?.addEventListener('click', async () => {
            await this.createPageFolderFlow();
        });

        this.addProjectBtn?.addEventListener('click', async () => {
            await this.createNewProjectFlow();
        });

        this.backToProjectsBtn?.addEventListener('click', () => {
            this.currentView = 'projects';
            this.switchTopView('projects');
            this.writeShellNavigationState();
            this.renderSidebar();
        });

        // Top-level tabs
        this.topTabsEl?.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-top-view]');
            if (!tab) return;
            this.switchTopView(tab.dataset.topView);
        });

        this.homeNewProjectBtn?.addEventListener('click', async () => {
            await this.createNewProjectFlow();
        });

        this.homeTrashBtn?.addEventListener('click', () => {
            this.toggleTrashModal();
        });

        this.projectSearchInput?.addEventListener('input', () => {
            this.projectSearchQuery = this.projectSearchInput.value || '';
            this.renderProjectsHome();
        });

        // Category popover trigger
        this.templateCategoryTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCategoryPopover(!this.templateCategoryPopoverOpen);
        });

        // Category popover search
        this.templateCategorySearch?.addEventListener('input', () => {
            this.templateCategorySearchQuery = this.templateCategorySearch.value || '';
            this.renderCategoryPopoverItems(this.templatesData?.templates || []);
        });

        // Category item click (delegated)
        this.templateCategoryList?.addEventListener('click', (event) => {
            const item = event.target.closest('[data-template-filter]');
            if (!item) return;
            this.templateFilter = item.dataset.templateFilter;
            this.closeCategoryPopover();
            this.renderTemplatesHome();
        });

        // Close popover on outside click
        document.addEventListener('click', (event) => {
            if (!this.templateCategoryPopoverOpen) return;
            if (!event.target.closest('.template-category-wrapper')) {
                this.closeCategoryPopover();
            }
        });

        this.templateSearchInput?.addEventListener('input', () => {
            this.templateSearchQuery = this.templateSearchInput.value || '';
            this.renderTemplatesHome();
        });

        this.templateDeviceFilterEl?.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-template-device]');
            if (!tab) return;
            this.templateDeviceFilter = tab.dataset.templateDevice === 'web' ? 'web' : 'mobile';
            this.templateFilter = 'all';
            this.templateDeviceFilterEl.querySelectorAll('[data-template-device]').forEach((item) => {
                const active = item === tab;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            this.renderTemplatesHome();
        });

        this.templateStatusFilterEl?.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-template-status-filter]');
            if (!chip) return;
            this.templateStatusFilter = chip.dataset.templateStatusFilter || 'all';
            this.templateStatusFilterEl.querySelectorAll('.home-filter__chip').forEach(c => {
                c.classList.toggle('is-active', c === chip);
            });
            this.renderTemplatesHome();
        });

        this.skillSearchInput?.addEventListener('input', () => {
            this.skillSearchQuery = this.skillSearchInput.value || '';
            this.renderSkillsHome();
        });

        this.skillStatusFilterEl?.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-skill-status-filter]');
            if (!chip) return;
            this.skillStatusFilter = chip.dataset.skillStatusFilter || 'all';
            this.skillStatusFilterEl.querySelectorAll('.home-filter__chip').forEach(c => {
                c.classList.toggle('is-active', c === chip);
            });
            this.renderSkillsHome();
        });

        this.skillImportBtn?.addEventListener('click', () => {
            this.openSkillImportModal();
        });

        this.skillImportCancelBtn?.addEventListener('click', () => {
            this.closeSkillImportModal();
        });

        this.skillImportModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-skill-import-close="true"]')) {
                this.closeSkillImportModal();
            }
        });

        this.skillImportSaveBtn?.addEventListener('click', async () => {
            if (this.skillImportMode === 'url') {
                await this.startSkillImportByUrl();
            } else {
                await this.saveLocalSkillFromImport();
            }
        });

        this.skillImportSegmented?.forEach((tab) => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.skillImportMode;
                if (mode) this.setSkillImportMode(mode);
            });
        });

        this.skillImportUrlInput?.addEventListener('input', () => {
            this.updateSkillImportSubmitState();
        });

        this.skillImportDropZone?.addEventListener('click', () => {
            this.skillImportFolderInput?.click();
        });

        this.skillImportDropZone?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.skillImportFolderInput?.click();
            }
        });

        this.skillImportDropZone?.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.skillImportDropZone) this.skillImportDropZone.classList.add('is-dragover');
        });

        this.skillImportDropZone?.addEventListener('dragenter', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.skillImportDropZone) this.skillImportDropZone.classList.add('is-dragover');
        });

        this.skillImportDropZone?.addEventListener('dragleave', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const related = event.relatedTarget;
            if (!related || !this.skillImportDropZone?.contains(related)) {
                if (this.skillImportDropZone) this.skillImportDropZone.classList.remove('is-dragover');
            }
        });

        this.skillImportDropZone?.addEventListener('drop', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.skillImportDropZone) this.skillImportDropZone.classList.remove('is-dragover');
            const items = event.dataTransfer?.items;
            if (!items || items.length === 0) return;
            const files = await this.collectDroppedFolderFiles(items);
            if (files.length === 0) {
                this.setPendingSkillFiles([]);
                alert('未能读取拖入的文件夹内容，请改用「选择文件夹」按钮。');
                return;
            }
            this.setPendingSkillFiles(files);
        });

        this.skillImportFolderInput?.addEventListener('change', async (event) => {
            const fileList = event.target.files;
            if (!fileList || fileList.length === 0) return;
            const files = await this.collectInputFolderFiles(fileList);
            event.target.value = '';
            if (files.length === 0) {
                this.setPendingSkillFiles([]);
                alert('未能读取所选文件夹内容');
                return;
            }
            this.setPendingSkillFiles(files);
        });

        this.templateDetailModal?.addEventListener('click', (event) => {
            const useButton = event.target.closest('[data-template-detail-use]');
            const statusButton = event.target.closest('[data-template-detail-status]');
            if (statusButton) {
                const id = statusButton.dataset.templateDetailStatus;
                this.closeTemplateDetailModal();
                this.setTemplateEnabled(id, statusButton.dataset.templateEnabled === 'true');
                return;
            }
            if (event.target.closest('[data-skill-detail-close="true"]')) {
                this.closeTemplateDetailModal();
                return;
            }
            if (event.target.closest('[data-template-detail-close="true"]') || useButton) {
                if (useButton) {
                    const id = useButton.dataset.templateDetailUse;
                    this.closeTemplateDetailModal();
                    this.applyTemplateForNewPage(id);
                    return;
                }
                this.closeTemplateDetailModal();
            }
        });

        this.projectCreateCancelBtn?.addEventListener('click', () => {
            this.closeProjectCreateModal();
        });

        this.projectCreateModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-project-create-close="true"]')) {
                this.closeProjectCreateModal();
            }
        });

        this.projectCreateForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.submitProjectCreateForm();
        });

        this.trashToggleBtn?.addEventListener('click', () => {
            this.toggleTrashModal();
        });

        this.trashModalClose?.addEventListener('click', () => {
            this.closeTrashModal();
        });

        this.trashModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-trash-close="true"]')) {
                this.closeTrashModal();
            }
        });

        this.confirmModal?.querySelector('.confirm-modal__scrim')?.addEventListener('click', () => {
            this._closeConfirm(false);
        });

        this.confirmModalCancel?.addEventListener('click', () => {
            this._closeConfirm(false);
        });

        this.confirmModalOk?.addEventListener('click', () => {
            this._closeConfirm(true);
        });

        // Rename modal events
        this.renameModal?.querySelector('[data-rename-close]')?.addEventListener('click', () => {
            this._closeRenameModal();
        });
        this.renameModalCancel?.addEventListener('click', () => {
            this._closeRenameModal();
        });
        this.renameModalOk?.addEventListener('click', () => {
            if (this._renameResolve) this._renameResolve(this.renameModalInput?.value || '');
        });
        this.renameModalInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this._renameResolve) this._renameResolve(this.renameModalInput?.value || '');
            } else if (e.key === 'Escape') {
                this._closeRenameModal();
            }
        });

        this.pageListEl?.addEventListener('click', (event) => {
            const folderToggleButton = event.target.closest('[data-folder-toggle]');
            if (folderToggleButton) {
                event.preventDefault();
                event.stopPropagation();
                this.togglePageFolderCollapsed(folderToggleButton.dataset.folderToggle || '');
                return;
            }

            const folderMoreButton = event.target.closest('[data-folder-more]');
            if (folderMoreButton) {
                event.preventDefault();
                event.stopPropagation();
                const folderId = folderMoreButton.dataset.folderMore || '';
                this.pageActionMenuOpenId = this.pageActionMenuOpenId === folderId ? null : folderId;
                this.renderSidebar();
                return;
            }

            const folderRenameAction = event.target.closest('[data-folder-rename]');
            if (folderRenameAction) {
                event.preventDefault();
                event.stopPropagation();
                const folderId = folderRenameAction.dataset.folderRename || '';
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
                this.renamePageFolderFlow(folderId);
                return;
            }

            const folderDeleteAction = event.target.closest('[data-folder-delete]');
            if (folderDeleteAction) {
                event.preventDefault();
                event.stopPropagation();
                const folderId = folderDeleteAction.dataset.folderDelete || '';
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
                this.deletePageFolder(folderId);
                return;
            }

            const folderShareAction = event.target.closest('[data-folder-share]');
            if (folderShareAction) {
                event.preventDefault();
                event.stopPropagation();
                const folderId = folderShareAction.dataset.folderShare || '';
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
                this.createShareFolder(folderId, 'static');
                return;
            }

            const moreButton = event.target.closest('[data-page-more]');
            if (moreButton) {
                event.preventDefault();
                event.stopPropagation();
                const pageId = moreButton.dataset.pageMore || '';
                this.pageActionMenuOpenId = this.pageActionMenuOpenId === pageId ? null : pageId;
                this.renderSidebar();
                return;
            }

            const renameAction = event.target.closest('[data-page-rename]');
            if (renameAction) {
                event.preventDefault();
                event.stopPropagation();
                const pageId = renameAction.dataset.pageRename || '';
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
                this.renamePageFlow(pageId);
                return;
            }

            const deleteAction = event.target.closest('[data-page-delete]');
            if (deleteAction) {
                event.preventDefault();
                event.stopPropagation();
                const pageId = deleteAction.dataset.pageDelete || '';
                this.pageActionMenuOpenId = null;
                this.renderSidebar();
                this.deletePage(pageId);
                return;
            }

            const folderRow = event.target.closest('.nav-tree-link--folder');
            if (folderRow && this.pageListEl.contains(folderRow)) {
                event.preventDefault();
                this.togglePageFolderCollapsed(folderRow.dataset.id || '');
            }
        });

        this.pageListEl?.addEventListener('dragstart', (event) => this.handlePageTreeDragStart(event));
        this.pageListEl?.addEventListener('dragover', (event) => this.handlePageTreeDragOver(event));
        this.pageListEl?.addEventListener('dragleave', (event) => this.handlePageTreeDragLeave(event));
        this.pageListEl?.addEventListener('drop', (event) => this.handlePageTreeDrop(event));
        this.pageListEl?.addEventListener('dragend', () => {
            this.clearPageTreeDropState();
            this.pageDragState = null;
        });

        this.projectListEl?.addEventListener('click', (event) => {
            const moreButton = event.target.closest('[data-project-more]');
            if (moreButton) {
                event.preventDefault();
                event.stopPropagation();
                const projectId = moreButton.dataset.projectMore || '';
                this.projectActionMenuOpenId = this.projectActionMenuOpenId === projectId ? null : projectId;
                this.renderSidebar();
                return;
            }

            const renameAction = event.target.closest('[data-project-rename]');
            if (renameAction) {
                event.preventDefault();
                event.stopPropagation();
                const projectId = renameAction.dataset.projectRename || '';
                this.projectActionMenuOpenId = null;
                this.renderSidebar();
                this.renameProjectFlow(projectId);
                return;
            }

            const editIdAction = event.target.closest('[data-project-edit-id]');
            if (editIdAction) {
                event.preventDefault();
                event.stopPropagation();
                const projectId = editIdAction.dataset.projectEditId || '';
                this.projectActionMenuOpenId = null;
                this.renderSidebar();
                this.editProjectIdFlow(projectId);
                return;
            }

            const deleteAction = event.target.closest('[data-project-delete]');
            if (!deleteAction) return;
            event.preventDefault();
            event.stopPropagation();
            const projectId = deleteAction.dataset.projectDelete || '';
            this.projectActionMenuOpenId = null;
            this.renderSidebar();
            this.deleteProject(projectId);
        });

        this.trashListEl?.addEventListener('click', (event) => {
            const restorePageButton = event.target.closest('[data-page-restore]');
            if (restorePageButton) {
                event.preventDefault();
                event.stopPropagation();
                this.restorePage(restorePageButton.dataset.pageRestore || '');
                return;
            }
            const restoreProjectButton = event.target.closest('[data-project-restore]');
            if (restoreProjectButton) {
                event.preventDefault();
                event.stopPropagation();
                this.restoreProject(restoreProjectButton.dataset.projectRestore || '');
                return;
            }
            const forceDeletePageButton = event.target.closest('[data-page-force-delete]');
            if (forceDeletePageButton) {
                event.preventDefault();
                event.stopPropagation();
                this.forceDeletePage(forceDeletePageButton.dataset.pageForceDelete || '');
                return;
            }
            const forceDeleteProjectButton = event.target.closest('[data-project-force-delete]');
            if (forceDeleteProjectButton) {
                event.preventDefault();
                event.stopPropagation();
                this.forceDeleteProject(forceDeleteProjectButton.dataset.projectForceDelete || '');
                return;
            }
        });

        this.mainIframe.addEventListener('load', () => {
            this.handleIframeLoad();
        });

        this.viewportStage?.addEventListener('contextmenu', (event) => {
            this.handleAnnotationContextMenu(event);
        });

        this.mainIframe.addEventListener('contextmenu', (event) => {
            this.handleAnnotationContextMenu(event);
        });

        // Annotation mode toggle
        document.getElementById('annotatorBtn').addEventListener('click', () => {
            if (this.isShareMode) return;
            this.toggleAnnotationMode();
        });

        this.docVisibilityBtn.addEventListener('click', () => {
            this.toggleAnnotationDrawer();
        });

        this.annotationMarkerLayer?.addEventListener('click', (event) => {
            const marker = event.target.closest('[data-annotation-marker]');
            if (!marker) return;

            event.preventDefault();
            event.stopPropagation();

            const sourceIndex = Number.parseInt(marker.dataset.annotationMarker || '', 10);
            if (!Number.isInteger(sourceIndex)) return;
            this.focusAnnotationCardFromMarker(sourceIndex);
        });

        this.annotationMarkerLayer?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const marker = event.target.closest('[data-annotation-marker]');
            if (!marker) return;

            event.preventDefault();
            const sourceIndex = Number.parseInt(marker.dataset.annotationMarker || '', 10);
            if (!Number.isInteger(sourceIndex)) return;
            this.focusAnnotationCardFromMarker(sourceIndex);
        });

        this.docTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                this.setDocDrawerMode(tab.dataset.docTab || 'annotations', { open: true });
            });
        });

        this.prdOpenNewTabBtn?.addEventListener('click', () => {
            const url = this.prdDocument?.outputUrl || this.getPrdDocumentUrl(this.prdDocument?.path);
            if (url) window.open(url, '_blank');
        });

        this.prdDownloadBtn?.addEventListener('click', () => {
            const pageId = this.activePageId;
            const version = this.activeVersion;
            if (!pageId || !version) {
                this.showToast('无法获取当前页面或版本信息', 'error');
                return;
            }

            const downloadViaApi = () => {
                const baseUrl = this.isShareMode
                    ? 'https://prota.example.com/api/agent/page/download-zip'
                    : '/api/agent/page/download-zip';
                const url = `${baseUrl}?pageId=${encodeURIComponent(pageId)}&version=${encodeURIComponent(version)}&projectId=${encodeURIComponent(this.activeProjectId)}`;
                const a = document.createElement('a');
                a.href = url;
                a.download = `${pageId}_${version}_prd.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

            // Static shares ship a pre-built zip next to the HTML, so the download
            // works without the backend tunnel (prota.*) being up. Fall back to the
            // API only if that zip is missing (e.g. legacy shares).
            if (this.isShareMode && this.shareConfig?.shareType === 'static') {
                const zipName = this.shareConfig?.zipFilename
                    || window.location.pathname.replace(/^.*\//, '').replace(/\.html$/i, '.zip');
                const zipUrl = `/shares/${zipName}`;
                fetch(zipUrl)
                    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('zip not found'))))
                    .then((blob) => {
                        const objUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objUrl;
                        a.download = zipName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(objUrl);
                    })
                    .catch(() => downloadViaApi());
                return;
            }

            downloadViaApi();
        });

        this.prdAiBtn?.addEventListener('click', () => {
            this.prdModule?.askAiAboutWholePrd();
        });

        this.prdEditBtn?.addEventListener('click', () => {
            this.enterPrdEditMode();
        });

        this.prdSaveBtn?.addEventListener('click', () => {
            this.savePrdDocument();
        });

        this.prdCancelEditBtn?.addEventListener('click', () => {
            this.cancelPrdEditing();
        });

        this.prdExpandBtn?.addEventListener('click', () => {
            this.togglePrdDrawerExpanded();
        });

        this.prdDrawerResizeHandle?.addEventListener('pointerdown', (event) => {
            this.startPrdDrawerResize(event);
        });

        this.annotationDrawerMeta?.addEventListener('click', (event) => {
            const annotationScopeButton = event.target.closest('[data-annotation-scope]');
            if (!annotationScopeButton) return;

            event.preventDefault();
            this.setAnnotationListScope(annotationScopeButton.dataset.annotationScope || 'current');
        });

        this.annotationDrawerBody?.addEventListener('click', (event) => {
            const copyCodeBtn = event.target.closest('.prd-code-copy-btn');
            if (copyCodeBtn) {
                event.preventDefault();
                event.stopPropagation();
                const codeBlock = copyCodeBtn.closest('.prd-code-block').querySelector('code');
                if (codeBlock) {
                    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                        const originalHtml = copyCodeBtn.innerHTML;
                        copyCodeBtn.innerHTML = '已复制';
                        setTimeout(() => {
                            copyCodeBtn.innerHTML = originalHtml;
                        }, 2000);
                    });
                }
                return;
            }

            const annotationScopeButton = event.target.closest('[data-annotation-scope]');
            if (annotationScopeButton) {
                event.preventDefault();
                this.setAnnotationListScope(annotationScopeButton.dataset.annotationScope || 'current');
                return;
            }

            const generatePrdButton = event.target.closest('[data-generate-prd]');
            if (generatePrdButton) {
                event.preventDefault();
                this.startPrdGeneration();
                return;
            }

            const retryPrdButton = event.target.closest('[data-retry-prd]');
            if (retryPrdButton) {
                event.preventDefault();
                this.loadPrdDocument({ force: true });
                return;
            }

            const prdCreateButton = event.target.closest('[data-create-prd]');
            if (prdCreateButton) {
                event.preventDefault();
                this.createEmptyPrdDocument();
                return;
            }

            const prdSaveButton = event.target.closest('[data-prd-save]');
            if (prdSaveButton) {
                event.preventDefault();
                this.savePrdDocument();
                return;
            }

            const prdCancelButton = event.target.closest('[data-prd-cancel]');
            if (prdCancelButton) {
                event.preventDefault();
                this.cancelPrdEditing();
                return;
            }

            const prdFormatButton = event.target.closest('[data-prd-format]');
            if (prdFormatButton) {
                event.preventDefault();
                this.applyPrdEditorFormat(prdFormatButton.dataset.prdFormat || '');
                return;
            }

            const prdLayoutButton = event.target.closest('[data-prd-editor-layout]');
            if (prdLayoutButton) {
                event.preventDefault();
                this.setPrdEditorLayout(prdLayoutButton.dataset.prdEditorLayout || 'split');
                return;
            }

            const prdSlashItem = event.target.closest('[data-prd-slash-command]');
            if (prdSlashItem) {
                event.preventDefault();
                this.executePrdSlashCommand(prdSlashItem.dataset.prdSlashCommand || '');
                return;
            }

            const deleteButton = event.target.closest('[data-delete-annotation]');
            if (deleteButton) {
                event.preventDefault();
                event.stopPropagation();

                const annotationIndex = Number.parseInt(
                    deleteButton.dataset.annotationIndex || '',
                    10
                );

                if (!Number.isInteger(annotationIndex)) return;
                this.deleteAnnotation(annotationIndex);
                return;
            }

            const annotationMenuButton = event.target.closest('[data-annotation-card-menu]');
            if (annotationMenuButton) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const annotationCard = event.target.closest('[data-annotation-card]');
            if (!annotationCard) return;

            const annotationIndex = Number.parseInt(
                annotationCard.dataset.annotationCard || '',
                10
            );

            if (!Number.isInteger(annotationIndex)) return;
            event.preventDefault();
            this.focusAnnotationFromCard(annotationIndex);
        });

        this.annotationDrawerBody?.addEventListener('dblclick', (event) => {
            if (this.isShareMode) return;
            if (this.docDrawerMode !== 'prd') return;
            if (this.prdDocument?.editMode) return;

            const prdDoc = event.target.closest('.prd-document');
            if (prdDoc) {
                event.preventDefault();
                const targetBlock = event.target.closest('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, .prd-table-wrap, img') || event.target;
                const clickedText = targetBlock.textContent || '';
                this.enterPrdEditMode(clickedText, event.target);
            }
        });

        this.annotationDrawer?.addEventListener('change', async (event) => {
            const prdSelect = event.target.closest('[data-prd-doc-select]');
            if (!prdSelect) return;
            if (!(await this.confirmPrdDiscardIfDirty())) {
                prdSelect.value = this.prdDocument?.path || this.getPrdRelativePath();
                return;
            }
            this.loadPrdDocument({
                force: true,
                path: prdSelect.value || this.getPrdRelativePath()
            });
        });

        this.annotationDrawerBody?.addEventListener('keydown', (event) => {
            const annotationCard = event.target.closest('[data-annotation-card]');
            if (annotationCard && (event.key === 'Enter' || event.key === ' ')) {
                const annotationIndex = Number.parseInt(annotationCard.dataset.annotationCard || '', 10);
                if (Number.isInteger(annotationIndex)) {
                    event.preventDefault();
                    this.focusAnnotationFromCard(annotationIndex);
                    return;
                }
            }
        });

        // Listen for messages from injected iframe scripts
        window.addEventListener('message', (e) => {
            if (!e.data || !e.data.type) return;
            if (e.data.type === 'readify:close-dropdowns') {
                this.closeAllDropdowns();
            } else if (e.data.type === 'readify:trigger-jump') {
                this.handleTriggerJump(e.data.toPageId);
            } else if (e.data.type === 'readify:element-selected') {
                if (this.annotationMode) {
                    this.hideAnnotationHover();
                    this.showAnnotationDialog(e.data.selector, {
                        tagName: e.data.tagName,
                        textContent: e.data.textContent,
                        className: e.data.className,
                        id: e.data.id,
                        ariaLabel: e.data.ariaLabel,
                        title: e.data.title,
                        rect: e.data.rect || null
                    });
                }
            } else if (e.data.type === 'readify:element-hover') {
                if (!this.annotationMode) return;
                this.showAnnotationHover(e.data);
            } else if (e.data.type === 'readify:element-hover-clear') {
                this.hideAnnotationHover();
            } else if (e.data.type === 'readify:toggle-annotation') {
                this.handleAnnotationShortcut(null, 'iframe');
            } else if (e.data.type === 'readify:enter-annotation') {
                this.enterAnnotationMode('iframe');
            } else if (e.data.type === 'readify:exit-annotation') {
                this.exitAnnotationMode('iframe');
            }
        });

        window.addEventListener('beforeunload', (event) => {
            this.writeShellNavigationState();
            if (this.prdDocument?.editMode && this.prdDocument?.dirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

        window.addEventListener('resize', this.handleWindowResize);

        // Keyboard shortcut: Ctrl+D to toggle annotation mode
        document.addEventListener('keydown', (e) => {
            this.handleAnnotationShortcut(e, 'parent');
        });

        this.updateDrawerToggleButton();
        this.updateDocDrawerTabs();

        this.installFastAgentToggle();

        this.agentConfigToggle?.addEventListener('click', () => {
            this.toggleAgentConfigModal();
        });

        this.agentModelToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAgentInlineDropdowns({ except: 'model' });
            this.agentModelDropdownOpen = !this.agentModelDropdownOpen;
            this.renderModelDropdown();
        });

        this.agentModelDropdown?.addEventListener('click', (e) => {
            const item = e.target.closest('[data-provider-id]');
            const settingsBtn = e.target.closest('[data-action="settings"]');
            if (settingsBtn) {
                this.closeAgentInlineDropdowns();
                this.toggleAgentConfigModal();
                return;
            }
            if (item) {
                const id = item.dataset.providerId;
                this.closeAgentInlineDropdowns();
                this.activateProvider(id);
            }
        });

        this.agentPlanModeToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAgentPlanMode();
        });

        this.agentPermissionToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAgentInlineDropdowns({ except: 'permission' });
            this.agentPermissionDropdownOpen = !this.agentPermissionDropdownOpen;
            this.renderPermissionDropdown();
        });

        this.agentPermissionDropdown?.addEventListener('click', (e) => {
            const item = e.target.closest('[data-permission-mode]');
            if (item) {
                const mode = item.dataset.permissionMode;
                this.closeAgentInlineDropdowns();
                this.updateSdkPermissionMode(mode);
            }
        });

        document.addEventListener('pointerdown', (e) => {
            this.handleAgentInlineDropdownPointerDown(e);
        }, true);
        this.mainIframe?.addEventListener('pointerdown', () => this.closeAgentInlineDropdowns(), true);
        window.addEventListener('blur', () => this.handleAgentInlineDropdownWindowBlur());

        this.agentNewSessionBtn?.addEventListener('click', async () => {
            await this.startNewAgentSessionFlow();
        });

        this.agentSessionDrawerToggle?.addEventListener('click', () => {
            this.agentSessionDrawerOpen = !this.agentSessionDrawerOpen;
            this.writeAgentStorage('session-drawer-open', this.agentSessionDrawerOpen);
            this.renderAgentWorkbench();
        });

        this.agentSessionSearchInput?.addEventListener('input', () => {
            this.agentSessionSearch = this.agentSessionSearchInput.value.trim();
            window.clearTimeout(this._agentSessionSearchTimer);
            this._agentSessionSearchTimer = window.setTimeout(() => {
                this.loadAgentSessions({ prewarm: false, reset: true })
                    .then(() => this.renderAgentSessionList())
                    .catch(() => {});
            }, 250);
        });

        // 搜索图标：点击展开/收起输入框
        this.agentSessionSearchToggle?.addEventListener('click', () => {
            this.agentSessionSearchOpen = !this.agentSessionSearchOpen;
            this.agentSessionSidebarHeader?.classList.toggle('is-searching', this.agentSessionSearchOpen);
            this.agentSessionSearchToggle?.setAttribute('aria-expanded', String(this.agentSessionSearchOpen));
            if (this.agentSessionSearchOpen) {
                requestAnimationFrame(() => this.agentSessionSearchInput?.focus());
            }
        });

        // Esc 清空并收起
        this.agentSessionSearchInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                const hadQuery = Boolean(this.agentSessionSearch);
                this.agentSessionSearchInput.value = '';
                this.agentSessionSearch = '';
                this.agentSessionSearchOpen = false;
                this.agentSessionSidebarHeader?.classList.remove('is-searching');
                this.agentSessionSearchToggle?.setAttribute('aria-expanded', 'false');
                if (hadQuery) {
                    this.loadAgentSessions({ prewarm: false, reset: true })
                        .then(() => this.renderAgentSessionList())
                        .catch(() => {});
                }
            }
        });

        // 输入框为空失焦时自动收起
        this.agentSessionSearchInput?.addEventListener('blur', () => {
            if (!this.agentSessionSearchInput.value.trim()) {
                this.agentSessionSearchOpen = false;
                this.agentSessionSidebarHeader?.classList.remove('is-searching');
                this.agentSessionSearchToggle?.setAttribute('aria-expanded', 'false');
            }
        });

        this.agentWorkbenchClose?.addEventListener('click', () => {
            this.closeAgentWorkbench();
        });

        this.agentResizeHandle?.addEventListener('pointerdown', (event) => {
            this.startAgentResize(event);
        });

        // Feedback bar click delegation
        document.getElementById('agentFeedbackBar')?.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-feedback-remove]');
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.feedbackRemove, 10);
                this.removeFeedbackItem(index);
                return;
            }
            const clearAllBtn = event.target.closest('[data-feedback-clear-all]');
            if (clearAllBtn) {
                this.clearAllFeedback();
                return;
            }
        });

        this.agentComposer?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (this.isAgentInputComposing()) {
                return;
            }
            if (this.agentRunState.active && !this.agentPendingQuestion) {
                this.interruptAgentRun();
                return;
            }
            this.submitAgentMessage();
        });

        this.agentSkillMenuToggle?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleAgentCommandMenu();
        });

        this.agentInput?.addEventListener('keydown', (event) => {
            if (event.isComposing || event.keyCode === 229 || this.agentInputComposing) {
                this.agentInputLastCompositionAt = Date.now();
                return;
            }

            // Autocomplete keyboard control
            if (this.agentAutocompleteOpen) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    this.moveAgentAutocompleteSelection(event.key === 'ArrowDown' ? 1 : -1);
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (this.agentAutocompleteSelectedPage) {
                        this.agentAutocompleteSelectedPage = null;
                        this.agentAutocompleteIndex = 0;
                        this.renderAgentAutocomplete();
                    } else {
                        this.closeAgentAutocomplete();
                    }
                    return;
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.confirmAgentAutocompleteSelection();
                    return;
                }
            }

            if (this.agentCommandMenuOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                this.moveAgentCommandSelection(event.key === 'ArrowDown' ? 1 : -1);
                return;
            }
            if (this.agentCommandMenuOpen && event.key === 'Escape') {
                event.preventDefault();
                this.closeAgentCommandMenu();
                return;
            }
            if (this.agentCommandMenuOpen && event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.applySelectedAgentCommand();
                return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.submitAgentMessage();
            }
        });

        this.agentInput?.addEventListener('compositionstart', () => {
            this.agentInputComposing = true;
            this.agentInputLastCompositionAt = Date.now();
        });

        this.agentInput?.addEventListener('compositionend', () => {
            this.agentInputComposing = false;
            this.agentInputLastCompositionAt = Date.now();
            this.handleAgentInputChange();
            this.renderAgentControls();
        });

        this.agentInput?.addEventListener('input', () => {
            this.handleAgentInputChange();
            this.renderAgentControls();
        });

        this.agentImageUploadBtn?.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!await this.ensureAgentImageUploadNotice()) return;
            this.agentImageInput?.click();
        });

        this.agentImageNoticeModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-agent-image-notice-close="true"]')) {
                this.closeAgentImageUploadNotice(false);
            }
        });

        this.agentImageNoticeModal?.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            this.closeAgentImageUploadNotice(false);
        });

        this.agentImageNoticeCancel?.addEventListener('click', () => {
            this.closeAgentImageUploadNotice(false);
        });

        this.agentImageNoticeOk?.addEventListener('click', () => {
            this.confirmAgentImageUploadNotice();
        });

        this.agentImageInput?.addEventListener('change', async (event) => {
            await this.addAgentAttachmentFiles(event.target.files);
            if (this.agentImageInput) this.agentImageInput.value = '';
        });

        this.agentInput?.addEventListener('paste', async (event) => {
            const files = Array.from(event.clipboardData?.files || [])
                .filter((file) => file.type.startsWith('image/'));
            if (!files.length) return;
            event.preventDefault();
            await this.addAgentAttachmentFiles(files);
        });

        this.agentComposer?.addEventListener('dragenter', (event) => {
            if (!this.hasImageDragItems(event.dataTransfer)) return;
            event.preventDefault();
            this.agentAttachmentDragDepth += 1;
            this.agentComposer.classList.add('is-dragging-image');
        });

        this.agentComposer?.addEventListener('dragover', (event) => {
            if (!this.hasImageDragItems(event.dataTransfer)) return;
            event.preventDefault();
        });

        this.agentComposer?.addEventListener('dragleave', (event) => {
            if (!this.hasImageDragItems(event.dataTransfer)) return;
            this.agentAttachmentDragDepth = Math.max(0, this.agentAttachmentDragDepth - 1);
            if (this.agentAttachmentDragDepth === 0) {
                this.agentComposer.classList.remove('is-dragging-image');
            }
        });

        this.agentComposer?.addEventListener('drop', async (event) => {
            if (!this.hasImageDragItems(event.dataTransfer)) return;
            event.preventDefault();
            this.agentAttachmentDragDepth = 0;
            this.agentComposer.classList.remove('is-dragging-image');
            const files = Array.from(event.dataTransfer?.files || [])
                .filter((file) => file.type.startsWith('image/'));
            await this.addAgentAttachmentFiles(files);
        });

        this.agentAttachmentBar?.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-agent-remove-attachment]');
            if (!removeButton) return;
            this.removeAgentAttachment(removeButton.dataset.agentRemoveAttachment);
        });

        this.agentPrdContextBar?.addEventListener('click', (event) => {
            const clearButton = event.target.closest('[data-agent-clear-prd-context]');
            if (!clearButton) return;
            this.clearAgentPrdContext();
        });

        [
            this.agentApiTypeInput,
            this.agentBaseUrlInput,
            this.agentApiKeyInput,
            this.agentProviderNameInput,
            this.agentCustomModelInput,
            this.agentSdkOptionsInput
        ].forEach((field) => {
            field?.addEventListener('input', () => this.handleAgentConfigInput());
            field?.addEventListener('change', () => this.handleAgentConfigInput());
        });

        this.agentModelInput?.addEventListener('change', () => {
            this.handleAgentModelSelectionChange();
        });

        this.agentSdkOptionsFormatBtn?.addEventListener('click', () => {
            this.formatAgentSdkOptions();
        });

        this.agentSdkOptionsResetBtn?.addEventListener('click', () => {
            if (this.agentSdkOptionsInput) this.agentSdkOptionsInput.value = '';
            this.handleAgentConfigInput();
        });
        this.agentSdkOptionsPresetBtn?.addEventListener('click', () => {
            this.applyAgentSdkPresetOptions();
        });
        this.agentFetchModelsBtn?.addEventListener('click', () => {
            this.fetchAgentModels();
        });
        this.agentPresetDocsBtn?.addEventListener('click', () => {
            const selected = this.getSelectedProvider();
            const preset = this.getAgentPreset(selected?.presetId || this.agentConfig?.provider);
            const target = preset?.apiKeyUrl || preset?.websiteUrl;
            if (target) window.open(target, '_blank', 'noopener');
        });

        this.providerCustomList?.addEventListener('click', (event) => {
            const switchButton = event.target.closest('[data-switch-provider-id]');
            if (switchButton) {
                event.stopPropagation();
                this.activateProvider(switchButton.dataset.switchProviderId);
                return;
            }
            const item = event.target.closest('[data-provider-id]');
            if (item) this.selectProvider(item.dataset.providerId);
        });

        this.addCustomProviderBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.enterCreateMode();
        });

        this.agentProviderPresetTrigger?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.agentProviderPresetOptions) {
                const isOpen = !this.agentProviderPresetOptions.hidden;
                this.togglePresetSelectDropdown(!isOpen);
            }
        });

        this.agentSaveProviderBtn?.addEventListener('click', () => {
            this.saveActiveProvider();
        });


        this.agentDeleteProviderBtn?.addEventListener('click', () => {
            if (this.selectedProviderId) this.deleteProvider(this.selectedProviderId);
        });

        this.agentConfigModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-agent-config-close]')) {
                this.closeAgentConfigModal();
            }
        });

        this.agentConfigClose?.addEventListener('click', () => {
            this.closeAgentConfigModal();
        });

        this.agentTestConnectionBtn?.addEventListener('click', () => {
            this.testAgentConnection();
        });

        this.agentCheckBalanceBtn?.addEventListener('click', () => {
            this.checkAgentBalance();
        });

        this.agentJumpLatestBtn?.addEventListener('click', () => {
            this.scrollAgentTimelineToLatest(true, true);
        });

        this.agentTimeline?.addEventListener('scroll', () => {
            this.handleAgentTimelineScroll();
        });

        this.agentTimeline?.addEventListener('pointerdown', (event) => {
            this.captureAgentFeedbackToggleAnchor(event);
        }, true);

        this.agentTimeline?.addEventListener('toggle', (event) => {
            if (event.target.matches('.agent-feedback-context')) {
                this.restoreAgentFeedbackToggleAnchor(event.target);
                return;
            }
            if (event.target.matches('.agent-process') && event.target.open) {
                const process = event.target;
                const items = process.querySelector('.agent-process__items');
                if (items) {
                    this.scrollElementToBottom(items);
                }
                process.querySelectorAll('.agent-code-block').forEach((cb) => {
                    this.scrollElementToBottom(cb);
                });
            }
        }, true);

        this.agentTimeline?.addEventListener('click', (event) => {
            this.handleAgentTimelineClick(event);
        });

        this.agentImagePreviewModal?.addEventListener('click', (event) => {
            if (event.target.closest('[data-agent-image-preview-close]')) {
                this.closeAgentImagePreview();
            }
        });

        this.agentImagePreviewClose?.addEventListener('click', () => {
            this.closeAgentImagePreview();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.agentImagePreviewModal?.hidden) {
                event.preventDefault();
                this.closeAgentImagePreview();
            }
        });

        this.agentSkillMenu?.addEventListener('click', (event) => {
            const skillOption = event.target.closest('[data-agent-skill-id]');
            if (!skillOption) return;
            this.selectAgentSkill(skillOption.dataset.agentSkillId || '');
        });

        this.agentActiveSkillBar?.addEventListener('click', (event) => {
            const clearTrigger = event.target.closest('[data-agent-clear-skill]');
            if (!clearTrigger) return;
            this.clearActiveAgentSkill();
        });

        this.agentSessionList?.addEventListener('click', (event) => {
            const loadMoreButton = event.target.closest('[data-agent-session-load-more]');
            if (loadMoreButton) {
                this.loadMoreAgentSessions();
                return;
            }
            const sessionButton = event.target.closest('[data-agent-session-id]');
            if (sessionButton) {
                const nextSessionId = sessionButton.dataset.agentSessionId || '';
                this.switchAgentSession(nextSessionId).catch((error) => {
                    console.error('Failed to switch agent session:', error);
                    this.showToast('历史会话加载失败，请稍后重试。', true);
                });
                return;
            }
            const moreButton = event.target.closest('[data-agent-session-more]');
            if (moreButton) {
                event.stopPropagation();
                this.toggleAgentSessionMenu(moreButton);
                return;
            }
            const deleteAction = event.target.closest('[data-agent-session-delete]');
            if (deleteAction) {
                event.stopPropagation();
                this.closeAllAgentSessionMenus();
                this.deleteAgentSessionById(deleteAction.dataset.agentSessionDelete || '');
            }
        });

        document.addEventListener('click', (event) => {
            if (
                this.newPageStyleDropdownOpen
                && !event.target.closest('[data-new-page-style-root]')
                && !event.target.closest('.new-page-style-menu')
            ) {
                this.closeNewPageStyleMenu();
            }
            if (!event.target.closest('.agent-session-item__more') && !event.target.closest('.agent-session-item__dropdown')) {
                this.closeAllAgentSessionMenus();
            }
            const narrowWidth = this.getCssVariable('--agent-panel-narrow-width', 600);
            if (this.agentSessionDrawerOpen && this.agentPanelWidth < narrowWidth) {
                const clickedInsideSidebar = event.target.closest('.agent-session-sidebar');
                const clickedToggleBtn = event.target.closest('#agentSessionDrawerToggle');
                if (!clickedInsideSidebar && !clickedToggleBtn) {
                    this.agentSessionDrawerOpen = false;
                    this.writeAgentStorage('session-drawer-open', false);
                    this.renderAgentWorkbench();
                }
            }
        });

        document.addEventListener('wheel', (event) => {
            if (!this.newPageStyleDropdownOpen) return;
            const menu = event.target.closest?.('.new-page-style-menu');
            if (!menu) return;
            event.preventDefault();
            event.stopPropagation();
            menu.scrollTop += event.deltaY;
        }, { passive: false });

        this.agentCommandMenu?.addEventListener('click', (event) => {
            const commandOption = event.target.closest('[data-agent-command-id]');
            if (!commandOption) return;
            this.executeSlashCommandById(commandOption.dataset.agentCommandId || '');
        });

        this.agentStatusContext?.addEventListener('click', (event) => {
            if (this.agentRunState?.active) return;
            const styleToggle = event.target.closest('[data-new-page-style-toggle]');
            if (styleToggle) {
                event.preventDefault();
                event.stopPropagation();
                this.toggleNewPageStyleMenu();
                return;
            }
            const deviceToggle = event.target.closest('[data-new-page-device]');
            if (deviceToggle) {
                event.preventDefault();
                event.stopPropagation();
                this.setNewPageTargetDevice(deviceToggle.dataset.newPageDevice || 'mobile');
                return;
            }
            if (this.isNewPageStylePickerActive()) return;
            const clearButton = event.target.closest('[data-agent-clear-scope]');
            if (clearButton) {
                event.preventDefault();
                event.stopPropagation();
                this.clearAgentSessionScope();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            this.openAgentScopePicker();
        });
        this.agentStatusContext?.addEventListener('keydown', (event) => {
            if (this.agentRunState?.active || !['Enter', ' '].includes(event.key)) return;
            if (event.target.closest?.('[data-new-page-style-toggle]')) {
                event.preventDefault();
                event.stopPropagation();
                this.toggleNewPageStyleMenu();
                return;
            }
            if (this.isNewPageStylePickerActive()) return;
            if (event.target.closest?.('[data-agent-clear-scope]')) return;
            event.preventDefault();
            event.stopPropagation();
            this.openAgentScopePicker();
        });

        this.agentBindPageBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openAgentScopePicker();
        });

        this.agentAutocompleteDropdown?.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const item = event.target.closest('.agent-autocomplete-item');
            if (!item) return;

            if (item.dataset.autocompleteBack) {
                this.agentAutocompleteSelectedPage = null;
                this.agentAutocompleteIndex = 0;
                this.renderAgentAutocomplete();
                this.agentInput?.focus();
            } else if (item.dataset.autocompletePageId) {
                const pageId = item.dataset.autocompletePageId;
                const page = this.getPageRecord(pageId);
                if (page) {
                    this.agentAutocompleteSelectedPage = page;
                    this.agentAutocompleteIndex = 1;
                    this.renderAgentAutocomplete();
                    this.agentInput?.focus();
                }
            } else if (item.dataset.autocompleteVersion) {
                const version = item.dataset.autocompleteVersion;
                if (this.agentAutocompleteSelectedPage) {
                    const pageId = this.agentAutocompleteSelectedPage.id;
                    await this.bindAgentSessionToPage(pageId, version);
                }
            }
        });

        this.agentDebugTools?.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-agent-dev-simulate]');
            if (!trigger) return;
            this.runAgentDebugScenario(trigger.dataset.agentDevSimulate || 'full_flow');
        });
    }

    // ── Share Settings ──────────────────────────────────────

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                this.settings = await response.json();
            }
        } catch (e) {
            console.warn("Failed to load sharing settings", e);
        }
        if (!this.settings) {
            this.settings = {
                publicDomain: "prota.example.com",
                staticDomain: "share.example.com",
                gitAutoPush: false, vercelAutoDeploy: true
            };
        }
        this.renderSettingsInfo();
    }

    renderSettingsInfo() {
        if (!this.settings) return;
        
        // Preserve a user's in-progress draft during background hydration.
        if (!this.unifiedSettings?.userTouched.has('sharing')) {
        if (this.publicDomainInput) this.publicDomainInput.value = this.settings.publicDomain || '';
        if (this.staticDomainInput) this.staticDomainInput.value = this.settings.staticDomain || '';
        if (this.gitAutoPushCheckbox) this.gitAutoPushCheckbox.checked = this.settings.vercelAutoDeploy !== false;

            if (this.unifiedSettings?.initialized.has('sharing')) this.unifiedSettings.markSaved('sharing');
        }

        // Update share subtexts
        if (this.sharePublicSubtext) {
            this.sharePublicSubtext.textContent = `使用 ${this.settings.publicDomain || 'prota.example.com'} 分享`;
        }
        if (this.shareStaticSubtext) {
            this.shareStaticSubtext.textContent = `发布至 ${this.settings.staticDomain || 'share.example.com'}`;
        }
    }

    openSettingsModal() {
        if (this.unifiedSettings) return this.unifiedSettings.open('sharing');
        this.shareSettingsOpen = true;
        if (this.shareSettingsModal) this.shareSettingsModal.hidden = false;
        this.settingsHelpOpen = true;
        const dialog = this.shareSettingsModal?.querySelector('.settings-modal__dialog');
        if (dialog) {
            dialog.classList.remove('is-collapsed');
        }
        this.updateHelpBannerText();
        this.renderSettingsInfo();
    }

    closeSettingsModal() {
        if (this.unifiedSettings && !this.unifiedSettings.root.hidden) return this.unifiedSettings.requestClose();
        this.shareSettingsOpen = false;
        if (this.shareSettingsModal) this.shareSettingsModal.hidden = true;
    }

    toggleHelp(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.settingsHelpOpen = !this.settingsHelpOpen;
        const dialog = this.shareSettingsModal?.querySelector('.settings-modal__dialog');
        if (dialog) {
            dialog.classList.toggle('is-collapsed', !this.settingsHelpOpen);
        }
        this.updateHelpBannerText();
    }

    expandHelp(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.settingsHelpOpen = true;
        const dialog = this.shareSettingsModal?.querySelector('.settings-modal__dialog');
        if (dialog) {
            dialog.classList.remove('is-collapsed');
        }
        this.updateHelpBannerText();
    }

    updateHelpBannerText() {
        const textSpan = this.shareSettingsForm?.querySelector('.settings-form__help-banner span');
        if (textSpan) {
            if (this.settingsHelpOpen) {
                textSpan.innerHTML = '配置指南已在右侧展开 <button type="button" id="settingsHelpLinkBtn" class="settings-form__help-link-btn">点击收起指南 ↙</button>';
            } else {
                textSpan.innerHTML = '需要了解如何配置吗？ <button type="button" id="settingsHelpLinkBtn" class="settings-form__help-link-btn">点击展开配置指南 ↗</button>';
            }
            // Re-bind the click event listener dynamically
            this.settingsHelpLinkBtn = document.getElementById('settingsHelpLinkBtn');
            this.settingsHelpLinkBtn?.addEventListener('click', (e) => this.toggleHelp(e));
        }
    }

    async saveSettings() {
        const publicDomain = this.publicDomainInput?.value?.trim() || 'prota.example.com';
        const staticDomain = this.staticDomainInput?.value?.trim() || 'share.example.com';
        const vercelAutoDeploy = this.gitAutoPushCheckbox ? this.gitAutoPushCheckbox.checked : true;

        const payload = { ...this.settings, publicDomain, staticDomain, gitAutoPush: false, vercelAutoDeploy };

        const saveBtn = this.shareSettingsForm?.querySelector('button[type="submit"]');
        const oldText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
        }

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const resData = await response.json();
                this.settings = resData.settings || payload;
                this.renderSettingsInfo();
                this.unifiedSettings?.markSaved('sharing', true);
                this.showToast('配置保存成功！', 'success');
                if (!this.unifiedSettings) this.closeSettingsModal();
                return true;
            } else {
                const errorText = await response.text();
                this.unifiedSettings?.setFeedback('保存失败，请检查配置并重试。', true);
                this.showToast(`保存失败: ${errorText}`, 'error');
            }
        } catch (e) {
            console.error("Failed to save sharing settings", e);
            this.showToast(`保存出错: ${e.message}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = oldText;
            }
        }        return false;
    }

    // ── Share menu ──────────────────────────────────────────

    openShareMenu() {
        this.shareMenuOpen = true;
        if (this.shareMenu) this.shareMenu.hidden = false;
        this.shareMenuTrigger?.setAttribute('aria-expanded', 'true');
    }

    closeShareMenu() {
        this.shareMenuOpen = false;
        if (this.shareMenu) this.shareMenu.hidden = true;
        this.shareMenuTrigger?.setAttribute('aria-expanded', 'false');
    }

    toggleShareMenu() {
        this.shareMenuOpen ? this.closeShareMenu() : this.openShareMenu();
    }

    getShareTypeLabel(shareType = 'local') {
        if (shareType === 'static') return '静态云';
        return shareType === 'public' ? '公网' : '本地';
    }

    getPreferredPrdPathForShare() {
        return this.prdModule?.manager?.state?.path || '';
    }

    async copyTextToClipboard(text) {
        if (!text) return false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {
            // Fall through to the textarea fallback below.
        }

        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch {
            return false;
        }
    }

    async createSharePage(shareType = 'local', triggerButton = null) {
        if (!this.activePageId || !this.activeVersion) {
            this.showToast('没有可分享的页面', true);
            return;
        }

        const page = this.getPageRecord();
        const previousContent = triggerButton?.innerHTML || '';
        if (triggerButton) {
            triggerButton.disabled = true;
        }

        if (shareType === 'static') {
            this.showToast('正在生成静态页并推送到 Git...');
        } else {
            this.showToast('正在生成分享链接...');
        }

        let bridgeResponded = false;
        try {
            const normalizedShareType = ['public', 'static'].includes(shareType) ? shareType : 'local';
            const response = await fetch('http://localhost:8080/api/share-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.activeProjectId,
                    pageId: this.activePageId,
                    version: this.activeVersion,
                    shareType: normalizedShareType,
                    public: normalizedShareType === 'public',
                    pageName: page?.name || this.activePageId,
                    prdPath: this.getPreferredPrdPathForShare()
                }),
                signal: AbortSignal.timeout(normalizedShareType === 'static' ? 330000 : 8000)
            });
            bridgeResponded = true;

            if (!response.ok) {
                throw new Error(await response.text() || '分享页生成失败');
            }

            const result = await response.json();
            if (normalizedShareType === 'static' && result.deployWarning) {
                throw new Error(`静态文件已生成到本地，但 Vercel 部署失败：${result.deployWarning}`);
            }
            const rawUrl = result.url || result.path || '';
            const shareUrl = /^https?:\/\//i.test(rawUrl)
                ? rawUrl
                : new URL(rawUrl, window.location.href).href;
            const copied = await this.copyTextToClipboard(shareUrl);
            this.closeShareMenu();
            this.showToast(copied ? '已生成分享页，链接已复制' : '已生成分享页');
            window.open(shareUrl, '_blank');
        } catch (error) {
            console.error('Share page generation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            this.showToast(`生成分享页失败：${message}`, true);
            alert(
                `无法生成${this.getShareTypeLabel(shareType)}分享页。\n\n` +
                `错误原因：\n${message}\n\n` +
                (bridgeResponded
                    ? `Bridge 服务已响应。若 Vercel 部署失败，请检查 Vercel 登录、网络及项目权限配置。`
                    : `请求未完成，请检查 Bridge 服务是否启动；静态发布也可能因 Vercel 部署耗时而超时。`)
            );
        } finally {
            if (triggerButton) {
                triggerButton.disabled = false;
                triggerButton.innerHTML = previousContent;
            }
        }
    }

    collectFolderSharePages(folderId) {
        const project = this.getProjectRecord();
        if (!project) return [];
        const folders = (project.folders || []).filter(f => !f.deleted);
        const folderIds = new Set([folderId]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const f of folders) {
                if (f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
                    folderIds.add(f.id);
                    changed = true;
                }
            }
        }
        return (project.pages || []).filter(p => !p.deleted && p.parentId && folderIds.has(p.parentId));
    }

    async createShareFolder(folderId, shareType = 'local') {
        const folder = (this.getProjectRecord()?.folders || []).find(f => f.id === folderId);
        if (!folder) {
            this.showToast('未找到该文件夹', true);
            return;
        }
        const pageIds = this.collectFolderSharePages(folderId).map(p => p.id);
        if (pageIds.length === 0) {
            this.showToast('文件夹内没有可分享的页面', true);
            return;
        }
        const normalizedShareType = ['public', 'static'].includes(shareType) ? shareType : 'local';
        if (normalizedShareType === 'static') {
            this.showToast(`正在生成静态文件夹分享（${pageIds.length} 个页面）...`);
        } else {
            this.showToast(`正在打包 ${pageIds.length} 个页面...`);
        }
        let bridgeResponded = false;
        try {
            const response = await fetch('http://localhost:8080/api/share-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.activeProjectId,
                    folderId,
                    folderName: folder.name,
                    shareType: normalizedShareType,
                    public: normalizedShareType === 'public',
                    prdPath: this.getPreferredPrdPathForShare()
                }),
                signal: AbortSignal.timeout(normalizedShareType === 'static' ? 330000 : 30000)
            });
            bridgeResponded = true;
            if (!response.ok) {
                throw new Error(await response.text() || '文件夹分享生成失败');
            }
            const result = await response.json();
            if (normalizedShareType === 'static' && result.deployWarning) {
                throw new Error(`静态文件夹已生成到本地，但 Vercel 部署失败：${result.deployWarning}`);
            }
            const rawUrl = result.url || result.path || '';
            const shareUrl = /^https?:\/\//i.test(rawUrl)
                ? rawUrl
                : new URL(rawUrl, window.location.href).href;
            const copied = await this.copyTextToClipboard(shareUrl);
            this.showToast(copied
                ? `已生成文件夹分享（${result.pageCount || pageIds.length} 个页面），链接已复制`
                : `已生成文件夹分享（${result.pageCount || pageIds.length} 个页面）`
            );
            window.open(shareUrl, '_blank');
        } catch (error) {
            console.error('Share folder generation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            this.showToast(`生成文件夹分享失败：${message}`, true);
            alert(
                `无法生成${this.getShareTypeLabel(shareType)}文件夹分享。\n\n` +
                `错误原因：\n${message}\n\n` +
                (bridgeResponded
                    ? `Bridge 服务已响应。若 Vercel 部署失败，请检查 Vercel 登录、网络及项目权限配置。`
                    : `请求未完成，请检查 Bridge 服务是否启动；静态发布也可能因 Vercel 部署耗时而超时。`)
            );
        }
    }

    // ── Version panel rendering ─────────────────────────────

    renderVersionPanel(page) {
        this.versionPanelList.innerHTML = '';

        const hasVersions = page && Array.isArray(page.versions) && page.versions.length > 0;
        if (this.versionSelectorWrap) {
            this.versionSelectorWrap.hidden = !hasVersions;
        }

        if (!hasVersions) {
            this.closePanel();
            this.versionTriggerLabel.textContent = '--';
            return;
        }

        // Sort descending (newest first)
        const sorted = [...page.versions].sort((a, b) => {
            return (parseInt(b.slice(1)) || 0) - (parseInt(a.slice(1)) || 0);
        });

        sorted.forEach(version => {
            const isDeleted = page.versionStates?.[version]?.deleted;
            const isActive = version === this.activeVersion;
            const row = document.createElement('div');
            row.className = `version-row${isActive ? ' is-active' : ''}${isDeleted ? ' is-deleted' : ''}`;

            // Label
            const label = document.createElement('span');
            label.className = 'version-row__label';
            label.textContent = version.toUpperCase();

            const meta = document.createElement('div');
            meta.className = 'version-row__meta';

            // Actions container
            const actions = document.createElement('div');
            actions.className = 'version-row__actions';

            // Fork button
            const forkBtn = document.createElement('button');
            forkBtn.className = 'version-row__btn version-row__btn--fork';
            forkBtn.type = 'button';
            forkBtn.title = `基于 ${version.toUpperCase()} 迭代`;
            forkBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
            forkBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.closePanel();
                await this.forkVersion(version);
            });

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'version-row__btn version-row__btn--delete';
            deleteBtn.type = 'button';
            deleteBtn.title = `删除 ${version.toUpperCase()}`;
            deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteVersion(version);
            });

            // Disable delete if it's the last version
            if (page.versions.length <= 1 || isDeleted) {
                deleteBtn.disabled = true;
                deleteBtn.style.opacity = '0.2';
                deleteBtn.style.cursor = 'not-allowed';
            }

            actions.appendChild(forkBtn);
            actions.appendChild(deleteBtn);

            row.appendChild(label);
            row.appendChild(meta);
            row.appendChild(actions);

            // Click row → switch version
            row.addEventListener('click', () => {
                this.closePanel();
                this.switchVersion(version);
            });

            this.versionPanelList.appendChild(row);
        });

        // Update trigger label
        this.versionTriggerLabel.textContent = this.activeVersion ? this.activeVersion.toUpperCase() : '';

        // Update footer fork button text
        const forkLabel = this.panelForkBtn.querySelector('span');
        if (forkLabel && this.activeVersion) {
            forkLabel.textContent = `基于 ${this.activeVersion.toUpperCase()} 迭代`;
        }
    }

    // ── Fork (iterate) ──────────────────────────────────────

    async forkVersion(sourceVersion) {
        const nextVersion = this.getNextVersionId();
        const pageId = this.activePageId;

        try {
            const response = await fetch('http://localhost:8080/api/iterate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId, newVersion: nextVersion, sourceVersion }),
                signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
                this.showToast(`迭代成功！已从 ${sourceVersion.toUpperCase()} 创建 ${nextVersion.toUpperCase()}`);
                await this.loadData();
                await this.syncFromDisk();
                setTimeout(() => {
                    this.switchVersion(nextVersion);
                }, 500);
                return;
            } else {
                const errorText = await response.text();
                console.error('Bridge returned error:', errorText);
            }
        } catch (err) {
            console.warn('Bridge server not reachable or request failed:', err);
        }

        // Fallback instructions
        const msg = `版本迭代指令已就绪！\n\n` +
                    `【自动模式未开启】\n` +
                    `建议开启后台服务：\n` +
                    `1. 终端运行: python3 server/bridge.py\n` +
                    `2. 浏览器访问: http://localhost:8080\n\n` +
                    `【手动创建模式】\n` +
                    `/bin/bash scripts/iterate.sh ${this.activeProjectId} ${pageId} ${nextVersion} ${sourceVersion}`;
        alert(msg);
    }

    // ── Delete ──────────────────────────────────────────────

    async deleteVersion(version) {
        const pageId = this.activePageId;
        const page = this.getPageRecord(pageId);
        if (!page) return;

        const confirmed = await this.showConfirm({
            title: `删除版本 ${version.toUpperCase()}`,
            message: '该版本将被永久删除，包括所有源文件和标注数据。',
            okText: '确认删除'
        });
        if (!confirmed) return;

        try {
            const response = await fetch('http://localhost:8080/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId, version })
            });

            if (response.ok) {
                this.showToast(`已删除版本 ${version.toUpperCase()}`);
                await this.loadData();
                await this.syncFromDisk();
                this.renderSidebar();
                // Switch to the latest remaining version
                const updatedPage = this.getPageRecord(pageId);
                if (updatedPage?.versions?.length) {
                    this.switchVersion(updatedPage.versions[0], { skipPrdDraftCheck: true });
                }
            } else {
                const errorText = await response.text();
                alert(`删除失败: ${errorText}`);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('无法连接到 Bridge 服务。请检查是否已启动服务。');
        }
    }

    // ── Navigation ──────────────────────────────────────────

    showToast(message, isError = false) {
        this.toastEl.textContent = message;
        this.toastEl.classList.toggle('toast-error', isError);
        this.toastEl.classList.add('show');

        setTimeout(() => {
            this.toastEl.classList.remove('show');
        }, 3000);
    }

    // ── Top-level navigation (项目 / 模板 / Skill) ─────────────

    switchTopView(view) {
        if (!['projects', 'templates', 'skills', 'page'].includes(view)) return;
        this.currentTopView = view;
        if (view === 'projects') {
            this.currentView = 'projects';
        } else if (view === 'page') {
            this.currentView = 'pages';
        }
        if (document.body) {
            document.body.dataset.topView = view;
        }
        this.topTabsEl?.querySelectorAll('.top-tab').forEach(tab => {
            const active = tab.dataset.topView === view;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const views = [
            { el: this.projectsHomeView, key: 'projects' },
            { el: this.templatesHomeView, key: 'templates' },
            { el: this.skillsHomeView, key: 'skills' }
        ];
        views.forEach(v => {
            if (!v.el) return;
            v.el.hidden = v.key !== view;
        });

        if (view === 'projects') {
            this.renderProjectsHome();
        } else if (view === 'templates') {
            this.renderTemplatesHome();
        } else if (view === 'skills') {
            this.renderSkillsHome();
            this.refreshSkillsList().then(() => {
                if (this.currentTopView === 'skills') this.renderSkillsHome();
            });
        }
        this.writeTopViewMemory();
        this.writeShellNavigationState(this.currentView, this.activeProjectId, this.activePageId, this.activeVersion, view);
    }

    readTopViewMemory() {
        try {
            return window.localStorage.getItem(workspaceStorageKey('readify:top-view')) || 'projects';
        } catch {
            return 'projects';
        }
    }

    writeTopViewMemory() {
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:top-view'), this.currentTopView);
        } catch {
            // ignore
        }
    }

    async loadTemplatesData() {
        if (this.templatesData) return this.templatesData;
        try {
            const response = await fetch(`${this.agentApiBase}/api/agent/templates?includeDisabled=1&t=${Date.now()}`);
            if (response.ok) {
                this.templatesData = await response.json();
            } else {
                this.templatesData = await this.loadStaticTemplatesData();
            }
        } catch (err) {
            console.warn('Templates metadata fetch failed:', err);
            this.templatesData = await this.loadStaticTemplatesData();
        }
        return this.templatesData;
    }

    async loadStaticTemplatesData() {
        try {
            const cacheBust = Date.now();
            const [response, stateResponse] = await Promise.all([
                fetch(`/data/templates.json?t=${cacheBust}`),
                fetch(`/data/template-states.json?t=${cacheBust}`)
            ]);
            if (response.ok) {
                const data = await response.json();
                const state = stateResponse.ok ? await stateResponse.json() : { disabled: [] };
                const disabled = Array.isArray(state.disabled) ? state.disabled : [];
                data.disabled = disabled;
                data.templates = (data.templates || []).map((template) => ({
                    ...template,
                    enabled: !disabled.includes(template.id)
                }));
                return data;
            }
        } catch (err) {
            console.warn('Static templates metadata fetch failed:', err);
        }
        return this.getDefaultTemplatesData();
    }

    getDefaultTemplatesData() {
        return { version: 1, templates: [] };
    }

    renderTemplateFilters(templates = []) {
        if (!this.templateCategoryLabel) return;
        const categories = Array.from(new Set(
            templates
                .map((template) => String(template.category || '').trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        const availableFilters = new Set(['all', ...categories]);
        if (!availableFilters.has(this.templateFilter)) {
            this.templateFilter = 'all';
        }
        // Update trigger label
        if (this.templateFilter === 'all') {
            this.templateCategoryLabel.textContent = '全部分类';
        } else {
            this.templateCategoryLabel.textContent = this.templateFilter;
        }
        // Store categories for popover
        this._templateCategories = categories;
        this.renderCategoryPopoverItems(templates);
    }

    renderCategoryPopoverItems(templates = []) {
        if (!this.templateCategoryList) return;
        const categories = this._templateCategories || [];
        const query = String(this.templateCategorySearchQuery || '').trim().toLowerCase();
        const filtered = query
            ? categories.filter(c => c.toLowerCase().includes(query))
            : categories;
        const renderRow = (value, label) => {
            const isActive = this.templateFilter === value;
            return `<button type="button" class="template-category-popover__item${isActive ? ' is-active' : ''}" data-template-filter="${this.escapeHtml(value)}" role="option" ${isActive ? 'aria-selected="true"' : ''}>${this.escapeHtml(label)}</button>`;
        };
        let html = renderRow('all', '全部分类');
        html += filtered.map(c => renderRow(c, c)).join('');
        if (!filtered.length && query) {
            html = `<div class="template-category-popover__empty">无匹配分类</div>`;
        }
        this.templateCategoryList.innerHTML = html;
    }

    toggleCategoryPopover(open) {
        this.templateCategoryPopoverOpen = open;
        if (this.templateCategoryWrapper) {
            this.templateCategoryWrapper.classList.toggle('is-open', open);
        }
        if (this.templateCategoryPopover) {
            this.templateCategoryPopover.hidden = !open;
        }
        if (this.templateCategoryTrigger) {
            this.templateCategoryTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (open) {
            this.templateCategorySearchQuery = '';
            if (this.templateCategorySearch) {
                this.templateCategorySearch.value = '';
                this.templateCategorySearch.focus();
            }
            this.renderCategoryPopoverItems(this.templatesData?.templates || []);
        }
    }

    closeCategoryPopover() {
        this.toggleCategoryPopover(false);
    }

    renderProjectsHome() {
        if (!this.projectGridEl) return;
        const query = String(this.projectSearchQuery || '').trim().toLowerCase();
        const projects = (this.projects?.projects || [])
            .filter(p => !p.deleted)
            .filter((project) => {
                if (!query) return true;
                const pages = Array.isArray(project.pages) ? project.pages : [];
                const searchableText = [
                    project.id,
                    project.name,
                    ...pages.map(page => page.id),
                    ...pages.map(page => page.name)
                ].map(value => String(value || '').toLowerCase()).join(' ');
                return searchableText.includes(query);
            })
            .sort((a, b) => {
                return String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-CN');
            });

        this.projectGridEl.innerHTML = '';
        if (!projects.length) {
            if (this.projectsEmptyStateEl) this.projectsEmptyStateEl.hidden = false;
            return;
        }
        if (this.projectsEmptyStateEl) this.projectsEmptyStateEl.hidden = true;

        projects.forEach(proj => {
            const card = document.createElement('div');
            card.className = `home-card project-card${proj.id === this.activeProjectId && this.currentTopView === 'page' ? ' is-active' : ''}`;
            card.dataset.projectId = proj.id;

            const pages = (proj.pages || []).filter(p => !p.deleted);
            const activePageCount = pages.length;
            const projectName = String(proj.name || '').trim();

            card.innerHTML = `
                <button type="button" class="project-card__more" title="项目操作" data-project-more="${this.escapeHtml(proj.id)}" aria-label="项目操作">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                </button>
                <div class="project-card__head">
                    <div class="project-card__title-block">
                        <h3 class="project-card__name">${this.escapeHtml(projectName || '未命名项目')}</h3>
                        <span class="project-card__id">${this.escapeHtml(proj.id)}</span>
                    </div>
                </div>
                <div class="project-card__footer">
                    <span class="project-card__count"><strong>${activePageCount}</strong>${activePageCount ? ' 个页面' : ' 暂无页面'}</span>
                    <div class="project-card__actions">
                        <button type="button" class="project-card__open" data-project-open="${this.escapeHtml(proj.id)}">
                            <span>打开项目</span>
                        </button>
                    </div>
                </div>
            `;

            card.addEventListener('click', (event) => {
                if (event.target.closest('[data-project-more]')) return;
                const openButton = event.target.closest('[data-project-open]');
                if (openButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.enterProject(proj.id);
                    return;
                }
                this.enterProject(proj.id);
            });

            const moreBtn = card.querySelector('[data-project-more]');
            if (moreBtn) {
                moreBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.openProjectCardMenu(proj.id, moreBtn);
                });
            }

            this.projectGridEl.appendChild(card);
        });
    }

    async openProjectCardMenu(projectId, anchor) {
        const proj = this.projects?.projects?.find(p => p.id === projectId);
        if (!proj) return;
        const existing = document.querySelector('.project-card-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.className = 'project-card-menu nav-item__menu is-open';
        menu.innerHTML = `
            <button type="button" class="nav-item__menu-btn nav-item__menu-btn--rename" data-project-rename="${this.escapeHtml(projectId)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                <span>重命名</span>
            </button>
            <button type="button" class="nav-item__menu-btn" data-project-edit-id="${this.escapeHtml(projectId)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>
                <span>编辑 ID</span>
            </button>
            <button type="button" class="nav-item__menu-btn" data-project-delete="${this.escapeHtml(projectId)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                <span>删除项目</span>
            </button>
        `;
        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 6}px`;
        menu.style.left = `${rect.right - 160}px`;
        menu.style.zIndex = '1000';
        document.body.appendChild(menu);

        const close = () => {
            menu.remove();
            document.removeEventListener('click', onDocClick, true);
        };
        const onDocClick = (e) => {
            if (!menu.contains(e.target) && e.target !== anchor) close();
        };
        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);

        menu.addEventListener('click', async (event) => {
            const renameBtn = event.target.closest('[data-project-rename]');
            const editIdBtn = event.target.closest('[data-project-edit-id]');
            const deleteBtn = event.target.closest('[data-project-delete]');
            if (renameBtn) {
                close();
                await this.renameProjectFlow(renameBtn.dataset.projectRename);
                this.renderProjectsHome();
                return;
            }
            if (editIdBtn) {
                close();
                await this.editProjectIdFlow(editIdBtn.dataset.projectEditId);
                this.renderProjectsHome();
                return;
            }
            if (deleteBtn) {
                close();
                await this.deleteProject(deleteBtn.dataset.projectDelete);
                this.renderProjectsHome();
            }
        });
    }

    async renameProjectFlow(projectId) {
        const project = this.projects?.projects?.find(p => p.id === projectId);
        if (!project) return;
        const newName = await this._showRenameModal(project.name || '', '重命名项目', '请输入项目新名称');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === project.name) return;
        try {
            const response = await fetch('http://localhost:8080/api/rename-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, newName: trimmed })
            });
            if (!response.ok) throw new Error(await response.text() || '重命名失败');
            await this.loadData();
            await this.syncFromDisk();
            this.showToast(`已重命名为「${trimmed}」`);
        } catch (err) {
            alert(`重命名失败: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async renderTemplatesHome() {
        if (!this.templateGridEl) return;
        await this.loadTemplatesData();
        const disabled = new Set(this.templatesData?.disabled || []);
        const mobileTemplates = (this.templatesData?.templates || []).map((template) => ({
            ...template,
            targetDevice: 'mobile',
            enabled: template.enabled !== false && !disabled.has(template.id)
        }));
        const webTemplates = NEW_PAGE_WEB_FRAMEWORKS.map((framework) => ({
            ...framework,
            targetDevice: 'web',
            category: framework.technology || 'Web',
            tags: [framework.technology || 'Web', '框架 Skill'],
            enabled: !disabled.has(framework.id)
        }));
        if (this.mobileTemplateCountEl) this.mobileTemplateCountEl.textContent = String(mobileTemplates.length);
        if (this.webTemplateCountEl) this.webTemplateCountEl.textContent = String(webTemplates.length);
        const all = this.templateDeviceFilter === 'web' ? webTemplates : mobileTemplates;
        this.renderTemplateFilters(all);
        const query = String(this.templateSearchQuery || '').trim().toLowerCase();
        const filtered = all.filter((tpl) => {
            const isEnabled = tpl.enabled !== false;
            if (this.templateFilter !== 'all' && tpl.category !== this.templateFilter) return false;
            if (this.templateStatusFilter === 'enabled' && !isEnabled) return false;
            if (this.templateStatusFilter === 'disabled' && isEnabled) return false;
            if (!query) return true;
            return [
                tpl.name,
                tpl.id,
                tpl.category,
                tpl.description,
                ...(tpl.tags || [])
            ].some((value) => String(value || '').toLowerCase().includes(query));
        });

        this.hideTemplatePreviewZoom();
        this.templateGridEl.classList.toggle('template-grid--mobile', this.templateDeviceFilter !== 'web');
        this.templateGridEl.innerHTML = '';
        if (!filtered.length) {
            if (this.templatesEmptyStateEl) this.templatesEmptyStateEl.hidden = false;
            return;
        }
        if (this.templatesEmptyStateEl) this.templatesEmptyStateEl.hidden = true;

        filtered.forEach(tpl => {
            const isEnabled = tpl.enabled !== false;
            const isWeb = tpl.targetDevice === 'web';
            const screenshot = isWeb ? this.getFrameworkScreenshot(tpl) : this.getMobileTemplateScreenshot(tpl);
            const previewPage = isWeb ? this.getFrameworkPreviewPage(tpl) : this.getMobileTemplatePreviewPage(tpl);
            const card = document.createElement('article');
            card.className = `home-card template-card template-card--${isWeb ? 'web' : 'mobile'}${isEnabled ? '' : ' is-disabled'}`;
            card.dataset.templateId = tpl.id;
            card.innerHTML = `
                <div class="template-card__preview" data-template-preview-anchor="true">
                    <img class="template-card__preview-image" src="${this.escapeHtml(screenshot)}" alt="${this.escapeHtml(tpl.name || tpl.id)} 界面预览" loading="${isWeb ? 'eager' : 'lazy'}" data-template-preview-image="${this.escapeHtml(screenshot)}" data-template-preview-orientation="${isWeb ? 'landscape' : 'portrait'}">
                    <div class="template-card__preview-overlay">
                        <span>${isWeb ? 'Web 框架' : '移动端风格'}</span>
                        ${previewPage ? `<a href="${this.escapeHtml(previewPage)}" target="_blank" rel="noopener" data-template-preview-open="true">打开完整预览</a>` : ''}
                    </div>
                </div>
                ${isWeb ? '' : `<button type="button" class="template-card__delete" data-template-delete="${this.escapeHtml(tpl.id)}" title="删除模板" aria-label="删除模板">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>`}
                <div class="template-card__body">
                    <div class="template-card__heading">
                        <div>
                            <h3>${this.escapeHtml(tpl.name || tpl.id)}</h3>
                            <p>${this.escapeHtml(tpl.description || (isWeb ? '用于 Web B 端页面的框架 Skill。' : '用于移动端页面的设计系统。'))}</p>
                        </div>
                        <span class="template-card__device">${isWeb ? (tpl.technology || 'Web') : (tpl.category || '移动端')}</span>
                    </div>
                    <div class="template-card__footer">
                        <span class="template-card__status ${isEnabled ? 'is-enabled' : 'is-disabled'}">${isEnabled ? '已启用' : '已停用'}</span>
                        <div class="template-card__actions">
                            <button type="button" class="template-card__status-btn" data-template-status="${this.escapeHtml(tpl.id)}" data-template-enabled="${isEnabled ? 'false' : 'true'}">
                                ${isEnabled ? '停用' : '启用'}
                            </button>
                            <button type="button" class="template-card__use" data-template-use="${this.escapeHtml(tpl.id)}" ${isEnabled ? '' : 'disabled'}>
                                <span>使用</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            card.addEventListener('click', (event) => {
                if (event.target.closest('[data-template-preview-open]')) return;
                const statusButton = event.target.closest('[data-template-status]');
                if (statusButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setTemplateEnabled(tpl.id, statusButton.dataset.templateEnabled === 'true');
                    return;
                }
                if (event.target.closest('[data-template-delete]')) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.deleteTemplate(tpl.id, tpl.name || tpl.id);
                    return;
                }
                if (event.target.closest('[data-template-use]')) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isEnabled) {
                        this.applyCatalogTemplateForNewPage(tpl);
                    } else {
                        this.showToast('请先启用该模板再使用', true);
                    }
                } else if (!isWeb) {
                    this.openTemplateDetail(tpl.id);
                }
            });
            const previewAnchor = card.querySelector('[data-template-preview-anchor]');
            if (isWeb) {
                previewAnchor?.addEventListener('mouseenter', () => this.showTemplatePreviewZoom(card));
                previewAnchor?.addEventListener('mouseleave', () => this.hideTemplatePreviewZoom());
            }
            this.templateGridEl.appendChild(card);
        });
    }

    showTemplatePreviewZoom(card) {
        const image = card?.querySelector('[data-template-preview-image]');
        if (!image?.src) return;
        if (!this.templatePreviewZoomEl) {
            this.templatePreviewZoomEl = document.createElement('div');
            this.templatePreviewZoomEl.className = 'template-preview-zoom';
            this.templatePreviewZoomEl.innerHTML = '<img alt="" /><strong></strong>';
            document.body.appendChild(this.templatePreviewZoomEl);
        }
        const portrait = image.dataset.templatePreviewOrientation === 'portrait';
        const rect = card.getBoundingClientRect();
        const width = portrait ? 330 : Math.min(620, window.innerWidth - 32);
        const height = portrait ? Math.min(710, window.innerHeight - 32) : Math.round(width * 900 / 1440) + 42;
        let left = rect.right + 14;
        if (left + width > window.innerWidth - 12) left = rect.left - width - 14;
        if (left < 12) left = Math.max(12, Math.round((window.innerWidth - width) / 2));
        const top = Math.max(12, Math.min(rect.top, window.innerHeight - height - 12));
        this.templatePreviewZoomEl.style.width = `${width}px`;
        this.templatePreviewZoomEl.style.left = `${left}px`;
        this.templatePreviewZoomEl.style.top = `${top}px`;
        this.templatePreviewZoomEl.classList.toggle('is-portrait', portrait);
        this.templatePreviewZoomEl.querySelector('img').src = image.src;
        this.templatePreviewZoomEl.querySelector('strong').textContent = card.querySelector('.template-card__heading h3')?.textContent || '';
        this.templatePreviewZoomEl.classList.add('is-visible');
    }

    hideTemplatePreviewZoom() {
        this.templatePreviewZoomEl?.classList.remove('is-visible');
    }

    getTemplatePalette(values = []) {
        const seen = new Set();
        return values
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .filter(value => {
                const key = value.toLowerCase().replace(/\s+/g, '');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 8);
    }

    getTemplateReadableTextColor(background, textColor, isDark = this._isColorDark(background)) {
        const candidate = String(textColor || '').trim();
        if (!candidate || candidate.includes('gradient')) return isDark ? '#f8fafc' : '#0f172a';
        const textIsDark = this._isColorDark(candidate);
        if (isDark && textIsDark) return '#f8fafc';
        if (!isDark && !textIsDark) return '#0f172a';
        return candidate;
    }

    getTemplateCardSignals(tpl, designSpec = {}) {
        const fallbackByCategory = [
            [/(editorial|print|studio|magazine|内容|出版)/i, ['编辑排版', '纸感层次']],
            [/(fintech|crypto|finance|金融|支付)/i, ['金融产品', '品牌高亮']],
            [/(developer|tools|agent|terminal|开发|工具)/i, ['工具界面', '信息密度']],
            [/(media|consumer|social|媒体|消费)/i, ['内容场景', '品牌识别']],
            [/(starter|application|dashboard|productivity|saas)/i, ['产品工作台', '清晰结构']],
            [/(dark|暗色)/i, ['暗色系统', '高对比']]
        ];
        const values = [
            ...(designSpec.signals || []),
            ...(Array.isArray(tpl.tags) ? tpl.tags : []),
            tpl.category
        ];
        const normalized = [];
        for (const value of values) {
            const signal = this.compactTemplateSignal(value);
            if (signal && !normalized.includes(signal)) normalized.push(signal);
            if (normalized.length >= 3) break;
        }
        if (normalized.length < 2) {
            const category = `${tpl.category || ''} ${tpl.description || ''}`;
            const match = fallbackByCategory.find(([re]) => re.test(category));
            for (const item of match?.[1] || ['设计系统', '可复用']) {
                if (!normalized.includes(item)) normalized.push(item);
            }
        }
        return normalized.slice(0, 3);
    }

    compactTemplateSignal(value = '') {
        let raw = this.cleanTemplateMarkdownText(value);
        const labeled = raw.match(/^(Visual style|Color stance|Posture|Mood|Tone|Typography|Interaction|Layout|Reading rhythm|Use when|Avoid)\s*:\s*(.+)$/i);
        if (labeled?.[2]) raw = labeled[2].trim();
        if (!raw || /^bundled$|^color$|^accessibility/i.test(raw)) return '';
        const rules = [
            [/conversational|ai-first|agent|delegated task/i, 'Agent 工作流'],
            [/clear outcomes|outcome|goal/i, '结果导向'],
            [/modern|bold|expressive/i, '大胆现代'],
            [/surface|subtle|contrast|layer/i, '低调层次'],
            [/weight\s*300|light weight|whisper/i, '轻量标题'],
            [/weight\s*900|billboard|massive|mega|oversized|107px|126px/i, '巨型标题'],
            [/dark-mode|dark-only|near-black|terminal|暗色|黑底/i, '暗色系统'],
            [/paper|parchment|warm ivory|handmade|纸|羊皮/i, '纸感画布'],
            [/editorial|magazine|serif|roman numeral|collage|杂志|衬线|拼贴/i, '编辑叙事'],
            [/data-dense|dashboard|metrics|chart|交易|数据/i, '数据密度'],
            [/lime|green|mint|亮绿|绿色/i, '绿色高亮'],
            [/purple|violet|magenta|紫|靛蓝/i, '紫色高亮'],
            [/red|ruby|coral|brand red|红|珊瑚/i, '红色高亮'],
            [/pill|radius|rounded|圆角/i, '圆角体系'],
            [/shadow|elevation|depth|阴影/i, '层次阴影'],
            [/openType|ss01|calt|font|typography|字体|排版/i, '字体规则'],
            [/white space|minimal|neutral|clean|留白|克制/i, '克制留白'],
            [/motion|hover|scale|animation|动效/i, '动效反馈']
        ];
        const found = rules.find(([re]) => re.test(raw));
        if (found) return found[1];
        if (/[:/]|\.{2,}/.test(raw)) return '';
        return this.truncateTemplateText(raw.replace(/\s+[-—].*$/, ''), 18);
    }

    async loadTemplateDesignSpecs(templates = []) {
        const pairs = await Promise.all(templates.map(async (tpl) => {
            const filePath = tpl.files?.design || tpl.filePath;
            if (!filePath) return [tpl.id, null];
            if (this.templateDesignSpecCache.has(filePath)) {
                return [tpl.id, this.templateDesignSpecCache.get(filePath)];
            }
            let spec = null;
            try {
                const resp = await fetch(`/${filePath}?t=${Date.now()}`);
                if (resp.ok) {
                    const markdown = await resp.text();
                    spec = this.parseTemplateDesignSpec(markdown);
                }
            } catch (err) {
                spec = null;
            }
            this.templateDesignSpecCache.set(filePath, spec);
            return [tpl.id, spec];
        }));
        return new Map(pairs);
    }

    parseTemplateDesignSpec(markdown = '') {
        const text = String(markdown || '');
        const colors = this.extractDesignColors(text);
        const frontmatter = this.extractDesignFrontmatter(text);
        const fonts = this.extractDesignFonts(text, frontmatter);
        const byRole = this.classifyDesignColors(text, colors);
        const signals = this.extractTemplateDesignSignals(text);
        return {
            colors,
            signals,
            background: frontmatter.background || byRole.background || colors[0] || null,
            surface: frontmatter.surface || byRole.surface || colors[1] || byRole.background || null,
            text: byRole.text || null,
            muted: byRole.muted || null,
            border: byRole.border || null,
            accent: frontmatter.accent || byRole.accent || colors.find(color => color !== byRole.background && color !== byRole.surface && color !== byRole.text) || null,
            accentSecondary: frontmatter.accentSecondary || byRole.accentSecondary || null,
            fontHeading: fonts.heading || fonts.display || fonts.primary || null,
            fontBody: fonts.body || fonts.text || fonts.primary || null
        };
    }

    extractTemplateDesignSignals(text = '') {
        const source = String(text || '');
        const keyBlock = source.match(/\*\*Key Characteristics:\*\*([\s\S]*?)(?:\n##|\n###|$)/i)?.[1] || '';
        const visualBlock = source.match(/##\s*(?:\d+\.\s*)?(?:Visual Theme & Atmosphere|视觉|Theme)[^\n]*\n+([\s\S]*?)(?:\n##|$)/i)?.[1] || '';
        const candidates = [
            ...keyBlock.split('\n'),
            ...visualBlock.split('\n')
        ]
            .map(line => line.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean)
            .filter(line => !/^#{1,6}\s/.test(line))
            .filter(line => line.length > 8);
        const signals = [];
        for (const line of candidates) {
            const signal = this.compactTemplateSignal(line);
            if (signal && !signals.includes(signal)) signals.push(signal);
            if (signals.length >= 4) break;
        }
        return signals;
    }

    cleanTemplateMarkdownText(value = '') {
        return String(value || '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/!\[[^\]]*]\([^)]+\)/g, '')
            .replace(/\[[^\]]+]\([^)]+\)/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    truncateTemplateText(value = '', limit = 96) {
        const text = this.cleanTemplateMarkdownText(value);
        if (text.length <= limit) return text;
        return `${text.slice(0, limit).replace(/\s+\S*$/, '')}...`;
    }

    extractDesignFrontmatter(text = '') {
        const match = String(text || '').match(/^---\n([\s\S]*?)\n---/);
        if (!match) return {};
        const block = match[1];
        const pick = (key) => {
            const m = block.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'mi'));
            return m?.[1]?.trim() || null;
        };
        const heading = block.match(/^\s*heading:\s*["']?([^"'\n]+)["']?\s*$/mi)?.[1]?.trim() || null;
        const body = block.match(/^\s*body:\s*["']?([^"'\n]+)["']?\s*$/mi)?.[1]?.trim() || null;
        const family = block.match(/^\s*family:\s*["']?([^"'\n]+)["']?\s*$/mi)?.[1]?.trim() || null;
        return {
            background: pick('background') || pick('bg'),
            surface: pick('surface'),
            accent: pick('accent'),
            accentSecondary: pick('accentSecondary'),
            fontHeading: heading,
            fontBody: body || family
        };
    }

    extractDesignColors(text = '') {
        const colorPattern = /linear-gradient\([^`\n)]+\)|rgba?\([^`\n)]+\)|#[0-9a-f]{3,8}\b/gi;
        const seen = new Set();
        const colors = [];
        for (const match of text.matchAll(colorPattern)) {
            const color = match[0].trim();
            const key = color.toLowerCase().replace(/\s+/g, '');
            if (seen.has(key)) continue;
            seen.add(key);
            colors.push(color);
            if (colors.length >= 16) break;
        }
        return colors;
    }

    classifyDesignColors(text = '', colors = []) {
        const roles = {};
        const lines = String(text || '').split(/\n+/);
        const roleMatchers = [
            ['accent', /accent|brand|coral|rausch|primary color|brand color|signature|强调|主色|品牌/i],
            ['accentSecondary', /secondary|accent-2|accent 2|magenta|purple|mustard|olive|辅色|第二/i],
            ['background', /background|canvas|paper|page background|main background|primary background|主背景|背景|底/i],
            ['surface', /surface|card|panel|container|glass|subsurface|elevated|soft cloud|bone|卡片|表面|容器/i],
            ['text', /text|ink|foreground|body text|primary text|near-black|主文本|文字|墨/i],
            ['muted', /muted|secondary text|tertiary|caption|helper|soft|faint|ash|mute|辅助|弱|次级/i],
            ['border', /border|divider|hairline|rule|outline|分割|边框|线/i]
        ];
        for (const line of lines) {
            const color = this.extractDesignColors(line)[0];
            if (!color) continue;
            const normalizedLine = line.replace(/--[a-z0-9-_]+/gi, '');
            for (const [role, matcher] of roleMatchers) {
                if (!roles[role] && matcher.test(normalizedLine)) {
                    roles[role] = color;
                    break;
                }
            }
        }
        if (!roles.accent) {
            roles.accent = colors.find(color => ![roles.background, roles.surface, roles.text, roles.muted, roles.border].includes(color)) || null;
        }
        if (!roles.accentSecondary) {
            roles.accentSecondary = colors.find(color => color !== roles.accent && ![roles.background, roles.surface, roles.text, roles.muted, roles.border].includes(color)) || null;
        }
        return roles;
    }

    extractDesignFonts(text = '', frontmatter = {}) {
        const fonts = {
            heading: frontmatter.fontHeading || null,
            body: frontmatter.fontBody || null
        };
        const lines = String(text || '').split(/\n+/);
        let inFontSection = false;
        for (const line of lines) {
            if (/^#{2,4}\s+/.test(line)) {
                inFontSection = /(typography|font family|families|font substitutes|字体|排版)/i.test(line);
                if (/^#{3,4}\s+(font family|families)$/i.test(line.trim())) continue;
            }
            if (!inFontSection && !/(display family|text family|primary=|display=|body=|font:|标题字体|正文字体)/i.test(line)) continue;
            if (/^#{2,4}\s+/.test(line) && !/(typography|font family|families|font substitutes|字体|排版)/i.test(line)) {
                inFontSection = false;
                continue;
            }
            if (/color|palette|#[0-9a-f]{3,8}|--[a-z0-9-_]+/i.test(line)) continue;
            const explicitFontLine = /(display family|text family|font family|heading|body|primary and only|primary=|display=|body=|font:|标题字体|正文字体)/i.test(line);
            if (!explicitFontLine) continue;
            if (/usage split|substitute|closest|observed|features|principles|weights|line height|letter spacing/i.test(line)) continue;
            if (/fallback/i.test(line) && !/(display family|text family|font family|primary and only)/i.test(line)) continue;
            const bold = line.match(/\*\*([^*`]+?)\*\*/);
            const quoted = line.match(/`([^`]+)`/);
            const boldValue = bold?.[1]?.trim() || '';
            const raw = boldValue && !/(family|display|body|text|ui|marketing|primary|font|sans|serif|usage|split)/i.test(boldValue)
                ? boldValue
                : quoted?.[1]
                || (line.includes(':') || line.includes('：') ? line.split(/[:：]/).slice(1).join(':') : line);
            const family = this.extractFontFamilyValue(raw);
            if (!family) continue;
            const label = line.toLowerCase();
            if (/primary and only/.test(label)) {
                if (!fonts.primary) fonts.primary = family;
                if (!fonts.heading) fonts.heading = family;
                if (!fonts.body) fonts.body = family;
            } else if (/display|heading|marketing|sans|标题/.test(label) && !fonts.heading) fonts.heading = family;
            else if (/body|text family|ui|primary and only|正文/.test(label) && !fonts.body) fonts.body = family;
            else if (/primary|font family|families|字体/.test(label) && !fonts.primary) fonts.primary = family;
        }
        if (!fonts.body && fonts.primary) fonts.body = fonts.primary;
        if (!fonts.heading && fonts.primary) fonts.heading = fonts.primary;
        return fonts;
    }

    extractFontFamilyValue(value = '') {
        const raw = String(value || '').replace(/\*\*/g, '').trim();
        if (!raw || /--[a-z0-9-_]+|#[0-9a-f]{3,8}|^\W+$|px|rem|pending|success|error|hover|状态|颜色点|章节|family$/i.test(raw)) return null;
        const quoted = raw.match(/[`'"]([^`'"]+)[`'"]/);
        if (quoted?.[1] && !/#[0-9a-f]{3,8}/i.test(quoted[1])) {
            return `'${quoted[1].trim()}', sans-serif`;
        }
        const afterColon = raw.split(/[:：=]/).pop() || raw;
        const first = afterColon
            .split(/[,，/、]|fallback|with fallback|回退/i)[0]
            .replace(/\([^)]*\)/g, '')
            .replace(/`/g, '')
            .trim();
        if (!first || first.length > 48 || /#[0-9a-f]{3,8}|px|rem|\d|[。；：]/.test(first)) return null;
        return first.includes(' ') ? `'${first}', sans-serif` : `${first}, sans-serif`;
    }

    getTemplateCardBackground({ background, surface, accent, accentSecondary, isDark } = {}) {
        const bg = String(background || '#ffffff').trim();
        if (bg.includes('gradient')) return bg;
        const surfaceValue = String(surface || bg).trim();
        const accentA = this.templateColorWithAlpha(accent, isDark ? '1f' : '14');
        const accentB = this.templateColorWithAlpha(accentSecondary || accent, isDark ? '24' : '18');
        if (isDark) {
            return `radial-gradient(86% 72% at 100% 0%, ${accentB}, transparent 62%), linear-gradient(180deg, ${bg}, ${surfaceValue})`;
        }
        return `radial-gradient(90% 80% at 100% 0%, ${accentB}, transparent 58%), linear-gradient(135deg, ${accentA}, transparent 42%), linear-gradient(180deg, ${bg}, ${surfaceValue})`;
    }

    _isColorDark(value) {
        if (!value || typeof value !== 'string') return false;
        if (value.includes('gradient')) {
            return /#0[0-9a-f]|#1[0-9a-f]|#2[0-9a-f]/i.test(value);
        }
        const m = value.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
        if (!m) return false;
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.55;
    }

    templateColorWithAlpha(value, alphaHex = '22') {
        const color = String(value || '').trim();
        const match = color.match(/^#([0-9a-f]{6})$/i);
        return match ? `${color}${alphaHex}` : 'rgba(99, 102, 241, 0.14)';
    }

    async openTemplateDetail(templateId) {
        await this.loadTemplatesData();
        const tpl = (this.templatesData?.templates || []).find(t => t.id === templateId);
        if (!tpl) return;
        const p = tpl.preview || {};
        const swatchBg = p.background || '#ffffff';
        const accent = p.accent || '#6366f1';
        const accent2 = p.accentSecondary || accent;
        const surface = p.surface || '#ffffff';
        const textColor = p.text || '#0f172a';
        const borderColor = p.border || 'rgba(15,23,42,0.12)';
        const headingFamily = p.fontHeading || 'Outfit, sans-serif';
        const tokens = [
            { name: '--color-bg', value: p.background },
            { name: '--color-surface', value: p.surface },
            { name: '--color-accent', value: p.accent },
            { name: '--color-text', value: p.text },
            { name: '--color-muted', value: p.muted },
            { name: '--color-border', value: p.border },
            { name: '--font-heading', value: p.fontHeading },
            { name: '--font-body', value: p.fontBody },
            { name: '--radius', value: p.radius != null ? p.radius + 'px' : null }
        ].filter(t => t.value != null && t.value !== '');
        const fileEntries = Object.entries(tpl.files || {})
            .filter(([, filePath]) => filePath)
            .map(([key, filePath]) => ({ key, filePath }));
        const isEnabled = tpl.enabled !== false;

        let markdown = '';
        try {
            const resp = await fetch(`/${tpl.filePath}?t=${Date.now()}`);
            if (resp.ok) markdown = await resp.text();
        } catch (err) {
            markdown = '';
        }

        this.templateDetailBody.innerHTML = `
            <div class="template-detail">
                <button type="button" class="template-detail__close" data-template-detail-close="true" title="关闭模板详情" aria-label="关闭模板详情">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
                <section class="template-detail__hero" style="background:${swatchBg};color:${textColor};">
                    <div class="template-detail__hero-bg" style="background: radial-gradient(70% 80% at 100% 0%, ${accent}28, transparent 62%), radial-gradient(65% 80% at 0% 100%, ${accent2}22, transparent 58%);"></div>
                    <div class="template-detail__hero-copy">
                        <div class="template-detail__eyebrow">${this.escapeHtml(tpl.category || 'style system')}</div>
                        <h3 class="template-detail__title" style="font-family:${this.escapeHtml(headingFamily)};">${this.escapeHtml(tpl.name)}</h3>
                        <p class="template-detail__desc">${this.escapeHtml(tpl.description || '')}</p>
                        <div class="template-detail__tags">
                            ${(tpl.tags || []).map(tag => `<span>${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="template-detail__preview-card" style="background:${surface};border-color:${borderColor};color:${textColor};">
                        <div class="template-detail__preview-top">
                            <span style="background:${accent};"></span>
                            <span style="background:${accent2};"></span>
                            <span style="background:${borderColor};"></span>
                        </div>
                        <div class="template-detail__preview-title" style="background:${textColor};"></div>
                        <div class="template-detail__preview-line" style="background:${borderColor};"></div>
                        <div class="template-detail__preview-line template-detail__preview-line--short" style="background:${borderColor};"></div>
                        <div class="template-detail__preview-actions">
                            <span style="background:${accent};"></span>
                            <span style="border-color:${borderColor};"></span>
                        </div>
                    </div>
                </section>
                <section class="template-detail__content">
                    <div class="template-detail__section">
                        <h4>设计 Token</h4>
                        <div class="template-detail__tokens">
                            ${tokens.map(t => `
                                <div class="template-detail__token">
                                    <span class="template-detail__token-swatch" style="background:${t.value};${this._isColorDark(t.value) ? 'border-color:rgba(255,255,255,0.2);' : ''}"></span>
                                    <span class="template-detail__token-name">${this.escapeHtml(t.name)}</span>
                                    <span class="template-detail__token-value">${this.escapeHtml(String(t.value))}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ${markdown ? `
                        <div class="template-detail__section">
                            <h4>规范说明</h4>
                            <div class="template-detail__markdown">${this.escapeHtml(markdown)}</div>
                        </div>
                    ` : ''}
                    ${fileEntries.length ? `
                        <div class="template-detail__section">
                            <h4>支持文件</h4>
                            <div class="template-detail__files">
                                ${fileEntries.map((item) => `
                                    <a href="/${this.escapeHtml(item.filePath)}" target="_blank" rel="noopener">
                                        <span>${this.escapeHtml(item.key)}</span>
                                        <small>${this.escapeHtml(item.filePath)}</small>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </section>
                <div class="template-detail__actions">
                    <button type="button" class="home-view__ghost-btn" data-template-detail-close="true">关闭</button>
                    <button type="button" class="home-view__ghost-btn" data-template-detail-status="${this.escapeHtml(tpl.id)}" data-template-enabled="${isEnabled ? 'false' : 'true'}">
                        ${isEnabled ? '停用模板' : '启用模板'}
                    </button>
                    <button type="button" class="home-view__primary-btn" data-template-detail-use="${this.escapeHtml(tpl.id)}" ${isEnabled ? '' : 'disabled'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        <span>${isEnabled ? '用此风格新建页面' : '模板已停用'}</span>
                    </button>
                </div>
            </div>
        `;
        this.templateDetailModal.hidden = false;
        this.templateDetailOpen = true;
    }

    closeTemplateDetailModal() {
        if (!this.templateDetailModal) return;
        this.templateDetailModal.hidden = true;
        this.templateDetailOpen = false;
    }

    getNewPageStyleOptions() {
        const templates = (this.templatesData?.templates || []).filter((template) => template.enabled !== false);
        return [
            {
                id: 'default',
                name: '默认风格',
                description: '不指定风格，让 AI 根据页面需求和上下文自行选择视觉方向。',
                preview: {
                    background: '#f8fafc',
                    surface: '#ffffff',
                    accent: '#0f172a',
                    accentSecondary: '#64748b',
                    text: '#0f172a',
                    border: '#e2e8f0',
                    fontHeading: 'Outfit'
                }
            },
            ...templates
        ];
    }

    getNewPageSelectedStyle() {
        return this.getNewPageStyleOptions().find((item) => item.id === this.newPageStyleId)
            || this.getNewPageStyleOptions()[0];
    }

    getNewPageFrameworkOptions() {
        const disabled = new Set(this.templatesData?.disabled || []);
        return NEW_PAGE_WEB_FRAMEWORKS.filter((framework) => !disabled.has(framework.id));
    }

    getNewPageSelectedFramework() {
        return this.getNewPageFrameworkOptions().find((item) => item.id === this.newPageFrameworkId)
            || this.getNewPageFrameworkOptions()[0]
            || NEW_PAGE_WEB_FRAMEWORKS[0];
    }

    getNewPagePickerOptions() {
        return this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web'
            ? this.getNewPageFrameworkOptions()
            : this.getNewPageStyleOptions();
    }

    getNewPageSelectedPickerOption() {
        return this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web'
            ? this.getNewPageSelectedFramework()
            : this.getNewPageSelectedStyle();
    }

    isNewPageStylePickerActive() {
        return this.agentActiveSkill?.id === 'create-new-page' && !this.agentRunState?.active;
    }

    renderStyleMiniPreview(style, { className = 'new-page-style-preview' } = {}) {
        const p = style?.preview || {};
        const bgValue = p.background || '#f8fafc';
        const surfaceValue = p.surface || '#ffffff';
        const accentValue = p.accent || '#0f172a';
        const accent2Value = p.accentSecondary || accentValue;
        const textColor = p.text || '#0f172a';
        const lineColor = p.border || (this._isColorDark(bgValue) ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.14)');
        const headingFamily = p.fontHeading || 'Outfit, sans-serif';
        return `
            <span class="${className}" style="background:${bgValue};color:${textColor};border-color:${lineColor};">
                <span class="${className}__surface" style="background:${surfaceValue};border-color:${lineColor};">
                    <span class="${className}__title" style="font-family:${this.escapeHtml(headingFamily)};background:${textColor};"></span>
                    <span class="${className}__line" style="background:${lineColor};"></span>
                    <span class="${className}__line ${className}__line--short" style="background:${lineColor};"></span>
                    <span class="${className}__chips">
                        <span style="background:${accentValue};"></span>
                        <span style="background:${accent2Value};"></span>
                    </span>
                </span>
            </span>
        `;
    }

    getFrameworkScreenshot(framework) {
        if (!framework?.previewDir) return '';
        return `${WEB_FRAMEWORK_PREVIEW_BASE}/${framework.previewDir}.png?v=${WEB_FRAMEWORK_SCREENSHOT_VERSION}`;
    }

    getFrameworkPreviewPage(framework) {
        if (!framework?.previewDir) return '';
        return `${WEB_FRAMEWORK_PREVIEW_BASE}/${framework.previewDir}/index.html`;
    }

    hasMobileTemplatePreview(tpl) {
        return Boolean(tpl?.id) && tpl.id !== '_schema';
    }

    getMobileTemplateScreenshot(tpl) {
        if (!this.hasMobileTemplatePreview(tpl)) return '';
        return `${MOBILE_TEMPLATE_PREVIEW_BASE}/${tpl.id}.png?v=${MOBILE_TEMPLATE_SCREENSHOT_VERSION}`;
    }

    getMobileTemplatePreviewPage(tpl) {
        if (!this.hasMobileTemplatePreview(tpl)) return '';
        return `${MOBILE_TEMPLATE_PREVIEW_BASE}/${tpl.id}/index.html`;
    }

    renderNewPageStyleMenuItems() {
        const isFrameworkPicker = this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web';
        const selected = this.getNewPageSelectedPickerOption();
        return this.getNewPagePickerOptions().map((option) => {
            if (isFrameworkPicker) {
                const screenshot = this.getFrameworkScreenshot(option);
                const previewPage = this.getFrameworkPreviewPage(option);
                const shotBlock = screenshot
                    ? `<span class="new-page-framework-shot">
                            <img class="new-page-framework-shot__img" src="${this.escapeHtml(screenshot)}" alt="${this.escapeHtml(option.name || option.id)} 预览" loading="lazy" data-new-page-framework-screenshot="${this.escapeHtml(screenshot)}" />
                            ${previewPage ? `<span class="new-page-framework-shot__view" role="link" tabindex="0" data-new-page-framework-view="${this.escapeHtml(previewPage)}" title="新窗口打开完整预览" aria-label="新窗口打开 ${this.escapeHtml(option.name || option.id)} 完整预览"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5M19 5l-7 7M19 14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></svg></span>` : ''}
                        </span>`
                    : this.renderStyleMiniPreview(option, { className: 'new-page-style-menu__preview' });
                return `
                    <button type="button" class="new-page-style-menu__item is-framework${option.id === selected?.id ? ' is-active' : ''}" data-new-page-style-option="${this.escapeHtml(option.id)}" role="option" aria-selected="${option.id === selected?.id ? 'true' : 'false'}">
                        ${shotBlock}
                        <span class="new-page-style-menu__meta">
                            <strong>${this.escapeHtml(option.name || option.id)}</strong>
                            <small>${this.escapeHtml(option.technology || '')} · ${this.escapeHtml(option.description || '')}</small>
                        </span>
                    </button>
                `;
            }
            const screenshot = this.getMobileTemplateScreenshot(option);
            const previewPage = this.getMobileTemplatePreviewPage(option);
            if (screenshot) {
                return `
                    <button type="button" class="new-page-style-menu__item is-mobile-shot${option.id === selected?.id ? ' is-active' : ''}" data-new-page-style-option="${this.escapeHtml(option.id)}" role="option" aria-selected="${option.id === selected?.id ? 'true' : 'false'}">
                        <span class="new-page-framework-shot is-portrait">
                            <img class="new-page-framework-shot__img" src="${this.escapeHtml(screenshot)}" alt="${this.escapeHtml(option.name || option.id)} 预览" loading="lazy" data-new-page-framework-screenshot="${this.escapeHtml(screenshot)}" data-new-page-shot-orientation="portrait" />
                            ${previewPage ? `<span class="new-page-framework-shot__view" role="link" tabindex="0" data-new-page-framework-view="${this.escapeHtml(previewPage)}" title="新窗口打开完整预览" aria-label="新窗口打开 ${this.escapeHtml(option.name || option.id)} 完整预览"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5M19 5l-7 7M19 14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></svg></span>` : ''}
                        </span>
                        <span class="new-page-style-menu__meta">
                            <strong>${this.escapeHtml(option.name || option.id)}</strong>
                            ${option.description ? `<small>${this.escapeHtml(option.description)}</small>` : ''}
                        </span>
                    </button>
                `;
            }
            return `
                <button type="button" class="new-page-style-menu__item${option.id === selected?.id ? ' is-active' : ''}" data-new-page-style-option="${this.escapeHtml(option.id)}" role="option" aria-selected="${option.id === selected?.id ? 'true' : 'false'}">
                    ${this.renderStyleMiniPreview(option, { className: 'new-page-style-menu__preview' })}
                    <span class="new-page-style-menu__meta">
                        <strong>${this.escapeHtml(option.name || option.id)}</strong>
                    </span>
                </button>
            `;
        }).join('');
    }

    getNewPageStyleMenuPosition() {
        const triggerRect = this.agentStatusContext?.querySelector('[data-new-page-style-toggle]')?.getBoundingClientRect();
        const isFrameworkPicker = this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web';
        const menuWidth = Math.min(isFrameworkPicker ? 440 : 360, window.innerWidth - 24);
        const menuMaxHeight = Math.min(430, window.innerHeight - 120);
        if (!triggerRect) {
            return { left: 12, top: 96 };
        }
        const left = Math.max(12, Math.min(triggerRect.left, window.innerWidth - menuWidth - 12));
        const preferredTop = triggerRect.bottom + 8;
        const top = Math.max(12, Math.min(preferredTop, window.innerHeight - menuMaxHeight - 12));
        return { left, top };
    }

    renderNewPageStyleMenuPortal() {
        if (!this.newPageStyleDropdownOpen || !this.isNewPageStylePickerActive()) {
            this.closeNewPageStyleMenu({ renderControl: false });
            return;
        }
        if (!this.newPageStyleMenuEl) {
            this.newPageStyleMenuEl = document.createElement('div');
            this.newPageStyleMenuEl.className = 'new-page-style-menu new-page-style-menu-portal';
            this.newPageStyleMenuEl.setAttribute('role', 'listbox');
            this.newPageStyleMenuEl.addEventListener('click', (event) => {
                const viewTrigger = event.target.closest('[data-new-page-framework-view]');
                if (viewTrigger) {
                    event.preventDefault();
                    event.stopPropagation();
                    const url = viewTrigger.dataset.newPageFrameworkView || '';
                    if (url) window.open(url, '_blank', 'noopener');
                    return;
                }
                const styleOption = event.target.closest('[data-new-page-style-option]');
                if (!styleOption) return;
                event.preventDefault();
                event.stopPropagation();
                if (this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web') {
                    this.setNewPageFramework(styleOption.dataset.newPageStyleOption || 'ant-design-skill');
                } else {
                    this.setNewPageStyle(styleOption.dataset.newPageStyleOption || 'default');
                }
            });
            this.newPageStyleMenuEl.addEventListener('keydown', (event) => {
                const viewTrigger = event.target.closest('[data-new-page-framework-view]');
                if (!viewTrigger) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const url = viewTrigger.dataset.newPageFrameworkView || '';
                    if (url) window.open(url, '_blank', 'noopener');
                }
            });
            // Hover-to-zoom for framework / mobile-template screenshots — triggers on the whole item
            this.newPageStyleMenuEl.addEventListener('mouseover', (event) => {
                const item = event.target.closest('.new-page-style-menu__item');
                if (!item) return;
                const shot = item.querySelector('[data-new-page-framework-screenshot]');
                if (!shot) return;
                this.showFrameworkShotZoom(shot);
            });
            this.newPageStyleMenuEl.addEventListener('mouseout', (event) => {
                const item = event.target.closest('.new-page-style-menu__item');
                if (!item) return;
                const related = event.relatedTarget;
                if (related && (item.contains(related) || this.newPageFrameworkZoomEl?.contains(related))) return;
                this.hideFrameworkShotZoom();
            });
            this.newPageStyleMenuEl.addEventListener('scroll', () => {
                this.hideFrameworkShotZoom();
            }, { passive: true });
            document.body.appendChild(this.newPageStyleMenuEl);
        }
        this.newPageStyleMenuEl.classList.toggle(
            'is-framework-picker',
            this.normalizePageTargetDevice(this.newPageTargetDevice) === 'web'
        );
        const position = this.getNewPageStyleMenuPosition();
        this.newPageStyleMenuEl.style.left = `${position.left}px`;
        this.newPageStyleMenuEl.style.top = `${position.top}px`;
        this.newPageStyleMenuEl.innerHTML = this.renderNewPageStyleMenuItems();
    }

    showFrameworkShotZoom(shotEl) {
        const src = shotEl?.dataset?.newPageFrameworkScreenshot || shotEl?.src;
        const item = shotEl?.closest?.('.new-page-style-menu__item');
        const label = item?.querySelector('.new-page-style-menu__meta strong')?.textContent || '';
        if (!src) return;
        if (!this.newPageFrameworkZoomEl) {
            this.newPageFrameworkZoomEl = document.createElement('div');
            this.newPageFrameworkZoomEl.className = 'new-page-framework-zoom';
            this.newPageFrameworkZoomEl.innerHTML = '<img class="new-page-framework-zoom__img" alt="" /><span class="new-page-framework-zoom__label"></span>';
            this.newPageFrameworkZoomEl.addEventListener('mouseleave', () => this.hideFrameworkShotZoom());
            document.body.appendChild(this.newPageFrameworkZoomEl);
        }
        const img = this.newPageFrameworkZoomEl.querySelector('.new-page-framework-zoom__img');
        const labelEl = this.newPageFrameworkZoomEl.querySelector('.new-page-framework-zoom__label');
        if (img.src !== src) img.src = src;
        labelEl.textContent = label;
        // Position the zoom panel to the right of the menu, fall back to the left when space is tight.
        const menuRect = this.newPageStyleMenuEl?.getBoundingClientRect();
        const isPortrait = shotEl?.dataset?.newPageShotOrientation === 'portrait';
        let panelW;
        let panelH;
        if (isPortrait) {
            panelH = Math.min(660, window.innerHeight - 32);
            panelW = Math.round((panelH - 40) * 382 / 826) + 16;
        } else {
            panelW = Math.min(560, window.innerWidth - 32);
            panelH = Math.round(panelW * 900 / 1440) + 40;
        }
        let left;
        if (menuRect && menuRect.right + panelW + 12 <= window.innerWidth) {
            left = menuRect.right + 12;
        } else if (menuRect && menuRect.left - panelW - 12 >= 0) {
            left = menuRect.left - panelW - 12;
        } else {
            left = Math.max(12, Math.round((window.innerWidth - panelW) / 2));
        }
        const top = menuRect ? Math.max(12, Math.min(menuRect.top, window.innerHeight - panelH - 12)) : 96;
        this.newPageFrameworkZoomEl.style.width = `${panelW}px`;
        this.newPageFrameworkZoomEl.style.left = `${left}px`;
        this.newPageFrameworkZoomEl.style.top = `${top}px`;
        this.newPageFrameworkZoomEl.classList.add('is-visible');
    }

    hideFrameworkShotZoom() {
        if (!this.newPageFrameworkZoomEl) return;
        this.newPageFrameworkZoomEl.classList.remove('is-visible');
    }

    closeNewPageStyleMenu({ renderControl = true } = {}) {
        this.newPageStyleDropdownOpen = false;
        if (this.newPageStyleMenuEl) {
            this.newPageStyleMenuEl.remove();
            this.newPageStyleMenuEl = null;
        }
        this.hideFrameworkShotZoom();
        if (this.newPageFrameworkZoomEl) {
            this.newPageFrameworkZoomEl.remove();
            this.newPageFrameworkZoomEl = null;
        }
        if (renderControl) this.renderAgentStatusContextControl();
    }

    toggleNewPageStyleMenu() {
        this.newPageStyleDropdownOpen = !this.newPageStyleDropdownOpen;
        if (!this.newPageStyleDropdownOpen && this.newPageStyleMenuEl) {
            this.newPageStyleMenuEl.remove();
            this.newPageStyleMenuEl = null;
        }
        this.renderAgentStatusContextControl();
    }

    composeNewPageStarter({ templateId = this.newPageStyleId, frameworkId = this.newPageFrameworkId, projectId = this.activeProjectId, targetDevice = this.newPageTargetDevice } = {}) {
        const project = this.getProjectRecord(projectId);
        const projectLabel = project ? `${project.name || project.id}（${project.id}）` : (projectId || '当前项目');
        const normalizedTargetDevice = this.normalizePageTargetDevice(targetDevice);
        const deviceLabel = this.getPageDeviceLabel(normalizedTargetDevice);
        if (normalizedTargetDevice === 'web') {
            const framework = this.getNewPageFrameworkOptions().find((item) => item.id === frameworkId)
                || this.getNewPageFrameworkOptions()[0];
            return `请在项目「${projectLabel}」中新建${deviceLabel}页面，并使用「${framework.name}」前端框架 Skill。`;
        }
        const style = this.getNewPageStyleOptions().find((item) => item.id === templateId) || this.getNewPageStyleOptions()[0];
        if (!style || style.id === 'default') {
            return `请在项目「${projectLabel}」中新建${deviceLabel}页面。`;
        }
        return `请在项目「${projectLabel}」中新建${deviceLabel}页面，并使用「${style.name}」风格。设计规范文件：${style.filePath}`;
    }

    syncNewPagePrompt({ force = false } = {}) {
        if (!this.agentInput || !this.isNewPageStylePickerActive()) return;
        const current = this.agentInput.value || '';
        if (!force && current.trim() && current !== this.newPageGeneratedPrompt) return;
        const next = '';
        this.agentInput.value = next;
        this.newPageGeneratedPrompt = next;
        this.agentInput.focus();
    }

    getNewPageExecutionInstructions() {
        if (this.agentActiveSkill?.id !== 'create-new-page') return '';
        const project = this.getProjectRecord(this.activeProjectId);
        const projectId = project?.id || this.activeProjectId || '';
        const projectName = project?.name || projectId;
        const targetDevice = this.normalizePageTargetDevice(this.newPageTargetDevice);
        const deviceLabel = this.getPageDeviceLabel(targetDevice);
        const lines = [
            '### 执行上下文',
            '',
            `当前活动项目 ID：\`${projectId}\`。`,
            `当前活动项目名称：「${projectName}」。`,
            `新页面必须创建在当前工作区的 \`src/pages/${projectId}/{page_id}/v1/\`；不要从 data/projects.json 的 activeProjectId 重新推断项目。`,
            '',
            '### 页面类型',
            '',
            `用户在顶部页面类型选择器中选择了「${deviceLabel}」。`,
            `创建新页面时必须在 data/projects.json 的新 page 记录上写入 \`targetDevice: "${targetDevice}"\`。`,
            targetDevice === 'web'
                ? '必须从 `src/templates/web-frame/` 复制中性 `index.html`、`styles.css`、`app.js` 运行骨架作为 v1 起点，不要使用手机外框。'
                : '必须从 `src/templates/mobile-frame/` 复制 `index.html`、`styles.css`、`app.js`、`frame-fit.js` 作为 v1 起点，并保留手机外框结构。',
            targetDevice === 'web'
                ? (() => {
                    const framework = this.getNewPageSelectedFramework();
                    return [
                        '',
                        '### 前端框架',
                        '',
                        `用户在顶部前端框架选择器中选择了「${framework.name}」（${framework.technology}）。`,
                        `必须完整读取并使用对应 Skill：${framework.skillPath}`,
                        `本次 Web Demo 的产品判断、页面结构、视觉语言、组件映射、Mock Data、交互和质量门槛均以 \`${framework.id}\` 为准。`
                    ].join('\n');
                })()
                : (() => {
                    const style = this.getNewPageSelectedStyle();
                    if (!style || style.id === 'default') return '';
                    return [
                        '',
                        '### 风格选择',
                        '',
                        `用户在顶部风格选择器中选择了「${style.name}」。`,
                        `请在新建页面时读取并遵守这个设计规范文件：${style.filePath}`,
                        this.formatTemplateFilesForPrompt(style),
                        '不要在回复中反复询问或确认风格；它已经由顶部选择器绑定。'
                    ].filter(Boolean).join('\n');
                })()
        ].filter(Boolean);
        return lines.join('\n');
    }

    formatTemplateFilesForPrompt(style) {
        const files = style?.files || {};
        const entries = [
            ['tokens.css', files.tokens],
            ['tailwind-v4.css', files.tailwind],
            ['design-tokens.json', files.designTokens],
            ['components.html', files.components],
            ['components.manifest.json', files.componentsManifest],
            ['USAGE.md', files.usage],
            ['manifest.json', style?.manifestPath]
        ].filter(([, filePath]) => filePath);
        if (!entries.length) return '';
        return [
            '该风格包还支持这些格式，按需读取：',
            ...entries.map(([label, filePath]) => `- ${label}: ${filePath}`)
        ].join('\n');
    }

    setNewPageStyle(styleId = 'default', { syncPrompt = true } = {}) {
        this.newPageStyleId = styleId || 'default';
        this.newPageStyleDropdownOpen = false;
        try {
            if (this.newPageStyleId === 'default') {
                window.localStorage.removeItem(workspaceStorageKey('readify:pending-template'));
            } else {
                window.localStorage.setItem(workspaceStorageKey('readify:pending-template'), this.newPageStyleId);
            }
        } catch {}
        if (syncPrompt) this.syncNewPagePrompt({ force: true });
        this.renderAgentStatusContextControl();
    }

    setNewPageFramework(frameworkId = 'ant-design-skill', { syncPrompt = true } = {}) {
        const selected = this.getNewPageFrameworkOptions().find((item) => item.id === frameworkId)
            || this.getNewPageFrameworkOptions()[0];
        this.newPageFrameworkId = selected.id;
        this.newPageStyleDropdownOpen = false;
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:pending-framework'), this.newPageFrameworkId);
        } catch {}
        if (syncPrompt) this.syncNewPagePrompt({ force: true });
        this.renderAgentStatusContextControl();
    }

    setNewPageTargetDevice(targetDevice = 'mobile', { syncPrompt = true } = {}) {
        this.newPageTargetDevice = this.normalizePageTargetDevice(targetDevice);
        this.closeNewPageStyleMenu({ renderControl: false });
        if (syncPrompt) this.syncNewPagePrompt({ force: true });
        this.renderAgentStatusContextControl();
    }

    async selectProjectForTemplate(templateOrId) {
        const tpl = typeof templateOrId === 'object'
            ? templateOrId
            : (this.templatesData?.templates || []).find(t => t.id === templateOrId);
        if (!tpl) return null;
        const isWeb = tpl.targetDevice === 'web';
        const screenshot = isWeb ? this.getFrameworkScreenshot(tpl) : this.getMobileTemplateScreenshot(tpl);
        const projects = (this.projects?.projects || []).filter(p => !p.deleted);
        if (!projects.length) {
            this.showToast('请先新建项目，再使用模板创建页面', true);
            return null;
        }
        return new Promise((resolve) => {
            const existing = document.querySelector('.template-project-picker');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.className = 'template-project-picker';
            modal.innerHTML = `
                <div class="template-project-picker__scrim" data-template-project-cancel="true"></div>
                <section class="template-project-picker__dialog" role="dialog" aria-modal="true" aria-label="选择项目">
                    <button type="button" class="template-project-picker__close" data-template-project-cancel="true" aria-label="关闭">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                    <div class="template-project-picker__hero">
                        <div class="template-project-picker__real-preview ${isWeb ? 'is-landscape' : 'is-portrait'}">
                            <img src="${this.escapeHtml(screenshot)}" alt="${this.escapeHtml(tpl.name || tpl.id)} 界面预览">
                        </div>
                        <div>
                            <div class="template-project-picker__eyebrow">${isWeb ? '使用 Web 框架' : '使用移动端风格'}</div>
                            <h3>${this.escapeHtml(tpl.name)}</h3>
                            <p>${this.escapeHtml(tpl.description || '选择一个项目作为新页面的创建位置。')}</p>
                        </div>
                    </div>
                    <div class="template-project-picker__list">
                        ${projects.map((project) => {
                            const pages = (project.pages || []).filter(page => !page.deleted).length;
                            const isActive = project.id === this.activeProjectId;
                            return `
                                <button type="button" class="template-project-picker__item${isActive ? ' is-active' : ''}" data-template-project-id="${this.escapeHtml(project.id)}">
                                    <span class="template-project-picker__avatar">${this.escapeHtml(String(project.name || project.id).charAt(0).toUpperCase() || 'P')}</span>
                                    <span class="template-project-picker__meta">
                                        <strong>${this.escapeHtml(project.name || project.id)}</strong>
                                        <small>${pages} 个页面 · ${this.escapeHtml(project.id)}</small>
                                    </span>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
            const close = (value) => {
                modal.remove();
                resolve(value);
            };
            modal.addEventListener('click', (event) => {
                const cancel = event.target.closest('[data-template-project-cancel]');
                if (cancel) {
                    close(null);
                    return;
                }
                const projectButton = event.target.closest('[data-template-project-id]');
                if (projectButton) close(projectButton.dataset.templateProjectId || null);
            });
            document.body.appendChild(modal);
        });
    }

    async applyTemplateForNewPage(templateId) {
        await this.loadTemplatesData();
        const tpl = (this.templatesData?.templates || []).find(t => t.id === templateId);
        if (!tpl) return;
        if (tpl.enabled === false) {
            this.showToast('请先启用该模板再使用', true);
            return;
        }
        const targetProjectId = await this.selectProjectForTemplate(templateId);
        if (!targetProjectId) return;
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:pending-template'), templateId);
        } catch {}
        const shouldEnterProject = this.currentTopView !== 'page' || this.activeProjectId !== targetProjectId;
        this.activeProjectId = targetProjectId;
        if (this.projects) this.projects.activeProjectId = targetProjectId;
        if (shouldEnterProject) {
            this.enterProject(targetProjectId);
        }
        this.openNewPageAgentFlow({ templateId, projectId: targetProjectId }).then(() => {
            this.showToast(`已选择「${tpl.name}」，请补充页面需求后发送`);
        });
    }

    async applyCatalogTemplateForNewPage(tpl) {
        if (!tpl || tpl.enabled === false) {
            this.showToast('请先启用该模板再使用', true);
            return;
        }
        const targetProjectId = await this.selectProjectForTemplate(tpl);
        if (!targetProjectId) return;
        const isWeb = tpl.targetDevice === 'web';
        if (isWeb) {
            this.newPageTargetDevice = 'web';
            this.newPageFrameworkId = tpl.id;
            try { window.localStorage.setItem(workspaceStorageKey('readify:pending-framework'), tpl.id); } catch {}
        } else {
            this.newPageTargetDevice = 'mobile';
            this.newPageStyleId = tpl.id;
            try { window.localStorage.setItem(workspaceStorageKey('readify:pending-template'), tpl.id); } catch {}
        }
        const shouldEnterProject = this.currentTopView !== 'page' || this.activeProjectId !== targetProjectId;
        this.activeProjectId = targetProjectId;
        if (this.projects) this.projects.activeProjectId = targetProjectId;
        if (shouldEnterProject) this.enterProject(targetProjectId);
        this.openNewPageAgentFlow({
            templateId: isWeb ? 'default' : tpl.id,
            frameworkId: isWeb ? tpl.id : this.newPageFrameworkId,
            projectId: targetProjectId,
            targetDevice: isWeb ? 'web' : 'mobile'
        }).then(() => {
            this.showToast(`已选择「${tpl.name}」，请补充页面需求后发送`);
        });
    }

    async setTemplateEnabled(templateId, enabled) {
        try {
            const resp = await fetch(`${this.agentApiBase}/api/agent/templates/${encodeURIComponent(templateId)}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            if (!resp.ok) throw new Error(await resp.text() || '更新模板状态失败');
            this.templatesData = await resp.json();
            if (!enabled && this.newPageStyleId === templateId) {
                this.setNewPageStyle('default', { syncPrompt: true });
            }
            if (!enabled && this.newPageFrameworkId === templateId) {
                const fallback = this.getNewPageFrameworkOptions()[0];
                if (fallback) this.newPageFrameworkId = fallback.id;
            }
            this.renderTemplatesHome();
            this.showToast(`${enabled ? '已启用' : '已停用'}模板「${templateId}」`);
        } catch (err) {
            console.warn('setTemplateEnabled failed:', err);
            this.showToast(`更新模板状态失败：${err instanceof Error ? err.message : String(err)}`, true);
        }
    }

    async deleteTemplate(templateId, templateLabel) {
        const confirmed = await this.showConfirm({
            title: '删除模板？',
            message: `将从 src/templates/design-systems/${templateId} 永久移除此模板，无法撤销。`,
            okText: '确认删除'
        });
        if (!confirmed) return;
        try {
            const resp = await fetch(`${this.agentApiBase}/api/agent/templates/${encodeURIComponent(templateId)}`, {
                method: 'DELETE'
            });
            if (!resp.ok) throw new Error(await resp.text() || '删除模板失败');
            this.templatesData = await resp.json();
            if (this.newPageStyleId === templateId) {
                this.setNewPageStyle('default', { syncPrompt: true });
            }
            this.renderTemplatesHome();
            this.showToast(`已删除模板「${templateLabel || templateId}」`);
        } catch (err) {
            console.warn('deleteTemplate failed:', err);
            this.showToast(`删除模板失败：${err instanceof Error ? err.message : String(err)}`, true);
        }
    }

    // ── Skills management ──────────────────────────────────────

    getAllSkills() {
        const agent = Array.isArray(this.skillManagementSkills) && this.skillManagementSkills.length
            ? this.skillManagementSkills
            : (Array.isArray(this.agentAvailableSkills) ? this.agentAvailableSkills : []);
        const map = new Map();
        agent.forEach(s => map.set(s.id, { ...s, source: 'project' }));
        return Array.from(map.values());
    }

    async refreshSkillsList() {
        try {
            const skills = await this.fetchAgentSkills({ includeDisabled: true });
            this.skillManagementSkills = Array.isArray(skills) ? skills : [];
            if (this.agentActiveSkill && this.skillManagementSkills.some(skill => skill.id === this.agentActiveSkill.id && skill.enabled === false)) {
                this.clearActiveAgentSkill();
            }
        } catch (err) {
            console.warn('refreshSkillsList failed:', err);
        }
    }

    async fetchAgentSkills({ includeDisabled = false } = {}) {
        try {
            const resp = await fetch(`${this.agentApiBase}/api/agent/skills${includeDisabled ? '?includeDisabled=1' : ''}`);
            if (!resp.ok) return [];
            const data = await resp.json();
            return Array.isArray(data?.skills) ? data.skills : (Array.isArray(data) ? data : []);
        } catch {
            return [];
        }
    }

    renderSkillsHome() {
        if (!this.skillGridEl) return;
        const all = this.getAllSkills();
        const query = String(this.skillSearchQuery || '').trim().toLowerCase();
        const filtered = all.filter((skill) => {
            const isEnabled = skill.enabled !== false;
            if (this.skillStatusFilter === 'enabled' && !isEnabled) return false;
            if (this.skillStatusFilter === 'disabled' && isEnabled) return false;
            if (!query) return true;
            return [
                skill.id,
                skill.label,
                skill.description,
                skill.kind,
                skill.skillPath
            ].some((value) => String(value || '').toLowerCase().includes(query));
        });
        this.skillGridEl.innerHTML = '';
        if (!filtered.length) {
            if (this.skillsEmptyStateEl) this.skillsEmptyStateEl.hidden = false;
            return;
        }
        if (this.skillsEmptyStateEl) this.skillsEmptyStateEl.hidden = true;

        filtered.forEach(skill => {
            const card = document.createElement('div');
            const isEnabled = skill.enabled !== false;
            card.className = `home-card skill-card${isEnabled ? '' : ' is-disabled'}`;
            const isActive = this.agentActiveSkill?.id === skill.id;
            card.innerHTML = `
                <div class="skill-card__head">
                    <div class="skill-card__title-block">
                        <h4 class="skill-card__name">${this.escapeHtml(skill.label || skill.id)}</h4>
                        <span class="skill-card__id">${this.escapeHtml(skill.id)}</span>
                    </div>
                </div>
                <button type="button" class="skill-card__delete" data-skill-delete="${this.escapeHtml(skill.id)}" title="删除此 Skill" aria-label="删除此 Skill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <p class="skill-card__desc">${this.escapeHtml(skill.description || '暂无描述')}</p>
                <div class="skill-card__footer">
                    <div class="skill-card__actions">
                        <button type="button" class="skill-card__action is-ghost" data-skill-status="${this.escapeHtml(skill.id)}" data-skill-enabled="${isEnabled ? 'false' : 'true'}">
                            ${isEnabled ? '停用' : '启用'}
                        </button>
                        <button type="button" class="skill-card__action ${isActive ? 'is-ghost' : ''}" data-skill-apply="${this.escapeHtml(skill.id)}" ${isEnabled ? '' : 'disabled'}>
                            ${isActive ? '取消' : '应用'}
                        </button>
                    </div>
                </div>
            `;
            card.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                this.openSkillDetail(skill.id);
            });
            const btn = card.querySelector('[data-skill-apply]');
            btn?.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!isEnabled) {
                    this.showToast('请先启用该 Skill 再应用', true);
                    return;
                }
                if (isActive) {
                    this.clearActiveAgentSkill();
                } else {
                    const agentSkill = this.getAgentSkill(skill.id);
                    this.agentActiveSkill = agentSkill || skill;
                    this.renderActiveSkillBar?.();
                    this.showToast(`已启用 Skill「${skill.label || skill.id}」`);
                }
                this.renderSkillsHome();
            });
            const statusBtn = card.querySelector('[data-skill-status]');
            statusBtn?.addEventListener('click', async (event) => {
                event.stopPropagation();
                await this.setSkillEnabled(skill.id, statusBtn.dataset.skillEnabled === 'true');
            });
            const deleteBtn = card.querySelector('[data-skill-delete]');
            deleteBtn?.addEventListener('click', async (event) => {
                event.stopPropagation();
                await this.deleteSkill(skill.id, skill.label || skill.id);
            });
            this.skillGridEl.appendChild(card);
        });
    }

    async setSkillEnabled(skillId, enabled) {
        try {
            const data = await this.agentApi.setSkillStatus(skillId, enabled);
            this.skillManagementSkills = Array.isArray(data?.skills) ? data.skills : this.skillManagementSkills;
            await this.refreshAgentCatalog({ render: false });
            if (!enabled && this.agentActiveSkill?.id === skillId) {
                this.clearActiveAgentSkill();
            }
            this.renderSkillsHome();
            this.showToast(`${enabled ? '已启用' : '已停用'} Skill「${skillId}」`);
        } catch (err) {
            console.warn('setSkillEnabled failed:', err);
            this.showToast(`更新 Skill 状态失败：${err instanceof Error ? err.message : String(err)}`, true);
        }
    }

    async deleteSkill(skillId, skillLabel) {
        const confirmed = await this.showConfirm({
            title: '删除 Skill？',
            message: `将永久移除 Skill「${skillLabel || skillId}」，无法撤销。`,
            okText: '确认删除'
        });
        if (!confirmed) return;
        try {
            const resp = await fetch(`${this.agentApiBase}/api/agent/skills/${encodeURIComponent(skillId)}`, {
                method: 'DELETE'
            });
            if (!resp.ok) throw new Error(await resp.text() || '删除 Skill 失败');
            const data = await resp.json();
            this.skillManagementSkills = Array.isArray(data?.skills) ? data.skills : this.skillManagementSkills;
            await this.refreshAgentCatalog({ render: false });
            if (this.agentActiveSkill?.id === skillId) {
                this.clearActiveAgentSkill();
            }
            this.renderSkillsHome();
            this.showToast(`已删除 Skill「${skillLabel || skillId}」`);
        } catch (err) {
            console.warn('deleteSkill failed:', err);
            this.showToast(`删除 Skill 失败：${err instanceof Error ? err.message : String(err)}`, true);
        }
    }

    async openSkillDetail(skillId) {
        if (!this.templateDetailModal || !this.templateDetailBody) return;
        this.templateDetailBody.innerHTML = `
            <div class="template-detail">
                <button type="button" class="template-detail__close" data-skill-detail-close="true" title="关闭详情" aria-label="关闭详情">×</button>
                <div class="template-detail__hero">
                    <div class="template-detail__hero-main">
                        <span class="template-detail__category">Skill</span>
                        <h3>加载中...</h3>
                    </div>
                </div>
            </div>
        `;
        this.templateDetailModal.hidden = false;
        this.templateDetailOpen = true;
        try {
            const skill = await this.loadSkillDetail(skillId);
            this.templateDetailBody.innerHTML = `
                <div class="template-detail">
                    <button type="button" class="template-detail__close" data-skill-detail-close="true" title="关闭详情" aria-label="关闭详情">×</button>
                    <div class="template-detail__hero">
                        <div class="template-detail__hero-main">
                            <span class="template-detail__category">${skill.enabled === false ? '已停用' : '已启用'}</span>
                            <h3>${this.escapeHtml(skill.label || skill.id || 'Skill')}</h3>
                            <p>${this.escapeHtml(skill.description || skill.id || '')}</p>
                        </div>
                    </div>
                    <section class="template-detail__body">
                        <div class="template-detail__section">
                            <h4>SKILL.md</h4>
                            <div class="template-detail__markdown">${this.escapeHtml(skill.markdown || '')}</div>
                        </div>
                    </section>
                    <div class="template-detail__actions">
                        <button type="button" class="home-view__ghost-btn" data-skill-detail-close="true">关闭</button>
                    </div>
                </div>
            `;
        } catch (err) {
            this.templateDetailBody.innerHTML = `
                <div class="template-detail">
                    <button type="button" class="template-detail__close" data-skill-detail-close="true" title="关闭详情" aria-label="关闭详情">×</button>
                    <div class="template-detail__hero">
                        <div class="template-detail__hero-main">
                            <span class="template-detail__category">Skill</span>
                            <h3>详情加载失败</h3>
                            <p>${this.escapeHtml(err instanceof Error ? err.message : String(err))}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async loadSkillDetail(skillId) {
        try {
            const data = await this.agentApi.getSkillDetail(skillId);
            return data?.skill || {};
        } catch (error) {
            const skill = (this.getAllSkills?.() || []).find((item) => item.id === skillId);
            if (!skill?.skillPath) throw error;
            const cleanPath = String(skill.skillPath).replace(/^\/+/, '');
            const encodedPath = cleanPath.split('/').map(part => encodeURIComponent(part)).join('/');
            const response = await fetch(`/${encodedPath}?t=${Date.now()}`);
            if (!response.ok) throw error;
            return {
                ...skill,
                markdown: await response.text()
            };
        }
    }

    openSkillImportModal() {
        if (!this.skillImportModal) return;
        this.skillImportModal.hidden = false;
        this.skillImportModalOpen = true;
        this.pendingSkillFiles = null;
        if (this.skillImportUrlInput) this.skillImportUrlInput.value = '';
        if (this.skillImportDropHint) {
            this.skillImportDropHint.hidden = true;
            this.skillImportDropHint.textContent = '';
            this.skillImportDropHint.classList.remove('is-error');
        }
        if (this.skillImportDropZone) {
            this.skillImportDropZone.classList.remove('is-dragover');
        }
        this.setSkillImportMode('url');
        this.pinSkillImportDialogTop();
    }

    closeSkillImportModal() {
        if (!this.skillImportModal) return;
        this.skillImportModal.hidden = true;
        this.skillImportModalOpen = false;
        this.pendingSkillFiles = null;
        this.unpinSkillImportDialogTop();
    }

    pinSkillImportDialogTop() {
        const modal = this.skillImportModal;
        const dialog = modal?.querySelector('.confirm-modal__dialog');
        if (!modal || !dialog) return;
        // Reproduce the natural centered top, then anchor from the top so the
        // dialog grows downward instead of re-centering when the panel changes.
        // All values are layout-based so the entry animation's transform can't skew them.
        const padTop = parseFloat(getComputedStyle(modal).paddingTop) || 0;
        const centeredTop = Math.max(0, (window.innerHeight - dialog.offsetHeight) / 2);
        modal.style.setProperty('--skill-import-pinned-top', `${Math.max(0, centeredTop - padTop)}px`);
        modal.classList.add('is-top-pinned');
    }

    unpinSkillImportDialogTop() {
        const modal = this.skillImportModal;
        if (!modal) return;
        modal.classList.remove('is-top-pinned');
        modal.style.removeProperty('--skill-import-pinned-top');
    }

    setSkillImportMode(mode) {
        const next = mode === 'url' ? 'url' : 'folder';
        this.skillImportMode = next;
        const isFolder = next === 'folder';
        if (this.skillImportFolderPanel) this.skillImportFolderPanel.hidden = !isFolder;
        if (this.skillImportUrlPanel) this.skillImportUrlPanel.hidden = isFolder;
        this.skillImportSegmented?.forEach((tab) => {
            const active = tab.dataset.skillImportMode === next;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (this.skillImportSaveBtn) {
            this.skillImportSaveBtn.textContent = isFolder ? '导入文件夹' : '通过 Prota 导入';
        }
        this.updateSkillImportSubmitState();
    }

    updateSkillImportSubmitState() {
        if (!this.skillImportSaveBtn) return;
        if (this.skillImportMode === 'url') {
            const url = String(this.skillImportUrlInput?.value || '').trim();
            this.skillImportSaveBtn.disabled = !/^https?:\/\//i.test(url);
        } else {
            const files = Array.isArray(this.pendingSkillFiles) ? this.pendingSkillFiles : [];
            const hasSkillMd = files.some((file) => {
                const p = String(file?.path || '').replace(/^\/+/, '');
                return p === 'SKILL.md' || p.endsWith('/SKILL.md');
            });
            this.skillImportSaveBtn.disabled = !hasSkillMd;
        }
    }

    setPendingSkillFiles(files) {
        this.pendingSkillFiles = Array.isArray(files) ? files : [];
        const hasSkillMd = this.pendingSkillFiles.some((file) => {
            const p = String(file?.path || '').replace(/^\/+/, '');
            return p === 'SKILL.md' || p.endsWith('/SKILL.md');
        });
        if (this.skillImportDropHint) {
            this.skillImportDropHint.hidden = false;
            if (hasSkillMd) {
                this.skillImportDropHint.textContent = `已准备 ${this.pendingSkillFiles.length} 个文件，含 SKILL.md`;
                this.skillImportDropHint.classList.remove('is-error');
            } else if (this.pendingSkillFiles.length === 0) {
                this.skillImportDropHint.textContent = '未读取到任何文件';
                this.skillImportDropHint.classList.add('is-error');
            } else {
                this.skillImportDropHint.textContent = `已准备 ${this.pendingSkillFiles.length} 个文件，但缺少 SKILL.md`;
                this.skillImportDropHint.classList.add('is-error');
            }
        }
        this.updateSkillImportSubmitState();
    }

    async collectDroppedFolderFiles(dataTransferItems) {
        const files = [];
        const entries = [];
        for (let i = 0; i < dataTransferItems.length; i += 1) {
            const item = dataTransferItems[i];
            const entry = item.webkitGetAsEntry?.();
            if (entry) entries.push(entry);
        }
        if (entries.length === 0) return [];
        await Promise.all(entries.map((entry) => this.traverseEntry(entry, '', files)));
        return files;
    }

    traverseEntry(entry, prefix, files) {
        return new Promise((resolve) => {
            if (!entry) {
                resolve();
                return;
            }
            if (entry.isFile) {
                entry.file((file) => {
                    if (file.size > 1024 * 1024 * 2) {
                        resolve();
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        files.push({ path: prefix + file.name, content: String(reader.result || '') });
                        resolve();
                    };
                    reader.onerror = () => resolve();
                    reader.readAsText(file);
                }, () => resolve());
                return;
            }
            if (entry.isDirectory) {
                const reader = entry.createReader();
                const collected = [];
                const readBatch = () => {
                    reader.readEntries(async (batch) => {
                        if (!batch || batch.length === 0) {
                            await Promise.all(collected.map((child) => this.traverseEntry(child, prefix + entry.name + '/', files)));
                            resolve();
                            return;
                        }
                        collected.push(...batch);
                        readBatch();
                    }, () => resolve());
                };
                readBatch();
                return;
            }
            resolve();
        });
    }

    async collectInputFolderFiles(fileList) {
        const files = [];
        for (const file of fileList) {
            const relativePath = file.webkitRelativePath || file.name;
            const slashIdx = relativePath.indexOf('/');
            const innerPath = slashIdx >= 0 ? relativePath.slice(slashIdx + 1) : relativePath;
            if (!innerPath) continue;
            if (file.size > 1024 * 1024 * 2) continue;
            try {
                const content = await file.text();
                files.push({ path: innerPath, content });
            } catch {
                continue;
            }
        }
        return files;
    }

    async saveLocalSkillFromImport() {
        const files = Array.isArray(this.pendingSkillFiles) ? this.pendingSkillFiles : [];
        if (files.length === 0) {
            alert('请先拖入或选择 Skill 文件夹');
            return;
        }
        try {
            const resp = await fetch(`${this.agentApiBase}/api/agent/skills/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: files.map((f) => ({ path: f.path, content: f.content })) })
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                const label = data?.skill?.label || data?.skill?.id || 'Skill';
                this.showToast(`已导入 Skill「${label}」到 .claude/skills`);
                await this.refreshSkillsList();
            } else {
                throw new Error(await resp.text());
            }
        } catch (err) {
            console.warn('skill import failed:', err);
            this.showToast(`导入失败：${err instanceof Error ? err.message : String(err)}`, true);
            return;
        }
        this.closeSkillImportModal();
        this.renderSkillsHome();
    }

    async startSkillImportByUrl() {
        const rawUrl = String(this.skillImportUrlInput?.value || '').trim();
        if (!rawUrl) {
            this.showToast('请先填写 Skill 网址', true);
            return;
        }
        if (!/^https?:\/\//i.test(rawUrl)) {
            this.showToast('请填写以 http(s):// 开头的网址', true);
            return;
        }
        if (this.agentRunState?.active) {
            this.showToast('Prota 正在执行任务，请稍后再试。', true);
            return;
        }
        this.closeSkillImportModal();
        this.openAgentWorkbench();
        const reusableSessionId = this.findReusableAgentSessionId({ sessionScope: 'global' });
        if (reusableSessionId) {
            await this.switchAgentSession(reusableSessionId);
        } else {
            await this.createAgentSession({ switchTo: true, title: '导入 Skill', sessionScope: 'global' });
        }
        await this.applyAgentGlobalContext();
        this.agentActiveSkill = null;
        const prompt = `请从这个网址导入 Skill 到 .claude/skills/：${rawUrl}`;
        if (this.agentInput) this.agentInput.value = prompt;
        this.renderAgentWorkbench();
        this.agentInput?.focus();
        this.agentInput?.select();
        this.showToast('已为 Prota 准备好导入指令，确认后点发送即可');
    }

    updateTrashControls(count = 0) {
        [this.trashToggleBtn, this.homeTrashBtn].filter(Boolean).forEach((button) => {
            button.classList.toggle('is-open', this.trashModalOpen);
            button.setAttribute('aria-expanded', String(this.trashModalOpen));
        });

        [this.trashCountEl, this.homeTrashCountEl].filter(Boolean).forEach((el) => {
            el.textContent = String(count);
        });
    }

    renderSidebar() {
        if (this.trashListEl) {
            this.trashListEl.innerHTML = '';
        }

        if (this.currentView === 'projects') {
            this.projectNavSection.removeAttribute('hidden');
            this.pageNavSection.setAttribute('hidden', 'true');

            this.projectListEl.innerHTML = '';
            const activeProjects = (this.projects?.projects || []).filter(p => !p.deleted).sort((left, right) => {
                return String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN');
            });
            const deletedProjects = (this.projects?.projects || []).filter(p => p.deleted);

            activeProjects.forEach(proj => {
                const li = document.createElement('li');
                li.className = `nav-item${this.projectActionMenuOpenId === proj.id ? ' is-menu-open' : ''}`;

                const row = document.createElement('div');
                row.className = `nav-link ${proj.id === this.activeProjectId ? 'active' : ''}`;
                row.dataset.id = proj.id;
                row.innerHTML = `
                    <span class="nav-link__label">
                        <span class="nav-link__text">${this.escapeHtml(proj.name || proj.id)}</span>
                    </span>
                `;

                row.addEventListener('click', () => {
                    this.enterProject(proj.id);
                });

                li.appendChild(row);

                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'nav-item__more';
                moreBtn.title = '项目操作';
                moreBtn.dataset.projectMore = proj.id;
                moreBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>';
                li.appendChild(moreBtn);

                const menu = document.createElement('div');
                menu.className = 'nav-item__menu';
                menu.innerHTML = `
                    <button type="button" class="nav-item__menu-btn nav-item__menu-btn--rename" data-project-rename="${this.escapeHtml(proj.id)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                        <span>重命名</span>
                    </button>
                    <button type="button" class="nav-item__menu-btn" data-project-edit-id="${this.escapeHtml(proj.id)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h10"></path></svg>
                        <span>编辑 ID</span>
                    </button>
                    <button type="button" class="nav-item__menu-btn" data-project-delete="${this.escapeHtml(proj.id)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
                        <span>删除项目</span>
                    </button>
                `;
                li.appendChild(menu);
                this.projectListEl.appendChild(li);
            });

            this.updateTrashControls(deletedProjects.length);
            if (this.trashModal) {
                this.trashModal.hidden = !this.trashModalOpen;
            }
            if (this.trashEmptyStateEl) {
                this.trashEmptyStateEl.hidden = deletedProjects.length > 0;
            }

            deletedProjects.forEach((proj) => {
                if (!this.trashListEl) return;
                const li = document.createElement('li');
                li.className = 'nav-trash-item';
                li.innerHTML = `
                    <div class="nav-trash-item__meta">
                        <div class="nav-trash-item__name">${this.escapeHtml(proj.name || proj.id)}</div>
                        <div class="nav-trash-item__desc">${this.escapeHtml(proj.id)}</div>
                    </div>
                    <div class="nav-trash-item__actions">
                        <button type="button" class="nav-trash-item__restore" data-project-restore="${this.escapeHtml(proj.id)}">恢复</button>
                        <button type="button" class="nav-trash-item__force-delete" data-project-force-delete="${this.escapeHtml(proj.id)}">彻底删除</button>
                    </div>
                `;
                this.trashListEl.appendChild(li);
            });
        } else {
            this.pageNavSection.removeAttribute('hidden');
            this.projectNavSection.setAttribute('hidden', 'true');

            this.pageListEl.innerHTML = '';
            const sortedPages = [...(this.projects?.pages || [])].sort((left, right) => {
                const leftOrder = Number(left.order) || 0;
                const rightOrder = Number(right.order) || 0;
                if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                return String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN');
            });
            const activePages = this.getActivePagesSorted();
            const deletedPages = sortedPages.filter((page) => page.deleted);

            this.getOrderedPageTreeItems(null, 0, this.getProjectRecord(), { includeCollapsed: false }).forEach(item => {
                const li = document.createElement('li');
                li.className = `nav-item nav-tree-item${this.pageActionMenuOpenId === item.id ? ' is-menu-open' : ''}`;
                li.draggable = true;
                li.dataset.dragType = item.type;
                li.dataset.dragId = item.id;
                li.dataset.parentId = item.type === 'folder'
                    ? (item.folder.parentId || '')
                    : (item.page.parentId || '');
                li.style.setProperty('--level', String(item.depth));

                const row = document.createElement('div');
                row.className = `nav-link nav-tree-link ${item.type === 'folder' ? 'nav-tree-link--folder' : ''} ${item.type === 'page' && item.page.id === this.activePageId ? 'active' : ''}`;
                row.dataset.id = item.id;
                if (item.type === 'folder') {
                    row.innerHTML = `
                        <span class="nav-link__label">
                            <button type="button" class="nav-tree-toggle${item.folder.collapsed ? ' is-collapsed' : ''}" data-folder-toggle="${this.escapeHtml(item.id)}" title="${item.folder.collapsed ? '展开文件夹' : '收起文件夹'}" aria-label="${item.folder.collapsed ? '展开文件夹' : '收起文件夹'}" aria-expanded="${item.folder.collapsed ? 'false' : 'true'}">
                                <svg class="folder-icon folder-icon--open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19l2.76-7.35A1 1 0 0 1 8.69 11H20.3a1 1 0 0 1 .94 1.35l-2.26 6a1 1 0 0 1-.94.65H5Z"></path><path d="M3 6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v2H8.69a1 1 0 0 0-.93.65L5 19H3V6Z"></path></svg>
                                <svg class="folder-icon folder-icon--closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"></path></svg>
                            </button>
                            <span class="nav-link__text">${this.escapeHtml(item.folder.name || '未命名文件夹')}</span>
                        </span>
                    `;
                } else {
                    const page = item.page;
                    row.innerHTML = `
                        <span class="nav-link__label">
                            <span class="nav-link__text">${this.escapeHtml(page.name || page.id)}</span>
                        </span>
                    `;

                    row.addEventListener('click', () => {
                        this.switchPage(page.id);
                    });
                }

                li.appendChild(row);
                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'nav-item__more';
                moreBtn.title = item.type === 'folder' ? '文件夹操作' : '页面操作';
                if (item.type === 'folder') moreBtn.dataset.folderMore = item.id;
                else moreBtn.dataset.pageMore = item.id;
                moreBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>';
                li.appendChild(moreBtn);

                const menu = document.createElement('div');
                menu.className = 'nav-item__menu';
                if (item.type === 'folder') {
                    menu.innerHTML = `
                        <button type="button" class="nav-item__menu-btn nav-item__menu-btn--rename" data-folder-rename="${this.escapeHtml(item.id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                            <span>重命名</span>
                        </button>
                        <button type="button" class="nav-item__menu-btn" data-folder-share="${this.escapeHtml(item.id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.7 10.7 6.6-3.4"></path><path d="m8.7 13.3 6.6 3.4"></path></svg>
                            <span>分享文件夹</span>
                        </button>
                        <button type="button" class="nav-item__menu-btn" data-folder-delete="${this.escapeHtml(item.id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
                            <span>删除文件夹</span>
                        </button>
                    `;
                } else {
                    const page = item.page;
                    menu.innerHTML = `
                        <button type="button" class="nav-item__menu-btn nav-item__menu-btn--rename" data-page-rename="${this.escapeHtml(page.id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                            <span>重命名</span>
                        </button>
                        <button type="button" class="nav-item__menu-btn" data-page-delete="${this.escapeHtml(page.id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
                            <span>删除页面</span>
                        </button>
                    `;
                }
                li.appendChild(menu);
                this.pageListEl.appendChild(li);
            });

            this.updateTrashControls(deletedPages.length);
            if (this.trashModal) {
                this.trashModal.hidden = !this.trashModalOpen;
            }
            if (this.trashEmptyStateEl) {
                this.trashEmptyStateEl.hidden = deletedPages.length > 0;
            }

            deletedPages.forEach((page) => {
                if (!this.trashListEl) return;
                const li = document.createElement('li');
                li.className = 'nav-trash-item';
                li.innerHTML = `
                    <div class="nav-trash-item__meta">
                        <div class="nav-trash-item__name">${this.escapeHtml(page.name || page.id)}</div>
                        <div class="nav-trash-item__desc">${this.escapeHtml(page.id)}</div>
                    </div>
                    <div class="nav-trash-item__actions">
                        <button type="button" class="nav-trash-item__restore" data-page-restore="${this.escapeHtml(page.id)}">恢复</button>
                        <button type="button" class="nav-trash-item__force-delete" data-page-force-delete="${this.escapeHtml(page.id)}">彻底删除</button>
                    </div>
                `;
                this.trashListEl.appendChild(li);
            });
        }
    }

    enterProject(projectId) {
        const project = this.projects?.projects?.find(p => p.id === projectId);
        if (!project) return;
        this.activeProjectId = projectId;
        if (this.projects) {
            this.projects.activeProjectId = projectId;
        }
        this.currentView = 'pages';
        this.switchTopView('page');
        this.renderSidebar();

        // Switch to the first active page or reset active page
        const sortedPages = this.getActivePagesSorted();
        if (sortedPages.length > 0) {
            const page = sortedPages[0];
            const version = this.getPreferredPageVersion(page);
            this.writeShellNavigationState('pages', projectId, page.id, version);
            this.switchPage(page.id, version);
        } else {
            this.activePageId = null;
            this.activeVersion = null;
            if (this.currentPageNameEl) {
                this.currentPageNameEl.textContent = '暂无页面';
            }
            if (this.mainIframe) {
                this.mainIframe.src = 'about:blank';
            }
            this.renderVersionPanel(null);
            this.resetPrdDocumentState();
            this.renderAnnotationDrawer();
            this.clearAnnotationMarkers();
            this.updateAgentContextLabel();
            this.renderAgentWorkbench();
            this.writeShellNavigationState();
        }
    }

    async createNewProjectFlow() {
        this.openProjectCreateModal();
    }

    openProjectCreateModal() {
        if (!this.projectCreateModal) return;
        if (this.projectCreateNameInput) {
            this.projectCreateNameInput.value = '';
        }
        this.projectCreateModal.hidden = false;
        setTimeout(() => this.projectCreateNameInput?.focus(), 0);
    }

    closeProjectCreateModal() {
        if (this.projectCreateModal) {
            this.projectCreateModal.hidden = true;
        }
    }

    async submitProjectCreateForm() {
        const projectName = this.projectCreateNameInput?.value || '';
        const trimmedName = (projectName || '').trim();
        if (!trimmedName) return;

        const projectId = trimmedName.toLowerCase().replace(/[^a-z0-9_\-]/g, '') || `proj-${Date.now()}`;

        try {
            const response = await fetch('http://localhost:8080/api/create-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, projectName: trimmedName })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '创建项目失败');
            }
            this.closeProjectCreateModal();
            await this.loadData();
            await this.syncFromDisk();
            
            this.enterProject(projectId);
            this.showToast(`成功创建项目「${trimmedName}」`);
        } catch (error) {
            alert(`创建项目失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deleteProject(projectId) {
        const proj = this.projects?.projects?.find(p => p.id === projectId);
        if (!proj || proj.deleted) return;
        const confirmed = await this.showConfirm({
            title: `删除项目 ${proj.name || proj.id}`,
            message: '该操作将标记项目为已删除，不会物理删除其文件夹，其下的页面将被隐藏。',
            okText: '确认删除'
        });
        if (!confirmed) return;
        try {
            const response = await fetch('http://localhost:8080/api/delete-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, deletedAt: new Date().toISOString() })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '删除项目失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.projectActionMenuOpenId = null;
            this.renderSidebar();
            this.showToast(`已标记删除项目 ${proj.name || proj.id}`);
        } catch (error) {
            alert(`删除项目失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async restoreProject(projectId) {
        try {
            const response = await fetch('http://localhost:8080/api/restore-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '恢复项目失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`已成功恢复项目`);
        } catch (error) {
            alert(`恢复项目失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async forceDeleteProject(projectId) {
        const proj = this.projects?.projects?.find(p => p.id === projectId);
        if (!proj) return;
        const confirmed = await this.showConfirm({
            title: `彻底删除项目 ${proj.name || proj.id}`,
            message: '警告：该操作将永久删除此项目的所有文件、页面和版本，不可恢复！',
            okText: '确认彻底删除'
        });
        if (!confirmed) return;
        try {
            const response = await fetch('http://localhost:8080/api/force-delete-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '彻底删除项目失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`已永久删除项目 ${proj.name || proj.id}`);
        } catch (error) {
            alert(`彻底删除项目失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async renameProjectFlow(projectId) {
        const proj = this.projects?.projects?.find(p => p.id === projectId);
        if (!proj) return;
        const newName = await this._showRenameModal(proj.name || proj.id, '重命名项目', '请输入项目新名称');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === (proj.name || proj.id)) return;
        try {
            const response = await fetch('http://localhost:8080/api/rename-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, newName: trimmed })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '重命名项目失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`已将项目重命名为「${trimmed}」`);
        } catch (error) {
            alert(`重命名失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async editProjectIdFlow(projectId) {
        const proj = this.projects?.projects?.find(p => p.id === projectId);
        if (!proj) return;
        const nextId = await this._showRenameModal(proj.id || '', '编辑项目 ID', '请输入新的项目 ID（仅支持字母、数字、-、_）');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmed = String(nextId || '').trim().toLowerCase();
        if (!trimmed || trimmed === proj.id) return;
        if (!/^[a-z0-9_-]+$/.test(trimmed)) {
            alert('项目 ID 只能包含小写字母、数字、-、_');
            return;
        }
        try {
            const response = await fetch('http://localhost:8080/api/rename-project-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, newProjectId: trimmed })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '编辑项目 ID 失败');
            }
            if (this.activeProjectId === projectId) {
                this.activeProjectId = trimmed;
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`项目 ID 已改为「${trimmed}」`);
        } catch (error) {
            alert(`编辑项目 ID 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    openTrashModal() {
        this.trashModalOpen = true;
        this.renderSidebar();
    }

    closeTrashModal() {
        this.trashModalOpen = false;
        this.renderSidebar();
    }

    toggleTrashModal() {
        this.trashModalOpen ? this.closeTrashModal() : this.openTrashModal();
    }

    async createPageFolderFlow(parentId = null) {
        const folderName = await this._showRenameModal('', '新建文件夹', '请输入文件夹名称');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmedName = (folderName || '').trim();
        if (!trimmedName) return;

        const project = this.getProjectRecord();
        if (!project) return;
        project.folders = Array.isArray(project.folders) ? project.folders : [];
        project.folders.push({
            id: this.createPageFolderId(),
            name: trimmedName,
            parentId: parentId || null,
            order: this.getNextPageTreeOrder(parentId),
            collapsed: false,
            deleted: false,
            deletedAt: null
        });

        try {
            await this.savePageStructure();
            this.renderSidebar();
            this.renderPageSelector();
            this.showToast(`已创建文件夹「${trimmedName}」`);
        } catch (error) {
            alert(`创建文件夹失败: ${error instanceof Error ? error.message : String(error)}`);
            await this.loadData();
            this.renderSidebar();
        }
    }

    async renamePageFolderFlow(folderId) {
        const project = this.getProjectRecord();
        const folder = project?.folders?.find((item) => item.id === folderId && !item.deleted);
        if (!folder) return;
        const folderName = await this._showRenameModal(folder.name || '', '重命名文件夹', '请输入文件夹新名称');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmedName = (folderName || '').trim();
        if (!trimmedName || trimmedName === folder.name) return;
        folder.name = trimmedName;
        try {
            await this.savePageStructure();
            this.renderSidebar();
            this.renderPageSelector();
            this.showToast(`已将文件夹重命名为「${trimmedName}」`);
        } catch (error) {
            alert(`重命名文件夹失败: ${error instanceof Error ? error.message : String(error)}`);
            await this.loadData();
            this.renderSidebar();
        }
    }

    async togglePageFolderCollapsed(folderId) {
        const project = this.getProjectRecord();
        const folder = project?.folders?.find((item) => item.id === folderId && !item.deleted);
        if (!folder) return;
        folder.collapsed = !folder.collapsed;
        try {
            await this.savePageStructure();
            this.renderSidebar();
            this.renderPageSelector();
        } catch (error) {
            folder.collapsed = !folder.collapsed;
            alert(`保存文件夹状态失败: ${error instanceof Error ? error.message : String(error)}`);
            this.renderSidebar();
        }
    }

    async deletePageFolder(folderId) {
        const project = this.getProjectRecord();
        const folder = project?.folders?.find((item) => item.id === folderId && !item.deleted);
        if (!folder) return;
        const confirmed = await this.showConfirm({
            title: `删除文件夹 ${folder.name || folder.id}`,
            message: '文件夹内的页面和子文件夹会移动到上一级，不会删除页面文件。',
            okText: '确认删除'
        });
        if (!confirmed) return;
        const parentId = folder.parentId || null;
        folder.deleted = true;
        folder.deletedAt = new Date().toISOString();
        (project.pages || []).forEach((page) => {
            if ((page.parentId || null) === folderId) page.parentId = parentId;
        });
        (project.folders || []).forEach((child) => {
            if ((child.parentId || null) === folderId) child.parentId = parentId;
        });
        this.rebalancePageTreeOrders(parentId);
        try {
            await this.savePageStructure();
            this.renderSidebar();
            this.renderPageSelector();
            this.showToast(`已删除文件夹「${folder.name || folder.id}」`);
        } catch (error) {
            alert(`删除文件夹失败: ${error instanceof Error ? error.message : String(error)}`);
            await this.loadData();
            this.renderSidebar();
        }
    }

    handlePageTreeDragStart(event) {
        const item = event.target.closest('[data-drag-type][data-drag-id]');
        if (!item || event.target.closest('button')) {
            event.preventDefault();
            return;
        }
        this.pageDragState = {
            type: item.dataset.dragType,
            id: item.dataset.dragId
        };
        item.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `${this.pageDragState.type}:${this.pageDragState.id}`);
    }

    getPageTreeDropIntent(event, targetItem) {
        if (!this.pageDragState || !targetItem) return null;
        const targetType = targetItem.dataset.dragType;
        const targetId = targetItem.dataset.dragId;
        if (!targetType || !targetId) return null;
        if (this.pageDragState.type === targetType && this.pageDragState.id === targetId) return null;
        if (this.pageDragState.type === 'folder' && targetType === 'folder' && this.isFolderDescendant(targetId, this.pageDragState.id)) return null;

        const rect = targetItem.getBoundingClientRect();
        const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
        if (targetType === 'folder' && ratio > 0.28 && ratio < 0.72) {
            return { mode: 'inside', targetType, targetId, parentId: targetId };
        }
        return {
            mode: ratio < 0.5 ? 'before' : 'after',
            targetType,
            targetId,
            parentId: targetItem.dataset.parentId || null
        };
    }

    handlePageTreeDragOver(event) {
        const targetItem = event.target.closest('[data-drag-type][data-drag-id]');
        const intent = this.getPageTreeDropIntent(event, targetItem);
        this.clearPageTreeDropState({ keepDragging: true });
        if (!intent || !targetItem) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        targetItem.classList.add(`is-drop-${intent.mode}`);
    }

    handlePageTreeDragLeave(event) {
        const item = event.target.closest('[data-drag-type][data-drag-id]');
        if (!item || item.contains(event.relatedTarget)) return;
        item.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-inside');
    }

    async handlePageTreeDrop(event) {
        const targetItem = event.target.closest('[data-drag-type][data-drag-id]');
        const intent = this.getPageTreeDropIntent(event, targetItem);
        this.clearPageTreeDropState();
        if (!intent || !this.pageDragState) return;
        event.preventDefault();

        const project = this.getProjectRecord();
        if (!project) return;
        const dragged = this.pageDragState.type === 'folder'
            ? project.folders?.find((folder) => folder.id === this.pageDragState.id && !folder.deleted)
            : project.pages?.find((page) => page.id === this.pageDragState.id && !page.deleted);
        const target = intent.targetType === 'folder'
            ? project.folders?.find((folder) => folder.id === intent.targetId && !folder.deleted)
            : project.pages?.find((page) => page.id === intent.targetId && !page.deleted);
        if (!dragged || !target) return;

        const previousParentId = dragged.parentId || null;
        const nextParentId = intent.mode === 'inside' ? intent.targetId : (intent.parentId || null);
        if (this.pageDragState.type === 'folder' && nextParentId && this.isFolderDescendant(nextParentId, dragged.id)) return;

        dragged.parentId = nextParentId;
        this.rebalancePageTreeOrders(previousParentId);
        this.rebalancePageTreeOrders(nextParentId);

        if (intent.mode === 'inside') {
            dragged.order = this.getNextPageTreeOrder(nextParentId);
        } else {
            const siblingItems = [
                ...this.getActiveFolders(project).filter((folder) => (folder.parentId || null) === nextParentId).map((folder) => ({ type: 'folder', id: folder.id, order: folder.order, ref: folder })),
                ...(project.pages || []).filter((page) => !page.deleted && (page.parentId || null) === nextParentId).map((page) => ({ type: 'page', id: page.id, order: page.order, ref: page }))
            ].sort((left, right) => this.comparePageTreeItems(left.ref, right.ref));
            const withoutDragged = siblingItems.filter((item) => !(item.type === this.pageDragState.type && item.id === this.pageDragState.id));
            const targetIndex = withoutDragged.findIndex((item) => item.type === intent.targetType && item.id === intent.targetId);
            const nextIndex = intent.mode === 'before' ? targetIndex : targetIndex + 1;
            withoutDragged.splice(Math.max(0, Math.min(nextIndex, withoutDragged.length)), 0, {
                type: this.pageDragState.type,
                id: this.pageDragState.id,
                ref: dragged
            });
            withoutDragged.forEach((item, index) => {
                item.ref.order = (index + 1) * 1000;
            });
        }

        try {
            await this.savePageStructure();
            this.renderSidebar();
            this.renderPageSelector();
            this.showToast('页面结构已更新');
        } catch (error) {
            alert(`保存排序失败: ${error instanceof Error ? error.message : String(error)}`);
            await this.loadData();
            this.renderSidebar();
        } finally {
            this.pageDragState = null;
        }
    }

    clearPageTreeDropState({ keepDragging = false } = {}) {
        this.pageListEl?.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-inside').forEach((node) => {
            node.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-inside');
        });
        if (!keepDragging) {
            this.pageListEl?.querySelectorAll('.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
        }
    }

    showConfirm({ title, message, okText }) {
        return new Promise((resolve) => {
            this._confirmResolve = resolve;
            if (this.confirmModalTitle) this.confirmModalTitle.textContent = title || '确认操作';
            if (this.confirmModalMessage) this.confirmModalMessage.textContent = message || '';
            if (this.confirmModalOk && okText) this.confirmModalOk.textContent = okText;
            if (this.confirmModal) this.confirmModal.hidden = false;
        });
    }

    _closeConfirm(result) {
        if (this.confirmModal) this.confirmModal.hidden = true;
        if (this._confirmResolve) {
            this._confirmResolve(result);
            this._confirmResolve = null;
        }
    }

    async switchPage(pageId, version, { skipPrdDraftCheck = false, projectId = this.activeProjectId } = {}) {
        let project = this.getProjectRecord(projectId);
        let page = project?.pages?.find(p => p.id === pageId) || null;

        // Legacy fallback: old session records may have page/version without a reliable projectId.
        if (!page || (version && !page.versions?.includes(version))) {
            const resolved = this.resolvePageProject(pageId, version, projectId);
            project = resolved?.project || project;
            page = resolved?.page || page;
        }

        const nextVersion = this.getPreferredPageVersion(page, version);
        const isAlreadyOnPage = project?.id === this.activeProjectId
            && pageId === this.activePageId
            && nextVersion === this.activeVersion;
        if (isAlreadyOnPage) {
            if (this.currentPageNameEl && page) {
                this.currentPageNameEl.textContent = page.name;
            }
            this.writeShellNavigationState();
            this.updateAgentContextLabel();
            return;
        }

        if (project?.id && project.id !== this.activeProjectId) {
            this.activeProjectId = project.id;
            if (this.projects) {
                this.projects.activeProjectId = project.id;
            }
            this.currentView = 'pages';
            this.renderSidebar();
        }
        const changesContext = this.activePageId
            && (pageId !== this.activePageId || (nextVersion && nextVersion !== this.activeVersion));
        if (!skipPrdDraftCheck && changesContext && !(await this.confirmPrdDiscardIfDirty())) return;

        this.activePageId = pageId;

        if (!page) return;

        this.currentPageNameEl.textContent = page.name;

        // Update Sidebar UI
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.id === pageId);
        });

        this.switchVersion(nextVersion || page.versions[0], { skipPrdDraftCheck: true });
    }

    async switchVersion(version, { skipPrdDraftCheck = false } = {}) {
        if (!skipPrdDraftCheck && this.activeVersion && version !== this.activeVersion && !(await this.confirmPrdDiscardIfDirty())) {
            return;
        }

        this.activeVersion = version;
        const page = this.projects.pages.find(p => p.id === this.activePageId);

        // Clear feedback items on version switch
        if (this.feedbackItems.length > 0) {
            this.feedbackItems = [];
            this.renderFeedbackPanel();
        }

        // Update version panel
        this.renderVersionPanel(page);

        if (!page) return;

        this.teardownIframeObservers();
        this.visibleAnnotations = [];
        this.activeAnnotationSourceIndex = null;
        this.clearAnnotationFocus();
        this.resetPrdDocumentState();
        this.renderAnnotationDrawer();
        this.clearAnnotationMarkers();

        // Load iframe
        const cacheBuster = this.isShareMode && this.shareConfig.generatedAt
            ? `?t=${encodeURIComponent(this.shareConfig.generatedAt)}`
            : `?t=${Date.now()}`;
        const relativePath = `/src/pages/${this.activeProjectId}/${this.activePageId}/${version}/index.html${cacheBuster}`;
        this.mainIframe.src = relativePath;

        // In folder share mode, sync per-page share metadata so existing share-mode code paths
        // (annotations, PRD module) pick up the right content for the active page.
        if (this.isShareMode && this.shareConfig.mode === 'folder') {
            const meta = this.getActiveFolderSharePageMeta(this.activePageId, version);
            this.shareConfig.annotations = meta?.annotations ? [...meta.annotations] : null;
            this.shareConfig.prdContent = meta?.prdContent ?? null;
            this.shareConfig.prdPath = meta?.prdPath ?? null;
            this.shareConfig.prdFilename = meta?.prdFilename ?? null;
            this.shareConfig.documents = meta?.documents ?? null;
            this.shareConfig.diagramContent = meta?.diagramContent ?? null;
            this.shareConfig.diagramPath = meta?.diagramPath ?? null;
            this.shareConfig.diagramFilename = meta?.diagramFilename ?? null;
            this.shareConfig.diagrams = meta?.diagrams ?? null;
            this.shareConfig.mindmapContent = meta?.mindmapContent ?? null;
            this.shareConfig.mindmapPath = meta?.mindmapPath ?? null;
            this.shareConfig.mindmapFilename = meta?.mindmapFilename ?? null;
            this.shareConfig.mindmaps = meta?.mindmaps ?? null;
            this.shareConfig.pageId = this.activePageId;
            this.shareConfig.pageName = page.name || this.activePageId;
            this.shareConfig.version = version;
        }

        // Track active state in memory
        page.activeVersion = version;
        this.rememberPageVersion(this.activeProjectId, this.activePageId, version);
        this.writeShellNavigationState();
        // Context is decoupled from shell page switching
        this.updateAgentContextLabel();
        this.renderAgentWorkbench();
        if (this.docDrawerMode === 'prd' && this.annotationDrawerEnabled) {
            this.loadPrdDocument({ force: true });
        } else if (this.docDrawerMode === 'diagram' && this.annotationDrawerEnabled) {
            this.drawioModule?.switchContext();
        } else if (this.docDrawerMode === 'mindmap' && this.annotationDrawerEnabled) {
            this.mindmapModule?.switchContext();
        }
    }

    async deletePage(pageId) {
        const page = this.getPageRecord(pageId);
        if (!page || page.deleted) return;
        const confirmed = await this.showConfirm({
            title: `删除页面 ${page.name || page.id}`,
            message: '这次只会标记为已删除，不会删除源文件。对应页面与版本的对话将被禁用。',
            okText: '确认删除'
        });
        if (!confirmed) return;
        try {
            const response = await fetch('http://localhost:8080/api/delete-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId, deletedAt: new Date().toISOString() })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '删除页面失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.pageActionMenuOpenId = null;
            this.renderSidebar();
            if (this.activePageId === pageId) {
                this.switchPage(pageId, this.getPreferredPageVersion(page, this.activeVersion || page.activeVersion || page.versions[0]));
            }
            this.showToast(`已标记删除页面 ${page.name || page.id}`);
        } catch (error) {
            alert(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async restorePage(pageId) {
        const page = this.getPageRecord(pageId);
        if (!page || !page.deleted) return;
        try {
            const response = await fetch('http://localhost:8080/api/restore-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '恢复页面失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`已恢复页面 ${page.name || page.id}`);
        } catch (error) {
            alert(`恢复失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async forceDeletePage(pageId) {
        const page = this.getPageRecord(pageId);
        if (!page) return;
        const confirmed = await this.showConfirm({
            title: `彻底删除页面 ${page.name || page.id}`,
            message: '警告：该操作将永久删除此页面的所有文件、版本和相关 PRD 文档，不可恢复！',
            okText: '确认彻底删除'
        });
        if (!confirmed) return;
        try {
            const response = await fetch('http://localhost:8080/api/force-delete-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '彻底删除页面失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            this.showToast(`已永久删除页面 ${page.name || page.id}`);
        } catch (error) {
            alert(`彻底删除页面失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    _closeRenameModal() {
        if (this.renameModal) this.renameModal.hidden = true;
        if (this._renameResolve) {
            this._renameResolve('');
            this._renameResolve = null;
        }
    }

    _showRenameModal(currentName, title = '重命名页面', placeholder = '请输入新名称') {
        return new Promise((resolve) => {
            this._renameResolve = resolve;
            const titleEl = document.getElementById('renameModalTitle');
            if (titleEl) titleEl.textContent = title;
            if (this.renameModalInput) {
                this.renameModalInput.value = currentName;
                this.renameModalInput.placeholder = placeholder;
            }
            if (this.renameModal) this.renameModal.hidden = false;
            // Defer focus so the modal is visible first
            requestAnimationFrame(() => {
                this.renameModalInput?.focus();
                this.renameModalInput?.select();
            });
        });
    }

    async renamePageFlow(pageId) {
        const page = this.getPageRecord(pageId);
        if (!page) return;
        const newName = await this._showRenameModal(page.name || page.id, '重命名页面', '请输入页面新名称');
        this._renameResolve = null;
        if (this.renameModal) this.renameModal.hidden = true;
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === (page.name || page.id)) return;
        try {
            const response = await fetch('http://localhost:8080/api/rename-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.activeProjectId, pageId, newName: trimmed })
            });
            if (!response.ok) {
                throw new Error(await response.text() || '重命名失败');
            }
            await this.loadData();
            await this.syncFromDisk();
            this.renderSidebar();
            // Update header if this is the active page
            if (this.activePageId === pageId && this.currentPageNameEl) {
                const updated = this.getPageRecord(pageId);
                if (updated) this.currentPageNameEl.textContent = updated.name;
            }
            this.showToast(`已将页面重命名为「${trimmed}」`);
        } catch (error) {
            alert(`重命名失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async openNewPageAgentFlow({ templateId = 'default', frameworkId = this.newPageFrameworkId, projectId = this.activeProjectId, targetDevice = 'mobile' } = {}) {
        await this.loadTemplatesData();
        if (projectId) {
            this.activeProjectId = projectId;
            if (this.projects) this.projects.activeProjectId = projectId;
        }
        this.newPageStyleId = templateId || 'default';
        this.newPageFrameworkId = this.getNewPageFrameworkOptions().some((item) => item.id === frameworkId)
            ? frameworkId
            : 'ant-design-skill';
        this.newPageTargetDevice = this.normalizePageTargetDevice(targetDevice);
        this.newPageStyleDropdownOpen = false;
        this.openAgentWorkbench();
        const reusableSessionId = this.findReusableAgentSessionId({ sessionScope: 'global' });
        if (reusableSessionId) {
            await this.switchAgentSession(reusableSessionId, { awaitRefresh: true });
        } else {
            await this.createAgentSession({ switchTo: true, title: '新增页面', sessionScope: 'global', awaitRefresh: true });
        }
        await this.applyAgentGlobalContext();
        const skill = this.getAgentSkill('create-new-page');
        if (skill) {
            this.agentActiveSkill = skill;
        }
        if (this.agentInput) {
            this.agentInput.value = '';
        }
        this.renderAgentWorkbench();
        this.syncNewPagePrompt({ force: true });
        this.agentInput?.focus();
    }

    async applyAgentGlobalContext() {
        const globalContext = this.getAgentGlobalContext();
        try {
            if (this.agentSessionId) {
                await this.agentApi.setContext(this.agentSessionId, globalContext);
            }
            this.agentSessionContext = {
                projectId: globalContext.projectId,
                pageId: '__global__',
                version: 'workspace',
                globalContext: true
            };
            this.agentSessionScope = 'global';
        } catch (error) {
            console.warn('Failed to sync new-page global context:', error);
        }
    }

    async startNewAgentSessionFlow() {
        this.openAgentWorkbench();
        const context = this.getAgentContext();
        const reusableSessionId = this.findReusableAgentSessionId({ sessionScope: 'page', context });
        if (reusableSessionId) {
            await this.switchAgentSession(reusableSessionId);
        } else {
            await this.createAgentSession({ switchTo: true, title: '新会话', sessionScope: 'page' });
        }
        this.agentActiveSkill = null;
        this.renderAgentWorkbench();
        this.agentInput?.focus();
    }

    // 让 Prota 自动帮我完成 Vercel 静态云分享配置
    async startVercelAutoConfig() {
        if (this.agentRunState?.active) {
            this.showToast('Prota 正在执行任务，请稍后再试。', true);
            return;
        }
        this.closeSettingsModal();
        this.openAgentWorkbench();
        const reusableSessionId = this.findReusableAgentSessionId({ sessionScope: 'global' });
        if (reusableSessionId) {
            await this.switchAgentSession(reusableSessionId);
        } else {
            await this.createAgentSession({ switchTo: true, title: 'Vercel 配置', sessionScope: 'global' });
        }
        await this.applyAgentGlobalContext();
        this.agentActiveSkill = null;
        const staticDomain = this.staticDomainInput?.value?.trim() || this.settings?.staticDomain || 'share.你的域名.com';
        const prompt = [
            '请配置 Vercel 直接部署分享，沿用分享域名 ' + staticDomain + ' 和原分享路径；已配置的项目先检查状态，不重复创建。',
            '先从系统运行上下文确定程序安装目录。当前 Agent 工作目录是独立的业务工作区，请使用程序安装目录内 scripts/configure-vercel.py 的绝对路径，以 python3 调用并传入 --domain ' + staticDomain + '。不要在业务工作区寻找这个脚本。',
            '该脚本只关联已绑定域名的现有 Vercel 项目，不负责创建项目或配置 DNS。先确认本机 Vercel 账号、团队及域名所属项目。',
            '确实没有分享项目时，在独立空目录创建仅包含空白 index.html 的引导项目，再通过上述产品 CLI 入口执行 deploy --cwd 加空白目录绝对路径创建分享项目（不可省略 --cwd）；禁止从产品目录或业务工作区直接部署。域名必须先在该项目绑定并按控制台提示配置 DNS，然后再执行关联脚本。',
            '登录、初始化项目和版本检查一律使用产品安装目录内 scripts/vercel-cli.mjs 的绝对路径，以 node 调用，例如 node /产品安装目录/scripts/vercel-cli.mjs login；产品目录内也可使用 npm run vercel -- login。禁止调用全局 vercel、npx vercel 或随意升级 latest。CLI 缺失或版本不符时先在产品安装目录执行 npm ci；更新产品后也通过 npm ci 并重启统一更新 CLI。',
            '凭据失效时指导我使用上述产品入口重新登录；不得把 token 写入源码、工作区或聊天。不要要求把产品仓库导入 Vercel，不要把 Output Directory 设置为 shares。',
            '分享通过独立 Build Output 目录直接部署，禁止 git add、commit、push，禁止上传完整工作区。保留已发布快照，叠加本次明确分享的页面，不同步其他页面的未分享修改。',
            '开启 vercelAutoDeploy 并保存正确域名，使用经过确认的分享内容验证部署和原链接。不能把本地文件生成或部署失败当作线上成功。',
            '完成直接部署验证后，仅在仍有关联的旧 Git 仓库时断开该关联，避免旧流程覆盖分享。',
            '不要新建替代域名，不要删除已有分享或发布快照，不要在本次配置中清理历史部署。访问权限保持用户已选择的策略。'
        ].join('\n');
        if (this.agentInput) this.agentInput.value = prompt;
        this.renderAgentWorkbench();
        // 不自动发送：把指令填入输入框，由用户确认后再点发送
        this.agentInput?.focus();
        this.agentInput?.select();
        this.showToast('已为你准备好配置指令，确认无误后点发送即可');
    }

    async startPrdGeneration() {
        if (this.agentRunState.active) {
            this.showToast('Prota 正在执行任务，请稍后再生成 PRD。', true);
            return;
        }

        const skill = this.getAgentSkill('generate-business-prd') || this.getAgentSkill('generate-product-doc');
        this.agentActiveSkill = skill || null;
        this.openAgentWorkbench();

        await this.ensureAgentSession({ sessionScope: 'page' });

        if (this.agentInput) {
            this.agentInput.value = skill?.defaultStarter || '请基于当前页面版本的用户 Prompt、Demo 源码、用户标注、DOM 映射和逐功能原图截图，生成业务视角的 AI-Ready PRD。';
        }

        this.renderAgentWorkbench();
        this.agentInput?.focus();
        this.agentInput?.select();
    }

    isPrdArtifact(artifact = {}) {
        const path = String(artifact.path || '');
        const url = String(artifact.outputUrl || '');
        return this.isPrdFilename(this.getPrdFileName(path)) || this.isPrdFilename(this.getPrdFileName(url));
    }

    getPrdContextFromArtifact(artifact = {}) {
        const source = `${artifact.path || ''} ${artifact.outputUrl || ''}`;
        const match = /src\/pages\/([^/\s]+)\/(v\d+)\/([^?#\s]+\.md)/.exec(source);
        if (!match || !this.isPrdFilename(this.getPrdFileName(match[3]))) return null;
        return {
            pageId: decodeURIComponent(match[1]),
            version: match[2],
            path: `src/pages/${match[1]}/${match[2]}/${this.getPrdFileName(match[3])}`
        };
    }

    openPrdDocumentFromArtifact(artifact = {}) {
        if (!this.isPrdArtifact(artifact)) return;

        const context = this.getPrdContextFromArtifact(artifact);
        if (context?.pageId && context?.version && (context.pageId !== this.activePageId || context.version !== this.activeVersion)) {
            this.switchPage(context.pageId, context.version);
        }

        this.openDocumentDrawer('prd', { forceReload: true, path: context?.path || artifact.path || '' });
    }

    getNextVersionId() {
        const page = this.projects.pages.find(p => p.id === this.activePageId);
        if (!page || !page.versions.length) return 'v1';

        const versionNums = page.versions.map(v => parseInt(v.slice(1)) || 0);
        const maxVersion = Math.max(...versionNums);

        return `v${maxVersion + 1}`;
    }

    // ── Annotation Mode ───────────────────────────────────

    isAnnotationShortcut(event) {
        if (!event || event.repeat) return false;
        return event.ctrlKey && String(event.key || '').toLowerCase() === 'd';
    }

    handleAnnotationShortcut(event, source = 'parent') {
        if (event && !this.isAnnotationShortcut(event)) return;

        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const now = Date.now();
        if (now - this._annotationToggleTs < 220) {
            return;
        }
        this._annotationToggleTs = now;
        this.toggleAnnotationMode(source);
    }

    handleAnnotationContextMenu(event, source = 'parent') {
        event?.preventDefault();
        event?.stopPropagation();
        if (this.isShareMode) return;

        // In annotation mode the first right click always exits immediately.
        // Outside annotation mode, require two nearby right clicks so the first
        // click cannot both exit and start a new entry gesture.
        if (this.annotationMode) {
            this._annotationRightClick = null;
            this.exitAnnotationMode(source);
            return;
        }

        const currentClick = {
            timestamp: Date.now(),
            x: Number(event?.clientX) || 0,
            y: Number(event?.clientY) || 0
        };
        const previousClick = this._annotationRightClick;
        const withinTime = previousClick
            && currentClick.timestamp - previousClick.timestamp <= 420;
        const withinDistance = previousClick
            && Math.hypot(currentClick.x - previousClick.x, currentClick.y - previousClick.y) <= 12;

        if (withinTime && withinDistance) {
            this._annotationRightClick = null;
            this.enterAnnotationMode(source);
            return;
        }

        this._annotationRightClick = currentClick;
    }

    async handleIframeLoad() {
        this.teardownIframeObservers();
        const svg = this.versionRefreshBtn?.querySelector('svg');
        if (svg) { svg.style.transition = 'none'; svg.style.transform = ''; }
        if (this.normalizePageTargetDevice(this.getPageRecord()?.targetDevice) === 'mobile') {
            try { installProtaMobileFrameFit(this.mainIframe.contentWindow); }
            catch (error) { console.warn('Mobile preview fitting unavailable:', error); }
        }
        await this.loadAnnotations();
        this.injectIframeShortcutBridge();

        if (this.annotationMode) {
            this.injectInspector();
        } else {
            this.removeInspector();
        }

        this.refreshAnnotationUI();
    }

    injectIframeShortcutBridge() {
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc || !iframeDoc.body) return;

        const existing = iframeDoc.getElementById('__readify_shortcut_bridge');
        if (existing) existing.remove();

        const script = iframeDoc.createElement('script');
        script.id = '__readify_shortcut_bridge';
        const enableAnnotationShortcuts = !this.isShareMode;
        script.textContent = `(function() {
            var enableAnnotationShortcuts = ${enableAnnotationShortcuts ? 'true' : 'false'};
            window.__readifyAnnotationRightClick = null;
            
            // Intercept and trigger page jumps for data-link-to elements
            document.addEventListener('click', function(e) {
                var linkTarget = e.target.closest('[data-link-to]');
                if (linkTarget) {
                    var toPageId = linkTarget.getAttribute('data-link-to');
                    if (toPageId && !window.__readifyInspecting) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        window.parent.postMessage({
                            type: 'readify:trigger-jump',
                            toPageId: toPageId
                        }, '*');
                    }
                }
            }, true);

            document.addEventListener('keydown', function(e) {
                if (!enableAnnotationShortcuts) return;
                if (!e.ctrlKey || String(e.key || '').toLowerCase() !== 'd') return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                window.parent.postMessage({ type: 'readify:toggle-annotation' }, '*');
            }, true);
            document.addEventListener('click', function(e) {
                if (e.button === 0) {
                    window.parent.postMessage({ type: 'readify:close-dropdowns' }, '*');
                }
            }, true);
            document.addEventListener('contextmenu', function(e) {
                if (!enableAnnotationShortcuts) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (window.__readifyInspecting) {
                    window.__readifyAnnotationRightClick = null;
                    window.parent.postMessage({ type: 'readify:exit-annotation' }, '*');
                    return;
                }

                var currentClick = {
                    timestamp: Date.now(),
                    x: Number(e.clientX) || 0,
                    y: Number(e.clientY) || 0
                };
                var previousClick = window.__readifyAnnotationRightClick;
                var withinTime = previousClick
                    && currentClick.timestamp - previousClick.timestamp <= 420;
                var deltaX = previousClick ? currentClick.x - previousClick.x : 0;
                var deltaY = previousClick ? currentClick.y - previousClick.y : 0;
                var withinDistance = previousClick
                    && Math.sqrt(deltaX * deltaX + deltaY * deltaY) <= 12;

                if (withinTime && withinDistance) {
                    window.__readifyAnnotationRightClick = null;
                    window.parent.postMessage({ type: 'readify:enter-annotation' }, '*');
                } else {
                    window.__readifyAnnotationRightClick = currentClick;
                }
            }, true);
            // State sync bridge: allows parent shell to update the iframe's internal JS state
            window.addEventListener('message', function(e) {
                if (!e.data || e.data.type !== 'readify:sync-state') return;
                var patches = e.data.patches;
                if (!patches || typeof patches !== 'object') return;
                // Find the global state object. Demo pages use top-level const state = {...}
                // which lives in the global lexical scope (not on window).
                var stateObj = null;
                try {
                    if (typeof state !== 'undefined' && state && typeof state === 'object') {
                        stateObj = state;
                    }
                } catch(ex) {}
                // Fallback: check window.state (for pages that use var/window assignment)
                if (!stateObj && typeof window.state !== 'undefined' && window.state && typeof window.state === 'object') {
                    stateObj = window.state;
                }
                if (!stateObj) return;
                // Apply patches
                var keys = Object.keys(patches);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (key in stateObj) {
                        stateObj[key] = patches[key];
                    }
                }
                // Trigger re-render if render() exists globally
                if (typeof window.render === 'function') {
                    try { window.render(); } catch(ex) {}
                } else if (typeof render === 'function') {
                    try { render(); } catch(ex) {}
                }
                // Acknowledge back to parent
                window.parent.postMessage({ type: 'readify:sync-state-ack', applied: keys }, '*');
            });
        })();`;
        iframeDoc.body.appendChild(script);
    }

    /**
     * Send state patches to the iframe's internal JS state object.
     * Returns a promise that resolves when the iframe acknowledges, or rejects on timeout.
     */
    syncIframeState(patches, timeout = 400) {
        const iframeWin = this.mainIframe.contentWindow;
        if (!iframeWin) return Promise.resolve(false);

        return new Promise((resolve) => {
            let settled = false;
            const handler = (event) => {
                if (!event.data || event.data.type !== 'readify:sync-state-ack') return;
                if (settled) return;
                settled = true;
                window.removeEventListener('message', handler);
                resolve(true);
            };
            window.addEventListener('message', handler);

            try {
                iframeWin.postMessage({ type: 'readify:sync-state', patches }, '*');
            } catch {
                settled = true;
                window.removeEventListener('message', handler);
                resolve(false);
                return;
            }

            window.setTimeout(() => {
                if (settled) return;
                settled = true;
                window.removeEventListener('message', handler);
                resolve(false);
            }, timeout);
        });
    }

    refreshCurrentDemo() {
        if (!this.mainIframe || !this.mainIframe.src) return;
        try {
            this.mainIframe.contentWindow.location.reload(true);
        } catch (err) {
            this.mainIframe.src = this.mainIframe.src;
        }
        if (this.docDrawerMode === 'prd' && this.annotationDrawerEnabled) {
            this.loadPrdDocument({ force: true });
        }
    }

    normalizeWorkspaceRelativePath(filePath = '') {
        return String(filePath || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');
    }

    getCurrentDemoPathPrefix() {
        if (!this.activeProjectId || !this.activePageId || !this.activeVersion) return '';
        return `src/pages/${this.activeProjectId}/${this.activePageId}/${this.activeVersion}/`;
    }

    getCurrentDemoDocsPrefix() {
        if (!this.activeProjectId || !this.activePageId) return '';
        return `src/pages/${this.activeProjectId}/${this.activePageId}/docs/`;
    }

    getChangedWorkspacePaths(changes = {}) {
        return (Array.isArray(changes.files) ? changes.files : [])
            .map((file) => this.normalizeWorkspaceRelativePath(file.path))
            .filter(Boolean);
    }

    shouldRefreshCurrentDemoForChanges(changes = {}) {
        const prefix = this.getCurrentDemoPathPrefix();
        if (!prefix) return false;
        return this.getChangedWorkspacePaths(changes).some((filePath) => filePath.startsWith(prefix));
    }

    shouldRefreshCurrentPrdForChanges(changes = {}) {
        const prefix = this.getCurrentDemoDocsPrefix();
        if (!prefix) return false;
        return this.getChangedWorkspacePaths(changes).some((filePath) => filePath.startsWith(prefix));
    }

    shouldRefreshProjectCatalogForChanges(changes = {}) {
        return this.getChangedWorkspacePaths(changes).some((filePath) => (
            filePath === 'data/projects.json'
            || filePath.startsWith('src/pages/')
        ));
    }

    scheduleAgentLiveDemoRefresh(changes = {}) {
        if (this.isShareMode) return;
        window.clearTimeout(this._agentLiveDemoRefreshTimer);
        this._agentLiveDemoRefreshTimer = window.setTimeout(() => {
            this._agentLiveDemoRefreshTimer = null;
            this.applyAgentLiveDemoRefresh(changes);
        }, 450);
    }

    async applyAgentLiveDemoRefresh(changes = {}) {
        const refreshCatalog = this.shouldRefreshProjectCatalogForChanges(changes);
        const refreshDemo = this.shouldRefreshCurrentDemoForChanges(changes);
        const refreshPrd = this.shouldRefreshCurrentPrdForChanges(changes);

        try {
            if (refreshCatalog) {
                this._agentLiveProjectRefreshPromise = this.refreshProjectsAfterAgentRun();
                await this._agentLiveProjectRefreshPromise;
            }
            if (refreshDemo) {
                this.refreshCurrentDemo();
            } else if (refreshPrd && this.docDrawerMode === 'prd' && this.annotationDrawerEnabled) {
                this.loadPrdDocument({ force: true });
            }
        } catch (error) {
            console.warn('Failed to apply live demo refresh:', error);
        } finally {
            this._agentLiveProjectRefreshPromise = null;
        }
    }

    getSelectedAnnotationCopy() {
        if (!this.pendingAnnotation) return null;
        const copyTarget = this.getEditableCopyTarget(this.pendingAnnotation.element);
        const originalText = this.getEditableCopyText(copyTarget);
        if (!originalText) return null;
        return {
            selector: copyTarget && copyTarget !== this.pendingAnnotation.element
                ? this.buildElementSelector(copyTarget)
                : this.pendingAnnotation.selector,
            originalText,
            tagName: copyTarget?.tagName || this.pendingAnnotation.meta?.tagName || '',
            id: copyTarget?.id || '',
            className: copyTarget?.className || ''
        };
    }

    normalizeDirectCopyText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    getDirectEditableText(element) {
        const target = this.getEditableCopyTarget(element);
        if (!target) return '';
        return this.getEditableCopyText(target);
    }

    getEditableCopyText(element) {
        return this.getDirectEditableTextOnly(element)
            || this.getMixedInlineEditableText(element);
    }

    getDirectEditableTextOnly(element) {
        if (!element) return '';
        if (element.matches?.('input, textarea, select')) return '';
        if (element.closest?.('svg, canvas, script, style, noscript')) return '';

        const directText = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.nodeValue || '')
            .join(' ');
        const normalizedDirect = this.normalizeDirectCopyText(directText);
        const normalizedAll = this.normalizeDirectCopyText(element.innerText || element.textContent || '');
        if (!normalizedDirect || normalizedDirect !== normalizedAll) return '';
        if (normalizedAll.length > 120) return '';

        const meaningfulChildren = Array.from(element.children || []).filter((child) => {
            const text = this.normalizeDirectCopyText(child.innerText || child.textContent || '');
            if (!text) return false;
            const style = this.mainIframe?.contentWindow?.getComputedStyle(child);
            return !style || (style.display !== 'none' && style.visibility !== 'hidden');
        });
        return meaningfulChildren.length === 0 ? normalizedAll : '';
    }

    getMixedInlineEditableText(element) {
        if (!element) return '';
        if (element.matches?.('input, textarea, select')) return '';
        if (element.closest?.('svg, canvas, script, style, noscript')) return '';

        const normalizedAll = this.normalizeDirectCopyText(element.innerText || element.textContent || '');
        if (!normalizedAll || normalizedAll.length > 120) return '';

        const meaningfulChildren = Array.from(element.children || []).filter((child) => {
            const text = this.normalizeDirectCopyText(child.innerText || child.textContent || '');
            if (!text) return false;
            const style = this.mainIframe?.contentWindow?.getComputedStyle(child);
            return !style || (style.display !== 'none' && style.visibility !== 'hidden');
        });
        if (meaningfulChildren.length === 0 || meaningfulChildren.length > 3) return '';

        const allowedInlineTags = new Set(['SPAN', 'STRONG', 'B', 'EM', 'I', 'SMALL', 'MARK', 'CODE']);
        if (meaningfulChildren.some((child) => !allowedInlineTags.has(child.tagName))) return '';

        const ownText = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.nodeValue || '')
            .join('');
        const hasOwnText = Boolean(this.normalizeDirectCopyText(ownText));
        const childText = meaningfulChildren
            .map((child) => this.normalizeDirectCopyText(child.innerText || child.textContent || ''))
            .filter(Boolean);
        if (!hasOwnText && childText.length < 2) return '';
        if (childText.some((text) => text === normalizedAll)) return '';

        return normalizedAll;
    }

    getEditableCopyTarget(element) {
        if (!element || element.nodeType !== 1) return null;
        if (this.getEditableCopyText(element)) return element;

        const descendants = Array.from(element.querySelectorAll?.('*') || [])
            .filter((child) => this.getEditableCopyText(child));
        const topLevelDescendants = descendants.filter((candidate) => {
            return !descendants.some((other) => other !== candidate && other.contains(candidate));
        });
        if (topLevelDescendants.length === 1) return topLevelDescendants[0];
        if (descendants.length !== 1) return null;
        return descendants[0];
    }

    async syncAnnotationCopyToCode() {
        if (!this.pendingAnnotation || !this.annotationPanel) return;
        const copy = this.getSelectedAnnotationCopy();
        const input = this.annotationCopyPanel?.querySelector('.annotation-copy-panel__input');
        const nextText = String(input?.value || '').trim();
        if (!copy?.originalText) {
            this.showToast('当前元素没有可修改的文本', true);
            return;
        }
        if (!nextText) {
            this.showToast('请输入新文案', true);
            return;
        }
        if (nextText === copy.originalText) {
            this.showToast('文案没有变化', true);
            return;
        }

        try {
            const response = await fetch('http://localhost:8080/api/copy-edits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.activeProjectId,
                    pageId: this.activePageId,
                    version: this.activeVersion,
                    changes: [{
                        selector: copy.selector,
                        originalText: copy.originalText,
                        nextText,
                        tagName: copy.tagName,
                        id: copy.id,
                        className: copy.className,
                        htmlSnippet: this.captureElementContext(copy.selector)?.htmlSnippet || ''
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || '同步文案失败');
            }

            const result = await response.json();
            const item = Array.isArray(result.results) ? result.results[0] : null;
            if (!item || (item.status !== 'updated' && item.status !== 'patched')) {
                console.warn('[copy-edit] Copy edit was not synced:', item || result);
                throw new Error(item?.reason || '没有在代码中找到可修改的文本');
            }

            this.showToast('文案已同步到代码');
            this.clearIframeSelection();
            this.annotationPanel.style.display = 'none';
            this.hideAnnotationLinkTrigger();
            this.hideAnnotationCopyPanel();
            this.pendingAnnotation = null;
            this.refreshCurrentDemo();
        } catch (error) {
            this.showToast(error instanceof Error ? error.message : String(error), true);
        }
    }

    async enterAnnotationMode(source = 'parent') {
        if (this.annotationMode) return;
        await this.setAnnotationMode(true, source);
    }

    async exitAnnotationMode(source = 'parent') {
        if (!this.annotationMode) return;
        await this.setAnnotationMode(false, source);
    }

    async toggleAnnotationMode(source = 'parent') {
        await this.setAnnotationMode(!this.annotationMode, source);
    }

    async setAnnotationMode(enabled, source = 'parent') {
        const btn = document.getElementById('annotatorBtn');
        const shellContainer = document.querySelector('.shell-container');

        this._annotationRightClick = null;
        try {
            this.mainIframe.contentWindow.__readifyAnnotationRightClick = null;
        } catch {}
        this.annotationMode = Boolean(enabled);
        btn.classList.toggle('is-active', this.annotationMode);
        btn.setAttribute('aria-pressed', this.annotationMode ? 'true' : 'false');
        btn.title = this.annotationMode ? '退出标注' : '标注';
        btn.setAttribute('aria-label', btn.title);
        shellContainer.classList.toggle('is-annotating', this.annotationMode);

        if (this.annotationMode) {
            await this.loadAnnotations();
            this.injectInspector();
        } else {
            this.removeInspector();
            this.hideAnnotationHover();
            if (this.annotationPanel) {
                this.annotationPanel.style.display = 'none';
            }
            this.hideAnnotationLinkTrigger();
            this.hideAnnotationLinkPanel();
            this.hideAnnotationCopyPanel();
            this.pendingAnnotation = null;
        }

        this.refreshAnnotationUI();
    }

    readDrawerPreference() {
        try {
            return window.localStorage.getItem(workspaceStorageKey('readify:annotation-drawer-visible')) === '1';
        } catch (error) {
            return false;
        }
    }

    readDocDrawerMode() {
        try {
            const mode = window.localStorage.getItem(workspaceStorageKey('readify:doc-drawer-mode'));
            return ['prd', 'annotations'].includes(mode) ? mode : 'prd';
        } catch (error) {
            return 'prd';
        }
    }

    readPrdDrawerWidth() {
        try {
            const val = window.localStorage.getItem(workspaceStorageKey('readify:prd-drawer-width'));
            return val ? parseInt(val, 10) : null;
        } catch (error) {
            return null;
        }
    }

    persistPrdDrawerWidth() {
        if (this.isShareMode) return;
        try {
            if (this.prdDrawerWidth !== null) {
                window.localStorage.setItem(workspaceStorageKey('readify:prd-drawer-width'), String(this.prdDrawerWidth));
            } else {
                window.localStorage.removeItem(workspaceStorageKey('readify:prd-drawer-width'));
            }
        } catch (error) {
            console.warn('Failed to persist PRD drawer width:', error);
        }
    }

    readAnnotationListScope() {
        try {
            const scope = window.localStorage.getItem(workspaceStorageKey('readify:annotation-list-scope'));
            return scope === 'current' ? 'current' : 'all';
        } catch (error) {
            return 'all';
        }
    }

    readPrdEditorLayout() {
        try {
            const layout = window.localStorage.getItem(workspaceStorageKey('readify:prd-editor-layout'));
            return ['source', 'split', 'preview'].includes(layout) ? layout : 'source';
        } catch (error) {
            return 'source';
        }
    }

    persistDrawerPreference() {
        if (this.isShareMode) return;
        try {
            window.localStorage.setItem(
                workspaceStorageKey('readify:annotation-drawer-visible'),
                this.annotationDrawerEnabled ? '1' : '0'
            );
        } catch (error) {
            console.warn('Failed to persist drawer preference:', error);
        }
    }

    persistDocDrawerMode() {
        if (this.isShareMode) return;
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:doc-drawer-mode'), this.docDrawerMode);
        } catch (error) {
            console.warn('Failed to persist document drawer mode:', error);
        }
    }

    persistAnnotationListScope() {
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:annotation-list-scope'), this.annotationListScope);
        } catch (error) {
            console.warn('Failed to persist annotation list scope:', error);
        }
    }

    persistPrdEditorLayout() {
        try {
            window.localStorage.setItem(workspaceStorageKey('readify:prd-editor-layout'), this.prdEditorLayout);
        } catch (error) {
            console.warn('Failed to persist PRD editor layout:', error);
        }
    }

    setAnnotationListScope(scope) {
        const nextScope = scope === 'all' ? 'all' : 'current';
        if (this.annotationListScope === nextScope) return;

        this.annotationListScope = nextScope;
        this.persistAnnotationListScope();
        this.renderAnnotationDrawer();
    }

    toggleAnnotationDrawer() {
        const drawerVisiblyShown = this.shouldShowDocumentDrawer();
        if (!drawerVisiblyShown && this.agentWorkbenchOpen && !this.canAgentAndDrawerCoexist()) {
            this.annotationDrawerEnabled = true;
            this.persistDrawerPreference();
            this.closeAgentWorkbench();
            this.updateDrawerToggleButton();
            this.refreshAnnotationUI();
            if (this.docDrawerMode === 'prd') {
                this.loadPrdDocument();
            } else if (this.docDrawerMode === 'diagram') {
                this.drawioModule?.switchContext();
            } else if (this.docDrawerMode === 'mindmap') {
                this.mindmapModule?.switchContext();
            }
            return;
        }

        this.annotationDrawerEnabled = !this.annotationDrawerEnabled;
        this.persistDrawerPreference();
        this.updateDrawerToggleButton();
        this.refreshAnnotationUI();
        if (this.annotationDrawerEnabled && this.docDrawerMode === 'prd') {
            this.loadPrdDocument();
        } else if (this.annotationDrawerEnabled && this.docDrawerMode === 'diagram') {
            this.drawioModule?.switchContext();
        } else if (this.annotationDrawerEnabled && this.docDrawerMode === 'mindmap') {
            this.mindmapModule?.switchContext();
        }
    }

    setDocDrawerMode(mode, { open = false, forceReload = false } = {}) {
        this.docDrawerMode = ['prd', 'diagram', 'mindmap', 'annotations'].includes(mode) ? mode : 'annotations';
        if (['prd', 'diagram', 'mindmap'].includes(this.docDrawerMode)) {
            const savedWidth = this.readPrdDrawerWidth();
            if (savedWidth !== null) {
                this.applyPrdDrawerWidth(savedWidth);
            } else {
                this.useDefaultPrdDrawerWidth({ expanded: true });
            }
        }
        this.persistDocDrawerMode();

        if (open && !this.annotationDrawerEnabled) {
            this.annotationDrawerEnabled = true;
            this.persistDrawerPreference();
        }

        this.updateDrawerToggleButton();
        this.updateDocDrawerTabs();
        this.refreshAnnotationUI();

        if (this.docDrawerMode === 'prd') {
            this.loadPrdDocument({ force: forceReload });
        } else if (this.docDrawerMode === 'diagram') {
            this.drawioModule?.switchContext();
        } else if (this.docDrawerMode === 'mindmap') {
            this.mindmapModule?.switchContext();
        }
    }

    openDocumentDrawer(mode = this.docDrawerMode, { forceReload = false, path = '' } = {}) {
        this.docDrawerMode = ['prd', 'diagram', 'mindmap', 'annotations'].includes(mode) ? mode : 'annotations';
        if (['prd', 'diagram', 'mindmap'].includes(this.docDrawerMode)) {
            const savedWidth = this.readPrdDrawerWidth();
            if (savedWidth !== null) {
                this.applyPrdDrawerWidth(savedWidth);
            } else {
                this.useDefaultPrdDrawerWidth({ expanded: true });
            }
        }
        this.annotationDrawerEnabled = true;
        this.persistDocDrawerMode();
        this.persistDrawerPreference();
        this.updateDrawerToggleButton();
        this.updateDocDrawerTabs();

        if (this.agentWorkbenchOpen && !this.canAgentAndDrawerCoexist()) {
            this.closeAgentWorkbench();
        } else {
            this.refreshAnnotationUI();
        }

        if (this.docDrawerMode === 'prd') {
            this.loadPrdDocument({ force: forceReload, path });
        } else if (this.docDrawerMode === 'diagram') {
            this.drawioModule?.switchContext(path);
        } else if (this.docDrawerMode === 'mindmap') {
            this.mindmapModule?.switchContext(path);
        }
    }

    async openEmbeddedDiagram(path = '') {
        if (!path || this.isShareMode) return;
        const body = this.annotationDrawerBody;
        this.diagramEditorReturnState = {
            fullscreen: Boolean(this.prdDrawerFullscreen),
            expanded: Boolean(this.docDrawerExpanded),
            width: this.prdDrawerWidth,
            scrollTop: body?.scrollTop || 0
        };
        this.docDrawerMode = 'diagram';
        this.annotationDrawerEnabled = true;
        this.prdDrawerFullscreen = true;
        this.docDrawerExpanded = true;
        this.updateDrawerToggleButton();
        this.updateDocDrawerTabs();
        this.refreshAnnotationUI();
        await this.drawioModule?.switchContext(path);
    }

    async exitEmbeddedDiagram() {
        if (!this.diagramEditorReturnState) return;
        // 有未保存修改时先拦截确认，避免心血丢失。
        if (this.drawioModule && !(await this.drawioModule.canExit())) return;
        const restore = this.diagramEditorReturnState;
        await this.drawioModule?.flushSave();
        this.drawioModule?.invalidatePreviewCache();
        this.diagramEditorReturnState = null;
        window.setTimeout(() => {
            this.docDrawerMode = 'prd';
            this.prdDrawerFullscreen = restore.fullscreen;
            this.docDrawerExpanded = restore.expanded;
            this.prdDrawerWidth = restore.width;
            this.persistDocDrawerMode();
            this.updateDrawerToggleButton();
            this.updateDocDrawerTabs();
            this.refreshAnnotationUI();
            this.prdModule?.render();
            window.setTimeout(() => {
                if (this.annotationDrawerBody) this.annotationDrawerBody.scrollTop = restore.scrollTop;
            }, 0);
        }, 120);
    }

    async openEmbeddedMindmap(path = '') {
        if (!path || this.isShareMode) return;
        const body = this.annotationDrawerBody;
        this.mindmapEditorReturnState = {
            fullscreen: Boolean(this.prdDrawerFullscreen),
            expanded: Boolean(this.docDrawerExpanded),
            width: this.prdDrawerWidth,
            scrollTop: body?.scrollTop || 0
        };
        this.docDrawerMode = 'mindmap';
        this.annotationDrawerEnabled = true;
        this.prdDrawerFullscreen = true;
        this.docDrawerExpanded = true;
        this.updateDrawerToggleButton();
        this.updateDocDrawerTabs();
        this.refreshAnnotationUI();
        await this.mindmapModule?.switchContext(path);
    }

    async exitEmbeddedMindmap() {
        if (!this.mindmapEditorReturnState) return;
        const restore = this.mindmapEditorReturnState;
        this.mindmapEditorReturnState = null;
        // Await the final save so the editor iframe is not torn down before its
        // last edit (including text still being typed in a node) is persisted.
        await this.mindmapModule?.flushSave();
        this.mindmapModule?.invalidatePreviewCache();
        window.setTimeout(() => {
            this.docDrawerMode = 'prd';
            this.prdDrawerFullscreen = restore.fullscreen;
            this.docDrawerExpanded = restore.expanded;
            this.prdDrawerWidth = restore.width;
            this.persistDocDrawerMode();
            this.updateDrawerToggleButton();
            this.updateDocDrawerTabs();
            this.refreshAnnotationUI();
            this.prdModule?.render();
            window.setTimeout(() => {
                if (this.annotationDrawerBody) this.annotationDrawerBody.scrollTop = restore.scrollTop;
            }, 0);
        }, 120);
    }

    updateDocDrawerTabs() {
        this.docTabs.forEach((tab) => {
            const visibleMode = (this.docDrawerMode === 'diagram' || this.docDrawerMode === 'mindmap') ? 'prd' : this.docDrawerMode;
            const isActive = tab.dataset.docTab === visibleMode;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    updateDrawerToggleButton() {
        if (!this.docVisibilityBtn) return;
        const visible = this.shouldShowDocumentDrawer();
        this.docVisibilityBtn.classList.toggle('is-active', visible);
        this.docVisibilityBtn.title = visible
            ? '隐藏文档面板'
            : '显示文档面板';
        this.docVisibilityBtn.setAttribute('aria-label', this.docVisibilityBtn.title);
    }

    injectInspector() {
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc) {
            this.showToast('无法访问 iframe 内容，请确保通过 Bridge 服务访问', true);
            return;
        }
        if (!iframeDoc.head || !iframeDoc.body) {
            window.setTimeout(() => {
                if (this.annotationMode) this.injectInspector();
            }, 120);
            return;
        }

        this.removeInspector();

        const style = iframeDoc.createElement('style');
        style.id = '__readify_inspector_css';
        style.textContent = `
            body {
                cursor: crosshair !important;
            }
            [data-readify-hover] {
                cursor: crosshair !important;
            }
            .__readify_selected {
                outline: 2px solid #6366f1 !important;
                outline-offset: 2px !important;
                background-color: rgba(99, 102, 241, 0.10) !important;
            }
            .__readify_skipped {
                outline: 2px dashed rgba(99, 102, 241, 0.3) !important;
                outline-offset: 2px !important;
                opacity: 0.3 !important;
                pointer-events: none !important;
                cursor: default !important;
            }
        `;
        iframeDoc.head.appendChild(style);

        const script = iframeDoc.createElement('script');
        script.id = '__readify_inspector_script';
        script.textContent = `(function() {
            var inspectorAbort = new AbortController();
            var lastHovered = null;
            var lastHoverSelector = '';
            var hoverRaf = 0;
            var pendingHoverTarget = null;
            var forcedHoverTarget = null;
            var forcedHoverPoint = null;

            function escapeIdentifier(value) {
                if (window.CSS && typeof window.CSS.escape === 'function') {
                    return window.CSS.escape(value);
                }
                return String(value).replace(/[^a-zA-Z0-9_-]/g, function(char) {
                    return '\\\\' + char;
                });
            }

            function escapeAttribute(value) {
                return String(value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
            }

            function isUnique(selector) {
                try {
                    return document.querySelectorAll(selector).length === 1;
                } catch (error) {
                    return false;
                }
            }

            function getStableClasses(el) {
                return Array.from(el.classList || []).filter(function(className) {
                    return className && className.indexOf('__readify') !== 0;
                }).slice(0, 3);
            }

            function getStableClassName(el) {
                return getStableClasses(el).join(' ');
            }

            function getIndexWithinType(el) {
                var index = 1;
                var current = el;
                while ((current = current.previousElementSibling)) {
                    if (current.tagName === el.tagName) index += 1;
                }
                return index;
            }

            function buildSegment(el) {
                var tag = el.tagName.toLowerCase();
                var classes = getStableClasses(el).map(function(className) {
                    return '.' + escapeIdentifier(className);
                }).join('');
                return tag + classes + ':nth-of-type(' + getIndexWithinType(el) + ')';
            }

            function buildSelector(el) {
                if (!el || el.nodeType !== 1) return '';

                if (el.id) {
                    var idSelector = '#' + escapeIdentifier(el.id);
                    if (isUnique(idSelector)) return idSelector;
                }

                var attrNames = ['data-testid', 'data-test', 'data-qa', 'name', 'aria-label', 'title'];
                var tag = el.tagName.toLowerCase();
                for (var i = 0; i < attrNames.length; i += 1) {
                    var attrName = attrNames[i];
                    var attrValue = el.getAttribute(attrName);
                    if (!attrValue) continue;
                    var attrSelector = tag + '[' + attrName + '="' + escapeAttribute(attrValue) + '"]';
                    if (isUnique(attrSelector)) return attrSelector;
                }

                var parts = [];
                var current = el;
                while (current && current.nodeType === 1 && current !== document.documentElement) {
                    parts.unshift(buildSegment(current));
                    var selector = parts.join(' > ');
                    if (isUnique(selector)) return selector;

                    current = current.parentElement;
                    if (current === document.body) {
                        parts.unshift('body');
                        selector = parts.join(' > ');
                        if (isUnique(selector)) return selector;
                        break;
                    }
                }

                return parts.join(' > ');
            }

            function isInspectable(el) {
                if (!el || el.nodeType !== 1) return false;
                if (el === document.body || el === document.documentElement || el.tagName === 'HTML') return false;

                var current = el;
                while (current && current.nodeType === 1 && current !== document.documentElement) {
                    var style = window.getComputedStyle(current);
                    if (
                        style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        style.pointerEvents === 'none' ||
                        Number(style.opacity) <= 0.01 ||
                        current.hidden ||
                        current.getAttribute('aria-hidden') === 'true'
                    ) {
                        return false;
                    }
                    current = current.parentElement;
                }

                var rect = el.getBoundingClientRect();
                return rect.width > 1 && rect.height > 1;
            }

            function hasDataAttribute(el) {
                if (!el || !el.attributes) return false;
                for (var i = 0; i < el.attributes.length; i += 1) {
                    if (el.attributes[i].name.indexOf('data-') === 0) return true;
                }
                return false;
            }

            function isSemanticTarget(el) {
                if (!el || el.nodeType !== 1) return false;
                var tag = el.tagName.toLowerCase();
                if (['button', 'a', 'input', 'textarea', 'select', 'label', 'summary', 'option'].indexOf(tag) >= 0) {
                    return true;
                }

                var role = (el.getAttribute('role') || '').toLowerCase();
                if (/^(button|link|tab|switch|checkbox|radio|menuitem|option|slider|textbox|combobox|listbox)$/.test(role)) {
                    return true;
                }

                var tabindex = el.getAttribute('tabindex');
                if (tabindex !== null && tabindex !== '-1') return true;
                if (el.isContentEditable) return true;
                if (typeof el.onclick === 'function') return true;
                return hasDataAttribute(el);
            }

            function getVisibleRect(el) {
                if (!el || !isInspectable(el)) return null;
                var rect = el.getBoundingClientRect();
                if (rect.width <= 1 || rect.height <= 1) return null;
                if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
                    return null;
                }
                return rect;
            }

            function isDirectInteractiveChild(parent, child) {
                var current = child.parentElement;
                while (current && current !== parent) {
                    if (isSemanticTarget(current)) return false;
                    current = current.parentElement;
                }
                return current === parent;
            }

            function getCompositeInteractiveChildren(el) {
                if (!el || el.nodeType !== 1) return [];
                return Array.from(el.querySelectorAll('*'))
                    .filter(function(child) {
                        return child !== el &&
                            isDirectInteractiveChild(el, child) &&
                            isSemanticTarget(child) &&
                            Boolean(getVisibleRect(child));
                    });
            }

            function hasCompositeControlHint(el) {
                if (!el || el.nodeType !== 1) return false;
                var role = (el.getAttribute('role') || '').toLowerCase();
                if (/^(group|radiogroup|tablist|toolbar|menubar|menu|listbox)$/.test(role)) return true;
                if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;

                var classText = typeof el.className === 'string' ? el.className : '';
                return /(?:^|[-_\\s])(?:stepper|segment|segmented|group|controls?|toolbar|tabs?|tablist|switcher|toggle|radio|checkbox|pagination|counter|picker|palette|swatches?|selector|choices?|options?)(?:$|[-_\\s])/i.test(classText);
            }

            function getCompositeControlScore(el) {
                var rect = getVisibleRect(el);
                if (!rect) return 0;

                var viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
                var areaRatio = (rect.width * rect.height) / viewportArea;
                if (areaRatio > 0.28) return 0;

                var children = getCompositeInteractiveChildren(el);
                if (children.length < 2) return 0;

                var score = 8 + Math.min(children.length, 5);
                if (hasCompositeControlHint(el)) score += 8;
                if (rect.width <= 360 && rect.height <= 120) score += 3;
                if (rect.height <= 64) score += 2;
                if (isSemanticTarget(el)) score += 2;
                return score;
            }

            function containsPoint(el, x, y) {
                var rect = getVisibleRect(el);
                if (!rect) return false;
                return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            }

            function pushUnique(list, el) {
                if (!el || list.indexOf(el) >= 0) return;
                list.push(el);
            }

            function getPointSelectionCandidates(x, y, rawTarget) {
                var candidates = [];
                var seen = [];
                var pointElements = [];

                if (typeof document.elementsFromPoint === 'function') {
                    pointElements = document.elementsFromPoint(x, y);
                }
                if (rawTarget) pointElements.unshift(rawTarget);

                pointElements.forEach(function(pointElement) {
                    var chain = [];
                    var current = pointElement && pointElement.nodeType === 3 ? pointElement.parentElement : pointElement;
                    while (current && current !== document.body && current !== document.documentElement) {
                        if (seen.indexOf(current) < 0 && containsPoint(current, x, y)) {
                            chain.push(current);
                            seen.push(current);
                        }
                        current = current.parentElement;
                    }

                    chain.forEach(function(el) {
                        if (isSemanticTarget(el) || (!isContainerLike(el) && getVisibleRect(el))) {
                            pushUnique(candidates, el);
                        }
                    });

                    chain.forEach(function(el) {
                        if (getCompositeControlScore(el) > 0) {
                            pushUnique(candidates, el);
                        }
                    });
                });

                return candidates;
            }

            function getNextPointCandidate(x, y, rawTarget, currentTarget) {
                var candidates = getPointSelectionCandidates(x, y, rawTarget);
                if (candidates.length === 0) return null;
                if (!currentTarget) return candidates[0];

                var currentIndex = candidates.indexOf(currentTarget);
                if (currentIndex < 0) {
                    for (var i = 0; i < candidates.length; i += 1) {
                        if (candidates[i].contains && candidates[i].contains(currentTarget)) {
                            currentIndex = i;
                            break;
                        }
                    }
                }

                if (currentIndex < 0) return candidates[0];

                var currentIsComposite = getCompositeControlScore(currentTarget) > 0;
                if (currentIsComposite) {
                    for (var before = 0; before < currentIndex; before += 1) {
                        if (currentTarget.contains(candidates[before])) return candidates[before];
                    }
                }

                for (var after = currentIndex + 1; after < candidates.length; after += 1) {
                    if (candidates[after].contains(currentTarget) || currentTarget.contains(candidates[after])) {
                        return candidates[after];
                    }
                }

                return candidates[(currentIndex + 1) % candidates.length];
            }

            function isContainerLike(el) {
                if (!el || el.nodeType !== 1) return true;
                var rect = el.getBoundingClientRect();
                var childCount = el.children ? el.children.length : 0;
                var viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
                var areaRatio = (rect.width * rect.height) / viewportArea;
                return childCount > 1 && areaRatio > 0.35;
            }

            function normalizeCopyText(value) {
                return String(value || '').replace(/\\s+/g, ' ').trim();
            }

            function getDirectCopyText(el) {
                if (!el || el.nodeType !== 1) return '';
                if (el.matches && el.matches('input, textarea, select, svg, canvas, script, style, noscript')) return '';
                var directText = Array.from(el.childNodes || [])
                    .filter(function(node) { return node.nodeType === 3; })
                    .map(function(node) { return node.nodeValue || ''; })
                    .join(' ');
                var normalizedDirect = normalizeCopyText(directText);
                var normalizedAll = normalizeCopyText(el.innerText || el.textContent || '');
                if (!normalizedDirect || normalizedDirect !== normalizedAll || normalizedAll.length > 120) return '';

                var meaningfulChildren = Array.from(el.children || []).filter(function(child) {
                    var text = normalizeCopyText(child.innerText || child.textContent || '');
                    if (!text) return false;
                    var style = window.getComputedStyle(child);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
                return meaningfulChildren.length === 0 ? normalizedAll : '';
            }

            function isTextLeafInsideControl(el) {
                if (!el || el.nodeType !== 1 || !getVisibleRect(el)) return false;
                if (!getDirectCopyText(el)) return false;
                var tag = el.tagName.toLowerCase();
                if (['svg', 'path', 'img', 'picture', 'video', 'canvas', 'input', 'textarea', 'select'].indexOf(tag) >= 0) {
                    return false;
                }

                var parent = el.parentElement;
                while (parent && parent !== document.body && parent !== document.documentElement) {
                    if (isSemanticTarget(parent) || getCompositeControlScore(parent) > 0) return true;
                    parent = parent.parentElement;
                }
                return false;
            }

            function getPreferredElement(target) {
                if (!target) return null;
                if (target.nodeType === 3) target = target.parentElement;
                if (!target || target.nodeType !== 1) return null;

                if (isTextLeafInsideControl(target)) {
                    return target;
                }

                var bestComposite = null;
                var bestCompositeScore = 0;
                var current = target;
                while (current && current !== document.body && current !== document.documentElement) {
                    var compositeScore = getCompositeControlScore(current);
                    if (compositeScore > bestCompositeScore) {
                        bestComposite = current;
                        bestCompositeScore = compositeScore;
                    }
                    current = current.parentElement;
                }

                if (bestComposite && bestCompositeScore >= 12) {
                    return bestComposite;
                }

                current = target;
                while (current && current !== document.body && current !== document.documentElement) {
                    if (getVisibleRect(current) && isSemanticTarget(current)) {
                        return current;
                    }
                    current = current.parentElement;
                }

                current = target;
                while (current && current !== document.body && current !== document.documentElement) {
                    if (getVisibleRect(current)) {
                        var rect = current.getBoundingClientRect();
                        if (rect.width >= 8 && rect.height >= 8 && !isContainerLike(current)) {
                            return current;
                        }
                    }
                    current = current.parentElement;
                }

                return getVisibleRect(target) && !isContainerLike(target) ? target : null;
            }

            function clearHover() {
                if (lastHovered) lastHovered.removeAttribute('data-readify-hover');
                lastHovered = null;
                lastHoverSelector = '';
                forcedHoverTarget = null;
                forcedHoverPoint = null;
                window.parent.postMessage({ type: 'readify:element-hover-clear' }, '*');
            }

            function emitHover(el) {
                if (!window.__readifyInspecting || !isInspectable(el)) return;
                var selector = buildSelector(el);
                if (!selector) return;
                var rect = el.getBoundingClientRect();

                if (lastHovered !== el) {
                    if (lastHovered) lastHovered.removeAttribute('data-readify-hover');
                    el.setAttribute('data-readify-hover', '');
                    lastHovered = el;
                }

                if (
                    selector === lastHoverSelector &&
                    Math.abs((lastHovered.__readifyLastLeft || 0) - rect.left) < 0.5 &&
                    Math.abs((lastHovered.__readifyLastTop || 0) - rect.top) < 0.5 &&
                    Math.abs((lastHovered.__readifyLastWidth || 0) - rect.width) < 0.5 &&
                    Math.abs((lastHovered.__readifyLastHeight || 0) - rect.height) < 0.5
                ) {
                    return;
                }

                lastHoverSelector = selector;
                lastHovered.__readifyLastLeft = rect.left;
                lastHovered.__readifyLastTop = rect.top;
                lastHovered.__readifyLastWidth = rect.width;
                lastHovered.__readifyLastHeight = rect.height;

                window.parent.postMessage({
                    type: 'readify:element-hover',
                    selector: selector,
                    tagName: el.tagName,
                    textContent: (el.textContent || '').trim().substring(0, 80),
                    rect: {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight
                    }
                }, '*');
            }

            document.addEventListener('pointermove', function(e) {
                if (!window.__readifyInspecting) return;
                if (
                    forcedHoverTarget &&
                    forcedHoverPoint &&
                    Math.abs(e.clientX - forcedHoverPoint.x) <= 4 &&
                    Math.abs(e.clientY - forcedHoverPoint.y) <= 4 &&
                    containsPoint(forcedHoverTarget, e.clientX, e.clientY)
                ) {
                    pendingHoverTarget = forcedHoverTarget;
                } else {
                    forcedHoverTarget = null;
                    forcedHoverPoint = null;
                    pendingHoverTarget = e.shiftKey
                        ? (e.target.nodeType === 3 ? e.target.parentElement : e.target)
                        : getPreferredElement(e.target);
                }
                if (!pendingHoverTarget) {
                    clearHover();
                    return;
                }
                if (hoverRaf) return;
                hoverRaf = window.requestAnimationFrame(function() {
                    hoverRaf = 0;
                    emitHover(pendingHoverTarget);
                });
            }, { capture: true, signal: inspectorAbort.signal });

            document.addEventListener('mouseleave', function() {
                if (!window.__readifyInspecting) return;
                clearHover();
            }, { capture: true, signal: inspectorAbort.signal });

            function selectElement(el) {
                var prev = document.querySelector('.__readify_selected');
                var rect = el.getBoundingClientRect();
                if (prev) prev.classList.remove('__readify_selected');
                el.classList.add('__readify_selected');
                window.parent.postMessage({
                    type: 'readify:element-selected',
                    selector: buildSelector(el),
                    tagName: el.tagName,
                    textContent: (el.textContent || '').trim().substring(0, 100),
                    className: getStableClassName(el),
                    id: el.id || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    title: el.getAttribute('title') || '',
                    rect: {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight
                    }
                }, '*');
            }

            document.addEventListener('click', function(e) {
                if (!window.__readifyInspecting) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                var target = forcedHoverTarget && containsPoint(forcedHoverTarget, e.clientX, e.clientY)
                    ? forcedHoverTarget
                    : (e.shiftKey ? (e.target.nodeType === 3 ? e.target.parentElement : e.target) : getPreferredElement(e.target));
                if (!target) return;

                selectElement(target);
            }, { capture: true, signal: inspectorAbort.signal });

            window.__readifyInspecting = true;
            window.__readifyInspectorCleanup = function() {
                inspectorAbort.abort();
                clearHover();
                window.__readifyInspecting = false;
                window.__readifyInspectorCleanup = null;
            };
        })();`;
        iframeDoc.body.appendChild(script);

        try {
            this.mainIframe.contentWindow.__readifyInspecting = true;
        } catch (error) {
            console.warn('Failed to enable iframe inspection:', error);
        }
    }

    removeInspector() {
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc) return;

        try {
            this.mainIframe.contentWindow.__readifyInspectorCleanup?.();
        } catch (error) {
            console.warn('Failed to clean up iframe inspection listeners:', error);
        }

        const css = iframeDoc.getElementById('__readify_inspector_css');
        if (css) css.remove();

        const script = iframeDoc.getElementById('__readify_inspector_script');
        if (script) script.remove();

        iframeDoc.querySelectorAll('.__readify_selected').forEach((el) => {
            el.classList.remove('__readify_selected');
        });
        iframeDoc.querySelectorAll('.__readify_skipped').forEach((el) => {
            el.classList.remove('__readify_skipped');
        });
        iframeDoc.querySelectorAll('[data-readify-hover]').forEach((el) => {
            el.removeAttribute('data-readify-hover');
        });
        this.hideAnnotationHover();

        try {
            this.mainIframe.contentWindow.__readifyInspecting = false;
        } catch (error) {
            console.warn('Failed to disable iframe inspection:', error);
        }
    }

    async loadAnnotations() {
        if (!this.activeProjectId || !this.activePageId || !this.activeVersion) {
            this.currentAnnotations = [];
            return [];
        }
        if (this.isShareMode && this.shareConfig.mode === 'folder') {
            const meta = this.getActiveFolderSharePageMeta(this.activePageId, this.activeVersion);
            this.currentAnnotations = meta?.annotations ? [...meta.annotations] : [];
            return this.currentAnnotations;
        }
        if (this.isShareMode && this.shareConfig.annotations) {
            this.currentAnnotations = this.shareConfig.annotations;
            return this.currentAnnotations;
        }
        const url = `/src/pages/${this.activeProjectId}/${this.activePageId}/${this.activeVersion}/annotations.json?t=${Date.now()}`;
        try {
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                this.currentAnnotations = Array.isArray(data) ? data : [];
            } else {
                this.currentAnnotations = [];
            }
        } catch {
            this.currentAnnotations = [];
        }
        return this.currentAnnotations;
    }

    async saveAnnotations(successMessage = '注解已保存') {
        try {
            const resp = await fetch('http://localhost:8080/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.activeProjectId,
                    pageId: this.activePageId,
                    version: this.activeVersion,
                    annotations: this.currentAnnotations
                })
            });
            if (resp.ok) {
                this.showToast(successMessage);
            } else {
                this.showToast('保存失败', true);
            }
        } catch (err) {
            this.showToast('无法连接 Bridge 服务，请确保已启动服务', true);
        }
    }

    getDefaultPrdDocumentState() {
        return this.prdModule?.manager?.getDefaultState() || {
            status: 'idle',
            path: '',
            content: '',
            draftContent: '',
            editMode: false,
            dirty: false,
            saving: false,
            saveError: '',
            documents: []
        };
    }

    async loadPrdDocument({ force = false, path = '' } = {}) {
        const manager = this.prdModule?.manager;
        const currentPath = manager?.state?.path;
        
        const isSameContext = manager && manager.host.activePageId === this.activePageId && manager.host.activeVersion === this.activeVersion;
        const isLoaded = manager && ['ready', 'empty', 'error'].includes(manager.state.status);
        
        if (isSameContext && isLoaded && !force && (!path || path === currentPath)) {
            this.prdModule?.render();
            return;
        }
        
        await this.prdModule?.switchContext(this.activePageId, this.activeVersion, path);
    }

    async savePrdDocument() {
        await this.prdModule?.save();
    }

    async cancelPrdEditing() {
        await this.prdModule?.cancel();
    }

    enterPrdEditMode(clickedText = '', targetElement = null) {
        this.prdModule?.enterEditMode(clickedText, targetElement);
    }

    createEmptyPrdDocument() {
        this.prdModule?.manager?.createEmptyDraft();
    }

    confirmPrdDiscardIfDirty() {
        return this.prdModule?.canNavigate() ?? Promise.resolve(true);
    }

    renderPrdDrawer() {
        this.prdModule?.render();
    }

    getPrdFileName(path) {
        return this.prdModule?.manager?.getPrdFileName(path) || '';
    }

    getPrdDocumentLabel(path) {
        return this.prdModule?.manager?.getPrdDocumentLabel(path) || '';
    }

    getPrdDraftContent(state = this.prdDocument) {
        return this.prdModule?.renderer?.getPrdDraftContent(state) || '';
    }

    escapeHtml(str) {
        return this.prdModule?.renderer?.escapeHtml(str) || String(str || '');
    }

    getPrdDocumentUrl(path) {
        return this.prdModule?.manager?.getPrdDocumentUrl(path) || '';
    }

    resetPrdDocumentState() {
        this.prdModule?.manager?.resetState();
    }

    getPrdRelativePath() {
        return null;
    }

    getPageVersionDirectoryPath(pageId = this.activePageId, version = this.activeVersion) {
        if (!pageId || !version) return '';
        return `/src/pages/${this.activeProjectId}/${pageId}/${version}`;
    }

    async insertPrototypeScreenshotAtCursor(textarea = this.annotationDrawerBody?.querySelector('.prd-editor-textarea')) {
        if (!textarea || this.prdScreenshotSaving) return;

        this.prdScreenshotSaving = true;
        this.showToast('正在生成原型截图...');

        try {
            const filename = `prototype-shot-${Date.now()}`;
            
            // Serialize iframe live DOM state
            let htmlContent = null;
            try {
                const iframeDoc = this.mainIframe?.contentDocument || this.mainIframe?.contentWindow?.document;
                if (iframeDoc) {
                    const cloneDoc = iframeDoc.documentElement.cloneNode(true);
                    
                    // Sync active input values to cloned DOM attributes so they render in Playwright
                    const liveInputs = iframeDoc.querySelectorAll('input, textarea, select');
                    const clonedInputs = cloneDoc.querySelectorAll('input, textarea, select');
                    for (let i = 0; i < liveInputs.length; i++) {
                        const live = liveInputs[i];
                        const cloned = clonedInputs[i];
                        if (!cloned) continue;

                        if (live.tagName === 'INPUT' && (live.type === 'checkbox' || live.type === 'radio')) {
                            if (live.checked) {
                                cloned.setAttribute('checked', 'checked');
                            } else {
                                cloned.removeAttribute('checked');
                            }
                        } else if (live.tagName === 'TEXTAREA') {
                            cloned.textContent = live.value;
                            cloned.setAttribute('value', live.value);
                        } else if (live.tagName === 'SELECT') {
                            const selectedOption = cloned.options[live.selectedIndex];
                            if (selectedOption) {
                                selectedOption.setAttribute('selected', 'selected');
                            }
                        } else {
                            cloned.setAttribute('value', live.value);
                        }
                    }

                    // Sync scroll states
                    const scrollStates = [];
                    const liveScrollables = iframeDoc.querySelectorAll('*');
                    const clonedScrollables = cloneDoc.querySelectorAll('*');
                    for (let i = 0; i < liveScrollables.length; i++) {
                        const live = liveScrollables[i];
                        if (live.scrollTop > 0 || live.scrollLeft > 0) {
                            scrollStates.push({
                                index: i,
                                top: live.scrollTop,
                                left: live.scrollLeft
                            });
                        }
                    }

                    if (scrollStates.length > 0) {
                        const restoreScript = iframeDoc.createElement('script');
                        restoreScript.setAttribute('data-keep', 'true');
                        restoreScript.textContent = `
                            document.addEventListener('DOMContentLoaded', () => {
                                const allElements = document.querySelectorAll('*');
                                const states = ${JSON.stringify(scrollStates)};
                                states.forEach(state => {
                                    const el = allElements[state.index];
                                    if (el) {
                                        el.scrollTop = state.top;
                                        el.scrollLeft = state.left;
                                    }
                                });
                            });
                        `;
                        cloneDoc.querySelector('body')?.appendChild(restoreScript);
                    }

                    // Remove all original scripts to prevent re-executing and resetting state in Playwright
                    cloneDoc.querySelectorAll('script').forEach((script) => {
                        if (script.getAttribute('data-keep') !== 'true') {
                            script.remove();
                        }
                    });

                    // Export the business state without preview-only scaling.
                    cloneDoc.removeAttribute('data-prota-frame-fit');
                    const fitStyle = cloneDoc.querySelector('#__prota_frame_fit');
                    if (fitStyle) fitStyle.textContent = '';
                    cloneDoc.querySelectorAll('[style]').forEach((element) => {
                        ['--prota-frame-scale', '--prota-phone-center', '--prota-tools-left']
                            .forEach((property) => element.style.removeProperty(property));
                    });
                    htmlContent = '<!DOCTYPE html>\n' + cloneDoc.outerHTML;
                }
            } catch (err) {
                console.warn('Failed to serialize dynamic iframe DOM:', err);
            }

            let response = null;
            let callSuccess = false;
            try {
                response = await fetch('http://localhost:8080/api/capture-screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: this.activeProjectId,
                        pageId: this.activePageId,
                        version: this.activeVersion,
                        filename: filename,
                        htmlContent: htmlContent
                    })
                });
                if (response && response.ok) {
                    callSuccess = true;
                }
            } catch (err) {
                console.warn('Failed to call api/capture-screenshot, using client-side fallback:', err);
            }

            if (callSuccess) {
                const result = await response.json();
                const imagePath = result.markdownPath || result.path;
                if (!imagePath) throw new Error('截图保存失败：缺少图片路径');

                this.prdModule?.replaceSelection?.(`\n![当前原型截图](${imagePath})\n`, textarea);
                this.showToast('已成功插入高保真内屏截图');
            } else {
                console.warn('Backend Playwright service is not available (skill might be uninstalled or failed). Falling back to browser-native share capture.');
                
                if (!navigator.mediaDevices?.getDisplayMedia) {
                    throw new Error('本地 Playwright 截图服务不可用，且当前浏览器不支持屏幕共享截图。');
                }

                this.showToast('本地截图服务不可用，已切换为浏览器屏幕共享模式...', false);
                
                let stream = null;
                try {
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: { displaySurface: 'browser' },
                        audio: false,
                        preferCurrentTab: true
                    });
                    const dataUrl = await this.capturePrototypeScreenshotDataUrl(stream);
                    const saveResponse = await fetch('http://localhost:8080/api/prd-asset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId: this.activeProjectId,
                            pageId: this.activePageId,
                            version: this.activeVersion,
                            prdPath: this.prdModule?.manager?.state?.path || '',
                            filename: `${filename}.png`,
                            contentType: 'image/png',
                            dataUrl
                        })
                    });

                    if (!saveResponse.ok) {
                        throw new Error(await saveResponse.text() || '截图保存失败');
                    }

                    const result = await saveResponse.json();
                    const imagePath = result.markdownPath || result.path;
                    if (!imagePath) throw new Error('截图保存失败：缺少图片路径');

                    this.prdModule?.replaceSelection?.(`\n![当前原型截图](${imagePath})\n`, textarea);
                    this.showToast('已成功通过屏幕共享插入截图');
                } catch (error) {
                    if (error?.name === 'NotAllowedError') {
                        this.showToast('截图已取消', true);
                    } else {
                        throw error;
                    }
                } finally {
                    stream?.getTracks?.().forEach((track) => track.stop());
                }
            }
        } catch (error) {
            this.showToast(error instanceof Error ? error.message : '截图插入失败', true);
        } finally {
            this.prdScreenshotSaving = false;
        }
    }

    async capturePrototypeScreenshotDataUrl(stream) {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        if (!video.videoWidth || !video.videoHeight) {
            await new Promise((resolve) => {
                video.onloadedmetadata = resolve;
            });
        }

        const iframeRect = this.mainIframe.getBoundingClientRect();
        const iframeDoc = this.mainIframe.contentDocument || this.mainIframe.contentWindow?.document;
        const phoneScreen = iframeDoc?.querySelector('.phone-screen') || iframeDoc?.body;
        
        let tempStyle = null;
        if (iframeDoc) {
            tempStyle = iframeDoc.createElement('style');
            tempStyle.textContent = `
                .phone-shell, html[data-prota-frame-fit] .phone-shell {
                    background: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .phone-screen, html[data-prota-frame-fit] .phone-screen {
                    border-radius: 0 !important;
                }
            `;
            iframeDoc.head.appendChild(tempStyle);
            
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }

        let targetRect = iframeRect;
        if (phoneScreen) {
            const screenRect = phoneScreen.getBoundingClientRect();
            targetRect = {
                left: iframeRect.left + screenRect.left,
                top: iframeRect.top + screenRect.top,
                width: screenRect.width,
                height: screenRect.height
            };
        }

        const scaleX = video.videoWidth / window.innerWidth;
        const scaleY = video.videoHeight / window.innerHeight;
        
        const inset = 1;
        const sourceX = Math.max(0, Math.round((targetRect.left + inset) * scaleX));
        const sourceY = Math.max(0, Math.round((targetRect.top + inset) * scaleY));
        const sourceWidth = Math.min(video.videoWidth - sourceX, Math.round((targetRect.width - inset * 2) * scaleX));
        const sourceHeight = Math.min(video.videoHeight - sourceY, Math.round((targetRect.height - inset * 2) * scaleY));

        if (sourceWidth <= 0 || sourceHeight <= 0) {
            if (tempStyle) tempStyle.remove();
            throw new Error('无法定位当前原型区域');
        }

        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        
        if (tempStyle) {
            tempStyle.remove();
        }

        return canvas.toDataURL('image/png');
    }


    refreshAnnotationUI() {
        this.syncAnnotationObservers();
        this.updateDrawerToggleButton();

        if (!this.shouldShowInteractionDocs()) {
            this.visibleAnnotations = [];
            this.renderAnnotationDrawer();
            this.renderAnnotationMarkers();
            return;
        }

        this.visibleAnnotations = this.collectVisibleAnnotations();
        this.renderAnnotationDrawer();
        this.renderAnnotationMarkers();
    }

    getCssVariable(name, fallback) {
        const val = getComputedStyle(document.documentElement).getPropertyValue(name);
        if (!val) return fallback;
        const parsed = parseFloat(val);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    canAgentAndDrawerCoexist() {
        const agentMinWidth = this.getCssVariable('--agent-panel-min-width', 360);
        const viewportMinWidth = this.getCssVariable('--viewport-min-width', 440);

        let docMinWidth = this.getCssVariable('--prd-drawer-min-width', 320);
        if (this.docDrawerMode === 'annotations') {
            docMinWidth = this.getCssVariable('--annotation-drawer-width', 360);
        }

        const minRequiredWidth = agentMinWidth + docMinWidth + viewportMinWidth;
        return window.innerWidth >= minRequiredWidth;
    }

    shouldShowInteractionDocs() {
        return this.shouldShowDocumentDrawer() && this.docDrawerMode === 'annotations';
    }

    shouldShowDocumentDrawer() {
        if (!this.annotationDrawerEnabled || this.annotationMode) {
            return false;
        }
        if (this.agentWorkbenchOpen && !this.canAgentAndDrawerCoexist()) {
            return false;
        }
        return true;
    }

    shouldObserveAnnotations() {
        return this.shouldShowInteractionDocs() && this.currentAnnotations.length > 0;
    }

    syncAnnotationObservers() {
        if (this.shouldObserveAnnotations()) {
            this.setupIframeObservers();
        } else {
            this.teardownIframeObservers();
        }
    }

    clearAnnotationMarkers() {
        this._annotationMarkerNodes.forEach((node) => {
            node.wrapper.remove();
        });
        this._annotationMarkerNodes.clear();

        if (this.annotationMarkerLayer) {
            this.annotationMarkerLayer.innerHTML = '';
            this.annotationMarkerLayer.setAttribute('aria-hidden', 'true');
        }
    }

    renderAnnotationMarkers() {
        if (!this.annotationMarkerLayer) return;

        if (!this.shouldShowInteractionDocs() || this.visibleAnnotations.length === 0) {
            this.clearAnnotationMarkers();
            return;
        }

        const nextKeys = new Set();
        const stageRect = this.viewportStage.getBoundingClientRect();
        this.annotationMarkerLayer.setAttribute('aria-hidden', 'false');

        this.visibleAnnotations.forEach((item, index) => {
            const geometry = this.getMarkerGeometry(item.element);
            if (!geometry) return;

            const key = this.getAnnotationMarkerKey(item.annotation, item.sourceIndex);
            nextKeys.add(key);

            let node = this._annotationMarkerNodes.get(key);
            if (!node) {
                const wrapper = document.createElement('div');
                wrapper.className = 'annotation-marker';

                const badge = document.createElement('span');
                badge.className = 'annotation-marker__badge';
                badge.setAttribute('role', 'button');
                badge.setAttribute('tabindex', '0');
                wrapper.appendChild(badge);

                this.annotationMarkerLayer.appendChild(wrapper);
                node = { wrapper, badge };
                this._annotationMarkerNodes.set(key, node);
            }

            node.wrapper.style.left = `${geometry.left}px`;
            node.wrapper.style.top = `${geometry.top}px`;
            node.wrapper.style.width = `${geometry.width}px`;
            node.wrapper.style.height = `${geometry.height}px`;
            node.wrapper.classList.toggle('is-active', item.sourceIndex === this.activeAnnotationSourceIndex);
            const displayNumber = this.getAnnotationDisplayNumber(item.sourceIndex, index);
            node.badge.textContent = displayNumber;
            node.badge.dataset.annotationMarker = String(item.sourceIndex);
            node.badge.setAttribute('aria-label', `查看第 ${displayNumber} 条交互标注`);

            const badgeWidth = node.badge.offsetWidth || 28;
            const badgeHeight = node.badge.offsetHeight || 18;
            const badgeNudge = 5;
            const badgeLeft = Math.min(
                Math.max(geometry.left + geometry.width - badgeWidth - 8 + badgeNudge, 8),
                Math.max(8, stageRect.width - badgeWidth - 8)
            );
            const badgeTop = Math.min(
                Math.max(geometry.top + 8 - badgeNudge, 8),
                Math.max(8, stageRect.height - badgeHeight - 8)
            );
            node.badge.style.left = `${badgeLeft - geometry.left}px`;
            node.badge.style.top = `${badgeTop - geometry.top}px`;
        });

        Array.from(this._annotationMarkerNodes.keys()).forEach((key) => {
            if (nextKeys.has(key)) return;
            const node = this._annotationMarkerNodes.get(key);
            if (node) node.wrapper.remove();
            this._annotationMarkerNodes.delete(key);
        });
    }

    getMarkerGeometry(element) {
        const iframeRect = this.mainIframe.getBoundingClientRect();
        const stageRect = this.viewportStage.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        const left = iframeRect.left - stageRect.left + elementRect.left;
        const top = iframeRect.top - stageRect.top + elementRect.top;
        const right = iframeRect.left - stageRect.left + elementRect.right;
        const bottom = iframeRect.top - stageRect.top + elementRect.bottom;

        const clippedLeft = Math.max(0, Math.min(left, stageRect.width));
        const clippedTop = Math.max(0, Math.min(top, stageRect.height));
        const clippedRight = Math.max(0, Math.min(right, stageRect.width));
        const clippedBottom = Math.max(0, Math.min(bottom, stageRect.height));
        const width = clippedRight - clippedLeft;
        const height = clippedBottom - clippedTop;

        if (width <= 0 || height <= 0) return null;

        return {
            left: clippedLeft,
            top: clippedTop,
            width,
            height
        };
    }

    getAnnotationMarkerKey(annotation, sourceIndex = 0) {
        return `${sourceIndex}:${annotation?.id || annotation?.selector || 'annotation'}`;
    }

    scheduleVisibleAnnotationRefresh() {
        if (this._annotationRefreshRaf) return;
        this._annotationRefreshRaf = window.requestAnimationFrame(() => {
            this._annotationRefreshRaf = null;
            this.refreshAnnotationUI();
        });
    }

    collectVisibleAnnotations() {
        const iframeDoc = this.mainIframe.contentDocument;
        const iframeWin = this.mainIframe.contentWindow;
        if (!iframeDoc || !iframeWin) return [];

        return this.currentAnnotations.reduce((items, annotation, sourceIndex) => {
            const match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin);
            if (!match) return items;

            items.push({
                annotation,
                element: match.element,
                sourceIndex,
                label: this.getAnnotationLabel(annotation, match.element),
                selectorLabel: this.getAnnotationSelectorLabel(annotation)
            });
            return items;
        }, []);
    }

    collectAllAnnotationItems() {
        const iframeDoc = this.mainIframe.contentDocument;
        const iframeWin = this.mainIframe.contentWindow;
        const visibleIndexes = new Set(this.visibleAnnotations.map((item) => item.sourceIndex));

        return this.currentAnnotations.map((annotation, sourceIndex) => {
            const match = iframeDoc && iframeWin
                ? this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
                    requireViewportVisible: false,
                    requireRendered: false,
                    allowAmbiguous: true
                })
                : null;
            const element = match?.element || null;

            return {
                annotation,
                element,
                sourceIndex,
                label: this.getAnnotationLabel(annotation, element),
                selectorLabel: this.getAnnotationSelectorLabel(annotation),
                isVisible: visibleIndexes.has(sourceIndex),
                isResolvable: Boolean(element),
                isDisplayable: Boolean(element && iframeWin && this.isElementDisplayable(element, iframeWin))
            };
        });
    }

    getAnnotationDrawerItems() {
        if (this.annotationListScope === 'all') {
            return this.collectAllAnnotationItems();
        }

        return this.visibleAnnotations.map((item) => ({
            ...item,
            isVisible: true,
            isResolvable: true,
            isDisplayable: true
        }));
    }

    resolveAnnotationTarget(
        annotation,
        iframeDoc = this.mainIframe.contentDocument,
        iframeWin = this.mainIframe.contentWindow,
        {
            requireViewportVisible = true,
            requireRendered = true,
            allowAmbiguous = false
        } = {}
    ) {
        if (!annotation?.selector || !iframeDoc || !iframeWin) return null;

        let candidates = [];
        try {
            candidates = [...new Set(this.getAnnotationSelectorVariants(annotation.selector)
                .flatMap((selector) => Array.from(iframeDoc.querySelectorAll(selector)))
            )];
        } catch (error) {
            console.warn('Invalid selector:', annotation.selector, error);
            return null;
        }

        if (candidates.length === 0) return null;

        let targetCandidates = candidates;
        if (requireViewportVisible) {
            targetCandidates = candidates.filter((element) => this.isElementVisibleInViewport(element, iframeWin));
        } else if (requireRendered) {
            targetCandidates = candidates.filter((element) => this.isElementDisplayable(element, iframeWin));
        }

        if (targetCandidates.length === 0) return null;
        if (targetCandidates.length === 1) {
            return {
                element: targetCandidates[0],
                score: this.scoreAnnotationCandidate(annotation, targetCandidates[0])
            };
        }

        const scoredCandidates = targetCandidates
            .map((element) => ({
                element,
                score: this.scoreAnnotationCandidate(annotation, element)
            }))
            .sort((a, b) => b.score - a.score);

        const [best, second] = scoredCandidates;
        if (!best) return null;
        if (!allowAmbiguous && best.score <= 0) return null;
        if (!allowAmbiguous && second && best.score - second.score < 2) return null;
        return best;
    }

    getAnnotationSelectorVariants(selector) {
        const rawSelector = String(selector || '').trim();
        if (!rawSelector) return [];

        const variants = [rawSelector];
        const relaxedStateSelector = rawSelector
            .replace(/\.(?:is-(?:active|selected|open|on|playing-[\w-]+)|sheet-open|menu-open|music-open|mode-[\w-]+|theme-[\w-]+|texture-[\w-]+|volume-zero|sheet-surface-[\w-]+)/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (relaxedStateSelector && relaxedStateSelector !== rawSelector && !variants.includes(relaxedStateSelector)) {
            variants.push(relaxedStateSelector);
        }

        return variants;
    }

    scoreAnnotationCandidate(annotation, element) {
        const meta = annotation.meta || {};
        const metaText = this.normalizeText(meta.textContent);
        const elementText = this.normalizeText(
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.textContent
        );
        const metaTagName = String(meta.tagName || '').toLowerCase();
        const metaId = String(meta.id || '').trim();
        const metaAriaLabel = this.normalizeText(meta.ariaLabel);
        const metaTitle = this.normalizeText(meta.title);
        const metaClasses = this.getStableClassList(meta.className);
        const elementClasses = this.getStableClassList(element.className);

        let score = 0;

        if (metaTagName) {
            score += metaTagName === element.tagName.toLowerCase() ? 4 : -2;
        }

        if (metaId) {
            score += element.id === metaId ? 8 : -1;
        }

        if (metaAriaLabel) {
            score += this.normalizeText(element.getAttribute('aria-label')) === metaAriaLabel ? 5 : 0;
        }

        if (metaTitle) {
            score += this.normalizeText(element.getAttribute('title')) === metaTitle ? 4 : 0;
        }

        if (metaText && elementText) {
            if (metaText === elementText) {
                score += 10;
            } else if (elementText.includes(metaText) || metaText.includes(elementText)) {
                score += 6;
            } else {
                const metaTokens = metaText.split(' ').filter(Boolean);
                const overlap = metaTokens.filter((token) => elementText.includes(token)).length;
                score += Math.min(overlap * 2, 4);
            }
        }

        if (metaClasses.length > 0 && elementClasses.length > 0) {
            const overlap = metaClasses.filter((className) => elementClasses.includes(className)).length;
            score += overlap * 2;
        }

        return score;
    }

    normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    getStableClassList(value) {
        return String(value || '')
            .split(/\s+/)
            .map((className) => className.trim())
            .filter((className) => className && !className.startsWith('__readify'));
    }

    isElementDisplayable(element, iframeWin) {
        if (!element || !element.isConnected) return false;

        let current = element;
        while (current && current.nodeType === 1) {
            const style = iframeWin.getComputedStyle(current);
            if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.visibility === 'collapse' ||
                Number(style.opacity) === 0
            ) {
                return false;
            }
            current = current.parentElement;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        return true;
    }

    isElementVisibleInViewport(element, iframeWin) {
        if (!this.isElementDisplayable(element, iframeWin)) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return (
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < iframeWin.innerHeight &&
            rect.left < iframeWin.innerWidth
        );
    }

    getAnnotationLabel(annotation, element) {
        const candidates = [
            annotation.meta?.ariaLabel,
            annotation.meta?.title,
            annotation.meta?.textContent,
            element?.getAttribute?.('aria-label'),
            element?.getAttribute?.('title'),
            element?.textContent
        ];

        for (const value of candidates) {
            const normalized = this.normalizeAnnotationText(value);
            if (normalized && !this.looksLikeTechnicalLabel(normalized)) {
                return normalized;
            }
        }

        return this.getFallbackAnnotationLabel(annotation, element);
    }

    normalizeAnnotationText(value) {
        return this.normalizeText(value)
            .replace(/\s*[›»→]\s*\d+\s*$/g, '')
            .replace(/\s*[›»→]+\s*$/g, '')
            .trim();
    }

    looksLikeTechnicalLabel(value) {
        const normalized = this.normalizeText(value);
        if (!normalized) return true;
        return /^[#.:[\]>~+a-z0-9_-]+$/i.test(normalized) && !/[\u4e00-\u9fff\s]/.test(normalized);
    }

    getFallbackAnnotationLabel(annotation, element) {
        const tagName = String(element?.tagName || annotation?.meta?.tagName || '').toLowerCase();
        const tagLabelMap = {
            button: '按钮',
            input: '输入框',
            textarea: '多行输入框',
            select: '下拉选择',
            img: '图片',
            a: '链接',
            label: '标签',
            section: '区块',
            div: '界面区域'
        };

        return tagLabelMap[tagName] || '界面元素';
    }

    getAnnotationSelectorLabel(annotation) {
        return this.normalizeText(annotation?.selector || '');
    }

    getAnnotationDisplayNumber(sourceIndex, visibleIndex = null) {
        if (this.annotationListScope === 'all') {
            return sourceIndex + 1;
        }

        if (Number.isInteger(visibleIndex)) {
            return visibleIndex + 1;
        }

        const resolvedIndex = this.visibleAnnotations.findIndex((item) => item.sourceIndex === sourceIndex);
        return resolvedIndex >= 0 ? resolvedIndex + 1 : sourceIndex + 1;
    }

    renderAnnotationScopeControl(totalCount, visibleCount) {
        const currentActive = this.annotationListScope !== 'all';
        const allActive = this.annotationListScope === 'all';

        return `
            <nav class="annotation-scope-toggle" aria-label="标注显示范围">
                <button
                    class="annotation-scope-toggle__button${currentActive ? ' is-active' : ''}"
                    type="button"
                    data-annotation-scope="current"
                    aria-pressed="${currentActive ? 'true' : 'false'}"
                >
                    <span>当前</span>
                    <span>${visibleCount}</span>
                </button>
                <span class="annotation-scope-toggle__divider" aria-hidden="true">/</span>
                <button
                    class="annotation-scope-toggle__button${allActive ? ' is-active' : ''}"
                    type="button"
                    data-annotation-scope="all"
                    aria-pressed="${allActive ? 'true' : 'false'}"
                >
                    <span>全部</span>
                    <span>${totalCount}</span>
                </button>
            </nav>
        `;
    }

    renderAnnotationCard(item, displayIndex) {
        const cardClasses = [
            'annotation-card',
            item.sourceIndex === this.activeAnnotationSourceIndex ? 'is-active' : '',
            !item.isVisible ? 'is-out-of-view' : '',
            !item.isResolvable ? 'is-unresolved' : ''
        ].filter(Boolean).join(' ');

        return `
            <article
                class="${cardClasses}"
                role="button"
                tabindex="0"
                data-annotation-card="${item.sourceIndex}"
                aria-label="定位到第 ${displayIndex} 条交互标注"
            >
                <div class="annotation-card__index">${displayIndex}</div>
                <div class="annotation-card__content">
                    <div class="annotation-card__header">
                        <div class="annotation-card__title" title="${this.escapeHtml(item.label)}">${this.escapeHtml(item.label)}</div>
                        <div class="annotation-card__menu">
                            <button
                                class="annotation-card__more"
                                type="button"
                                data-annotation-card-menu="1"
                                aria-label="更多操作"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                            </button>
                            <div class="annotation-card__menu-popover">
                                <button
                                    class="annotation-card__delete"
                                    type="button"
                                    data-delete-annotation="1"
                                    data-annotation-index="${item.sourceIndex}"
                                    title="删除这条交互文档"
                                    aria-label="删除这条交互文档"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    <span>删除</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="annotation-card__description">${this.escapeHtml(item.annotation.description)}</p>
                </div>
            </article>
        `;
    }

    renderAnnotationDrawer() {
        if (!this.annotationDrawer || !this.annotationDrawerBody || !this.annotationDrawerMeta) return;

        if (!this.shouldShowDocumentDrawer()) {
            this.hideAnnotationDrawer();
            return;
        }

        this.annotationDrawer.classList.add('is-visible');
        const isWideDocument = ['prd', 'diagram', 'mindmap'].includes(this.docDrawerMode);
        this.annotationDrawer.classList.toggle('is-prd-mode', this.docDrawerMode === 'prd');
        this.annotationDrawer.classList.toggle('is-drawio-mode', this.docDrawerMode === 'diagram');
        this.annotationDrawer.classList.toggle('is-mindmap-mode', this.docDrawerMode === 'mindmap');
        this.annotationDrawer.classList.toggle('is-expanded', isWideDocument && this.docDrawerExpanded);
        this.annotationDrawer.classList.toggle('is-fullscreen', isWideDocument && this.prdDrawerFullscreen);
        this.annotationDrawer.classList.toggle('is-user-sized', isWideDocument && Number.isFinite(this.prdDrawerWidth));

        if (this.docDrawerMode !== 'prd') {
            this.annotationDrawer.classList.remove('has-pinned-toc');
            const existingToc = this.annotationDrawer.querySelector('.prd-toc-floating');
            if (existingToc) existingToc.remove();
            this._lastPrdHeadingsHash = null;
        }

        this.viewportContainer.classList.add('has-drawer');
        this.updateDocDrawerTabs();

        if (this.docDrawerMode === 'prd') {
            this.renderPrdDrawer();
            return;
        }
        if (this.docDrawerMode === 'diagram') {
            if (this.prdAiBtn) this.prdAiBtn.hidden = true;
            if (this.prdEditBtn) this.prdEditBtn.hidden = true;
            if (this.prdSaveBtn) this.prdSaveBtn.hidden = true;
            if (this.prdCancelEditBtn) this.prdCancelEditBtn.hidden = true;
            if (this.prdOpenNewTabBtn) this.prdOpenNewTabBtn.hidden = true;
            if (this.prdDownloadBtn) this.prdDownloadBtn.hidden = true;
            if (this.prdExpandBtn) this.prdExpandBtn.hidden = true;
            this.drawioModule?.render();
            return;
        }
        if (this.docDrawerMode === 'mindmap') {
            if (this.prdAiBtn) this.prdAiBtn.hidden = true;
            if (this.prdEditBtn) this.prdEditBtn.hidden = true;
            if (this.prdSaveBtn) this.prdSaveBtn.hidden = true;
            if (this.prdCancelEditBtn) this.prdCancelEditBtn.hidden = true;
            if (this.prdOpenNewTabBtn) this.prdOpenNewTabBtn.hidden = true;
            if (this.prdDownloadBtn) this.prdDownloadBtn.hidden = true;
            if (this.prdExpandBtn) this.prdExpandBtn.hidden = true;
            this.mindmapModule?.render();
            return;
        }

        if (this.prdAiBtn) this.prdAiBtn.hidden = true;
        if (this.prdEditBtn) this.prdEditBtn.hidden = true;
        if (this.prdSaveBtn) this.prdSaveBtn.hidden = true;
        if (this.prdCancelEditBtn) this.prdCancelEditBtn.hidden = true;
        if (this.prdOpenNewTabBtn) this.prdOpenNewTabBtn.hidden = true;
        if (this.prdDownloadBtn) this.prdDownloadBtn.hidden = true;
        if (this.prdExpandBtn) this.prdExpandBtn.hidden = true;

        const totalCount = this.currentAnnotations.length;
        const visibleCount = this.visibleAnnotations.length;
        const scopeControl = totalCount > 0
            ? this.renderAnnotationScopeControl(totalCount, visibleCount)
            : '';
        const drawerItems = this.getAnnotationDrawerItems();

        this.annotationDrawerMeta.innerHTML = totalCount > 0
            ? scopeControl
            : '当前版本还没有标注';

        if (totalCount === 0) {
            this.annotationDrawerBody.innerHTML = `
                <div class="annotation-drawer__tips">
                    <div class="annotation-drawer__tips-title">💡 标注使用技巧</div>
                    <ul class="annotation-drawer__tips-list">
                        <li>
                            <span class="tip-icon">🖱️</span>
                            <span class="tip-text"><strong>双击右键</strong>快速进入标注模式；<strong>单击右键</strong>退出</span>
                        </li>
                        <li>
                            <span class="tip-icon">⌨️</span>
                            <span class="tip-text">标注时，按 <strong>Shift</strong> 可精确选择控件标注</span>
                        </li>
                        <li>
                            <span class="tip-icon">🤖</span>
                            <span class="tip-text">可通过标注，让 <strong>agent</strong> 精确修改</span>
                        </li>
                    </ul>
                </div>
            `;
            return;
        }

        if (drawerItems.length === 0) {
            this.annotationDrawerBody.innerHTML = `
                <div class="annotation-drawer__empty">
                    <strong>当前视图没有可见标注</strong>
                    <p>可切到"全部"查看所有标注，或切换页面状态、展开面板、滚动到对应控件后再看当前列表。</p>
                </div>
            `;
            return;
        }

        this.annotationDrawerBody.innerHTML = `
            ${drawerItems.map((item, index) => {
                const displayIndex = this.getAnnotationDisplayNumber(item.sourceIndex, index);
                return this.renderAnnotationCard(item, displayIndex);
            }).join('')}
        `;
    }

    focusAnnotationCardFromMarker(sourceIndex) {
        if (!this.currentAnnotations[sourceIndex]) return;

        if (!this.annotationDrawerEnabled || this.docDrawerMode !== 'annotations') {
            this.openDocumentDrawer('annotations');
        }

        this.activeAnnotationSourceIndex = sourceIndex;
        this.renderAnnotationDrawer();
        this.renderAnnotationMarkers();
        this.scrollAnnotationCardIntoView(sourceIndex);
    }

    async focusAnnotationFromCard(sourceIndex) {
        const annotation = this.currentAnnotations[sourceIndex];
        if (!annotation) return;

        const iframeDoc = this.mainIframe.contentDocument;
        const iframeWin = this.mainIframe.contentWindow;
        if (!iframeDoc || !iframeWin) {
            this.showToast('无法访问页面内容，请通过 Bridge 服务打开后再定位', true);
            return;
        }

        let match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
            requireViewportVisible: false,
            requireRendered: false,
            allowAmbiguous: true
        });

        this.activeAnnotationSourceIndex = sourceIndex;

        let element = match?.element || null;
        let targetState = this.getAnnotationTargetState(element, iframeWin);

        // Increase max attempts and add progressive wait times
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts && !targetState.isReachable; attempt += 1) {
            await this.revealAnnotationTargetIfNeeded(
                annotation,
                element,
                iframeDoc,
                iframeWin,
                { force: true }
            );
            // Progressive wait: give CSS transitions and JS re-renders time to settle
            const waitTime = 120 + attempt * 80;
            await this.waitForAnnotationFrame(waitTime);
            match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
                requireViewportVisible: false,
                requireRendered: false,
                allowAmbiguous: true
            });
            element = match?.element || element;
            targetState = this.getAnnotationTargetState(element, iframeWin);
        }

        if (!element) {
            this.renderAnnotationDrawer();
            this.renderAnnotationMarkers();
            this.scrollAnnotationCardIntoView(sourceIndex);
            this.showToast('当前页面没有匹配到这条标注的位置', true);
            return;
        }

        const targetElement = match?.element || element;
        targetState = this.getAnnotationTargetState(targetElement, iframeWin);

        if (targetState.isReachable) {
            this.scrollAnnotationTargetInsideLocalContainer(targetElement, iframeWin);
            this.refreshAnnotationUI();
            window.setTimeout(() => {
                this.refreshAnnotationUI();
                this.scrollAnnotationCardIntoView(sourceIndex);
            }, 380);
            this.showToast('已定位到标注位置');
        } else {
            this.renderAnnotationDrawer();
            this.renderAnnotationMarkers();
            this.scrollAnnotationCardIntoView(sourceIndex);
            this.showToast('没能自动定位到标注位置', true);
        }
    }

    async revealAnnotationTargetIfNeeded(annotation, element, iframeDoc, iframeWin, { force = false } = {}) {
        if (!force && this.getAnnotationTargetState(element, iframeWin).isReachable) {
            return false;
        }

        const openerSelectors = this.getAnnotationStateOpenerSelectors(annotation, element);
        if (openerSelectors.length === 0) {
            return this.forceRevealAnnotationTargetState(annotation, element, iframeDoc, iframeWin);
        }

        for (const openerSelector of openerSelectors) {
            const opener = this.findAnnotationStateOpenerCandidate(
                openerSelector,
                element,
                iframeDoc,
                iframeWin
            );
            if (!opener) continue;
            opener.click();
            const ready = await this.waitForAnnotationTargetReady(annotation, iframeDoc, iframeWin, element);
            if (ready) return true;
        }

        return this.forceRevealAnnotationTargetState(annotation, element, iframeDoc, iframeWin);
    }

    async waitForAnnotationTargetReady(annotation, iframeDoc, iframeWin, fallbackElement = null, timeout = 880) {
        const start = window.performance.now();
        while (window.performance.now() - start < timeout) {
            const match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
                requireViewportVisible: false,
                requireRendered: false,
                allowAmbiguous: true
            });
            const target = match?.element || fallbackElement;
            if (this.getAnnotationTargetState(target, iframeWin).isReachable) {
                return true;
            }
            await this.waitForAnnotationFrame(80);
        }

        const match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
            requireViewportVisible: false,
            requireRendered: false,
            allowAmbiguous: true
        });
        return this.getAnnotationTargetState(match?.element || fallbackElement, iframeWin).isReachable;
    }

    async forceRevealAnnotationTargetState(annotation, element, iframeDoc, iframeWin) {
        if (!iframeDoc || !iframeWin) return false;

        let changed = false;
        const target = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
            requireViewportVisible: false,
            requireRendered: false,
            allowAmbiguous: true
        })?.element || element;
        const context = this.getAnnotationRevealContext(annotation, target);
        const phoneScreen = iframeDoc.querySelector('#phoneScreen, .phone-screen');
        const setPhoneClass = (className, enabled = true) => {
            if (!phoneScreen || phoneScreen.classList.contains(className) === enabled) return;
            phoneScreen.classList.toggle(className, enabled);
            changed = true;
        };

        // ── Step 0: Determine the full state patch needed ──
        // Compute the desired state patches for the iframe's JS state object.
        // This allows the iframe to re-render correctly instead of reverting on next render cycle.
        const statePatches = {};
        let needsSheet = false;
        let requestedPanel = '';

        if (/music-panel|category-tab|sound-row|volume-dock|stopButton|external-card|external-volume-tip|背景乐|外部播放器|内置|音频/i.test(context)) {
            setPhoneClass('music-open', true);
            setPhoneClass('menu-open', false);
        }

        if (/more-sheet|menu-row|menu-group|moreButton|更多设置|更多菜单/i.test(context)) {
            setPhoneClass('menu-open', true);
            setPhoneClass('music-open', false);
        }

        if (/sheet-panel|sheet-stack|setting-row|nav-row|backgroundEditorPreview|data-panel|data-open-panel|Aa|点击翻页|阅读显示|自定义背景|锁屏时间|自定义颜色|更多设置/i.test(context)) {
            setPhoneClass('sheet-open', true);
            needsSheet = true;
            statePatches.sheetOpen = true;
            statePatches.topbarVisible = true;
        }

        // ── Step 1: Handle is-immersive mode (reader demo) ──
        // The reader demo uses is-immersive class which hides the topbar (opacity:0).
        // We need to remove it so the sheet/topbar can be properly rendered.
        if (phoneScreen?.classList.contains('is-immersive')) {
            phoneScreen.classList.remove('is-immersive');
            statePatches.topbarVisible = true;
            changed = true;
        }

        const requestedMode = this.getAnnotationRequestedMode(annotation, target);
        if (requestedMode) {
            this.activateAnnotationModePanel(iframeDoc, phoneScreen, requestedMode);
            changed = true;
        }

        const targetPanel = target?.closest?.('[data-mode-panel]');
        if (targetPanel?.dataset?.modePanel) {
            this.activateAnnotationModePanel(iframeDoc, phoneScreen, targetPanel.dataset.modePanel);
            changed = true;
        }

        // ── Step 2: Determine and activate the correct panel ──
        requestedPanel = this.getAnnotationRequestedPanel(annotation, target, context);
        if (requestedPanel) {
            // For nested panels (display, lock), we need the full path
            const panelChain = this.getAnnotationPanelChain(requestedPanel);
            for (const panelName of panelChain) {
                if (this.activateAnnotationPanel(iframeDoc, phoneScreen, panelName)) {
                    changed = true;
                }
            }
            statePatches.activePanel = requestedPanel;
            if (needsSheet || panelChain.length > 0) {
                statePatches.sheetOpen = true;
                statePatches.topbarVisible = true;
            }
        }

        // ── Step 3: Sync state to iframe JS via postMessage ──
        // This is the key improvement: instead of just toggling CSS classes,
        // we tell the iframe's JS to update its internal state and re-render.
        if (Object.keys(statePatches).length > 0) {
            const synced = await this.syncIframeState(statePatches, 300);
            if (synced) {
                // Give the iframe render cycle time to complete
                await this.waitForAnnotationFrame(150);
            }
        }

        if (changed) {
            await this.waitForAnnotationFrame(100);
        }

        if (await this.revealHiddenAnnotationAncestors(annotation, target, iframeDoc, iframeWin)) {
            changed = true;
            await this.waitForAnnotationFrame(120);
        }

        const match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
            requireViewportVisible: false,
            requireRendered: false,
            allowAmbiguous: true
        });
        const nextTarget = match?.element || target;
        this.scrollAnnotationTargetInsideLocalContainer(nextTarget, iframeWin, { behavior: 'auto' });
        await this.waitForAnnotationFrame(150);

        return this.getAnnotationTargetState(nextTarget, iframeWin).isReachable;
    }

    async revealHiddenAnnotationAncestors(annotation, fallbackTarget, iframeDoc, iframeWin) {
        if (!iframeDoc || !iframeWin) return false;

        let changed = false;
        let match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
            requireViewportVisible: false,
            requireRendered: false,
            allowAmbiguous: true
        });
        let target = match?.element || fallbackTarget;
        if (!target) return false;

        for (let round = 0; round < 2; round += 1) {
            const hiddenAncestors = this.findHiddenAncestors(target, iframeWin);
            if (hiddenAncestors.length === 0) break;

            for (const ancestor of hiddenAncestors) {
                const opener = this.findGenericOpenerForElement(ancestor, iframeDoc, iframeWin);
                if (opener && opener.isConnected) {
                    try {
                        opener.click();
                        changed = true;
                        await this.waitForAnnotationFrame(250);
                    } catch {
                        // Fall through to the non-click reveal path.
                    }
                }

                match = this.resolveAnnotationTarget(annotation, iframeDoc, iframeWin, {
                    requireViewportVisible: false,
                    requireRendered: false,
                    allowAmbiguous: true
                });
                target = match?.element || target;
                if (this.getAnnotationTargetState(target, iframeWin).isReachable) {
                    return changed;
                }

                if (this.forceShowHiddenAncestor(ancestor, iframeWin)) {
                    changed = true;
                    await this.waitForAnnotationFrame(150);
                }
            }
        }

        return changed;
    }

    findHiddenAncestors(element, iframeWin) {
        const hidden = [];
        const doc = element?.ownerDocument;
        let current = element;

        while (current && current !== doc?.body && current !== doc?.documentElement) {
            if (this.isHiddenForAnnotationReveal(current, iframeWin)) {
                hidden.push(current);
            }
            current = current.parentElement;
        }

        return hidden;
    }

    isHiddenForAnnotationReveal(element, iframeWin) {
        if (!element || !iframeWin) return false;

        try {
            const style = iframeWin.getComputedStyle(element);
            return (
                element.hidden ||
                element.getAttribute('aria-hidden') === 'true' ||
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.visibility === 'collapse' ||
                Number(style.opacity) === 0
            );
        } catch {
            return false;
        }
    }

    findGenericOpenerForElement(hiddenElement, iframeDoc, iframeWin) {
        if (!hiddenElement || !iframeDoc || !iframeWin) return null;

        const candidates = [];
        const seen = new Set();
        const addCandidate = (element) => {
            if (!element || !element.isConnected || seen.has(element)) return;
            if (hiddenElement.contains(element)) return;
            seen.add(element);
            candidates.push(element);
        };
        const trySelector = (selector) => {
            try {
                iframeDoc.querySelectorAll(selector).forEach(addCandidate);
            } catch {
                // Ignore invalid selectors produced by unusual ids/classes.
            }
        };

        const id = String(hiddenElement.id || '').trim();
        const idAttr = this.escapeCssAttributeValue(id);
        const idSelector = this.escapeCssIdentifier(id);
        const classes = Array.from(hiddenElement.classList || []).map((className) => String(className).trim()).filter(Boolean);
        const dataAttrs = ['data-target', 'data-show', 'data-open', 'data-toggle', 'data-href', 'data-controls'];

        if (id) {
            trySelector(`[aria-controls="${idAttr}"]`);
            trySelector(`[href="#${idAttr}"]`);
            dataAttrs.forEach((attributeName) => {
                trySelector(`[${attributeName}="#${idAttr}"]`);
                trySelector(`[${attributeName}="${idAttr}"]`);
            });
            if (idSelector) {
                trySelector(`[data-open-${idSelector}]`);
                trySelector(`[data-show-${idSelector}]`);
            }
        }

        classes.forEach((className) => {
            const classAttr = this.escapeCssAttributeValue(className);
            dataAttrs.forEach((attributeName) => {
                trySelector(`[${attributeName}=".${classAttr}"]`);
                trySelector(`[${attributeName}="${classAttr}"]`);
            });
        });

        const tokens = this.getHiddenElementRevealTokens(hiddenElement);
        if (tokens.length > 0) {
            iframeDoc.querySelectorAll('button, [role="button"], [role="tab"], a').forEach((candidate) => {
                const label = this.getGenericOpenerLabel(candidate);
                if (tokens.some((token) => label.includes(token))) {
                    addCandidate(candidate);
                }
            });
        }

        const parent = hiddenElement.parentElement;
        if (parent && parent.children.length <= 8) {
            Array.from(parent.children).forEach((child) => {
                if (child === hiddenElement) return;
                const directCandidate = child.matches?.('button, [role="button"], [role="tab"], a')
                    ? child
                    : child.querySelector?.(':scope > button, :scope > [role="button"], :scope > [role="tab"], :scope > a');
                addCandidate(directCandidate);
            });
        }

        const usableCandidates = candidates
            .filter((candidate) => this.isAnnotationStateOpenerElement(candidate))
            .map((candidate) => ({
                candidate,
                score: this.scoreGenericOpenerCandidate(candidate, hiddenElement, tokens, iframeWin)
            }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score);

        return usableCandidates.find((item) => this.isElementVisibleInViewport(item.candidate, iframeWin))?.candidate
            || usableCandidates[0]?.candidate
            || null;
    }

    getHiddenElementRevealTokens(element) {
        const rawTokens = [
            element?.id,
            ...Array.from(element?.classList || [])
        ]
            .join(' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/);
        const stopWords = new Set(['is', 'active', 'hidden', 'view', 'panel', 'section', 'container', 'content', 'screen', 'page', 'body']);

        return Array.from(new Set(
            rawTokens
                .map((token) => token.trim().toLowerCase())
                .filter((token) => token.length > 2 && !stopWords.has(token))
        ));
    }

    getGenericOpenerLabel(element) {
        return [
            element?.id,
            element?.className,
            element?.getAttribute?.('aria-label'),
            element?.getAttribute?.('title'),
            element?.textContent,
            ...Array.from(element?.attributes || [])
                .filter((attribute) => /^data-/.test(attribute.name))
                .map((attribute) => `${attribute.name} ${attribute.value}`)
        ].filter(Boolean).join(' ').toLowerCase();
    }

    scoreGenericOpenerCandidate(candidate, hiddenElement, tokens, iframeWin) {
        let score = 0;
        const hiddenId = String(hiddenElement?.id || '').trim();
        const label = this.getGenericOpenerLabel(candidate);

        if (hiddenId) {
            const expectedValues = [hiddenId, `#${hiddenId}`];
            ['aria-controls', 'href', 'data-target', 'data-show', 'data-open', 'data-toggle', 'data-href', 'data-controls'].forEach((attributeName) => {
                const value = candidate.getAttribute?.(attributeName);
                if (expectedValues.includes(value)) score += 20;
            });
        }

        tokens.forEach((token) => {
            if (label.includes(token)) score += 6;
        });

        if (candidate.parentElement === hiddenElement.parentElement) score += 4;
        if (candidate.closest?.('.is-active, [aria-selected="true"]')) score += 2;
        if (this.isElementVisibleInViewport(candidate, iframeWin)) score += 4;

        return score;
    }

    forceShowHiddenAncestor(element, iframeWin) {
        if (!element?.isConnected) return false;

        let changed = false;
        const parent = element.parentElement;

        if (parent && !element.classList.contains('is-active')) {
            const siblingsWithActive = Array.from(parent.children)
                .filter((sibling) => sibling !== element && sibling.classList.contains('is-active'));
            if (siblingsWithActive.length > 0) {
                siblingsWithActive.forEach((sibling) => sibling.classList.remove('is-active'));
                element.classList.add('is-active');
                changed = true;
            }
        }

        if (element.hidden) {
            element.hidden = false;
            changed = true;
        }
        if (element.getAttribute('aria-hidden') === 'true') {
            element.removeAttribute('aria-hidden');
            changed = true;
        }
        if (element.style.display === 'none') {
            element.style.display = '';
            changed = true;
        }
        if (element.style.visibility === 'hidden') {
            element.style.visibility = '';
            changed = true;
        }
        if (element.style.opacity === '0') {
            element.style.opacity = '';
            changed = true;
        }

        try {
            const style = iframeWin.getComputedStyle(element);
            if (!changed && style.display === 'none') {
                element.style.display = 'block';
                changed = true;
            }
            if (!changed && style.visibility === 'hidden') {
                element.style.visibility = 'visible';
                changed = true;
            }
            if (!changed && Number(style.opacity) === 0) {
                element.style.opacity = '1';
                if (style.pointerEvents === 'none') {
                    element.style.pointerEvents = 'auto';
                }
                changed = true;
            }
        } catch {
            // Computed style can fail for detached nodes; nothing to reveal then.
        }

        return changed;
    }

    escapeCssIdentifier(value) {
        const raw = String(value || '');
        if (!raw) return '';

        const css = this.mainIframe?.contentWindow?.CSS || window.CSS;
        if (css?.escape) return css.escape(raw);
        return raw.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    escapeCssAttributeValue(value) {
        return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    getAnnotationRevealContext(annotation, element) {
        const ancestorTokens = [];
        let current = element;
        const iframeDoc = element?.ownerDocument || this.mainIframe.contentDocument;
        while (current && current !== iframeDoc?.body && current !== iframeDoc?.documentElement) {
            if (current.id) ancestorTokens.push(`#${current.id}`);
            if (current.className) ancestorTokens.push(String(current.className));
            if (current.dataset) {
                ancestorTokens.push(Object.entries(current.dataset)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(' '));
            }
            current = current.parentElement;
        }

        return [
            annotation?.selector,
            annotation?.description,
            annotation?.meta?.textContent,
            annotation?.meta?.className,
            annotation?.meta?.id,
            annotation?.meta?.ariaLabel,
            ancestorTokens.join(' ')
        ].filter(Boolean).join(' ');
    }

    getAnnotationRequestedMode(annotation, element) {
        const context = this.getAnnotationRevealContext(annotation, element);
        if (/external|外部播放器|external-card|external-volume-tip|category-tab--external/i.test(context)) {
            return 'external';
        }
        if (/builtin|内置|sound-row|sound-art|dataCategory|activeCategory/i.test(context)) {
            return 'builtin';
        }
        return '';
    }

    activateAnnotationModePanel(iframeDoc, phoneScreen, mode) {
        if (!mode) return;

        iframeDoc.querySelectorAll('[data-mode-panel]').forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.modePanel === mode);
        });

        iframeDoc.querySelectorAll('[data-source-tab], [data-category]').forEach((tab) => {
            const isActive = mode === 'external'
                ? tab.dataset.sourceTab === 'external'
                : tab.dataset.category === 'all';
            tab.classList.toggle('is-active', isActive);
        });

        phoneScreen?.classList.toggle('mode-external', mode === 'external');
        phoneScreen?.classList.toggle('mode-builtin', mode === 'builtin');
        if (mode === 'external') {
            phoneScreen?.classList.add('is-playing-external');
        }
    }

    getAnnotationRequestedPanel(annotation, element, context = this.getAnnotationRevealContext(annotation, element)) {
        const targetPanel = element?.closest?.('[data-panel]');
        if (targetPanel?.dataset?.panel) return targetPanel.dataset.panel;

        if (/backgroundEditorPreview|backgroundEditor|自定义背景|背景选用|背景图片/i.test(context)) {
            return 'backgroundEditor';
        }
        if (/colorEditor|自定义颜色|颜色/i.test(context)) {
            return 'colorEditor';
        }
        // Check for sub-panels of 'more' first (display, lock)
        if (/data-panel=["']?display|displaySummary|阅读显示|阅读进度|进度显示范围|进度信息形式|显示章节标题|时间和电量/i.test(context)) {
            return 'display';
        }
        if (/data-panel=["']?lock|锁屏时间|常亮|跟随系统.*分钟/i.test(context)) {
            return 'lock';
        }
        if (/setting-row|nav-row--plain|data-toggle|点击翻页|单手模式|音量键翻页|data-panel=["']?more/i.test(context)) {
            return 'more';
        }
        if (/sheet-panel|sheet-stack|nav-row|font-slider|swatch|texture|翻页方式|字号|间距/i.test(context)) {
            return 'main';
        }
        return '';
    }

    /**
     * Get the panel navigation chain needed to reach a target panel.
     * Some panels are nested: display and lock are sub-panels of 'more',
     * so we need to activate 'more' first, then switch to the target.
     */
    getAnnotationPanelChain(panelName) {
        const nestedPanelParents = {
            'display': ['more', 'display'],
            'lock': ['more', 'lock']
        };
        return nestedPanelParents[panelName] || [panelName];
    }

    activateAnnotationPanel(iframeDoc, phoneScreen, panelName) {
        if (!iframeDoc || !panelName) return false;

        const panels = Array.from(iframeDoc.querySelectorAll('[data-panel]'));
        if (panels.length === 0) return false;

        let changed = false;
        let activePanel = null;

        panels.forEach((panel) => {
            const isActive = panel.dataset.panel === panelName;
            if (isActive) activePanel = panel;
            if (panel.classList.contains('is-active') !== isActive) {
                panel.classList.toggle('is-active', isActive);
                changed = true;
            }
        });

        if (phoneScreen) {
            if (!phoneScreen.classList.contains('sheet-open')) {
                phoneScreen.classList.add('sheet-open');
                changed = true;
            }
            // Also remove is-immersive so the topbar is visible
            if (phoneScreen.classList.contains('is-immersive')) {
                phoneScreen.classList.remove('is-immersive');
                changed = true;
            }
            if (phoneScreen.getAttribute('data-active-panel') !== panelName) {
                phoneScreen.setAttribute('data-active-panel', panelName);
                changed = true;
            }
        }

        if (phoneScreen && activePanel) {
            const screenHeight = phoneScreen.clientHeight || 0;
            const maxHeight = Math.round(screenHeight * 0.8);
            const measuredHeight = activePanel.scrollHeight || 0;
            const nextHeight = panelName === 'main'
                ? Math.round(screenHeight * 0.5)
                : Math.min(maxHeight, Math.max(panelName === 'backgroundEditor' ? 320 : 236, measuredHeight));

            if (nextHeight > 0) {
                phoneScreen.style.setProperty('--sheet-height', `${nextHeight}px`);
            }
        }

        return changed;
    }

    getAnnotationTargetState(element, iframeWin) {
        if (!element || !iframeWin) {
            return {
                canDisplay: false,
                isVisible: false,
                canReachByLocalScroll: false,
                canReachByPageScroll: false,
                isReachable: false
            };
        }

        const canDisplay = this.isElementDisplayable(element, iframeWin);
        const isVisible = canDisplay && this.isElementVisibleInViewport(element, iframeWin);
        const scrollParent = canDisplay ? this.findLocalScrollableAncestor(element, iframeWin) : null;
        const canReachByLocalScroll = Boolean(
            scrollParent && this.isElementVisibleInViewport(scrollParent, iframeWin)
        );
        const canReachByPageScroll = canDisplay && this.canScrollIframeToAnnotationTarget(element, iframeWin);

        return {
            canDisplay,
            isVisible,
            canReachByLocalScroll,
            canReachByPageScroll,
            isReachable: canDisplay && (isVisible || canReachByLocalScroll || canReachByPageScroll)
        };
    }

    getAnnotationStateOpenerSelectors(annotation, element) {
        const selector = String(annotation?.selector || '');
        const ancestorTokens = [];
        let current = element;
        const iframeDoc = element?.ownerDocument || this.mainIframe.contentDocument;
        while (current && current !== iframeDoc?.body && current !== iframeDoc?.documentElement) {
            if (current.id) ancestorTokens.push(`#${current.id}`);
            if (current.className) ancestorTokens.push(String(current.className));
            current = current.parentElement;
        }
        const context = [
            selector,
            annotation?.description,
            annotation?.meta?.textContent,
            annotation?.meta?.className,
            annotation?.meta?.id,
            annotation?.meta?.ariaLabel,
            ancestorTokens.join(' ')
        ].filter(Boolean).join(' ');

        const preferredSelectors = [];
        const addSelector = (openerSelector, allowHidden = false) => {
            if (preferredSelectors.some((item) => item.selector === openerSelector)) return;
            preferredSelectors.push({ selector: openerSelector, allowHidden });
        };

        if (/music-panel|#musicPanel|category-tab|sound-row|volume-dock|stopButton/i.test(context)) {
            addSelector('[data-open-music]', true);
        }
        if (/more-sheet|sheet-panel|sheet-stack|menu-row|menu-group/i.test(context)) {
            addSelector('#moreButton');
            addSelector('button[aria-label*="更多"]');
        }
        if (/category-tab--external|data-source-tab|外部播放器/i.test(context)) {
            addSelector('[data-source-tab="external"]', true);
        }
        if (/category-tab|sound-row|sound-art|内置|全部|专注|睡眠|故事|自然/i.test(context)) {
            addSelector('[data-category="all"]', true);
        }
        if (/sheet-panel|sheet-stack|setting-row|nav-row|backgroundEditorPreview|data-panel|data-open-panel|阅读显示|点击翻页|自定义背景|锁屏时间|自定义颜色|更多设置/i.test(context)) {
            addSelector('#aaButton', true);
        }
        if (/setting-row|nav-row--plain|点击翻页|单手模式|音量键翻页|阅读显示|锁屏时间|更多设置/i.test(context)) {
            addSelector('[data-open-panel="more"]', true);
        }
        if (/阅读显示|显示章节标题|时间和电量|阅读进度|进度显示范围|进度信息形式|data-panel=[\"']?display/i.test(context)) {
            addSelector('[data-open-panel="display"]', true);
        }
        if (/锁屏时间|常亮|跟随系统.*分钟|data-panel=[\"']?lock/i.test(context)) {
            addSelector('[data-open-panel="lock"]', true);
        }

        addSelector('[data-open-music]', true);
        addSelector('[data-open-settings]', true);
        addSelector('[data-open-menu]', true);
        addSelector('[data-toggle-menu]', true);
        addSelector('button[aria-label*="更多"]');

        return preferredSelectors;
    }

    findAnnotationStateOpenerCandidate(openerSelector, element, iframeDoc, iframeWin) {
        let candidates = [];
        try {
            candidates = Array.from(iframeDoc.querySelectorAll(openerSelector.selector));
        } catch {
            candidates = [];
        }

        return candidates.find((candidate) => (
            candidate &&
            candidate !== element &&
            candidate.isConnected &&
            this.isAnnotationStateOpenerElement(candidate) &&
            (openerSelector.allowHidden || this.isElementVisibleInViewport(candidate, iframeWin))
        )) || null;
    }

    isAnnotationStateOpenerElement(element) {
        if (!element || element.nodeType !== 1) return false;
        if (element.matches('button, [role="button"], a, input, select, textarea')) return true;
        if (element.hasAttribute('tabindex')) return true;
        return Array.from(element.attributes || []).some((attribute) => /^data-open-|^data-toggle-/.test(attribute.name));
    }

    waitForAnnotationFrame(delay = 0) {
        return new Promise((resolve) => {
            window.setTimeout(resolve, delay);
        });
    }

    clearAnnotationFocus() {
        if (this._annotationFocusTimer) {
            window.clearTimeout(this._annotationFocusTimer);
            this._annotationFocusTimer = null;
        }
    }

    scrollAnnotationTargetInsideLocalContainer(element, iframeWin, options = {}) {
        const scrollParent = this.findLocalScrollableAncestor(element, iframeWin);
        if (!scrollParent) {
            return this.scrollAnnotationTargetInsideIframePage(element, iframeWin, options);
        }

        const parentRect = scrollParent.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const targetTop = scrollParent.scrollTop
            + elementRect.top
            - parentRect.top
            - (parentRect.height - elementRect.height) / 2;

        scrollParent.scrollTo({
            top: Math.max(0, targetTop),
            behavior: options.behavior || 'smooth'
        });

        return true;
    }

    findLocalScrollableAncestor(element, iframeWin) {
        let current = element?.parentElement || null;
        const doc = element?.ownerDocument;

        while (current && current !== doc?.body && current !== doc?.documentElement) {
            const style = iframeWin.getComputedStyle(current);
            const overflowY = `${style.overflowY} ${style.overflow}`;
            const canScroll = /(auto|scroll|overlay)/.test(overflowY)
                && current.scrollHeight > current.clientHeight + 1;
            if (canScroll) return current;
            current = current.parentElement;
        }

        return null;
    }

    canScrollIframeToAnnotationTarget(element, iframeWin) {
        if (!element || !iframeWin || this.isInsidePhoneFrame(element)) return false;

        const doc = element.ownerDocument;
        const docEl = doc?.documentElement;
        const body = doc?.body;
        if (!docEl || !body) return false;

        const scrollHeight = Math.max(docEl.scrollHeight || 0, body.scrollHeight || 0);
        const viewportHeight = iframeWin.innerHeight || docEl.clientHeight || 0;
        return scrollHeight > viewportHeight + 1;
    }

    scrollAnnotationTargetInsideIframePage(element, iframeWin, options = {}) {
        if (!this.canScrollIframeToAnnotationTarget(element, iframeWin)) return false;

        const rect = element.getBoundingClientRect();
        const targetTop = iframeWin.scrollY
            + rect.top
            - Math.max(24, (iframeWin.innerHeight - rect.height) / 2);

        iframeWin.scrollTo({
            top: Math.max(0, targetTop),
            behavior: options.behavior || 'smooth'
        });

        return true;
    }

    isInsidePhoneFrame(element) {
        return Boolean(element?.closest?.('#phoneScreen, .phone-screen, .phone-shell, .demo-stage'));
    }

    scrollAnnotationCardIntoView(sourceIndex) {
        const card = this.annotationDrawerBody?.querySelector?.(`[data-annotation-card="${sourceIndex}"]`);
        card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }

    togglePrdDrawerExpanded() {
        this.prdDrawerFullscreen = !this.prdDrawerFullscreen;
        this.renderAnnotationDrawer();
    }

    useDefaultPrdDrawerWidth({ expanded = this.docDrawerExpanded } = {}) {
        this.prdDrawerWidth = null;
        this.docDrawerExpanded = Boolean(expanded);
        document.documentElement.style.removeProperty('--prd-drawer-width');
    }

    getPrdDrawerWidthBounds() {
        const viewportWidth = window.innerWidth || 1200;
        const resizeBreakpoint = this.getCssVariable('--resize-breakpoint-width', 860);
        if (viewportWidth <= resizeBreakpoint) {
            return { min: viewportWidth, max: viewportWidth };
        }

        const agentPanelWidthDefault = this.getCssVariable('--agent-panel-width', 660);
        const sidebarWidth = this.getCssVariable('--sidebar-width', 260);
        const agentWidth = this.agentWorkbenchOpen ? (this.agentPanelWidth || agentPanelWidthDefault) : sidebarWidth;
        const stageMinWidth = this.getCssVariable('--viewport-min-width', 440);
        const prdMinWidth = this.getCssVariable('--prd-drawer-min-width', 320);

        const reservedWidth = agentWidth + stageMinWidth;
        const maxVal = Math.max(prdMinWidth, viewportWidth - reservedWidth);
        const minVal = Math.min(prdMinWidth, maxVal);

        return {
            min: minVal,
            max: maxVal
        };
    }

    normalizePrdDrawerWidth(value) {
        const { min, max } = this.getPrdDrawerWidthBounds();
        const numeric = Number(value);
        const prdDefaultWidth = this.getCssVariable('--prd-drawer-width', 760);
        const prdCollapsedWidth = this.getCssVariable('--prd-drawer-collapsed-width', 520);
        const fallback = this.annotationDrawer?.getBoundingClientRect?.().width || (this.docDrawerExpanded ? prdDefaultWidth : prdCollapsedWidth);
        const width = Number.isFinite(numeric) ? numeric : fallback;
        return Math.round(Math.min(Math.max(width, min), max));
    }

    applyPrdDrawerWidth(width) {
        this.prdDrawerWidth = this.normalizePrdDrawerWidth(width);
        this.docDrawerExpanded = true;
        document.documentElement.style.setProperty('--prd-drawer-width', `${this.prdDrawerWidth}px`);
        this.annotationDrawer?.classList.add('is-user-sized', 'is-expanded');
    }

    startPrdDrawerResize(event) {
        if (!['prd', 'diagram', 'mindmap'].includes(this.docDrawerMode) || !this.annotationDrawer?.classList.contains('is-visible')) return;
        const resizeBreakpoint = this.getCssVariable('--resize-breakpoint-width', 860);
        if ((window.innerWidth || 0) <= resizeBreakpoint) return;

        event.preventDefault();
        this._prdDrawerResizeState = {
            startX: event.clientX,
            startWidth: this.annotationDrawer.getBoundingClientRect().width
        };
        document.body.classList.add('is-resizing-prd-drawer');
        this.prdDrawerResizeHandle?.setPointerCapture?.(event.pointerId);
        window.addEventListener('pointermove', this.handlePrdDrawerResizeMove);
        window.addEventListener('pointerup', this.stopPrdDrawerResize, { once: true });
        window.addEventListener('pointercancel', this.stopPrdDrawerResize, { once: true });
    }

    handlePrdDrawerResizeMove = (event) => {
        if (!this._prdDrawerResizeState) return;
        const nextWidth = this._prdDrawerResizeState.startWidth + this._prdDrawerResizeState.startX - event.clientX;
        this.applyPrdDrawerWidth(nextWidth);
        this.refreshAnnotationUI();
    };

    stopPrdDrawerResize = () => {
        if (!this._prdDrawerResizeState) return;
        this._prdDrawerResizeState = null;
        document.body.classList.remove('is-resizing-prd-drawer');
        window.removeEventListener('pointermove', this.handlePrdDrawerResizeMove);
        this.persistPrdDrawerWidth();
    };

    hideAnnotationDrawer() {
        if (!this.annotationDrawer) return;
        this.annotationDrawer.classList.remove('is-visible');
        this.annotationDrawer.classList.remove('is-prd-mode', 'is-drawio-mode', 'is-mindmap-mode', 'is-expanded', 'is-user-sized', 'is-fullscreen', 'has-pinned-toc');
        this.viewportContainer.classList.remove('has-drawer');
        if (this.prdEditBtn) this.prdEditBtn.hidden = true;
        if (this.prdSaveBtn) this.prdSaveBtn.hidden = true;
        if (this.prdCancelEditBtn) this.prdCancelEditBtn.hidden = true;
        if (this.prdOpenNewTabBtn) this.prdOpenNewTabBtn.hidden = true;
        if (this.prdDownloadBtn) this.prdDownloadBtn.hidden = true;
        if (this.prdExpandBtn) this.prdExpandBtn.hidden = true;

        const existingToc = this.annotationDrawer.querySelector('.prd-toc-floating');
        if (existingToc) {
            existingToc.remove();
        }
        if (this.prdModule?.renderer?._tocCleanup) {
            this.prdModule.renderer._tocCleanup();
            this.prdModule.renderer._tocCleanup = null;
        }
        this._lastPrdHeadingsHash = null;
        this.prdDrawerFullscreen = false;
    }

    setupIframeObservers() {
        if (this._iframeRefreshListeners.length > 0 || this._iframeMutationObserver) return;
        const iframeDoc = this.mainIframe.contentDocument;
        const iframeWin = this.mainIframe.contentWindow;
        if (!iframeDoc || !iframeWin) return;

        const refresh = () => this.scheduleVisibleAnnotationRefresh();
        const eventTargets = [
            [iframeDoc, 'click'],
            [iframeDoc, 'input'],
            [iframeDoc, 'change'],
            [iframeDoc, 'keyup'],
            [iframeDoc, 'scroll'],
            [iframeWin, 'scroll'],
            [iframeWin, 'resize'],
            [iframeDoc, 'prota:frame-fit'],
            [iframeDoc, 'transitionend'],
            [iframeDoc, 'animationend']
        ];

        eventTargets.forEach(([target, eventName]) => {
            target.addEventListener(eventName, refresh, true);
            this._iframeRefreshListeners.push([target, eventName, refresh]);
        });

        if (iframeDoc.body) {
            this._iframeMutationObserver = new MutationObserver(refresh);
            this._iframeMutationObserver.observe(iframeDoc.body, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
            });
        }
    }

    teardownIframeObservers() {
        if (this._annotationRefreshRaf) {
            window.cancelAnimationFrame(this._annotationRefreshRaf);
            this._annotationRefreshRaf = null;
        }

        if (this._iframeMutationObserver) {
            this._iframeMutationObserver.disconnect();
            this._iframeMutationObserver = null;
        }

        this._iframeRefreshListeners.forEach(([target, eventName, handler]) => {
            target.removeEventListener(eventName, handler, true);
        });
        this._iframeRefreshListeners = [];
    }

    resolveSelectedElement(selector, meta) {
        return this.resolveAnnotationTarget(
            { selector, meta },
            this.mainIframe.contentDocument,
            this.mainIframe.contentWindow,
            { requireViewportVisible: false }
        )?.element || null;
    }

    findExistingAnnotationIndex(selector, element) {
        const exactIndex = this.currentAnnotations.findIndex((item) => item.selector === selector);
        if (exactIndex >= 0) return exactIndex;
        if (!element) return -1;

        for (let index = 0; index < this.currentAnnotations.length; index += 1) {
            const resolved = this.resolveAnnotationTarget(this.currentAnnotations[index]);
            if (resolved?.element === element) {
                return index;
            }
        }

        return -1;
    }

    buildElementSelector(el) {
        if (!el || el.nodeType !== 1) return '';
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc) return '';

        const escapeIdentifier = (value) => {
            if (window.CSS && typeof window.CSS.escape === 'function') {
                return window.CSS.escape(value);
            }
            return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => '\\' + char);
        };

        const isUnique = (sel) => {
            try {
                return iframeDoc.querySelectorAll(sel).length === 1;
            } catch {
                return false;
            }
        };

        if (el.id) {
            const idSelector = '#' + escapeIdentifier(el.id);
            if (isUnique(idSelector)) return idSelector;
        }

        const attrNames = ['data-testid', 'data-test', 'data-qa', 'name', 'aria-label', 'title'];
        const tag = el.tagName.toLowerCase();
        for (let i = 0; i < attrNames.length; i++) {
            const attrName = attrNames[i];
            const attrValue = el.getAttribute(attrName);
            if (!attrValue) continue;
            const attrSelector = tag + '[' + attrName + '="' + attrValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
            if (isUnique(attrSelector)) return attrSelector;
        }

        const getIndexWithinType = (element) => {
            let index = 1;
            let current = element;
            while ((current = current.previousElementSibling)) {
                if (current.tagName === element.tagName) index += 1;
            }
            return index;
        };

        const getStableClasses = (element) => {
            return Array.from(element.classList || []).filter((className) => {
                return className && !className.startsWith('__readify');
            }).slice(0, 3);
        };

        const buildSegment = (element) => {
            const tagName = element.tagName.toLowerCase();
            const classes = getStableClasses(element).map(c => '.' + escapeIdentifier(c)).join('');
            return `${tagName}${classes}:nth-of-type(${getIndexWithinType(element)})`;
        };

        const parts = [];
        let current = el;
        while (current && current.nodeType === 1 && current !== iframeDoc.documentElement) {
            parts.unshift(buildSegment(current));
            const selector = parts.join(' > ');
            if (isUnique(selector)) return selector;

            current = current.parentElement;
            if (current === iframeDoc.body) {
                parts.unshift('body');
                const bodySel = parts.join(' > ');
                if (isUnique(bodySel)) return bodySel;
                break;
            }
        }

        return parts.join(' > ');
    }

    selectElementFromParent(el) {
        if (!el) return;
        const selector = this.buildElementSelector(el);
        const rect = el.getBoundingClientRect();
        
        // Update selection class inside iframe
        const iframeDoc = this.mainIframe.contentDocument;
        if (iframeDoc) {
            iframeDoc.querySelectorAll('.__readify_selected').forEach((item) => {
                item.classList.remove('__readify_selected');
            });
            el.classList.add('__readify_selected');
        }

        const meta = {
            tagName: el.tagName,
            textContent: (el.textContent || '').trim().substring(0, 100),
            className: Array.from(el.classList || []).filter(c => !c.startsWith('__readify')).join(' '),
            id: el.id || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            title: el.getAttribute('title') || '',
            rect: {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
                viewportWidth: this.mainIframe.contentWindow.innerWidth,
                viewportHeight: this.mainIframe.contentWindow.innerHeight
            }
        };

        this.showAnnotationDialog(selector, meta);
    }

    selectParentAnnotationElement() {
        if (!this.pendingAnnotation || !this.pendingAnnotation.element) return;
        const currentEl = this.pendingAnnotation.element;
        const parentEl = currentEl.parentElement;
        const iframeDoc = this.mainIframe.contentDocument;
        if (parentEl && parentEl !== iframeDoc.body && parentEl !== iframeDoc.documentElement) {
            this.selectElementFromParent(parentEl);
        }
    }

    selectChildAnnotationElement() {
        if (!this.pendingAnnotation || !this.pendingAnnotation.element) return;
        const currentEl = this.pendingAnnotation.element;
        const children = Array.from(currentEl.children);
        const iframeWin = this.mainIframe.contentWindow;
        const visibleChild = children.find(child => {
            if (!iframeWin) return false;
            try {
                const style = iframeWin.getComputedStyle(child);
                return style.display !== 'none' && style.visibility !== 'hidden' && child.getBoundingClientRect().width > 1;
            } catch {
                return false;
            }
        });
        if (visibleChild) {
            this.selectElementFromParent(visibleChild);
        }
    }

    getIframeRectInStage(rect) {
        if (!rect || typeof rect.left !== 'number' || !this.mainIframe || !this.viewportStage) {
            return null;
        }

        const iframeRect = this.mainIframe.getBoundingClientRect();
        const stageRect = this.viewportStage.getBoundingClientRect();
        const scaleX = rect.viewportWidth ? iframeRect.width / rect.viewportWidth : 1;
        const scaleY = rect.viewportHeight ? iframeRect.height / rect.viewportHeight : 1;
        const left = iframeRect.left - stageRect.left + (rect.left * scaleX);
        const top = iframeRect.top - stageRect.top + (rect.top * scaleY);
        const width = Math.max(1, rect.width * scaleX);
        const height = Math.max(1, rect.height * scaleY);

        return {
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height
        };
    }

    ensureAnnotationHoverBox() {
        if (this.annotationHoverBox) return this.annotationHoverBox;
        if (!this.viewportStage) return null;

        this.annotationHoverBox = document.createElement('div');
        this.annotationHoverBox.className = 'annotation-hover-box';
        this.annotationHoverBox.setAttribute('aria-hidden', 'true');
        this.annotationHoverBox.innerHTML = `
            <div class="annotation-hover-box__label"></div>
        `;
        this.viewportStage.appendChild(this.annotationHoverBox);
        return this.annotationHoverBox;
    }

    getAnnotationHoverLabel(payload) {
        const tag = String(payload?.tagName || '').toLowerCase();
        const selector = String(payload?.selector || '');
        const text = String(payload?.textContent || '').replace(/\s+/g, ' ').trim();
        const labelText = text ? ` · ${text.substring(0, 24)}` : '';
        return `${tag || 'element'}${labelText}${selector ? ` · ${selector}` : ''}`;
    }

    showAnnotationHover(payload) {
        if (!this.annotationMode || this.annotationPanel?.style.display === 'flex') return;
        const rect = this.getIframeRectInStage(payload?.rect);
        const box = this.ensureAnnotationHoverBox();
        if (!rect || !box) return;

        const label = box.querySelector('.annotation-hover-box__label');
        if (label) label.textContent = this.getAnnotationHoverLabel(payload);

        box.style.display = 'block';
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
    }

    hideAnnotationHover() {
        if (!this.annotationHoverBox) return;
        this.annotationHoverBox.style.display = 'none';
    }

    showAnnotationDialog(selector, meta) {
        if (!this.annotationPanel) {
            this.annotationPanel = document.createElement('div');
            this.annotationPanel.className = 'annotation-dialog';
            this.annotationPanel.innerHTML = `
                <div class="annotation-dialog__header">
                    <div class="annotation-dialog__target-badge">
                        <svg class="annotation-dialog__target-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                        <span class="annotation-dialog__selector" title="点击复制 CSS 选择器"></span>
                    </div>
                    <button class="annotation-dialog__close-btn" title="取消 (Esc)" type="button">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <textarea class="annotation-dialog__textarea"
                          placeholder="描述该元素的产品逻辑..."
                          rows="3"></textarea>
                <div class="annotation-dialog__footer">
                    <button class="btn annotation-dialog__save" title="保存标注到文档抽屉" type="button">
                        保存标注
                    </button>
                    <button class="btn btn-primary annotation-dialog__add-feedback" title="发给 Prota 并触发自动修改" type="button">
                        发给 Prota
                    </button>
                </div>
            `;
            this.viewportStage.appendChild(this.annotationPanel);

            this.annotationPanel.querySelector('.annotation-dialog__close-btn')
                .addEventListener('click', () => this.cancelAnnotation());
            this.annotationPanel.querySelector('.annotation-dialog__save')
                .addEventListener('click', () => this.saveCurrentAnnotation());
            this.annotationPanel.querySelector('.annotation-dialog__add-feedback')
                .addEventListener('click', () => this.addFeedbackFromAnnotation());

            // Click selector to copy to clipboard
            this.annotationPanel.querySelector('.annotation-dialog__selector')
                .addEventListener('click', (e) => {
                    const text = e.currentTarget.dataset.selector;
                    if (text) {
                        navigator.clipboard.writeText(text).then(() => {
                            this.showToast('选择器已复制到剪贴板');
                        }).catch(() => {});
                    }
                });

            // Fast Input Shortcuts (Enter -> Prota, Shift+Enter -> Newline, Esc -> Cancel)
            const textarea = this.annotationPanel.querySelector('.annotation-dialog__textarea');
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (e.shiftKey) {
                        // Let browser handle multi-line newline insertion
                    } else {
                        e.preventDefault();
                        this.addFeedbackFromAnnotation();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelAnnotation();
                }
            });
        }

        const selectedElement = this.resolveSelectedElement(selector, meta);
        const existingIdx = this.findExistingAnnotationIndex(selector, selectedElement);
        const existing = existingIdx >= 0 ? this.currentAnnotations[existingIdx] : null;
        const selectorLabel = this.annotationPanel.querySelector('.annotation-dialog__selector');
        const rawLabel = meta?.ariaLabel || meta?.title || meta?.textContent || selector;
        const readableLabel = String(rawLabel).replace(/\s+/g, ' ').trim();
        selectorLabel.textContent = readableLabel.length > 46
            ? `${readableLabel.slice(0, 45)}…`
            : readableLabel;
        selectorLabel.dataset.selector = selector;
        this.annotationPanel.querySelector('.annotation-dialog__textarea').value =
            existing ? existing.description : '';
        const copyText = this.getDirectEditableText(selectedElement);

        this.pendingAnnotation = {
            selector,
            meta,
            element: selectedElement,
            existingIdx
        };
        this.jumpBindingTargetSelector = selector;
        this.jumpBindingExistingPageId = selectedElement?.getAttribute?.('data-link-to') || '';
        this.jumpBindingTargetPageId = this.jumpBindingExistingPageId;
        this.annotationLinkSaving = false;
        const linkPanel = this.ensureAnnotationLinkPanel();
        const linkSearch = linkPanel.querySelector('.annotation-dialog__link-search input');
        if (linkSearch) linkSearch.value = '';
        this.hideAnnotationLinkPanel();
        linkPanel.hidden = false;
        this.renderAnnotationLinkPages();
        this.refreshAnnotationLinkUI();

        this.annotationPanel.style.display = 'flex';
        const stageRect = this.getIframeRectInStage(meta?.rect) || meta?.rect;
        this.positionAnnotationDialog(stageRect);
        this.positionAnnotationLinkTrigger();
        this.renderAnnotationCopyPanel(copyText, stageRect);
        this.annotationPanel.querySelector('.annotation-dialog__textarea').focus();
    }

    hideAnnotationLinkTrigger() {
        if (!this.annotationLinkPanel) return;
        this.annotationLinkPanel.hidden = true;
        this.annotationLinkPanel.classList.remove('is-expanded');
        this.annotationLinkTrigger?.setAttribute('aria-expanded', 'false');
    }

    positionAnnotationLinkTrigger() {
        this.positionAnnotationLinkPanel();
    }

    ensureAnnotationLinkPanel() {
        if (this.annotationLinkPanel) return this.annotationLinkPanel;
        const panel = document.createElement('div');
        panel.className = 'annotation-link-panel';
        panel.hidden = true;
        panel.innerHTML = `
            <button class="annotation-dialog__link-trigger" type="button" title="设置页面链接" aria-label="设置页面链接" aria-expanded="false">
                <span class="annotation-dialog__link-trigger-copy">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.8-1.7"></path></svg>
                    <span class="annotation-dialog__link-label">页面链接</span>
                    <i class="annotation-dialog__link-dot" aria-hidden="true"></i>
                </span>
                <span class="annotation-dialog__link-state">设置</span>
                <svg class="annotation-dialog__link-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
            </button>
            <div class="annotation-link-panel__content" hidden>
                <label class="annotation-dialog__link-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.2-3.2"></path></svg>
                    <input type="search" placeholder="搜索页面" autocomplete="off">
                </label>
                <div class="annotation-dialog__link-list" role="radiogroup" aria-label="目标页面"></div>
                <div class="annotation-dialog__link-empty" hidden>没有匹配的页面</div>
                <div class="annotation-link-panel__footer">
                    <div class="annotation-dialog__link-status" role="status" aria-live="polite"></div>
                    <button class="annotation-dialog__link-remove" type="button" hidden>移除链接</button>
                </div>
            </div>
        `;
        const trigger = panel.querySelector('.annotation-dialog__link-trigger');
        trigger.addEventListener('click', () => this.toggleAnnotationLinkPanel());
        panel.querySelector('.annotation-dialog__link-search input')
            .addEventListener('input', () => this.renderAnnotationLinkPages());
        panel.querySelector('.annotation-dialog__link-list')
            .addEventListener('click', (event) => {
                const target = event.target.closest('[data-annotation-link-target]');
                if (!target) return;
                this.selectAndSaveAnnotationLink(target.dataset.annotationLinkTarget || '');
            });
        panel.querySelector('.annotation-dialog__link-remove')
            .addEventListener('click', () => this.removeAnnotationLink());
        this.viewportStage?.appendChild(panel);
        this.annotationLinkPanel = panel;
        this.annotationLinkTrigger = trigger;
        return panel;
    }

    toggleAnnotationLinkPanel() {
        const panel = this.ensureAnnotationLinkPanel();
        const content = panel.querySelector('.annotation-link-panel__content');
        if (panel.classList.contains('is-expanded')) {
            this.hideAnnotationLinkPanel({ restoreCopy: true });
            return;
        }

        this.hideAnnotationCopyPanel();
        panel.classList.add('is-expanded');
        if (content) content.hidden = false;
        this.annotationLinkTrigger?.setAttribute('aria-expanded', 'true');
        this.renderAnnotationLinkPages();
        this.refreshAnnotationLinkUI();
        this.positionAnnotationLinkPanel();
        panel.querySelector('.annotation-dialog__link-search input')?.focus();
    }

    hideAnnotationLinkPanel({ restoreCopy = false } = {}) {
        const content = this.annotationLinkPanel?.querySelector('.annotation-link-panel__content');
        this.annotationLinkPanel?.classList.remove('is-expanded');
        if (content) content.hidden = true;
        this.annotationLinkTrigger?.setAttribute('aria-expanded', 'false');
        this.positionAnnotationLinkPanel();
        if (restoreCopy && this.pendingAnnotation?.element) {
            const copyText = this.getDirectEditableText(this.pendingAnnotation.element);
            const rect = this.getIframeRectInStage(this.pendingAnnotation.meta?.rect)
                || this.pendingAnnotation.meta?.rect;
            this.renderAnnotationCopyPanel(copyText, rect);
        }
    }

    positionAnnotationLinkPanel() {
        if (!this.annotationLinkPanel || this.annotationLinkPanel.hidden || !this.annotationPanel || !this.viewportStage) return;
        const stageRect = this.viewportStage.getBoundingClientRect();
        const linkRect = this.annotationLinkPanel.getBoundingClientRect();
        const margin = 16;
        const gap = 10;
        const width = this.annotationPanel.offsetWidth || 320;
        const height = linkRect.height || 44;
        const copyHeight = this.annotationCopyPanel && !this.annotationCopyPanel.hidden
            ? this.annotationCopyPanel.offsetHeight + gap
            : 0;
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const maxLeft = Math.max(margin, stageRect.width - width - margin);
        const maxTop = Math.max(margin, stageRect.height - height - margin);

        const belowTop = this.annotationPanel.offsetTop + this.annotationPanel.offsetHeight + gap;
        const aboveTop = this.annotationPanel.offsetTop - height - gap;
        const top = belowTop + height + copyHeight <= stageRect.height - margin
            ? belowTop
            : aboveTop;

        this.annotationLinkPanel.style.width = `${width}px`;
        this.annotationLinkPanel.style.left = `${clamp(this.annotationPanel.offsetLeft, margin, maxLeft)}px`;
        this.annotationLinkPanel.style.top = `${clamp(top, margin, maxTop)}px`;
    }

    renderAnnotationLinkPages() {
        const panel = this.ensureAnnotationLinkPanel();
        const list = panel.querySelector('.annotation-dialog__link-list');
        const empty = panel.querySelector('.annotation-dialog__link-empty');
        const search = panel.querySelector('.annotation-dialog__link-search input');
        if (!list || !empty) return;

        const query = String(search?.value || '').trim().toLocaleLowerCase('zh-CN');
        const pages = this.getActivePagesSorted()
            .filter((page) => page.id !== this.activePageId)
            .filter((page) => {
                if (!query) return true;
                return `${page.name || ''} ${page.id || ''}`.toLocaleLowerCase('zh-CN').includes(query);
            });

        list.innerHTML = '';
        pages.forEach((page) => {
            const selected = page.id === this.jumpBindingTargetPageId;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `annotation-dialog__link-page${selected ? ' is-selected' : ''}`;
            button.dataset.annotationLinkTarget = page.id;
            button.setAttribute('role', 'radio');
            button.setAttribute('aria-checked', selected ? 'true' : 'false');
            button.disabled = this.annotationLinkSaving;
            button.innerHTML = `
                <span class="annotation-dialog__link-page-icon" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h10l4 4v14H5z"></path><path d="M15 3v5h5"></path></svg>
                </span>
                <span class="annotation-dialog__link-page-copy">
                    <strong>${this.escapeHtml(page.name || page.id)}</strong>
                    <small>${this.escapeHtml(page.activeVersion || page.versions?.[0] || '')}</small>
                </span>
                <svg class="annotation-dialog__link-page-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
            `;
            list.appendChild(button);
        });

        empty.toggleAttribute('hidden', pages.length > 0);
    }

    refreshAnnotationLinkUI({ status = '', tone = '' } = {}) {
        if (!this.annotationPanel) return;
        const panel = this.ensureAnnotationLinkPanel();
        const remove = panel.querySelector('.annotation-dialog__link-remove');
        const statusEl = panel.querySelector('.annotation-dialog__link-status');
        const dot = this.annotationLinkTrigger?.querySelector('.annotation-dialog__link-dot');
        const triggerState = this.annotationLinkTrigger?.querySelector('.annotation-dialog__link-state');
        const hasExisting = Boolean(this.jumpBindingExistingPageId);
        const linkedPage = this.getPageRecord(this.jumpBindingExistingPageId);

        if (remove) {
            remove.toggleAttribute('hidden', !hasExisting);
            remove.disabled = this.annotationLinkSaving;
        }
        if (dot) dot.classList.toggle('is-visible', hasExisting);
        if (triggerState) {
            triggerState.textContent = linkedPage
                ? linkedPage.name || linkedPage.id
                : '设置';
        }
        if (statusEl) {
            statusEl.className = `annotation-dialog__link-status${tone ? ` is-${tone}` : ''}`;
            statusEl.textContent = status
                || (linkedPage ? `已连接至「${linkedPage.name || linkedPage.id}」` : '选择一个页面即可建立链接');
        }
    }

    async selectAndSaveAnnotationLink(pageId) {
        if (!pageId || this.annotationLinkSaving) return;
        if (pageId === this.jumpBindingExistingPageId) {
            this.refreshAnnotationLinkUI();
            return;
        }

        const previousPageId = this.jumpBindingExistingPageId;
        this.jumpBindingTargetPageId = pageId;
        this.renderAnnotationLinkPages();
        const saved = await this.saveJumpBinding(pageId);
        if (!saved) {
            this.jumpBindingTargetPageId = previousPageId;
            this.renderAnnotationLinkPages();
        }
    }

    async removeAnnotationLink() {
        if (!this.jumpBindingExistingPageId || this.annotationLinkSaving) return;
        const removed = await this.saveJumpBinding('');
        if (removed) {
            this.jumpBindingTargetPageId = '';
            this.renderAnnotationLinkPages();
        }
    }

    positionAnnotationDialog(rect) {
        if (!this.annotationPanel || !this.viewportStage) return;

        const stageRect = this.viewportStage.getBoundingClientRect();
        const panelRect = this.annotationPanel.getBoundingClientRect();
        const gap = 12;
        const margin = 16;
        const panelWidth = panelRect.width || 320;
        const panelHeight = panelRect.height || 180;

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const maxLeft = Math.max(margin, stageRect.width - panelWidth - margin);
        const maxTop = Math.max(margin, stageRect.height - panelHeight - margin);

        if (!rect || typeof rect.left !== 'number') {
            this.annotationPanel.style.left = `${maxLeft}px`;
            this.annotationPanel.style.top = `${margin}px`;
            window.requestAnimationFrame(() => {
                this.positionAnnotationLinkTrigger();
                this.positionAnnotationLinkPanel();
            });
            return;
        }

        let left = rect.right + gap;
        const canPlaceRight = left + panelWidth + margin <= stageRect.width;
        const canPlaceLeft = rect.left - gap - panelWidth >= margin;

        if (!canPlaceRight && canPlaceLeft) {
            left = rect.left - gap - panelWidth;
        } else if (!canPlaceRight) {
            left = clamp(rect.left, margin, maxLeft);
        }

        let top = rect.top;
        const canAlignBeside = canPlaceRight || canPlaceLeft;
        if (!canAlignBeside && rect.bottom + gap + panelHeight <= stageRect.height - margin) {
            top = rect.bottom + gap;
        } else if (!canAlignBeside && rect.top - gap - panelHeight >= margin) {
            top = rect.top - gap - panelHeight;
        }

        this.annotationPanel.style.left = `${clamp(left, margin, maxLeft)}px`;
        this.annotationPanel.style.top = `${clamp(top, margin, maxTop)}px`;
        window.requestAnimationFrame(() => {
            this.positionAnnotationLinkTrigger();
            this.positionAnnotationCopyPanel(rect);
            this.positionAnnotationLinkPanel();
        });
    }

    ensureAnnotationCopyPanel() {
        if (this.annotationCopyPanel) return this.annotationCopyPanel;
        const panel = document.createElement('div');
        panel.className = 'annotation-copy-panel';
        panel.hidden = true;
        panel.innerHTML = `
            <input class="annotation-copy-panel__input"
                   type="text"
                   aria-label="修改选中文案"
                   placeholder="修改这段文案...">
            <button class="annotation-copy-panel__sync" type="button" title="同步到代码" aria-label="同步到代码">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"></path>
                </svg>
            </button>
        `;
        panel.querySelector('.annotation-copy-panel__sync')
            .addEventListener('click', () => this.syncAnnotationCopyToCode());
        panel.querySelector('.annotation-copy-panel__input')
            .addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.syncAnnotationCopyToCode();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    this.hideAnnotationCopyPanel();
                }
            });
        this.viewportStage?.appendChild(panel);
        this.annotationCopyPanel = panel;
        return panel;
    }

    renderAnnotationCopyPanel(copyText, targetRect) {
        const panel = this.ensureAnnotationCopyPanel();
        if (!copyText) {
            this.hideAnnotationCopyPanel();
            return;
        }
        const input = panel.querySelector('.annotation-copy-panel__input');
        if (input) input.value = copyText;
        panel.hidden = false;
        if (this.annotationPanel) {
            const annotationWidth = this.annotationPanel.offsetWidth
                || parseFloat(getComputedStyle(this.annotationPanel).width)
                || 320;
            panel.style.width = `${annotationWidth}px`;
        }
        this.positionAnnotationCopyPanel(targetRect);
    }

    positionAnnotationCopyPanel(rect) {
        if (!this.annotationCopyPanel || !this.viewportStage) return;
        const stageRect = this.viewportStage.getBoundingClientRect();
        const panelRect = this.annotationCopyPanel.getBoundingClientRect();
        const gap = 10;
        const margin = 16;
        const panelWidth = panelRect.width || 320;
        const panelHeight = panelRect.height || 42;
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const maxLeft = Math.max(margin, stageRect.width - panelWidth - margin);
        const maxTop = Math.max(margin, stageRect.height - panelHeight - margin);

        let left = margin;
        let top = margin;
        if (this.annotationLinkPanel && !this.annotationLinkPanel.hidden) {
            left = this.annotationLinkPanel.offsetLeft;
            const triggerIsBelow = this.annotationLinkPanel.offsetTop > this.annotationPanel.offsetTop;
            top = triggerIsBelow
                ? this.annotationLinkPanel.offsetTop + this.annotationLinkPanel.offsetHeight + gap
                : this.annotationLinkPanel.offsetTop - panelHeight - gap;
        } else if (this.annotationPanel) {
            left = this.annotationPanel.offsetLeft;
            const belowTop = this.annotationPanel.offsetTop + this.annotationPanel.offsetHeight + gap;
            const aboveTop = this.annotationPanel.offsetTop - panelHeight - gap;
            top = belowTop + panelHeight <= stageRect.height - margin ? belowTop : aboveTop;
        } else if (rect) {
            left = rect.left;
            const belowTop = rect.bottom + gap;
            const aboveTop = rect.top - panelHeight - gap;
            top = belowTop + panelHeight <= stageRect.height - margin
                ? belowTop
                : aboveTop;
        }

        this.annotationCopyPanel.style.left = `${clamp(left, margin, maxLeft)}px`;
        this.annotationCopyPanel.style.top = `${clamp(top, margin, maxTop)}px`;
    }

    hideAnnotationCopyPanel() {
        if (!this.annotationCopyPanel) return;
        this.annotationCopyPanel.hidden = true;
    }

    saveCurrentAnnotation() {
        if (!this.pendingAnnotation || !this.annotationPanel) return;

        const description = this.annotationPanel.querySelector('.annotation-dialog__textarea').value.trim();
        if (!description) {
            this.showToast('请输入描述内容', true);
            return;
        }

        const existingIdx = Number.isInteger(this.pendingAnnotation.existingIdx)
            ? this.pendingAnnotation.existingIdx
            : this.findExistingAnnotationIndex(
                this.pendingAnnotation.selector,
                this.pendingAnnotation.element
            );

        if (existingIdx >= 0) {
            this.currentAnnotations[existingIdx].selector = this.pendingAnnotation.selector;
            this.currentAnnotations[existingIdx].description = description;
            this.currentAnnotations[existingIdx].timestamp = new Date().toISOString();
            this.currentAnnotations[existingIdx].meta = this.pendingAnnotation.meta;
        } else {
            this.currentAnnotations.push({
                id: `ann_${String(this.currentAnnotations.length + 1).padStart(3, '0')}`,
                selector: this.pendingAnnotation.selector,
                description,
                timestamp: new Date().toISOString(),
                meta: this.pendingAnnotation.meta
            });
        }

        this.saveAnnotations();
        this.clearIframeSelection();
        this.annotationPanel.style.display = 'none';
        this.hideAnnotationLinkTrigger();
        this.hideAnnotationLinkPanel();
        this.hideAnnotationCopyPanel();
        this.pendingAnnotation = null;
        this.refreshAnnotationUI();
    }

    deleteAnnotation(annotationIndex) {
        if (!Number.isInteger(annotationIndex)) return;
        if (annotationIndex < 0 || annotationIndex >= this.currentAnnotations.length) return;

        this.currentAnnotations.splice(annotationIndex, 1);
        if (this.activeAnnotationSourceIndex === annotationIndex) {
            this.activeAnnotationSourceIndex = null;
            this.clearAnnotationFocus();
        } else if (this.activeAnnotationSourceIndex > annotationIndex) {
            this.activeAnnotationSourceIndex -= 1;
        }
        this.saveAnnotations('注解已删除');
        this.refreshAnnotationUI();
    }

    cancelAnnotation() {
        this.clearIframeSelection();
        if (this.annotationPanel) {
            this.annotationPanel.style.display = 'none';
        }
        this.hideAnnotationLinkTrigger();
        this.hideAnnotationLinkPanel();
        this.hideAnnotationCopyPanel();
        this.pendingAnnotation = null;
        this.jumpBindingTargetSelector = null;
        this.jumpBindingTargetPageId = '';
        this.jumpBindingExistingPageId = '';
        this.annotationLinkSaving = false;
    }

    // ── Feedback Collection ───────────────────────────────

    captureElementContext(selector, meta) {
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc) return {};
        let element = null;
        try {
            element = iframeDoc.querySelector(selector);
        } catch (_) {
            return {};
        }
        if (!element) return {};

        const htmlSnippet = element.outerHTML.length > 2000
            ? element.outerHTML.substring(0, 2000) + '...'
            : element.outerHTML;

        const iframeWin = this.mainIframe.contentWindow;
        const computedStyle = iframeWin ? iframeWin.getComputedStyle(element) : null;
        const relevantStyles = {};
        if (computedStyle) {
            const props = [
                'display', 'flex-direction', 'align-items', 'justify-content',
                'width', 'height', 'padding', 'margin', 'font-size', 'font-weight',
                'color', 'background-color', 'border', 'border-radius',
                'position', 'top', 'left', 'right', 'bottom', 'z-index',
                'overflow', 'gap', 'grid-template-columns', 'opacity',
                'text-align', 'line-height', 'text-decoration'
            ];
            props.forEach(prop => {
                const val = computedStyle.getPropertyValue(prop);
                if (val) relevantStyles[prop] = val;
            });
        }

        const parentElement = element.parentElement;
        let parentHtmlSnippet = '';
        if (parentElement && parentElement !== iframeDoc.body) {
            parentHtmlSnippet = parentElement.outerHTML.length > 1000
                ? parentElement.outerHTML.substring(0, 1000) + '...'
                : parentElement.outerHTML;
        }

        return {
            htmlSnippet,
            relevantStyles,
            parentHtmlSnippet,
            tagName: element.tagName,
            className: element.className || '',
            id: element.id || '',
            textContent: (element.textContent || '').trim().substring(0, 300),
            childCount: element.children.length,
            attributes: Array.from(element.attributes || []).reduce((acc, attr) => {
                if (!attr.name.startsWith('data-readify') &&
                    attr.name !== 'class' &&
                    attr.name !== 'style' &&
                    !attr.name.startsWith('__readify')) {
                    acc[attr.name] = attr.value;
                }
                return acc;
            }, {})
        };
    }

    addFeedbackFromAnnotation() {
        if (!this.annotationPanel) return;
        const description = this.annotationPanel.querySelector('.annotation-dialog__textarea').value.trim();
        if (!description) {
            this.showToast('请先描述你想要的改变', true);
            return;
        }
        if (!this.pendingAnnotation) return;

        const { selector, meta } = this.pendingAnnotation;
        const elementContext = this.captureElementContext(selector, meta);

        this.feedbackItems.push({
            selector,
            meta,
            elementContext,
            description,
            timestamp: new Date().toISOString()
        });

        this.cancelAnnotation();
        this.openAgentWorkbench();
        this.renderFeedbackPanel();
        this.showToast('反馈已添加，可继续选择其他元素');
    }

    removeFeedbackItem(index) {
        if (index < 0 || index >= this.feedbackItems.length) return;
        this.feedbackItems.splice(index, 1);
        this.renderFeedbackPanel();
    }

    clearAllFeedback() {
        this.feedbackItems = [];
        this.renderFeedbackPanel();
    }

    renderFeedbackPanel() {
        const bar = document.getElementById('agentFeedbackBar');
        if (!bar) return;

        if (this.feedbackItems.length === 0) {
            bar.hidden = true;
            bar.innerHTML = '';
            return;
        }

        bar.hidden = false;
        bar.innerHTML = `
            <div class="agent-feedback-collection">
                <div class="agent-feedback-collection__header">
                    <span class="agent-feedback-collection__title">
                        ${this.feedbackItems.length} 个元素反馈待发送
                    </span>
                    <button class="agent-feedback-collection__clear"
                            type="button"
                            data-feedback-clear-all="true"
                            title="清除全部">清除</button>
                </div>
                <div class="agent-feedback-collection__items">
                    ${this.feedbackItems.map((item, index) => `
                        <div class="agent-feedback-chip" data-feedback-index="${index}">
                            <span class="agent-feedback-chip__tag">&lt;${this.escapeHtml((item.meta.tagName || 'el').toLowerCase())}&gt;</span>
                            <span class="agent-feedback-chip__text">${this.escapeHtml((item.description || '').substring(0, 60))}</span>
                            <button class="agent-feedback-chip__remove"
                                    type="button"
                                    data-feedback-remove="${index}"
                                    title="移除">&times;</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async submitFeedbackToAgent() {
        // Feedback is now sent through submitAgentMessage() when the user
        // clicks the regular send button. This method is kept as a convenience
        // trigger that delegates to the main submit flow.
        await this.submitAgentMessage();
    }

    // ── Agent Workbench ─────────────────────────────────

    getDefaultAgentRunState() {
        return ReadifyAgent.State.createDefaultRunState({ hasSession: Boolean(this.agentSessionId) });
    }

    isAgentRunTerminal() {
        return ReadifyAgent.State.isTerminal(this.agentRunState);
    }

    async loadAgentProviderPresets() {
        try {
            const response = await fetch(`/data/agent-provider-presets.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset request failed: ${response.status}`);
            this.agentProviderPresets = await response.json();
        } catch (error) {
            console.warn('Failed to load agent provider presets:', error);
            this.agentProviderPresets = AGENT_PROVIDER_PRESET_FALLBACK;
        }
        if (this.agentProviderPresetOptions) this.agentProviderPresetOptions.replaceChildren();
        this.agentProviderStore?.setPresets(this.agentProviderPresets);
        this.syncAgentProviderStoreState();
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
    }

    async loadAgentSkills() {
        try {
            const data = await this.agentApi.getSkills();
            const skills = Array.isArray(data.skills) ? data.skills : [];
            this.agentAvailableSkills = skills;
        } catch (error) {
            console.warn('Failed to load agent skills:', error);
            this.agentAvailableSkills = AGENT_SKILL_FALLBACK;
        }
    }

    async loadAgentCommands() {
        try {
            const data = await this.agentApi.getCommands();
            const commands = Array.isArray(data.commands) ? data.commands : [];
            this.agentAvailableCommands = commands;
        } catch (error) {
            console.warn('Failed to load agent commands:', error);
            this.agentAvailableCommands = AGENT_COMMAND_FALLBACK;
        }
    }

    async refreshAgentCatalog({ render = true } = {}) {
        if (this._agentCatalogRefreshing) return this._agentCatalogRefreshing;
        this._agentCatalogRefreshing = Promise.allSettled([
            this.loadAgentSkills(),
            this.loadAgentCommands()
        ]).then(() => {
            this.agentCatalogLoadedAt = Date.now();
            if (render) this.renderAgentWorkbench();
        }).finally(() => {
            this._agentCatalogRefreshing = null;
        });
        return this._agentCatalogRefreshing;
    }

    async loadAgentSdkInfo() {
        try {
            this.agentSdkInfo = await this.agentApi.getSdkInfo();
        } catch (error) {
            console.warn('Failed to load agent SDK info:', error);
            this.agentSdkInfo = null;
        }
    }

    async loadAgentSessions({ prewarm = false, reset = true } = {}) {
        const query = (this.agentSessionSearch || '').trim();
        const cached = query ? [] : this.getCachedAgentSessionList();
        if (reset && cached.length && !this.agentSessionsList.length) {
            this.agentSessionsList = cached;
        }
        const requestId = ++this._agentSessionListRequestId;
        this.agentSessionListLoading = true;
        if (reset) {
            this.agentSessionNextCursor = null;
            this.agentSessionHasMore = false;
        }
        try {
            const data = await this.agentApi.listSessions({
                limit: this.agentSessionPageSize,
                cursor: reset ? '' : (this.agentSessionNextCursor || ''),
                query
            });
            if (requestId !== this._agentSessionListRequestId) return;
            const incoming = Array.isArray(data.sessions) ? data.sessions : [];
            if (reset) {
                this.agentSessionsList = incoming;
            } else {
                const knownIds = new Set(this.agentSessionsList.map((session) => session.id));
                this.agentSessionsList = [
                    ...this.agentSessionsList,
                    ...incoming.filter((session) => !knownIds.has(session.id))
                ];
            }
            this.agentSessionNextCursor = data.nextCursor || null;
            this.agentSessionHasMore = Boolean(data.hasMore && this.agentSessionNextCursor);
            if (!query) this.cacheAgentSessionList(this.agentSessionsList.slice(0, this.agentSessionPageSize));
            if (prewarm) {
                this.scheduleAgentSessionPrewarm(this.agentSessionsList);
            }
        } catch (error) {
            console.warn('Failed to load agent sessions from server, using cache:', error);
            if (reset && cached.length) this.agentSessionsList = cached;
        } finally {
            if (requestId === this._agentSessionListRequestId) {
                this.agentSessionListLoading = false;
            }
        }
    }

    async loadMoreAgentSessions() {
        if (this.agentSessionListLoading || !this.agentSessionHasMore || !this.agentSessionNextCursor) return;
        this.renderAgentSessionList();
        await this.loadAgentSessions({ prewarm: false, reset: false });
        this.renderAgentSessionList();
    }

    scheduleIdleTask(callback, timeout = 800) {
        if ('requestIdleCallback' in window) {
            return window.requestIdleCallback(callback, { timeout });
        }
        return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 16);
    }

    cancelIdleTask(id) {
        if (!id) return;
        if ('cancelIdleCallback' in window) {
            window.cancelIdleCallback(id);
        } else {
            window.clearTimeout(id);
        }
    }

    scheduleAgentSessionPrewarm(sessions) {
        this.cancelIdleTask(this._agentSessionPrewarmIdle);
        this._agentSessionPrewarmIdle = this.scheduleIdleTask(() => {
            this._agentSessionPrewarmIdle = null;
            this.prewarmAgentSessionHistoryCache(sessions, { limit: 4 });
        }, 1200);
    }

    async prewarmAgentSessionHistoryCache(sessions, { limit = 4 } = {}) {
        if (!Array.isArray(sessions)) return;
        const candidates = sessions
            .filter((session) => session?.id && !this.getCachedAgentSessionHistory(session.id))
            .slice(0, limit);
        await Promise.allSettled(candidates.map(async (session) => {
            try {
                const historyData = await this.agentApi.getSessionHistory(session.id);
                this.cacheAgentSessionHistory(session.id, historyData);
            } catch (e) { /* ignore */ }
        }));
    }

    refreshAgentSessionsSoon() {
        this.loadAgentSessions()
            .then(() => this.renderAgentWorkbench())
            .catch(() => {});
    }

    async refreshProjectsAfterAgentRun() {
        if (this.isShareMode || this._projectCatalogRefreshPromise) {
            return this._projectCatalogRefreshPromise || Promise.resolve();
        }

        const previousPages = new Map((this.projects?.pages || []).map((page) => [
            page.id,
            {
                deleted: Boolean(page.deleted),
                versions: new Set(page.versions || [])
            }
        ]));
        const previousPageId = this.activePageId;
        const previousVersion = this.activeVersion;

        this._projectCatalogRefreshPromise = (async () => {
            await this.loadData();
            await this.syncFromDisk();

            const activePages = (this.projects?.pages || []).filter((page) => !page.deleted);
            const addedPages = activePages.filter((page) => !previousPages.has(page.id));
            const preferredAddedPage = addedPages.find((page) => page.id === this.projects.activePage) || addedPages.at(-1);

            let target = null;
            if (preferredAddedPage) {
                target = {
                    pageId: preferredAddedPage.id,
                    version: preferredAddedPage.activeVersion || preferredAddedPage.versions?.[0] || 'v1',
                    kind: 'page'
                };
            } else {
                const changedPage = activePages.find((page) => {
                    const before = previousPages.get(page.id);
                    return before && (page.versions || []).some((version) => !before.versions.has(version));
                });
                if (changedPage) {
                    const before = previousPages.get(changedPage.id);
                    const addedVersion = (changedPage.versions || []).find((version) => !before.versions.has(version));
                    target = {
                        pageId: changedPage.id,
                        version: addedVersion || changedPage.activeVersion || changedPage.versions?.[0] || 'v1',
                        kind: 'version'
                    };
                }
            }

            this.renderSidebar();

            if (target) {
                await this.switchPage(target.pageId, target.version, { skipPrdDraftCheck: true });
                if (this.agentSessionId) {
                    await this.bindAgentSessionToPage(target.pageId, target.version);
                }
                this.showToast(target.kind === 'page' ? '已加载新页面并关联对话' : '已加载新版本并关联对话');
                return;
            }

            const currentPage = this.getPageRecord(previousPageId);
            if (currentPage && !currentPage.deleted) {
                this.activePageId = previousPageId;
                this.activeVersion = currentPage.versions?.includes(previousVersion)
                    ? previousVersion
                    : this.getPreferredPageVersion(currentPage, previousVersion);
                if (this.currentPageNameEl) this.currentPageNameEl.textContent = currentPage.name || currentPage.id;
                this.renderVersionPanel(currentPage);
                this.updateAgentContextLabel();
            }
        })().catch((error) => {
            console.warn('Failed to refresh project catalog after agent run:', error);
        }).finally(() => {
            this._projectCatalogRefreshPromise = null;
        });

        return this._projectCatalogRefreshPromise;
    }

    getAgentPreset(providerId = this.agentConfig.provider) {
        return this.agentProviderStore?.getPreset(providerId) || AGENT_PROVIDER_PRESET_FALLBACK.providers[0];
    }

    // ── Multi-provider management ──────────────────────────────

    syncAgentProviderStoreState() {
        this.agentSavedProviders = this.agentProviderStore?.providers || [];
        this.activeProviderId = this.agentProviderStore?.activeProviderId || null;
        // New-provider mode must survive background state synchronizations.
        this.selectedProviderId = this.newProviderDraft
            ? null
            : (this.agentProviderStore?.selectedProviderId || null);
    }

    migrateLegacyProviderConfig() {
        this.agentProviderStore?.migrateLegacyProviderConfig();
        this.syncAgentProviderStoreState();
    }

    getActiveProvider() {
        return this.agentProviderStore?.getActiveProvider() || null;
    }

    getSelectedProvider() {
        if (this.newProviderDraft) return this.newProviderDraft;
        if (this.editProviderDraft) return this.editProviderDraft;
        return this.agentProviderStore?.getSelectedProvider() || null;
    }

    buildAgentConfigFromActiveProvider() {
        return this.agentProviderStore?.buildConfig() || { provider: '', apiType: 'anthropic-messages', model: '', baseURL: '', apiKey: '', sdkOptions: {} };
    }

    persistProviders() {
        this.agentProviderStore?.persist();
        this.syncAgentProviderStoreState();
    }

    renderProviderList() {
        const active = this.getActiveProvider();
        const selected = this.getSelectedProvider();

        if (this.providerCustomList) {
            if (this.agentSavedProviders.length === 0) {
                this.providerCustomList.innerHTML = '<div class="provider-list-empty">点击上方“+”按钮连接模型。</div>';
            } else {
                this.providerCustomList.innerHTML = this.agentSavedProviders.map(provider => `
                    <button class="provider-list-item ${provider.id === selected?.id ? 'is-selected' : ''} ${provider.id === active?.id ? 'is-active' : ''}"
                            data-provider-id="${this.escapeHtml(provider.id)}"
                            type="button">
                        <span class="provider-list-item__indicator"></span>
                        <span class="provider-list-item__main">
                            <span class="provider-list-item__label">${this.escapeHtml(provider.label)}</span>
                            <span class="provider-list-item__meta">${this.escapeHtml(provider.model || '未指定模型')}</span>
                        </span>
                        <span class="provider-list-item__state">${provider.id === active?.id ? '当前' : ''}</span>
                        ${provider.id === active?.id ? '' : `<span class="provider-list-item__switch" data-switch-provider-id="${this.escapeHtml(provider.id)}">使用</span>`}
                    </button>
                `).join('');
            }
        }
    }

    enterCreateMode(confirmed = false) {
        if (!confirmed && this.unifiedSettings?.guardModels(() => this.enterCreateMode(true))) return;
        this.editProviderDraft = null;
        this.selectedProviderId = null;
        this.clearAgentStatusResults();
        this.newProviderDraft = {
            id: '__new__',
            label: '',
            presetId: '',
            apiType: 'openai-completions',
            baseURL: '',
            apiKey: '',
            model: '',
            sdkOptions: {}
        };
        this.togglePresetSelectDropdown(false);
        this.syncAgentConfigForm();
        this.renderProviderList();
        this.unifiedSettings?.markSaved('models');
    }

    exitCreateMode() {
        this.newProviderDraft = null;
        this.togglePresetSelectDropdown(false);
    }

    togglePresetSelectDropdown(open) {
        if (!this.agentProviderPresetOptions) return;
        this.agentProviderPresetOptions.hidden = !open;
        this.agentProviderPresetSelect?.classList.toggle('is-open', open);
        this.agentProviderPresetTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    setPresetSelectValue(val) {
        if (!this.agentProviderPresetSelect || !this.agentProviderPresetOptions) return;
        // Mark active option
        this.agentProviderPresetOptions.querySelectorAll('[data-preset-value]').forEach(opt => {
            opt.classList.toggle('is-active', opt.dataset.presetValue === val);
        });

        // Sync text
        let labelText = '-- 请选择服务商模板 --';
        if (val === '__custom__') {
            labelText = '自定义 (空白配置)';
        } else if (val) {
            const preset = this.getAgentPreset(val);
            if (preset) {
                labelText = preset.label;
            }
        }
        if (this.agentProviderPresetValue) {
            this.agentProviderPresetValue.textContent = labelText;
        }
        this.agentProviderPresetSelect.dataset.value = val || '';
    }

    handleProviderPresetSelectionChange(val = this.agentProviderPresetSelect?.dataset?.value) {
        if (this.unifiedSettings && !this.newProviderDraft && !this.editProviderDraft) this.editProviderDraft = structuredClone(this.agentProviderStore?.getSelectedProvider() || null);
        const target = this.getSelectedProvider();
        if (!target) return;

        if (val === '__custom__') {
            target.presetId = null;
            target.label = '自定义供应商';
            target.apiType = 'openai-completions';
            target.baseURL = '';
            target.model = '';
            target.sdkOptions = {};
            target.models = [];
            target.endpointCandidates = [];
        } else if (val) {
            const preset = this.getAgentPreset(val);
            if (preset) {
                target.presetId = preset.id;
                target.label = preset.label;
                target.apiType = preset.apiType || 'openai-completions';
                target.baseURL = preset.baseURL || '';
                target.model = preset.defaultModel || '';
                target.sdkOptions = preset.sdkDefaults || {};
                target.models = preset.models || [];
                target.endpointCandidates = preset.endpointCandidates || (preset.baseURL ? [preset.baseURL] : []);
            }
        }

        // Auto-fill form fields
        if (this.agentProviderNameInput) this.agentProviderNameInput.value = target.label || '';
        if (this.agentBaseUrlInput) this.agentBaseUrlInput.value = target.baseURL || '';
        if (this.agentApiTypeInput) this.agentApiTypeInput.value = target.apiType || 'openai-completions';
        this.renderAgentModelPicker(target);
        if (this.agentSdkOptionsInput) this.agentSdkOptionsInput.value = this.stringifyAgentSdkOptions(target.sdkOptions || {});
        if (this.agentApiKeyInput) this.agentApiKeyInput.value = '';

        this.handleAgentConfigInput();
    }

    clearAgentStatusResults() {
        this.agentConnectionTestResult = null;
        if (this.agentConnectionTestResultEl) {
            this.agentConnectionTestResultEl.hidden = true;
            this.agentConnectionTestResultEl.innerHTML = '';
        }
        if (this.agentBalanceResultEl) {
            this.agentBalanceResultEl.hidden = true;
            this.agentBalanceResultEl.innerHTML = '';
        }
    }

    selectProvider(id, confirmed = false) {
        if (!confirmed && this.unifiedSettings?.guardModels(() => this.selectProvider(id, true))) return;
        this.newProviderDraft = null;
        this.editProviderDraft = null;
        this.unifiedSettings?.userTouched.delete('models');
        this.clearAgentStatusResults();
        this.agentProviderStore?.selectProvider(id);
        this.syncAgentProviderStoreState();
        this.syncAgentConfigForm();
        this.renderAgentWorkbench();
        this.unifiedSettings?.markSaved('models');
    }

    async activateProvider(id = this.selectedProviderId, { silent = false, confirmed = false } = {}) {
        if (!confirmed && this.unifiedSettings?.guardModels(() => this.activateProvider(id, { silent, confirmed: true }))) return;
        this.newProviderDraft = null;
        this.editProviderDraft = null;
        this.unifiedSettings?.userTouched.delete('models');
        this.clearAgentStatusResults();
        const provider = this.agentProviderStore?.activateProvider(id);
        if (!provider) return;
        this.syncAgentProviderStoreState();
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
        this.syncAgentConfigForm();
        this.renderAgentWorkbench();
        this.unifiedSettings?.markSaved('models');
        if (this.agentSessionId) {
            await this.updateSdkAgentProvider(this.buildAgentConfigFromActiveProvider());
        }
        if (!silent) this.showToast(`当前供应商已切换为 ${provider.label}`);
    }

    async saveActiveProvider() {
        if (this._agentProviderSaving || !this.agentProviderPersistenceReady) return false;
        const selected = this.getSelectedProvider();
        if (!selected) return false;
        const sdkOptions = this.parseAgentSdkOptions({ showError: true });
        if (!sdkOptions) return false;
        const creatingProvider = Boolean(this.newProviderDraft);
        const previousProviderState = structuredClone(this.agentProviderStore?.exportState());
        const previousEditDraft = this.editProviderDraft ? structuredClone(this.editProviderDraft) : null;
        const previousDraft = this.newProviderDraft ? structuredClone(this.newProviderDraft) : null;

        const fields = {
            presetId: selected.presetId || null,
            models: [...(selected.models || [])],
            endpointCandidates: [...(selected.endpointCandidates || [])],
            label: this.agentProviderNameInput?.value.trim() || selected.label || '自定义供应商',
            apiType: this.agentApiTypeInput?.value || selected.apiType || 'anthropic-messages',
            model: this.getAgentModelFormValue() || selected.model || '',
            baseURL: this.agentBaseUrlInput?.value.trim() || selected.baseURL || '',
            apiKey: this.agentApiKeyInput?.value.trim() || selected.apiKey || '',
            sdkOptions
        };

        if (creatingProvider) {
            const presetVal = this.agentProviderPresetSelect?.dataset?.value || '';
            const presetId = presetVal !== '__custom__' ? (presetVal || null) : null;
            const preset = presetId ? this.getAgentPreset(presetId) : null;
            const newProvider = {
                id: this.agentProviderStore?.createProviderInstanceId(),
                label: fields.label,
                presetId: presetId || null,
                apiType: fields.apiType,
                model: fields.model,
                baseURL: fields.baseURL,
                apiKey: fields.apiKey,
                sdkOptions: { ...fields.sdkOptions },
                models: [...fields.models],
                endpointCandidates: [...(preset?.endpointCandidates || (fields.baseURL ? [fields.baseURL] : []))],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            const savedProvider = this.agentProviderStore?.addProvider(newProvider);
            if (!savedProvider) return false;
            this.newProviderDraft = null;
            this.editProviderDraft = null;
            this.selectedProviderId = savedProvider.id;
            this.syncAgentProviderStoreState();
            this.agentConfig = this.buildAgentConfigFromActiveProvider();
            this.syncAgentConfigForm();
            this.renderAgentWorkbench();
        } else {
            this.agentProviderStore?.updateSelectedProvider(fields);
            this.syncAgentProviderStoreState();
            this.agentConfig = this.buildAgentConfigFromActiveProvider();
            this.renderProviderList();
        }

        this._agentProviderSaving = true;
        if (this.agentSaveProviderBtn) this.agentSaveProviderBtn.disabled = true;
        try {
            window.clearTimeout(this._agentProviderPersistTimer);
            this._agentProviderPersistTimer = null;
            await this.persistAgentProviderConfig();
            this.unifiedSettings?.markSaved('models', true);
            this.showToast(creatingProvider ? '已成功创建并保存供应商' : '供应商配置已保存');
            return true;
        } catch (error) {
            this.newProviderDraft = previousDraft;
            this.editProviderDraft = previousEditDraft;
            this.agentProviderStore?.replaceState(previousProviderState);
            this.syncAgentProviderStoreState();
            this.agentConfig = this.buildAgentConfigFromActiveProvider();
            window.clearTimeout(this._agentProviderPersistTimer);
            this._agentProviderPersistTimer = null;
            console.error('Failed to save provider config:', error);
            this.unifiedSettings?.setFeedback('保存失败，修改内容已保留。请检查本地服务后重试。', true);
            this.showToast('模型配置保存失败，请检查本地服务', true);
            return false;
        } finally {
            this._agentProviderSaving = false;
            if (this.agentSaveProviderBtn) this.agentSaveProviderBtn.disabled = false;
        }
    }

    deleteProvider(id = this.selectedProviderId, confirmed = false) {
        if (!confirmed && this.unifiedSettings?.guardModels(() => this.deleteProvider(id, true))) return;
        if (!window.confirm('删除这项模型服务商配置？删除后需要重新填写连接信息。')) return;
        this.newProviderDraft = null;
        this.editProviderDraft = null;
        this.unifiedSettings?.userTouched.delete('models');
        this.clearAgentStatusResults();
        this.agentProviderStore?.deleteProvider(id);
        this.syncAgentProviderStoreState();
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
        this.syncAgentConfigForm();
        this.renderAgentWorkbench();
        this.unifiedSettings?.markSaved('models');
    }

    getAgentSkill(skillId = this.agentActiveSkill?.id) {
        if (!skillId) return null;
        return this.agentAvailableSkills.find((skill) => skill.id === skillId)
            || AGENT_SKILL_FALLBACK.find((skill) => skill.id === skillId)
            || null;
    }

    getAgentCommand(commandId) {
        const normalizedId = String(commandId || '').replace(/^\//, '').trim();
        if (!normalizedId) return null;
        return this.agentAvailableCommands.find((command) => command.id === normalizedId || (command.aliases || []).includes(`/${normalizedId}`) || (command.aliases || []).includes(normalizedId))
            || AGENT_COMMAND_FALLBACK.find((command) => command.id === normalizedId || (command.aliases || []).includes(`/${normalizedId}`) || (command.aliases || []).includes(normalizedId))
            || null;
    }

    getAgentStatusContextText() {
        const context = this.agentSessionContext || this.getAgentContext();
        const deletion = this.getAgentContextDeletionState(context);
        const activeDescriptor = this.agentRunState?.descriptor || {};
        if (this.agentActiveSkill?.id === 'create-new-page' || activeDescriptor.skillId === 'create-new-page' || activeDescriptor.commandId === 'new-page') {
            return '新增页面';
        }
        if (context?.globalContext || context?.pageId === '__global__') {
            return '工作区会话';
        }
        return `${context.pageId} / ${context.version}${deletion.blocked ? ' · 已删除' : ''}`;
    }

    updateAgentContextLabel() {
        if (this.agentStatusContext && !this.newPageStyleDropdownOpen) {
            this.renderAgentStatusContextControl();
        }
    }

    renderAgentStatusContextControl() {
        if (!this.agentStatusContext) return;
        if (this.isNewPageStylePickerActive()) {
            this.agentStatusContext.hidden = false;
            const selectedDevice = this.normalizePageTargetDevice(this.newPageTargetDevice);
            const selected = this.getNewPageSelectedPickerOption();
            const pickerLabel = selectedDevice === 'web' ? '前端框架' : '风格';
            this.agentStatusContext.classList.add('is-clickable', 'is-style-picker');
            this.agentStatusContext.classList.remove('has-clear');
            this.agentStatusContext.title = `选择新页面类型和${pickerLabel}`;
            this.agentStatusContext.innerHTML = `
                <span class="new-page-config-control">
                    <span class="new-page-device-control" role="group" aria-label="新页面类型">
                        <button type="button" class="new-page-device-control__btn${selectedDevice === 'mobile' ? ' is-active' : ''}" data-new-page-device="mobile" aria-pressed="${selectedDevice === 'mobile' ? 'true' : 'false'}" title="手机端页面">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"></rect><path d="M10.5 18.5h3"></path></svg>
                            <span>手机</span>
                        </button>
                        <button type="button" class="new-page-device-control__btn${selectedDevice === 'web' ? ' is-active' : ''}" data-new-page-device="web" aria-pressed="${selectedDevice === 'web' ? 'true' : 'false'}" title="Web B 端页面">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>
                            <span>Web</span>
                        </button>
                    </span>
                    <span class="new-page-style-control" data-new-page-style-root="1">
                        <button type="button" class="new-page-style-control__trigger" data-new-page-style-toggle="1" aria-label="选择${pickerLabel}" aria-haspopup="listbox" aria-expanded="${this.newPageStyleDropdownOpen ? 'true' : 'false'}">
                            <span class="new-page-style-control__text">
                                <strong>${this.escapeHtml(selected?.name || (selectedDevice === 'web' ? 'Ant Design' : '默认风格'))}</strong>
                            </span>
                            <svg class="new-page-style-control__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                    </span>
                </span>
            `;
            this.renderNewPageStyleMenuPortal();
            return;
        }
        this.closeNewPageStyleMenu({ renderControl: false });
        this.agentStatusContext.classList.remove('is-style-picker');
        const context = this.agentSessionContext || this.getAgentContext();
        // 项目外打开 Prota（工作区/全局会话）时不显示上下文标签
        if (context?.globalContext || context?.pageId === '__global__') {
            this.agentStatusContext.hidden = true;
            return;
        }
        this.agentStatusContext.hidden = false;
        const canPickScope = !this.agentRunState?.active;
        const canClearScope = canPickScope && !(context?.globalContext || context?.pageId === '__global__');
        const label = this.getAgentStatusContextText();
        this.agentStatusContext.classList.toggle('is-clickable', canPickScope);
        this.agentStatusContext.classList.toggle('has-clear', canClearScope);
        this.agentStatusContext.removeAttribute('role');
        this.agentStatusContext.removeAttribute('tabindex');
        this.agentStatusContext.title = canPickScope
            ? '点击调整关联的页面版本'
            : '任务执行中，暂不可调整页面版本';
        this.agentStatusContext.innerHTML = `
            <span class="agent-status-context__label" data-agent-pick-scope="1" role="${canPickScope ? 'button' : 'text'}" tabindex="${canPickScope ? '0' : '-1'}">${this.escapeHtml(label)}</span>
            ${canClearScope ? `
                <button class="agent-status-context__clear" type="button" data-agent-clear-scope="1" aria-label="关闭页面关联，切换为通用会话">
                    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                        <path d="M3 3l6 6M9 3L3 9"></path>
                    </svg>
                </button>
            ` : ''}
        `;
    }

    getAgentStatusText() {
        return this.agentRunState?.stageMessage || '正在处理…';
    }

    createOptimisticAgentDescriptor(kind, payload = {}) {
        const context = this.isAgentGlobalRun(kind, payload) ? this.getAgentGlobalContext() : this.getAgentContext();
        if (kind === 'skill') {
            const skill = this.getAgentSkill(payload.skillId) || this.agentActiveSkill || {};
            const message = String(payload.message || skill.defaultStarter || '').trim();
            return {
                kind: 'skill',
                skillId: payload.skillId || skill.id || '',
                skillLabel: skill.label || payload.skillId || 'Skill',
                title: skill.label || payload.skillId || 'Skill',
                summary: message || skill.description || `运行 ${skill.label || payload.skillId || 'Skill'}`,
                message,
                attachments: payload.attachments || [],
                prdContext: payload.prdContext || null,
                context
            };
        }

        if (kind === 'command') {
            const command = this.getAgentCommand(payload.commandId) || {};
            const args = String(payload.arguments || '').trim();
            return {
                kind: 'command',
                commandId: payload.commandId || command.id || '',
                commandLabel: command.label || payload.commandId || 'Command',
                title: command.label || payload.commandId || 'Command',
                summary: args || command.description || `执行 /${payload.commandId || command.id || 'command'}`,
                arguments: args,
                attachments: payload.attachments || [],
                context
            };
        }

        if (kind === 'dev-simulate') {
            return {
                kind: 'dev-simulate',
                title: '开发模拟',
                summary: payload.scenario || 'full_flow',
                scenario: payload.scenario || 'full_flow',
                context
            };
        }

        return {
            kind: 'message',
            title: '对话消息',
            summary: String(payload.message || '新的对话消息').trim(),
            message: String(payload.message || '').trim(),
            attachments: payload.attachments || [],
            prdContext: payload.prdContext || null,
            continuation: Boolean(payload.continuation),
            context
        };
    }

    addOptimisticAgentRun(kind, payload = {}) {
        const runId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const createdAt = new Date().toISOString();
        const descriptor = this.createOptimisticAgentDescriptor(kind, payload);
        const context = this.isAgentGlobalRun(kind, payload) ? this.getAgentGlobalContext() : this.getAgentContext();
        this.upsertAgentTimelineEvent({
            id: `${runId}:run-started`,
            type: 'run_started',
            runId,
            createdAt,
            payload: {
                runId,
                descriptor,
                optimistic: true,
                context
            }
        });
        return { runId, createdAt, descriptor };
    }

    clearOptimisticAgentRuns() {
        this.agentTimelineEvents = this.agentTimelineEvents.filter((event) => !event.payload?.optimistic);
    }

    getAgentElapsedSeconds(runState = this.agentRunState) {
        const { startedAt, finishedAt, active } = runState || {};
        if (!startedAt) return 0;
        const start = new Date(startedAt).getTime();
        if (Number.isNaN(start)) return 0;
        const end = active
            ? Date.now()
            : (finishedAt ? new Date(finishedAt).getTime() : Date.now());
        return Math.max(0, Math.floor((end - start) / 1000));
    }

    formatAgentElapsedShort(runState = this.agentRunState) {
        const totalSeconds = this.getAgentElapsedSeconds(runState);
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    pickAgentActivityCopy(kind) {
        const options = AGENT_ACTIVITY_COPY[kind] || AGENT_ACTIVITY_COPY.thinking;
        const elapsed = this.getAgentElapsedSeconds();
        const runKey = String(this.agentRunState?.runId || this.agentRunState?.startedAt || '');
        const seed = Array.from(runKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const index = Math.abs(seed + Math.floor(elapsed / 11)) % options.length;
        return options[index];
    }

    getAgentActivityKind() {
        const state = this.getAgentVisualState();
        if (state === 'waiting_approval') return 'approval';
        if (state === 'waiting_user_answer') return 'question';
        if (state === 'failed' || state === 'interrupted') return 'failed';
        if (state === 'succeeded') return 'done';
        if (this.agentRunState?.currentTool) return 'tool';
        const stage = String(this.agentRunState?.stageMessage || '').toLowerCase();
        if (stage.includes('compact') || stage.includes('压缩')) return 'compacting';
        if (stage.includes('工具执行完成') || stage.includes('tool')) return 'waiting_tool';
        if (stage.includes('初始化') || stage.includes('启动')) return 'starting';
        if (this.agentTimelineEvents.some((event) => event.runId === this.agentRunState?.runId && event.payload?.partial)) {
            return 'streaming';
        }
        return 'thinking';
    }

    getAgentLiveStatusLabel({ includeSdkDetail = false } = {}) {
        if (!this.agentRunState?.active) {
            return this.getAgentStatusDetailText();
        }
        const nativeStatus = this.agentRunState.sdkStatusMessage || '';
        const base = nativeStatus || this.pickAgentActivityCopy(this.getAgentActivityKind());
        const elapsed = this.formatAgentElapsedShort();
        const detail = includeSdkDetail && !nativeStatus && this.agentRunState.stageMessage
            ? ` · ${this.agentRunState.stageMessage}`
            : '';
        return `${base}… (${elapsed})${detail}`;
    }

    getAgentCollapsedStatusLabel() {
        const state = this.getAgentVisualState();
        if (state === 'waiting_approval') {
            const totalSeconds = this.getAgentElapsedSeconds();
            const min = Math.floor(totalSeconds / 60);
            return min > 0 ? `待审批 (${min}m)` : '待审批';
        }
        if (state === 'waiting_user_answer') return '待回答';
        
        const kind = this.getAgentActivityKind();
        if (kind === 'starting') return '启动中';
        if (kind === 'thinking') return '思考中';
        if (kind === 'tool') return '工具执行';
        if (kind === 'waiting_tool') return '等待结果';
        if (kind === 'compacting') return '整理中';
        if (kind === 'streaming') return '流式输出';
        
        return '执行中';
    }

    getAgentContext() {
        return {
            projectId: this.activeProjectId || 'readify',
            pageId: this.activePageId || this.projects?.activePage || 'reader',
            version: this.activeVersion || this.projects?.pages?.[0]?.activeVersion || 'v1'
        };
    }

    getAgentGlobalContext() {
        return {
            projectId: this.activeProjectId || 'readify',
            pageId: '__global__',
            version: 'workspace',
            globalContext: true,
            sessionScope: 'global'
        };
    }

    isAgentSessionPageScoped() {
        const context = this.agentSessionContext || null;
        return this.agentSessionScope !== 'global'
            && Boolean(context?.pageId && context?.version)
            && !context.globalContext
            && context.pageId !== '__global__';
    }

    openAgentScopePicker() {
        if (this.agentRunState?.active || !this.agentInput) return;
        this.agentInput.focus();
        this.agentAutocompleteQuery = '';
        this.openAgentAutocomplete();
    }

    isAgentGlobalRun(kind = '', payload = {}) {
        if (payload.globalContext || payload.sessionScope === 'global') return true;
        if (kind === 'skill') return Boolean(this.getAgentSkill(payload.skillId)?.globalContext);
        if (kind === 'command') {
            const command = this.getAgentCommand(payload.commandId);
            return Boolean(command?.skillId && this.getAgentSkill(command.skillId)?.globalContext);
        }
        return this.agentSessionScope === 'global';
    }

    getAgentStorageKey(key) {
        return /provider|api-key|panel-width/.test(key) ? `readify:agent:${key}` : workspaceStorageKey(`readify:agent:${key}`);
    }

    readAgentStorage(key, fallback) {
        try {
            const raw = window.localStorage.getItem(this.getAgentStorageKey(key));
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    writeAgentStorage(key, value) {
        try {
            window.localStorage.setItem(this.getAgentStorageKey(key), JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to persist agent storage:', error);
        }
    }

    getAgentPanelWidthBounds() {
        const viewportWidth = window.innerWidth || 1200;
        const agentMinWidth = this.getCssVariable('--agent-panel-min-width', 360);
        const viewportMinWidth = this.getCssVariable('--viewport-min-width', 440);
        const prdDefaultWidth = this.getCssVariable('--prd-drawer-width', 760);
        const prdCollapsedWidth = this.getCssVariable('--prd-drawer-collapsed-width', 520);
        const annotationWidth = this.getCssVariable('--annotation-drawer-width', 360);

        let docDrawerWidth = 0;
        if (this.shouldShowDocumentDrawer()) {
            docDrawerWidth = this.docDrawerMode === 'prd' 
                ? (Number.isFinite(this.prdDrawerWidth) ? this.prdDrawerWidth : (this.docDrawerExpanded ? prdDefaultWidth : prdCollapsedWidth))
                : annotationWidth;
        }
        const reservedWidth = docDrawerWidth ? (docDrawerWidth + viewportMinWidth) : viewportMinWidth;
        const maxVal = Math.max(agentMinWidth, viewportWidth - reservedWidth);
        const minVal = agentMinWidth;

        return {
            min: Math.min(minVal, maxVal),
            max: maxVal
        };
    }

    normalizeAgentPanelWidth(value = this.agentPanelWidth) {
        const { min, max } = this.getAgentPanelWidthBounds();
        const numeric = Number(value);
        const fallback = this.getCssVariable('--agent-panel-width', 660);
        const width = Number.isFinite(numeric) ? numeric : fallback;
        return Math.round(Math.min(Math.max(width, min), max));
    }

    applyAgentPanelWidth(width = this.agentPanelWidth) {
        this.agentPanelWidth = this.normalizeAgentPanelWidth(width);
        document.documentElement.style.setProperty('--agent-panel-width', `${this.agentPanelWidth}px`);

        const narrowWidth = this.getCssVariable('--agent-panel-narrow-width', 600);
        const isCurrentlyNarrow = this.agentPanelWidth < narrowWidth;
        const wasNarrow = this.agentWorkbench?.classList.contains('is-narrow');

        if (isCurrentlyNarrow) {
            if (!wasNarrow) {
                this.agentWorkbench?.classList.add('is-narrow');
                this.sidebar?.classList.add('is-agent-narrow');
                if (this.agentSessionDrawerOpen) {
                    this.agentSessionDrawerOpen = false;
                    this.writeAgentStorage('session-drawer-open', false);
                    this.renderAgentChrome();
                }
            }
        } else {
            if (wasNarrow) {
                this.agentWorkbench?.classList.remove('is-narrow');
                this.sidebar?.classList.remove('is-agent-narrow');
                if (!this.agentSessionDrawerOpen) {
                    this.agentSessionDrawerOpen = true;
                    this.writeAgentStorage('session-drawer-open', true);
                    this.renderAgentChrome();
                }
            }
        }
    }

    startAgentResize(event) {
        if (!this.agentWorkbenchOpen || !this.sidebar) return;
        event.preventDefault();
        this._agentResizeState = {
            startX: event.clientX,
            startWidth: this.sidebar.getBoundingClientRect().width
        };
        document.body.classList.add('is-resizing-agent');
        this.agentResizeHandle?.setPointerCapture?.(event.pointerId);
        window.addEventListener('pointermove', this.handleAgentResizeMove);
        window.addEventListener('pointerup', this.stopAgentResize, { once: true });
        window.addEventListener('pointercancel', this.stopAgentResize, { once: true });
    }

    handleAgentResizeMove = (event) => {
        if (!this._agentResizeState) return;
        const nextWidth = this._agentResizeState.startWidth + event.clientX - this._agentResizeState.startX;
        this.applyAgentPanelWidth(nextWidth);
        this.refreshAnnotationUI();
    };

    stopAgentResize = () => {
        if (!this._agentResizeState) return;
        this._agentResizeState = null;
        document.body.classList.remove('is-resizing-agent');
        this.writeAgentStorage('panel-width', this.agentPanelWidth);
        window.removeEventListener('pointermove', this.handleAgentResizeMove);
    };

    handleWindowResize = () => {
        if (this._resizeAnimationFrame) {
            cancelAnimationFrame(this._resizeAnimationFrame);
        }
        this._resizeAnimationFrame = requestAnimationFrame(() => {
            this.refreshAnnotationUI();
            this.applyAgentPanelWidth(this.agentPanelWidth);
            if (Number.isFinite(this.prdDrawerWidth)) {
                this.applyPrdDrawerWidth(this.prdDrawerWidth);
            }
            if (this.agentWorkbenchOpen) {
                this.renderAgentWorkbench();
            }
            if (this.skillImportModalOpen) {
                this.pinSkillImportDialogTop();
            }
        });
    };

    // ── Local session cache (works without server) ──────────

    cacheAgentSessionList(list) {
        this.writeAgentStorage('session-list-cache', list);
    }

    getCachedAgentSessionList() {
        return this.readAgentStorage('session-list-cache', []);
    }

    cacheAgentSessionHistory(sessionId, data) {
        try {
            window.localStorage.setItem(
                this.getAgentStorageKey(`session-history:${sessionId}`),
                JSON.stringify(data)
            );
        } catch (error) {
            console.warn('Failed to cache session history:', error);
        }
    }

    getCachedAgentSessionHistory(sessionId) {
        return this.readAgentStorage(`session-history:${sessionId}`, null);
    }

    removeCachedAgentSession(sessionId) {
        try {
            window.localStorage.removeItem(this.getAgentStorageKey(`session-history:${sessionId}`));
        } catch (error) { /* ignore */ }
    }

    cacheCurrentAgentSession() {
        if (!this.agentSessionId) return;
        this.cacheAgentSessionHistory(this.agentSessionId, {
            sessionId: this.agentSessionId,
            timeline: this.agentTimelineEvents,
            runState: this.agentRunState,
            context: this.agentSessionContext || null
        });
    }

    stringifyAgentSdkOptions(options = {}) {
        return Object.keys(options || {}).length ? JSON.stringify(options, null, 2) : '';
    }

    parseAgentSdkOptions({ showError = false } = {}) {
        const raw = String(this.agentSdkOptionsInput?.value || '').trim();
        if (!raw) {
            if (this.agentSdkOptionsStatus) {
                const optionCount = this.agentSdkInfo?.options?.length || 0;
                const extension = this.agentSdkInfo?.extension;
                this.agentSdkOptionsStatus.textContent = optionCount
                    ? `${optionCount} 个 option 可用 · extension ${extension?.loaded ? 'on' : 'off'}`
                    : '';
            }
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('SDK Options 必须是 JSON object');
            }
            if (this.agentSdkOptionsStatus) {
                const count = Object.keys(parsed).length;
                this.agentSdkOptionsStatus.textContent = `${count} 个 option 已启用`;
            }
            return parsed;
        } catch (error) {
            if (this.agentSdkOptionsStatus) this.agentSdkOptionsStatus.textContent = 'JSON 格式无效';
            if (showError) {
                this.showToast(error instanceof Error ? error.message : String(error), true);
            }
            return null;
        }
    }

    getMergedAgentEndpointCandidates(provider = this.getActiveProvider()) {
        return this.agentProviderStore?.getEndpointCandidates(provider) || [];
    }

    applyAgentSdkPresetOptions() {
        const selected = this.getSelectedProvider();
        if (!selected || !this.agentSdkOptionsInput) return;
        const preset = selected.presetId ? this.getAgentPreset(selected.presetId) : null;
        const defaults = preset?.sdkDefaults || { permissionMode: 'default', maxTurns: 100, includePartialMessages: true };
        let current = this.parseAgentSdkOptions({ showError: true });
        if (!current) return;
        current = { ...defaults, ...current };
        this.agentSdkOptionsInput.value = this.stringifyAgentSdkOptions(current);
        this.handleAgentConfigInput();
        this.showToast('已套用推荐 SDK Options');
    }

    formatAgentSdkOptions() {
        const parsed = this.parseAgentSdkOptions({ showError: true });
        if (!parsed || !this.agentSdkOptionsInput) return;
        this.agentSdkOptionsInput.value = this.stringifyAgentSdkOptions(parsed);
        this.handleAgentConfigInput();
    }

    getAgentConfigDraft({ source = 'active' } = {}) {
        const provider = source === 'selected'
            ? this.getSelectedProvider()
            : this.getActiveProvider();
        if (!provider) {
            return { provider: '', apiType: 'anthropic-messages', model: '', baseURL: '', apiKey: '', sdkOptions: {} };
        }
        const useFormValues = source === 'selected' && (
            provider === this.newProviderDraft || provider.id === this.selectedProviderId
        );
        const sdkOptions = useFormValues ? this.parseAgentSdkOptions({ showError: false }) : null;
        return {
            provider: provider.presetId || provider.id,
            apiType: (useFormValues ? this.agentApiTypeInput?.value : '') || provider.apiType || 'anthropic-messages',
            model: useFormValues ? (this.getAgentModelFormValue() || '') : (provider.model || ''),
            baseURL: useFormValues ? (this.agentBaseUrlInput?.value.trim() || '') : (provider.baseURL || ''),
            apiKey: useFormValues ? (this.agentApiKeyInput?.value.trim() || '') : (provider.apiKey || ''),
            sdkOptions: (useFormValues ? sdkOptions : null) || provider.sdkOptions || {},
            endpointCandidates: this.getMergedAgentEndpointCandidates(provider)
        };
    }

    getAgentModelFormValue() {
        const raw = String(this.agentModelInput?.value || '').trim();
        if (raw === '__custom__') {
            return String(this.agentCustomModelInput?.value || '').trim();
        }
        return raw;
    }

    renderAgentModelPicker(selected) {
        if (!this.agentModelInput) return;
        const models = this.agentProviderStore?.getModelOptions(selected) || [];
        const currentModel = String(selected?.model || '').trim();
        const options = Array.from(new Set(models.map(String).map((model) => model.trim()).filter(Boolean)));
        const hasCurrent = currentModel && options.includes(currentModel);
        const selectValue = currentModel && hasCurrent ? currentModel : (currentModel ? '__custom__' : '');

        this.agentModelInput.innerHTML = [
            `<option value="" ${selectValue ? '' : 'selected'} disabled>选择模型</option>`,
            ...options.map((model) => (
                `<option value="${this.escapeHtml(model)}" ${model === selectValue ? 'selected' : ''}>${this.escapeHtml(model)}</option>`
            )),
            `<option value="__custom__" ${selectValue === '__custom__' ? 'selected' : ''}>手动输入模型 ID...</option>`
        ].join('');

        this.agentModelInput.value = selectValue;
        if (this.agentCustomModelInput) {
            const isCustom = selectValue === '__custom__';
            this.agentCustomModelInput.hidden = !isCustom;
            this.agentCustomModelInput.value = isCustom ? currentModel : '';
        }
        if (this.agentModelOptions) {
            this.agentModelOptions.textContent = options.length
                ? `${options.length} 个可选模型`
                : '还没有模型列表，可点击“拉取模型”或手动输入。';
        }
    }

    handleAgentModelSelectionChange() {
        if (this.agentModelInput?.value === '__custom__') {
            if (this.agentCustomModelInput) {
                this.agentCustomModelInput.hidden = false;
                this.agentCustomModelInput.focus();
            }
            this.updateAgentConfigHint('输入模型 ID 后会自动保存。');
            return;
        }
        if (this.agentCustomModelInput) {
            this.agentCustomModelInput.hidden = true;
            this.agentCustomModelInput.value = '';
        }
        this.handleAgentConfigInput();
    }

    syncAgentConfigForm() {
        if (this.unifiedSettings && !this.unifiedSettings.userTouched.has('models') && !this.newProviderDraft) this.editProviderDraft = structuredClone(this.agentProviderStore?.getSelectedProvider() || null);
        this.renderProviderList();
        const selected = this.getSelectedProvider();
        if (this.providerFormContent) this.providerFormContent.hidden = !selected;
        if (this.providerFormEmpty) this.providerFormEmpty.hidden = Boolean(selected);
        if (this.agentBalanceResultEl) {
            this.agentBalanceResultEl.hidden = true;
            this.agentBalanceResultEl.innerHTML = '';
        }
        if (!selected) {
            if (this.agentProviderPresetSelect) this.agentProviderPresetSelect.dataset.value = '';
            if (this.agentProviderPresetValue) this.agentProviderPresetValue.textContent = '-- 请选择服务商模板 --';
            if (this.agentProviderNameInput) this.agentProviderNameInput.value = '';
            if (this.agentApiTypeInput) this.agentApiTypeInput.value = 'anthropic-messages';
            if (this.agentModelInput) this.agentModelInput.innerHTML = '<option value="">选择模型</option>';
            if (this.agentCustomModelInput) {
                this.agentCustomModelInput.hidden = true;
                this.agentCustomModelInput.value = '';
            }
            if (this.agentBaseUrlInput) this.agentBaseUrlInput.value = '';
            if (this.agentApiKeyInput) this.agentApiKeyInput.value = '';
            if (this.agentSdkOptionsInput) this.agentSdkOptionsInput.value = '';
            if (this.agentSdkOptionsStatus) this.agentSdkOptionsStatus.textContent = '';
            return;
        }

        // Sync preset selection dropdown list and value
        if (this.agentProviderPresetSelect && this.agentProviderPresetOptions) {
            const hasOptions = this.agentProviderPresetOptions.querySelectorAll('[data-preset-value]').length > 0;
            if (!hasOptions) {
                const presets = this.agentProviderPresets?.providers || AGENT_PROVIDER_PRESET_FALLBACK.providers;
                this.agentProviderPresetOptions.innerHTML = [
                    ...presets.map(p => `
                        <button class="agent-custom-select__option" data-preset-value="${this.escapeHtml(p.id)}" type="button">
                            <strong>${this.escapeHtml(p.label)}</strong>
                            <span>${this.escapeHtml(p.defaultModel || p.apiType || '')}</span>
                        </button>
                    `),
                    `
                    <button class="agent-custom-select__option" data-preset-value="__custom__" type="button">
                        <strong>自定义 (空白配置)</strong>
                        <span>完全自定义的供应商配置</span>
                    </button>
                    `
                ].join('');

                // Add click listeners to options
                this.agentProviderPresetOptions.querySelectorAll('[data-preset-value]').forEach(opt => {
                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const val = opt.dataset.presetValue;
                        this.setPresetSelectValue(val);
                        this.togglePresetSelectDropdown(false);
                        this.handleProviderPresetSelectionChange(val);
                    });
                });
            }
            this.setPresetSelectValue(selected.presetId || (selected.presetId === null ? '__custom__' : ''));
        }

        if (this.agentProviderNameInput) this.agentProviderNameInput.value = selected.label || '';
        if (this.agentApiTypeInput) this.agentApiTypeInput.value = selected.apiType || this.getAgentPreset(selected.presetId)?.apiType || 'anthropic-messages';
        this.renderAgentModelPicker(selected);
        if (this.agentBaseUrlInput) this.agentBaseUrlInput.value = selected.baseURL || '';
        if (this.agentApiKeyInput) this.agentApiKeyInput.value = selected.apiKey || '';
        if (this.agentSdkOptionsInput) this.agentSdkOptionsInput.value = this.stringifyAgentSdkOptions(selected.sdkOptions || {});
        this.parseAgentSdkOptions({ showError: false });
        if (this.agentEndpointOptions) {
            const endpoints = this.getMergedAgentEndpointCandidates(selected);
            this.agentEndpointOptions.innerHTML = endpoints.map((endpoint) => `<option value="${this.escapeHtml(endpoint)}"></option>`).join('');
        }
        const activePreset = selected.presetId ? this.getAgentPreset(selected.presetId) : null;
        if (this.agentPresetDocsBtn) {
            this.agentPresetDocsBtn.hidden = !Boolean(activePreset?.websiteUrl || activePreset?.apiKeyUrl);
            this.agentPresetDocsBtn.textContent = activePreset?.apiKeyUrl ? '获取 Key' : '打开官网';
        }

        // Show/hide delete button
        if (this.agentDeleteProviderBtn) {
            this.agentDeleteProviderBtn.hidden = Boolean(this.newProviderDraft) || this.selectedProviderId === null;
        }
        this.updateAgentConfigHint();
        if (this.unifiedSettings && !this.unifiedSettings.userTouched.has('models')) this.unifiedSettings.markSaved('models');
    }

    handleAgentConfigInput() {
        const selected = this.getSelectedProvider();
        if (!selected) return;
        const sdkOptions = this.parseAgentSdkOptions({ showError: false });
        const updatedFields = {
            label: this.agentProviderNameInput?.value.trim() || '未命名供应商',
            apiType: this.agentApiTypeInput?.value || selected.apiType || 'anthropic-messages',
            model: this.getAgentModelFormValue() || selected.model || '',
            baseURL: this.agentBaseUrlInput?.value.trim() || '',
            apiKey: this.agentApiKeyInput?.value.trim() || '',
            sdkOptions: sdkOptions || selected.sdkOptions || {}
        };

        if (this.newProviderDraft) {
            Object.assign(this.newProviderDraft, updatedFields);
            this.newProviderDraft.endpointCandidates = this.agentProviderStore?.getEndpointCandidates(this.newProviderDraft) || [];
            this.newProviderDraft.models = this.agentProviderStore?.getModelOptions(this.newProviderDraft) || [];
        } else if (this.unifiedSettings) {
            if (!this.editProviderDraft) this.editProviderDraft = structuredClone(selected);
            Object.assign(this.editProviderDraft, updatedFields);
        } else {
            this.agentProviderStore?.updateSelectedProvider(updatedFields);
            this.syncAgentProviderStoreState();
            this.agentConfig = this.buildAgentConfigFromActiveProvider();
            this.renderProviderList();
            this.renderAgentWorkbench();
        }
        this.updateAgentConfigHint();
    }

    handleAgentProviderChange() {
        // Kept for backward compat with /provider command but no longer used by UI
    }

    updateAgentConfigHint(extraMessage = '') {
        // No-op - removed layout hint element
    }

    getAgentVisualState() {
        if (this.agentTestingConnection) return 'testing_connection';
        if (this.agentRunState?.status) return this.agentRunState.status;
        return this.agentSessionId ? 'ready' : 'disconnected';
    }

    getAgentStatusDetailText() {
        if (this.agentTestingConnection) {
            return '正在验证 URL、模型与 API Key 是否可用。';
        }

        const state = this.getAgentVisualState();
        if (state === 'running') {
            return this.getAgentLiveStatusLabel({ includeSdkDetail: false });
        }

        if (state === 'waiting_approval' || state === 'waiting_user_answer') {
            return this.getAgentLiveStatusLabel({ includeSdkDetail: true });
        }

        if (this.agentActiveSkill && state !== 'failed' && state !== 'interrupted') {
            return `已选中 ${this.agentActiveSkill.label}，可以直接补充要求发送；留空发送会使用该 Skill 的默认起手式。`;
        }

        return this.agentRunState.stageMessage
            || this.agentRunState.lastSummary
            || this.agentRunState.lastError
            || '请先配置 Provider 并测试连接。';
    }

    formatAgentTimestamp(value) {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatAgentDuration() {
        const { startedAt, finishedAt, active } = this.agentRunState || {};
        if (!startedAt) return '00:00';
        const start = new Date(startedAt).getTime();
        if (Number.isNaN(start)) return '00:00';
        const end = active
            ? Date.now()
            : (finishedAt ? new Date(finishedAt).getTime() : Date.now());
        const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    startAgentTicker() {
        if (this.agentTicker) {
            window.clearInterval(this.agentTicker);
        }
        this.agentTicker = window.setInterval(() => {
            this.renderAgentChrome();
            if (this.agentRunState?.active) {
                this.patchLiveAgentStatus();
            }
        }, 1000);
    }

    installFastAgentToggle() {
        if (this._agentFastToggleBound || !this.agentWorkbenchToggle) return;
        this._agentFastToggleBound = true;
        this.agentWorkbenchToggle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            this._agentSuppressNextClick = true;
            this.toggleAgentWorkbenchFromEntry();
        });
        this.agentWorkbenchToggle.addEventListener('click', () => {
            if (this._agentSuppressNextClick) {
                this._agentSuppressNextClick = false;
                return;
            }
            this.toggleAgentWorkbenchFromEntry();
        });
    }

    async bootstrapAgentWorkbench() {
        await this.loadPersistedAgentProviderConfig();
        await Promise.allSettled([
            this.loadAgentProviderPresets(),
            this.loadAgentSkills(),
            this.loadAgentCommands(),
            this.loadAgentSdkInfo(),
            this.loadAgentSessions({ prewarm: false })
        ]);
        this.syncAgentConfigForm();
        if (this.agentWorkbenchOpen) {
            this.renderAgentWorkbench({ deferHeavy: true });
            this.scheduleAgentWorkbenchHydration();
        } else {
            this.renderAgentWorkbench({ deferHeavy: true });
        }
        await this.restoreAgentSession();
        this.finishAgentPetHydration();
    }

    async loadPersistedAgentProviderConfig() {
        try {
            const response = await fetch('/api/agent-provider-config', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Provider config request failed: ${response.status}`);
            const payload = await response.json();
            if (payload.exists && payload.config) {
                this.agentProviderStore?.replaceState(payload.config);
                this.syncAgentProviderStoreState();
                this.agentConfig = this.buildAgentConfigFromActiveProvider();
            }
            this.agentProviderPersistenceReady = true;
            if (!payload.exists) {
                await this.persistAgentProviderConfig();
            }
        } catch (error) {
            this.agentProviderPersistenceReady = true;
            console.warn('Failed to load persisted agent provider config:', error);
        }
    }

    scheduleAgentProviderPersistence() {
        if (!this.agentProviderPersistenceReady) return;
        window.clearTimeout(this._agentProviderPersistTimer);
        this._agentProviderPersistTimer = window.setTimeout(() => {
            this._agentProviderPersistTimer = null;
            this.persistAgentProviderConfig().catch((error) => {
                console.warn('Failed to persist agent provider config:', error);
            });
        }, 250);
    }

    async persistAgentProviderConfig() {
        if (!this.agentProviderPersistenceReady) return false;
        const response = await fetch('/api/agent-provider-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.agentProviderStore?.exportState() || {})
        });
        if (!response.ok) {
            throw new Error(await response.text() || `Provider config save failed: ${response.status}`);
        }
        return true;
    }

    async handleNewAgentSessionClick() {
        if (this._agentCreatingSession) return;
        this._agentCreatingSession = true;
        try {
            const reusableSessionId = this.findReusableAgentSessionId();
            if (reusableSessionId) {
                await this.switchAgentSession(reusableSessionId);
            } else {
                await this.createAgentSession({ switchTo: true });
            }
            this.renderAgentWorkbench();
        } finally {
            this._agentCreatingSession = false;
        }
    }

    openAgentWorkbench() {
        this.agentWorkbenchOpen = true;
        this.writeAgentStorage('workbench-open', true);
        this.renderAgentWorkbench({ deferHeavy: true });
        this.refreshAnnotationUI();
        this.agentInput?.focus();
        this.scheduleAgentWorkbenchHydration();
    }

    closeAgentWorkbench() {
        this.agentWorkbenchOpen = false;
        if (this._agentWorkbenchHydrateTimer) {
            window.clearTimeout(this._agentWorkbenchHydrateTimer);
            this._agentWorkbenchHydrateTimer = null;
        }
        this.agentSkillMenuOpen = false;
        this.agentCommandMenuOpen = false;
        this.agentConfigModalOpen = false;
        this.writeAgentStorage('workbench-open', false);
        this.writeAgentStorage('config-open', false);
        this.renderAgentWorkbench();
        this.refreshAnnotationUI();
    }

    toggleAgentWorkbench() {
        if (this.agentWorkbenchOpen) {
            this.closeAgentWorkbench();
        } else {
            this.openAgentWorkbench();
        }
    }

    async toggleAgentWorkbenchFromEntry() {
        if (this.agentWorkbenchOpen) {
            this.closeAgentWorkbench();
            return;
        }
        const rememberedSessionId = this.readAgentStorage('session-id', null);
        this.openAgentWorkbench();
        await this.ensureEntryAgentSession(rememberedSessionId);
    }

    // 由左侧 Prota 入口唤起时决定会话作用域：
    // - 处于某个页面（page 视图）内 → 关联当前页面（page 作用域）
    // - 处于项目外层（项目/Skill/模板 首页）→ 不关联任何页面（global 作用域）
    async ensureEntryAgentSession(rememberedSessionId = null) {
        if (this._agentEntrySessionResolving) return;
        this._agentEntrySessionResolving = true;
        try {
            await this.loadAgentSessions({ prewarm: false });

            if (this.currentTopView !== 'page') {
                // 项目外层：使用全局会话，不绑定页面
                const reusableSessionId = this.findReusableAgentSessionId({ sessionScope: 'global' });
                if (reusableSessionId) {
                    await this.switchAgentSession(reusableSessionId, { skipListReload: true, forceRefresh: true, awaitRefresh: true });
                } else {
                    await this.createAgentSession({ switchTo: true, title: 'Prota', sessionScope: 'global' });
                }
                await this.applyAgentGlobalContext();
            } else {
                // 页面内：关联当前页面
                const currentContext = this.getAgentContext();
                const rememberedSession = await this.getRememberedAgentSessionRecord(rememberedSessionId);
                if (rememberedSession && this.doesAgentSessionMatchContext(rememberedSession, currentContext)) {
                    await this.switchAgentSession(rememberedSession.id, { skipListReload: true, forceRefresh: true, awaitRefresh: true });
                } else {
                    await this.createAgentSession({ switchTo: true, title: '新会话', sessionScope: 'page' });
                }
            }

            this.agentActiveSkill = null;
            this.renderAgentWorkbench();
            this.agentInput?.focus();
        } catch (error) {
            console.warn('Failed to resolve entry agent session:', error);
            this.showToast(`打开 Prota 失败: ${error instanceof Error ? error.message : String(error)}`, true);
        } finally {
            this._agentEntrySessionResolving = false;
        }
    }

    async getRememberedAgentSessionRecord(rememberedSessionId = null) {
        rememberedSessionId = rememberedSessionId || this.readAgentStorage('session-id', null);
        if (!rememberedSessionId) return null;

        const listSession = (this.agentSessionsList || []).find((session) => (
            session?.id === rememberedSessionId && !session.archived
        ));
        if (listSession) return listSession;

        const cached = this.getCachedAgentSessionHistory(rememberedSessionId);
        if (cached) return this.createAgentSessionRecordFromHistory(cached, rememberedSessionId);

        try {
            const history = await this.agentApi.getSessionHistory(rememberedSessionId);
            this.cacheAgentSessionHistory(rememberedSessionId, history);
            return this.createAgentSessionRecordFromHistory(history, rememberedSessionId);
        } catch (error) {
            console.warn('Failed to load remembered agent session:', error);
            return null;
        }
    }

    createAgentSessionRecordFromHistory(history = {}, fallbackSessionId = '') {
        const context = history.context || {};
        const sessionScope = history.sessionScope || (context.globalContext || context.pageId === '__global__' ? 'global' : 'page');
        const resolved = sessionScope === 'global'
            ? null
            : this.resolvePageProject(context.pageId, context.version, context.projectId);
        return {
            id: history.sessionId || fallbackSessionId,
            sessionScope,
            projectId: resolved?.project?.id || context.projectId || this.activeProjectId || 'readify',
            pageId: resolved?.page?.id || context.pageId,
            version: context.version,
            archived: false
        };
    }

    doesAgentSessionMatchContext(session = {}, context = {}) {
        if (!session?.id || session.archived) return false;
        if ((session.sessionScope || 'page') === 'global' || session.pageId === '__global__') return false;
        if (session.pageId !== context.pageId || session.version !== context.version) return false;
        const sessionProjectId = this.resolvePageProject(session.pageId, session.version, session.projectId)?.project?.id
            || session.projectId
            || '';
        const contextProjectId = this.resolvePageProject(context.pageId, context.version, context.projectId)?.project?.id
            || context.projectId
            || '';
        return !sessionProjectId || !contextProjectId || sessionProjectId === contextProjectId;
    }

    scheduleAgentWorkbenchHydration() {
        if (this._agentWorkbenchHydrateTimer || this._agentWorkbenchHydrateRaf) return;
        this._agentWorkbenchHydrateTimer = window.setTimeout(() => {
            this._agentWorkbenchHydrateTimer = null;
            this._agentWorkbenchHydrateRaf = requestAnimationFrame(() => {
                this._agentWorkbenchHydrateRaf = null;
                if (!this.agentWorkbenchOpen) return;
                this.renderAgentWorkbench();
            });
        }, 260);
    }

    openAgentConfigModal() {
        if (this.unifiedSettings) return this.unifiedSettings.open('models');
        this.agentConfigModalOpen = true;
        this.agentSkillMenuOpen = false;
        this.syncAgentConfigForm();
        if (this.agentWorkbenchOpen) {
            this.renderAgentWorkbench({ deferHeavy: true });
            this.scheduleAgentWorkbenchHydration();
        } else {
            this.renderAgentWorkbench();
        }
    }

    closeAgentConfigModal() {
        if (this.unifiedSettings && !this.unifiedSettings.root.hidden) return this.unifiedSettings.requestClose();
        this.agentConfigModalOpen = false;
        this.renderAgentWorkbench();
    }

    toggleAgentConfigModal() {
        if (this.agentConfigModalOpen) {
            this.closeAgentConfigModal();
            return;
        }
        this.openAgentConfigModal();
    }

    openAgentSkillMenu() {
        const shouldRefresh = !this.agentSkillMenuOpen || Date.now() - (this.agentCatalogLoadedAt || 0) > 1000;
        this.agentSkillMenuOpen = true;
        this.renderAgentWorkbench();
        if (shouldRefresh) {
            void this.refreshAgentCatalog();
        }
    }

    closeAgentSkillMenu() {
        if (!this.agentSkillMenuOpen) return;
        this.agentSkillMenuOpen = false;
        this.renderAgentWorkbench();
    }

    toggleAgentSkillMenu() {
        this.agentSkillMenuOpen = !this.agentSkillMenuOpen;
        this.renderAgentWorkbench();
    }

    openAgentCommandMenu() {
        const shouldRefresh = !this.agentCommandMenuOpen || Date.now() - (this.agentCatalogLoadedAt || 0) > 1000;
        this.agentCommandMenuOpen = true;
        this.agentSelectedCommandIndex = 0;
        this.renderAgentWorkbench();
        if (shouldRefresh) {
            void this.refreshAgentCatalog();
        }
    }

    closeAgentCommandMenu() {
        if (!this.agentCommandMenuOpen) return;
        this.agentCommandMenuOpen = false;
        this.renderAgentWorkbench();
    }

    toggleAgentCommandMenu() {
        if (this.agentCommandMenuOpen) {
            this.closeAgentCommandMenu();
        } else {
            this.agentCommandQuery = this.agentInput?.value || '';
            this.openAgentCommandMenu();
            this.agentInput?.focus();
        }
    }

    isAgentInputComposing() {
        return Boolean(this.agentInputComposing || Date.now() - (this.agentInputLastCompositionAt || 0) < 300);
    }

    hasImageDragItems(dataTransfer) {
        const items = Array.from(dataTransfer?.items || []);
        if (items.length) {
            return items.some((item) => item.kind === 'file' && item.type.startsWith('image/'));
        }
        return Array.from(dataTransfer?.files || []).some((file) => file.type.startsWith('image/'));
    }

    createAgentAttachmentId() {
        return window.crypto?.randomUUID?.() || `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    formatAgentAttachmentSize(size = 0) {
        if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
        if (size >= 1024) return `${Math.round(size / 1024)} KB`;
        return `${size} B`;
    }

    readAgentAttachmentFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
            reader.readAsDataURL(file);
        });
    }

    getAgentImageNoticeProvider() {
        const provider = this.getActiveProvider();
        return {
            id: provider?.id || this.agentConfig?.provider || '__unconfigured__',
            label: provider?.label || this.getAgentPreset(this.agentConfig?.provider)?.label || '当前供应商',
            model: provider?.model || this.agentConfig?.model || ''
        };
    }

    hasConfirmedAgentImageNotice(providerId) {
        const confirmedProviders = this.readAgentStorage('image-upload-notice-confirmed', {});
        return Boolean(confirmedProviders && typeof confirmedProviders === 'object' && confirmedProviders[providerId]);
    }

    hasDisabledAgentImageNotice() {
        return this.readAgentStorage('image-upload-notice-disabled', false) === true;
    }

    ensureAgentImageUploadNotice() {
        if (this.hasDisabledAgentImageNotice()) return Promise.resolve(true);
        const provider = this.getAgentImageNoticeProvider();
        if (this.hasConfirmedAgentImageNotice(provider.id)) return Promise.resolve(true);
        if (this._agentImageNoticeResolve) return Promise.resolve(false);

        if (this.agentImageNoticeRemember) this.agentImageNoticeRemember.checked = false;
        if (this.agentImageNoticeProvider) this.agentImageNoticeProvider.textContent = provider.label;
        if (this.agentImageNoticeModel) {
            this.agentImageNoticeModel.textContent = provider.model;
            this.agentImageNoticeModel.hidden = !provider.model;
        }
        this._agentImageNoticePreviousFocus = document.activeElement;
        if (this.agentImageNoticeModal) this.agentImageNoticeModal.hidden = false;
        window.requestAnimationFrame(() => this.agentImageNoticeOk?.focus());
        return new Promise((resolve) => {
            this._agentImageNoticeResolve = resolve;
        });
    }

    confirmAgentImageUploadNotice() {
        if (this.agentImageNoticeRemember?.checked) {
            this.writeAgentStorage('image-upload-notice-disabled', true);
        }
        const provider = this.getAgentImageNoticeProvider();
        const confirmedProviders = this.readAgentStorage('image-upload-notice-confirmed', {});
        const nextConfirmedProviders = confirmedProviders && typeof confirmedProviders === 'object'
            ? { ...confirmedProviders }
            : {};
        nextConfirmedProviders[provider.id] = Date.now();
        this.writeAgentStorage('image-upload-notice-confirmed', nextConfirmedProviders);
        this.closeAgentImageUploadNotice(true);
    }

    closeAgentImageUploadNotice(confirmed) {
        if (this.agentImageNoticeModal) this.agentImageNoticeModal.hidden = true;
        const previousFocus = this._agentImageNoticePreviousFocus;
        this._agentImageNoticePreviousFocus = null;
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        if (!this._agentImageNoticeResolve) return;
        const resolve = this._agentImageNoticeResolve;
        this._agentImageNoticeResolve = null;
        resolve(Boolean(confirmed));
    }

    async addAgentAttachmentFiles(fileList) {
        if (this.agentRunState.active) {
            this.showToast('Prota 正在执行任务，结束后再上传图片。', true);
            return;
        }
        if (this.agentPendingQuestion) {
            this.showToast('当前追问先用文字回答，图片可在下一轮发送。', true);
            return;
        }

        const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return;
        if (!await this.ensureAgentImageUploadNotice()) return;

        const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
        const availableSlots = Math.max(0, this.agentAttachmentLimit - this.agentAttachments.length);
        if (!availableSlots) {
            this.showToast(`一次最多上传 ${this.agentAttachmentLimit} 张图片。`, true);
            return;
        }

        const accepted = [];
        for (const file of files.slice(0, availableSlots)) {
            if (!allowedTypes.has(file.type)) {
                this.showToast('目前支持 PNG、JPG、WebP 图片。', true);
                continue;
            }
            if (file.size > this.agentAttachmentMaxBytes) {
                this.showToast(`图片不能超过 ${this.formatAgentAttachmentSize(this.agentAttachmentMaxBytes)}。`, true);
                continue;
            }
            try {
                accepted.push({
                    id: this.createAgentAttachmentId(),
                    name: file.name || 'image',
                    mimeType: file.type,
                    size: file.size,
                    dataUrl: await this.readAgentAttachmentFile(file)
                });
            } catch (error) {
                this.showToast(error instanceof Error ? error.message : '图片读取失败', true);
            }
        }

        if (files.length > availableSlots) {
            this.showToast(`已保留前 ${availableSlots} 张图片，一次最多 ${this.agentAttachmentLimit} 张。`, true);
        }

        if (!accepted.length) return;
        this.agentAttachments = this.agentAttachments.concat(accepted);
        this.renderAgentAttachments();
        this.renderAgentControls();
    }

    removeAgentAttachment(id) {
        this.agentAttachments = this.agentAttachments.filter((item) => item.id !== id);
        this.renderAgentAttachments();
        this.renderAgentControls();
    }

    clearAgentAttachments() {
        this.agentAttachments = [];
        this.renderAgentAttachments();
        this.renderAgentControls();
    }

    getAgentAttachmentPayloads() {
        return this.agentAttachments.map((item) => ({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            size: item.size,
            dataUrl: item.dataUrl
        }));
    }

    renderAgentAttachments() {
        if (!this.agentAttachmentBar) return;
        const attachments = this.agentAttachments || [];
        this.agentAttachmentBar.hidden = attachments.length === 0;
        this.agentAttachmentBar.innerHTML = attachments.map((item) => `
            <div class="agent-attachment-chip" title="${this.escapeHtml(`${item.name} · ${this.formatAgentAttachmentSize(item.size)}`)}">
                <img src="${this.escapeHtml(item.dataUrl)}" alt="${this.escapeHtml(item.name || '上传图片')}">
                <span class="agent-attachment-chip__name">${this.escapeHtml(item.name || 'image')}</span>
                <button class="agent-attachment-chip__remove" type="button" data-agent-remove-attachment="${this.escapeHtml(item.id)}" aria-label="移除图片">×</button>
            </div>
        `).join('');
    }

    setAgentPrdContext(type, name, content) {
        if (this.agentRunState?.active) {
            this.showToast('Prota 正在执行任务，结束后再添加 PRD 上下文。', true);
            return;
        }
        this.agentPrdContext = { type, name, content };
        this.renderAgentPrdContext();
        this.renderAgentControls();
    }

    clearAgentPrdContext() {
        this.agentPrdContext = null;
        this.renderAgentPrdContext();
        this.renderAgentControls();
    }

    formatAgentPrdContextMessage() {
        if (!this.agentPrdContext) return '';
        const { type, name, content } = this.agentPrdContext;
        if (type === 'whole') {
            return `<details>\n<summary><b>[PRD 完整文档 (${name})]</b></summary>\n\n${content}\n\n</details>`;
        } else {
            return `> **[PRD 选中文本上下文]**\n> ${content.split('\n').join('\n> ')}`;
        }
    }

    renderAgentPrdContext() {
        if (!this.agentPrdContextBar) return;
        const prd = this.agentPrdContext;
        this.agentPrdContextBar.hidden = !prd;
        if (!prd) {
            this.agentPrdContextBar.innerHTML = '';
            return;
        }
        
        const typeLabel = prd.type === 'whole' ? '完整 PRD' : 'PRD 选区';
        const displayLabel = prd.type === 'whole' ? prd.name : prd.content.substring(0, 30) + (prd.content.length > 30 ? '...' : '');

        this.agentPrdContextBar.innerHTML = `
            <div class="agent-active-prd-context" title="${this.escapeHtml(`${typeLabel}: ${prd.name || prd.content}`)}">
                <span class="agent-active-prd-context__icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                </span>
                <div class="agent-active-prd-context__meta">
                    <span class="agent-active-prd-context__label">${this.escapeHtml(displayLabel)}</span>
                    <span class="agent-active-prd-context__type">${this.escapeHtml(typeLabel)}</span>
                </div>
                <button class="agent-active-prd-context__clear" type="button" data-agent-clear-prd-context="1" aria-label="清除上下文">×</button>
            </div>
        `;
    }

    handleAgentInputChange() {
        this.resizeAgentInput();
        const value = this.agentInput?.value || '';
        if (value.startsWith('/') || this.agentCommandMenuOpen) {
            this.agentCommandQuery = value.startsWith('/') ? value.slice(1) : value;
            this.openAgentCommandMenu();
            this.closeAgentAutocomplete();
            return;
        }
        this.agentCommandQuery = '';
        this.closeAgentCommandMenu();

        // Autocomplete "@" selector
        const selectionStart = this.agentInput?.selectionStart || 0;
        const textBeforeCursor = value.substring(0, selectionStart);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : '';
            if (charBeforeAt === '' || charBeforeAt === ' ' || charBeforeAt === '\n') {
                const atQuery = textBeforeCursor.substring(lastAtIndex + 1);
                if (!atQuery.includes(' ') && !atQuery.includes('\n')) {
                    this.agentAutocompleteQuery = atQuery;
                    this.openAgentAutocomplete();
                    return;
                }
            }
        }
        
        this.agentAutocompleteQuery = '';
        this.closeAgentAutocomplete();
    }

    resizeAgentInput() {
        const input = this.agentInput;
        if (!input) return;
        const minHeight = 74;
        const maxHeight = Math.min(190, Math.max(132, Math.floor((window.innerHeight || 900) * 0.24)));
        input.style.height = 'auto';
        const nextHeight = Math.min(maxHeight, Math.max(minHeight, input.scrollHeight));
        input.style.height = `${nextHeight}px`;
        input.style.overflowY = input.scrollHeight > maxHeight + 1 ? 'auto' : 'hidden';
    }

    getFilteredAgentCommands() {
        const rawQuery = (this.agentCommandQuery || '').trim().toLowerCase();
        const commands = this.agentAvailableCommands || [];
        if (!rawQuery) {
            const recentIds = this.agentRecentCommands || [];
            const recent = recentIds
                .map((id) => this.getAgentCommand(id))
                .filter(Boolean);
            const remaining = commands.filter((command) => !recent.some((item) => item.id === command.id));
            return {
                recent,
                filtered: remaining
            };
        }
        const filtered = commands
            .map((command, index) => ({
                command,
                index,
                score: this.getAgentCommandMatchScore(command, rawQuery)
            }))
            .filter((item) => item.score < Number.POSITIVE_INFINITY)
            .sort((a, b) => a.score - b.score || a.index - b.index)
            .map((item) => item.command);
        return {
            recent: [],
            filtered
        };
    }

    getAgentCommandMatchScore(command = {}, rawQuery = '') {
        const query = String(rawQuery || '').trim().toLowerCase();
        if (!query) return 0;
        const aliases = (command.aliases || []).map((alias) => String(alias).replace(/^\//, '').toLowerCase());
        const primary = [
            command.id,
            command.label,
            ...aliases
        ].filter(Boolean).map((item) => String(item).toLowerCase());
        const description = String(command.description || '').toLowerCase();
        if (primary.some((item) => item === query)) return 0;
        if (primary.some((item) => item.startsWith(query))) return 1;
        if (primary.some((item) => item.includes(query))) return 2;
        if (description.includes(query)) return 6;
        return Number.POSITIVE_INFINITY;
    }

    getAgentCommandGroup(command = {}) {
        if (command.kind === 'skill' || command.skillId) {
            return { key: 'skill', label: 'Skill', order: 0 };
        }
        const category = String(command.category || '').toLowerCase();
        if (category === 'sdk') {
            return { key: 'sdk', label: 'SDK', order: 1 };
        }
        if (category === 'config') {
            return { key: 'config', label: 'Config', order: 2 };
        }
        if (category === 'workbench') {
            return { key: 'workbench', label: 'Workbench', order: 3 };
        }
        return {
            key: category || 'command',
            label: command.category || 'Command',
            order: 9
        };
    }

    groupAgentCommandsForMenu(commands = []) {
        const groups = new Map();
        commands.forEach((command) => {
            const group = this.getAgentCommandGroup(command);
            if (!groups.has(group.key)) {
                groups.set(group.key, {
                    ...group,
                    items: []
                });
            }
            groups.get(group.key).items.push(command);
        });
        return Array.from(groups.values())
            .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'zh-Hans-CN'));
    }

    flattenAgentCommandsForSelection() {
        const { recent, filtered } = this.getFilteredAgentCommands();
        const grouped = this.groupAgentCommandsForMenu(filtered).flatMap((group) => group.items);
        return [...recent, ...grouped];
    }

    moveAgentCommandSelection(delta) {
        const items = this.flattenAgentCommandsForSelection();
        if (!items.length) return;
        const next = (this.agentSelectedCommandIndex + delta + items.length) % items.length;
        this.agentSelectedCommandIndex = next;
        this.renderAgentWorkbench();
    }

    applySelectedAgentCommand() {
        const selectedCommand = this.flattenAgentCommandsForSelection()[this.agentSelectedCommandIndex];
        if (!selectedCommand) return;
        void this.executeSlashCommandById(selectedCommand.id);
    }

    selectAgentSkill(skillId) {
        const skill = this.getAgentSkill(skillId);
        if (!skill) return;
        this.agentActiveSkill = skill;
        this.agentSkillMenuOpen = false;
        this.renderAgentWorkbench();
        this.agentInput?.focus();
    }

    clearActiveAgentSkill() {
        this.agentActiveSkill = null;
        this.renderAgentWorkbench();
    }

    renderAgentChrome() {
        const state = this.getAgentVisualState();
        if (state !== this.miniTerminalState) {
            this.miniTerminalState = state;
        }
        this.syncAgentPetState(state);

        this.applyAgentPanelWidth();
        this.agentWorkbench?.classList.toggle('is-open', this.agentWorkbenchOpen);
        this.agentWorkbench?.classList.toggle('is-sidebar-open', this.agentSessionDrawerOpen);
        this.sidebar?.classList.toggle('is-agent-open', this.agentWorkbenchOpen);
        this.sidebar?.classList.toggle('is-agent-session-open', this.agentWorkbenchOpen && this.agentSessionDrawerOpen);
        // 项目外（工作区/全局会话）打开时，工作台标记为全局会话（CSS 据此隐藏面板顶栏等页面相关控件）
        const ctx = this.agentSessionContext || {};
        const isGlobalSession = this.agentSessionScope === 'global' || ctx.globalContext || ctx.pageId === '__global__';
        this.agentWorkbench?.classList.toggle('is-global-session', !!isGlobalSession);
        this.agentWorkbenchToggle?.classList.toggle('is-open', this.agentWorkbenchOpen);
        if (this.agentWorkbenchToggle) {
            this.agentWorkbenchToggle.dataset.state = state;
            this.agentWorkbenchToggle.setAttribute('aria-expanded', String(this.agentWorkbenchOpen));
            this.agentWorkbenchToggle.title = this.agentWorkbenchOpen ? '关闭 Prota' : '打开 Prota';
        }

        if (this.agentStatusPill) {
            const copy = AGENT_STATUS_COPY[state] || AGENT_STATUS_COPY.disconnected;
            this.agentStatusPill.textContent = copy.label;
            this.agentStatusPill.dataset.state = state;
            this.agentStatusPill.hidden = state === 'ready' || state === 'succeeded';
        }

        if (this.agentStatusContext) {
            this.renderAgentStatusContextControl();
        }

        if (this.agentBindPageBtn) {
            this.agentBindPageBtn.hidden = true;
        }

        if (this.agentRunTimer) {
            this.agentRunTimer.textContent = this.formatAgentDuration();
        }

        if (this.agentConfigModal) {
            this.agentConfigModal.hidden = !this.agentConfigModalOpen;
        }

        if (this.agentDebugTools) {
            this.agentDebugTools.hidden = !(this.agentDebugMode && this.agentConfigModalOpen);
        }

        if (this.agentSkillMenu) {
            this.agentSkillMenu.hidden = true;
        }

        if (this.agentSkillMenuToggle) {
            this.agentSkillMenuToggle.classList.toggle('is-open', this.agentCommandMenuOpen);
        }

        if (this.agentCommandMenu) {
            this.agentCommandMenu.hidden = !this.agentCommandMenuOpen;
        }

        this.agentWorkbench?.querySelector('.agent-workbench__main')?.classList.toggle('is-sidebar-open', this.agentSessionDrawerOpen);
        this.agentWorkbench?.querySelector('.agent-session-sidebar')?.classList.toggle('is-open', this.agentSessionDrawerOpen);
    }

    renderAgentControls() {
        const active = Boolean(this.agentRunState.active);
        const answeringQuestion = Boolean(this.agentPendingQuestion);
        const configBusy = this.agentTestingConnection || this.agentFetchingModels;
        const configLocked = configBusy;
        const contextState = this.getAgentContextDeletionState(this.agentSessionContext || this.getAgentContext());
        const contextBlocked = contextState.blocked;

        [
            this.agentApiTypeInput,
            this.agentModelInput,
            this.agentCustomModelInput,
            this.agentBaseUrlInput,
            this.agentApiKeyInput,
            this.agentProviderNameInput,
            this.agentSdkOptionsInput,
            this.agentSdkOptionsFormatBtn,
            this.agentSdkOptionsResetBtn,
            this.agentSdkOptionsPresetBtn,
            this.agentFetchModelsBtn,
            this.agentPresetDocsBtn,
            this.agentTestConnectionBtn,
            this.agentSaveProviderBtn,
            this.agentDeleteProviderBtn
        ].forEach((el) => {
            if (!el) return;
            el.disabled = active || configBusy;
        });

        if (this.agentSkillMenuToggle) {
            this.agentSkillMenuToggle.disabled = active || configBusy || contextBlocked;
        }

        if (this.agentImageUploadBtn) {
            const attachmentLocked = active || this.agentTestingConnection || answeringQuestion || (contextBlocked && !this.agentActiveSkill?.globalContext);
            this.agentImageUploadBtn.disabled = attachmentLocked;
            this.agentImageUploadBtn.classList.toggle('is-active', this.agentAttachments.length > 0);
        }

        if (this.agentSendBtn) {
            const hasMessage = Boolean(this.agentInput?.value.trim());
            const hasAttachments = this.agentAttachments.length > 0;
            const hasPrdContext = Boolean(this.agentPrdContext);
            const hasFeedback = this.feedbackItems.length > 0;
            const hasSkillStarter = Boolean(this.agentActiveSkill?.defaultStarter);
            const isRunning = active && !answeringQuestion;
            this.agentSendBtn.classList.toggle('is-running', isRunning);
            this.agentSendBtn.disabled =
                this.agentTestingConnection ||
                (contextBlocked && !this.agentActiveSkill?.globalContext) ||
                (!isRunning && !answeringQuestion && !hasMessage && !hasAttachments && !hasPrdContext && !hasFeedback && !this.agentActiveSkill) ||
                (!isRunning && !answeringQuestion && !hasMessage && !hasAttachments && !hasPrdContext && !hasFeedback && Boolean(this.agentActiveSkill?.requiresMessage) && !hasSkillStarter);
        }

        if (this.agentConfigToggle) {
            this.agentConfigToggle.disabled = configLocked;
        }

        this.agentDebugTools?.querySelectorAll('[data-agent-dev-simulate]').forEach((button) => {
            button.disabled = active || this.agentTestingConnection;
        });

        if (this.agentActiveSkillBar) {
            this.agentActiveSkillBar.hidden = !this.agentActiveSkill;
        }

        if (this.agentInput) {
            this.agentInput.disabled = contextBlocked && !this.agentActiveSkill?.globalContext;
            this.agentInput.placeholder = this.agentPendingQuestion
                ? '当前有待回答问题，直接在这里输入答案后发送。'
                : contextBlocked && !this.agentActiveSkill?.globalContext
                    ? contextState.reason
                : this.shouldContinueAnsweredQuestionThread()
                    ? '继续补充你的说明，发送后会接着上一轮推进。'
                : this.agentActiveSkill?.placeholder || '和 Prota 对话，输入 / 唤起命令。';
        }
    }

    shouldContinueAnsweredQuestionThread() {
        if (this.agentRunState.active || this.agentPendingQuestion) return false;
        if (!this.agentLastQuestionAnsweredAt) return false;
        const lastRunId = this.agentRunState?.runId;
        if (!lastRunId) return false;
        return (this.agentTimelineEvents || []).some((event) => (
            event.type === 'question_resolved'
            && event.runId === lastRunId
            && event.createdAt === this.agentLastQuestionAnsweredAt
        ));
    }

    async toggleAgentPlanMode() {
        const active = this.getActiveProvider();
        if (!active) return;
        const currentMode = active.sdkOptions?.planMode || false;
        const nextMode = !currentMode;
        active.sdkOptions = {
            ...(active.sdkOptions || {}),
            planMode: nextMode
        };
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
        this.persistProviders();
        this.syncAgentConfigForm();
        
        try {
            const sessionId = await this.ensureCurrentAgentSession();
            await this.agentApi.setProvider(sessionId, active);
        } catch (error) {
            console.warn('Failed to call agent.setProvider:', error);
        }
        
        this.renderPlanModeToggle();
        this.showToast(`Plan 模式已${nextMode ? '开启' : '关闭'}`);
    }

    renderPlanModeToggle() {
        if (!this.agentPlanModeToggle) return;
        const active = this.getActiveProvider();
        const planMode = active?.sdkOptions?.planMode || false;
        if (planMode) {
            this.agentPlanModeToggle.classList.add('is-active');
            this.agentPlanModeToggle.title = "Plan 模式已开启：Agent 必须先设计实施计划再执行修改";
        } else {
            this.agentPlanModeToggle.classList.remove('is-active');
            this.agentPlanModeToggle.title = "开启 Plan 模式后，Agent 必须先设计实施计划再执行修改";
        }
    }

    renderPermissionLabel() {
        if (!this.agentPermissionLabel) return;
        const mode = this.getActivePermissionMode();
        this.agentPermissionLabel.textContent = mode;
    }

    renderPermissionDropdown() {
        if (!this.agentPermissionDropdown) return;
        if (!this.agentPermissionDropdownOpen) {
            this.agentPermissionDropdown.hidden = true;
            return;
        }
        const activeMode = this.getActivePermissionMode();
        const modes = [
            { value: 'default', label: '默认询问', desc: '高危操作需授权' },
            { value: 'acceptEdits', label: '自动修改', desc: '修改自动授权' },
            { value: 'dontAsk', label: '完全自动', desc: '无需询问运行' },
            { value: 'bypassPermissions', label: '跳过权限', desc: '静默跳过验证' }
        ];
        
        const items = modes.map((m) => {
            const isActive = m.value === activeMode;
            return `<button class="agent-permission-dropdown__item${isActive ? ' is-active' : ''}" data-permission-mode="${this.escapeHtml(m.value)}" type="button" title="${this.escapeHtml(m.desc)}">
                <span class="agent-model-dropdown__item-name">${this.escapeHtml(m.label)}</span>
                <span class="agent-model-dropdown__item-model" style="font-size: 0.65rem;">${this.escapeHtml(m.value)}</span>
            </button>`;
        }).join('');

        this.agentPermissionDropdown.innerHTML = items;
        this.agentPermissionDropdown.hidden = false;
    }

    renderModelLabel() {
        if (!this.agentModelLabel) return;
        const active = this.getActiveProvider();
        if (active) {
            this.agentModelLabel.textContent = active.model || active.label || '--';
        } else {
            this.agentModelLabel.textContent = '--';
        }
    }

    renderModelDropdown() {
        if (!this.agentModelDropdown) return;
        if (!this.agentModelDropdownOpen) {
            this.agentModelDropdown.hidden = true;
            return;
        }
        const active = this.getActiveProvider();
        const allProviders = this.agentProviderStore?.providers || [];
        const items = allProviders.map((p) => {
            const isActive = p.id === this.activeProviderId;
            const modelDisplay = p.model || '';
            return `<button class="agent-model-dropdown__item${isActive ? ' is-active' : ''}" data-provider-id="${this.escapeHtml(p.id)}" type="button">
                <span class="agent-model-dropdown__item-name">${this.escapeHtml(p.label || p.id)}</span>
                ${modelDisplay ? `<span class="agent-model-dropdown__item-model">${this.escapeHtml(modelDisplay)}</span>` : ''}
            </button>`;
        }).join('');

        this.agentModelDropdown.innerHTML = items + `
            <div class="agent-model-dropdown__divider"></div>
            <button class="agent-model-dropdown__item agent-model-dropdown__item--settings" data-action="settings" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4.6H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.45.57 1 .6 1.58V11a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09c-.58.03-1.13.24-1.51.6z"></path>
                </svg>
                <span class="agent-model-dropdown__item-name">设置</span>
            </button>`;
        this.agentModelDropdown.hidden = false;
    }

    renderActiveAgentSkill() {
        if (!this.agentActiveSkillBar) return;
        if (!this.agentActiveSkill) {
            this.agentActiveSkillBar.innerHTML = '';
            return;
        }
        this.agentActiveSkillBar.innerHTML = `
            <div class="agent-active-skill">
                <div class="agent-active-skill__meta">
                    <div class="agent-active-skill__label">${this.escapeHtml(this.agentActiveSkill.label)}</div>
                    <div class="agent-active-skill__description">${this.escapeHtml(this.agentActiveSkill.description || '')}</div>
                </div>
                <button class="agent-active-skill__clear" type="button" data-agent-clear-skill="true" title="取消当前 Skill" ${this.agentRunState.active ? 'disabled' : ''}>×</button>
            </div>
        `;
    }

    renderAgentSkillMenu() {
        if (!this.agentSkillMenu) return;
        const skills = this.agentAvailableSkills || [];
        if (!skills.length) {
            this.agentSkillMenu.innerHTML = '<div class="agent-skill-menu__empty">暂时没有可用 Skill，请检查 Agent Gateway 是否正常启动。</div>';
            return;
        }
        this.agentSkillMenu.innerHTML = skills.map((skill) => `
            <button type="button" class="agent-skill-menu__item${this.agentActiveSkill?.id === skill.id ? ' is-active' : ''}" data-agent-skill-id="${this.escapeHtml(skill.id)}">
                <span class="agent-skill-menu__icon">${this.escapeHtml((skill.icon || skill.label || 'S').slice(0, 3))}</span>
                <span class="agent-skill-menu__content">
                    <span class="agent-skill-menu__label">${this.escapeHtml(skill.label)}</span>
                    <span class="agent-skill-menu__description">${this.escapeHtml(skill.description || '')}</span>
                </span>
            </button>
        `).join('');
    }

    renderAgentCommandMenu() {
        if (!this.agentCommandMenu) return;
        const { recent, filtered } = this.getFilteredAgentCommands();
        const sections = [];
        let cursor = 0;
        const renderSection = (label, items) => {
            if (!items.length) return '';
            const html = items.map((command, index) => {
                const absoluteIndex = cursor + index;
                return `
                    <button type="button" class="agent-command-menu__item${absoluteIndex === this.agentSelectedCommandIndex ? ' is-active' : ''}" data-agent-command-id="${this.escapeHtml(command.id)}">
                        <span class="agent-command-menu__icon">${this.escapeHtml((command.icon || command.label || 'CMD').slice(0, 4))}</span>
                        <span class="agent-command-menu__content">
                            <span class="agent-command-menu__title">
                                <span>/${this.escapeHtml(command.id)}</span>
                                <span class="agent-command-menu__usage">${this.escapeHtml(command.usage || '')}</span>
                            </span>
                            <span class="agent-command-menu__description">${this.escapeHtml(command.description || '')}</span>
                            <span class="agent-command-menu__meta">${this.escapeHtml(command.category || 'Command')}</span>
                        </span>
                    </button>
                `;
            }).join('');
            cursor += items.length;
            return `<section class="agent-command-menu__section"><div class="agent-command-menu__label">${this.escapeHtml(label)}</div>${html}</section>`;
        };

        sections.push(renderSection('最近使用', recent));
        this.groupAgentCommandsForMenu(filtered).forEach((group) => {
            sections.push(renderSection(group.label, group.items));
        });
        const content = sections.filter(Boolean).join('');
        this.agentCommandMenu.innerHTML = content || '<div class="agent-command-menu__empty">没有匹配的命令。请检查 .claude/skills 目录或使用 `/help` 查看当前命令。</div>';
    }

    openAgentAutocomplete() {
        if (this.agentAutocompleteOpen) return;
        this.agentAutocompleteOpen = true;
        this.agentAutocompleteIndex = 0;
        this.agentAutocompleteSelectedPage = null;
        this.renderAgentAutocomplete();
    }

    closeAgentAutocomplete() {
        if (!this.agentAutocompleteOpen) return;
        this.agentAutocompleteOpen = false;
        this.agentAutocompleteIndex = 0;
        this.agentAutocompleteSelectedPage = null;
        this.renderAgentAutocomplete();
    }

    renderAgentAutocomplete() {
        if (!this.agentAutocompleteDropdown) return;
        
        if (!this.agentAutocompleteOpen) {
            this.agentAutocompleteDropdown.classList.remove('is-open');
            return;
        }

        this.agentAutocompleteDropdown.classList.add('is-open');
        
        let html = '';
        const query = (this.agentAutocompleteQuery || '').toLowerCase();

        if (!this.agentAutocompleteSelectedPage) {
            // Stage 1: Select Page
            const activePages = (this.projects?.pages || []).filter((page) => !page.deleted);
            const filteredPages = activePages.filter((page) => {
                const name = (page.name || '').toLowerCase();
                const id = (page.id || '').toLowerCase();
                return id.includes(query) || name.includes(query);
            });

            html += `<div class="agent-autocomplete-group-title">选择页面范围 (第一步)</div>`;
            if (filteredPages.length === 0) {
                html += `<div class="agent-command-menu__empty">没有匹配的页面</div>`;
            } else {
                filteredPages.forEach((page, index) => {
                    const isSelected = index === this.agentAutocompleteIndex;
                    html += `
                        <button type="button" class="agent-autocomplete-item ${isSelected ? 'is-selected' : ''}" data-autocomplete-page-id="${this.escapeHtml(page.id)}">
                            <span>${this.escapeHtml(page.name || page.id)}</span>
                            <span class="agent-autocomplete-item__meta">${this.escapeHtml(page.id)}</span>
                        </button>
                    `;
                });
            }
        } else {
            // Stage 2: Select Version
            const page = this.agentAutocompleteSelectedPage;
            const versions = page.versions || [];
            
            html += `<div class="agent-autocomplete-group-title">选择版本范围 (第二步: ${this.escapeHtml(page.name || page.id)})</div>`;
            
            // Back button
            const isBackSelected = this.agentAutocompleteIndex === 0;
            html += `
                <button type="button" class="agent-autocomplete-item ${isBackSelected ? 'is-selected' : ''}" data-autocomplete-back="true" style="border-bottom: 1px solid rgba(148, 163, 184, 0.08); margin-bottom: 4px; border-radius: 8px 8px 0 0;">
                    <span style="color: #64748b; font-weight: 500;">← 返回页面列表</span>
                    <span class="agent-autocomplete-item__meta">Esc</span>
                </button>
            `;

            versions.forEach((version, idx) => {
                const isSelected = (idx + 1) === this.agentAutocompleteIndex;
                html += `
                    <button type="button" class="agent-autocomplete-item ${isSelected ? 'is-selected' : ''}" data-autocomplete-version="${this.escapeHtml(version)}">
                        <span>${this.escapeHtml(version.toUpperCase())}</span>
                        <span class="agent-autocomplete-item__meta">点击绑定</span>
                    </button>
                `;
            });
        }

        this.agentAutocompleteDropdown.innerHTML = html;
    }

    moveAgentAutocompleteSelection(delta) {
        const dropdown = this.agentAutocompleteDropdown;
        if (!dropdown) return;

        let max = 0;
        if (!this.agentAutocompleteSelectedPage) {
            // Stage 1: Pages
            const activePages = (this.projects?.pages || []).filter((page) => !page.deleted);
            const query = (this.agentAutocompleteQuery || '').toLowerCase();
            const filteredPages = activePages.filter((page) => {
                const name = (page.name || '').toLowerCase();
                const id = (page.id || '').toLowerCase();
                return id.includes(query) || name.includes(query);
            });
            max = filteredPages.length;
        } else {
            // Stage 2: Back button + Versions
            max = 1 + (this.agentAutocompleteSelectedPage.versions || []).length;
        }

        if (max === 0) return;
        this.agentAutocompleteIndex = (this.agentAutocompleteIndex + delta + max) % max;
        this.renderAgentAutocomplete();

        // Scroll selected item into view
        const selected = dropdown.querySelector('.agent-autocomplete-item.is-selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    async confirmAgentAutocompleteSelection() {
        if (!this.agentAutocompleteSelectedPage) {
            // Stage 1: Select Page
            const activePages = (this.projects?.pages || []).filter((page) => !page.deleted);
            const query = (this.agentAutocompleteQuery || '').toLowerCase();
            const filteredPages = activePages.filter((page) => {
                const name = (page.name || '').toLowerCase();
                const id = (page.id || '').toLowerCase();
                return id.includes(query) || name.includes(query);
            });
            const page = filteredPages[this.agentAutocompleteIndex];
            if (page) {
                this.agentAutocompleteSelectedPage = page;
                this.agentAutocompleteIndex = 1;
                this.renderAgentAutocomplete();
            }
        } else {
            // Stage 2: Select Back or Version
            if (this.agentAutocompleteIndex === 0) {
                this.agentAutocompleteSelectedPage = null;
                this.agentAutocompleteIndex = 0;
                this.renderAgentAutocomplete();
            } else {
                const versionIdx = this.agentAutocompleteIndex - 1;
                const version = (this.agentAutocompleteSelectedPage.versions || [])[versionIdx];
                if (version) {
                    const pageId = this.agentAutocompleteSelectedPage.id;
                    await this.bindAgentSessionToPage(pageId, version);
                }
            }
        }
    }

    async bindAgentSessionToPage(pageId, version) {
        const projectId = this.activeProjectId || 'readify';
        if (!this.agentSessionId) {
            await this.switchPage(pageId, version, { projectId });
            this.closeAgentAutocomplete();
            return;
        }

        try {
            await this.agentApi.setContext(this.agentSessionId, {
                projectId,
                pageId,
                version,
                sessionScope: 'page'
            });

            if (this.agentInput) {
                const value = this.agentInput.value;
                const selectionStart = this.agentInput.selectionStart || 0;
                const textBeforeCursor = value.substring(0, selectionStart);
                const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                if (lastAtIndex !== -1) {
                    const textAfterCursor = value.substring(selectionStart);
                    this.agentInput.value = textBeforeCursor.substring(0, lastAtIndex) + textAfterCursor;
                    this.agentInput.selectionStart = lastAtIndex;
                    this.agentInput.selectionEnd = lastAtIndex;
                }
            }

            this.agentSessionContext = {
                projectId,
                pageId,
                version,
                globalContext: false
            };
            this.agentSessionScope = 'page';

            this.closeAgentAutocomplete();
            this.showToast(`会话范围已限定为 ${pageId} (${version.toUpperCase()})`);
            
            this.updateAgentContextLabel();
            this.renderAgentWorkbench();
            this.renderAgentChrome();

            await this.switchPage(pageId, version, { skipPrdDraftCheck: true, projectId });

        } catch (error) {
            console.error('Failed to bind session context:', error);
            this.showToast(`限定页面范围失败: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }

    async clearAgentSessionScope() {
        if (this.agentRunState?.active) return;
        const globalContext = this.getAgentGlobalContext();

        try {
            if (this.agentSessionId) {
                await this.agentApi.setContext(this.agentSessionId, globalContext);
            }

            this.agentSessionContext = {
                pageId: '__global__',
                version: '',
                globalContext: true
            };
            this.agentSessionScope = 'global';

            this.closeAgentAutocomplete();
            this.showToast('已切换为通用会话');
            this.updateAgentContextLabel();
            this.renderAgentWorkbench();
            this.renderAgentChrome();
            this.refreshAgentSessionsSoon();
        } catch (error) {
            console.error('Failed to clear session context:', error);
            this.showToast(`关闭页面关联失败: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }

    getFilteredAgentSessions() {
        const query = (this.agentSessionSearch || '').trim().toLowerCase();
        const items = (this.agentSessionsList || []).filter((session) => {
            if (session.archived) return false;
            if (this.isEmptyAgentSessionListItem(session)) return false;
            return true;
        });
        const filtered = !query ? items : items.filter((session) => {
            const haystacks = [
                session.title,
                session.pageId,
                session.version,
                session.lastSummary
            ].filter(Boolean).map((item) => String(item).toLowerCase());
            return haystacks.some((item) => item.includes(query));
        });
        return filtered.sort((left, right) => {
            const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
            const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
            return rightTime - leftTime;
        });
    }

    isEmptyAgentSessionListItem(session = {}) {
        if (session.hasHistory !== false) return false;
        const title = String(session.title || '').trim();
        const summary = String(session.lastSummary || '').trim();
        const genericTitle = !title || title === '新会话' || title === '新增页面';
        const placeholderSummary = !summary
            || summary === '尚未建立会话'
            || summary === '已连接，等待新的任务。'
            || summary === '已连接，等待新的任务';
        return genericTitle && placeholderSummary;
    }

    groupAgentSessions(items) {
        const groups = {
            今天: [],
            '近 7 天': [],
            更早: []
        };
        const now = new Date();
        items.forEach((session) => {
            const updatedAt = new Date(session.updatedAt || session.createdAt || now.toISOString());
            const diffMs = now.getTime() - updatedAt.getTime();
            if (diffMs < 24 * 60 * 60 * 1000 && now.getDate() === updatedAt.getDate()) {
                groups['今天'].push(session);
            } else if (diffMs < 7 * 24 * 60 * 60 * 1000) {
                groups['近 7 天'].push(session);
            } else {
                groups['更早'].push(session);
            }
        });
        return Object.entries(groups).filter(([, list]) => list.length);
    }

    getAgentSessionDisplayTitle(session = {}) {
        const raw = String(session.title || session.contextLabel || `${session.pageId || ''}/${session.version || ''}` || '新会话')
            .replace(/\s+/g, ' ')
            .trim();
        return Array.from(raw || '新会话').slice(0, 20).join('');
    }

    getAgentSessionMeta(session = {}) {
        if (session.sessionScope === 'global') {
            return '';
        }
        const pageId = String(session.pageId || '').trim() || 'unknown';
        const version = String(session.version || '').trim() || 'v1';
        return `${pageId} / ${version}`;
    }

    renderAgentSessionList() {
        if (!this.agentSessionList) return;
        const items = this.getFilteredAgentSessions();
        if (!items.length) {
            this.agentSessionList.innerHTML = this.agentSessionListLoading
                ? '<div class="agent-session-list__status">正在加载历史对话…</div>'
                : '<div class="agent-session-list__empty">还没有历史对话。点击“新建会话”，或者直接发送消息，Prota 会自动为你创建新会话。</div>';
            return;
        }
        const groupsHtml = this.groupAgentSessions(items).map(([label, sessions]) => `
            <section class="agent-session-group">
                <div class="agent-session-group__label">${this.escapeHtml(label)}</div>
                <div class="agent-session-group__items">
                    ${sessions.map((session) => `
                        <div class="agent-session-item${session.id === this.agentSessionId ? ' is-active' : ''}">
                            <button type="button" class="agent-session-item__main" data-agent-session-id="${this.escapeHtml(session.id)}">
                                <div class="agent-session-item__title" title="${this.escapeHtml(session.title || '')}">${this.escapeHtml(this.getAgentSessionDisplayTitle(session))}</div>
                                ${this.getAgentSessionMeta(session) ? `<div class="agent-session-item__meta" title="${this.escapeHtml(session.contextLabel || `${session.pageId} / ${session.version}`)}">${this.escapeHtml(this.getAgentSessionMeta(session))}</div>` : ''}
                            </button>
                            <button type="button" class="agent-session-item__more" data-agent-session-more="${this.escapeHtml(session.id)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </section>
        `).join('');
        const loadMoreHtml = this.agentSessionHasMore ? `
            <button type="button" class="agent-session-list__load-more" data-agent-session-load-more${this.agentSessionListLoading ? ' disabled' : ''}>
                ${this.agentSessionListLoading ? '加载中…' : '加载更多'}
            </button>
        ` : '';
        this.agentSessionList.innerHTML = `${groupsHtml}${loadMoreHtml}`;
    }

    renderAgentConnectionResult() {
        if (!this.agentConnectionTestResultEl) return;
        const result = this.agentConnectionTestResult;
        if (!result) {
            this.agentConnectionTestResultEl.hidden = true;
            this.agentConnectionTestResultEl.innerHTML = '';
            return;
        }

        this.agentConnectionTestResultEl.hidden = false;
        const statusText = result.ok ? 'Succeeded' : 'Failed';
        const statusColor = result.ok ? '#10b981' : '#ef4444';
        const latencyText = result.latencyMs != null ? `${result.latencyMs} ms` : (result.ok ? '计算中...' : 'N/A');

        this.agentConnectionTestResultEl.innerHTML = `
            <div class="agent-connection-result__item">
                <label>连接状态</label>
                <div style="color: ${statusColor}; font-weight: 600; font-size: 0.88rem;">${this.escapeHtml(statusText)}</div>
            </div>
            <div class="agent-connection-result__item">
                <label>延迟</label>
                <div style="font-weight: 600; font-size: 0.88rem;">${this.escapeHtml(latencyText)}</div>
            </div>
            ${!result.ok && result.message ? `
                <div class="agent-connection-result__item" style="grid-column: 1 / -1; border-top: 1px solid rgba(148, 163, 184, 0.12); padding-top: 10px; margin-top: 2px;">
                    <label>失败原因</label>
                    <div style="color: #ef4444; font-size: 0.78rem; line-height: 1.5; margin-top: 4px;">${this.escapeHtml(result.message)}</div>
                </div>
            ` : ''}
        `;
    }

    buildAgentTimelineGroups() {
        const groups = [];
        let current = null;
        let lastKey = null;

        this.agentTimelineEvents.forEach((event) => {
            const key = event.runId || 'session';
            const descriptor = event.type === 'run_started' ? event.payload?.descriptor : null;
            const isFollowUpMessageRun = descriptor?.kind === 'message'
                && descriptor.continuation
                && current
                && key !== lastKey
                && current.events.some((item) => item.type === 'question_resolved');

            if (!current || (key !== lastKey && !isFollowUpMessageRun)) {
                current = {
                    id: `${key}:${groups.length}`,
                    sourceKey: key,
                    runId: event.runId || null,
                    runIds: event.runId ? [event.runId] : [],
                    descriptor: null,
                    descriptors: [],
                    events: []
                };
                groups.push(current);
                lastKey = key;
            } else if (key !== lastKey) {
                if (event.runId && !current.runIds.includes(event.runId)) {
                    current.runIds.push(event.runId);
                }
                current.runId = event.runId || current.runId;
                lastKey = key;
            }
            if (event.type === 'run_started' && descriptor) {
                current.descriptor = current.descriptor || descriptor;
                current.descriptors.push(descriptor);
            }
            current.events.push(event);
        });

        if (this.agentRunState?.active && this.agentRunState.runId) {
            const activeIndex = groups.map((group) => (
                (group.runIds || [group.runId]).includes(this.agentRunState.runId)
                    ? this.agentRunState.runId
                    : null
            )).lastIndexOf(this.agentRunState.runId);
            groups.forEach((group, index) => {
                group.active = index === activeIndex;
            });
        }

        return groups;
    }

    getAgentTimelineSignature() {
        return (this.agentTimelineEvents || [])
            .map((event) => [
                event?.id || '',
                event?.type || '',
                event?.runId || '',
                event?.createdAt || '',
                event?.payload?.partial ? 'partial' : '',
                event?.payload?.rollbackStatus || '',
                event?.payload?.revertedAt || ''
            ].join(':'))
            .join('|');
    }

    renderAgentTimeline() {
        if (!this.agentTimeline) return;

        const previousDistance = this.agentTimeline.scrollHeight - this.agentTimeline.scrollTop - this.agentTimeline.clientHeight;
        const groups = this.buildAgentTimelineGroups();

        if (!groups.length) {
            const emptyText = this.agentTimelineLoading
                ? '正在加载历史会话…'
                : '这里会持续显示 Agent 的工作过程，包括状态变化、工具执行、审批、追问、PRD 产物和最终总结。';
            this.agentTimeline.innerHTML = `
                <div class="agent-timeline__empty${this.agentTimelineLoading ? ' is-loading' : ''}">${this.escapeHtml(emptyText)}</div>
            `;
            if (this.agentJumpLatestBtn) {
                this.agentJumpLatestBtn.hidden = true;
            }
            return;
        }

        this.agentTimeline.innerHTML = groups.map((group) => this.renderAgentTimelineGroup(group)).join('');

        // Default all process items and code blocks to the bottom
        this.agentTimeline.querySelectorAll('.agent-process__items').forEach((items) => {
            this.scrollElementToBottom(items);
        });
        this.agentTimeline.querySelectorAll('.agent-code-block').forEach((block) => {
            this.scrollElementToBottom(block);
        });

        // Spinner at bottom while active
        if (this.agentRunState.active) {
            const stageMsg = this.getAgentStatusText();
            const spinnerEl = document.createElement('div');
            spinnerEl.className = 'agent-timeline__spinner';
            spinnerEl.innerHTML = `<span class="agent-spinner"></span><span class="agent-timeline__spinner-text">${this.escapeHtml(stageMsg)}</span>`;
            this.agentTimeline.appendChild(spinnerEl);
        }

        if (this.agentAutoScroll) {
            this.scrollAgentTimelineToLatest(false, true);
        } else {
            this.agentTimeline.scrollTop = Math.max(0, this.agentTimeline.scrollHeight - this.agentTimeline.clientHeight - previousDistance);
        }

        if (this.agentJumpLatestBtn) {
            this.agentJumpLatestBtn.hidden = !this.agentShowJumpLatest;
        }
    }

    // ── Incremental timeline rendering ─────────────────────

    _scheduleAgentTimelinePatch() {
        if (this._agentTimelinePatchRaf) return;
        this._agentTimelinePatchRaf = requestAnimationFrame(() => {
            this._agentTimelinePatchRaf = null;
            this.patchAgentTimeline();
        });
    }

    _scheduleAssistantMessagePatch() {
        if (this._assistantMessagePatchRaf) return;
        this._assistantMessagePatchRaf = requestAnimationFrame(() => {
            this._assistantMessagePatchRaf = null;
            if (!this._pendingAssistantMessagePatches) return;

            const previousDistance = this.agentTimeline ? (this.agentTimeline.scrollHeight - this.agentTimeline.scrollTop - this.agentTimeline.clientHeight) : 0;
            const shouldStickToBottom = this.agentAutoScroll || previousDistance < 64;

            for (const [id, event] of this._pendingAssistantMessagePatches) {
                const escapedId = CSS.escape(id);
                const existing = this.agentTimeline?.querySelector(`[data-event-id="${escapedId}"]`);
                if (existing) {
                    this.patchTimelineEventElement(existing, event);
                }
            }
            this._pendingAssistantMessagePatches.clear();

            if (shouldStickToBottom) {
                this.scrollAgentTimelineToLatest(true, false);
            }

            this.renderAgentChrome();
            this.patchLiveAgentStatus();
            this.renderAgentControls();
        });
    }

    patchAgentTimeline() {
        if (!this.agentTimeline) return;

        const groups = this.buildAgentTimelineGroups();
        const signature = this.getAgentTimelineSignature();
        const previousDistance = this.agentTimeline.scrollHeight - this.agentTimeline.scrollTop - this.agentTimeline.clientHeight;
        const shouldStickToBottom = this.agentAutoScroll || previousDistance < 64;

        // Empty state
        if (!groups.length) {
            const emptyText = this.agentTimelineLoading
                ? '正在加载历史会话…'
                : '这里会持续显示 Agent 的工作过程，包括状态变化、工具执行、审批、追问、PRD 产物和最终总结。';
            this.agentTimeline.innerHTML = `
                <div class="agent-timeline__empty${this.agentTimelineLoading ? ' is-loading' : ''}">${this.escapeHtml(emptyText)}</div>
            `;
            this._agentRenderedTimelineSignature = signature;
            if (this.agentJumpLatestBtn) this.agentJumpLatestBtn.hidden = true;
            return;
        }

        if (!this._needsFullTimelineRebuild && signature === this._agentRenderedTimelineSignature) {
            this.patchTimelineSpinner();
            if (this.agentJumpLatestBtn) {
                this.agentJumpLatestBtn.hidden = !this.agentShowJumpLatest;
            }
            return;
        }

        // Full rebuild needed (session switch, history hydrate)
        if (this._needsFullTimelineRebuild) {
            this._needsFullTimelineRebuild = false;
            this.fullRenderAgentTimeline(groups);
            this._agentRenderedTimelineSignature = signature;
            return;
        }

        // Incremental update
        this.patchTimelineIncremental(groups);
        this._agentRenderedTimelineSignature = signature;
        this.patchTimelineSpinner();

        if (shouldStickToBottom) {
            this.scrollAgentTimelineToLatest(true, false);
        } else {
            this.agentTimeline.scrollTop = Math.max(0, this.agentTimeline.scrollHeight - this.agentTimeline.clientHeight - previousDistance);
        }

        if (this.agentJumpLatestBtn) {
            this.agentJumpLatestBtn.hidden = !this.agentShowJumpLatest;
        }
    }

    fullRenderAgentTimeline(groups) {
        this.agentTimeline.innerHTML = groups.map((group) => this.renderAgentTimelineGroup(group)).join('');
        this.patchTimelineSpinner();

        // Default all process items and code blocks to the bottom
        this.agentTimeline.querySelectorAll('.agent-process__items').forEach((items) => {
            this.scrollElementToBottom(items);
        });
        this.agentTimeline.querySelectorAll('.agent-code-block').forEach((block) => {
            this.scrollElementToBottom(block);
        });

        if (this.agentAutoScroll) {
            this.scrollAgentTimelineToLatest(false, true);
        }
        if (this.agentJumpLatestBtn) {
            this.agentJumpLatestBtn.hidden = !this.agentShowJumpLatest;
        }
    }

    patchTimelineIncremental(groups) {
        const nextGroupIds = new Set(groups.map((group) => group.id || group.runId || 'session'));
        for (const group of groups) {
            const groupKey = group.id || group.runId || 'session';
            let groupEl = this.agentTimeline.querySelector(`[data-run-group="${CSS.escape(groupKey)}"]`);
            const nextHtml = this.renderAgentTimelineGroup(group);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = nextHtml;
            const nextEl = wrapper.firstElementChild;
            if (!nextEl) continue;

            if (!groupEl) {
                this.agentTimeline.appendChild(nextEl);
                nextEl.querySelectorAll('.agent-process__items').forEach((items) => {
                    this.scrollElementToBottom(items);
                });
                nextEl.querySelectorAll('.agent-code-block').forEach((block) => {
                    this.scrollElementToBottom(block);
                });
                continue;
            }

            if (this.isAgentGroupActive(group)) {
                this.patchActiveTimelineGroup(groupEl, group, nextEl);
                continue;
            }

            groupEl.replaceWith(nextEl);
            const nextProcess = nextEl.querySelector('.agent-process');
            if (nextProcess && !this.isAgentGroupActive(group) && !this.hasPendingAgentInteraction(group)) {
                nextProcess.open = false;
                delete nextProcess.dataset.agentAutoOpen;
                delete nextProcess.dataset.agentManualToggle;
            }
        }

        this.agentTimeline.querySelectorAll(':scope > .agent-run-group').forEach((groupEl) => {
            const key = groupEl.dataset.runGroup || '';
            if (key && !nextGroupIds.has(key)) groupEl.remove();
        });
    }

    patchActiveTimelineGroup(groupEl, group, nextEl) {
        groupEl.classList.toggle('is-active', true);
        const currentTurn = groupEl.querySelector('.agent-assistant-turn__body');
        const nextTurn = nextEl.querySelector('.agent-assistant-turn__body');
        if (!currentTurn || !nextTurn) {
            groupEl.replaceWith(nextEl);
            return;
        }

        const nextChildren = Array.from(nextTurn.children);
        const nextKeys = new Set(nextChildren.map((child) => this.getAgentTimelineChildKey(child)).filter(Boolean));
        Array.from(currentTurn.children).forEach((child) => {
            const key = this.getAgentTimelineChildKey(child);
            if (key && !nextKeys.has(key)) child.remove();
        });

        nextChildren.forEach((nextChild, index) => {
            const key = this.getAgentTimelineChildKey(nextChild);
            const currentChild = key ? this.findAgentTimelineChildByKey(currentTurn, key) : null;
            if (currentChild) {
                this.patchAgentTimelineChild(currentChild, nextChild);
                const desiredBefore = currentTurn.children[index] || null;
                if (desiredBefore && desiredBefore !== currentChild) {
                    currentTurn.insertBefore(currentChild, desiredBefore);
                }
                return;
            }

            const clone = nextChild.cloneNode(true);
            currentTurn.insertBefore(clone, currentTurn.children[index] || null);
            clone.querySelectorAll('.agent-process__items').forEach((items) => {
                this.scrollElementToBottom(items);
            });
            clone.querySelectorAll('.agent-code-block').forEach((cb) => {
                this.scrollElementToBottom(cb);
            });
        });
    }

    getAgentTimelineChildKey(child) {
        if (!child) return '';
        if (child.matches?.('.agent-assistant-message[data-event-id]')) return `message:${child.dataset.eventId || ''}`;
        if (child.matches?.('.agent-process[data-agent-process]')) return `process:${child.dataset.agentProcess || ''}`;
        if (child.matches?.('.agent-result[data-event-id]')) return `result:${child.dataset.eventId || ''}`;
        return '';
    }

    findAgentTimelineChildByKey(parent, key) {
        const [type, ...rest] = String(key || '').split(':');
        const value = rest.join(':');
        if (!type || !value) return null;
        if (type === 'message') return parent.querySelector(`:scope > .agent-assistant-message[data-event-id="${CSS.escape(value)}"]`);
        if (type === 'process') return parent.querySelector(`:scope > .agent-process[data-agent-process="${CSS.escape(value)}"]`);
        if (type === 'result') return parent.querySelector(`:scope > .agent-result[data-event-id="${CSS.escape(value)}"]`);
        return null;
    }

    morphElement(current, next) {
        if (!current || !next) return;
        if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
            current.replaceWith(next.cloneNode(true));
            return;
        }
        if (current.nodeType === Node.TEXT_NODE) {
            if (current.textContent !== next.textContent) {
                current.textContent = next.textContent;
            }
            return;
        }
        if (current.nodeType === Node.ELEMENT_NODE) {
            if (current.outerHTML === next.outerHTML) return;

            if (current.tagName === 'DETAILS' && current.hasAttribute('open') && !next.hasAttribute('open')) {
                next.setAttribute('open', '');
            }

            for (let i = current.attributes.length - 1; i >= 0; i--) {
                const name = current.attributes[i].name;
                if (!next.hasAttribute(name)) current.removeAttribute(name);
            }
            for (let i = 0; i < next.attributes.length; i++) {
                const name = next.attributes[i].name;
                const value = next.attributes[i].value;
                if (current.getAttribute(name) !== value) current.setAttribute(name, value);
            }

            const currentChildren = Array.from(current.childNodes);
            const nextChildren = Array.from(next.childNodes);
            const maxLength = Math.max(currentChildren.length, nextChildren.length);
            for (let i = 0; i < maxLength; i++) {
                if (!currentChildren[i]) {
                    current.appendChild(nextChildren[i].cloneNode(true));
                } else if (!nextChildren[i]) {
                    currentChildren[i].remove();
                } else {
                    this.morphElement(currentChildren[i], nextChildren[i]);
                }
            }
        }
    }

    patchAgentTimelineChild(currentChild, nextChild) {
        if (currentChild.matches('.agent-process') && nextChild.matches('.agent-process')) {
            this.patchActiveProcessPanel(currentChild, nextChild);
            return;
        }

        if (currentChild.matches('.agent-assistant-message') && nextChild.matches('.agent-assistant-message')) {
            const eventId = currentChild.dataset.eventId || nextChild.dataset.eventId || '';
            const event = eventId ? this.agentTimelineEvents.find((item) => item.id === eventId) : null;
            if (event) this.patchTimelineEventElement(currentChild, event);
            else {
                const codeBlocks = currentChild.querySelectorAll('.agent-code-block');
                const wasCodeBlockNearBottom = Array.from(codeBlocks).map((cb) => {
                    return (cb.scrollHeight - cb.scrollTop - cb.clientHeight) < 32;
                });
                this.morphElement(currentChild, nextChild);
                currentChild.querySelectorAll('.agent-code-block').forEach((cb, idx) => {
                    const wasNearBottom = wasCodeBlockNearBottom[idx] === undefined ? true : wasCodeBlockNearBottom[idx];
                    if (wasNearBottom) {
                        this.scrollElementToBottom(cb);
                    }
                });
            }
            return;
        }

        const codeBlocks = currentChild.querySelectorAll('.agent-code-block');
        const wasCodeBlockNearBottom = Array.from(codeBlocks).map((cb) => {
            return (cb.scrollHeight - cb.scrollTop - cb.clientHeight) < 32;
        });
        this.morphElement(currentChild, nextChild);
        currentChild.querySelectorAll('.agent-code-block').forEach((cb, idx) => {
            const wasNearBottom = wasCodeBlockNearBottom[idx] === undefined ? true : wasCodeBlockNearBottom[idx];
            if (wasNearBottom) {
                this.scrollElementToBottom(cb);
            }
        });
    }

    patchActiveProcessPanel(currentProcess, nextProcess) {
        currentProcess.open = nextProcess.open;
        currentProcess.className = nextProcess.className;
        if (nextProcess.dataset.agentAutoOpen === '1') currentProcess.dataset.agentAutoOpen = '1';
        else delete currentProcess.dataset.agentAutoOpen;
        if (nextProcess.dataset.agentManualToggle === '1') currentProcess.dataset.agentManualToggle = '1';
        else delete currentProcess.dataset.agentManualToggle;
        const currentIndicator = currentProcess.querySelector('.agent-process__summary > .agent-spinner, .agent-process__summary > .agent-process__pulse');
        const nextIndicator = nextProcess.querySelector('.agent-process__summary > .agent-spinner, .agent-process__summary > .agent-process__pulse');
        if (currentIndicator && nextIndicator && currentIndicator.outerHTML !== nextIndicator.outerHTML) {
            currentIndicator.replaceWith(nextIndicator.cloneNode(true));
        }
        const selectors = ['.agent-process__count', '.agent-process__headline', '.agent-process__status'];
        selectors.forEach((selector) => {
            const current = currentProcess.querySelector(selector);
            const next = nextProcess.querySelector(selector);
            if (current && next) {
                current.textContent = next.textContent;
                if (selector === '.agent-process__status') current.title = next.textContent;
            } else if (current && !next) {
                current.remove();
            } else if (!current && next) {
                currentProcess.querySelector('.agent-process__summary')?.appendChild(next.cloneNode(true));
            }
        });

        const currentItems = currentProcess.querySelector('.agent-process__items');
        const nextItems = nextProcess.querySelector('.agent-process__items');
        if (!currentItems || !nextItems) return;

        const previousDistance = currentItems.scrollHeight - currentItems.scrollTop - currentItems.clientHeight;
        const wasNearBottom = previousDistance < 48;

        if (nextItems.querySelector('.agent-process-event[data-event-id]')) {
            currentItems.querySelectorAll('.agent-process-event:not([data-event-id])').forEach((item) => item.remove());
        }

        nextItems.querySelectorAll('.agent-process-event[data-event-id]').forEach((nextItem) => {
            const eventId = nextItem.dataset.eventId || '';
            const currentItem = eventId
                ? currentItems.querySelector(`.agent-process-event[data-event-id="${CSS.escape(eventId)}"]`)
                : null;
            if (currentItem) {
                const codeBlocks = currentItem.querySelectorAll('.agent-code-block');
                const wasCodeBlockNearBottom = Array.from(codeBlocks).map((cb) => {
                    return (cb.scrollHeight - cb.scrollTop - cb.clientHeight) < 32;
                });

                this.morphElement(currentItem, nextItem);

                currentItem.querySelectorAll('.agent-code-block').forEach((cb, idx) => {
                    const wasNearBottom = wasCodeBlockNearBottom[idx] === undefined ? true : wasCodeBlockNearBottom[idx];
                    if (wasNearBottom) {
                        this.scrollElementToBottom(cb);
                    }
                });
            } else {
                const clone = nextItem.cloneNode(true);
                currentItems.appendChild(clone);
                clone.querySelectorAll('.agent-code-block').forEach((cb) => {
                    this.scrollElementToBottom(cb);
                });
            }
        });

        if (wasNearBottom) {
            this.scrollElementToBottom(currentItems);
        }
    }

    patchTimelineEventElement(el, event) {
        if (event.type !== 'assistant_message') return;
        const payload = event.payload || {};
        const bodyEl = el.querySelector('.agent-assistant-message__body') || el.querySelector('.agent-timeline__body');
        const metaEl = el.querySelector('.agent-assistant-message__meta') || el.querySelector('.agent-timeline__meta');

        if (bodyEl) {
            const temp = bodyEl.cloneNode(false);
            temp.innerHTML = this.renderAgentRichText(payload.text || '');

            const codeBlocks = bodyEl.querySelectorAll('.agent-code-block');
            const wasCodeBlockNearBottom = Array.from(codeBlocks).map((cb) => {
                return (cb.scrollHeight - cb.scrollTop - cb.clientHeight) < 32;
            });

            this.morphElement(bodyEl, temp);

            bodyEl.querySelectorAll('.agent-code-block').forEach((cb, idx) => {
                const wasNearBottom = wasCodeBlockNearBottom[idx] === undefined ? true : wasCodeBlockNearBottom[idx];
                if (wasNearBottom) {
                    this.scrollElementToBottom(cb);
                }
            });
        }
        if (metaEl) {
            const temp = metaEl.cloneNode(false);
            const timestamp = this.formatAgentTimestamp(event.createdAt);
            const suffix = payload.partial ? '<span>正在生成…</span>' : '';
            temp.innerHTML = `<span>${this.escapeHtml(timestamp)}</span>${suffix}`;
            this.morphElement(metaEl, temp);
        }
        if (payload.partial) {
            el.classList.add('is-streaming');
        } else {
            el.classList.remove('is-streaming');
        }
    }

    patchLiveAgentStatus() {
        if (!this.agentRunState?.active) return;
        const status = this.getAgentLiveStatusLabel({ includeSdkDetail: false });
        const activeGroups = Array.from(this.agentTimeline?.querySelectorAll('.agent-run-group.is-active') || []);
        const activeGroup = activeGroups.at(-1);
        const processStatus = activeGroup?.querySelector('.agent-process.is-active .agent-process__status');
        if (processStatus) {
            processStatus.textContent = status;
            processStatus.title = status;
        }
        const spinnerText = this.agentTimeline?.querySelector(':scope > .agent-timeline__spinner .agent-timeline__spinner-text');
        if (spinnerText) {
            spinnerText.textContent = status;
        }
    }

    patchTimelineSpinner() {
        // Remove legacy spinner div if present
        const oldSpinner = this.agentTimeline.querySelector(':scope > .agent-timeline__spinner');
        if (oldSpinner) oldSpinner.remove();

        const existing = this.agentTimeline.querySelector(':scope > .agent-timeline__active-status');
        if (existing) existing.remove();
    }

    isAgentProcessEvent(event) {
        return [
            'tool_started',
            'tool_finished',
            'tool_call',
            'sdk_tool_result',
            'sdk_init',
            'sdk_status',
            'sdk_rate_limit',
            'sdk_compact',
            'sdk_task_notification',
            'assistant_thinking',
            'local_choice_request',
            'approval_request',
            'approval_resolved',
            'question_request',
            'question_resolved'
        ].includes(event?.type);
    }

    isAgentGroupActive(group) {
        if (typeof group?.active === 'boolean') return group.active;
        if (!this.agentRunState?.active) return false;
        const runIds = group?.runIds || (group?.runId ? [group.runId] : []);
        return runIds.includes(this.agentRunState.runId);
    }

    hasPendingAgentInteraction(group) {
        const approvalId = this.agentPendingApproval?.id;
        const questionId = this.agentPendingQuestion?.id;
        return (group?.events || []).some((event) => {
            const payload = event.payload || {};
            return (approvalId && payload.approval?.id === approvalId)
                || (questionId && payload.question?.id === questionId);
        });
    }

    normalizeAgentProcessSummary(summary, toolName = '工具') {
        const text = String(summary || '').trim();
        if (!text) return '';
        return text.replace(/准备调用\s*([^\s，。,.]+)?/g, (_, name) => {
            const target = name || toolName || '工具';
            return target === '工具' ? '正在调用工具' : `正在调用 ${target}`;
        });
    }

    getAgentProcessSummary(group, processEvents) {
        if (this.isAgentGroupActive(group)) {
            return this.getAgentLiveStatusLabel({ includeSdkDetail: false });
        }
        const lastEvent = [...(processEvents || [])].reverse().find(Boolean);
        if (!lastEvent) return '过程已收起';
        const payload = lastEvent.payload || {};
        if (lastEvent.type === 'tool_started') return this.normalizeAgentProcessSummary(payload.summary, payload.toolName) || `正在执行 ${payload.toolName || '工具'}`;
        if (lastEvent.type === 'tool_call') return this.normalizeAgentProcessSummary(payload.summary, payload.toolName) || `正在调用 ${payload.toolName || '工具'}`;
        if (lastEvent.type === 'sdk_tool_result') return `${payload.toolName || '工具'} 返回结果`;
        if (lastEvent.type === 'sdk_init') return `SDK 初始化完成：${payload.model || ''}`;
        if (lastEvent.type === 'sdk_status') return payload.message || 'SDK 状态更新';
        if (lastEvent.type === 'assistant_thinking') return '模型正在思考';
        if (lastEvent.type === 'sdk_rate_limit') return payload.message || 'Provider 速率限制';
        if (lastEvent.type === 'sdk_compact') return payload.summary || '上下文已压缩';
        if (lastEvent.type === 'sdk_task_notification') return payload.message || `Task ${payload.status || ''}`;
        if (lastEvent.type === 'local_choice_request') return payload.selectedLabel ? `已选择 ${payload.selectedLabel}` : (payload.summary || '等待选择');
        if (lastEvent.type === 'tool_finished') return `${payload.toolName || '工具'} ${payload.ok ? '完成' : '失败'}`;
        if (lastEvent.type === 'approval_request') return `等待批准 ${payload.approval?.toolName || '工具'}`;
        if (lastEvent.type === 'approval_resolved') return `${payload.approval?.toolName || '工具'} 审批已处理`;
        if (lastEvent.type === 'question_request') return '等待补充回答';
        if (lastEvent.type === 'question_resolved') return '已收到回答';
        return '过程已收起';
    }

    getAgentProcessHeadline(processEvents) {
        const events = processEvents || [];
        const toolNames = events
            .map((event) => event.payload?.toolName || event.payload?.approval?.toolName || '')
            .filter(Boolean);
        const uniqueTools = [...new Set(toolNames)];
        if (uniqueTools.length) {
            const shown = uniqueTools.slice(0, 2).join('、');
            const suffix = uniqueTools.length > 2 ? ` 等 ${uniqueTools.length} 个工具` : '';
            return `${shown}${suffix}`;
        }
        const lastType = events.at(-1)?.type || '';
        if (lastType === 'assistant_thinking') return '模型思考';
        return '过程记录';
    }

    renderAgentAssistantTurn(group) {
        const segments = [];
        let processBuffer = [];
        let processSegment = 0;
        const resultTypes = new Set(['artifact_ready', 'run_changes', 'run_finished', 'run_failed']);
        const flushProcess = () => {
            if (!processBuffer.length) return;
            segments.push({
                type: 'process',
                id: `${group.id || group.runId || 'session'}:process:${processSegment}`,
                events: processBuffer
            });
            processBuffer = [];
            processSegment += 1;
        };

        (group.events || []).forEach((event) => {
            if (event.type === 'run_started' || event.type === 'session_ready') return;

            if (this.isAgentProcessEvent(event)) {
                processBuffer.push(event);
                return;
            }

            flushProcess();
            if (event.type === 'assistant_message') {
                segments.push({ type: 'assistant', event });
            } else if (resultTypes.has(event.type)) {
                segments.push({ type: 'result', event });
            }
        });
        flushProcess();

        if (!segments.length && this.isAgentGroupActive(group)) {
            segments.push({
                type: 'process',
                id: `${group.id || group.runId || 'session'}:process:0`,
                events: []
            });
        }

        const lastProcessIndex = segments.map((segment) => segment.type).lastIndexOf('process');
        const pendingProcessIndex = segments.findIndex((segment) => (
            segment.type === 'process'
            && this.hasPendingAgentInteraction({ events: segment.events || [] })
        ));
        const parts = segments.map((segment, index) => {
            if (segment.type === 'assistant') return this.renderAgentAssistantMessage(segment.event);
            if (segment.type === 'result') return this.renderAgentResultEvent(segment.event);
            const segmentActive = this.isAgentGroupActive(group)
                && (pendingProcessIndex >= 0 ? index === pendingProcessIndex : index === lastProcessIndex);
            return this.renderAgentProcessPanel({
                ...group,
                id: segment.id,
                events: segment.events,
                active: segmentActive
            });
        });
        const body = parts.filter(Boolean).join('');

        if (!body) return '';

        return this.renderAgentTimelineRow({
            role: 'Assistant',
            className: `agent-timeline__row agent-timeline__row--assistant agent-assistant-turn${this.isAgentGroupActive(group) ? ' is-active' : ''}`,
            body: `<div class="agent-assistant-turn__body">${body}</div>`
        });
    }

    renderAgentAssistantMessage(event) {
        const payload = event.payload || {};
        const timestamp = this.escapeHtml(this.formatAgentTimestamp(event.createdAt));
        const partial = Boolean(payload.partial);
        return `
            <section class="agent-assistant-message${partial ? ' is-streaming' : ''}" data-event-id="${this.escapeHtml(event.id || '')}">
                <div class="agent-assistant-message__meta">
                    <span>${timestamp}</span>
                    ${partial ? '<span>正在生成…</span>' : ''}
                </div>
                <div class="agent-assistant-message__body">${this.renderAgentRichText(payload.text || '')}</div>
            </section>
        `;
    }

    renderAgentProcessPanel(group) {
        const processEvents = (group.events || []).filter((event) => this.isAgentProcessEvent(event));
        const active = typeof group?.active === 'boolean'
            ? group.active
            : this.isAgentGroupActive(group);
        const pending = this.hasPendingAgentInteraction(group);
        if (!processEvents.length && !active) return '';

        const summary = this.getAgentProcessSummary(group, processEvents);
        const openAttr = active || pending ? ' open' : '';
        const countText = processEvents.length ? `${processEvents.length} 步` : '启动中';
        const showStatus = active || pending;
        const headline = active ? '进行中' : (pending ? '等待处理' : this.getAgentProcessHeadline(processEvents));
        const items = processEvents.length
            ? processEvents.map((event) => this.renderAgentProcessEvent(event)).join('')
            : `
                <section class="agent-process-event agent-process-event--status">
                    <div class="agent-process-event__head">
                        <span class="agent-process-event__dot"></span>
                        <div class="agent-process-event__title">正在启动</div>
                        <div class="agent-process-event__summary">${this.escapeHtml(summary)}</div>
                    </div>
                </section>
            `;

        return `
            <details class="agent-process${active ? ' is-active' : ''}" data-agent-process="${this.escapeHtml(group.id || group.runId || 'session')}"${active || pending ? ' data-agent-auto-open="1"' : ''}${openAttr}>
                <summary class="agent-process__summary">
                    <span class="agent-process__chevron" aria-hidden="true"></span>
                    ${active ? '<span class="agent-spinner"></span>' : '<span class="agent-process__pulse"></span>'}
                    <span class="agent-process__count">${this.escapeHtml(countText)}</span>
                    <span class="agent-process__headline">${this.escapeHtml(headline)}</span>
                    ${showStatus ? `<span class="agent-process__status">${this.escapeHtml(summary)}</span>` : ''}
                </summary>
                <div class="agent-process__items">
                    ${items}
                </div>
            </details>
        `;
    }

    formatSdkResultSummary(payload = {}) {
        const parts = [];
        if (payload.subtype) parts.push(payload.subtype);
        if (payload.numTurns) parts.push(`${payload.numTurns} turns`);
        if (payload.totalCostUsd != null) parts.push(`$${Number(payload.totalCostUsd).toFixed(6)}`);
        if (payload.durationApiMs != null) parts.push(`${payload.durationApiMs}ms API`);
        return parts.join(' · ') || 'SDK 运行结束';
    }

    formatSdkResultDetails(payload = {}) {
        return {
            subtype: payload.subtype || '',
            isError: Boolean(payload.isError),
            numTurns: payload.numTurns || null,
            totalCostUsd: payload.totalCostUsd ?? null,
            durationMs: payload.durationMs ?? null,
            durationApiMs: payload.durationApiMs ?? null,
            usage: payload.usage || null,
            stopReason: payload.stopReason || null,
            errors: payload.errors || []
        };
    }

    renderAgentProcessEvent(event) {
        const payload = event.payload || {};
        const timestamp = this.escapeHtml(this.formatAgentTimestamp(event.createdAt));
        const toolName = payload.toolName || payload.approval?.toolName || '工具';
        const blocks = [];
        let title = event.type;
        let summary = '';
        let tone = 'neutral';
        let actions = '';

        if (event.type === 'sdk_init') {
            const tools = Array.isArray(payload.tools) ? payload.tools : [];
            title = 'SDK initialized';
            summary = `${payload.model || 'model'} · ${tools.length} tools · ${payload.permissionMode || 'default'}`;
            tone = 'success';
            blocks.push(this.renderAgentCodeBlock([
                `cwd: ${payload.cwd || ''}`,
                `session: ${payload.sessionId || ''}`,
                `tools: ${tools.join(', ') || '(none)'}`,
                `mcp: ${(payload.mcpServers || []).map((server) => `${server.name}:${server.status}`).join(', ') || '(none)'}`
            ].join('\n'), 'text', 'init'));
        } else if (event.type === 'assistant_thinking') {
            title = 'Thinking';
            summary = '模型思考内容';
            tone = 'neutral';
            blocks.push(this.renderAgentCodeBlock(payload.text || '', 'text', 'thinking'));
        } else if (event.type === 'tool_call') {
            title = `${payload.toolName || 'Tool'} call`;
            summary = this.normalizeAgentProcessSummary(payload.summary, payload.toolName) || '正在调用工具';
            tone = 'warning';
            if (payload.inputPreview) {
                blocks.push(this.renderAgentCodeBlock(payload.inputPreview, 'json', 'input'));
            } else if (payload.input != null) {
                blocks.push(this.renderAgentCodeBlock(payload.input, 'json', 'input'));
            }
        } else if (event.type === 'sdk_tool_result') {
            title = `${payload.toolName || 'Tool'} result`;
            summary = payload.ok === false ? '工具返回失败' : '工具返回结果';
            tone = payload.ok === false ? 'danger' : 'success';
            if (payload.output) {
                blocks.push(this.renderAgentCodeBlock(String(payload.output), '', 'output'));
            }
        } else if (event.type === 'sdk_status') {
            title = 'Status';
            summary = payload.message || 'SDK 状态更新';
        } else if (event.type === 'sdk_rate_limit') {
            title = 'Rate limit';
            summary = payload.message || 'Provider 返回速率限制提示';
            tone = 'warning';
        } else if (event.type === 'sdk_compact') {
            title = 'Compact';
            summary = payload.summary || '上下文已压缩';
            tone = 'success';
        } else if (event.type === 'sdk_task_notification') {
            title = `Task ${payload.status || ''}`.trim();
            summary = payload.message || payload.taskId || '';
            tone = payload.status === 'failed' ? 'danger' : 'neutral';
        } else if (event.type === 'local_choice_request') {
            title = payload.title || '选择';
            summary = payload.selectedLabel
                ? `已选择：${payload.selectedLabel}`
                : (payload.summary || '请选择一个选项');
            tone = payload.selectedLabel ? 'success' : 'warning';
            if (Array.isArray(payload.options) && payload.options.length) {
                actions = payload.selectedLabel
                    ? `<div class="agent-inline-actions"><span class="agent-inline-actions__resolved">已选择：${this.escapeHtml(payload.selectedLabel)}</span></div>`
                    : `
                        <div class="agent-inline-actions">
                            ${payload.options.map((option) => `
                                <button type="button"
                                    data-agent-choice-event="${this.escapeHtml(event.id || '')}"
                                    data-agent-choice-kind="${this.escapeHtml(payload.choiceType || '')}"
                                    data-agent-choice-value="${this.escapeHtml(option.value)}"
                                    data-agent-choice-label="${this.escapeHtml(option.label)}">${this.escapeHtml(option.label)}</button>
                            `).join('')}
                        </div>
                    `;
            }
        } else
        if (event.type === 'tool_started') {
            title = `${toolName} 输入`;
            summary = payload.summary || '开始执行';
            if (payload.inputPreview) {
                blocks.push(this.renderAgentCodeBlock(payload.inputPreview, '', 'input'));
            } else if (payload.input != null) {
                blocks.push(this.renderAgentCodeBlock(payload.input, 'json', 'input'));
            }
        } else if (event.type === 'tool_finished') {
            title = `${toolName} 输出`;
            summary = payload.ok ? '执行完成' : '执行失败';
            tone = payload.ok ? 'success' : 'danger';
            if (payload.output) {
                blocks.push(this.renderAgentCodeBlock(String(payload.output), '', 'output'));
            }
        } else if (event.type === 'approval_request') {
            const approval = payload.approval || {};
            const isPending = this.agentPendingApproval && this.agentPendingApproval.id === approval.id;
            title = `${approval.toolName || '工具'} 需要批准`;
            summary = isPending ? '等待你确认' : '审批请求';
            tone = isPending ? 'warning' : 'neutral';
            if (approval.inputPreview) {
                blocks.push(this.renderAgentCodeBlock(approval.inputPreview, '', 'request'));
            }
            if (isPending) {
                actions = `
                    <div class="agent-inline-actions">
                        <button type="button" data-approval-decision="allow_once">允许一次</button>
                        <button type="button" data-approval-decision="allow_session">本会话总是允许</button>
                        <button type="button" data-approval-decision="deny">拒绝</button>
                    </div>
                `;
            }
        } else if (event.type === 'approval_resolved') {
            title = `${payload.approval?.toolName || '工具'} 审批已处理`;
            summary = payload.approval?.decision || 'unknown';
            tone = 'success';
        } else if (event.type === 'question_request') {
            const question = payload.question || {};
            const isPending = this.agentPendingQuestion && this.agentPendingQuestion.id === question.id;
            title = '需要补充回答';
            summary = question.question || 'Agent 正在等待你的补充回答。';
            tone = isPending ? 'warning' : 'neutral';
            if (isPending && Array.isArray(question.options) && question.options.length) {
                actions = `
                    <div class="agent-inline-actions">
                        ${question.options.map((option) => `
                            <button type="button" data-question-option="${this.escapeHtml(option)}">${this.escapeHtml(option)}</button>
                        `).join('')}
                    </div>
                `;
            }
        } else if (event.type === 'question_resolved') {
            title = '已回答';
            summary = payload.question?.answer || '';
            tone = 'success';
        }

        return `
            <section class="agent-process-event agent-process-event--${this.escapeHtml(tone)}" data-event-id="${this.escapeHtml(event.id || '')}">
                <div class="agent-process-event__head">
                    <span class="agent-process-event__dot"></span>
                    <div class="agent-process-event__title">
                        <span class="agent-process-event__title-text">${this.escapeHtml(title)}</span>
                        ${summary ? `<span class="agent-process-event__summary">${this.escapeHtml(summary)}</span>` : ''}
                    </div>
                    <time class="agent-process-event__time">${timestamp}</time>
                </div>
                ${blocks.length ? `<div class="agent-process-event__blocks">${blocks.join('')}</div>` : ''}
                ${actions}
            </section>
        `;
    }

    getAgentRunChanges(runId) {
        if (!runId) return null;
        const events = this.agentTimelineEvents || [];
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const event = events[index];
            if (event.type === 'run_changes' && event.payload?.runId === runId) {
                return event.payload;
            }
        }
        return null;
    }

    getLatestAvailableAgentRunChangeId() {
        const events = this.agentTimelineEvents || [];
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const event = events[index];
            const payload = event.payload || {};
            if (
                event.type === 'run_changes'
                && payload.runId
                && payload.rollbackStatus === 'available'
                && Array.isArray(payload.files)
                && payload.files.length
            ) {
                return payload.runId;
            }
        }
        return '';
    }

    hasLaterAvailableAgentRunChange(runId) {
        if (!runId) return false;
        const events = this.agentTimelineEvents || [];
        const currentIndex = events.findIndex((event) => event.type === 'run_changes' && event.payload?.runId === runId);
        if (currentIndex < 0) return false;
        return events.slice(currentIndex + 1).some((event) => (
            event.type === 'run_changes'
            && event.payload?.rollbackStatus === 'available'
            && Array.isArray(event.payload.files)
            && event.payload.files.length
        ));
    }

    renderAgentRunChangeActions(changes = {}) {
        const runId = changes.runId || '';
        const files = Array.isArray(changes.files) ? changes.files : [];
        if (!runId || !files.length) return '';
        const rollbackStatus = changes.rollbackStatus || 'available';
        if (rollbackStatus === 'reverted') {
            const restoreMode = changes.restoreMode || 'single';
            if (restoreMode === 'to_checkpoint') {
                return '<div class="agent-change-card__actions"><span class="agent-inline-actions__resolved">已回到这里</span></div>';
            }
            const label = restoreMode === 'to_checkpoint' ? '恢复到撤销前' : '恢复本轮';
            return `
                <div class="agent-change-card__actions">
                    <span class="agent-inline-actions__resolved">已撤销</span>
                    <button class="agent-artifact-link" type="button" data-agent-rollback-run="${this.escapeHtml(runId)}" data-agent-rollback-mode="restore" data-agent-restore-mode="${this.escapeHtml(restoreMode)}">${this.escapeHtml(label)}</button>
                </div>
            `;
        }
        if (rollbackStatus === 'restore_conflict') {
            return `
                <div class="agent-change-card__actions">
                    <span class="agent-inline-actions__resolved">恢复存在冲突</span>
                </div>
            `;
        }
        if (rollbackStatus === 'conflict') {
            return `
                <div class="agent-change-card__actions">
                    <span class="agent-inline-actions__resolved">存在冲突，未撤销</span>
                </div>
            `;
        }
        if (rollbackStatus === 'expired') {
            return '<div class="agent-change-card__actions"><span class="agent-inline-actions__resolved">撤销记录已过期</span></div>';
        }
        if (rollbackStatus !== 'available') return '';
        const isLatest = this.getLatestAvailableAgentRunChangeId() === runId;
        const hasLater = this.hasLaterAvailableAgentRunChange(runId);
        if (!isLatest && !hasLater) return '';
        return `
            <div class="agent-change-card__actions">
                ${isLatest
                    ? `<button class="agent-artifact-link" type="button" data-agent-rollback-run="${this.escapeHtml(runId)}" data-agent-rollback-mode="single">撤销本轮</button>`
                    : `<button class="agent-artifact-link" type="button" data-agent-rollback-run="${this.escapeHtml(runId)}" data-agent-rollback-mode="to_checkpoint">回到这里</button>`}
            </div>
        `;
    }

    renderAgentRunChangeCard(changes = {}) {
        const files = Array.isArray(changes.files) ? changes.files : [];
        if (!files.length) return '';
        const rollbackStatus = changes.rollbackStatus || 'available';
        const title = rollbackStatus === 'reverted'
            ? (changes.restoreMode === 'to_checkpoint' ? '已回到这里' : '已撤销这次修改')
            : rollbackStatus === 'restore_conflict'
                ? '恢复需要处理冲突'
                : rollbackStatus === 'conflict'
                    ? '撤销需要处理冲突'
                    : '任务已完成';
        return `
            <section class="agent-change-card">
                <header class="agent-change-card__header">
                    <div class="agent-change-card__title">
                        <strong>${this.escapeHtml(title)}</strong>
                    </div>
                    ${this.renderAgentRunChangeActions(changes)}
                </header>
            </section>
        `;
    }

    renderAgentResultEvent(event) {
        const payload = event.payload || {};
        const timestamp = this.escapeHtml(this.formatAgentTimestamp(event.createdAt));
        if (event.type === 'run_changes') {
            return '';
        }

        if (event.type === 'artifact_ready') {
            const artifact = payload.artifact || {};
            const isPrd = this.isPrdArtifact(artifact);
            const summary = [artifact.path, artifact.summary].filter(Boolean).join('\n') || '产物已生成';
            const link = artifact.outputUrl
                ? `
                    <div class="agent-artifact-actions">
                        ${isPrd ? `<button class="agent-artifact-link" type="button" data-agent-open-prd="1" data-agent-artifact-path="${this.escapeHtml(artifact.path || '')}" data-agent-artifact-url="${this.escapeHtml(artifact.outputUrl || '')}">打开文档</button>` : ''}
                        <a class="agent-artifact-link" href="${this.escapeHtml(artifact.outputUrl)}" target="_blank" rel="noopener noreferrer">${isPrd ? '新窗口' : '打开文档'}</a>
                    </div>
                `
                : '';
            return `
                <section class="agent-result agent-result--artifact" data-event-id="${this.escapeHtml(event.id || '')}">
                    <div class="agent-result__body">${this.renderAgentRichText(summary)}</div>
                    <div class="agent-result__meta">${timestamp}</div>
                    ${link}
                </section>
            `;
        }

        if (event.type === 'run_failed') {
            const changes = this.getAgentRunChanges(event.runId || payload.runId);
            const changeSummary = changes?.files?.length ? `
                ${this.renderAgentRunChangeCard(changes)}
            ` : '';
            return `
                <section class="agent-result agent-result--failed" data-event-id="${this.escapeHtml(event.id || '')}">
                    <div class="agent-result__meta">${timestamp}</div>
                    <div class="agent-result__body">${this.escapeHtml(payload.reason || '任务失败')}</div>
                    ${changeSummary}
                </section>
            `;
        }

        const changes = this.getAgentRunChanges(event.runId || payload.runId);
        const changeSummary = changes?.files?.length ? this.renderAgentRunChangeCard(changes) : '';
        if (changeSummary) return changeSummary;
        return `
            <section class="agent-result agent-result--done" data-event-id="${this.escapeHtml(event.id || '')}">
                <div class="agent-result__meta">${timestamp}</div>
                <div class="agent-result__body">${this.escapeHtml(payload.summary || '任务完成')}</div>
                ${changeSummary}
            </section>
        `;
    }

    renderAgentRichText(text) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const html = [];
        let paragraph = [];
        let codeLines = null;
        let codeLanguage = '';
        let tableLines = [];

        const flushParagraph = () => {
            if (!paragraph.length) return;
            html.push(`<p>${paragraph.map((line) => this.formatAgentInlineText(line)).join('<br>')}</p>`);
            paragraph = [];
        };

        const flushTable = () => {
            if (!tableLines.length) return;
            html.push(this.renderAgentMarkdownTable(tableLines));
            tableLines = [];
        };

        const flushCode = () => {
            if (!codeLines) return;
            html.push(this.renderAgentCodeBlock(codeLines.join('\n'), codeLanguage));
            codeLines = null;
            codeLanguage = '';
        };

        for (let index = 0; index < lines.length; index += 1) {
            const rawLine = lines[index];
            const trimmed = rawLine.trim();
            const fenceMatch = /^```([A-Za-z0-9_-]*)/.exec(trimmed);
            if (fenceMatch) {
                if (codeLines) {
                    flushCode();
                } else {
                    flushTable();
                    flushParagraph();
                    codeLines = [];
                    codeLanguage = fenceMatch[1] || '';
                }
                continue;
            }
            if (codeLines) {
                codeLines.push(rawLine);
                continue;
            }
            const feedbackItem = this.readAgentFeedbackItemBlock(lines, index);
            if (feedbackItem) {
                flushTable();
                flushParagraph();
                html.push(feedbackItem.html);
                index = feedbackItem.nextIndex - 1;
                continue;
            }
            const feedbackContext = this.readAgentFeedbackContextBlock(lines, index);
            if (feedbackContext) {
                flushTable();
                flushParagraph();
                html.push(feedbackContext.html);
                index = feedbackContext.nextIndex - 1;
                continue;
            }
            if (!trimmed) {
                flushTable();
                flushParagraph();
                continue;
            }
            if (this.isAgentMarkdownTableRow(trimmed)) {
                if (!tableLines.length) flushParagraph();
                tableLines.push(trimmed);
                continue;
            }
            flushTable();
            paragraph.push(trimmed);
        }

        flushTable();
        flushCode();
        flushParagraph();
        return html.join('');
    }

    readAgentFeedbackItemBlock(lines, startIndex) {
        const titleMatch = /^###\s+(反馈\s*#\d+)/.exec(String(lines[startIndex] || '').trim());
        if (!titleMatch) return null;

        let endIndex = startIndex + 1;
        let shouldConsumeDivider = false;
        while (endIndex < lines.length) {
            const trimmed = String(lines[endIndex] || '').trim();
            if (trimmed === '---') {
                shouldConsumeDivider = true;
                break;
            }
            if (endIndex > startIndex + 1 && /^###\s+反馈\s*#\d+/.test(trimmed)) break;
            if (endIndex > startIndex + 1 && /^###\s+补充说明/.test(trimmed)) break;
            endIndex += 1;
        }

        const blockLines = lines.slice(startIndex, endIndex);
        return {
            html: this.renderAgentFeedbackItemBlock(blockLines, titleMatch[1]),
            nextIndex: shouldConsumeDivider ? endIndex + 1 : endIndex
        };
    }

    renderAgentFeedbackItemBlock(blockLines, title = '反馈') {
        const bodyLines = blockLines.slice(1);
        const expectationIndex = bodyLines.findIndex((line) => this.isAgentFeedbackExpectationLabel(line));
        const contextIndex = bodyLines.findIndex((line) => this.getAgentFeedbackContextLabel(line) === 'elementHtml');
        const boundaryIndexes = [expectationIndex, contextIndex].filter((index) => index >= 0);
        const metaEndIndex = boundaryIndexes.length ? Math.min(...boundaryIndexes) : bodyLines.length;
        const metaHtml = this.renderAgentFeedbackMetaLines(bodyLines.slice(0, metaEndIndex));

        let expectationHtml = '';
        if (expectationIndex >= 0) {
            const expectationEndIndex = contextIndex > expectationIndex ? contextIndex : bodyLines.length;
            expectationHtml = this.renderAgentFeedbackExpectation(bodyLines.slice(expectationIndex + 1, expectationEndIndex));
        }

        const context = contextIndex >= 0
            ? this.readAgentFeedbackContextBlock(bodyLines, contextIndex, metaHtml)
            : null;
        const contextHtml = context?.html || (metaHtml ? this.renderAgentFeedbackContextBlock({ metaHtml }) : '');

        return `
            <section class="agent-feedback-item">
                <header class="agent-feedback-item__header">
                    <span class="agent-feedback-item__title">${this.escapeHtml(title.replace(/\s+/g, ' '))}</span>
                    <span class="agent-feedback-item__type">元素反馈</span>
                </header>
                ${expectationHtml ? `
                    <div class="agent-feedback-item__summary">
                        ${expectationHtml}
                    </div>
                ` : ''}
                ${contextHtml}
            </section>
        `;
    }

    isAgentFeedbackExpectationLabel(line) {
        const text = String(line || '').trim().replace(/\s+/g, ' ').replace(/\*\*/g, '');
        return /^用户期望变更[:：]?\s*$/.test(text);
    }

    renderAgentFeedbackMetaLines(lines) {
        const fields = this.parseAgentFeedbackMetaFields(lines);
        if (!fields.length) return '';
        const selectedText = fields.find((field) => field.label === '文本内容' && this.renderAgentFeedbackTextLines(field.valueLines));
        const contextFields = selectedText
            ? fields.map((field) => field === selectedText ? { ...field, label: '选中原文' } : field)
            : fields;

        return `
            ${contextFields.length ? `
                <div class="agent-feedback-context__meta">
                    <dl class="agent-feedback-item__meta">
                        ${contextFields.map((field) => `
                            <div class="agent-feedback-item__meta-row">
                                ${field.label ? `<dt>${this.escapeHtml(field.label)}</dt>` : ''}
                                <dd>${this.renderAgentFeedbackTextLines(field.valueLines)}</dd>
                            </div>
                        `).join('')}
                    </dl>
                </div>
            ` : ''}
        `;
    }

    parseAgentFeedbackMetaFields(lines) {
        const fields = [];
        let current = null;
        const allowedLabels = new Set(['选择器', '元素', 'ID', '类名', '文本内容']);

        this.trimAgentLines(lines).forEach((line) => {
            const field = this.parseAgentFeedbackMetaFieldLine(line);
            if (field && allowedLabels.has(field.label)) {
                current = { label: field.label, valueLines: [field.value] };
                fields.push(current);
                return;
            }
            if (current) {
                current.valueLines.push(line);
                return;
            }
            if (String(line || '').trim()) {
                fields.push({ label: '', valueLines: [line] });
            }
        });

        return fields.map((field) => field.label === '文本内容'
            ? { ...field, valueLines: this.stripAgentFeedbackTextQuotes(field.valueLines) }
            : field);
    }

    parseAgentFeedbackMetaFieldLine(line) {
        const raw = String(line || '');
        const boldMatch = /^\s*\*\*([^*]+)\*\*\s*[:：]\s*(.*)$/.exec(raw);
        if (boldMatch) return { label: boldMatch[1].trim(), value: boldMatch[2] };

        const plainMatch = /^\s*([^:：]+)\s*[:：]\s*(.*)$/.exec(raw);
        if (plainMatch) return { label: plainMatch[1].trim(), value: plainMatch[2] };

        return null;
    }

    stripAgentFeedbackTextQuotes(lines) {
        const nextLines = Array.from(lines || []);
        const firstIndex = nextLines.findIndex((line) => String(line || '').trim());
        if (firstIndex < 0) return nextLines;

        let lastIndex = nextLines.length - 1;
        while (lastIndex >= 0 && !String(nextLines[lastIndex] || '').trim()) lastIndex -= 1;
        if (lastIndex < firstIndex) return nextLines;

        const firstText = String(nextLines[firstIndex] || '');
        const lastText = String(nextLines[lastIndex] || '');
        if (!firstText.trim().startsWith('"') || !lastText.trim().endsWith('"')) return nextLines;

        nextLines[firstIndex] = firstText.replace(/^\s*"/, '');
        nextLines[lastIndex] = String(nextLines[lastIndex] || '').replace(/"\s*$/, '');
        return nextLines;
    }

    renderAgentFeedbackExpectation(lines) {
        const content = this.renderAgentFeedbackTextLines(lines);
        if (!content) return '';
        return `
            <div class="agent-feedback-item__expectation">
                <div class="agent-feedback-item__expectation-text">${content}</div>
            </div>
        `;
    }

    renderAgentFeedbackTextLines(lines) {
        const trimmed = this.trimAgentLines(lines);
        if (!trimmed.length) return '';
        return trimmed
            .map((line) => String(line || '').trim()
                ? this.formatAgentInlineText(line.trim())
                : '<span class="agent-feedback-item__blank-line"></span>')
            .join('<br>');
    }

    trimAgentLines(lines) {
        const nextLines = Array.from(lines || []);
        while (nextLines.length && !String(nextLines[0] || '').trim()) nextLines.shift();
        while (nextLines.length && !String(nextLines[nextLines.length - 1] || '').trim()) nextLines.pop();
        return nextLines;
    }

    readAgentFeedbackContextBlock(lines, startIndex, metaHtml = '') {
        const firstLabel = this.getAgentFeedbackContextLabel(lines[startIndex]);
        if (firstLabel !== 'elementHtml') return null;

        const elementBlock = this.readAgentLabeledCodeBlock(lines, startIndex);
        if (!elementBlock) return null;

        let nextIndex = this.skipAgentBlankLines(lines, elementBlock.nextIndex);
        const stylesLabel = this.getAgentFeedbackContextLabel(lines[nextIndex]);
        if (stylesLabel !== 'styles') return null;

        const stylesBlock = this.readAgentLabeledCodeBlock(lines, nextIndex);
        if (!stylesBlock) return null;

        nextIndex = this.skipAgentBlankLines(lines, stylesBlock.nextIndex);
        let parentBlock = null;
        if (this.getAgentFeedbackContextLabel(lines[nextIndex]) === 'parentHtml') {
            parentBlock = this.readAgentLabeledCodeBlock(lines, nextIndex);
        }

        return {
            html: this.renderAgentFeedbackContextBlock({
                elementHtml: elementBlock.code,
                styles: stylesBlock.code,
                parentHtml: parentBlock?.code || '',
                metaHtml
            }),
            nextIndex: parentBlock?.nextIndex || stylesBlock.nextIndex
        };
    }

    getAgentFeedbackContextLabel(line) {
        const text = String(line || '').trim().replace(/\s+/g, ' ').replace(/\*\*/g, '');
        if (/^元素 HTML[:：]?\s*$/.test(text)) return 'elementHtml';
        if (/^关键样式[:：]?\s*$/.test(text)) return 'styles';
        if (/^父级元素 HTML[:：]?\s*$/.test(text)) return 'parentHtml';
        return '';
    }

    skipAgentBlankLines(lines, startIndex) {
        let index = startIndex;
        while (index < lines.length && !String(lines[index] || '').trim()) index += 1;
        return index;
    }

    readAgentLabeledCodeBlock(lines, labelIndex) {
        let index = this.skipAgentBlankLines(lines, labelIndex + 1);
        const fenceMatch = /^```([A-Za-z0-9_-]*)/.exec(String(lines[index] || '').trim());
        if (!fenceMatch) return null;

        index += 1;
        const codeLines = [];
        while (index < lines.length) {
            if (/^```\s*$/.test(String(lines[index] || '').trim())) {
                return {
                    language: fenceMatch[1] || '',
                    code: codeLines.join('\n'),
                    nextIndex: index + 1
                };
            }
            codeLines.push(lines[index]);
            index += 1;
        }

        return null;
    }

    renderAgentFeedbackContextBlock({ elementHtml = '', styles = '', parentHtml = '', metaHtml = '' } = {}) {
        const sections = [
            { label: '元素 HTML', code: elementHtml, language: 'html' },
            { label: '关键样式', code: styles, language: 'css' },
            { label: '父级 HTML', code: parentHtml, language: 'html' }
        ]
            .filter((section) => String(section.code || '').trim())
            .map((section) => {
                const code = this.normalizeAgentCode(section.code);
                const language = this.detectAgentCodeLanguage(code, section.language);
                return `
                    <section class="agent-feedback-context__section">
                        <div class="agent-feedback-context__label">${this.escapeHtml(section.label)}</div>
                        <pre class="agent-feedback-context__code language-${this.escapeHtml(language)}"><code>${this.highlightAgentCode(code, language)}</code></pre>
                    </section>
                `;
            });

        if (!sections.length && !metaHtml) return '';
        return `
            <details class="agent-feedback-context">
                <summary class="agent-feedback-context__header">
                    <span>标注上下文</span>
                    <span>${this.escapeHtml(metaHtml ? 'INFO / HTML / CSS' : 'HTML / CSS')}</span>
                </summary>
                <div class="agent-feedback-context__body">${metaHtml}${sections.join('')}</div>
            </details>
        `;
    }

    isAgentMarkdownTableRow(line) {
        const text = String(line || '').trim();
        if (!text.includes('|')) return false;
        if (!text.startsWith('|') || !text.endsWith('|')) return false;
        return this.parseAgentMarkdownTableRow(text).length >= 2;
    }

    isAgentMarkdownTableDivider(line) {
        const cells = this.parseAgentMarkdownTableRow(line);
        if (cells.length < 2) return false;
        return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
    }

    parseAgentMarkdownTableRow(line) {
        return String(line || '')
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());
    }

    renderAgentMarkdownTable(lines) {
        if (lines.length < 2 || !this.isAgentMarkdownTableDivider(lines[1])) {
            return `<p>${lines.map((line) => this.formatAgentInlineText(line)).join('<br>')}</p>`;
        }
        const headers = this.parseAgentMarkdownTableRow(lines[0]);
        const rows = lines.slice(2)
            .filter((line) => this.isAgentMarkdownTableRow(line))
            .map((line) => this.parseAgentMarkdownTableRow(line));
        const head = headers
            .map((cell) => `<th>${this.formatAgentInlineText(cell)}</th>`)
            .join('');
        const body = rows
            .map((row) => `<tr>${headers.map((_, index) => `<td>${this.formatAgentInlineText(row[index] || '')}</td>`).join('')}</tr>`)
            .join('');
        return `<div class="agent-markdown-table-wrap"><table class="agent-markdown-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    formatAgentInlineText(text) {
        let html = this.escapeHtml(text);
        const codeSpans = [];
        html = html.replace(/`([^`]+)`/g, (_, code) => {
            const index = codeSpans.push(`<code class="agent-inline-code">${code}</code>`) - 1;
            return `@@READIFY_AGENT_CODE_${index}@@`;
        });
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/@@READIFY_AGENT_CODE_(\d+)@@/g, (_, index) => codeSpans[Number(index)] || '');
        return html;
    }

    renderAgentCodeBlock(value, language = '', label = '') {
        const raw = typeof value === 'string'
            ? value
            : JSON.stringify(value ?? {}, null, 2);
        const code = this.normalizeAgentCode(raw);
        const detectedLanguage = this.detectAgentCodeLanguage(code, language || (typeof value === 'string' ? '' : 'json'));
        const languageLabel = detectedLanguage || 'text';
        const header = label
            ? `<div class="agent-code-frame__header"><span>${this.escapeHtml(label)}</span><span>${this.escapeHtml(languageLabel)}</span></div>`
            : '';
        return `<div class="agent-code-frame" data-language="${this.escapeHtml(languageLabel)}">${header}<pre class="agent-code-block language-${this.escapeHtml(languageLabel)}"><code>${this.highlightAgentCode(code, detectedLanguage)}</code></pre></div>`;
    }

    normalizeAgentCode(code) {
        const lines = String(code || '').replace(/\r\n?/g, '\n').split('\n');
        while (lines.length && !lines[0].trim()) lines.shift();
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

        const indents = lines
            .filter((line) => line.trim())
            .map((line) => (/^[ \t]*/.exec(line)?.[0] || '').replace(/\t/g, '  ').length);
        const commonIndent = indents.length ? Math.min(...indents) : 0;
        if (!commonIndent) return lines.join('\n');

        return lines.map((line) => {
            let remaining = commonIndent;
            let index = 0;
            while (index < line.length && remaining > 0) {
                if (line[index] === '\t') {
                    remaining -= 2;
                } else if (line[index] === ' ') {
                    remaining -= 1;
                } else {
                    break;
                }
                index += 1;
            }
            return line.slice(index);
        }).join('\n');
    }

    detectAgentCodeLanguage(code, hint = '') {
        const normalizedHint = String(hint || '').toLowerCase();
        if (normalizedHint) {
            if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(normalizedHint)) return 'javascript';
            if (['html', 'xml', 'svg'].includes(normalizedHint)) return 'html';
            if (['json', 'css', 'shell', 'bash', 'sh'].includes(normalizedHint)) return normalizedHint === 'bash' || normalizedHint === 'sh' ? 'shell' : normalizedHint;
        }

        const stripped = this.stripAgentLineNumbers(code).trim();
        if (!stripped) return 'text';
        try {
            JSON.parse(stripped);
            return 'json';
        } catch (error) { /* keep detecting */ }
        if (/^<!doctype|<\/?[a-z][\s\S]*>/i.test(stripped)) return 'html';
        if (/(^|\n)\s*(const|let|var|function|import|export|class)\s|\)\s*=>/.test(stripped)) return 'javascript';
        if (/[:;{}]/.test(stripped) && /(^|\n)\s*(\.|#|:root|[a-z-]+\s*:)/i.test(stripped)) return 'css';
        if (/^\s*(npm|node|git|cd|mkdir|rg|sed|cat|curl)\b/m.test(stripped)) return 'shell';
        return 'text';
    }

    stripAgentLineNumbers(code) {
        return String(code || '').split('\n').map((line) => line.replace(/^\s*\d+\t/, '')).join('\n');
    }

    highlightAgentCode(code, language = 'text') {
        const raw = String(code || '');
        if (language === 'json') return this.highlightAgentJsonCode(raw);
        if (language === 'html') return this.highlightAgentMarkupCode(raw);
        if (language === 'css') return this.highlightAgentGenericCode(raw, 'css');
        if (language === 'javascript') return this.highlightAgentGenericCode(raw, 'javascript');
        if (language === 'shell') return this.highlightAgentGenericCode(raw, 'shell');
        return this.escapeHtml(raw);
    }

    highlightAgentJsonCode(code) {
        const tokenRegex = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false)\b|\bnull\b/g;
        let html = '';
        let lastIndex = 0;
        String(code || '').replace(tokenRegex, (match, property, stringValue, numberValue, booleanValue, offset) => {
            html += this.escapeHtml(code.slice(lastIndex, offset));
            const cls = property
                ? 'agent-token-property'
                : stringValue
                    ? 'agent-token-string'
                    : numberValue
                        ? 'agent-token-number'
                        : booleanValue
                            ? 'agent-token-boolean'
                            : 'agent-token-null';
            html += `<span class="${cls}">${this.escapeHtml(match)}</span>`;
            lastIndex = offset + match.length;
            return match;
        });
        html += this.escapeHtml(code.slice(lastIndex));
        return html;
    }

    highlightAgentMarkupCode(code) {
        const tokenRegex = /(?:<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
        let html = '';
        let lastIndex = 0;
        String(code || '').replace(tokenRegex, (match, offset) => {
            html += this.escapeHtml(code.slice(lastIndex, offset));
            if (match.startsWith('<!--')) {
                html += `<span class="agent-token-comment">${this.escapeHtml(match)}</span>`;
            } else if (match.startsWith('<')) {
                const escaped = this.escapeHtml(match).replace(/(&lt;\/?)([A-Za-z0-9:-]+)/, '$1<span class="agent-token-tag">$2</span>');
                html += `<span class="agent-token-punctuation">${escaped}</span>`;
            } else {
                html += `<span class="agent-token-string">${this.escapeHtml(match)}</span>`;
            }
            lastIndex = offset + match.length;
            return match;
        });
        html += this.escapeHtml(code.slice(lastIndex));
        return html;
    }

    highlightAgentGenericCode(code, language = 'text') {
        const keywordPattern = language === 'css'
            ? '\\b(?:display|position|relative|absolute|fixed|flex|grid|block|none|auto|hidden|visible|color|background|border|padding|margin|width|height|transform|transition|var)\\b'
            : language === 'shell'
                ? '\\b(?:npm|node|git|cd|mkdir|rm|rg|sed|curl|cat|ls|echo|export|source)\\b'
                : '\\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|await|async|try|catch|throw|true|false|null|undefined)\\b';
        const lineCommentPattern = language === 'shell' ? '#[^\\n]*|' : '';
        const tokenRegex = new RegExp(`(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|${lineCommentPattern}"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\\`(?:\\\\.|[^\\\`\\\\])*\\\`|${keywordPattern}|-?\\b\\d+(?:\\.\\d+)?\\b|#[0-9a-fA-F]{3,8}\\b)`, 'g');
        let html = '';
        let lastIndex = 0;
        String(code || '').replace(tokenRegex, (match, offset) => {
            html += this.escapeHtml(code.slice(lastIndex, offset));
            let cls = 'agent-token-keyword';
            if (/^(\/\*|\/\/|#(?![0-9a-fA-F]{3,8}\b))/.test(match)) cls = 'agent-token-comment';
            else if (/^["'`]/.test(match)) cls = 'agent-token-string';
            else if (/^-?\d/.test(match)) cls = 'agent-token-number';
            else if (/^#[0-9a-fA-F]{3,8}\b/.test(match)) cls = 'agent-token-color';
            html += `<span class="${cls}">${this.escapeHtml(match)}</span>`;
            lastIndex = offset + match.length;
            return match;
        });
        html += this.escapeHtml(code.slice(lastIndex));
        return html;
    }

    renderAgentTimelineGroup(group) {
        const descriptor = group.descriptor;
        const groupKey = group.id || group.runId || 'session';
        const rows = [];

        const userDescriptors = group.descriptors?.length ? group.descriptors : [descriptor];
        userDescriptors.forEach((item) => {
            if (!((item?.kind === 'message' || item?.kind === 'skill') && item?.message)) return;
            rows.push(this.renderAgentTimelineRow({
                role: 'You',
                className: 'agent-timeline__row agent-timeline__row--user',
                body: this.renderAgentUserMessage(item)
            }));
        });

        if (descriptor?.kind === 'command') {
            rows.push(this.renderAgentTimelineRow({
                role: 'Command',
                className: 'agent-timeline__row agent-timeline__row--command',
                body: `
                    <span class="agent-command-chip">
                        <span>/${this.escapeHtml(descriptor.commandId || 'command')}</span>
                        ${descriptor.arguments ? `<span class="agent-command-chip__usage">${this.escapeHtml(descriptor.arguments)}</span>` : ''}
                    </span>
                `
            }));
        }

        rows.push(this.renderAgentAssistantTurn(group));

        return `
            <section class="agent-run-group${this.isAgentGroupActive(group) ? ' is-active' : ''}" data-run-group="${this.escapeHtml(groupKey)}">
                ${rows.join('')}
            </section>
        `;
    }

    parseAgentPrdContextMessage(message, explicitContext = null) {
        const source = String(message || '').replace(/\r\n?/g, '\n');
        const wholeMatch = /^<details>\s*\n?<summary><b>\[PRD 完整文档 \(([^\n]+)\)\]<\/b><\/summary>\s*\n([\s\S]*?)\n<\/details>\s*/.exec(source);
        if (wholeMatch) {
            return {
                context: {
                    type: 'whole',
                    name: wholeMatch[1].trim() || explicitContext?.name || 'PRD 文档'
                },
                message: source.slice(wholeMatch[0].length).trim()
            };
        }

        const selectionMatch = /^> \*\*\[PRD 选中文本上下文\]\*\*\n((?:>[^\n]*(?:\n|$))*)\s*/.exec(source);
        if (selectionMatch) {
            const selection = selectionMatch[1]
                .split('\n')
                .map((line) => line.replace(/^> ?/, ''))
                .join('\n')
                .trim();
            return {
                context: {
                    type: 'selection',
                    name: explicitContext?.name || 'PRD 选区',
                    preview: selection
                },
                message: source.slice(selectionMatch[0].length).trim()
            };
        }

        return {
            context: explicitContext || null,
            message: source.trim()
        };
    }

    renderAgentPrdContextCard(context = {}) {
        const isWhole = context.type === 'whole';
        const typeLabel = isWhole ? '完整 PRD' : 'PRD 选区';
        const fallbackLabel = isWhole ? 'PRD 文档' : '已选择的 PRD 内容';
        const label = context.name || context.preview || fallbackLabel;
        return `
            <section class="agent-message-prd-context" aria-label="随消息发送的 ${this.escapeHtml(typeLabel)}">
                <span class="agent-message-prd-context__icon" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                </span>
                <span class="agent-message-prd-context__main">
                    <span class="agent-message-prd-context__name">${this.escapeHtml(label)}</span>
                </span>
                <span class="agent-message-prd-context__type">${this.escapeHtml(typeLabel)}</span>
            </section>
        `;
    }

    getAgentAttachmentPreviewUrl(attachment = {}) {
        const dataUrl = String(attachment.dataUrl || '');
        if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl)) {
            return dataUrl;
        }

        const storedPath = String(attachment.path || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');
        if (!storedPath.startsWith('data/agent-uploads/')) return '';
        return `/${storedPath.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
    }

    openAgentImagePreview({ src = '', name = '' } = {}, trigger = null) {
        if (!this.agentImagePreviewModal || !this.agentImagePreviewImage || !src) return;
        this.agentImagePreviewTrigger = trigger || document.activeElement;
        this.agentImagePreviewImage.src = src;
        this.agentImagePreviewImage.alt = name || '上传图片';
        if (this.agentImagePreviewCaption) {
            this.agentImagePreviewCaption.textContent = name || '上传图片';
        }
        this.agentImagePreviewModal.hidden = false;
        requestAnimationFrame(() => this.agentImagePreviewClose?.focus());
    }

    closeAgentImagePreview() {
        if (!this.agentImagePreviewModal || this.agentImagePreviewModal.hidden) return;
        this.agentImagePreviewModal.hidden = true;
        if (this.agentImagePreviewImage) {
            this.agentImagePreviewImage.removeAttribute('src');
            this.agentImagePreviewImage.alt = '';
        }
        const trigger = this.agentImagePreviewTrigger;
        this.agentImagePreviewTrigger = null;
        if (trigger?.isConnected) trigger.focus();
    }

    renderAgentMessageAttachments(attachments = []) {
        const images = (Array.isArray(attachments) ? attachments : [])
            .map((attachment) => ({
                ...attachment,
                previewUrl: this.getAgentAttachmentPreviewUrl(attachment)
            }))
            .filter((attachment) => attachment.previewUrl);
        if (!images.length) return '';

        const countLabel = `${images.length} 张图片`;
        return `
            <section class="agent-message-attachments agent-message-attachments--${Math.min(images.length, 4)}" aria-label="随消息发送的 ${this.escapeHtml(countLabel)}">
                ${images.map((attachment, index) => {
                    const name = attachment.name || `图片 ${index + 1}`;
                    const size = attachment.size ? ` · ${this.formatAgentAttachmentSize(attachment.size)}` : '';
                    const title = `${name}${size}`;
                    return `
                        <button class="agent-message-attachment" type="button" data-agent-image-preview="${this.escapeHtml(attachment.previewUrl)}" data-agent-image-name="${this.escapeHtml(name)}" title="${this.escapeHtml(title)}" aria-label="查看图片：${this.escapeHtml(title)}">
                            <img src="${this.escapeHtml(attachment.previewUrl)}" alt="${this.escapeHtml(name)}" loading="lazy">
                            <span class="agent-message-attachment__meta">
                                <span class="agent-message-attachment__name">${this.escapeHtml(name)}</span>
                                <span class="agent-message-attachment__index">${index + 1}/${images.length}</span>
                            </span>
                        </button>
                    `;
                }).join('')}
            </section>
        `;
    }

    stripLegacyNewPageExecutionPrompt(message = '') {
        const source = String(message || '').replace(/\r\n?/g, '\n');
        if (!source.startsWith('### 页面类型\n')) return source;
        const terminalLines = [
            '不要再次询问或自动改选框架。',
            '不要在回复中反复询问或确认风格；它已经由顶部选择器绑定。',
            '必须从 `src/templates/mobile-frame/` 复制 `index.html`、`styles.css`、`app.js`、`frame-fit.js` 作为 v1 起点，并保留手机外框结构。'
        ];
        let endIndex = -1;
        terminalLines.forEach((line) => {
            const index = source.indexOf(line);
            if (index >= 0) endIndex = Math.max(endIndex, index + line.length);
        });
        return endIndex >= 0 ? source.slice(endIndex).trim() : source;
    }

    renderAgentUserMessage(descriptor = {}) {
        const visibleMessage = this.stripLegacyNewPageExecutionPrompt(descriptor.message);
        const parsed = this.parseAgentPrdContextMessage(visibleMessage, descriptor.prdContext);
        const contextCard = parsed.context ? this.renderAgentPrdContextCard(parsed.context) : '';
        const attachments = this.renderAgentMessageAttachments(descriptor.attachments);
        const messageBody = parsed.message
            ? `<div class="agent-user-message__text">${this.renderAgentRichText(parsed.message)}</div>`
            : '';
        return `<div class="agent-user-message${contextCard ? ' has-prd-context' : ''}${attachments ? ' has-attachments' : ''}">${contextCard}${attachments}${messageBody}</div>`;
    }

    renderAgentTimelineRow({ role, className, body, meta = '', extra = '', eventId = '' }) {
        const eventIdAttr = eventId ? ` data-event-id="${this.escapeHtml(eventId)}"` : '';
        return `
            <article class="${className}"${eventIdAttr}>
                <div class="agent-timeline__role">${this.escapeHtml(role)}</div>
                <div class="agent-timeline__content">
                    <div class="agent-timeline__body">${body}</div>
                    ${extra}
                    ${meta ? `<div class="agent-timeline__meta">${meta}</div>` : ''}
                </div>
            </article>
        `;
    }

    renderAgentTimelineEvent(event, descriptor = null) {
        const payload = event.payload || {};
        const timestamp = this.escapeHtml(this.formatAgentTimestamp(event.createdAt));
        const eid = event.id || '';

        if (event.type === 'session_ready') {
            return '';
        }

        if (event.type === 'run_started') {
            return '';
        }

        if (event.type === 'assistant_message') {
            const suffix = payload.partial ? '<span style="color:#67e8f9;">正在生成…</span>' : '';
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Assistant',
                className: 'agent-timeline__row agent-timeline__row--assistant',
                body: this.escapeHtml(payload.text || ''),
                meta: `${timestamp}${suffix ? `<span>${suffix}</span>` : ''}`
            });
        }

        if (event.type === 'tool_started') {
            const details = payload.inputPreview || payload.input
                ? `<details class="agent-timeline__details"><summary>查看输入</summary><pre>${this.escapeHtml(JSON.stringify(payload.input || {}, null, 2))}</pre></details>`
                : '';
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Tool',
                className: 'agent-timeline__row agent-timeline__row--tool',
                body: this.escapeHtml(`开始执行 ${payload.toolName || 'Tool'}`),
                meta: timestamp,
                extra: details
            });
        }

        if (event.type === 'tool_finished') {
            const details = payload.output
                ? `<details class="agent-timeline__details"><summary>查看输出</summary><pre>${this.escapeHtml(String(payload.output))}</pre></details>`
                : '';
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Tool',
                className: 'agent-timeline__row agent-timeline__row--tool',
                body: this.escapeHtml(`${payload.toolName || 'Tool'} ${payload.ok ? '执行完成' : '执行失败'}`),
                meta: timestamp,
                extra: details
            });
        }

        if (event.type === 'approval_request') {
            const approval = payload.approval || {};
            const isPending = this.agentPendingApproval && this.agentPendingApproval.id === approval.id;
            const actions = isPending ? `
                <div class="agent-inline-actions">
                    <button type="button" data-approval-decision="allow_once">允许一次</button>
                    <button type="button" data-approval-decision="allow_session">本会话总是允许</button>
                    <button type="button" data-approval-decision="deny">拒绝</button>
                </div>
            ` : '';
            const details = approval.inputPreview
                ? `<details class="agent-timeline__details"><summary>查看请求详情</summary><pre>${this.escapeHtml(approval.inputPreview)}</pre></details>`
                : '';
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Approval',
                className: 'agent-timeline__row agent-timeline__row--approval',
                body: this.escapeHtml(`需要批准 ${approval.toolName || '高风险工具'} 后才能继续。`),
                meta: timestamp,
                extra: `${details}${actions}`
            });
        }

        if (event.type === 'approval_resolved') {
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Approval',
                className: 'agent-timeline__row agent-timeline__row--approval',
                body: this.escapeHtml(`${payload.approval?.toolName || '工具'} 已处理：${payload.approval?.decision || 'unknown'}`),
                meta: timestamp
            });
        }

        if (event.type === 'question_request') {
            const question = payload.question || {};
            const isPending = this.agentPendingQuestion && this.agentPendingQuestion.id === question.id;
            const optionButtons = isPending && Array.isArray(question.options) && question.options.length
                ? `
                    <div class="agent-inline-actions">
                        ${question.options.map((option) => `
                            <button type="button" data-question-option="${this.escapeHtml(option)}">${this.escapeHtml(option)}</button>
                        `).join('')}
                    </div>
                `
                : '';
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Question',
                className: 'agent-timeline__row agent-timeline__row--question',
                body: this.escapeHtml(question.question || 'Agent 正在等待你的补充回答。'),
                meta: `${timestamp}${isPending ? '<span>也可以直接在底部输入框回复</span>' : ''}`,
                extra: optionButtons
            });
        }

        if (event.type === 'question_resolved') {
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Question',
                className: 'agent-timeline__row agent-timeline__row--question',
                body: this.escapeHtml(`你的回答：${payload.question?.answer || ''}`),
                meta: timestamp
            });
        }

        if (event.type === 'artifact_ready') {
            const artifact = payload.artifact || {};
            const isPrd = this.isPrdArtifact(artifact);
            const link = artifact.outputUrl
                ? `
                    <div class="agent-artifact-actions">
                        ${isPrd ? `<button class="agent-artifact-link" type="button" data-agent-open-prd="1" data-agent-artifact-path="${this.escapeHtml(artifact.path || '')}" data-agent-artifact-url="${this.escapeHtml(artifact.outputUrl || '')}">打开文档</button>` : ''}
                        <a class="agent-artifact-link" href="${this.escapeHtml(artifact.outputUrl)}" target="_blank" rel="noopener noreferrer">${isPrd ? '新窗口' : '打开文档'}</a>
                    </div>
                `
                : '';
            const summary = [artifact.path, artifact.summary].filter(Boolean).join('\n');
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Artifact',
                className: 'agent-timeline__row agent-timeline__row--artifact',
                body: this.escapeHtml(summary || '产物已生成'),
                meta: timestamp,
                extra: link
            });
        }

        if (event.type === 'run_finished') {
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Done',
                className: 'agent-timeline__row agent-timeline__row--artifact',
                body: this.escapeHtml(payload.summary || '任务完成'),
                meta: timestamp
            });
        }

        if (event.type === 'run_failed') {
            return this.renderAgentTimelineRow({
                eventId: eid,
                role: 'Error',
                className: 'agent-timeline__row agent-timeline__row--failed',
                body: this.escapeHtml(payload.reason || '任务失败'),
                meta: timestamp
            });
        }

        return this.renderAgentTimelineRow({
            eventId: eid,
            role: event.type,
            className: 'agent-timeline__row agent-timeline__row--status',
            body: this.escapeHtml(JSON.stringify(payload, null, 2)),
            meta: timestamp
        });
    }

    renderAgentWorkbench({ deferHeavy = false } = {}) {
        this.renderAgentChrome();
        this.renderAgentConnectionResult();
        this.renderActiveAgentSkill();
        this.renderFeedbackPanel();
        this.renderAgentAttachments();
        this.renderAgentSkillMenu();
        this.renderAgentCommandMenu();
        this.renderAgentControls();
        this.renderModelLabel();
        this.renderPlanModeToggle();
        this.renderPermissionLabel();
        this.resizeAgentInput();
        if (deferHeavy) {
            return;
        }
        this.renderAgentSessionList();
        this._scheduleAgentTimelinePatch();
    }

    handleAgentTimelineScroll() {
        if (!this.agentTimeline) return;
        const nearBottom = this.agentTimeline.scrollHeight - this.agentTimeline.scrollTop - this.agentTimeline.clientHeight < 48;
        this.agentAutoScroll = nearBottom;
        this.agentShowJumpLatest = !nearBottom;
        if (this.agentJumpLatestBtn) {
            this.agentJumpLatestBtn.hidden = nearBottom;
        }
    }

    captureAgentFeedbackToggleAnchor(event) {
        if (!this.agentTimeline) return;
        const summary = event.target?.closest?.('.agent-feedback-context__header');
        if (!summary || !this.agentTimeline.contains(summary)) return;

        const details = summary.closest('.agent-feedback-context');
        if (!details) return;

        this._agentFeedbackToggleAnchors.set(details, {
            top: summary.getBoundingClientRect().top,
            scrollTop: this.agentTimeline.scrollTop
        });
    }

    restoreAgentFeedbackToggleAnchor(details) {
        if (!this.agentTimeline || !details) return;
        const anchor = this._agentFeedbackToggleAnchors.get(details);
        this._agentFeedbackToggleAnchors.delete(details);
        if (!anchor) return;

        requestAnimationFrame(() => {
            if (!this.agentTimeline || !details.isConnected) return;
            const summary = details.querySelector('.agent-feedback-context__header');
            if (!summary) return;

            const delta = summary.getBoundingClientRect().top - anchor.top;
            if (Math.abs(delta) < 1) return;

            this.agentTimeline.scrollTop = Math.max(0, anchor.scrollTop + delta);
        });
    }

    scrollElementToBottom(el) {
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    scrollAgentTimelineToLatest(force = false, scrollSubElements = false) {
        if (!this.agentTimeline) return;
        if (force) {
            this.agentAutoScroll = true;
        }
        this.scrollElementToBottom(this.agentTimeline);
        if (scrollSubElements) {
            this.agentTimeline.querySelectorAll('.agent-process__items').forEach((items) => {
                this.scrollElementToBottom(items);
            });
            this.agentTimeline.querySelectorAll('.agent-code-block').forEach((block) => {
                this.scrollElementToBottom(block);
            });
        }
        this.agentShowJumpLatest = false;
        if (this.agentJumpLatestBtn) {
            this.agentJumpLatestBtn.hidden = true;
        }
    }

    async handleAgentTimelineClick(event) {
        const imagePreview = event.target.closest('[data-agent-image-preview]');
        if (imagePreview) {
            event.preventDefault();
            this.openAgentImagePreview({
                src: imagePreview.dataset.agentImagePreview || '',
                name: imagePreview.dataset.agentImageName || ''
            }, imagePreview);
            return;
        }

        const processSummary = event.target.closest('.agent-process__summary');
        if (processSummary) {
            const process = processSummary.closest('.agent-process');
            if (process) {
                process.dataset.agentManualToggle = '1';
                delete process.dataset.agentAutoOpen;
                if (!process.open) {
                    setTimeout(() => {
                        const items = process.querySelector('.agent-process__items');
                        if (items) {
                            this.scrollElementToBottom(items);
                        }
                        process.querySelectorAll('.agent-code-block').forEach((cb) => {
                            this.scrollElementToBottom(cb);
                        });
                    }, 0);
                }
            }
        }

        const prdArtifactButton = event.target.closest('[data-agent-open-prd]');
        if (prdArtifactButton) {
            event.preventDefault();
            this.openPrdDocumentFromArtifact({
                path: prdArtifactButton.dataset.agentArtifactPath || '',
                outputUrl: prdArtifactButton.dataset.agentArtifactUrl || ''
            });
            return;
        }

        const rollbackButton = event.target.closest('[data-agent-rollback-run]');
        if (rollbackButton) {
            event.preventDefault();
            const runId = rollbackButton.dataset.agentRollbackRun || '';
            const mode = rollbackButton.dataset.agentRollbackMode || 'to_checkpoint';
            const restoreMode = rollbackButton.dataset.agentRestoreMode || 'single';
            await this.rollbackAgentRun(runId, { mode, restoreMode });
            return;
        }

        const approvalDecision = event.target.closest('[data-approval-decision]');
        if (approvalDecision) {
            const decision = approvalDecision.dataset.approvalDecision;
            const actionContainer = approvalDecision.closest('.agent-inline-actions');
            if (actionContainer) {
                const labels = { allow_once: '允许一次', allow_session: '本会话总是允许', deny: '拒绝' };
                actionContainer.innerHTML = `<span class="agent-inline-actions__resolved">已选择：${this.escapeHtml(labels[decision] || decision)}</span>`;
            }
            this.resolveAgentApproval(decision);
            return;
        }

        const questionOption = event.target.closest('[data-question-option]');
        if (questionOption) {
            const option = questionOption.dataset.questionOption || '';
            const actionContainer = questionOption.closest('.agent-inline-actions');
            if (actionContainer) {
                actionContainer.innerHTML = `<span class="agent-inline-actions__resolved">已选择：${this.escapeHtml(option)}</span>`;
            }
            this.answerAgentQuestion(option);
            return;
        }

        const choiceButton = event.target.closest('[data-agent-choice-value]');
        if (choiceButton) {
            const actionContainer = choiceButton.closest('.agent-inline-actions');
            const label = choiceButton.dataset.agentChoiceLabel || choiceButton.dataset.agentChoiceValue || '';
            if (actionContainer) {
                actionContainer.innerHTML = `<span class="agent-inline-actions__resolved">已选择：${this.escapeHtml(label)}</span>`;
            }
            this.resolveAgentLocalChoice({
                eventId: choiceButton.dataset.agentChoiceEvent || '',
                choiceType: choiceButton.dataset.agentChoiceKind || '',
                value: choiceButton.dataset.agentChoiceValue || '',
                label
            });
        }
    }

    async rollbackAgentRun(runId, { mode = 'to_checkpoint', restoreMode = 'single', force = false } = {}) {
        if (!this.agentSessionId || !runId || this.agentRunState.active) {
            this.showToast(this.agentRunState.active ? 'Prota 正在执行任务，请先停止或等待完成。' : '找不到可撤销的运行记录。', true);
            return;
        }
        const label = mode === 'restore'
            ? (restoreMode === 'to_checkpoint' ? '恢复到撤销前' : '恢复本轮')
            : mode === 'single'
                ? '撤销本轮修改'
                : '回到这里';
        try {
            const result = await this.agentApi.rollbackRun(this.agentSessionId, runId, { mode, restoreMode, force });
            this.showToast(result.summary || `${label}已完成`);
            await this.switchAgentSession(this.agentSessionId, { forceRefresh: true, awaitRefresh: true });
            this.refreshProjectsAfterAgentRun();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.showToast(message || `${label}失败`, true);
            await this.switchAgentSession(this.agentSessionId, { forceRefresh: true, awaitRefresh: true }).catch(() => {});
        }
    }

    upsertAgentTimelineEvent(event) {
        const index = this.agentTimelineEvents.findIndex((item) => item.id === event.id);
        if (index >= 0) {
            this.agentTimelineEvents[index] = event;
            return { inserted: false, replaced: true };
        } else {
            this.agentTimelineEvents.push(event);
            return { inserted: true, replaced: false };
        }
    }

    showAgentChoicePrompt({ choiceType, title, summary, options = [] }) {
        const normalizedOptions = options
            .filter((option) => option && option.value)
            .map((option) => ({
                value: String(option.value),
                label: String(option.label || option.value)
            }));
        if (!normalizedOptions.length) {
            this.showToast(summary || '当前没有可选项。', true);
            return;
        }
        this.openAgentWorkbench();
        this.upsertAgentTimelineEvent({
            id: `local-choice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type: 'local_choice_request',
            runId: null,
            createdAt: new Date().toISOString(),
            payload: {
                choiceType,
                title,
                summary,
                options: normalizedOptions
            }
        });
        this.agentAutoScroll = true;
        this._scheduleAgentTimelinePatch();
        this.renderAgentControls();
    }

    async resolveAgentLocalChoice({ eventId, choiceType, value, label }) {
        const event = this.agentTimelineEvents.find((item) => item.id === eventId);
        if (event) {
            event.payload = {
                ...(event.payload || {}),
                selectedValue: value,
                selectedLabel: label
            };
            this.upsertAgentTimelineEvent(event);
            this._scheduleAgentTimelinePatch();
        }

        if (choiceType === 'permission') {
            await this.updateSdkPermissionMode(value);
            return;
        }

        if (choiceType === 'model') {
            await this.applyAgentModelChoice(value);
            return;
        }

        if (choiceType === 'provider') {
            await this.applyAgentProviderChoice(value);
        }
    }

    async applyAgentModelChoice(model) {
        const nextModel = String(model || '').trim();
        if (!nextModel) return;
        const active = this.getActiveProvider();
        if (active) {
            active.model = nextModel;
            active.models = Array.from(new Set([...(active.models || []), nextModel])).filter(Boolean);
        }
        this.agentConfig = this.buildAgentConfigFromActiveProvider();
        this.persistProviders();
        this.syncAgentConfigForm();
        await this.updateSdkAgentModel(nextModel);
        this.showToast(`当前会话模型已切换为 ${nextModel}`);
        this.renderAgentWorkbench();
    }

    async applyAgentProviderChoice(providerId) {
        const raw = String(providerId || '').trim();
        if (!raw) return;
        const existing = this.agentSavedProviders.find((provider) => provider.id === raw);
        if (existing) {
            await this.activateProvider(existing.id, { silent: true });
            this.showToast(`已切换到 ${existing.label}`);
            return;
        }
        const preset = this.getAgentPreset(raw);
        if (preset) {
            this.addProviderFromPreset(preset.id);
            await this.activateProvider(this.selectedProviderId, { silent: true });
            this.showToast(`已从模板添加并切换到 ${preset.label}`);
            return;
        }
        this.showToast(`未找到供应商: ${raw}`, true);
    }

    syncAgentSkillFromDescriptor(descriptor, { preserveExisting = true } = {}) {
        if (descriptor?.kind === 'skill' && descriptor?.skillId) {
            this.agentActiveSkill = this.getAgentSkill(descriptor.skillId) || {
                id: descriptor.skillId,
                label: descriptor.skillLabel || descriptor.skillId,
                description: '',
                placeholder: '',
                defaultStarter: '',
                supportsFollowups: true
            };
            return;
        }
        if (descriptor?.kind === 'command') {
            const command = this.getAgentCommand(descriptor.commandId);
            if (command?.skillId) {
                this.agentActiveSkill = this.getAgentSkill(command.skillId) || this.agentActiveSkill;
                return;
            }
        }
        if (!preserveExisting) {
            this.agentActiveSkill = null;
        }
    }

    hydrateAgentHistory(data) {
        const nextTimeline = Array.isArray(data.timeline) ? data.timeline : [];
        const previousSignature = this.getAgentTimelineSignature();
        this.agentTimelineEvents = nextTimeline;
        const nextSignature = this.getAgentTimelineSignature();
        this._needsFullTimelineRebuild = nextSignature !== previousSignature
            || nextSignature !== this._agentRenderedTimelineSignature;

        const rawRunState = data.runState || {};

        // Scan timeline for the last terminal event to derive correct status.
        // IMPORTANT: only apply the override if the terminal event belongs to the *current*
        // runId (so a finished run-A doesn't clobber an in-progress run-B).
        let terminalOverride = null;
        const currentRunId = rawRunState.runId;
        for (let i = this.agentTimelineEvents.length - 1; i >= 0; i--) {
            const evt = this.agentTimelineEvents[i];
            if (evt.type === 'run_started') {
                // We've scanned past the start of the latest run without finding a terminal
                // event for it — the run is still active, no override.
                break;
            }
            if (evt.type === 'run_finished') {
                // Only treat as terminal if it matches the current runId (or there is none).
                if (!currentRunId || evt.runId === currentRunId) {
                    terminalOverride = {
                        active: false,
                        status: evt.payload?.status || 'succeeded',
                        stageMessage: evt.payload?.summary || rawRunState.stageMessage || '任务已完成',
                        finishedAt: evt.createdAt || rawRunState.finishedAt
                    };
                }
                break;
            }
            if (evt.type === 'run_failed') {
                if (!currentRunId || evt.runId === currentRunId) {
                    terminalOverride = {
                        active: false,
                        status: 'failed',
                        stageMessage: evt.payload?.reason || '任务失败',
                        lastError: evt.payload?.reason || '任务失败',
                        finishedAt: evt.createdAt || rawRunState.finishedAt
                    };
                }
                break;
            }
        }


        this.agentRunState = {
            ...this.getDefaultAgentRunState(),
            ...rawRunState,
            ...(terminalOverride || {})
        };

        // Only restore active skill if the run is still active (in-progress).
        if (this.agentRunState.active) {
            this.syncAgentSkillFromDescriptor(
                data.runState?.descriptor || data.runState?.lastDescriptor,
                { preserveExisting: true }
            );
        } else {
            this.agentActiveSkill = null;
        }
        this.agentPendingApproval = data.pendingApproval || null;
        this.agentPendingQuestion = data.pendingQuestion || null;
        this.agentSessionProviderConfig = data.providerConfig || null;
        this.agentSessionScope = data.sessionScope || (data.context?.globalContext || data.context?.pageId === '__global__' ? 'global' : 'page');
        if (this.agentSessionScope === 'global') {
            this.agentSessionContext = {
                pageId: '__global__',
                version: '',
                globalContext: true
            };
        } else if (data.context?.pageId && data.context?.version) {
            const resolved = this.resolvePageProject(data.context.pageId, data.context.version, data.context.projectId);
            this.agentSessionContext = {
                projectId: resolved?.project?.id || data.context.projectId || this.activeProjectId || 'readify',
                pageId: resolved?.page?.id || data.context.pageId,
                version: data.context.version,
                globalContext: false
            };
        } else {
            this.agentSessionContext = null;
        }
        this.syncAgentConfigForm();
    }

    handleAgentStreamEvent(eventName, event) {
        const payload = event?.payload || {};
        let timelineChange = null;

        if (this.miniTerminalContainer) {
            if (eventName === 'run_started') {
                this._termQueue = []; // flush old queue on new run
                this.addMiniTerminalLine('▶ run started', 'sys');
            } else if (eventName === 'sdk_init') {
                const modelName = payload.model || this.agentConfig?.model || 'model';
                this.addMiniTerminalLine(`⚙ init  ${modelName}`, 'sys');
            } else if (eventName === 'assistant_thinking') {
                this.addMiniTerminalLine('~ thinking…', 'prompt');
            } else if (eventName === 'assistant_delta' && payload.content) {
                const text = payload.content.replace(/[\r\n]+/g, ' ').trim();
                if (text) this.addMiniTerminalLine(text, 'ai');
            } else if (eventName === 'tool_started') {
                const toolName = payload.toolName || 'tool';
                this.addMiniTerminalLine(`❯ ${toolName}`, 'tool');
                if (payload.arguments) {
                    try {
                        const args = typeof payload.arguments === 'string' ? JSON.parse(payload.arguments) : payload.arguments;
                        const keys = ['CommandLine', 'TargetFile', 'Query', 'SearchPath', 'AbsolutePath', 'Url', 'Instruction'];
                        for (const key of keys) {
                            if (args[key]) {
                                const val = String(args[key]);
                                const clean = val.includes('/') ? val.substring(val.lastIndexOf('/') + 1) : val;
                                this.addMiniTerminalLine(`  ${clean}`, 'arg');
                                break;
                            }
                        }
                    } catch(e) { /* ignore */ }
                }
            } else if (eventName === 'tool_finished') {
                if (payload.output) {
                    // Enqueue all output lines — RAF drain streams them at 60fps
                    const lines = String(payload.output).split(/\r?\n/).filter(l => l.trim());
                    this.enqueueTerminalLines(lines, 'output');
                } else {
                    this.addMiniTerminalLine(`✓ ${payload.toolName || 'done'}`, payload.ok ? 'success' : 'err');
                }
            } else if (eventName === 'approval_request') {
                // Show a compact waiting-for-approval prompt
                this._termQueue = [];
                this._termDraining = false;
                if (this._termRafId) { cancelAnimationFrame(this._termRafId); this._termRafId = null; }
                this.miniTerminalContainer.innerHTML = '';
                this._renderTermLine('⚠ 需要授权', 'tool');
                this._renderTermLine('  等待确认…', 'prompt');
            } else if (eventName === 'sdk_status' && payload.message) {
                this.addMiniTerminalLine(payload.message, 'sys');
            } else if (eventName === 'run_finished') {
                // Drain remaining queue then clear — no welcome text
                setTimeout(() => this.showTerminalWelcome(), 1500);
            } else if (eventName === 'run_failed') {
                this.addMiniTerminalLine('✗ failed', 'err');
                setTimeout(() => this.showTerminalWelcome(), 2000);
            }
        }

        if (eventName === 'run_started') {
            this.clearOptimisticAgentRuns();
        }

        if (!['assistant_delta', 'run_status', 'heartbeat', 'session_updated', 'run_live_changes'].includes(eventName)) {
            timelineChange = this.upsertAgentTimelineEvent(event);
        }

        // ── Always process (can transition to any state) ──

        if (eventName === 'session_ready') {
            this.agentSessionScope = payload.sessionScope || (payload.context?.globalContext || payload.context?.pageId === '__global__' ? 'global' : this.agentSessionScope || 'page');
            if (this.agentSessionScope === 'global') {
                this.agentSessionContext = {
                    pageId: '__global__',
                    version: '',
                    globalContext: true
                };
            } else if (payload.context?.pageId && payload.context?.version) {
                const resolved = this.resolvePageProject(payload.context.pageId, payload.context.version, payload.context.projectId);
                this.agentSessionContext = {
                    projectId: resolved?.project?.id || payload.context.projectId || this.activeProjectId || 'readify',
                    pageId: resolved?.page?.id || payload.context.pageId,
                    version: payload.context.version,
                    globalContext: false
                };
            }
            this.agentSessionProviderConfig = payload.providerConfig || this.agentSessionProviderConfig;
            this.agentRunState = {
                ...this.agentRunState,
                ...(payload.runState || {}),
                active: payload.runState?.active || false,
                status: payload.runState?.status || 'ready',
                stageMessage: payload.runState?.stageMessage || '已连接，等待新的任务。'
            };
            this.refreshAgentSessionsSoon();
        }

        if (eventName === 'session_updated') {
            const sessionId = payload.sessionId || event?.payload?.sessionId || this.agentSessionId;
            const index = this.agentSessionsList.findIndex((session) => session.id === sessionId);
            if (index >= 0) {
                this.agentSessionsList[index] = {
                    ...this.agentSessionsList[index],
                    title: payload.title || this.agentSessionsList[index].title,
                    updatedAt: event.createdAt || this.agentSessionsList[index].updatedAt
                };
                this.cacheAgentSessionList(this.agentSessionsList);
            }
            this.refreshAgentSessionsSoon();
        }

        if (eventName === 'run_live_changes') {
            this.scheduleAgentLiveDemoRefresh(payload);
        }

        if (eventName === 'run_started') {
            this.agentSessionScope = payload.sessionScope || (payload.context?.globalContext ? 'global' : this.agentSessionScope || 'page');
            if (payload.context?.pageId && payload.context?.version) {
                const resolved = this.resolvePageProject(payload.context.pageId, payload.context.version, payload.context.projectId);
                this.agentSessionContext = {
                    projectId: resolved?.project?.id || payload.context.projectId || this.activeProjectId || 'readify',
                    pageId: resolved?.page?.id || payload.context.pageId,
                    version: payload.context.version,
                    globalContext: Boolean(payload.context.globalContext)
                };
            }
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            if (payload.descriptor?.kind !== 'message' || !payload.descriptor?.continuation) {
                this.agentLastQuestionAnsweredAt = null;
            }
            this.syncAgentSkillFromDescriptor(payload.descriptor, { preserveExisting: true });
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                active: true,
                runId: event.runId,
                descriptor: payload.descriptor || null,
                startedAt: event.createdAt,
                finishedAt: null,
                currentTool: null,
                sdkStatusMessage: '',
                stageMessage: payload.descriptor?.summary || '任务已开始',
                lastDescriptor: payload.descriptor || this.agentRunState.lastDescriptor,
                lastError: null,
                lastSummary: null
            };
            this.refreshAgentSessionsSoon();
        }

        if (eventName === 'run_finished') {
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            this.agentActiveSkill = null;
            this.agentRunState = {
                ...this.agentRunState,
                status: payload.status || 'succeeded',
                active: false,
                currentTool: null,
                sdkStatusMessage: '',
                finishedAt: event.createdAt,
                stageMessage: payload.summary || '任务已完成',
                lastSummary: payload.summary || this.agentRunState.lastSummary,
                lastDescriptor: this.agentRunState.lastDescriptor || this.agentRunState.descriptor
            };
            this.refreshAgentSessionsSoon();
            this.refreshProjectsAfterAgentRun();
            this.cacheCurrentAgentSession();
        }

        if (eventName === 'run_failed') {
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            this.agentActiveSkill = null;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'failed',
                active: false,
                currentTool: null,
                sdkStatusMessage: '',
                finishedAt: event.createdAt,
                stageMessage: payload.reason || '任务失败',
                lastError: payload.reason || '任务失败'
            };
            this.refreshAgentSessionsSoon();
            this.cacheCurrentAgentSession();
        }

        // run_busy: server rejected a new run request because one is already active.
        // Do NOT touch agentRunState.active — the current run is still in progress.
        if (eventName === 'run_busy') {
            this.showToast(payload.reason || '当前已有任务在执行，请先等待完成或中断后再试。', true);
        }

        // ── Guarded: only process when run is active ──

        if (eventName === 'run_status' || eventName === 'heartbeat') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                ...(payload.runState || {}),
                lastActivityAt: payload.runState?.lastActivityAt || this.agentRunState.lastActivityAt,
                stageMessage: payload.summary || payload.runState?.stageMessage || this.agentRunState.stageMessage,
                sdkStatusMessage: payload.runState?.sdkStatusMessage || this.agentRunState.sdkStatusMessage || ''
            };
        }

        if (eventName === 'sdk_status') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                sdkStatusMessage: payload.message || '',
                stageMessage: payload.message || this.agentRunState.stageMessage
            };
        }

        if (eventName === 'sdk_init') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                sdkStatusMessage: '',
                stageMessage: 'SDK 已初始化'
            };
        }

        if (eventName === 'assistant_thinking') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                sdkStatusMessage: '',
                stageMessage: '模型正在思考'
            };
        }

        if (eventName === 'tool_started') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                currentTool: payload.toolName || null,
                sdkStatusMessage: '',
                stageMessage: payload.summary || `正在执行 ${payload.toolName || '工具'}`
            };
        }

        if (eventName === 'tool_finished') {
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                currentTool: null,
                sdkStatusMessage: '',
                stageMessage: payload.ok ? '工具执行完成，继续处理中…' : `${payload.toolName || '工具'} 执行失败`
            };
        }

        if (eventName === 'approval_request') {
            if (this.isAgentRunTerminal()) return;
            this.agentPendingApproval = payload.approval || null;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'waiting_approval',
                currentTool: payload.approval?.toolName || null,
                sdkStatusMessage: '',
                stageMessage: `等待你批准 ${payload.approval?.toolName || '高风险工具'}`
            };
        }

        if (eventName === 'approval_resolved') {
            if (this.agentPendingApproval?.id === payload.approval?.id) {
                this.agentPendingApproval = null;
            }
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                currentTool: payload.approval?.toolName || null,
                sdkStatusMessage: '',
                stageMessage: `${payload.approval?.toolName || '工具'} 审批已处理`
            };
        }

        if (eventName === 'question_request') {
            if (this.isAgentRunTerminal()) return;
            this.agentPendingQuestion = payload.question || null;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'waiting_user_answer',
                currentTool: null,
                sdkStatusMessage: '',
                stageMessage: '正在等待你的补充回答'
            };
        }

        if (eventName === 'question_resolved') {
            if (this.agentPendingQuestion?.id === payload.question?.id) {
                this.agentPendingQuestion = null;
            }
            this.agentLastQuestionAnsweredAt = event.createdAt || new Date().toISOString();
            if (this.isAgentRunTerminal()) return;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                sdkStatusMessage: '',
                stageMessage: '已收到你的回答，继续执行中'
            };
        }

        if (eventName === 'run_status' || eventName === 'heartbeat') {
            this.renderAgentChrome();
            this.patchLiveAgentStatus();
            this.renderAgentControls();
            return;
        }

        if (event?.type === 'assistant_message' && timelineChange?.replaced) {
            const escapedId = CSS.escape(event.id || '');
            const existing = escapedId ? this.agentTimeline?.querySelector(`[data-event-id="${escapedId}"]`) : null;
            if (existing) {
                this._pendingAssistantMessagePatches = this._pendingAssistantMessagePatches || new Map();
                this._pendingAssistantMessagePatches.set(event.id, event);
                this._scheduleAssistantMessagePatch();
                return;
            }
        }

        this.renderAgentWorkbench();
    }

    async consumeAgentStream(stream, { persistent = false } = {}) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            let boundaryIndex = buffer.indexOf('\n\n');
            while (boundaryIndex !== -1) {
                const rawEvent = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                this.handleAgentSseChunk(rawEvent);
                boundaryIndex = buffer.indexOf('\n\n');
            }

            if (done) break;
        }

        // For persistent streams (session-level SSE), try to reconnect if still active
        if (persistent && this.agentRunState.active && this.agentSessionId) {
            window.setTimeout(() => {
                this.attachAgentSessionStream();
            }, 1200);
            return;
        }

        // Stream ended but server never sent run_finished/run_failed — force terminal state
        if (this.agentRunState.active) {
            const currentStatus = this.agentRunState.status;
            this.agentRunState = {
                ...this.agentRunState,
                status: ['failed', 'interrupted'].includes(currentStatus) ? currentStatus : 'succeeded',
                active: false,
                currentTool: null,
                stageMessage: this.agentRunState.stageMessage || '任务已完成'
            };
            this.agentActiveSkill = null;
            this.cacheCurrentAgentSession();
            this.renderAgentWorkbench();
        }
    }

    handleAgentSseChunk(chunk) {
        try {
            const parsed = ReadifyAgent.Events.parseSseChunk(chunk);
            if (!parsed) return;
            this.handleAgentStreamEvent(parsed.eventName, parsed.payload);
        } catch (error) {
            console.warn('Failed to parse agent stream event:', error);
        }
    }

    async createAgentSession({ switchTo = true, title = '', sessionScope = 'global', awaitRefresh = false } = {}) {
        const data = await this.agentApi.createSession({
            ...(sessionScope === 'global' ? this.getAgentGlobalContext() : this.getAgentContext()),
            title,
            sessionScope,
            providerConfig: this.getAgentConfigDraft()
        });
        await this.loadAgentSessions();
        if (switchTo) {
            await this.switchAgentSession(data.sessionId, { skipListReload: true, awaitRefresh });
        }
        return data.sessionId;
    }

    hasMeaningfulAgentHistory(timeline = this.agentTimelineEvents) {
        return (timeline || []).some((event) => {
            if (!event) return false;
            if (event.type === 'session_ready' || event.type === 'heartbeat') return false;
            if (event.type === 'run_status' && !event.payload?.summary) return false;
            return true;
        });
    }

    findReusableAgentSessionId({ sessionScope = null, context = null } = {}) {
        const matchesScope = (session) => !sessionScope || (session?.sessionScope || 'page') === sessionScope;
        const matchesContext = (session) => {
            if (!context || sessionScope === 'global') return true;
            const sessProj = session?.projectId || 'readify';
            const ctxProj = context?.projectId || 'readify';
            return sessProj === ctxProj && session?.pageId === context.pageId && session?.version === context.version;
        };
        const currentSession = (this.agentSessionsList || []).find((session) => session.id === this.agentSessionId);
        if (
            this.agentSessionId
            && !this.hasMeaningfulAgentHistory()
            && matchesScope(currentSession || { sessionScope: this.agentSessionScope })
            && matchesContext(currentSession || this.agentSessionContext)
        ) {
            return this.agentSessionId;
        }
        const reusable = (this.agentSessionsList || []).find((session) => {
            if (session.archived) return false;
            if (session.status && session.status !== 'ready' && session.status !== 'disconnected') return false;
            if (!matchesScope(session)) return false;
            if (!matchesContext(session)) return false;
            if (session.id === this.agentSessionId) return false;
            const title = String(session.title || '');
            const summary = String(session.lastSummary || '');
            return title.includes('新会话') || title.includes('新增页面') || summary === '尚未建立会话' || summary === '已连接，等待新的任务' || session.hasHistory === false;
        });
        return reusable?.id || null;
    }

    async switchAgentSession(sessionId, { skipListReload = false, forceRefresh = false, awaitRefresh = false } = {}) {
        if (!sessionId) return;
        if (!forceRefresh && sessionId === this.agentSessionId && this.agentTimelineEvents.length) {
            this.renderAgentWorkbench();
            return;
        }
        this.detachAgentSessionStream();
        if (this.agentEventStreamAbortController) {
            this.agentEventStreamAbortController.abort();
            this.agentEventStreamAbortController = null;
        }
        this.agentSessionId = sessionId;
        this.agentAutoScroll = true; // Reset auto-scroll to true when switching sessions
        this.writeAgentStorage('session-id', sessionId);
        const listSession = (this.agentSessionsList || []).find((session) => session.id === sessionId);
        const optimisticData = this.createAgentHistoryFromSessionListItem(listSession, sessionId);
        if (optimisticData) {
            this.hydrateAgentHistory(optimisticData);
        } else {
            this.agentTimelineEvents = [];
            this.agentRunState = this.getDefaultAgentRunState();
            this.agentSessionContext = null;
            this.agentSessionScope = listSession?.sessionScope || 'page';
            this._needsFullTimelineRebuild = true;
        }
        this.agentTimelineLoading = true;
        this.markAgentSessionListActive(sessionId);
        this.renderAgentChrome();
        this.updateAgentContextLabel();
        this.renderAgentControls();
        this._scheduleAgentTimelinePatch();
        const refreshPromise = this.refreshSwitchedAgentSession(sessionId, { skipListReload }).catch((error) => {
            console.warn('Failed to refresh switched agent session:', error);
            if (sessionId === this.agentSessionId) {
                this.agentTimelineLoading = false;
                this._scheduleAgentTimelinePatch();
            }
            if (!listSession) {
                this.showToast('无法加载历史会话', true);
            }
        });
        if (awaitRefresh) {
            await refreshPromise;
        }
    }

    markAgentSessionListActive(sessionId) {
        if (!this.agentSessionList) return;
        this.agentSessionList.querySelectorAll('.agent-session-item').forEach((item) => {
            const button = item.querySelector('[data-agent-session-id]');
            item.classList.toggle('is-active', button?.dataset.agentSessionId === sessionId);
        });
    }

    createAgentHistoryFromSessionListItem(session, sessionId = '') {
        if (!session) return null;
        const sessionScope = session.sessionScope || (session.pageId === '__global__' ? 'global' : 'page');
        const globalContext = sessionScope === 'global' || session.pageId === '__global__';
        return {
            sessionId: session.id || sessionId,
            timeline: [],
            context: globalContext
                ? this.getAgentGlobalContext()
                : {
                    projectId: this.resolvePageProject(session.pageId || this.activePageId, session.version || this.activeVersion, session.projectId)?.project?.id
                        || session.projectId
                        || this.activeProjectId
                        || 'readify',
                    pageId: session.pageId || this.activePageId,
                    version: session.version || this.activeVersion,
                    globalContext: false
                },
            sessionScope,
            providerConfig: session.providerConfig || this.agentSessionProviderConfig || this.getAgentConfigDraft(),
            runState: {
                ...this.getDefaultAgentRunState(),
                status: session.status || 'ready',
                stageMessage: session.lastSummary || '正在加载历史会话…',
                active: ['running', 'waiting_approval', 'waiting_user_answer'].includes(session.status)
            }
        };
    }

    async refreshSwitchedAgentSession(sessionId, { skipListReload = false } = {}) {
        let data = null;
        try {
            data = await this.agentApi.getSessionHistory(sessionId);
            this.cacheAgentSessionHistory(sessionId, data);
        } catch (error) {
            data = this.getCachedAgentSessionHistory(sessionId);
            if (!data) throw error;
        }
        if (sessionId !== this.agentSessionId) return;
        this.agentTimelineLoading = false;
        this.hydrateAgentHistory(data);
        this.renderAgentWorkbench();
        const isGlobalSession = data.sessionScope === 'global' || data.context?.globalContext || data.context?.pageId === '__global__';
        const targetPageId = isGlobalSession ? null : (data.context?.pageId || this.activePageId);
        const targetVersion = isGlobalSession ? null : (data.context?.version || this.activeVersion);
        const resolvedTarget = isGlobalSession ? null : this.resolvePageProject(targetPageId, targetVersion, data.context?.projectId);
        const targetProjectId = isGlobalSession ? null : (resolvedTarget?.project?.id || data.context?.projectId || this.activeProjectId);
        const sameVisiblePage = targetProjectId === this.activeProjectId
            && targetPageId === this.activePageId
            && targetVersion === this.activeVersion;
        if (
            targetPageId
            && targetVersion
            && !sameVisiblePage
            && (targetProjectId !== this.activeProjectId || targetPageId !== this.activePageId || targetVersion !== this.activeVersion)
        ) {
            this.switchPage(targetPageId, targetVersion, { skipPrdDraftCheck: true, projectId: targetProjectId }).catch((error) => {
                console.warn('Failed to switch page after session switch:', error);
            });
        }
        if (!skipListReload) {
            this.loadAgentSessions()
                .then(() => this.renderAgentWorkbench())
                .catch(() => {});
        }
        if (this.agentRunState.active) {
            this.attachAgentSessionStream();
        }
    }

    async archiveAgentSessionById(sessionId, restore = false) {
        if (!sessionId) return;
        await this.agentApi.archiveSession(sessionId, { restore });
        if (sessionId === this.agentSessionId && !restore) {
            const fallback = this.agentSessionsList.find((session) => session.id !== sessionId && !session.archived);
            if (fallback) {
                await this.switchAgentSession(fallback.id, { skipListReload: true });
            } else {
                this.agentSessionId = null;
                this.agentSessionProviderConfig = null;
                this.writeAgentStorage('session-id', null);
                this.agentTimelineEvents = [];
                this.agentRunState = this.getDefaultAgentRunState();
            }
        }
        await this.loadAgentSessions();
        this.renderAgentWorkbench();
    }

    async archiveCurrentAgentSession() {
        if (!this.agentSessionId) return;
        if (this.agentRunState.active) {
            this.showToast('请先停止当前任务，再归档会话。', true);
            return;
        }
        await this.archiveAgentSessionById(this.agentSessionId);
    }

    toggleAgentSessionMenu(moreButton) {
        const item = moreButton.closest('.agent-session-item');
        const existing = item?.querySelector('.agent-session-item__dropdown');
        if (existing) {
            existing.remove();
            item?.classList.remove('is-menu-open');
            return;
        }
        this.closeAllAgentSessionMenus();
        const sessionId = moreButton.dataset.agentSessionMore || '';
        const dropdown = document.createElement('div');
        dropdown.className = 'agent-session-item__dropdown';
        dropdown.innerHTML = `<button type="button" class="agent-session-item__dropdown-item" data-agent-session-delete="${this.escapeHtml(sessionId)}">删除会话</button>`;
        item?.appendChild(dropdown);
        item?.classList.add('is-menu-open');
    }

    closeAllAgentSessionMenus() {
        this.agentSessionList?.querySelectorAll('.agent-session-item__dropdown').forEach((el) => el.remove());
        this.agentSessionList?.querySelectorAll('.agent-session-item.is-menu-open').forEach((el) => el.classList.remove('is-menu-open'));
    }

    async deleteAgentSessionById(sessionId) {
        if (!sessionId) return;
        this.removeCachedAgentSession(sessionId);
        // Optimistically remove from local list cache
        const updatedList = this.getCachedAgentSessionList().filter((s) => s.id !== sessionId);
        this.cacheAgentSessionList(updatedList);
        try {
            await this.agentApi.deleteSession(sessionId);
        } catch (error) { /* server may be down */ }
        if (sessionId === this.agentSessionId) {
            this.agentSessionId = null;
            this.agentSessionProviderConfig = null;
            this.writeAgentStorage('session-id', null);
            this.agentTimelineEvents = [];
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            this.agentRunState = this.getDefaultAgentRunState();
            const fallback = this.agentSessionsList.find((session) => session.id !== sessionId && !session.archived);
            if (fallback) {
                await this.switchAgentSession(fallback.id, { skipListReload: true });
            }
        }
        await this.loadAgentSessions();
        this.renderAgentWorkbench();
    }

    async restoreAgentSession() {
        if (!this.agentSessionId) {
            const latest = this.agentSessionsList.find((session) => !session.archived);
            if (latest) {
                this.agentSessionId = latest.id;
                this.writeAgentStorage('session-id', latest.id);
            }
        }

        if (!this.agentSessionId) {
            try {
                await this.createAgentSession({ switchTo: true });
            } catch (error) {
                this.agentRunState = this.getDefaultAgentRunState();
                this.renderAgentWorkbench();
            }
            return;
        }

        const cached = this.getCachedAgentSessionHistory(this.agentSessionId);
        if (cached) {
            this.hydrateAgentHistory(cached);
            this.renderAgentWorkbench({ deferHeavy: !this.agentWorkbenchOpen });
        }

        try {
            const data = await this.agentApi.getSessionHistory(this.agentSessionId);
            this.cacheAgentSessionHistory(this.agentSessionId, data);
            this.hydrateAgentHistory(data);
            this.loadAgentSessions({ prewarm: false })
                .then(() => {
                    if (this.agentWorkbenchOpen) this.renderAgentSessionList();
                })
                .catch(() => {});
            if (this.agentRunState.active) {
                this.attachAgentSessionStream();
            }
        } catch (error) {
            // Server unavailable — try local cache
            if (cached) {
                // Offline fallback: can't reconnect, force inactive if hydrate left active=true
                if (this.agentRunState.active) {
                    this.agentRunState = {
                        ...this.agentRunState,
                        active: false,
                        status: 'disconnected',
                        stageMessage: '服务器不可用，上次运行状态已缓存。'
                    };
                    this.agentActiveSkill = null;
                }
            } else {
                this.agentRunState = {
                    ...this.getDefaultAgentRunState(),
                    status: 'disconnected',
                    stageMessage: 'Agent Gateway 未启动，历史对话已缓存。启动后可正常交互。',
                    lastError: 'Gateway 未启动'
                };
            }
        }

        this.renderAgentWorkbench();
    }

    async ensureAgentSession({ sessionScope = 'global' } = {}) {
        if (this.agentSessionId && (this.agentSessionScope || 'page') === sessionScope) {
            return this.agentSessionId;
        }
        const reusableSessionId = this.findReusableAgentSessionId({
            sessionScope,
            context: sessionScope === 'page' ? this.getAgentContext() : null
        });
        if (reusableSessionId) {
            await this.switchAgentSession(reusableSessionId);
            return reusableSessionId;
        }
        return this.createAgentSession({ switchTo: true, sessionScope });
    }

    getCurrentAgentSessionScope() {
        if (this.agentSessionScope) return this.agentSessionScope;
        if (this.agentSessionContext?.globalContext || this.agentSessionContext?.pageId === '__global__') return 'global';
        return 'page';
    }

    async ensureCurrentAgentSession() {
        if (this.agentSessionId) return this.agentSessionId;
        return this.ensureAgentSession({ sessionScope: this.getCurrentAgentSessionScope() });
    }

    async detachAgentSessionStream() {
        if (this.agentSessionStreamAbortController) {
            this.agentSessionStreamAbortController.abort();
            this.agentSessionStreamAbortController = null;
        }
    }

    async attachAgentSessionStream() {
        if (!this.agentSessionId || !this.agentRunState.active || this.agentSessionStreamAbortController) return;
        try {
            const controller = new AbortController();
            this.agentSessionStreamAbortController = controller;
            const response = await this.agentApi.openSessionStream(this.agentSessionId, {
                signal: controller.signal
            });
            await this.consumeAgentStream(response.body, { persistent: true });
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.warn('Failed to attach agent session stream:', error);
            }
        } finally {
            this.agentSessionStreamAbortController = null;
        }
    }

    async clearAgentSession() {
        if (this.agentRunState.active) {
            this.showToast('请先停止当前任务，再清空会话。', true);
            return;
        }

        await this.detachAgentSessionStream();
        if (this.agentEventStreamAbortController) {
            this.agentEventStreamAbortController.abort();
            this.agentEventStreamAbortController = null;
        }

        const currentId = this.agentSessionId;
        if (!currentId) return;
        await this.deleteAgentSessionById(currentId);
        if (!this.agentSessionId) {
            await this.createAgentSession({ switchTo: true });
        }
    }

    async clearSdkConversation() {
        if (this.agentRunState.active) {
            this.showToast('请先停止当前任务，再清空上下文。', true);
            return;
        }
        const sessionId = await this.ensureCurrentAgentSession();
        try {
            await this.agentApi.clearSdkConversation(sessionId);
            this.agentTimelineEvents = [];
            this.agentSessionProviderConfig = this.getAgentConfigDraft();
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            this.agentActiveSkill = null;
            this.agentRunState = {
                ...this.getDefaultAgentRunState(),
                status: 'ready',
                stageMessage: 'SDK 上下文已清空，等待新的任务'
            };
            this._needsFullTimelineRebuild = true;
            this.showToast('SDK 上下文已清空');
            await this.loadAgentSessions();
            this.renderAgentWorkbench();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.showToast(message || '清空 SDK 上下文失败', true);
        }
    }

    async updateSdkAgentModel(model) {
        if (!model) return;
        try {
            const sessionId = await this.ensureCurrentAgentSession();
            await this.agentApi.setModel(sessionId, model);
        } catch (error) {
            console.warn('Failed to call agent.setModel:', error);
        }
    }

    async updateSdkAgentProvider(providerConfig = this.getAgentConfigDraft()) {
        try {
            const sessionId = await this.ensureCurrentAgentSession();
            await this.agentApi.setProvider(sessionId, providerConfig);
            return true;
        } catch (error) {
            console.warn('Failed to call agent provider switch:', error);
            return false;
        }
    }

    getActivePermissionMode() {
        const active = this.getActiveProvider();
        return active?.sdkOptions?.permissionMode || this.agentConfig?.sdkOptions?.permissionMode || 'default';
    }

    async updateSdkPermissionMode(permissionMode) {
        const mode = String(permissionMode || '').trim();
        const allowed = new Set(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']);
        if (!allowed.has(mode)) {
            this.showToast('权限模式可选：default / acceptEdits / dontAsk / bypassPermissions / plan', true);
            return;
        }
        const active = this.getActiveProvider();
        if (active) {
            active.sdkOptions = {
                ...(active.sdkOptions || {}),
                permissionMode: mode
            };
            this.agentConfig = this.buildAgentConfigFromActiveProvider();
            this.persistProviders();
            this.syncAgentConfigForm();
        }
        try {
            const sessionId = await this.ensureCurrentAgentSession();
            await this.agentApi.setPermissionMode(sessionId, mode);
        } catch (error) {
            console.warn('Failed to call agent.setPermissionMode:', error);
        }
        this.renderPermissionLabel();
        this.showToast(`SDK 权限模式已切换为 ${mode}`);
    }

    parseSlashCommand(rawInput) {
        const raw = String(rawInput || '').trim();
        if (!raw.startsWith('/')) return null;
        const withoutSlash = raw.slice(1).trim();
        if (!withoutSlash) return null;
        const [id, ...rest] = withoutSlash.split(/\s+/);
        const command = this.getAgentCommand(id);
        if (!command) return null;
        return {
            command,
            argumentsText: rest.join(' ').trim()
        };
    }

    rememberAgentCommand(commandId) {
        if (!commandId) return;
        const next = [commandId, ...(this.agentRecentCommands || []).filter((id) => id !== commandId)].slice(0, 8);
        this.agentRecentCommands = next;
        this.writeAgentStorage('recent-commands', next);
    }

    async executeSlashCommandById(commandId) {
        const command = this.getAgentCommand(commandId);
        if (!command) return;
        const value = this.agentInput?.value || '';
        let argumentsText = '';
        const parsed = this.parseSlashCommand(value);
        if (parsed && parsed.command.id === command.id) {
            argumentsText = parsed.argumentsText;
        } else {
            argumentsText = value.startsWith('/') ? value.slice(1 + command.id.length).trim() : value.trim();
        }
        this.agentSelectedCommandIndex = 0;
        await this.executeSlashCommand(command, argumentsText);
    }

    async executeSlashCommand(command, argumentsText = '') {
        const args = String(argumentsText || '').trim();
        const attachmentPayloads = this.getAgentAttachmentPayloads();
        const hasAttachments = attachmentPayloads.length > 0;
        this.rememberAgentCommand(command.id);
        this.closeAgentCommandMenu();

        if (command.argumentMode === 'required-text' && !args && !hasAttachments && !this.agentPrdContext) {
            this.showToast(`命令 /${command.id} 需要补充参数。`, true);
            return;
        }

        if (command.id === 'new') {
            this.agentInput.value = '';
            await this.startNewAgentSessionFlow();
            return;
        }

        if (command.id === 'history') {
            this.agentInput.value = '';
            this.openAgentWorkbench();
            this.agentSessionDrawerOpen = true;
            this.renderAgentWorkbench();
            this.agentSessionSearchOpen = true;
            this.agentSessionSidebarHeader?.classList.add('is-searching');
            this.agentSessionSearchToggle?.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => this.agentSessionSearchInput?.focus());
            return;
        }

        if (command.id === 'clear') {
            this.agentInput.value = '';
            await this.clearSdkConversation();
            return;
        }

        if (command.id === 'delete-session') {
            this.agentInput.value = '';
            await this.clearAgentSession();
            return;
        }

        if (command.id === 'retry') {
            this.agentInput.value = '';
            await this.retryAgentRun();
            return;
        }

        if (command.id === 'interrupt') {
            this.agentInput.value = '';
            await this.interruptAgentRun();
            return;
        }

        if (command.id === 'model') {
            this.agentInput.value = '';
            if (!args) {
                const currentModel = this.getAgentConfigDraft().model || '未指定';
                const active = this.getActiveProvider();
                const models = Array.from(new Set((active?.models || []).concat(this.getAgentPreset(active?.presetId)?.models || []))).filter(Boolean);
                this.showAgentChoicePrompt({
                    choiceType: 'model',
                    title: '切换模型',
                    summary: `当前模型：${currentModel}`,
                    options: models.map((model) => ({
                        value: model,
                        label: model === currentModel ? `${model} (当前)` : model
                    }))
                });
                return;
            }
            await this.applyAgentModelChoice(args);
            return;
        }

        if (command.id === 'permission') {
            this.agentInput.value = '';
            if (!args) {
                const mode = this.getActivePermissionMode();
                this.showAgentChoicePrompt({
                    choiceType: 'permission',
                    title: '权限模式',
                    summary: `当前权限模式：${mode}`,
                    options: ['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan'].map((item) => ({
                        value: item,
                        label: item === mode ? `${item} (当前)` : item
                    }))
                });
                return;
            }
            await this.updateSdkPermissionMode(args);
            return;
        }

        if (command.id === 'provider') {
            this.agentInput.value = '';
            if (!args) {
                const active = this.getActiveProvider();
                const savedOptions = this.agentSavedProviders.map((provider) => ({
                    value: provider.id,
                    label: provider.id === active?.id ? `${provider.label} (当前)` : provider.label
                }));
                const presetOptions = (this.agentProviderPresets?.providers || AGENT_PROVIDER_PRESET_FALLBACK.providers).map((preset) => ({
                    value: preset.id,
                    label: `模板：${preset.label}`
                }));
                this.showAgentChoicePrompt({
                    choiceType: 'provider',
                    title: '切换 Provider',
                    summary: `当前 Provider：${active?.label || this.agentConfig.provider || '未配置'}`,
                    options: [...savedOptions, ...presetOptions]
                });
                return;
            }
            const normalizedId = normalizeAgentProviderId(args);
            const existing = this.agentSavedProviders.find((provider) => (
                provider.id === normalizedId ||
                provider.presetId === normalizedId ||
                provider.label === args
            ));
            await this.applyAgentProviderChoice(existing?.id || normalizedId);
            return;
        }

        if (command.kind === 'skill' && command.skillId) {
            const skill = this.getAgentSkill(command.skillId);
            this.agentActiveSkill = skill || null;
            this.openAgentWorkbench();

            const desiredSessionScope = skill?.globalContext ? 'global' : 'page';
            await this.ensureAgentSession({ sessionScope: desiredSessionScope });

            let skillMessage = args;
            if (command.id === 'iterate' && !args) {
                skillMessage = '请按迭代版本流程生成下一版页面方案并落地。';
            }

            if (this.agentInput) {
                this.agentInput.value = skillMessage;
            }

            this.renderAgentWorkbench();
            this.agentInput?.focus();
            if (skillMessage) {
                this.agentInput?.select();
            }
            return;
        }

        if (command.localOnly) return;

        this.agentInput.value = '';
        let finalArgs = args;
        const prdContextMsg = this.formatAgentPrdContextMessage();
        if (prdContextMsg) {
            finalArgs = prdContextMsg + '\n\n' + finalArgs;
        }
        this.clearAgentPrdContext();
        this.clearAgentAttachments();
        await this.startAgentRun('command', {
            commandId: command.id,
            arguments: finalArgs,
            attachments: attachmentPayloads
        });
    }

    async submitAgentMessage() {
        const message = this.agentInput?.value.trim() || '';
        const contextState = this.getAgentContextDeletionState(this.agentSessionContext || this.getAgentContext(), this.agentActiveSkill);
        const attachmentPayloads = this.getAgentAttachmentPayloads();
        const hasAttachments = attachmentPayloads.length > 0;

        if (this.agentPendingQuestion) {
            if (hasAttachments) {
                this.showToast('当前追问先用文字回答，图片可在下一轮发送。', true);
                return;
            }
            await this.answerAgentQuestion(message);
            this.agentInput.value = '';
            return;
        }

        if (this.agentRunState.active) return;
        if (contextState.blocked && !this.agentActiveSkill?.globalContext) {
            this.showToast(contextState.reason, true);
            return;
        }

        const slashCommand = this.parseSlashCommand(message);
        if (slashCommand) {
            await this.executeSlashCommand(slashCommand.command, slashCommand.argumentsText);
            return;
        }

        if (this.agentCommandMenuOpen) {
            const selectedCommand = this.flattenAgentCommandsForSelection()[this.agentSelectedCommandIndex];
            if (selectedCommand) {
                const argumentsText = message.startsWith('/') ? message.slice(1 + selectedCommand.id.length).trim() : message.trim();
                await this.executeSlashCommand(selectedCommand, argumentsText);
            }
            return;
        }

        const activeSkill = this.agentActiveSkill;
        const continueAnsweredQuestionThread = !activeSkill && this.shouldContinueAnsweredQuestionThread();
        const nextMessage = message || activeSkill?.defaultStarter || (hasAttachments ? '请基于上传图片生成或调整当前原型。' : (this.agentPrdContext ? '请基于该 PRD 上下文生成或调整当前原型。' : ''));
        if (!nextMessage && this.feedbackItems.length === 0 && !hasAttachments && !this.agentPrdContext) return;
        if (activeSkill?.requiresMessage && !message && !hasAttachments) {
            this.showToast('这个 Skill 需要你先补充具体要求再发送。', true);
            return;
        }

        // Build combined message: feedback items + free text
        let finalMessage = nextMessage;
        if (this.feedbackItems.length > 0) {
            const feedbackParts = this.feedbackItems.map((item, index) => {
                const ctx = item.elementContext || {};
                const lines = [
                    `### 反馈 #${index + 1}`,
                    ``,
                    `**选择器**: \`${item.selector}\``,
                    `**元素**: \`<${(ctx.tagName || 'unknown').toLowerCase()}>\``,
                ];
                if (ctx.id) lines.push(`**ID**: \`#${ctx.id}\``);
                if (ctx.className) lines.push(`**类名**: \`${ctx.className}\``);
                if (ctx.textContent) lines.push(`**文本内容**: "${ctx.textContent.substring(0, 100)}"`);
                lines.push(
                    ``,
                    `**用户期望变更**:`,
                    item.description,
                    ``,
                    `**元素 HTML**:`,
                    '```html',
                    ctx.htmlSnippet || '(无法获取)',
                    '```',
                    ``,
                    `**关键样式**:`,
                    '```css'
                );
                Object.entries(ctx.relevantStyles || {}).forEach(([k, v]) => {
                    lines.push(`${k}: ${v};`);
                });
                lines.push('```');
                if (ctx.parentHtmlSnippet) {
                    lines.push(
                        ``,
                        `**父级元素 HTML**:`,
                        '```html',
                        ctx.parentHtmlSnippet,
                        '```'
                    );
                }
                lines.push('---');
                return lines.join('\n');
            });

            const header = [
                `## 页面元素反馈`,
                ``,
                `页面: \`${this.activePageId}/${this.activeVersion}\``,
                `共 ${this.feedbackItems.length} 个元素需要修改:`,
                ``
            ].join('\n');

            const feedbackText = header + feedbackParts.join('\n\n');
            finalMessage = nextMessage
                ? feedbackText + '\n\n### 补充说明\n\n' + nextMessage
                : feedbackText;

            this.feedbackItems = [];
            this.renderFeedbackPanel();
        }

        const prdContextMsg = this.formatAgentPrdContextMessage();
        const prdContext = this.agentPrdContext
            ? { type: this.agentPrdContext.type, name: this.agentPrdContext.name }
            : null;
        if (prdContextMsg) {
            finalMessage = prdContextMsg + '\n\n' + finalMessage;
        }
        const internalInstructions = this.getNewPageExecutionInstructions();
        this.clearAgentPrdContext();

        this.agentInput.value = '';
        this.clearAgentAttachments();
        this.closeAgentCommandMenu();
        this.openAgentWorkbench();
        if (activeSkill) {
            await this.startAgentRun('skill', {
                skillId: activeSkill.id,
                message: finalMessage,
                internalInstructions,
                attachments: attachmentPayloads,
                prdContext
            });
            return;
        }
        await this.startAgentRun('message', {
            message: finalMessage,
            attachments: attachmentPayloads,
            prdContext,
            continuation: continueAnsweredQuestionThread
        });
    }

    async runAgentDebugScenario(scenario) {
        if (!this.agentDebugMode || this.agentRunState.active) return;
        this.openAgentWorkbench();
        await this.startAgentRun('dev-simulate', { scenario });
    }

    async startAgentRun(kind, payload = {}) {
        try {
            if (this.selectedProviderId === this.activeProviderId) {
                if (this.parseAgentSdkOptions({ showError: true }) === null) {
                    throw new Error('SDK Options JSON 格式无效');
                }
                this.handleAgentConfigInput();
            }
            this.agentSkillMenuOpen = false;
            const globalRun = this.isAgentGlobalRun(kind, payload);
            let runContext = globalRun ? this.getAgentGlobalContext() : this.getAgentContext();
            if (!globalRun && this.agentSessionContext) {
                runContext = this.agentSessionContext;
            }
            const contextState = this.getAgentContextDeletionState(runContext, kind === 'skill' ? this.getAgentSkill(payload.skillId) : this.agentActiveSkill);
            if (contextState.blocked && !(kind === 'skill' && this.getAgentSkill(payload.skillId)?.globalContext)) {
                throw new Error(contextState.reason);
            }
            await this.detachAgentSessionStream();
            const desiredSessionScope = globalRun ? 'global' : 'page';
            const sessionId = await this.ensureAgentSession({ sessionScope: desiredSessionScope });
            const endpoint = ReadifyAgent.RunRoutes.pathFor(sessionId, kind, payload);
            const controller = new AbortController();
            this.agentEventStreamAbortController = controller;

            const optimisticRun = this.addOptimisticAgentRun(kind, payload);
            this.agentPendingApproval = null;
            this.agentPendingQuestion = null;
            this.agentRunState = {
                ...this.agentRunState,
                status: 'running',
                active: true,
                runId: optimisticRun.runId,
                descriptor: optimisticRun.descriptor,
                currentTool: null,
                startedAt: optimisticRun.createdAt,
                finishedAt: null,
                stageMessage: kind === 'skill'
                    ? `正在发起 ${this.getAgentSkill(payload.skillId)?.label || 'Skill'}…`
                    : kind === 'command'
                        ? `正在执行 /${payload.commandId || 'command'}…`
                    : kind === 'dev-simulate'
                        ? '正在启动开发模拟流…'
                        : '正在发起对话请求…'
            };
            this.renderAgentWorkbench();
            this.scrollAgentTimelineToLatest(true, true);

            const response = await this.agentApi.startRunByPath(endpoint, {
                    ...runContext,
                    providerConfig: this.getAgentConfigDraft(),
                    ...payload
                }, {
                    signal: controller.signal
            });

            await this.consumeAgentStream(response.body);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            const message = error instanceof Error ? error.message : String(error);
            this.agentRunState = {
                ...this.agentRunState,
                status: 'failed',
                active: false,
                stageMessage: message,
                lastError: message
            };
            this.showToast(message || 'Agent Gateway 不可用或配置无效，请检查 8081 服务与 Provider 配置', true);
            this.renderAgentWorkbench();
        } finally {
            this.agentEventStreamAbortController = null;
        }
    }

    async interruptAgentRun() {
        if (!this.agentSessionId || !this.agentRunState.active) return;
        this.agentPendingApproval = null;
        this.agentPendingQuestion = null;
        this.agentActiveSkill = null;
        this.agentRunState = {
            ...this.agentRunState,
            status: 'interrupted',
            active: false,
            finishedAt: new Date().toISOString(),
            stageMessage: '正在中断当前任务…',
            currentTool: null,
            lastSummary: '用户已中断当前任务'
        };
        this.renderAgentWorkbench();
        try {
            await this.agentApi.interrupt(this.agentSessionId);
        } catch (error) {
            this.showToast('中断请求失败，请检查 Agent Gateway。', true);
        }
    }

    async retryAgentRun() {
        const descriptor = this.agentRunState.lastDescriptor;
        if (!descriptor || this.agentRunState.active) return;

        if (descriptor.kind === 'skill') {
            this.syncAgentSkillFromDescriptor(descriptor, { preserveExisting: true });
            await this.startAgentRun('skill', {
                skillId: descriptor.skillId,
                message: descriptor.message || this.getAgentSkill(descriptor.skillId)?.defaultStarter || ''
            });
            return;
        }

        if (descriptor.kind === 'message') {
            await this.startAgentRun('message', { message: descriptor.message || descriptor.summary || '' });
            return;
        }

        if (descriptor.kind === 'dev-simulate') {
            await this.startAgentRun('dev-simulate', { scenario: descriptor.scenario || 'full_flow' });
            return;
        }

        if (descriptor.kind === 'command') {
            await this.startAgentRun('command', {
                commandId: descriptor.commandId,
                arguments: descriptor.arguments || ''
            });
        }
    }

    async resolveAgentApproval(decision) {
        if (!this.agentSessionId || !this.agentPendingApproval?.id) return;
        try {
            await this.agentApi.resolveApproval(this.agentSessionId, this.agentPendingApproval.id, decision);
        } catch (error) {
            this.showToast('提交审批决策失败，请稍后重试。', true);
        }
    }

    async answerAgentQuestion(answer) {
        if (!this.agentSessionId || !this.agentPendingQuestion?.id) return;
        try {
            await this.agentApi.answerQuestion(this.agentSessionId, this.agentPendingQuestion.id, answer);
        } catch (error) {
            this.showToast('提交回答失败，请稍后重试。', true);
        }
    }

    async testAgentConnection() {
        const draft = this.getAgentConfigDraft({ source: 'selected' });
        try {
            if (this.parseAgentSdkOptions({ showError: true }) === null) {
                throw new Error('SDK Options JSON 格式无效');
            }
            this.handleAgentConfigInput();
            this.agentTestingConnection = true;
            this.agentConnectionTestResult = null;
            if (this.miniTerminalContainer) {
                this.miniTerminalContainer.innerHTML = '';
                this.addMiniTerminalLine('[SYS] TEST CONN START');
                this.addMiniTerminalLine('[SYS] AUTH PING...');
            }
            this.renderAgentWorkbench();

            const result = await this.agentApi.testConnection(draft);
            this.agentConnectionTestResult = result;
            this.updateAgentConfigHint(result?.ok
                ? '连接测试成功。'
                : (result?.message || '连接测试失败，请按结果提示调整配置。'));

            if (this.miniTerminalContainer) {
                if (result?.ok) {
                    this.addMiniTerminalLine('[SYS] TEST SUCCESS');
                } else {
                    this.addMiniTerminalLine('[SYS] TEST FAILED');
                }
                setTimeout(() => {
                    this.showTerminalWelcome();
                }, 4000);
            }

            if (result?.ok && !this.agentRunState.active && !this.agentSessionId) {
                this.agentRunState = {
                    ...this.agentRunState,
                    status: 'ready',
                    stageMessage: '连接测试成功，可以开始对话或运行 Skill。'
                };
            }

            if (!result?.ok && !this.agentRunState.active) {
                this.agentRunState = {
                    ...this.agentRunState,
                    status: result?.classification === 'config_error' ? 'disconnected' : 'failed',
                    stageMessage: result?.message || '连接测试失败',
                    lastError: result?.message || '连接测试失败'
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (this.miniTerminalContainer) {
                this.addMiniTerminalLine('[SYS] TEST ERROR');
                setTimeout(() => {
                    this.showTerminalWelcome();
                }, 4000);
            }
            this.agentConnectionTestResult = {
                ok: false,
                classification: 'network_error',
                message,
                provider: draft.provider,
                model: draft.model,
                baseURL: draft.baseURL,
                hasApiKey: Boolean(draft.apiKey),
                httpStatus: null,
                latencyMs: null,
                rawMessage: message
            };
            this.agentRunState = {
                ...this.agentRunState,
                status: 'failed',
                stageMessage: message,
                lastError: message
            };
        } finally {
            this.agentTestingConnection = false;
            this.renderAgentChrome();
            this.renderAgentWorkbench();
            if (this.agentConnectionTestResult) {
                setTimeout(() => {
                    this.agentConnectionTestResultEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }
    }

    async checkAgentBalance() {
        const draft = this.getAgentConfigDraft({ source: 'selected' });
        if (!this.agentBalanceResultEl) return;
        try {
            this.agentCheckingBalance = true;
            this.agentBalanceResultEl.hidden = false;
            this.agentBalanceResultEl.className = 'agent-balance-result';
            this.agentBalanceResultEl.innerHTML = '正在查询用量/余额...';

            const result = await this.agentApi.getBalance(draft);
            if (result.ok) {
                this.agentBalanceResultEl.className = 'agent-balance-result';
                this.agentBalanceResultEl.innerHTML = `<strong>查询成功：</strong>${this.escapeHtml(result.message)}`;
            } else {
                this.agentBalanceResultEl.className = 'agent-balance-result is-error';
                this.agentBalanceResultEl.innerHTML = `<strong>查询失败：</strong>${this.escapeHtml(result.message)}`;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.agentBalanceResultEl.className = 'agent-balance-result is-error';
            this.agentBalanceResultEl.innerHTML = `<strong>查询出错：</strong>${this.escapeHtml(message)}`;
        } finally {
            this.agentCheckingBalance = false;
            setTimeout(() => {
                this.agentBalanceResultEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }

    async fetchAgentModels() {
        if (this.agentFetchingModels) return;
        const draft = this.getAgentConfigDraft({ source: 'selected' });
        const target = this.getSelectedProvider();
        if (!draft.baseURL || !draft.apiKey) {
            this.showToast('请先填写 Base URL 和 API Key', true);
            return;
        }
        this.agentFetchingModels = true;
        if (this.agentFetchModelsBtn) {
            this.agentFetchModelsBtn.disabled = true;
            this.agentFetchModelsBtn.textContent = '拉取中…';
        }
        this.renderAgentControls();
        try {
            const result = await this.agentApi.fetchModels(draft);
            if (!result?.ok) throw new Error(result?.message || '拉取模型失败');
            const current = this.getAgentConfigDraft({ source: 'selected' });
            if (target !== this.getSelectedProvider() || current.baseURL !== draft.baseURL
                || current.apiKey !== draft.apiKey || current.apiType !== draft.apiType) {
                this.showToast('配置已切换，请在当前配置重新拉取模型');
                return;
            }
            const models = Array.isArray(result.models) ? result.models.filter(item => typeof item === 'string' && item.trim()) : [];
            if (models.length) {
                target.model = this.getAgentModelFormValue() || target.model || '';
                target.models = [...new Set(models)];
                this.unifiedSettings?.userTouched.add('models');
                this.renderAgentModelPicker(target);
                this.unifiedSettings?.refreshDirty();
            }
            this.showToast(models.length ? `已从服务商更新 ${models.length} 个模型，保存后生效` : (result.message || '接口没有返回可用模型'));
        } catch (error) {
            this.showToast(error instanceof Error ? error.message : String(error), true);
        } finally {
            this.agentFetchingModels = false;
            if (this.agentFetchModelsBtn) {
                this.agentFetchModelsBtn.disabled = false;
                this.agentFetchModelsBtn.textContent = '拉取模型';
            }
            this.renderAgentControls();
        }
    }

    clearIframeSelection() {
        const iframeDoc = this.mainIframe.contentDocument;
        if (!iframeDoc) return;

        iframeDoc.querySelectorAll('.__readify_selected').forEach((el) => {
            el.classList.remove('__readify_selected');
        });
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async saveJumpBinding(targetPageId) {
        const selector = this.pendingAnnotation?.selector || this.jumpBindingTargetSelector;
        if (!selector) return false;

        this.annotationLinkSaving = true;
        this.refreshAnnotationLinkUI({
            status: targetPageId ? '正在建立链接…' : '正在移除链接…'
        });
        this.renderAnnotationLinkPages();
        let success = false;
        let finalStatus = '';
        let finalTone = '';

        try {
            const response = await fetch('/api/bind-jump', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: this.activeProjectId || 'readify',
                    pageId: this.activePageId,
                    version: this.activeVersion,
                    selector: selector,
                    targetPageId: targetPageId
                })
            });

            if (response.ok) {
                const element = this.pendingAnnotation?.element;
                if (element) {
                    if (targetPageId) {
                        element.setAttribute('data-link-to', targetPageId);
                    } else {
                        element.removeAttribute('data-link-to');
                    }
                }
                this.jumpBindingExistingPageId = targetPageId;
                this.jumpBindingTargetPageId = targetPageId;
                const targetPage = this.getPageRecord(targetPageId);
                finalStatus = targetPageId
                    ? `已连接至「${targetPage?.name || targetPageId}」`
                    : '链接已移除';
                finalTone = 'success';
                success = true;
            } else {
                finalStatus = '保存失败，请稍后重试';
                finalTone = 'error';
            }
        } catch (err) {
            console.error('Failed to save jump binding:', err);
            finalStatus = '无法保存，请检查服务后重试';
            finalTone = 'error';
        } finally {
            this.annotationLinkSaving = false;
            this.renderAnnotationLinkPages();
            this.refreshAnnotationLinkUI({ status: finalStatus, tone: finalTone });
        }

        return success;
    }

    handleTriggerJump(toPageId) {
        const page = (this.projects?.pages || []).find(p => p.id === toPageId && !p.deleted);
        if (!page) {
            this.showToast(`无法跳转：目标页面 ${toPageId} 不存在或已被删除`, true);
            return;
        }
        this.switchPage(toPageId).then(() => {
            this.showToast(`已跳转到页面: ${page.name || toPageId}`);
        }).catch(err => {
            this.showToast(`跳转失败: ${err.message || err}`, true);
        });
    }
}

// Initialize
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => { window.shell = new DemoShell(); });
else window.shell = new DemoShell();

/* Self-contained mobile preview fitting. Copies live beside each Demo version. */
function installProtaMobileFrameFit(win, fallback = {}) {
  const doc = win.document;
  const phone = doc.querySelector('.phone-shell');
  const stage = phone?.closest('.demo-stage');
  if (!phone || !stage || win.__protaFrameFit || win.__PROTA_DISABLE_FRAME_FIT__) return;
  win.__protaFrameFit = true;

  // Restore only frame geometry/decoration from desktop rules. Short desktop
  // windows must not activate the legacy height-based, frameless layout.
  const properties = ['width', 'height', 'padding', 'border-radius', 'box-shadow', 'background'];
  const base = { ...fallback.phone };
  const screenBase = { ...fallback.screen };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.selectorText === '.phone-shell') {
          for (const key of properties) {
            const value = rule.style.getPropertyValue(key);
            if (value) base[key] = value;
          }
        }
        if (rule.selectorText === '.phone-screen') {
          const value = rule.style.getPropertyValue('border-radius');
          if (value) screenBase['border-radius'] = value;
        }
      }
    } catch (_) { /* Remote font sheets are not readable. */ }
  }
  const declarations = values => Object.entries(values)
    .map(([key, value]) => `${key}:${value} !important;`).join('');
  const style = doc.createElement('style');
  style.id = '__prota_frame_fit';
  style.textContent = `
    html[data-prota-frame-fit] { height:100%; overflow:hidden; }
    html[data-prota-frame-fit] body { height:100%; min-height:0; margin:0; overflow:hidden; }
    html[data-prota-frame-fit] .demo-stage {
      position:relative; width:100%; height:100%; min-height:0 !important;
      padding:0 !important; overflow:hidden; display:block !important;
    }
    html[data-prota-frame-fit="desktop"] .phone-shell {
      ${declarations(base)}
      position:absolute !important; margin:0 !important; max-width:none !important;
      max-height:none !important; flex-shrink:0; left:var(--prota-phone-center, 50%); top:50%;
      transform:translate(-50%, -50%) scale(var(--prota-frame-scale, 1)) !important;
      transform-origin:center !important;
    }
    html[data-prota-frame-fit="desktop"] .phone-screen { ${declarations(screenBase)} }
    html[data-prota-frame-fit="native"] .phone-shell {
      position:absolute !important; inset:0 !important; margin:0 !important;
      width:100% !important; height:100% !important; max-width:none !important;
      max-height:none !important; padding:0 !important; border-radius:0 !important;
      box-shadow:none !important; transform:none !important;
    }
    html[data-prota-frame-fit="native"] .phone-screen { border-radius:0 !important; }
    html[data-prota-frame-fit="native"] .volume-key,
    html[data-prota-frame-fit="native"] .demo-tools { display:none !important; }
    html[data-prota-frame-fit="desktop"] .demo-stage > .demo-tools {
      position:absolute; left:var(--prota-tools-left); top:50%;
      transform:translateY(-50%); max-height:calc(100% - 48px); overflow:auto;
    }
  `;
  doc.head.appendChild(style);
  let pending = false;
  function fit() {
    pending = false;
    let host = win;
    let insidePhone = false;
    try {
      host = win.top;
      insidePhone = Boolean(win.frameElement?.closest('.phone-shell'));
    } catch (_) { host = win; }
    const native = insidePhone || (host.matchMedia('(pointer: coarse)').matches
      && host.matchMedia('(max-width: 600px)').matches);
    doc.documentElement.dataset.protaFrameFit = native ? 'native' : 'desktop';
    if (!native) {
      const width = phone.offsetWidth;
      const height = phone.offsetHeight;
      if (!width || !height) return;
      const tools = stage.querySelector(':scope > .demo-tools');
      const toolsWidth = tools && win.getComputedStyle(tools).display !== 'none' ? tools.offsetWidth : 0;
      const gap = toolsWidth ? 40 : 0;
      const scale = Math.max(0.01, Math.min(1,
        (stage.clientWidth - toolsWidth - gap - 48) / width,
        (stage.clientHeight - 48) / height));
      const center = (stage.clientWidth - toolsWidth - gap) / 2;
      phone.style.setProperty('--prota-frame-scale', String(scale));
      phone.style.setProperty('--prota-phone-center', `${center}px`);
      stage.style.setProperty('--prota-tools-left', `${center + width * scale / 2 + gap}px`);
    }
    // Existing inspector and marker observers listen to resize.
    doc.dispatchEvent(new win.CustomEvent('prota:frame-fit'));
  }
  function schedule() {
    if (!pending) { pending = true; win.requestAnimationFrame(fit); }
  }
  win.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  const observer = new win.ResizeObserver(schedule);
  observer.observe(stage);
  fit();
}
