package handlers

import (
	"encoding/json"
	"log"

	"ambatucode-engine/voice"

	"github.com/gofiber/websocket/v2"
)

// VoiceSocket returns the WebSocket handler for /ws/voice.
//
// The client sends signed 16-bit little-endian mono PCM at 16 kHz in binary
// messages (200-300 ms chunks). The server runs the VAD, feature extraction,
// classifier and command mapper, and answers with JSON text messages:
//
//	{"type":"ready","sample_rate":16000,"format":"pcm_s16le","frame_ms":10,
//	 "feature_dim":78,"confidence_threshold":0.75}
//	{"type":"speech_start"}
//	{"type":"result","label":"go","confidence":0.93,
//	 "top_k":[{"label":"go","confidence":0.93}],"inference_ms":0.5,
//	 "reason":"mapped","action":{"action":"execute_active_file","params":{}}}
//	{"type":"error","message":"..."}
//
// The only text message the client may send is {"type":"flush"}, which
// classifies an utterance still in progress (e.g. the user released the
// push-to-talk button).
func VoiceSocket(classifier voice.Classifier, mapper *voice.CommandMapper) func(*websocket.Conn) {
	return func(c *websocket.Conn) {
		defer c.Close()
		c.SetReadLimit(voice.MaxMessageBytes)

		streamer, err := voice.NewStreamer(classifier, mapper)
		if err != nil {
			writeJSON(c, errorMessage{Type: "error", Message: err.Error()})
			return
		}

		writeJSON(c, readyMessage{
			Type:                "ready",
			SampleRate:          voice.SampleRate,
			Format:              "pcm_s16le",
			FrameMs:             voice.FrameHopMs,
			FeatureDim:          voice.FeatureDim,
			ConfidenceThreshold: mapper.ConfidenceThreshold(),
		})

		for {
			messageType, message, err := c.ReadMessage()
			if err != nil {
				return
			}

			switch messageType {
			case websocket.BinaryMessage:
				writeEvents(c, streamer.WritePCM(message))
			case websocket.TextMessage:
				var control controlMessage
				if err := json.Unmarshal(message, &control); err != nil {
					writeJSON(c, errorMessage{Type: "error", Message: "control messages must be JSON"})
					continue
				}
				if control.Type != "flush" {
					writeJSON(c, errorMessage{Type: "error", Message: "unknown control message: " + control.Type})
					continue
				}
				writeEvents(c, streamer.Flush())
			}
		}
	}
}

type readyMessage struct {
	Type                string  `json:"type"`
	SampleRate          int     `json:"sample_rate"`
	Format              string  `json:"format"`
	FrameMs             int     `json:"frame_ms"`
	FeatureDim          int     `json:"feature_dim"`
	ConfidenceThreshold float64 `json:"confidence_threshold"`
}

type speechStartMessage struct {
	Type string `json:"type"`
}

type resultMessage struct {
	Type        string               `json:"type"`
	Label       string               `json:"label"`
	Confidence  float64              `json:"confidence"`
	TopK        []voice.TopKEntry    `json:"top_k"`
	InferenceMs float64              `json:"inference_ms"`
	Reason      voice.MapReason      `json:"reason"`
	Action      *voice.CommandAction `json:"action"`
}

type errorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type controlMessage struct {
	Type string `json:"type"`
}

func newResultMessage(output voice.ClassifierOutput, mapping voice.MapResult) resultMessage {
	return resultMessage{
		Type:        "result",
		Label:       output.Label,
		Confidence:  output.Confidence,
		TopK:        output.TopK,
		InferenceMs: output.InferenceMs,
		Reason:      mapping.Reason,
		Action:      mapping.Action,
	}
}

func writeEvents(c *websocket.Conn, events []voice.StreamEvent) {
	for _, event := range events {
		switch event.Kind {
		case voice.StreamSpeechStart:
			writeJSON(c, speechStartMessage{Type: "speech_start"})
		case voice.StreamResult:
			writeJSON(c, newResultMessage(*event.Output, *event.Mapping))
		case voice.StreamError:
			log.Printf("voice: classification failed: %v", event.Err)
			writeJSON(c, errorMessage{Type: "error", Message: "classification failed"})
		}
	}
}

func writeJSON(c *websocket.Conn, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Printf("voice: marshal message: %v", err)
		return
	}
	if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("voice: write message: %v", err)
	}
}
