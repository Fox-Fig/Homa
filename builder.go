package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

func main() {
	fmt.Println("--- Building Extensions ---")

	srcDir := "extension"
	releaseDir := "release"

	// 1. Build Chrome Version (Copy As-Is)
	fmt.Println("Building Chrome Version...")
	destChrome := filepath.Join(releaseDir, "extension-chrome")
	if err := copyDir(srcDir, destChrome); err != nil {
		panic(err)
	}

	// 2. Build Firefox Version (Convert SW to Page for ES Module support)
	fmt.Println("Building Firefox Version...")
	destFirefox := filepath.Join(releaseDir, "extension-firefox")
	if err := copyDir(srcDir, destFirefox); err != nil {
		panic(err)
	}

	// Modify Firefox Manifest
	manifestPath := filepath.Join(destFirefox, "manifest.json")
	if err := modifyManifestForFirefox(manifestPath); err != nil {
		panic(err)
	}

	// Create background.html for Firefox
	bgHtmlPath := filepath.Join(destFirefox, "background.html")
	bgHtmlContent := `<script type="module" src="background.js"></script>`
	if err := os.WriteFile(bgHtmlPath, []byte(bgHtmlContent), 0644); err != nil {
		panic(err)
	}

	fmt.Println("Extensions Built Successfully!")
}

func copyDir(src string, dst string) error {
	// Clean destination first
	os.RemoveAll(dst)
	os.MkdirAll(dst, 0755)

	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath, _ := filepath.Rel(src, path)
		if relPath == "." {
			return nil
		}
		destPath := filepath.Join(dst, relPath)

		if d.IsDir() {
			return os.MkdirAll(destPath, 0755)
		}

		// Copy file
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()

		out, err := os.Create(destPath)
		if err != nil {
			return err
		}
		defer out.Close()

		_, err = io.Copy(out, in)
		return err
	})
}

func modifyManifestForFirefox(path string) error {
	// Read
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	// Parse to map
	var manifest map[string]interface{}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return err
	}

	// Remove "key" for Firefox
	delete(manifest, "key")
	delete(manifest, "oauth2") // Firefox doesn't support oauth2 key in MV3 easily or doesn't need it same way

	// Add browser_specific_settings
	browserSettings := map[string]interface{}{
		"gecko": map[string]interface{}{
			"id":                 "foxfig.official@proton.me",
			"strict_min_version": "142.0",
			"data_collection_permissions": map[string]interface{}{
				"required": []string{"none"},
				"optional": []string{},
			},
		},
	}
	manifest["browser_specific_settings"] = browserSettings

	// Modify "background"
	// From: "service_worker": "background.js", "type": "module"
	// To: "page": "background.html"
	if bg, ok := manifest["background"].(map[string]interface{}); ok {
		delete(bg, "service_worker")
		delete(bg, "type")
		bg["page"] = "background.html"
		manifest["background"] = bg
	}

	// Write back
	newData, err := json.MarshalIndent(manifest, "", "    ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, newData, 0644)
}
