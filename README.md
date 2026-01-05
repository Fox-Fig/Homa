<div align="center">
  <img src="logo/logo.png" alt="Homa Logo" width="128" height="128">
  <h1>Homa</h1>
  <h3>Advanced V2Ray Client for Browser</h3>
  <p>
    <b>Powered by <a href="https://t.me/foxfig">Foxfig</a></b>
  </p>
  <p>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3">
    </a>
    <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  </p>
  <p>
    <b>English Version | <a href="README_fa.md">نسخه فارسی</a></b>
  </p>
</div>

---

### Introduction
**Homa** is a cutting-edge V2Ray client extension aimed at seamless integration with modern web browsers (Chrome, Edge, Firefox, Brave). Unlike traditional extensions that rely on external applications, Homa comes with a **Native Messaging Host** bridge that manages the Xray Core directly, providing a robust and stable connection without the need for third-party GUI clients.

> **Homa is currently the ONLY solution available that brings full, native V2Ray configuration support directly to your web browser.**

### 🚀 Key Features
- **Smart Installer:** Automatic setup of Native Messaging Hosts and registry keys for all supported browsers.
- **Cross-Browser Support:** Fully compatible with Chromium-based browsers (Chrome, Edge, Brave, Vivaldi) and Mozilla Firefox.
- **Embedded Xray Core:** Automatically manages the Xray core for VLESS, VMess, Trojan, and Shadowsocks protocols.
- **Native Performance:** Direct communication between the browser and the core for minimal latency.

---

### 📥 Installation Guide

To use Homa, you need to install two components: the Browser Extension (UI) and the Host Application (Bridge).

#### Step 1: Install the Extension
Install Homa directly from your browser's extension store:

- **Chrome / Brave / Edge:** [Install from Chrome Web Store](#) (Link coming soon)
- **Firefox:** [Install from Firefox Add-ons](#) (Link coming soon)

#### Step 2: Install the Host Application
The Native Host application is required for the extension to work.

**Windows:**
1. Download `homa-installer.exe` from the [Releases Page](https://github.com/your-username/homa/releases).
2. Run the installer and follow the on-screen prompts.

**macOS (Experimental):**
> ⚠️ **Note:** The macOS version is currently experimental and untested.
1. Download the macOS binary.
2. Open Terminal and run:
   ```bash
   chmod +x homa-installer-darwin
   ./homa-installer-darwin
   ```

**Linux (Experimental):**
> ⚠️ **Note:** The Linux version is currently experimental and untested.
1. Download the Linux binary.
2. Open Terminal and run:
   ```bash
   chmod +x homa-installer-linux
   ./homa-installer-linux
   ```

**Done!** You can now open Homa in your browser and connect.

---

### 🛠️ Development & Build
For developers who want to build from source or contribute:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/homa.git
   cd homa
   go mod tidy
   ```
2. **Build:**
   ```powershell
   build_installers.bat
   ```

### 🤝 Contribution
Contributions are welcome! Please feel free to submit a Pull Request or open an Issue.

**Technical Challenge (WebAssembly):**
We attempted to port the Xray Core to WebAssembly (WASM) to eliminate the need for the native host application, but we faced technical limitations. If you have expertise in this area, we would love your help! Solving this would be a game-changer for the project.

**Need a new feature?**
If you have an idea for a feature that is missing, please let us know! We love hearing from our community.

### 📄 License
This project is licensed under the **GPLv3** License.

---
<div align="center">
  <p>Made with ❤️ at <a href="https://t.me/foxfig">FoxFig</a></p>
</div>
