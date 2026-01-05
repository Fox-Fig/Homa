#!/bin/bash

echo "Building Homa Single-Binary Installers (Cross-Platform)..."

mkdir -p release
mkdir -p cmd/homa-installer/embedded

echo ""
echo "[ICONS] Generating Icons..."
go run icon_gen.go || { echo "Icon generation failed"; exit 1; }

echo ""
echo "[EXT] Building Extensions..."
go run builder.go || { echo "Extension build failed"; exit 1; }

build_target() {
    local T_OS=$1
    local T_ARCH=$2
    
    local OUT_NAME="homa-installer-${T_OS}-${T_ARCH}"
    if [ "$T_OS" == "windows" ]; then
        OUT_NAME="homa-installer-windows.exe"
    fi
    
    echo ""
    echo "[${T_OS}/${T_ARCH}] 1. Building Host..."
    # Always output as homa-host.exe because the installer embeds this specific filename
    GOOS=$T_OS GOARCH=$T_ARCH go build -o cmd/homa-installer/embedded/homa-host.exe ./cmd/homa-host || return 1
    
    echo "[${T_OS}/${T_ARCH}] 2. Building Installer (Embedding Host)..."
    GOOS=$T_OS GOARCH=$T_ARCH go build -o release/$OUT_NAME ./cmd/homa-installer || return 1
    
    echo "[${T_OS}/${T_ARCH}] Done."
}

build_target windows amd64 || exit 1
build_target linux amd64 || exit 1
build_target darwin amd64 || exit 1
build_target darwin arm64 || exit 1

echo "----------------------"
echo "Build Success! Check 'release' folder."
echo "----------------------"
