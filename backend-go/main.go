package main

import (
	"log"
	"os"
	"strings"

	"ambatucode-engine/handlers"
	"ambatucode-engine/voice"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
)

func main() {
	app := fiber.New()

	app.Use(cors.New())

	// Routes
	app.Post("/api/run", handlers.ExecuteCode)

	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(handlers.TerminalSocket))

	classifier, err := newVoiceClassifier()
	if err != nil {
		log.Fatalf("voice classifier: %v", err)
	}
	mapper, err := voice.LoadCommandMapper(nil)
	if err != nil {
		log.Fatalf("voice command map: %v", err)
	}
	app.Get("/ws/voice", websocket.New(handlers.VoiceSocket(classifier, mapper)))

	log.Println("Layer 2 Execution Engine (Go) running on :3002")
	log.Fatal(app.Listen(":3002"))
}

// newVoiceClassifier returns the keyword classifier the voice socket uses.
// Until a trained model is plugged in this is the deterministic stub. Setting
// AMBATUCODE_VOICE_SCRIPT=go,stop makes it return those labels in order, which
// is handy for demoing a specific editor action.
func newVoiceClassifier() (voice.Classifier, error) {
	script := strings.TrimSpace(os.Getenv("AMBATUCODE_VOICE_SCRIPT"))
	if script == "" {
		return voice.NewStubClassifier()
	}

	labels := strings.Split(script, ",")
	for i := range labels {
		labels[i] = strings.TrimSpace(labels[i])
	}
	return voice.NewStubClassifier(voice.WithScript(labels...))
}
