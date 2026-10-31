# Inker 技术概览

一个基于 **Tauri 2 + Vue 3** 的本地优先 Markdown 笔记桌面应用。

Inker 不依赖数据库或云端服务，笔记以普通 `.md` / `.markdown` 文件保存在用户选择的文件夹中。应用提供文件树、全文搜索、多标签页、源码编辑、实时预览、快速打开与命令面板、Mermaid、KaTeX、图片、Vim、主题和多格式导出等能力。

> 本文档面向开发和维护者，记录架构、实现细节、已知限制与开发约定。产品介绍、安装方式和功能概览见 [README.md](README.md)。

- 当前版本：`0.1.0`
- 应用标识：`com.lencelg.markdownnotes`（为兼容已有配置保持不变）
- 界面语言：简体中文 / English（默认跟随系统）
- 主要开发环境：Linux / Wayland / niri
- 发布包：Debian `.deb`（GitHub Release 附件约 8.7 MiB）

---

## 1. 技术栈

### 1.1 整体框架

| 层级 | 技术 |
| --- | --- |
| 桌面容器 | Tauri 2 |
| 前端 | Vue 3 Composition API + TypeScript |
| 构建工具 | Vite 8 + `@vitejs/plugin-vue` |
| 样式 | 原生 CSS + CSS 变量主题系统 |
| 图标 | Lucide (`@lucide/vue`) + Inker 品牌标记 + 内联 SVG |
| 源码编辑器 | CodeMirror 6 |
| Vim | `@replit/codemirror-vim` |
| 富文本编辑器 | Milkdown 7 / ProseMirror |
| Markdown 渲染 | `markdown-it` |
| 代码高亮 | Shiki（TextMate / VS Code 主题） |
| 数学公式 | KaTeX |
| 图表 | Mermaid 12 |
| HTML 清洗 | DOMPurify |
| Word 导出 | `docx` |
| 后端 | Rust |
| 测试 | Vitest + Vue Test Utils + jsdom；Rust 单元测试 |

### 1.2 关键依赖

```text
@tauri-apps/api              Tauri 前端 API
@tauri-apps/plugin-dialog    文件夹/保存对话框
@tauri-apps/plugin-opener    用系统浏览器打开外部链接
@tauri-apps/plugin-clipboard-manager  读取系统剪贴板图片
@codemirror/*                CodeMirror 6 编辑器
@milkdown/*                  Markdown WYSIWYG 编辑器
@replit/codemirror-vim       Vim 键位与命令
markdown-it                  Markdown 解析
shiki                        TextMate / VS Code 主题语法高亮
katex                        数学公式
mermaid                      图表渲染
dompurify                    HTML 安全清洗
docx                         Word 文档生成
@lucide/vue                  界面图标
```

Rust 侧主要依赖：

```text
tauri
tauri-plugin-dialog
tauri-plugin-opener
tauri-plugin-clipboard-manager
serde / serde_json
trash                        文件移入系统回收站
base64                       图片读写
notify                       笔记目录文件变更监听
tempfile                     测试临时目录
```

---

## 2. 当前功能

### 2.1 工作区与文件管理

- 选择一个本地文件夹作为笔记库。
- Markdown 文件与图片文件显示在同一个文件树中。
- 文件夹支持展开/折叠。
- 支持右键新建文件、新建文件夹、重命名、删除。
- 删除操作移入系统回收站，而不是直接永久删除。
- 支持 `.md`、`.markdown` 笔记。
- 支持在文件树中显示并打开图片。
- 左侧文件栏宽度可通过鼠标拖动调整。
- 侧栏宽度保存在本地，重启后恢复。
- 双击分隔条可恢复默认宽度。
- 左侧活动栏提供文件、搜索、设置入口。

### 2.2 标签页

- 多文件标签页。
- 单击文件打开“预览标签”，标签文字使用斜体。
- 连续单次打开其他文件时，新的预览标签会替换当前预览标签。
- 双击文件或双击标签可固定标签。
- 编辑未固定的预览笔记时，标签会自动固定。
- 未保存修改以圆点标记。
- 支持鼠标中键关闭标签。
- 拖拽标签可调整顺序，新顺序会写入会话快照。
- 图片同样使用标签页打开。

### 2.3 全文搜索

- 在当前笔记库中搜索 `.md` / `.markdown` 文件。
- 匹配结果包含文件名、行号、列号、上下文片段。
- 点击结果打开对应笔记并定位光标。
- 搜索有数量、文件大小和查询长度限制，避免阻塞界面。
- 图片文件不参与文本搜索。

### 2.4 编辑模式

| 模式 | 说明 |
| --- | --- |
| 源码模式 | CodeMirror 6，编辑原始 Markdown |
| 实时预览 | Milkdown / ProseMirror WYSIWYG，边写边渲染 |
| 预览模式 | 只读 Markdown 渲染视图 |
| 侧边预览 | 左侧源码编辑，右侧实时预览，可拖动分隔条 |

模式可从以下位置切换：

- 顶部应用菜单
- 底部状态栏右侧模式菜单

主编辑区和预览区的垂直滚轮步长按原生速度的 49% 计算，图片查看器的滚轮缩放不受影响。

### 2.5 源码编辑器

- Markdown 语法高亮。
- 自动换行。
- 行号、当前行、搜索等 CodeMirror 基础能力。
- 编辑器顶部显示光标所在标题层级路径，随光标移动实时更新；围栏代码块中的 `#` 不会计入路径。
- 右侧提供类似 VS Code 的文档缩略图，按 Markdown 语法着色，可点击或拖动快速跳转，并支持滚轮与键盘滚动。
- 缩略图采用代码层 / 装饰层双 Canvas，滚动条位于缩略图右侧；宽度按 VS Code 的规则计算：每列 1px、8px gutter、上限 `maxColumn`（1x/2x 显示下为 120px），并根据可用宽度和显示缩放自动收缩，背景与主编辑区一致。
- 按编辑器实际视觉行绘制：长行换行后每个视觉片段独立呈现，不再重复整行文本。
- 参考 VS Code 的字符渲染方式：ASCII 字符由 16px 粗体采样、加权降采样并亮度归一化为 2×4 灰度字模，按 4px 行高逐像素 alpha 绘制；1000px 高缩略图约显示 250 行。
- Canvas 使用整数 DPR、整数绘制偏移并关闭 `imageSmoothingEnabled`，避免 tile 合成时出现亚像素模糊；非 ASCII 字符按 VS Code 小缩放策略映射到 ASCII 字模。
- 内容不足一屏时保持顶部对齐，长文档则保持同样密度并在缩略图内部滚动。
- 长文档滚动时缩略图内容窗口随编辑器同步移动，避免整篇文件被压缩得无法辨认；滑块和右侧滚动条继续表示当前视口。
- 缩略图使用离屏 tile 缓存：滚动时只 blit 可见切片，不逐行重绘；文档变化只失效受影响的 tile。
- 文档变化时按视觉行做增量重绘；滚动、缩略图点击和滑块拖拽统一按滚动百分比同步。
- 悬停或聚焦缩略图时，视口区域显示半透明白色高亮。
- 拖动视口滑块会按指针位移连续滚动，滑块随滚动下移，缩略图内容窗口同步跟随；点击缩略图其他位置执行定位跳转。
- 多光标：
  - `Mod+D` 选择下一个相同文本
  - `Alt+点击` 添加光标
  - 支持折叠/展开多光标
- 可选 Vim 模式。
- Vim 支持 Normal / Insert / Visual / V-Line / V-Block 等模式。
- 窗口或编辑器获得焦点时会同步系统剪贴板文本到 Vim 的 unnamed register，Normal 模式 `p` / `P` 可直接粘贴；内部 yank/delete 寄存器仍可用。
- Vim 模式状态和 `:` 命令输入行均整合在应用底部状态栏，不再额外占用编辑器行。
- Vim 命令行支持 `Tab` / `Shift+Tab` 补全：Ex 命令名和当前笔记目录下的文件路径；单候选直接填入，多候选循环，并保留光标后的文本。
- 支持 `:w` 保存。
- 支持 `:pasteimage`（别名 `:pa`）从系统剪贴板粘贴图片。
- 支持自定义 Vim 键位映射（设置“文本编辑器 → Vim Custom Mappings”），默认 `normal <Space>p pasteimage`；可绑定 `pasteimage` / `save`，支持 normal / visual / insert 模式。以 `<Space>` 开头的映射会临时占用空格键；清空映射后恢复 Vim 默认的空格右移。
- 可通过设置关闭源码模式中围栏代码块的语法高亮，默认开启；Markdown 语法高亮不受影响。

### 2.6 实时预览编辑器

基于 Milkdown 7 和 ProseMirror：

- GFM 基础语法。
- 数学公式。
- Mermaid 图表。
- 代码块语法高亮（可跟随“预览代码高亮”设置），右上角显示当前语言。
- 代码高亮使用 Shiki 的 TextMate 语法和 VS Code 主题，可切换 GitHub Dark、GitHub Dark Dimmed、GitHub Dark High Contrast、GitHub Light、Atom One Dark、Atom One Light、Monokai、Nord、Dracula、Tokyo Night、Min Light、Solarized Dark、Solarized Light、Gruvbox Dark 和 VS Dark，默认 GitHub Dark。
- 代码主题作用于预览和实时预览；源码模式保留 CodeMirror/Lezer 语法树高亮，并从同一主题提取颜色变量对齐配色。
- 源码模式会为围栏代码块应用对齐后的 token 配色（关键字、字符串、注释、数字、类型、函数、变量、常量、属性、运算符、标签），Markdown 语法高亮保持不变。
- 关闭“源码代码块语法高亮”后不应用代码主题配色。
- 原始 HTML 渲染（经 DOMPurify 清洗）。
- 本地图片解析。
- 粘贴、拖拽图片时按图片设置转换格式，并保存到配置的工作区相对目录（默认 `assets/`）。
- 多光标。
- 顶部标题面包屑随选区更新。
- Markdown 同步序列化，并保留原文件的 CRLF / LF 行尾风格。

### 2.7 Markdown 渲染

预览支持：

- 标题、段落、列表、引用、表格、分割线。
- 任务列表。
- 围栏代码块与语法高亮。
- 代码块右上角显示语言标识。
- KaTeX 行内公式和块级公式。
- Mermaid 图表。
- 原始 HTML（白名单清洗）。
- 本地相对路径图片。
- 标题自动生成稳定锚点 ID。
- Markdown 目录链接跳转，例如：

```markdown
- [安装指南](#安装指南)
```

点击后会滚动到对应标题。

### 2.8 预览滚动同步

- 源码模式 ↔ 侧边预览双向滚动同步。
- 按渲染后的文本块建立源行锚点。
- 使用居中映射，而不是简单按滚动百分比对齐。
- 等待图片加载/解码后再计算锚点，减少图片较多时的位置漂移。
- 监听尺寸变化并重新计算锚点。
- 区分用户滚动和程序滚动，避免同步反馈循环。

### 2.9 图片

- 文件树显示常见图片格式：
  `png`、`apng`、`jpg`、`jpeg`、`gif`、`webp`、`svg`、`bmp`、`ico`、`avif`
- 图片可在主区域打开为独立标签页。
- 图片查看器显示文件名和实际尺寸。
- 支持鼠标滚轮缩放，缩放以鼠标位置为中心。
- 支持按住鼠标左键拖动图片、缩放百分比、加减按钮和双击/重置复位。
- Markdown 中的本地图片通过 Rust 后端读取并转换为内嵌 Data URL。
- 源码编辑器与实时预览都支持通过 `Ctrl/Cmd+V` 粘贴图片，也支持拖拽图片。
- 默认在保存前弹出命名窗口，显示缩略图、目标目录和扩展名；可在设置中关闭。
- Vim 源码模式下不弹窗，改为在底部 Vim 命令行输入名称；Enter 确认、Esc 取消。请在插入模式使用 `Ctrl/Cmd+V`；Normal 模式的 `Ctrl+V` 仍是 Vim 的块选择，可使用 `:pasteimage`（别名 `:pa`）从系统剪贴板粘贴图片。
- 默认保存到工作区根目录的 `assets/`，可在设置中改为其他相对目录（如 `image`、`assets/screenshots`）。
- 图片命名支持模板（默认 `{datetime}`），保存格式支持 PNG / JPEG / WebP。
- 嵌套笔记会插入正确的相对路径，例如 `../assets/20261027-143012.png`。
- 图片读取有 20 MB 上限。
- 图片重命名会保留文件类型。

### 2.10 Zen 模式

- 打字机模式：当前行保持居中。
- 淡化非当前段落/内容。
- 支持源码编辑器与实时预览编辑器。
- 状态栏可切换 Zen 模式，快捷键为 `Ctrl/Cmd+Shift+M`。

### 2.11 主题与字体

内置主题：

- 暖白
- 白色
- 深色
- Monokai
- Nord
- Dracula
- Gruvbox Dark
- Solarized Light
- VS Code Light+
- VS Code Dark+
- VS Code 高对比

内置等宽字体：

- JetBrains Mono
- Fira Code
- Source Code Pro
- 系统等宽

- 设置面板提供 Theme Preset，可一次切换界面主题与代码主题；单独修改任一项后显示为自定义。
- 字体大小可调，快捷键为 `Ctrl/Cmd + 鼠标滚轮`。
- 设置面板会跟随当前应用主题。
- 下拉框为自定义组件，弹层样式与主题一致。
- 支持导入自定义界面主题 JSON，以及 VS Code 主题 JSON / 旧版 highlight.js CSS 代码主题。
- 导入成功后自动保存、选中并立即应用。
- 已导入主题显示在对应主题下拉框下方，可直接删除。

自定义界面主题示例：

```json
{
  "version": 1,
  "name": "Ocean Dark",
  "base": "dark",
  "colors": {
    "--bg": "#0b1220",
    "--panel": "#152238",
    "--ink": "#e6edf7",
    "--accent": "#4ea1ff"
  }
}
```

自定义代码主题推荐使用 VS Code 主题 JSON：

```json
{
  "name": "Ocean Code",
  "type": "dark",
  "colors": {
    "editor.background": "#0b1220",
    "editor.foreground": "#d8dee9"
  },
  "tokenColors": [
    { "scope": "keyword", "settings": { "foreground": "#81a1c1" } },
    { "scope": "string", "settings": { "foreground": "#a3be8c" } }
  ]
}
```

旧版 highlight.js CSS 仍可导入，会转换为近似的 Shiki 主题。

导入限制：

- 界面主题仅允许受支持的语义颜色变量，必须以内置主题为 `base`。
- VS Code 主题仅保留 tokenColors/editor 颜色；旧版 CSS 仅保留 `.hljs` 作用域内的样式，拒绝 `@import` 和外部 `url()`。
- 单个文件最大 256 KB，每类最多保存 20 个自定义主题。
- 主题保存在本机 localStorage，不会上传网络。

### 2.12 设置面板

采用类似 VS Code 的浮动设置面板：

- 半透明遮罩与背景模糊。
- 面板宽高约为窗口的 80%。
- 可通过标题栏拖动面板，双击标题栏恢复居中。
- 顶部搜索、清除、过滤和窗口按钮。
- 左侧“用户 / 工作区”标签页：
  - 用户范围保存全局偏好。
  - 工作区范围只显示可按笔记库覆盖的偏好，以用户设置为基准。
  - “已修改”表示该值与用户设置不同，可通过行内重置按钮移除覆盖。
  - 未打开笔记库时显示空状态，可返回用户设置。
- 主题、字体、Vim、自动保存、图片和导出偏好可按工作区覆盖；界面语言与会话恢复保持全局。
- 可折叠分类树。
- 分类：
  - 常用设置
  - 文本编辑器
  - 预览
  - 图片
  - 导出
- 设置项支持：
  - 数字输入
  - 文本输入
  - 多行文本
  - 下拉选择
  - 复选框
  - 修改状态标记
  - 恢复默认链接
- 支持实时搜索过滤并高亮匹配分类。
- 支持“仅显示已修改的设置”。
- 支持简体中文与 English 界面，默认跟随系统语言，切换后立即生效并保存在本机。
- 点击分类平滑滚动到对应区域。
- 滚动内容时自动同步左侧选中分类。
- 设置变更立即应用到工作台。

### 2.13 导出

支持三种导出：

| 格式 | 实现 |
| --- | --- |
| HTML | 导出对话框提供“内嵌图片 / 链接图片”两种模式，并显示预览、文件体积和警告；可选目录，使用当前代码高亮主题和文档元数据 |
| Word `.docx` | 先显示分页预览，确认后再生成并保存文档；使用 `docx` 生成原生多级列表、表格边框/列宽/重复表头、连续代码块与语法颜色、Word 原生公式、JPEG/PNG/SVG 图片、Mermaid 2x 栅格化、目录、页码、文档属性和内部链接 |
| PDF | 应用内 A4 分页预览后调用 WebView 打印；预览与打印复用同一份分页 DOM、目录、代码主题和打印专用样式 |

导出行为：

- 复用当前 Markdown 渲染、代码高亮开关和代码主题。
- 本地图片在 PDF/Word 中始终内嵌；HTML 可切换内嵌或保留原始路径。
- 尝试下载并内嵌远程图片；失败时保留链接并显示警告。
- 统一使用 A4、20mm 页边距和 170 × 257mm 内容区；PDF 与 Word 预览都显示页码。
- 支持 `\pagebreak` 或 `\newpage` 段落作为强制分页标记。
- 长段落按行拆分；列表按条目、表格按行拆分，并尽量保持代码块、图片、引用和目录整块呈现。
- PDF 预览和打印使用同一份分页 DOM，避免打印时再次分页；Word 预览使用同一分页器配合 Word 版式样式。
- 分页过程异步执行并定期让出主线程，显示进度；Word 文件在点击保存后才生成，生成期间同样会周期性让出事件循环。
- 分页带有页数和拆分次数保护，异常文档会显示错误而不是无限卡住。
- Word 最终分页仍可能受本机字体和 Word 自身排版影响。
- 导出设置包括 HTML 图片模式、目录（默认关闭）和导出后打开。
- Word 目录页码会在 Word 打开后由字段更新；HTML/PDF 目录使用内部锚点。

### 2.14 桌面窗口

- 无系统装饰的自定义窗口。
- 自定义顶部标题栏：
  - 标签页
  - 应用菜单
  - 最小化
  - 最大化/还原
  - 关闭
- 标签页与主编辑区域对齐。
- 拖动标题栏移动窗口，双击最大化/还原。
- 设置面板使用应用内浮层，不创建独立设置窗口。

### 2.15 外部链接

- 在预览和实时预览中，`Ctrl/Cmd + 左键` 打开 `http(s)` 与 `mailto` 链接，使用系统默认浏览器，不会在 Inker 的 WebView 内导航。
- 普通左键不会打开外部链接；链接上的右键菜单会被抑制，避免 WebView 自带的“打开链接”在应用内跳转。
- 内部 `#anchor` 链接由预览和实时预览自行滚动处理。

### 2.16 自动保存与会话恢复

- 自动保存默认关闭，可在设置“常用设置”中开启，并调整延迟（300ms–10s，默认 1000ms）。
- 开启后，停止输入达到延迟即保存；窗口失焦或页面隐藏时立即保存全部未保存的标签。
- 底部状态栏显示当前笔记的“已保存 / 保存中… / 未保存”状态。
- 关闭窗口时：自动保存开启则先保存全部脏标签再退出；自动保存关闭且仍有未保存内容时，弹出“保存并关闭”确认，保存失败可选择“仍然关闭”。
- 启动时恢复上次会话：标签顺序、活动标签、预览标签身份、每个标签的光标与滚动位置、编辑模式、展开的文件夹、侧栏可见性与所在面板。
- 实时预览（WYSIWYG）模式只恢复标签与模式，不恢复光标和滚动位置；纯预览模式恢复光标，预览阅读滚动位置不单独保存。
- 会话按笔记文件夹分别保存，最多保留最近 10 个工作区。
- 未保存内容会以草稿形式保存在本机 localStorage，启动时自动恢复为未保存状态并显示提示。
- 单个草稿上限 256 KB，总计约 2 MB，最多 20 条；超过上限的笔记不写草稿。
- 递归监听当前笔记文件夹；事件携带相对路径与变更类型，只处理实际变化的笔记/图片。
- 忽略隐藏路径与应用自身的 `.inker-tmp-*` 原子写入临时文件；无关文件的修改不会触发全库刷新。
- 外部新增、删除或重命名文件时刷新文件树；仅修改未打开的笔记时不做额外读取。
- 外部修改已打开的笔记时：
  - 标签没有未保存修改 → 自动重新加载，并尽量保留光标与滚动位置。
  - 标签有未保存修改 → 弹窗选择“重新加载”“保留我的修改”或“另存副本…”。
  - 文件被外部删除时，未保存内容仍保留在标签页中，并可另存副本。
- 已打开的图片被外部修改时会自动重新加载。
- 保存使用同目录临时文件 + 原子 rename 替换，并保留原文件权限；写入失败不会留下半截文件。
- 启动和切换笔记库时会清理超过 1 小时的 `.inker-tmp-*` 残留文件。
- 文件监听启动失败或运行中出错时会在顶部显示警告，提示外部修改可能无法自动检测。
- 大文件、外部修改与 localStorage 清理的边界见 §9。

### 2.17 快速打开与命令面板

参考 VS Code 的快速输入浮层，样式使用当前主题变量：

- `Ctrl/Cmd+P` 打开快速打开，按文件名、相对路径或模糊子序列搜索当前笔记库。
- 空查询时按最近打开顺序排列文件，模糊搜索结果也会对最近使用的文件加权；最近列表按笔记文件夹分别保存（每库 20 条，最多 10 个库），失效路径会自动清理。
- 输入 `>` 会立即切换到命令模式，`>` 后的文字作为命令搜索词；命令模式空查询按 Backspace 返回文件模式。
- 输入 `@` 搜索当前笔记标题，显示 H1–H6 层级并跳转到对应行；标题模式空查询按 Backspace 返回文件模式。
- 默认只列出 Markdown 笔记；可在命令面板或设置“常用设置 → Workbench: Quick Open Images”中开启图片。
- 选中笔记后切换到源码模式并打开；选中图片则打开图片标签页。
- `Ctrl/Cmd+Shift+P` 打开命令面板，可搜索并执行：
  - `Preferences: Color Theme` / `Code Theme`：进入二级主题列表，当前主题带“当前”标记，可通过“返回”回到命令列表。
  - 打开设置、切换 Vim / Zen / 自动保存、切换快速打开是否包含图片。
  - 切换源码 / 实时预览 / 预览 / 侧边预览模式、切换侧栏。
  - `View: Toggle Live Preview / Side-by-Side Preview`：在实时预览与侧边预览之间来回切换（其他模式下进入侧边预览）。
  - 保存、切换笔记文件夹、清除最近打开记录。
  - `Markdown: Create Table Of Contents`。
- 支持 `↑` / `↓` / `PageUp` / `PageDown` / `Home` / `End` 导航，`Enter` 选择，`Esc` 或点击遮罩关闭；鼠标悬停与点击同样可用。
- 命令面板在设置浮层之上显示，可从设置界面直接调整主题。选择文件、切换视图模式、切换笔记文件夹或生成目录时会关闭设置浮层；偏好开关与保存命令保持设置打开。
- 大笔记库下最多渲染 100 条匹配结果，继续输入可缩小范围。

**Create Table Of Contents**：

- 在当前光标处插入 Markdown 列表式目录，包含 H1–H6 标题，按标题层级缩进。
- 锚点与预览中的标题 ID 使用同一次 Markdown 解析生成，支持中文标题与重复标题后缀。
- 标题中的方括号、反斜杠、星号、下划线、反引号与尖括号会转义，保持目录文字与标题一致；字面量尖括号不会被误当作 HTML 标签删除。
- 仅在源码模式或侧边预览模式下可用；预览 / 实时预览模式会提示切换，空文档或无标题时给出提示。
- 插入块会与上下文自动保留一个空行，并继承当前编辑器的撤销历史。

---

## 3. 当前实现情况

| 能力 | 状态 |
| --- | --- |
| 本地文件夹笔记库 | ✅ 已完成 |
| Markdown / 图片文件树 | ✅ 已完成 |
| 文件树宽度调整 | ✅ 已完成 |
| 新建 / 重命名 / 回收站删除 | ✅ 已完成 |
| 全文搜索 | ✅ 已完成 |
| 多标签页、预览标签、固定标签、拖拽排序 | ✅ 已完成 |
| 源码模式 | ✅ 已完成 |
| 实时预览（WYSIWYG） | ✅ 已完成 |
| 预览模式 | ✅ 已完成 |
| 侧边预览与双向滚动同步 | ✅ 已完成 |
| 多光标 | ✅ 已完成 |
| 源码代码块高亮开关 | ✅ 已完成 |
| Vim 模式 | ✅ 已完成 |
| Vim 模式 / 命令输入整合到底栏 | ✅ 已完成 |
| KaTeX 数学公式 | ✅ 已完成 |
| Mermaid | ✅ 已完成 |
| 原始 HTML（清洗后渲染） | ✅ 已完成 |
| 本地图片与图片标签页 | ✅ 已完成 |
| 图片缩放与拖动查看 | ✅ 已完成 |
| 图片粘贴/拖拽与命名 | ✅ 源码/WYSIWYG、弹窗/Vim 底栏、模板/格式/目录 |
| 目录锚点跳转 | ✅ 已完成 |
| 标题面包屑导航 | ✅ 已完成 |
| 源码编辑器缩略图 | ✅ 已完成 |
| Zen 模式 | ✅ 已完成 |
| 主题 / 字体 / 字号 | ✅ 已完成 |
| 代码高亮主题切换 | ✅ 已完成 |
| 自定义界面主题导入 | ✅ 已完成 |
| 自定义代码主题导入 | ✅ 已完成 |
| VS Code 风格设置面板 | ✅ 已完成 |
| HTML / Word / PDF 导出 | ✅ 已完成 |
| Debian `.deb` 打包 | ✅ 已完成 |
| “工作区”设置 | ✅ 按笔记库覆盖偏好，支持重置 |
| 导出分类中的选项 | ✅ 已接入导出流程 |
| 云同步 / 多设备同步 | ❌ 未实现 |
| 自动保存 | ✅ 可选，默认关闭 |
| 会话恢复 / 草稿恢复 | ✅ 已完成 |
| 外部文件变更监听与冲突选择 | ✅ 已完成 |
| 原子保存 | ✅ 已完成 |
| 快速打开（Ctrl/Cmd+P） | ✅ 已完成 |
| 最近打开文件排序 | ✅ 按工作区保存 |
| 快速打开 `>` 命令模式 | ✅ 已完成 |
| 快速打开 `@` 标题搜索 | ✅ 跳转到对应行 |
| 命令面板（Ctrl/Cmd+Shift+P） | ✅ 已完成 |
| 生成目录（TOC） | ✅ 源码 / 侧边预览 |
| 笔记加密 | ❌ 未实现 |
| 多窗口编辑 | ❌ 未实现 |

---

## 4. 代码架构

### 4.1 目录结构

```text
inker/
├── README.md                      # 产品介绍、安装与功能
├── OVERVIEW.md                    # 本文档：架构与实现说明
├── LICENSE                        # MIT 许可证
├── Cargo.toml                     # Cargo workspace
├── Cargo.lock
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── assets/
│   └── icons/
│       └── inker.svg              # 应用图标源文件
├── src/
│   ├── main.ts                    # Vue 启动、全局外链处理
│   ├── App.vue                    # 应用总状态与布局编排
│   ├── api.ts                     # Tauri invoke 封装
│   ├── types.ts                   # 前端共享类型
│   ├── style.css                  # 全局样式、主题变量、布局
│   ├── composables/
│   │   ├── useAutoSave.ts         # 自动保存计时器与重试
│   │   ├── useClosePreparation.ts # 关闭前保存确认与失败处理
│   │   ├── useDocumentExport.ts   # PDF / HTML / DOCX 导出流程
│   │   ├── useDraftPersistence.ts # 崩溃草稿刷新与最大间隔
│   │   ├── useExternalChangeSync.ts # 外部变更防抖、阻塞与重试
│   │   ├── useRecentFiles.ts      # 最近文件状态与持久化
│   │   ├── useSessionPersistence.ts # 会话防抖与最大间隔持久化
│   │   ├── useWindowClose.ts      # 关闭窗口前的保存与放行流程
│   │   └── useWorkspaceLifecycle.ts # 启动与切换笔记库编排
│   ├── components/
│   │   ├── ActivityRail.vue       # 左侧活动栏
│   │   ├── NoteSidebar.vue        # 文件树与右键菜单
│   │   ├── SearchPanel.vue        # 全文搜索
│   │   ├── EditorTabs.vue         # 标签页
│   │   ├── EditorPane.vue         # CodeMirror / Vim / 缩略图
│   │   ├── Breadcrumbs.vue        # 光标所在标题路径
│   │   ├── WysiwygPane.vue        # Milkdown 实时预览
│   │   ├── PreviewPane.vue        # Markdown 只读预览
│   │   ├── ImagePane.vue          # 图片查看器
│   │   ├── ImagePasteDialog.vue    # 粘贴图片命名与预览
│   │   ├── StatusBar.vue          # 底部状态栏
│   │   ├── AppMenu.vue            # 顶部应用菜单
│   │   ├── SettingsOverlay.vue    # 设置浮层
│   │   ├── SettingsPanel.vue      # 设置状态编排
│   │   ├── ConfirmDialog.vue
│   │   ├── ExternalChangeDialog.vue # 外部修改冲突操作
│   │   ├── PromptDialog.vue
│   │   ├── QuickPalette.vue       # VS Code 风格快速打开 / 命令面板
│   │   ├── ExportPreviewDialog.vue # PDF / Word 分页预览
│   │   ├── HtmlExportDialog.vue   # HTML 导出预览与图片模式
│   │   ├── InkerMark.vue
│   │   └── settings/
│   │       ├── SettingsHeader.vue
│   │       ├── SettingsSidebar.vue
│   │       ├── SettingsContent.vue
│   │       ├── SettingItem.vue
│   │       ├── ThemeImportControl.vue
│   │       └── SettingsSelect.vue
│   └── lib/
│       ├── anchors.ts             # 标题 slug / 锚点查找 / 滚动
│       ├── blockInsertion.ts      # 块插入与上下文空行处理
│       ├── codeHighlight.ts       # Shiki token 范围映射
│       ├── codeThemes.ts          # Shiki / VS Code 代码主题
│       ├── shikiHighlighter.ts    # Shiki 单例、语言/主题懒加载
│       ├── themePalette.ts        # 主题 token 颜色提取
│       ├── customThemes.ts        # 自定义主题注册表与持久化
│       ├── themeImport.ts         # 界面主题 / 代码主题解析与清洗
│       ├── docxExport.ts          # DOCX 内容转换
│       ├── exportContent.ts       # HTML / PDF / 导出准备
│       ├── pageLayout.ts          # 统一 A4 页面规格与预览样式
│       ├── pagination.ts          # DOM 测量、分页与页面切片
│       ├── externalChange.ts      # 外部修改冲突分类
│       ├── fileKinds.ts           # 图片扩展名识别
│       ├── focus.ts               # 模态关闭后的焦点恢复
│       ├── i18n.ts                # 中英文文案与系统语言检测
│       ├── imagePaste.ts          # 图片命名、格式转换与路径编码
│       ├── imageView.ts           # 图片缩放与平移计算
│       ├── fonts.ts               # 字体列表
│       ├── headings.ts            # 标题提取与当前路径计算
│       ├── lineEndings.ts         # LF / CRLF 处理
│       ├── markdown.ts            # markdown-it 渲染配置
│       ├── minimap.ts             # 缩略图尺寸、坐标与滚动映射
│       ├── editorMinimap.ts       # 双 Canvas 缩略图与滚动条控制器
│       ├── mermaid.ts             # Mermaid 延迟加载
│       ├── palette.ts             # 快速打开模糊匹配与文件项
│       ├── paletteCommands.ts     # 命令面板与主题候选定义
│       ├── paletteHeadings.ts     # 当前笔记标题搜索项
│       ├── paths.ts               # 路径工具
│       ├── preferences.ts         # 本地偏好读写
│       ├── recentFiles.ts         # 按工作区保存最近打开文件
│       ├── session.ts             # 会话快照与工作区存储
│       ├── drafts.ts              # 崩溃草稿存储与清理
│       ├── previewSync.ts         # 预览滚动映射
│       ├── proseMultiCursor.ts    # ProseMirror 多光标
│       ├── settingsSchema.ts      # 设置面板 Schema
│       ├── themes.ts              # 主题列表
│       ├── toc.ts                 # Markdown 列表式目录生成
│       ├── viewModes.ts           # 编辑模式定义
│       ├── vimMappings.ts         # 自定义 Vim 键位映射解析
│       ├── vimMode.ts             # Vim 模式名称格式化
│       ├── workspaceRestore.ts    # 会话恢复计划与草稿合并
│       └── workspaceSettings.ts   # 按笔记库覆盖偏好
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs
        ├── lib.rs                 # Tauri 启动与命令注册
        ├── commands.rs            # Tauri 命令层
        ├── notes.rs               # 文件系统、搜索、图片、原子保存与安全检查
        ├── watcher.rs             # 笔记目录监听与变更事件
        └── settings.rs            # 应用配置（笔记目录）
```

### 4.2 前端状态中心

`src/App.vue` 是当前应用的状态与流程中心，主要管理：

- 当前笔记文件夹 `notesDir`
- 文件树 `entries`
- 标签页 `tabs`
- 当前标签 `activePath`
- 预览标签 `previewPath`
- 编辑模式 `viewMode`
- 侧栏可见性和宽度
- 侧边预览分隔比例
- 光标行列、预览焦点行、滚动比例
- Zen 模式
- 设置浮层
- 快速打开 / 命令面板的层级与候选列表
- 导出与打印预览
- 错误、确认框、输入框
- Tauri 窗口状态

`EditorTabs`、`NoteSidebar`、`StatusBar` 等组件通过 props 接收状态，通过事件把用户操作交回 `App.vue`。

可独立的状态逐步迁移到 `src/composables/`（目前为最近文件、自动保存、会话持久化、草稿刷新、外部变更同步、窗口关闭、关闭前保存、文档导出与工作区生命周期），并新增 App 级集成测试覆盖启动、快捷面板、外部变更与冲突流程。

### 4.3 前端数据流

```text
用户操作
   ↓
Vue 组件 emit
   ↓
App.vue 更新状态 / 调用 api.ts
   ↓
Tauri invoke
   ↓
Rust commands.rs
   ↓
notes.rs / settings.rs
   ↓
本地文件系统 / 应用配置
```

读取笔记库流程：

```text
bootstrap()
  → api.getState()
  → Rust get_state
  → 读取 settings.json
  → list_entries()
  → 返回 NotesState
  → 前端构建文件树并打开第一篇 Markdown 笔记
```

### 4.4 后端模块

#### `notes.rs`

负责所有本地笔记文件操作：

- 递归列举文件树
- 读取 / 保存 Markdown
- 全文搜索
- 创建文件 / 文件夹
- 重命名
- 删除到回收站
- 图片保存、读取
- 路径校验、符号链接检查
- MIME 识别
- Base64 图片编码

#### `commands.rs`

Tauri 命令层，把 `AppHandle`、当前笔记目录与 `notes.rs` 连接起来。

当前命令：

| 命令 | 作用 |
| --- | --- |
| `get_state` | 获取当前笔记库状态 |
| `choose_notes_dir` | 选择并保存笔记文件夹 |
| `refresh_notes` | 刷新文件树 |
| `read_note` | 读取 Markdown |
| `save_note` | 保存 Markdown |
| `save_note_image` | 保存粘贴/拖拽图片 |
| `save_export` | 写入导出文件 |
| `read_note_asset` | 读取 Markdown 引用的图片 |
| `read_image` | 读取文件树中的图片 |
| `search_notes` | 全文搜索 |
| `create_file` | 新建笔记 |
| `create_folder` | 新建文件夹 |
| `rename_entry` | 重命名文件或文件夹 |
| `delete_entry` | 移入回收站 |

#### `settings.rs`

只存储应用级配置：

```json
{
  "notesDir": "/home/user/notes"
}
```

配置文件位于系统应用配置目录，例如 Linux：

```text
~/.config/com.lencelg.markdownnotes/settings.json
```

### 4.5 本地偏好设置

用户界面偏好保存于 `localStorage`：

| Key | 含义 |
| --- | --- |
| `inker-theme` | 主题 |
| `inker-font-size` | 字体大小 |
| `inker-font-family` | 编辑器字体 |
| `inker-vim` | Vim 模式 |
| `inker-vim-mappings` | 自定义 Vim 键位映射（每行 `mode keys command`） |
| `inker-immersive` | Zen 模式 |
| `inker-code-highlight` | 预览代码高亮 |
| `inker-code-theme` | 代码高亮主题 |
| `inker-source-highlight` | 源码代码块语法高亮 |
| `inker-language` | 界面语言（`system` / `zh` / `en`） |
| `inker-export-embed-images` | HTML 默认是否内嵌图片 |
| `inker-export-open-after` | 导出后是否打开文件 |
| `inker-export-toc` | 导出时是否生成目录 |
| `inker-custom-ui-themes` | 自定义界面主题 |
| `inker-custom-code-themes` | 自定义代码主题 |
| `inker-split-ratio` | 侧边预览分隔比例 |
| `inker-sidebar-width` | 文件栏宽度 |
| `inker-auto-save` | 是否启用自动保存（默认关闭） |
| `inker-auto-save-delay` | 自动保存延迟（毫秒） |
| `inker-restore-session` | 启动时恢复会话（默认开启） |
| `inker-session-v1` | 按笔记文件夹保存的会话快照 |
| `inker-drafts-v1` | 未保存内容的崩溃草稿 |
| `inker-recent-files-v1` | 按笔记文件夹保存的最近打开文件 |
| `inker-workspace-settings-v1` | 按笔记文件夹保存的偏好覆盖（最多 20 个） |
| `inker-image-confirm` | 粘贴图片时是否确认名称 |
| `inker-image-template` | 图片命名模板 |
| `inker-image-format` | 图片保存格式（`png` / `jpeg` / `webp`） |
| `inker-image-folder` | 图片保存目录（相对工作区根目录） |
| `inker-image-quality` | JPEG/WebP 编码质量 |
| `inker-quick-open-images` | 快速打开是否列出图片（默认否） |

应用会兼容读取旧的 `markleaf-*` 偏好键，并在首次读取时迁移到 `inker-*`。

### 4.6 页面布局

应用根节点 `.app-shell` 使用 CSS Grid：

```text
行：
  38px        标题栏
  minmax(...) 主体
  31px        状态栏

列：
  48px        活动栏
  可变宽度     文件/搜索侧栏
  1fr         编辑与预览区
```

侧栏宽度通过 CSS 变量 `--sidebar-width` 动态控制。

---

## 5. 关键实现说明

### 5.1 Markdown 渲染

`src/lib/markdown.ts` 中配置 `markdown-it`：

- 开启原始 HTML。
- 使用任务列表插件。
- 为标题生成稳定 ID。
- 代码围栏生成 `.code-block` 和语言标识。
- 本地图片改写为占位图，并通过 `data-md-src` 延迟解析。
- 支持 Mermaid 围栏。
- 使用 Shiki/TextMate 对显式声明的语言做语法高亮；未知语言回退为纯文本。

标题 ID 规则：

- 转小写。
- 移除标点。
- 空格转 `-`。
- 中文保留。
- 重复标题自动追加 `-1`、`-2`。

### 5.2 预览滚动同步

`src/lib/previewSync.ts` + `PreviewPane.vue`：

1. 渲染后查找带 `data-source-line` 的块。
2. 计算块在预览容器中的位置和高度。
3. 根据源码行或滚动比例进行居中映射。
4. 图片加载完成后重新收集锚点。
5. 使用 `ResizeObserver` 处理布局变化。
6. 仅将用户滚动回传给源码编辑器，避免程序滚动造成循环。

### 5.3 Vim 状态栏

- CodeMirror Vim 使用 `vim({ status: false })`，关闭默认状态条。
- 前端监听 Vim 的 `vim-mode-change`、`vim-command-done` 事件。
- 模式显示在应用底部状态栏左侧。
- Vim 的 `statusbar` DOM 被挂载到状态栏的 `.status-vim-command` 区域。
- 因此 `:` 命令输入、搜索提示等也显示在底部状态栏，而不是编辑器上方新增一行。
- 自定义映射通过 `Vim.defineAction` + `Vim.mapCommand(keys, 'action', name, {}, { context })` 注册；设置变化或编辑器重建时用 `Vim.unmap` 清理旧映射，不会删除内置键位。

### 5.4 图片处理

上传：

```text
Ctrl/Cmd+V 或拖拽图片
  → 两个编辑器共用 App.requestImageSave()
  → 按命名模板生成默认名
  → 需要确认时：普通模式弹窗 / Vim 源码模式底栏输入
  → canvas 转为目标格式（同格式直接透传）
  → api.saveImage(notePath, folder, fileName, data)
  → save_note_image()
  → 在工作区相对目录中创建文件夹并写入
  → 返回相对当前笔记的路径（如 ../assets/x.png）
  → 插入 Markdown 图片 / WYSIWYG image 节点
```

命名模板支持 `{date}`、`{time}`、`{datetime}`、`{timestamp}`、`{note}`，以及中文别名 `{日期}`、`{时间}`、`{日期时间}`、`{时间戳}`、`{笔记}`。扩展名由保存格式决定；同名文件由后端追加 `-1`、`-2`。

Vim 的 `:pasteimage` / `:pa` / 自定义映射不依赖 WebView Clipboard API，而是通过 `tauri-plugin-clipboard-manager` 读取系统剪贴板的 RGBA 图像并转成 PNG，再进入同一保存流程。WebKitGTK 下 `navigator.clipboard.read()` 不可靠，因此不再作为图片来源；Linux 构建启用了 Wayland data-control。

读取：

```text
Markdown 图片路径
  → read_note_asset / read_image
  → 校验路径、大小、MIME
  → Base64 + MIME
  → 前端转为 Data URL
```

### 5.5 设置 Schema

`src/lib/settingsSchema.ts` 用数据驱动设置面板：

```ts
{
  id: 'editor.fontSize',
  category: 'common',
  title: 'Editor: Font Size',
  description: '控制编辑器字体大小（像素）。',
  controlType: 'input',
  value: 15,
  defaultValue: 15,
  min: 11,
  max: 28,
  suffix: 'px',
  keywords: ['字体', '字号'],
  preference: 'fontSize'
}
```

设置项可包含：

- `controlType`: `input` / `select` / `checkbox`
- `options`
- `keywords`
- `hint`
- `preference`：映射到 `Preferences`

设置文案通过 `src/lib/i18n.ts` 的 `t()` 获取；切换语言时 Schema 会重新计算，因此分类、描述、提示和下拉选项会同步更新。`i18n.ts` 同时负责系统语言检测（中文系统使用简体中文，其他系统使用 English）以及后端错误的英文映射。

工作区范围复用同一份 Schema，但只保留 `WORKSPACE_OVERRIDE_KEYS` 白名单中的偏好，并把每项的 `defaultValue` 替换为用户级偏好值。因此“已修改”表示该笔记库存在覆盖；重置通过 `resetWorkspace` 移除覆盖键，回落到用户设置，而不是写入默认值。

### 5.6 导出

`src/lib/exportContent.ts`：

- 使用与预览相同的 Markdown 渲染。
- 清洗 HTML。
- 解析本地图片为 Data URL。
- 渲染 Mermaid SVG。
- 生成独立 HTML。
- PDF 使用 `ExportPreviewDialog.vue` 的 iframe 分页，并从同一个 iframe 调用系统打印。
- `pagination.ts` 在 iframe 内按 A4 内容区测量块高，按段落行、列表条目和表格行拆分，生成固定页面。
- DOCX 通过 `docxExport.ts` 将渲染后的 DOM 转换为 Word 文档结构；`buildDocxPreviewDocument` 为其生成 Word 版式预览。

### 5.7 自动保存、会话与草稿

- 自动保存复用 `saveTab` 的快照式保存：只有磁盘写入成功且内容未再变化时才回填 `savedContent`；同一路径的并发保存由 `saveTasks` 合并。
- `App.vue` 按标签路径维护防抖计时器；内容变化后调度，保存成功但期间又有输入时重新调度；窗口失焦或页面隐藏时取消计时器并保存全部脏标签。
- 会话快照（`src/lib/session.ts`）只保存路径与位置，按 `notesDir` 分区，最多保留 10 个工作区。
- 启动与切换笔记库时，先用 `entries` 校验会话中的文件仍存在，再并行读取笔记并一次性构造标签；`nextTick` 后调用 `EditorPane.restoreState`，避免逐个 `openNote` 导致多次编辑器重建。
- 草稿（`src/lib/drafts.ts`）以 `(notesDir, 相对路径)` 为键，避免不同笔记库中的同名文件互相覆盖。
- 草稿只在标签仍脏时写入（2s 空闲，最长 15s），保存成功、关闭标签、删除或重命名时同步清理或迁移。
- 启动时草稿自动载入为脏标签，并在工作区顶部显示恢复提示；不会立即写回磁盘。
- 工作区偏好（`src/lib/workspaceSettings.ts`）只保存被覆盖的键，按 `notesDir` 分区，最多保留最近更新的 20 个笔记库；读取时与用户偏好合并并重新归一化，再由同一套 `applyPreferences` 应用到编辑器、主题和 Vim。

---

## 6. 安全设计

### 6.1 文件访问

- 所有路径必须位于当前笔记库内。
- 拒绝路径穿越。
- 拒绝符号链接。
- 文件树跳过隐藏文件和无效名称。
- 文件和目录名称长度、路径长度有限制。
- 创建/重命名时检查 Windows 保留名称和非法字符。

### 6.2 内容安全

- 预览中的 HTML 使用 DOMPurify 清洗。
- Milkdown 原始 HTML 节点同样使用 DOMPurify。
- Mermaid 使用 `securityLevel: 'strict'`。
- 外部链接只通过系统 opener 打开 `http(s)` / `mailto`。
- Tauri capability 只授权主窗口所需的最小权限：
  - 窗口关闭 / 最小化 / 最大化
  - 窗口拖动
  - 打开/保存对话框
  - 打开外部 URL
  - 读取系统剪贴板图片

### 6.3 资源限制

| 限制 | 数值 |
| --- | --- |
| 文件夹递归深度 | 32 |
| 文件/目录名称长度 | 120 字符 |
| 相对路径长度 | 1024 字符 |
| 图片大小 | 20 MB |
| 搜索文件大小 | 5 MB |
| 搜索关键词长度 | 200 字符 |
| 搜索结果数量 | 500 |

---

## 7. 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd+P` | 快速打开文件 |
| `Ctrl/Cmd+Shift+P` | 打开命令面板 |
| `Ctrl/Cmd+S` | 保存当前笔记 |
| `Ctrl/Cmd+Shift+M` | 切换 Zen 模式 |
| `Ctrl/Cmd+滚轮` | 调整字体大小 |
| `Ctrl/Cmd+=` / `Ctrl/Cmd++` | 放大界面 |
| `Ctrl/Cmd+-` | 缩小界面 |
| `Ctrl/Cmd+0` | 重置界面缩放 |
| `Ctrl/Cmd+D` | 源码编辑器选择下一个相同文本 |
| `Alt+点击` | 源码编辑器添加多光标 |
| `Ctrl/Cmd+V` | 粘贴图片（源码 / 实时预览） |
| `:w` | Vim 模式保存 |
| Normal 模式 `<Space>p` | 粘贴图片（可自定义，默认映射） |
| `:pasteimage` / `:pa` | Vim 模式从系统剪贴板粘贴图片 |
| `Esc` | 关闭菜单 / 设置 / Vim 命令输入 |

---

## 8. 开发与运行

### 8.1 环境要求

- Node.js 20+（当前开发环境为 Node 26）
- npm
- Rust 1.77+
- Tauri 2 CLI
- Linux 下需要 WebKitGTK / GTK 等 Tauri 系统依赖

安装 Tauri CLI（如果尚未安装）：

```bash
cargo install tauri-cli --version "^2"
```

### 8.2 安装依赖

```bash
npm install
```

### 8.3 开发模式

```bash
cargo tauri dev
```

该命令会：

1. 启动 Vite 开发服务器。
2. 编译 Rust 开发版本。
3. 启动桌面窗口。
4. 在源码修改时热更新前端。

前端单独构建预览可以使用：

```bash
npm run dev
```

但涉及 Tauri API 的功能需要在 `cargo tauri dev` 中运行。

### 8.4 类型检查与构建

```bash
npm run build
```

该命令执行：

```text
vue-tsc --noEmit
vite build
```

### 8.5 测试

前端：

```bash
npm test
```

监听模式：

```bash
npm run test:watch
```

Rust：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

当前测试情况：

- 前端：62 个测试文件，363 个测试通过
- Rust：26 个测试通过

覆盖范围包括：

- Markdown 代码高亮与标题锚点
- 锚点查找与中文 slug
- 预览滚动同步
- 预览锚点点击
- 标题面包屑路径提取与渲染
- LF / CRLF
- ProseMirror 多光标
- 偏好设置（含自动保存与恢复会话偏好）
- 会话快照校验、裁剪与工作区容量
- 崩溃草稿的写入、淘汰、重命名与工作区隔离
- 外部文件修改分类（忽略、采纳、重载、冲突）与冲突副本路径
- Rust 原子保存、临时文件清理、残留清理与权限保留
- 文件系统监听事件、相对路径过滤、临时/隐藏文件忽略与运行中错误事件
- 状态栏保存状态
- 图片命名模板、名称清洗、格式映射与 Markdown 路径编码
- 图片命名弹窗的确认、取消、空名称校验与预览
- Vim 自定义键位映射解析（模式/命令校验、注释、去重、数量上限）
- Vim 命令注册与映射应用不抛错
- 源码编辑器挂载与初始 Markdown 内容渲染
- 源码编辑器块插入（上下文空行、选区替换、光标位置）
- 源码围栏代码块的代码主题背景与 token 配色（含自定义代码主题 CSS）
- 快速打开模糊匹配、排序、最近文件优先与模糊得分加权、文件/图片过滤
- 最近文件去重、容量限制、工作区隔离与 localStorage 往返
- 快速面板筛选、键盘导航、空状态、关闭、输入法组合键、`>` 命令前缀、`@` 标题搜索、Backspace 返回文件与结果数量上限
- 最近文件清理、失效路径裁剪与清除命令
- 工作区偏好：键白名单、合并/移除、容量上限与 localStorage 往返
- 设置面板的用户/工作区范围、覆盖标记、重置按钮与工作区编辑事件
- 标签拖拽排序与松手清理
- 最近文件组合式状态与持久化
- 自动保存组合式计时器：延迟保存、取消、模态阻塞重试与保存期间继续编辑
- 会话组合式持久化：防抖、最大间隔、恢复期间跳过与定时器取消
- 会话恢复计划：标签/预览回退、草稿覆盖与清理、孤儿草稿、布局与光标状态
- 工作区生命周期：启动恢复、切换前保存、取消切换与恢复失败回退
- 窗口关闭流程：等待保存、取消/确认、错误恢复与重复关闭保护
- 关闭前保存：自动保存跳过确认、失败重试、放弃草稿与弹窗阻塞
- PDF / HTML / DOCX 导出准备、保存、取消与导出后打开
- 崩溃草稿组合式刷新：脏标签写入、干净标签清理、抑制状态与图片跳过
- 命令面板/主题候选定义、开关状态、禁用条件与当前主题标记
- 外部变更组合式同步：事件累积、防抖、阻塞恢复、回调重试与销毁
- App 级集成：启动、监听失败提示、快速打开最近排序、`>` 命令切换、视图命令、工作区偏好应用、无关文件忽略、外部重载、冲突保留/重载/另存副本、图片刷新与外部删除
- 设置浮层在命令面板打开时的键盘暂停，以及模态关闭后的焦点恢复
- Markdown 标题提取与列表式目录生成（层级、范围、转义、重复标题）
- Rust 图片保存目录、嵌套笔记相对路径、目录穿越与符号链接拒绝
- 中英文界面、系统语言检测与切换
- HTML 导出模式、目录和图片策略
- DOCX 原生列表、表格、公式、目录与页码
- DOCX 预览目录位置与独立分页
- 图片文件识别
- 主区域滚轮减速
- 源码缩略图几何与宽度映射
- 设置 Schema / 搜索
- 设置面板交互
- 自定义下拉框
- 状态栏模式与 Vim 状态
- Rust 文件系统、安全路径、图片、搜索与重命名

### 8.6 发布构建

```bash
cargo tauri build
```

当前产物：

```text
target/release/bundle/deb/Inker_0.1.0_amd64.deb
```

已发布 `v0.1.0`：<https://github.com/lencelg/inker/releases/tag/v0.1.0>。Release 附件中的 `.deb` 约 8.7 MiB，仅支持 Linux x86_64；仓库当前为私有，下载需要相应 GitHub 权限。

构建时可能出现 Vite 的 chunk 体积警告，但不影响构建结果。

### 8.7 应用图标

图标源文件：

```text
assets/icons/inker.svg
```

重新生成所有桌面和移动端图标：

```bash
cargo tauri icon assets/icons/inker.svg
```

生成结果位于 `src-tauri/icons/`，并会同步用于 Tauri 打包与网页 favicon。

---

## 9. 已知限制

1. **自动保存默认关闭；外部修改需要人工选择** — 默认需要 `Ctrl/Cmd+S` 或 Vim `:w` 手动保存，可在设置中开启自动保存。应用会监听笔记文件夹：干净标签自动重载，有未保存修改的标签会提示“重新加载 / 保留我的修改 / 另存副本”。若文件被外部删除，未保存内容会保留在标签页中，可通过“另存副本”保存到新路径。关闭未保存标签时仍会提示。

2. **没有云同步**  
   所有文件都在本地，不包含账户、同步、冲突处理或加密。

3. **工作区设置只覆盖部分偏好**  
   界面语言与会话恢复保持全局；工作区覆盖保存在本机 localStorage（最多 20 个笔记库），清理 WebView 数据后会丢失。

4. **导出仍有平台边界**
   PDF 仍通过系统打印对话框生成，不直接写 PDF 文件；HTML 链接图片模式需要图片与 HTML 一起移动；远程图片内嵌受网络与 CORS 限制，失败时会保留原链接并提示。

5. **Vim 仅用于源码编辑器**  
   实时预览（ProseMirror）使用标准输入和自身多光标。

6. **PDF 依赖系统打印**  
   PDF 通过打印预览和系统打印对话框生成，不直接由后端写 PDF 文件。

7. **搜索不包含图片内容/名称**  
   搜索只针对 Markdown 文本。

8. **预览同步是基于块锚点的近似同步**  
   对非常复杂的自定义 HTML、动态布局或超大文档，滚动位置仍可能存在偏差。

9. **未支持分屏编辑器、多窗口**  
   当前每个窗口只有一个编辑工作区。

10. **只能导入受控格式的主题**
    自定义界面主题仅支持语义颜色变量 JSON，不能改变布局；自定义代码主题支持 VS Code 主题 JSON 或旧版 highlight.js CSS，但只做颜色/字体样式映射，不包含 LSP 语义高亮。导入主题存储于 localStorage，清理 WebView 数据后会丢失。

11. **目前仅打包 `.deb`**
    其他平台安装包需要修改 Tauri bundle 配置。

12. **会话与草稿依赖 WebView localStorage**
    清理 WebView 数据会丢失会话与草稿。单条草稿超过 256 KB、总量超过约 2 MB 或条目超过 20 条时不会写入；自动保存关闭时，这类大文件没有崩溃恢复保护。

13. **图片粘贴转换有格式边界**
    只输出 PNG / JPEG / WebP；GIF 粘贴后只保留首帧，SVG 会被栅格化，JPEG 透明区域填白。同格式图片直接透传，质量设置不会重新编码。WebView 不支持 WebP 编码时会提示改用 PNG。撤销插入不会删除已保存的图片文件，重复粘贴也不会自动去重；多光标时图片只插入主光标处。远程图片 URL 不会被下载。

14. **快速打开与目录生成的范围有限**
    快速打开只按文件名和相对路径匹配，不搜索笔记正文；默认不列出图片。生成目录包含文档中的 H1–H6 标题（包括引用和列表中的标题，围栏代码块内的 `#` 不计入），输出为列表链接，且仅支持源码与侧边预览模式；实时预览 / 纯预览模式会提示切换。

---

## 10. 后续可扩展方向

- 图片复制、在文件管理器中显示
- 笔记模板、日记模式
- 全文搜索索引与更细粒度过滤
- 多平台打包（AppImage、macOS、Windows）
- 可选的笔记加密与同步

---

## 11. 项目定位

Inker 的目标是一个轻量、离线优先、文件可迁移的 Markdown 笔记桌面工具：

- 不使用专有数据库锁住内容。
- 所有笔记都是普通 Markdown 文件。
- 渲染、编辑和导出能力尽量在本地完成。
- 使用 Tauri 控制安装体积和内存占用。
- 在编辑体验上靠近 VS Code：文件树、标签页、快速打开与命令面板、Vim、状态栏和设置面板。
