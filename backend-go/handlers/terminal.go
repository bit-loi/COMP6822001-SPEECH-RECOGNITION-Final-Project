package handlers

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gofiber/websocket/v2"
)

const (
	HostWorkDir = "D:\\Documents\\Code\\Hackathon\\Neuravity"
)

func TerminalSocket(c *websocket.Conn) {
	defer c.Close()

	c.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[1;35mInitializing Local Sandbox...\x1b[0m\r\n"))
	c.WriteMessage(websocket.TextMessage, []byte("\x1b[1;35mLocal Terminal Ready!\x1b[0m\r\n"))
	c.WriteMessage(websocket.TextMessage, []byte("\x1b[35mEnvironment: Local Windows Host.\x1b[0m\r\n\r\n"))

	// Track current working directory
	currentDir := HostWorkDir
	if _, err := os.Stat(currentDir); os.IsNotExist(err) {
		currentDir, _ = os.Getwd()
	}

	// Show prompt
	sendPrompt := func() {
		prompt := "\x1b[1;35mlocal:" + currentDir + ">\x1b[0m "
		c.WriteMessage(websocket.TextMessage, []byte(prompt))
	}
	sendPrompt()

	// Command execution loop
	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			break
		}

		command := strings.TrimSpace(string(msg))
		if command == "" {
			c.WriteMessage(websocket.TextMessage, []byte("\r\n"))
			sendPrompt()
			continue
		}

		// Echo newline
		c.WriteMessage(websocket.TextMessage, []byte("\r\n"))

		// Handle CD command specially
		if strings.HasPrefix(command, "cd ") {
			targetDir := strings.TrimSpace(command[3:])
			
			// Resolve path logic
			newDir := targetDir
			if !filepath.IsAbs(targetDir) {
				newDir = filepath.Join(currentDir, targetDir)
			}
			newDir = filepath.Clean(newDir)

			// Validate dir exists
			if info, err := os.Stat(newDir); err == nil && info.IsDir() {
				currentDir = newDir
			} else {
				c.WriteMessage(websocket.TextMessage, []byte("\x1b[1;31mcd: no such file or directory: "+targetDir+"\x1b[0m\r\n"))
			}
			
			sendPrompt()
			continue
		}

		// Execute local command
		cmd := exec.Command("cmd", "/C", command)
		cmd.Dir = currentDir
		
		// Capture output
		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err = cmd.Run()

		// Send output
		if stdout.Len() > 0 {
			outRaw := stdout.String()
			outRaw = strings.ReplaceAll(outRaw, "\r\n", "\n")
			outRaw = strings.ReplaceAll(outRaw, "\n", "\r\n")
			c.WriteMessage(websocket.TextMessage, []byte(outRaw))
		}
		if stderr.Len() > 0 {
			errRaw := stderr.String()
			errRaw = strings.ReplaceAll(errRaw, "\r\n", "\n")
			errRaw = strings.ReplaceAll(errRaw, "\n", "\r\n")
			c.WriteMessage(websocket.TextMessage, []byte("\x1b[1;31m" + errRaw + "\x1b[0m"))
		}

		sendPrompt()
	}
}
