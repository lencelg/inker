
<p align="center">
  <img src="assets/icons/inker.svg" width="96" height="96" alt="Inker" />
</p>

<h1 align="center">Inker</h1>

<p align="center">
  本地 Markdown 笔记桌面应用
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.2-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Linux-informational" />
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-green" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

---

> [!WARNING]
> 这个应用是有agent生成的，很少有人工的代码审核。我构建这个应用只是为了个人使用

**Inker** 是一款基于 **Tauri 2 + Vue 3 + Rust** 的 Markdown 笔记应用。

## 安装

### 下载安装包

前往 [Releases](https://github.com/lencelg/inker/releases/latest) 下载对应的安装包：

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

## 文档

见 [OVERVIEW.md](OVERVIEW.md)。

## 许可证

Copyright (C) 2026 lencelg。

Inker 以 [GNU General Public License v3.0](LICENSE) 发布。
