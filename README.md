<p align="center">
  <img src="assets/icons/inker.svg" width="96" height="96" alt="Inker" />
</p>

<h1 align="center">Inker</h1>

<p align="center">
  本地优先的 Markdown 笔记桌面应用
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Linux-informational" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

**Inker** 是一款基于 **Tauri 2 + Vue 3 + Rust** 的 Markdown 笔记应用。它不依赖数据库或云端服务，所有笔记都以普通的 `.md` / `.markdown` 文件保存在你选择的文件夹中——你可以随时用任何编辑器打开、用 Git 管理、或同步到自己的网盘。

Inker 的名字来自 **Ink（墨水）**：写作应当像落墨一样直接、安静、不被打断。应用把 VS Code 式的效率工具（文件树、多标签、快速打开、命令面板、Vim）与 Markdown 写作体验（实时预览、数学公式、图表、多格式导出）放在同一个轻量桌面窗口里。

## 安装

### 下载安装包（推荐）

前往 [Releases](https://github.com/lencelg/inker/releases/latest) 下载最新的 Debian 安装包：

```bash
sudo apt install ./Inker_0.1.0_amd64.deb
```

安装完成后，在应用菜单中启动 **Inker**，首次启动时选择你的笔记文件夹即可开始写作。

> 当前仅提供 Linux x86_64 的 `.deb` 包。其他平台需要从源码构建。

### 从源码构建

需要以下环境：

- Node.js 20+
- Rust stable
- Tauri 2 的系统依赖（Debian / Ubuntu）：

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

安装 Tauri CLI 并构建：

```bash
cargo install tauri-cli --version "^2"
git clone https://github.com/lencelg/inker.git
cd inker
npm install
cargo tauri build
```

构建产物位于 `target/release/bundle/deb/`。

### 开发

```bash
npm install
cargo tauri dev
```

前端测试与类型检查：

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## 功能

### 写作与编辑

- **多种编辑模式**：源码编辑、实时预览（WYSIWYG）、纯预览、侧边预览；侧边预览与源码滚动位置双向同步。
- **Vim 模式**：可选的 Vim 键位，支持自定义映射，例如在 Normal 模式用 `<Space>p` 粘贴图片。
- **多光标**：源码编辑器与实时预览均支持多光标编辑。
- **Markdown 增强**：任务列表、表格、KaTeX 数学公式、Mermaid 图表、清洗后的原始 HTML。
- **代码高亮**：源码代码块与预览代码块独立开关，使用 Shiki/TextMate 和 VS Code 代码主题，可导入 VS Code 主题 JSON 或旧版 highlight.js CSS。
- **目录与导航**：标题面包屑、源码缩略图、`Markdown: Create Table Of Contents` 命令一键插入目录。
- **专注写作**：Zen 模式隐藏多余界面元素；底部状态栏显示光标位置、编辑模式、Vim 模式和保存状态。

### 文件与工作区

- **本地文件夹笔记库**：笔记就是磁盘上的普通 Markdown 文件，没有导入导出或数据库锁定。
- **文件树**：新建、重命名、回收站删除、拖拽调整文件栏宽度；支持 Markdown 与图片文件。
- **全文搜索**：按文件名、行号、列号和上下文片段定位笔记内容。
- **多标签页**：预览标签、固定标签、中键关闭、拖拽排序；标签顺序随会话保存。
- **快速打开**：`Ctrl/Cmd+P` 模糊搜索文件，空查询按最近打开顺序排列，输入 `@` 可搜索当前笔记标题并跳转到对应行。
- **命令面板**：`Ctrl/Cmd+Shift+P` 搜索并执行视图切换、主题、Vim、自动保存、导出、目录生成等命令。
- **最近文件**：按笔记库分别保存，失效路径自动清理。
- **工作区设置**：主题、字体、Vim、自动保存、图片和导出等偏好可以按笔记库独立覆盖，并可一键恢复为用户设置。

### 可靠性

- **自动保存**：可选开启（默认关闭），停止输入后按设定延迟保存；窗口失焦时立即保存。
- **会话恢复**：启动时恢复标签顺序、活动标签、光标与滚动位置、编辑模式、展开的文件夹和侧栏状态。
- **崩溃草稿**：自动保存关闭时，未保存内容会持续写入本机草稿，启动时自动恢复为未保存状态。
- **外部文件变更监听**：笔记文件夹被其他程序修改时，干净标签自动重载；有未保存修改时提供“重新加载 / 保留我的修改 / 另存副本”选择。
- **原子保存**：通过同目录临时文件 + 原子重命名写入，避免留下半截文件。
- **关闭保护**：关闭窗口前保存全部修改，或在存在未保存内容时请求确认。

### 图片

- 从剪贴板粘贴或拖拽图片到源码编辑器、实时预览，或通过 Vim 命令插入。
- 自定义命名模板、保存格式（PNG / JPEG / WebP）、质量和工作区相对目录。
- 图片以独立标签页打开，支持缩放与拖动查看。
- 可确认命名，也可直接按模板静默保存。

### 主题与个性化

- 内置暖白、白色、深色、Monokai、Nord、Dracula、Gruvbox、Solarized 等界面主题，以及多套 TextMate/VS Code 代码高亮主题。
- 支持“界面主题 + 代码主题”联动预设，也可单独调整后显示为自定义。
- 支持导入受控格式的自定义界面主题与代码主题。
- 可选择编辑器字体、字号与预览字体行为。
- 简体中文 / English 界面，默认跟随系统语言，切换后立即生效。
- `Ctrl/Cmd + 滚轮` 快速调整字号。

### 导出

- **HTML**：可选择内嵌图片或保留图片链接，预览文件体积与警告，可选生成目录。
- **Word `.docx`**：分页预览后生成原生 Word 文档，保留多级列表、表格、代码块、公式、图片、目录和页码。
- **PDF**：应用内 A4 分页预览，复用同一份分页 DOM 调用系统打印。
- 统一 A4 版式、页边距、页码与强制分页标记（`\pagebreak` / `\newpage`）。

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + P` | 快速打开文件 |
| `Ctrl/Cmd + Shift + P` | 命令面板 |
| `Ctrl/Cmd + S` | 保存当前笔记 |
| `Ctrl/Cmd + Shift + M` | 切换 Zen 模式 |
| `Ctrl/Cmd + 滚轮` | 调整编辑器字号 |
| `Ctrl/Cmd + =` / `Ctrl/Cmd + +` | 放大界面 |
| `Ctrl/Cmd + -` | 缩小界面 |
| `Ctrl/Cmd + 0` | 重置界面缩放 |
| `@`（快速打开中） | 搜索当前笔记标题 |
| `>`（快速打开中） | 切换到命令模式 |

## 数据与隐私

- 笔记只保存在本地文件夹，Inker 不上传任何内容。
- 会话、草稿、最近文件和偏好保存在 WebView 的 localStorage 中，清理 WebView 数据会重置这些状态，但不会影响笔记文件。
- 目前不包含账户、云同步、遥测或加密功能。

## 文档

架构、实现细节、已知限制和开发约定见 [OVERVIEW.md](OVERVIEW.md)。

## 许可证

[MIT](LICENSE)
