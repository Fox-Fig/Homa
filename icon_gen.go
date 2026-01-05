package main

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"

	"golang.org/x/image/draw"
)

func main() {
	fmt.Println("--- Generating Icons ---")

	srcPath := filepath.Join("logo", "logo.png")
	srcFile, err := os.Open(srcPath)
	if err != nil {
		fmt.Printf("Error opening logo: %v\n", err)
		return
	}
	defer srcFile.Close()

	img, _, err := image.Decode(srcFile)
	if err != nil {
		fmt.Printf("Error decoding logo: %v\n", err)
		return
	}

	sizes := []int{16, 48, 128}
	destDir := filepath.Join("extension", "icons")
	os.MkdirAll(destDir, 0755)

	for _, size := range sizes {
		destPath := filepath.Join(destDir, fmt.Sprintf("icon%d.png", size))
		if err := resizeAndSave(img, size, destPath); err != nil {
			fmt.Printf("Failed to create icon%d: %v\n", size, err)
		} else {
			fmt.Printf("Created icon%d.png\n", size)
		}
	}
	fmt.Println("Icons Generated Successfully!")
}

func resizeAndSave(src image.Image, size int, destPath string) error {
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	draw.CatmullRom.Scale(dst, dst.Rect, src, src.Bounds(), draw.Over, nil)

	outFile, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	return png.Encode(outFile, dst)
}
