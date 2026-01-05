package ui

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strings"
)

// ANSI Color Codes
const (
	Reset   = "\033[0m"
	Cyan    = "\033[36m"
	Magenta = "\033[35m"
	Yellow  = "\033[33m"
	Red     = "\033[31m"
	Green   = "\033[32m"
	Bold    = "\033[1m"
)

const Logo = `
` + Magenta + `
  █  █  ████  █    █  ████
  █  █  █  █  ██  ██  █  █
  ████  █  █  █ ██ █  ████
  █  █  █  █  █    █  █  █
  █  █  ████  █    █  █  █
` + Cyan + `
     Powered by Foxfig
` + Reset + `
`

func ClearScreen() {
	if runtime.GOOS == "windows" {
		fmt.Print("\033[H\033[2J")
	} else {
		fmt.Print("\033[H\033[2J")
	}
}

func PrintLogo() {
	fmt.Println(Logo)
}

func Info(msg string) {
	fmt.Printf("%s[INFO] %s%s\n", Cyan, Reset, msg)
}

func Success(msg string) {
	fmt.Printf("%s[SUCCESS] %s%s\n", Green, Reset, msg)
}

func Warning(msg string) {
	fmt.Printf("%s[WARNING] %s%s\n", Yellow, Reset, msg)
}

func Error(msg string) {
	fmt.Printf("%s[ERROR] %s%s\n", Red, Reset, msg)
}

func Header(title string) {
	fmt.Printf("\n%s=== %s ===%s\n", Magenta, title, Reset)
}

func Prompt(label string) string {
	fmt.Printf("%s%s%s", Bold, label, Reset)
	reader := bufio.NewReader(os.Stdin)
	text, _ := reader.ReadString('\n')
	return strings.TrimSpace(text)
}

func Pause() {
	fmt.Println("\nPress Enter to continue...")
	bufio.NewReader(os.Stdin).ReadBytes('\n')
}
