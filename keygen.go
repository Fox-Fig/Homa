package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
)

func main() {
	// 1. Generate RSA Key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}

	// 2. Get Public Key DER
	pubDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		panic(err)
	}

	// 3. Calculate "key" for manifest (Base64 of Public Key)
	manifestKey := base64.StdEncoding.EncodeToString(pubDER)

	// 4. Calculate Extension ID
	// SHA256 of Public Key
	hash := sha256.Sum256(pubDER)
	// First 16 bytes
	header := hash[:16]

	// Convert to hex (base16) but using a-p instead of 0-9a-f
	// Actually Chrome just maps 0-15 to a-p
	var id string
	for _, b := range header {
		// High nibble
		id += string('a' + (b >> 4))
		// Low nibble
		id += string('a' + (b & 0x0f))
	}

	fmt.Printf("NEW_KEY=%s\n", manifestKey)
	fmt.Printf("NEW_ID=%s\n", id)
}
