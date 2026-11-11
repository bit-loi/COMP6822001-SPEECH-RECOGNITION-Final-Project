package main

import (
	"log"
	"neuravity-engine/handlers"

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

	log.Println("Layer 2 Execution Engine (Go) running on :3002")
	log.Fatal(app.Listen(":3002"))
}
