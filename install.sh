#!/bin/bash
set -e

REPO="foxfig/homa"
TMP_DIR="/tmp/homa-install"

echo "======================================"
echo "   Homa Installer (Linux / macOS)     "
echo "======================================"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TARGET="linux";;
    Darwin*)    OS_TARGET="darwin";;
    *)          echo "Unsupported OS: ${OS}"; exit 1;;
esac

# Detect Architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64*)    ARCH_TARGET="amd64";;
    arm64*)     ARCH_TARGET="arm64";;
    aarch64*)   ARCH_TARGET="arm64";;
    *)          echo "Unsupported Architecture: ${ARCH}"; exit 1;;
esac

ASSET_NAME="homa-installer-${OS_TARGET}-${ARCH_TARGET}"

# Fetch latest release URL
echo "Fetching latest release information..."
LATEST_RELEASE_URL=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep "browser_download_url.*${ASSET_NAME}\"" | cut -d : -f 2,3 | tr -d \")

if [ -z "$LATEST_RELEASE_URL" ]; then
    echo "Error: Could not find asset ${ASSET_NAME} for the latest release."
    echo "Please check https://github.com/${REPO}/releases manually."
    exit 1
fi

mkdir -p "$TMP_DIR"
DOWNLOAD_PATH="${TMP_DIR}/${ASSET_NAME}"

echo "Downloading ${ASSET_NAME}..."
curl -L -# -o "${DOWNLOAD_PATH}" "${LATEST_RELEASE_URL}"

echo "Making installer executable..."
chmod +x "${DOWNLOAD_PATH}"

echo "Running Homa Installer..."
"${DOWNLOAD_PATH}"

echo "======================================"
echo "Installation complete!"
