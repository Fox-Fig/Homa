package downloader

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"v2rayng-extension/internal/ui"
)

const (
	XrayWin   = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip"
	XrayMac   = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-macos-64.zip"
	XrayLinux = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip"
)

func DownloadXray(destDir string) error {
	url := XrayLinux
	if runtime.GOOS == "windows" {
		url = XrayWin
	} else if runtime.GOOS == "darwin" {
		url = XrayMac
	}

	ui.Info(fmt.Sprintf("Downloading Xray Core from %s...", url))

	// Temp zip
	tmpZip := filepath.Join(os.TempDir(), "xray_temp.zip")

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	out, err := os.Create(tmpZip)
	if err != nil {
		return err
	}

	_, err = io.Copy(out, resp.Body)
	out.Close()

	// Unzip
	ui.Info("Extracting Xray...")
	if err := unzip(tmpZip, destDir); err != nil {
		return err
	}

	os.Remove(tmpZip)
	return nil
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		// Filter: We only want executables and geo files usually,
		// but standard is to keep all.
		// Simplify structure?
		// XTLS zips usually have immediate files.

		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		io.Copy(outFile, rc)

		outFile.Close()
		rc.Close()
	}
	return nil
}
