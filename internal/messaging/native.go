package messaging

import (
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
	"sync"
)

// Message represents the standard JSON message format
type Message struct {
	Id     string          `json:"id,omitempty"`
	Cmd    string          `json:"cmd"`
	Config json.RawMessage `json:"config,omitempty"`
	Port   int             `json:"port,omitempty"`
	Status string          `json:"status,omitempty"`
	Error  string          `json:"error,omitempty"`
	Data   interface{}     `json:"data,omitempty"`
}

// ReadMessage reads a length-prefixed message from Stdin
func ReadMessage() (*Message, error) {
	var length uint32
	// Read 4 bytes length
	err := binary.Read(os.Stdin, binary.LittleEndian, &length)
	if err != nil {
		return nil, err
	}

	// Read content
	buf := make([]byte, length)
	_, err = io.ReadFull(os.Stdin, buf)
	if err != nil {
		return nil, err
	}

	var msg Message
	err = json.Unmarshal(buf, &msg)
	if err != nil {
		return nil, err
	}

	return &msg, nil
}

// WriteMessage sends a length-prefixed message to Stdout
var writeMutex sync.Mutex

func WriteMessage(msg *Message) error {
	writeMutex.Lock()
	defer writeMutex.Unlock()

	bytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	length := uint32(len(bytes))
	err = binary.Write(os.Stdout, binary.LittleEndian, length)
	if err != nil {
		return err
	}

	_, err = os.Stdout.Write(bytes)
	return err
}
