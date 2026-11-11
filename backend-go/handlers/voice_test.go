package handlers

import (
	"encoding/binary"
	"encoding/json"
	"net"
	"testing"
	"time"

	"ambatucode-engine/voice"

	clientws "github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

const testCommandMap = `{
	"commands": {"go": {"action": "execute_active_file"}},
	"no_action": ["cat"]
}`

func newVoiceTestApp(t *testing.T) (*fiber.App, string) {
	t.Helper()

	stub, err := voice.NewStubClassifier(voice.WithScript("go"), voice.WithScriptedConfidence(0.9))
	if err != nil {
		t.Fatal(err)
	}
	mapper, err := voice.NewCommandMapperFromJSON([]byte(testCommandMap), nil)
	if err != nil {
		t.Fatal(err)
	}

	app := fiber.New()
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/voice", websocket.New(VoiceSocket(stub, mapper)))

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go app.Listener(listener)
	t.Cleanup(func() { _ = app.Shutdown() })

	return app, "ws://" + listener.Addr().String() + "/ws/voice"
}

func dialVoiceSocket(t *testing.T, url string) *clientws.Conn {
	t.Helper()
	conn, _, err := clientws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	if err := conn.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
	return conn
}

func readJSON(t *testing.T, conn *clientws.Conn) map[string]any {
	t.Helper()
	messageType, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if messageType != clientws.TextMessage {
		t.Fatalf("message type = %d, want text", messageType)
	}
	var message map[string]any
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatalf("parse %s: %v", data, err)
	}
	return message
}

func pcm16(samples []int16) []byte {
	data := make([]byte, 2*len(samples))
	for i, sample := range samples {
		binary.LittleEndian.PutUint16(data[2*i:], uint16(sample))
	}
	return data
}

func tone(n int) []int16 {
	samples := make([]int16, n)
	for i := range samples {
		if i%2 == 0 {
			samples[i] = 8000
		} else {
			samples[i] = -8000
		}
	}
	return samples
}

func quiet(n int) []int16 {
	samples := make([]int16, n)
	for i := range samples {
		if i%2 == 0 {
			samples[i] = 10
		} else {
			samples[i] = -10
		}
	}
	return samples
}

func TestVoiceSocketStreamsAResult(t *testing.T) {
	_, url := newVoiceTestApp(t)
	conn := dialVoiceSocket(t, url)

	ready := readJSON(t, conn)
	if ready["type"] != "ready" {
		t.Fatalf("first message = %v", ready)
	}
	if ready["sample_rate"].(float64) != voice.SampleRate {
		t.Fatalf("sample_rate = %v", ready["sample_rate"])
	}
	if ready["confidence_threshold"].(float64) != voice.DefaultConfidenceThreshold {
		t.Fatalf("confidence_threshold = %v", ready["confidence_threshold"])
	}

	samples := append(append(quiet(4800), tone(9600)...), quiet(6400)...)
	if err := conn.WriteMessage(clientws.BinaryMessage, pcm16(samples)); err != nil {
		t.Fatalf("write audio: %v", err)
	}

	var events []string
	for {
		message := readJSON(t, conn)
		events = append(events, message["type"].(string))
		if message["type"] != "result" {
			continue
		}
		if message["label"] != "go" || message["reason"] != "mapped" {
			t.Fatalf("result = %v", message)
		}
		action, ok := message["action"].(map[string]any)
		if !ok || action["action"] != "execute_active_file" {
			t.Fatalf("action = %v", message["action"])
		}
		if _, ok := message["top_k"].([]any); !ok {
			t.Fatalf("top_k = %v", message["top_k"])
		}
		break
	}

	if len(events) < 2 || events[len(events)-2] != "speech_start" {
		t.Fatalf("events = %v", events)
	}
}

func TestVoiceSocketFlushControlMessage(t *testing.T) {
	_, url := newVoiceTestApp(t)
	conn := dialVoiceSocket(t, url)
	readJSON(t, conn) // ready

	samples := append(quiet(4800), tone(9600)...)
	if err := conn.WriteMessage(clientws.BinaryMessage, pcm16(samples)); err != nil {
		t.Fatal(err)
	}
	if err := conn.WriteMessage(clientws.TextMessage, []byte(`{"type":"flush"}`)); err != nil {
		t.Fatal(err)
	}

	for {
		message := readJSON(t, conn)
		if message["type"] == "error" {
			t.Fatalf("server error: %v", message["message"])
		}
		if message["type"] == "result" {
			if message["reason"] != "mapped" {
				t.Fatalf("result = %v", message)
			}
			return
		}
	}
}

func TestVoiceSocketRejectsUnknownControlMessage(t *testing.T) {
	_, url := newVoiceTestApp(t)
	conn := dialVoiceSocket(t, url)
	readJSON(t, conn) // ready

	if err := conn.WriteMessage(clientws.TextMessage, []byte(`{"type":"dance"}`)); err != nil {
		t.Fatal(err)
	}
	message := readJSON(t, conn)
	if message["type"] != "error" {
		t.Fatalf("message = %v", message)
	}
}
