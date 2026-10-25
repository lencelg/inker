import { computed, ref } from 'vue';

export type Language = 'zh' | 'en';
export type LanguagePreference = 'system' | Language;

export const LANGUAGE_OPTIONS = [
  { id: 'system', label: 'language.system' },
  { id: 'zh', label: 'language.zh' },
  { id: 'en', label: 'language.en' },
] as const;

export function isLanguage(value: unknown): value is Language {
  return value === 'zh' || value === 'en';
}

export function isLanguagePreference(
  value: unknown,
): value is LanguagePreference {
  return value === 'system' || isLanguage(value);
}

export function detectSystemLanguage(): Language {
  const candidates: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (navigator.language) candidates.push(navigator.language);
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
  }
  if (candidates.length === 0 && typeof Intl !== 'undefined') {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
  }
  const preferred = candidates.find((value) => Boolean(value));
  return preferred?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function resolveLanguage(
  preference: LanguagePreference,
): Language {
  return preference === 'system'
    ? detectSystemLanguage()
    : preference;
}

const initialLanguage = detectSystemLanguage();
const currentLanguage = ref<Language>(initialLanguage);
applyDocumentLanguage(initialLanguage);

export const language = computed(() => currentLanguage.value);

const zh = {
  'action.cancel': '取消',
  'action.close': '关闭',
  'action.create': '创建',
  'action.rename': '重命名',
  'action.processing': '处理中…',
  'app.retryLater': '请稍后再试。',
  'app.sidebar.resizeAria': '调整侧边栏宽度，当前 {width} 像素',
  'app.sidebar.resizeTitle': '拖动调整侧边栏宽度，双击恢复默认',
  'app.splitter.title': '拖动调整编辑区和预览区宽度，双击恢复默认',
  'app.welcome.description': '选择一个文件夹，笔记会以 .md 文件保存在其中。',
  'app.welcome.chooseFolder': '选择笔记文件夹',
  'app.error.dismiss': '关闭错误提示',
  'app.empty.title': '还没有打开笔记',
  'app.empty.description': '在左侧文件树中打开或新建一个 Markdown 文件。',
  'app.status.image': '图片',
  'nav.main': '主导航',
  'nav.files': '文件',
  'nav.explorer': '资源管理器',
  'nav.search': '搜索',
  'nav.settings': '设置',
  'window.minimize': '最小化',
  'window.maximize': '最大化',
  'window.restore': '还原',
  'window.close': '关闭',
  'menu.more': '更多',
  'menu.application': '应用菜单',
  'menu.viewMode': '渲染模式',
  'menu.export': '导出',
  'menu.vim': 'Vim 模式',
  'menu.settings': '设置',
  'export.pdf': 'PDF',
  'export.html': 'HTML',
  'export.docx': 'Word (.docx)',
  'export.contents': '目录',
  'export.html.title': '导出 HTML',
  'export.html.embedded': '内嵌图片',
  'export.html.linked': '链接图片',
  'export.html.embeddedHint':
    '图片会转换为 Data URL，生成可单独分享的单个文件。',
  'export.html.linkedHint':
    '保留原始图片路径，文件更小，但移动 HTML 时需要同时移动图片。',
  'export.html.previewNote':
    '预览使用内嵌图片的版本；保存时按所选方式处理图片。',
  'export.html.save': '保存 HTML',
  'export.html.preview': '预览',
  'export.html.size': '约 {size}',
  'export.warning.image': '无法读取图片“{source}”，已替换为占位文本。',
  'export.warning.remoteImage':
    '无法下载远程图片“{url}”，已保留原链接。',
  'export.warning.mermaid': 'Mermaid 图表渲染失败：{message}',
  'viewMode.source': '源码模式',
  'viewMode.wysiwyg': '实时预览',
  'viewMode.preview': '预览模式',
  'viewMode.side': '侧边预览',
  'tabs.openFiles': '打开的文件',
  'tabs.previewTitle': '{path}（预览标签，双击固定）',
  'tabs.unsaved': '未保存',
  'tabs.closeAria': '关闭 {name}',
  'tabs.close': '关闭',
  'prompt.newFile.title': '新建文件',
  'prompt.fileName': '文件名',
  'prompt.newFile.initial': '未命名.md',
  'prompt.newFile.placeholder': '例如：笔记.md',
  'prompt.newFolder.title': '新建文件夹',
  'prompt.folderName': '文件夹名称',
  'prompt.newFolder.placeholder': '例如：日记',
  'prompt.renameFolder.title': '重命名文件夹',
  'prompt.renameImage.title': '重命名图片',
  'prompt.renameFile.title': '重命名文件',
  'prompt.newName': '新名称',
  'prompt.renameFolder.placeholder': '文件夹名称',
  'prompt.renameImage.placeholder': '例如：cover.png',
  'prompt.renameFile.placeholder': '例如：笔记.md',
  'delete.warning': '其中有未保存的修改，删除后将无法恢复。',
  'delete.folderTitle': '删除这个文件夹？',
  'delete.fileTitle': '删除这个文件？',
  'delete.folderMessage':
    '文件夹“{name}”及其内容会移到系统回收站。{warning}',
  'delete.fileMessage': '文件“{name}”会移到系统回收站。{warning}',
  'delete.confirm': '移到回收站',
  'close.unsavedTitle': '关闭未保存的标签页？',
  'close.unsavedMessage': '“{name}”有未保存的修改，关闭后将丢失。',
  'close.discard': '不保存并关闭',
  'explorer.emptyRoot': '右键此处新建文件或文件夹。',
  'explorer.emptyNoFolder': '先选择一个文件夹来保存笔记。',
  'explorer.chooseFolder': '选择笔记文件夹',
  'explorer.newFile': '新建文件',
  'explorer.newFolder': '新建文件夹',
  'explorer.rename': '重命名',
  'explorer.delete': '删除（移到回收站）',
  'image.aria': '图片 {name}',
  'image.loading': '正在加载图片…',
  'image.errorTitle': '无法打开图片',
  'image.hint': '滚轮缩放 · 拖动平移 · 双击复位',
  'image.zoomOut': '缩小',
  'image.zoomOutAria': '缩小图片',
  'image.zoomIn': '放大',
  'image.zoomInAria': '放大图片',
  'image.resetTitle': '重置缩放和位置',
  'image.reset': '重置',
  'preview.imageFallback': '图片',
  'preview.imageMissing': '{alt}（无法加载）',
  'preview.imageLoadFailed': '图片加载失败：{message}',
  'preview.mermaidFailed': 'Mermaid 渲染失败：{message}',
  'preview.empty': '开始输入 Markdown，预览会实时更新。',
  'print.aria': '打印预览：{title}',
  'print.hint': '在打印对话框中选择“打印到文件”即可保存为 PDF。',
  'print.action': '打印 / 另存为 PDF',
  'print.iframeTitle': '{title} 打印预览',
  'search.title': '搜索',
  'search.searching': '搜索中…',
  'search.placeholder': '搜索笔记',
  'search.clear': '清除搜索',
  'search.chooseFolder': '请先在文件视图中选择笔记文件夹。',
  'search.hint': '搜索所有 Markdown 笔记的内容。',
  'search.noResults': '没有找到匹配项。',
  'search.truncated': '结果过多，仅显示前 500 条。',
  'status.vimAria': 'Vim 模式：{mode}',
  'status.immersive': '沉浸式写作（Ctrl+Shift+M）',
  'status.focus': '专注',
  'status.vimCommand': 'Vim 命令输入',
  'status.switchMode': '切换编辑模式',
  'status.lineColumn': '行 {line}, 列 {column}',
  'status.spaces': '空格: 4',
  'status.editorMode': '编辑模式',
  'status.wysiwygHint': '编辑时会规范化 Markdown 格式',
  'wysiwyg.showChart': '图表',
  'wysiwyg.showSource': '源码',
  'wysiwyg.rendering': '正在渲染图表…',
  'wysiwyg.renderFailed': '图表渲染失败：{message}',
  'wysiwyg.insertImageFailed': '当前位置无法插入图片',
  'wysiwyg.imageAlt': '图片',
  'editor.placeholder': '从这里开始写…',
  'editor.markdownContent': 'Markdown 内容',
  'settings.title': '设置',
  'settings.searchPlaceholder': '搜索设置',
  'settings.search': '搜索设置',
  'settings.clearSearch': '清除搜索',
  'settings.filterModified': '仅显示已修改的设置',
  'settings.minimize': '最小化',
  'settings.minimizeWindow': '最小化窗口',
  'settings.restore': '还原',
  'settings.maximize': '最大化',
  'settings.restoreWindow': '还原窗口',
  'settings.maximizeWindow': '最大化窗口',
  'settings.close': '关闭设置',
  'settings.nav': '设置导航',
  'settings.scope': '设置范围',
  'settings.user': '用户',
  'settings.workspace': '工作区',
  'settings.categories': '设置分类',
  'settings.collapseCategory': '折叠分类',
  'settings.expandCategory': '展开分类',
  'settings.workspaceTitle': '工作区设置',
  'settings.workspaceEmpty':
    '当前工作区还没有可用的设置覆盖，用户设置会继续生效。',
  'settings.openUser': '打开用户设置',
  'settings.content': '设置内容',
  'settings.workspaceScope': '工作区范围',
  'settings.userScope': '用户设置',
  'settings.noMatches': '没有找到匹配的设置',
  'settings.noModified': '没有已修改的设置',
  'settings.matchOne': '{count} 项匹配',
  'settings.matchMany': '{count} 项匹配',
  'settings.settingOne': '{count} 项设置',
  'settings.settingMany': '{count} 项设置',
  'settings.modifiedCount': '已修改 {count}',
  'settings.workspaceEmptyHeading': '当前工作区没有设置覆盖',
  'settings.workspaceEmptyBody':
    '工作区设置目前为空，所有选项都会继续使用用户设置。后续可以在这里为单个笔记文件夹保存独立配置。',
  'settings.backToUser': '返回用户设置',
  'settings.noMatchBody': '没有与“{query}”匹配的设置，请尝试其他关键词。',
  'settings.adjustHint': '调整任意设置后，它会显示在这里。',
  'settings.clearFilters': '清除筛选',
  'settings.footnote': '主题、字体和编辑偏好会立即保存，并应用到当前窗口。',
  'setting.modified': '已修改',
  'setting.enabled': '已启用',
  'setting.disabled': '已停用',
  'themeImport.uiFormat': '.json 界面主题',
  'themeImport.codeFormat': '.css 代码高亮主题',
  'themeImport.imported': '已导入“{name}”',
  'themeImport.deleted': '已删除“{name}”',
  'themeImport.importUi': '导入界面主题',
  'themeImport.importCode': '导入代码主题',
  'themeImport.supports': '支持 {format}',
  'themeImport.delete': '删除自定义主题 {name}',
  'themeImport.error.tooLarge': '主题文件过大（最大 256 KB）',
  'themeImport.error.nameEmpty': '主题名称不能为空',
  'themeImport.error.nameTooLong': '主题名称不能超过 60 个字符',
  'themeImport.error.invalidJson': '界面主题必须是有效的 JSON 文件',
  'themeImport.error.invalidFormat': '界面主题 JSON 格式无效',
  'themeImport.error.unsupportedVersion': '不支持的界面主题版本',
  'themeImport.error.missingName': '界面主题缺少 name 字段',
  'themeImport.error.invalidBase': '界面主题的 base 必须是内置主题 ID',
  'themeImport.error.missingColors': '界面主题缺少 colors 对象',
  'themeImport.error.unsupportedVariable': '不支持的界面主题变量：{key}',
  'themeImport.error.invalidColor': '变量 {key} 的颜色值无效',
  'themeImport.error.noColors': '界面主题至少需要提供一个颜色变量',
  'themeImport.error.externalResource':
    '代码主题不能包含 @import、url() 或其他外部资源',
  'themeImport.error.parseCss': '无法解析代码主题 CSS',
  'themeImport.error.missingBaseColors':
    '代码主题的 .hljs 规则必须定义 background 和 color',
  'themeImport.error.noRules': '没有找到可用的 highlight.js 样式规则',
  'themeImport.error.limitUi': '最多只能保存 {count} 个自定义界面主题',
  'themeImport.error.limitCode': '最多只能保存 {count} 个自定义代码主题',
  'theme.paper': '暖白',
  'theme.white': '白色',
  'theme.dark': '深色',
  'theme.vscodeHc': 'VS Code 高对比',
  'theme.custom': '{name}（自定义）',
  'font.systemMono': '系统等宽',
  'language.system': '跟随系统',
  'language.zh': '简体中文',
  'language.en': 'English',
  'settings.category.common.label': '常用设置',
  'settings.category.common.description': '经常使用的选项。',
  'settings.category.editor.label': '文本编辑器',
  'settings.category.editor.description': '字体、键位与写作体验。',
  'settings.category.preview.label': '预览',
  'settings.category.preview.description': 'Markdown 预览的渲染方式。',
  'settings.category.export.label': '导出',
  'settings.category.export.description': '导出格式、图片与目录。',
  'settings.language.description': '界面显示语言。',
  'settings.colorTheme.description': '界面、编辑器和预览的配色。',
  'settings.colorTheme.hint': '切换后立即应用。',
  'settings.colorTheme.reset': '恢复默认主题',
  'settings.fontSize.description': '编辑器字号。',
  'settings.fontSize.hint': '按住 Ctrl 滚动鼠标滚轮可快速调整。',
  'settings.fontSize.reset': '重置为默认值',
  'settings.immersive.description': '当前行居中，其他内容淡化。',
  'settings.immersive.hint': '作用于源码和实时预览。',
  'settings.fontFamily.description': '编辑器等宽字体。',
  'settings.fontFamily.hint': '使用应用内置字体。',
  'settings.fontFamily.reset': '恢复默认字体',
  'settings.vim.description': '启用 Vim 键位。',
  'settings.vim.hint': '仅影响源代码编辑器。',
  'settings.sourceHighlight.description': '源码模式代码块高亮。',
  'settings.sourceHighlight.hint': '关闭后代码块显示为单色。',
  'settings.codeHighlight.description': '预览代码块高亮。',
  'settings.codeHighlight.hint': '关闭后使用纯文本样式。',
  'settings.codeTheme.description': '预览代码配色主题。',
  'settings.includeImages.description': 'HTML 默认内嵌图片。',
  'settings.includeImages.hint': 'PDF 和 Word 始终内嵌图片。',
  'settings.openAfterExport.description': '导出后打开文件。',
  'settings.includeToc.description': '为导出生成目录。',
  'settings.includeToc.hint': '列出一到四级标题；Word 页码打开后更新。',
  'docx.mermaid.title': 'Mermaid 图表',
  'docx.mermaid.source': '（Mermaid 图表）',
} as const;

export type TranslationKey = keyof typeof zh;

const en: Record<TranslationKey, string> = {
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.create': 'Create',
  'action.rename': 'Rename',
  'action.processing': 'Working…',
  'app.retryLater': 'Please try again in a moment.',
  'app.sidebar.resizeAria': 'Resize sidebar, current width {width} px',
  'app.sidebar.resizeTitle':
    'Drag to resize the sidebar; double-click to reset',
  'app.splitter.title':
    'Drag to resize the editor and preview; double-click to reset',
  'app.welcome.description':
    'Choose a folder. Your notes will be saved there as .md files.',
  'app.welcome.chooseFolder': 'Choose Notes Folder',
  'app.error.dismiss': 'Dismiss error',
  'app.empty.title': 'No note open',
  'app.empty.description':
    'Open or create a Markdown file in the file tree on the left.',
  'app.status.image': 'Image',
  'nav.main': 'Main navigation',
  'nav.files': 'Files',
  'nav.explorer': 'Explorer',
  'nav.search': 'Search',
  'nav.settings': 'Settings',
  'window.minimize': 'Minimize',
  'window.maximize': 'Maximize',
  'window.restore': 'Restore',
  'window.close': 'Close',
  'menu.more': 'More',
  'menu.application': 'Application menu',
  'menu.viewMode': 'View Mode',
  'menu.export': 'Export',
  'menu.vim': 'Vim Mode',
  'menu.settings': 'Settings',
  'export.pdf': 'PDF',
  'export.html': 'HTML',
  'export.docx': 'Word (.docx)',
  'export.contents': 'Contents',
  'export.html.title': 'Export HTML',
  'export.html.embedded': 'Embed Images',
  'export.html.linked': 'Link Images',
  'export.html.embeddedHint':
    'Images are converted to data URLs, producing a single file that can be shared on its own.',
  'export.html.linkedHint':
    'Original image paths are kept. The file is smaller, but images must move with the HTML.',
  'export.html.previewNote':
    'The preview uses the embedded-image version. Images are handled according to the selected mode when saving.',
  'export.html.save': 'Save HTML',
  'export.html.preview': 'Preview',
  'export.html.size': 'About {size}',
  'export.warning.image':
    'Could not read image “{source}”; replaced with placeholder text.',
  'export.warning.remoteImage':
    'Could not download remote image “{url}”; kept the original link.',
  'export.warning.mermaid': 'Mermaid render failed: {message}',
  'viewMode.source': 'Source Mode',
  'viewMode.wysiwyg': 'Live Preview',
  'viewMode.preview': 'Preview Mode',
  'viewMode.side': 'Side Preview',
  'tabs.openFiles': 'Open files',
  'tabs.previewTitle': '{path} (preview tab; double-click to pin)',
  'tabs.unsaved': 'Unsaved',
  'tabs.closeAria': 'Close {name}',
  'tabs.close': 'Close',
  'prompt.newFile.title': 'New File',
  'prompt.fileName': 'File name',
  'prompt.newFile.initial': 'Untitled.md',
  'prompt.newFile.placeholder': 'e.g. notes.md',
  'prompt.newFolder.title': 'New Folder',
  'prompt.folderName': 'Folder name',
  'prompt.newFolder.placeholder': 'e.g. Journal',
  'prompt.renameFolder.title': 'Rename Folder',
  'prompt.renameImage.title': 'Rename Image',
  'prompt.renameFile.title': 'Rename File',
  'prompt.newName': 'New name',
  'prompt.renameFolder.placeholder': 'Folder name',
  'prompt.renameImage.placeholder': 'e.g. cover.png',
  'prompt.renameFile.placeholder': 'e.g. notes.md',
  'delete.warning':
    'It has unsaved changes that cannot be recovered after deletion.',
  'delete.folderTitle': 'Delete this folder?',
  'delete.fileTitle': 'Delete this file?',
  'delete.folderMessage':
    'The folder “{name}” and its contents will be moved to the system trash. {warning}',
  'delete.fileMessage':
    'The file “{name}” will be moved to the system trash. {warning}',
  'delete.confirm': 'Move to Trash',
  'close.unsavedTitle': 'Close unsaved tab?',
  'close.unsavedMessage':
    '“{name}” has unsaved changes that will be lost when closed.',
  'close.discard': 'Close Without Saving',
  'explorer.emptyRoot': 'Right-click here to create a file or folder.',
  'explorer.emptyNoFolder': 'Choose a folder to store your notes.',
  'explorer.chooseFolder': 'Choose Notes Folder',
  'explorer.newFile': 'New File',
  'explorer.newFolder': 'New Folder',
  'explorer.rename': 'Rename',
  'explorer.delete': 'Delete (Move to Trash)',
  'image.aria': 'Image {name}',
  'image.loading': 'Loading image…',
  'image.errorTitle': 'Unable to open image',
  'image.hint': 'Scroll to zoom · Drag to pan · Double-click to reset',
  'image.zoomOut': 'Zoom out',
  'image.zoomOutAria': 'Zoom out image',
  'image.zoomIn': 'Zoom in',
  'image.zoomInAria': 'Zoom in image',
  'image.resetTitle': 'Reset zoom and position',
  'image.reset': 'Reset',
  'preview.imageFallback': 'Image',
  'preview.imageMissing': '{alt} (failed to load)',
  'preview.imageLoadFailed': 'Failed to load image: {message}',
  'preview.mermaidFailed': 'Mermaid render failed: {message}',
  'preview.empty': 'Start typing Markdown; the preview updates live.',
  'print.aria': 'Print preview: {title}',
  'print.hint': 'Choose “Print to File” in the print dialog to save as PDF.',
  'print.action': 'Print / Save as PDF',
  'print.iframeTitle': '{title} print preview',
  'search.title': 'Search',
  'search.searching': 'Searching…',
  'search.placeholder': 'Search notes',
  'search.clear': 'Clear search',
  'search.chooseFolder': 'Choose a notes folder in the file view first.',
  'search.hint': 'Search the contents of all Markdown notes.',
  'search.noResults': 'No matches found.',
  'search.truncated': 'Too many results; showing the first 500.',
  'status.vimAria': 'Vim mode: {mode}',
  'status.immersive': 'Immersive writing (Ctrl+Shift+M)',
  'status.focus': 'Focus',
  'status.vimCommand': 'Vim command input',
  'status.switchMode': 'Switch editor mode',
  'status.lineColumn': 'Ln {line}, Col {column}',
  'status.spaces': 'Spaces: 4',
  'status.editorMode': 'Editor mode',
  'status.wysiwygHint': 'Markdown formatting is normalized while editing',
  'wysiwyg.showChart': 'Diagram',
  'wysiwyg.showSource': 'Source',
  'wysiwyg.rendering': 'Rendering diagram…',
  'wysiwyg.renderFailed': 'Diagram render failed: {message}',
  'wysiwyg.insertImageFailed': 'Cannot insert an image at this position',
  'wysiwyg.imageAlt': 'Image',
  'editor.placeholder': 'Start writing here…',
  'editor.markdownContent': 'Markdown content',
  'settings.title': 'Settings',
  'settings.searchPlaceholder': 'Search settings',
  'settings.search': 'Search settings',
  'settings.clearSearch': 'Clear search',
  'settings.filterModified': 'Show modified settings only',
  'settings.minimize': 'Minimize',
  'settings.minimizeWindow': 'Minimize window',
  'settings.restore': 'Restore',
  'settings.maximize': 'Maximize',
  'settings.restoreWindow': 'Restore window',
  'settings.maximizeWindow': 'Maximize window',
  'settings.close': 'Close settings',
  'settings.nav': 'Settings navigation',
  'settings.scope': 'Settings scope',
  'settings.user': 'User',
  'settings.workspace': 'Workspace',
  'settings.categories': 'Settings categories',
  'settings.collapseCategory': 'Collapse category',
  'settings.expandCategory': 'Expand category',
  'settings.workspaceTitle': 'Workspace Settings',
  'settings.workspaceEmpty':
    'This workspace has no setting overrides yet. User settings remain in effect.',
  'settings.openUser': 'Open User Settings',
  'settings.content': 'Settings content',
  'settings.workspaceScope': 'Workspace scope',
  'settings.userScope': 'User settings',
  'settings.noMatches': 'No matching settings',
  'settings.noModified': 'No modified settings',
  'settings.matchOne': '{count} match',
  'settings.matchMany': '{count} matches',
  'settings.settingOne': '{count} setting',
  'settings.settingMany': '{count} settings',
  'settings.modifiedCount': 'Modified {count}',
  'settings.workspaceEmptyHeading': 'No workspace overrides',
  'settings.workspaceEmptyBody':
    'Workspace settings are empty, so all options continue to use user settings. Per-folder overrides can be added here later.',
  'settings.backToUser': 'Back to User Settings',
  'settings.noMatchBody':
    'No settings match “{query}”. Try another keyword.',
  'settings.adjustHint': 'Change any setting and it will appear here.',
  'settings.clearFilters': 'Clear Filters',
  'settings.footnote':
    'Theme, font, and editor preferences are saved immediately and applied to this window.',
  'setting.modified': 'Modified',
  'setting.enabled': 'Enabled',
  'setting.disabled': 'Disabled',
  'themeImport.uiFormat': '.json UI theme',
  'themeImport.codeFormat': '.css code highlight theme',
  'themeImport.imported': 'Imported “{name}”',
  'themeImport.deleted': 'Deleted “{name}”',
  'themeImport.importUi': 'Import UI Theme',
  'themeImport.importCode': 'Import Code Theme',
  'themeImport.supports': 'Supports {format}',
  'themeImport.delete': 'Delete custom theme {name}',
  'themeImport.error.tooLarge': 'Theme file is too large (max 256 KB)',
  'themeImport.error.nameEmpty': 'Theme name cannot be empty',
  'themeImport.error.nameTooLong':
    'Theme name cannot exceed 60 characters',
  'themeImport.error.invalidJson': 'UI theme must be a valid JSON file',
  'themeImport.error.invalidFormat': 'Invalid UI theme JSON format',
  'themeImport.error.unsupportedVersion':
    'Unsupported UI theme version',
  'themeImport.error.missingName': 'UI theme is missing the name field',
  'themeImport.error.invalidBase':
    'UI theme base must be a built-in theme ID',
  'themeImport.error.missingColors':
    'UI theme is missing the colors object',
  'themeImport.error.unsupportedVariable':
    'Unsupported UI theme variable: {key}',
  'themeImport.error.invalidColor': 'Invalid color for variable {key}',
  'themeImport.error.noColors':
    'UI theme must provide at least one color variable',
  'themeImport.error.externalResource':
    'Code themes cannot contain @import, url(), or other external resources',
  'themeImport.error.parseCss': 'Could not parse the code theme CSS',
  'themeImport.error.missingBaseColors':
    'Code theme .hljs rules must define background and color',
  'themeImport.error.noRules':
    'No usable highlight.js style rules were found',
  'themeImport.error.limitUi':
    'You can save at most {count} custom UI themes',
  'themeImport.error.limitCode':
    'You can save at most {count} custom code themes',
  'theme.paper': 'Warm Paper',
  'theme.white': 'White',
  'theme.dark': 'Dark',
  'theme.vscodeHc': 'VS Code High Contrast',
  'theme.custom': '{name} (Custom)',
  'font.systemMono': 'System Monospace',
  'language.system': 'Follow System',
  'language.zh': '简体中文',
  'language.en': 'English',
  'settings.category.common.label': 'Common',
  'settings.category.common.description': 'Frequently used settings.',
  'settings.category.editor.label': 'Text Editor',
  'settings.category.editor.description':
    'Fonts, keybindings, and writing experience.',
  'settings.category.preview.label': 'Preview',
  'settings.category.preview.description':
    'How Markdown previews are rendered.',
  'settings.category.export.label': 'Export',
  'settings.category.export.description':
    'Export format, images, and outline.',
  'settings.language.description': 'Display language.',
  'settings.colorTheme.description':
    'Colors for the interface, editor, and preview.',
  'settings.colorTheme.hint': 'Applies immediately.',
  'settings.colorTheme.reset': 'Restore Default Theme',
  'settings.fontSize.description': 'Editor font size.',
  'settings.fontSize.hint': 'Hold Ctrl and scroll to adjust.',
  'settings.fontSize.reset': 'Reset to Default',
  'settings.immersive.description':
    'Center the current line and dim other content.',
  'settings.immersive.hint': 'Applies to source and live preview.',
  'settings.fontFamily.description': 'Monospace font for the editor.',
  'settings.fontFamily.hint': 'Uses bundled fonts.',
  'settings.fontFamily.reset': 'Restore Default Font',
  'settings.vim.description': 'Enable Vim keybindings.',
  'settings.vim.hint': 'Affects the source editor only.',
  'settings.sourceHighlight.description':
    'Code block highlighting in source mode.',
  'settings.sourceHighlight.hint':
    'Code blocks use a single color when off.',
  'settings.codeHighlight.description':
    'Code block highlighting in previews.',
  'settings.codeHighlight.hint': 'Uses plain text styling when off.',
  'settings.codeTheme.description': 'Color theme for preview code.',
  'settings.includeImages.description':
    'Embed images by default in HTML exports.',
  'settings.includeImages.hint':
    'PDF and Word always embed images.',
  'settings.openAfterExport.description': 'Open the file after export.',
  'settings.includeToc.description':
    'Generate a table of contents for exports.',
  'settings.includeToc.hint':
    'Includes headings 1–4; Word updates page numbers on open.',
  'docx.mermaid.title': 'Mermaid Diagram',
  'docx.mermaid.source': '(Mermaid Diagram)',
};

const MESSAGES: Record<Language, Record<TranslationKey, string>> = {
  zh,
  en,
};

export function getLanguage(): Language {
  return currentLanguage.value;
}

export function setLanguage(language: Language): void {
  if (currentLanguage.value === language) {
    applyDocumentLanguage(language);
    return;
  }
  currentLanguage.value = language;
  applyDocumentLanguage(language);
}

function applyDocumentLanguage(language: Language): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
}

export function t(
  key: TranslationKey,
  params: Record<string, string | number> = {},
): string {
  const template = MESSAGES[currentLanguage.value][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

const BACKEND_PREFIXES: Record<string, string> = {
  保存笔记失败: 'Failed to save note',
  保存图片失败: 'Failed to save image',
  创建笔记文件夹失败: 'Failed to create notes folder',
  创建导出目录失败: 'Failed to create export directory',
  创建配置目录失败: 'Failed to create configuration directory',
  创建图片目录失败: 'Failed to create image directory',
  创建文件夹失败: 'Failed to create folder',
  创建文件失败: 'Failed to create file',
  读取笔记失败: 'Failed to read note',
  读取笔记文件夹失败: 'Failed to read notes folder',
  读取设置失败: 'Failed to read settings',
  读取条目信息失败: 'Failed to read entry information',
  读取图片目录失败: 'Failed to read image directory',
  读取图片失败: 'Failed to read image',
  读取文件夹失败: 'Failed to read folder',
  读取文件夹项失败: 'Failed to read folder entry',
  解析设置失败: 'Failed to parse settings',
  无法获取配置目录: 'Could not access the configuration directory',
  写入导出文件失败: 'Failed to write export file',
  写入设置失败: 'Failed to write settings',
  序列化设置失败: 'Failed to serialize settings',
  移到回收站失败: 'Failed to move to trash',
  重命名失败: 'Failed to rename',
};

const BACKEND_EXACT: Record<string, string> = {
  笔记文件夹必须是绝对路径: 'Notes folder must be an absolute path',
  所选路径不是文件夹: 'The selected path is not a folder',
  图片内容为空: 'Image content is empty',
  图片数据无效: 'Invalid image data',
  '图片文件过大（最大 20 MB）': 'Image file is too large (max 20 MB)',
  不支持的图片格式: 'Unsupported image format',
  图片目录超出笔记文件夹: 'Image directory is outside the notes folder',
  无法生成唯一的图片文件名:
    'Could not generate a unique image file name',
  不允许访问符号链接: 'Symlinks are not allowed',
  图片路径不是文件: 'Image path is not a file',
  图片路径超出笔记文件夹: 'Image path is outside the notes folder',
  搜索关键词过长: 'Search query is too long',
  笔记路径不是文件夹: 'Note path is not a folder',
  笔记路径不是文件: 'Note path is not a file',
  '条目不是文件夹、Markdown 笔记或图片':
    'Entry is not a folder, Markdown note, or image',
  路径超出笔记文件夹: 'Path is outside the notes folder',
  路径不是有效文件夹: 'Path is not a valid folder',
  路径不能为空: 'Path cannot be empty',
  路径过长: 'Path is too long',
  路径无效: 'Invalid path',
  名称不能为空: 'Name cannot be empty',
  名称过长: 'Name is too long',
  名称不能以空格开头或结尾: 'Name cannot start or end with a space',
  名称不能以点开头: 'Name cannot start with a dot',
  名称不能以点结尾: 'Name cannot end with a dot',
  名称包含无效字符: 'Name contains invalid characters',
  名称是系统保留名称: 'Name is reserved by the system',
  '文件必须使用 .md 或 .markdown 扩展名':
    'Files must use the .md or .markdown extension',
  重命名时不能更改文件类型: 'Cannot change the file type when renaming',
  无法确定文件类型: 'Could not determine the file type',
  图片路径不能为空: 'Image path cannot be empty',
  图片路径无效: 'Invalid image path',
  图片路径必须是笔记内的相对路径:
    'Image path must be relative to the note',
  图片路径包含无效字符: 'Image path contains invalid characters',
  图片路径编码无效: 'Invalid image path encoding',
  无法确定笔记所在文件夹: 'Could not determine the note folder',
  无法生成图片路径: 'Could not generate an image path',
  请先选择笔记文件夹: 'Choose a notes folder first',
  无法确定导出目录: 'Could not determine the export directory',
  导出路径不能为空: 'Export path cannot be empty',
  导出数据无效: 'Invalid export data',
};

export function localizeError(message: string): string {
  if (getLanguage() === 'zh') return message;

  const exact = BACKEND_EXACT[message];
  if (exact) return exact;

  const exists = message.match(/^“([\s\S]+)”已存在$/);
  if (exists) return `“${exists[1]}” already exists`;

  const separator = message.indexOf('：');
  if (separator > 0) {
    const prefix = message.slice(0, separator);
    const translated = BACKEND_PREFIXES[prefix];
    if (translated) {
      return `${translated}: ${message.slice(separator + 1)}`;
    }
  }

  return message;
}
