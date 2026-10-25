# Inker

一个基于 **Tauri 2 + Vue 3** 的本地优先 Markdown 笔记桌面应用。

Inker 不依赖数据库或云端服务，笔记以普通 `.md` / `.markdown` 文件保存在用户选择的文件夹中。应用提供文件树、全文搜索、多标签页、源码编辑、实时预览、Mermaid、KaTeX、图片、Vim、主题和多格式导出等能力。

- 当前版本：`0.1.0`
- 应用标识：`com.lencelg.markdownnotes`（为兼容已有配置保持不变）
- 界面语言：中文
- 主要开发环境：Linux / Wayland / niri
- 发布包：Debian `.deb`（编译产物约 8 MiB）

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
| 代码高亮 | `highlight.js` |
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
@codemirror/*                CodeMirror 6 编辑器
@milkdown/*                  Markdown WYSIWYG 编辑器
@replit/codemirror-vim       Vim 键位与命令
markdown-it                  Markdown 解析
highlight.js                 代码语法高亮
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
serde / serde_json
trash                        文件移入系统回收站
base64                       图片读写
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

### 2.5 源码编辑器

- Markdown 语法高亮。
- 自动换行。
- 行号、当前行、搜索等 CodeMirror 基础能力。
- 多光标：
  - `Mod+D` 选择下一个相同文本
  - `Alt+点击` 添加光标
  - 支持折叠/展开多光标
- 可选 Vim 模式。
- Vim 支持 Normal / Insert / Visual / V-Line / V-Block 等模式。
- Vim 模式状态和 `:` 命令输入行均整合在应用底部状态栏，不再额外占用编辑器行。
- 支持 `:w` 保存。
- 可通过设置关闭源码模式中围栏代码块的语法高亮，默认开启；Markdown 语法高亮不受影响。

### 2.6 实时预览编辑器

基于 Milkdown 7 和 ProseMirror：

- GFM 基础语法。
- 数学公式。
- Mermaid 图表。
- 代码块语法高亮（可跟随“预览代码高亮”设置），右上角显示当前语言。
- 代码高亮主题可切换，内置 GitHub Dark、GitHub Light、Atom One Dark、Monokai、Nord、Tokyo Night 和 VS Dark，默认 GitHub Dark。
- 代码主题同时作用于预览和实时预览，切换后立即生效。
- 原始 HTML 渲染（经 DOMPurify 清洗）。
- 本地图片解析。
- 粘贴、拖拽图片时保存到当前笔记所在目录的 `assets/` 文件夹。
- 多光标。
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
- WYSIWYG 中粘贴/拖拽图片会写入 `assets/`。
- 图片读取有 20 MB 上限。
- 图片重命名会保留文件类型。

### 2.10 沉浸式写作

- 打字机模式：当前行保持居中。
- 淡化非当前段落/内容。
- 支持源码编辑器与实时预览编辑器。
- 状态栏可切换沉浸式写作，快捷键为 `Ctrl/Cmd+Shift+M`。

### 2.11 主题与字体

内置主题：

- 暖白
- 白色
- 深色
- VS Code Light+
- VS Code Dark+
- VS Code 高对比

内置等宽字体：

- JetBrains Mono
- Fira Code
- Source Code Pro
- 系统等宽

- 字体大小可调，快捷键为 `Ctrl/Cmd + 鼠标滚轮`。
- 设置面板会跟随当前应用主题。
- 下拉框为自定义组件，弹层样式与主题一致。

### 2.12 设置面板

采用类似 VS Code 的浮动设置面板：

- 半透明遮罩与背景模糊。
- 面板宽高约为窗口的 80%。
- 顶部搜索、清除、过滤和窗口按钮。
- 左侧“用户 / 工作区”标签页。
- 可折叠分类树。
- 分类：
  - 常用设置
  - 文本编辑器
  - 预览
  - 导出
- 设置项支持：
  - 数字输入
  - 下拉选择
  - 复选框
  - 修改状态标记
  - 恢复默认链接
- 支持实时搜索过滤并高亮匹配分类。
- 支持“仅显示已修改的设置”。
- 点击分类平滑滚动到对应区域。
- 滚动内容时自动同步左侧选中分类。
- 设置变更立即应用到工作台。

### 2.13 导出

支持三种导出：

| 格式 | 实现 |
| --- | --- |
| HTML | 生成独立 HTML 文件，包含样式、高亮代码、内嵌图片与图表 |
| Word `.docx` | 使用 `docx` 生成文档，支持标题、列表、表格、代码、图片等 |
| PDF | 打开打印预览，通过系统打印对话框保存为 PDF |

导出会复用当前 Markdown 渲染结果与代码高亮设置。

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

- `http(s)` 与 `mailto` 链接使用系统默认应用打开。
- 内部 `#anchor` 链接由 Markdown 预览自行处理。

---

## 3. 当前实现情况

| 能力 | 状态 |
| --- | --- |
| 本地文件夹笔记库 | ✅ 已完成 |
| Markdown / 图片文件树 | ✅ 已完成 |
| 文件树宽度调整 | ✅ 已完成 |
| 新建 / 重命名 / 回收站删除 | ✅ 已完成 |
| 全文搜索 | ✅ 已完成 |
| 多标签页、预览标签、固定标签 | ✅ 已完成 |
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
| 图片粘贴/拖拽到 `assets/` | ✅ 已完成 |
| 目录锚点跳转 | ✅ 已完成 |
| 沉浸式写作 | ✅ 已完成 |
| 主题 / 字体 / 字号 | ✅ 已完成 |
| 代码高亮主题切换 | ✅ 已完成 |
| VS Code 风格设置面板 | ✅ 已完成 |
| HTML / Word / PDF 导出 | ✅ 已完成 |
| Debian `.deb` 打包 | ✅ 已完成 |
| “工作区”设置 | ⚠️ 目前为空状态占位 |
| 导出分类中的选项 | ⚠️ 目前只更新设置面板内状态，尚未接入导出流程 |
| 云同步 / 多设备同步 | ❌ 未实现 |
| 自动保存 | ❌ 未实现，需手动保存 |
| 笔记加密 | ❌ 未实现 |
| 多窗口编辑 | ❌ 未实现 |

---

## 4. 代码架构

### 4.1 目录结构

```text
markdown-note-taking/
├── index.html
├── package.json
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
│   ├── components/
│   │   ├── ActivityRail.vue       # 左侧活动栏
│   │   ├── NoteSidebar.vue        # 文件树与右键菜单
│   │   ├── SearchPanel.vue        # 全文搜索
│   │   ├── EditorTabs.vue         # 标签页
│   │   ├── EditorPane.vue         # CodeMirror / Vim
│   │   ├── WysiwygPane.vue        # Milkdown 实时预览
│   │   ├── PreviewPane.vue        # Markdown 只读预览
│   │   ├── ImagePane.vue          # 图片查看器
│   │   ├── StatusBar.vue          # 底部状态栏
│   │   ├── AppMenu.vue            # 顶部应用菜单
│   │   ├── SettingsOverlay.vue    # 设置浮层
│   │   ├── SettingsPanel.vue      # 设置状态编排
│   │   ├── ConfirmDialog.vue
│   │   ├── PromptDialog.vue
│   │   ├── PrintPreview.vue
│   │   ├── InkerMark.vue
│   │   └── settings/
│   │       ├── SettingsHeader.vue
│   │       ├── SettingsSidebar.vue
│   │       ├── SettingsContent.vue
│   │       ├── SettingItem.vue
│   │       └── SettingsSelect.vue
│   └── lib/
│       ├── anchors.ts             # 标题 slug / 锚点查找 / 滚动
│       ├── codeHighlight.ts       # highlight.js token 范围映射
│       ├── codeThemes.ts          # 代码高亮主题与动态样式
│       ├── docxExport.ts          # DOCX 内容转换
│       ├── exportContent.ts       # HTML / PDF / 导出准备
│       ├── fileKinds.ts           # 图片扩展名识别
│       ├── imageView.ts           # 图片缩放与平移计算
│       ├── fonts.ts               # 字体列表
│       ├── lineEndings.ts         # LF / CRLF 处理
│       ├── markdown.ts            # markdown-it 渲染配置
│       ├── mermaid.ts             # Mermaid 延迟加载
│       ├── paths.ts               # 路径工具
│       ├── preferences.ts         # 本地偏好读写
│       ├── previewSync.ts         # 预览滚动映射
│       ├── proseMultiCursor.ts    # ProseMirror 多光标
│       ├── settingsSchema.ts      # 设置面板 Schema
│       ├── themes.ts              # 主题列表
│       ├── viewModes.ts           # 编辑模式定义
│       └── vimMode.ts             # Vim 模式名称格式化
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs
        ├── lib.rs                 # Tauri 启动与命令注册
        ├── commands.rs            # Tauri 命令层
        ├── notes.rs               # 文件系统、搜索、图片、安全检查
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
- 沉浸式写作
- 设置浮层
- 导出与打印预览
- 错误、确认框、输入框
- Tauri 窗口状态

`EditorTabs`、`NoteSidebar`、`StatusBar` 等组件通过 props 接收状态，通过事件把用户操作交回 `App.vue`。

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
| `inker-immersive` | 沉浸式写作 |
| `inker-code-highlight` | 预览代码高亮 |
| `inker-code-theme` | 代码高亮主题 |
| `inker-source-highlight` | 源码代码块语法高亮 |
| `inker-split-ratio` | 侧边预览分隔比例 |
| `inker-sidebar-width` | 文件栏宽度 |

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
- 使用 `highlight.js` 自动或显式语言高亮。

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

### 5.4 图片处理

上传：

```text
粘贴/拖拽图片
  → 前端读取为 Base64
  → api.saveImage()
  → save_note_image()
  → 写入笔记同目录下 assets/
  → 返回相对路径
  → 插入 Markdown 图片节点
```

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

### 5.6 导出

`src/lib/exportContent.ts`：

- 使用与预览相同的 Markdown 渲染。
- 清洗 HTML。
- 解析本地图片为 Data URL。
- 渲染 Mermaid SVG。
- 生成独立 HTML。
- PDF 使用 `PrintPreview.vue` 的 iframe 和系统打印。
- DOCX 通过 `docxExport.ts` 将渲染后的 DOM 转换为 Word 文档结构。

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
| `Ctrl/Cmd+S` | 保存当前笔记 |
| `Ctrl/Cmd+Shift+M` | 切换沉浸式写作 |
| `Ctrl/Cmd+滚轮` | 调整字体大小 |
| `Ctrl/Cmd+D` | 源码编辑器选择下一个相同文本 |
| `Alt+点击` | 源码编辑器添加多光标 |
| `:w` | Vim 模式保存 |
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

- 前端：16 个测试文件，60 个测试通过
- Rust：14 个测试通过

覆盖范围包括：

- Markdown 代码高亮与标题锚点
- 锚点查找与中文 slug
- 预览滚动同步
- 预览锚点点击
- LF / CRLF
- ProseMirror 多光标
- 偏好设置
- 图片文件识别
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

1. **未实现自动保存**  
   当前需要 `Ctrl/Cmd+S` 或 Vim `:w` 手动保存。关闭未保存标签时会提示。

2. **没有云同步**  
   所有文件都在本地，不包含账户、同步、冲突处理或加密。

3. **“工作区”设置仍未实现**  
   设置面板中的“工作区”标签目前显示占位说明，还没有独立覆盖配置。

4. **导出分类中的设置尚未接入导出流程**  
   当前可交互，但默认格式、是否嵌入图片、导出后打开等选项还没有驱动实际导出行为。代码高亮主题目前也只应用于预览和实时预览，导出文件使用固定代码样式。

5. **Vim 仅用于源码编辑器**  
   实时预览（ProseMirror）使用标准输入和自身多光标。

6. **PDF 依赖系统打印**  
   PDF 通过打印预览和系统打印对话框生成，不直接由后端写 PDF 文件。

7. **搜索不包含图片内容/名称**  
   搜索只针对 Markdown 文本。

8. **预览同步是基于块锚点的近似同步**  
   对非常复杂的自定义 HTML、动态布局或超大文档，滚动位置仍可能存在偏差。

9. **未支持标签拖拽排序、分屏编辑器、多窗口**  
   当前每个窗口只有一个编辑工作区。

10. **目前仅打包 `.deb`**  
    其他平台安装包需要修改 Tauri bundle 配置。

---

## 10. 后续可扩展方向

- 工作区级设置覆盖
- 自动保存与保存状态恢复
- 最近打开文件 / 会话恢复
- 自动生成目录
- 标签拖拽排序
- 图片缩放、复制、在文件管理器中显示
- 导出选项与导出流程打通
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
- 在编辑体验上靠近 VS Code：文件树、标签页、命令面板式菜单、Vim、状态栏和设置面板。
