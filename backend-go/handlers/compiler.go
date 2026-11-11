package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type ExecuteRequest struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

type PistonRequest struct {
	Language string       `json:"language"`
	Version  string       `json:"version"`
	Files    []PistonFile `json:"files"`
}

type PistonFile struct {
	Content string `json:"content"`
}

var languageMap = map[string]string{
	"js": "javascript", "ts": "typescript", "py": "python",
	"go": "go", "rs": "rust", "cpp": "c++", "c": "c", "java": "java",
	"php": "php", "rb": "ruby", "kt": "kotlin", "swift": "swift",
	"cs": "csharp", "dart": "dart", "scala": "scala", "pl": "perl",
	"lua": "lua", "r": "r", "sh": "bash",
}

// Very basic version map, ideally we fetch from Piston /runtimes
var versionMap = map[string]string{
	"javascript": "18.15.0", 
	"typescript": "5.0.3", 
	"python":     "3.10.0",
	"go":         "1.16.2",
	"rust":       "1.68.2",
	"c++":        "10.2.0",
	"c":          "10.2.0",
	"java":       "15.0.2",
	"php":        "8.2.3",
	"ruby":       "3.0.1",
	"kotlin":     "1.8.20",
	"swift":      "5.3.3",
	"csharp":     "6.12.0",
	"dart":       "2.19.6",
	"scala":      "3.2.2",
	"perl":       "5.36.0",
	"lua":        "5.4.4",
	"r":          "4.1.1",
	"bash":       "5.2.0",
}

func ExecuteCode(c *fiber.Ctx) error {
	var req ExecuteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	lang, ok := languageMap[req.Language]
	if !ok {
		lang = req.Language
	}
	// Default to * for version if unknown
	version := versionMap[lang]
	if version == "" {
		version = "*"
	}

	pistonReq := PistonRequest{
		Language: lang,
		Version:  version,
		Files:    []PistonFile{{Content: req.Code}},
	}

	body, _ := json.Marshal(pistonReq)
	resp, err := http.Post("https://emkc.org/api/v2/piston/execute", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to connect to Piston"})
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return c.JSON(result)
}
