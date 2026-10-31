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
  'app.launcher.openFolder': '打开其他文件夹…',
  'app.launcher.recent': '最近',
  'app.launcher.empty': '还没有最近的工作区。',
  'app.launcher.more': '更多…',
  'app.error.dismiss': '关闭错误提示',
  'app.watcherError':
    '文件监听不可用，外部修改不会自动检测：{error}',
  'app.empty.title': '还没有打开笔记',
  'app.empty.description': '在左侧文件树中打开或新建一个 Markdown 文件。',
  'app.status.image': '图片',
  'draft.recovered':
    '已恢复 {count} 个未保存的草稿。保存或关闭标签后会清除草稿。',
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
  'export.contents': 'Table of contents',
  'export.html.title': '导出 HTML',
  'export.html.embedded': '内嵌图片',
  'export.html.linked': '链接图片',
  'export.html.embeddedHint':
    '图片会转换为 Data URL，生成可单独分享的单个文件。',
  'export.html.linkedHint':
    '保留原始图片路径，文件更小，但移动 HTML 时需要同时移动图片。',
  'export.html.save': '保存 HTML',
  'export.html.preview': '预览',
  'export.html.size': '约 {size}',
  'export.warning.image': '无法读取图片“{source}”，已替换为占位文本。',
  'export.warning.remoteImage':
    '无法下载远程图片“{url}”，已保留原链接。',
  'export.warning.mermaid': 'Mermaid 图表渲染失败：{message}',
  'export.preview.title': '导出预览',
  'export.preview.paginating': '正在分页…',
  'export.preview.pages': '{count} 页',
  'export.preview.zoomOut': '缩小预览',
  'export.preview.zoomIn': '放大预览',
  'export.preview.failed': '分页预览失败：{message}',
  'export.preview.tooManyPages': '文档分页失败：页数过多。',
  'export.preview.notConverging': '文档分页失败：内容无法继续拆分。',
  'export.preview.progress': '正在分页… {done}/{total}',
  'export.preview.buildingDocx': '正在生成 Word…',
  'export.preview.overflow': '部分内容超过单页高度，可能被裁切。',
  'export.preview.docxHint': 'Word 可能根据本机字体微调分页。',
  'export.docx.save': '保存 Word',
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
  'externalChange.title': '文件已在磁盘上修改',
  'externalChange.message':
    '“{name}”在磁盘上被其他程序修改。重新加载会丢弃当前未保存的修改。',
  'externalChange.reload': '重新加载',
  'externalChange.keep': '保留我的修改',
  'externalChange.saveCopy': '另存副本…',
  'externalChange.copySaved': '副本已保存。',
  'externalChange.deleted':
    '“{name}”已从磁盘删除；未保存的内容仍保留在标签页中。',
  'close.windowUnsavedTitle': '关闭窗口？',
  'close.windowUnsavedMessage': '有 {count} 个标签页尚未保存。保存并关闭吗？',
  'close.saveAndClose': '保存并关闭',
  'close.saveFailedTitle': '保存失败',
  'close.saveFailedMessage': '部分笔记保存失败。仍要关闭吗？',
  'close.closeAnyway': '仍然关闭',
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
  'print.hint': '在打印对话框中选择“打印到文件”即可保存为 PDF。',
  'print.action': '打印 / 另存为 PDF',
  'search.title': '搜索',
  'search.searching': '搜索中…',
  'search.placeholder': '搜索笔记',
  'search.clear': '清除搜索',
  'search.chooseFolder': '请先在文件视图中选择笔记文件夹。',
  'search.hint': '搜索所有 Markdown 笔记的内容。',
  'search.noResults': '没有找到匹配项。',
  'search.truncated': '结果过多，仅显示前 500 条。',
  'status.vimAria': 'Vim 模式：{mode}',
  'status.vimRecording': 'REC @{register}',
  'status.immersive': 'Zen 模式（Ctrl+Shift+M）',
  'status.focus': 'Zen',
  'status.vimCommand': 'Vim 命令输入',
  'status.switchMode': '切换编辑模式',
  'status.lineColumn': '行 {line}, 列 {column}',
  'status.spaces': '空格: 4',
  'status.saved': '已保存',
  'status.saving': '保存中…',
  'status.unsaved': '未保存',
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
  'editor.breadcrumbs': '标题路径',
  'editor.minimap': '文档缩略图',
  'editor.scrollbar': '编辑器滚动条',
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
  'setting.resetWorkspace': '重置工作区设置',
  'setting.enabled': '已启用',
  'setting.disabled': '已停用',
  'themeImport.uiFormat': '.json 界面主题',
  'themeImport.codeFormat': '.json / .css 代码高亮主题',
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
  'themeImport.error.noRules': '没有找到可用的代码高亮规则',
  'themeImport.error.tooManyTokenRules': '代码高亮规则过多（最多 2000 条）',
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
  'settings.category.images.label': '图片',
  'settings.category.images.description': '粘贴图片的命名、格式与保存位置。',
  'settings.category.export.label': '导出',
  'settings.category.export.description': '导出格式、图片与目录。',
  'settings.language.description': '界面显示语言。',
  'settings.colorTheme.description': '界面、编辑器和预览的配色。',
  'settings.themePreset.description':
    '同时选择界面主题和代码高亮主题；单独修改任一项后会显示为自定义。',
  'themePreset.custom': '自定义',
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
  'settings.vimMappings.description': '自定义 Vim 键位映射，每行一条。',
  'settings.vimMappings.hint':
    '格式：mode keys command。mode 支持 normal / visual / insert / operatorPending；command 支持 pasteimage / save，或用 = 前缀定义按键映射（如 insert jk =<Esc>）。例如 normal <Space>p pasteimage。以 <Space> 开头的映射会临时占用空格键，清空映射后恢复 Vim 默认的空格右移。',
  'settings.autoSave.description': '停止输入后自动保存笔记。',
  'settings.autoSave.hint': '窗口失焦时也会保存。默认关闭。',
  'settings.autoSaveDelay.description': '停止输入后等待多久自动保存。',
  'settings.autoSaveDelay.hint': '仅在开启自动保存时生效。',
  'settings.restoreSession.description':
    '启动时恢复上次打开的标签、光标和编辑模式。',
  'settings.restoreSession.hint': '未保存的草稿会在启动时自动恢复。',
  'settings.quickOpenImages.description':
    '快速打开（Ctrl/Cmd+P）是否列出图片文件。',
  'settings.quickOpenImages.hint': '关闭时只显示 Markdown 笔记。',
  'settings.sourceHighlight.description': '源码模式代码块高亮。',
  'settings.sourceHighlight.hint': '关闭后代码块显示为单色。',
  'settings.minimapEnabled.description': '在编辑器右侧显示文档缩略图。',
  'settings.minimapEnabled.hint': '缩略图可点击跳转，并随滚动同步。',
  'settings.minimapScale.description': '缩略图字符大小与行密度。',
  'settings.minimapScale.hint':
    '1× 更紧凑、显示更多行；3× 更清晰但占用更多宽度。',
  'settings.minimapMaxColumn.description': '缩略图最多显示的列数。',
  'settings.minimapMaxColumn.hint':
    '实际宽度约为列数 × 缩放比例；窄窗口下会自动收缩。',
  'settings.codeHighlight.description': '预览代码块高亮。',
  'settings.codeHighlight.hint': '关闭后使用纯文本样式。',
  'settings.codeTheme.description': '代码块配色主题（预览与源码）。',
  'settings.includeImages.description': 'HTML 默认内嵌图片。',
  'settings.includeImages.hint': 'PDF 和 Word 始终内嵌图片。',
  'settings.openAfterExport.description': '导出后打开文件。',
  'settings.includeToc.description': '为导出生成目录。',
  'settings.includeToc.hint': '列出一到四级标题；Word 页码打开后更新。',
  'settings.imageConfirmPaste.description': '粘贴图片时先确认文件名。',
  'settings.imageConfirmPaste.hint': '关闭后直接按命名模板保存。',
  'settings.imageNameTemplate.description': '图片文件名模板，扩展名由保存格式决定。',
  'settings.imageNameTemplate.hint':
    '可用 {date}、{time}、{datetime}、{timestamp}、{note}，以及 {日期}、{时间}、{笔记} 等中文别名。',
  'settings.imageFormat.description': '粘贴图片保存为哪种格式。',
  'settings.imageFolder.description': '相对工作区根目录的保存目录。',
  'settings.imageFolder.hint':
    '例如 image 或 assets/screenshots；留空表示工作区根目录。',
  'settings.imageQuality.description': 'JPEG/WebP 的编码质量。',
  'settings.imageQuality.hint': '仅对 JPEG 和 WebP 生效。',
  'imagePaste.title': '命名图片',
  'imagePaste.nameLabel': '文件名',
  'imagePaste.target': '保存到 {path}',
  'imagePaste.rootFolder': '工作区根目录',
  'imagePaste.sameName': '同名文件会自动追加编号。',
  'imagePaste.confirm': '保存图片',
  'imagePaste.preview': '图片预览',
  'imagePaste.vimPrompt': '图片名称：',
  'imagePaste.emptyName': '请输入文件名。',
  'imagePaste.unsupportedFormat':
    '当前环境不支持该图片格式，请改用 PNG。',
  'imagePaste.convertFailed': '图片转换失败。',
  'imagePaste.tooLarge': '图片文件过大（最大 20 MB）。',
  'imagePaste.clipboardEmpty': '剪贴板中没有图片。',
  'imagePaste.clipboardUnavailable': '无法读取剪贴板图片。',
  'palette.placeholder.files': '按名称搜索文件',
  'palette.placeholder.commands': '输入命令',
  'palette.placeholder.headings': '搜索当前笔记标题',
  'palette.placeholder.themes': '选择界面主题',
  'palette.placeholder.codeThemes': '选择代码主题',
  'palette.empty.files': '没有匹配的文件',
  'palette.empty.commands': '没有匹配的命令',
  'palette.empty.headings': '当前笔记没有匹配的标题',
  'palette.empty.themes': '没有匹配的主题',
  'palette.empty.codeThemes': '没有匹配的代码主题',
  'palette.navigate': '导航',
  'palette.select': '选择',
  'palette.close': '关闭',
  'palette.current': '当前',
  'palette.on': '开',
  'palette.off': '关',
  'palette.back': '返回',
  'command.category.preferences': '首选项',
  'command.category.view': '视图',
  'command.category.file': '文件',
  'command.category.markdown': 'Markdown',
  'command.preferences.colorTheme': '首选项: 界面主题',
  'command.preferences.codeTheme': '首选项: 代码主题',
  'command.preferences.openSettings': '首选项: 打开设置',
  'command.preferences.toggleVim': '首选项: 切换 Vim 模式',
  'command.preferences.toggleZen': '首选项: 切换 Zen 模式',
  'command.preferences.toggleAutoSave': '首选项: 切换自动保存',
  'command.preferences.toggleQuickOpenImages': '首选项: 快速打开包含图片',
  'command.view.source': '视图: 源码模式',
  'command.view.wysiwyg': '视图: 实时预览',
  'command.view.preview': '视图: 预览模式',
  'command.view.side': '视图: 侧边预览',
  'command.view.togglePreview': '视图: 切换实时预览 / 侧边预览',
  'command.view.toggleSidebar': '视图: 切换侧边栏',
  'command.file.save': '文件: 保存',
  'command.file.chooseFolder': '文件: 切换笔记文件夹',
  'command.file.clearRecentFiles': '文件: 清除最近打开记录',
  'command.markdown.createToc': 'Markdown: 创建目录 (Table Of Contents)',
  'command.toc.empty': '当前笔记没有可生成的标题。',
  'command.toc.sourceOnly': '请切换到源码或侧边预览模式后再生成目录。',
  'command.toc.readOnly': '当前编辑器不可编辑，无法插入目录。',
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
  'app.launcher.openFolder': 'Open Another Folder…',
  'app.launcher.recent': 'Recent',
  'app.launcher.empty': 'No recent workspaces yet.',
  'app.launcher.more': 'More…',
  'app.error.dismiss': 'Dismiss error',
  'app.watcherError':
    'File watching is unavailable; external changes will not be detected automatically: {error}',
  'app.empty.title': 'No note open',
  'app.empty.description':
    'Open or create a Markdown file in the file tree on the left.',
  'app.status.image': 'Image',
  'draft.recovered':
    'Recovered {count} unsaved draft(s). Drafts are cleared after saving or closing the tab.',
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
  'export.contents': 'Table of contents',
  'export.html.title': 'Export HTML',
  'export.html.embedded': 'Embed Images',
  'export.html.linked': 'Link Images',
  'export.html.embeddedHint':
    'Images are converted to data URLs, producing a single file that can be shared on its own.',
  'export.html.linkedHint':
    'Original image paths are kept. The file is smaller, but images must move with the HTML.',
  'export.html.save': 'Save HTML',
  'export.html.preview': 'Preview',
  'export.html.size': 'About {size}',
  'export.warning.image':
    'Could not read image “{source}”; replaced with placeholder text.',
  'export.warning.remoteImage':
    'Could not download remote image “{url}”; kept the original link.',
  'export.warning.mermaid': 'Mermaid render failed: {message}',
  'export.preview.title': 'Export preview',
  'export.preview.paginating': 'Paginating…',
  'export.preview.pages': '{count} pages',
  'export.preview.zoomOut': 'Zoom out preview',
  'export.preview.zoomIn': 'Zoom in preview',
  'export.preview.failed': 'Could not paginate preview: {message}',
  'export.preview.tooManyPages': 'Pagination failed: too many pages.',
  'export.preview.notConverging':
    'Pagination failed: content could not be split further.',
  'export.preview.progress': 'Paginating… {done}/{total}',
  'export.preview.buildingDocx': 'Building Word file…',
  'export.preview.overflow':
    'Some content is taller than one page and may be clipped.',
  'export.preview.docxHint':
    'Word may adjust pagination based on installed fonts.',
  'export.docx.save': 'Save Word',
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
  'externalChange.title': 'File changed on disk',
  'externalChange.message':
    '“{name}” was changed by another program. Reloading will discard your unsaved changes.',
  'externalChange.reload': 'Reload',
  'externalChange.keep': 'Keep My Changes',
  'externalChange.saveCopy': 'Save a Copy…',
  'externalChange.copySaved': 'Copy saved.',
  'externalChange.deleted':
    '“{name}” was deleted on disk; its unsaved content is kept in the tab.',
  'close.windowUnsavedTitle': 'Close window?',
  'close.windowUnsavedMessage':
    '{count} tab(s) have unsaved changes. Save and close?',
  'close.saveAndClose': 'Save and Close',
  'close.saveFailedTitle': 'Save failed',
  'close.saveFailedMessage': 'Some notes could not be saved. Close anyway?',
  'close.closeAnyway': 'Close Anyway',
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
  'print.hint': 'Choose “Print to File” in the print dialog to save as PDF.',
  'print.action': 'Print / Save as PDF',
  'search.title': 'Search',
  'search.searching': 'Searching…',
  'search.placeholder': 'Search notes',
  'search.clear': 'Clear search',
  'search.chooseFolder': 'Choose a notes folder in the file view first.',
  'search.hint': 'Search the contents of all Markdown notes.',
  'search.noResults': 'No matches found.',
  'search.truncated': 'Too many results; showing the first 500.',
  'status.vimAria': 'Vim mode: {mode}',
  'status.vimRecording': 'REC @{register}',
  'status.immersive': 'Zen mode (Ctrl+Shift+M)',
  'status.focus': 'Zen',
  'status.vimCommand': 'Vim command input',
  'status.switchMode': 'Switch editor mode',
  'status.lineColumn': 'Ln {line}, Col {column}',
  'status.spaces': 'Spaces: 4',
  'status.saved': 'Saved',
  'status.saving': 'Saving…',
  'status.unsaved': 'Unsaved',
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
  'editor.breadcrumbs': 'Heading path',
  'editor.minimap': 'Document minimap',
  'editor.scrollbar': 'Editor scrollbar',
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
  'setting.resetWorkspace': 'Reset workspace setting',
  'setting.enabled': 'Enabled',
  'setting.disabled': 'Disabled',
  'themeImport.uiFormat': '.json UI theme',
  'themeImport.codeFormat': '.json / .css code highlight theme',
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
    'No usable code highlight rules were found',
  'themeImport.error.tooManyTokenRules':
    'Too many code highlight rules (maximum 2000)',
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
  'settings.category.images.label': 'Images',
  'settings.category.images.description':
    'Naming, format, and location for pasted images.',
  'settings.category.export.label': 'Export',
  'settings.category.export.description':
    'Export format, images, and outline.',
  'settings.language.description': 'Display language.',
  'settings.colorTheme.description':
    'Colors for the interface, editor, and preview.',
  'settings.themePreset.description':
    'Choose a matching interface and code highlight theme; changing either one individually switches to Custom.',
  'themePreset.custom': 'Custom',
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
  'settings.vimMappings.description':
    'Custom Vim key mappings, one per line.',
  'settings.vimMappings.hint':
    'Format: mode keys command. Modes: normal / visual / insert / operatorPending; commands: pasteimage / save, or use a = prefix for key-to-key mappings (for example insert jk =<Esc>). Example: normal <Space>p pasteimage. Mappings starting with <Space> temporarily take over the space key; clearing the mappings restores the default space-to-right motion.',
  'settings.autoSave.description':
    'Save notes automatically after you stop typing.',
  'settings.autoSave.hint':
    'Also saves when the window loses focus. Off by default.',
  'settings.autoSaveDelay.description':
    'How long to wait after typing before saving.',
  'settings.autoSaveDelay.hint': 'Only applies when auto save is enabled.',
  'settings.restoreSession.description':
    'Restore open tabs, cursor positions, and the editor mode on startup.',
  'settings.restoreSession.hint':
    'Unsaved drafts are restored as unsaved changes on startup.',
  'settings.quickOpenImages.description':
    'List image files in Quick Open (Ctrl/Cmd+P).',
  'settings.quickOpenImages.hint':
    'When off, only Markdown notes are listed.',
  'settings.sourceHighlight.description':
    'Code block highlighting in source mode.',
  'settings.sourceHighlight.hint':
    'Code blocks use a single color when off.',
  'settings.minimapEnabled.description':
    'Show a document overview on the right side of the editor.',
  'settings.minimapEnabled.hint':
    'Click the minimap to jump; it follows the viewport while scrolling.',
  'settings.minimapScale.description':
    'Character size and line density of the minimap.',
  'settings.minimapScale.hint':
    '1x is denser and shows more lines; 3x is clearer but wider.',
  'settings.minimapMaxColumn.description':
    'Maximum number of columns rendered in the minimap.',
  'settings.minimapMaxColumn.hint':
    'Width is roughly columns x scale and shrinks automatically in narrow panes.',
  'settings.codeHighlight.description':
    'Code block highlighting in previews.',
  'settings.codeHighlight.hint': 'Uses plain text styling when off.',
  'settings.codeTheme.description':
    'Color theme for code blocks in preview and source.',
  'settings.includeImages.description':
    'Embed images by default in HTML exports.',
  'settings.includeImages.hint':
    'PDF and Word always embed images.',
  'settings.openAfterExport.description': 'Open the file after export.',
  'settings.includeToc.description':
    'Generate a table of contents for exports.',
  'settings.includeToc.hint':
    'Includes headings 1–4; Word updates page numbers on open.',
  'settings.imageConfirmPaste.description':
    'Ask for a file name before saving a pasted image.',
  'settings.imageConfirmPaste.hint':
    'When off, the naming template is used directly.',
  'settings.imageNameTemplate.description':
    'File name template; the extension comes from the save format.',
  'settings.imageNameTemplate.hint':
    'Use {date}, {time}, {datetime}, {timestamp}, {note}, or Chinese aliases such as {日期}, {时间}, {笔记}.',
  'settings.imageFormat.description':
    'Format used when saving pasted images.',
  'settings.imageFolder.description':
    'Folder relative to the workspace root.',
  'settings.imageFolder.hint':
    'For example image or assets/screenshots; leave empty for the workspace root.',
  'settings.imageQuality.description':
    'Encoding quality for JPEG and WebP.',
  'settings.imageQuality.hint': 'Only applies to JPEG and WebP.',
  'imagePaste.title': 'Name Image',
  'imagePaste.nameLabel': 'File name',
  'imagePaste.target': 'Save to {path}',
  'imagePaste.rootFolder': 'Workspace root',
  'imagePaste.sameName':
    'An existing file with the same name gets a numeric suffix.',
  'imagePaste.confirm': 'Save Image',
  'imagePaste.preview': 'Image preview',
  'imagePaste.vimPrompt': 'Image name: ',
  'imagePaste.emptyName': 'Enter a file name.',
  'imagePaste.unsupportedFormat':
    'This environment cannot encode the selected image format. Use PNG instead.',
  'imagePaste.convertFailed': 'Failed to convert the image.',
  'imagePaste.tooLarge': 'Image file is too large (max 20 MB).',
  'imagePaste.clipboardEmpty': 'No image found in the clipboard.',
  'imagePaste.clipboardUnavailable':
    'Could not read an image from the clipboard.',
  'palette.placeholder.files': 'Search files by name',
  'palette.placeholder.commands': 'Type a command',
  'palette.placeholder.headings': 'Search headings in this note',
  'palette.placeholder.themes': 'Select a color theme',
  'palette.placeholder.codeThemes': 'Select a code theme',
  'palette.empty.files': 'No matching files',
  'palette.empty.commands': 'No matching commands',
  'palette.empty.headings': 'No matching headings in this note',
  'palette.empty.themes': 'No matching themes',
  'palette.empty.codeThemes': 'No matching code themes',
  'palette.navigate': 'navigate',
  'palette.select': 'select',
  'palette.close': 'close',
  'palette.current': 'Current',
  'palette.on': 'On',
  'palette.off': 'Off',
  'palette.back': 'Back',
  'command.category.preferences': 'Preferences',
  'command.category.view': 'View',
  'command.category.file': 'File',
  'command.category.markdown': 'Markdown',
  'command.preferences.colorTheme': 'Preferences: Color Theme',
  'command.preferences.codeTheme': 'Preferences: Code Theme',
  'command.preferences.openSettings': 'Preferences: Open Settings',
  'command.preferences.toggleVim': 'Preferences: Toggle Vim Mode',
  'command.preferences.toggleZen': 'Preferences: Toggle Zen Mode',
  'command.preferences.toggleAutoSave': 'Preferences: Toggle Auto Save',
  'command.preferences.toggleQuickOpenImages':
    'Preferences: Toggle Quick Open Images',
  'command.view.source': 'View: Source Mode',
  'command.view.wysiwyg': 'View: Live Preview',
  'command.view.preview': 'View: Preview Mode',
  'command.view.side': 'View: Side-by-Side Preview',
  'command.view.togglePreview':
    'View: Toggle Live Preview / Side-by-Side Preview',
  'command.view.toggleSidebar': 'View: Toggle Sidebar',
  'command.file.save': 'File: Save',
  'command.file.chooseFolder': 'File: Change Notes Folder',
  'command.file.clearRecentFiles': 'File: Clear Recent Files',
  'command.markdown.createToc': 'Markdown: Create Table Of Contents',
  'command.toc.empty': 'This note has no headings to include.',
  'command.toc.sourceOnly':
    'Switch to source or side-by-side preview to create a table of contents.',
  'command.toc.readOnly': 'The editor is read-only; cannot insert a table of contents.',
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
  图片目录不是文件夹: 'Image folder is not a directory',
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
