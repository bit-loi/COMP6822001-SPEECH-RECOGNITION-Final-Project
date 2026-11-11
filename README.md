# AmbatuCode

**A voice-controlled code editor built for the Speech Recognition final project.**

Speak short keywords, and the editor turns them into actions: run the active file, stop, scroll, switch tabs, change the theme, undo/redo, or jump to a tab by number.

> **Final Project — Speech Recognition.** The speech path is deliberately classical: local MFCC features and a non-deep-learning keyword classifier over Google Speech Commands v2 (35 keywords + `silence` + `unknown`), with no cloud speech APIs.

---

## How It Works

1. The browser captures microphone audio as 16 kHz mono `pcm_s16le` and streams it to the Go backend over `ws://127.0.0.1:3002/ws/voice`.
2. The Go backend runs voice activity detection, MFCC feature extraction, a keyword classifier, and the command mapper.
3. The result comes back as JSON with the recognised label, confidence, top-k candidates, and the mapped editor action.
4. The frontend applies the action to the editor.

No audio is stored, and no cloud speech API is used.

### Voice Commands

| Keyword | Action |
| --- | --- |
| `go` | Run the active file |
| `stop` | Stop the current execution |
| `up` / `down` | Scroll the editor |
| `left` / `right` | Switch tabs |
| `backward` / `forward` | Undo / redo |
| `visual` | Toggle light/dark theme |
| `one` … `nine`, `zero` | Select an open tab |
| `yes` / `no` | Confirm / cancel (UI-dependent) |

Other Speech Commands v2 words are recognised but intentionally have no action. See `backend-python/services/command_map.json`.

---

## Tech Stack

- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS, Monaco Editor.
- **Backend (Go)**: Go Fiber, WebSocket voice streaming, MFCC feature extraction, command mapping.
- **Backend (Python)**: FastAPI for the editor/compiler and file APIs.
- **Speech features**: 13 MFCC + delta + delta-delta (39 channels), 25 ms window, 10 ms hop, 16 kHz mono. Parameters live in `backend-go/voice/params.go`.

---

## Installation & Setup

### Prerequisites

- Node.js 20+
- Python 3.10+
- Go 1.21+

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AmbatuCode
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Python backend**
   ```bash
   cd backend-python
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   .\venv\Scripts\python.exe -m uvicorn main:app --port 8000
   ```

4. **Go voice engine**
   ```bash
   cd backend-go
   go run .
   ```

5. Open [http://localhost:3000](http://localhost:3000), wait for the voice panel to show **Online**, and tap the mic.

### Demo Without a Trained Model

The current engine uses a stub classifier. To exercise the full WebSocket path without speaking:

```powershell
cd backend-go
$env:AMBATUCODE_VOICE_SCRIPT="go,stop"
go run .
```

### Environment

- `AMBATUCODE_VOICE_SCRIPT` — comma-separated labels the stub classifier cycles through.
- `AMBATUCODE_COMMAND_MAP` — override the command map path.
- `AMBATUCODE_CONFIDENCE_THRESHOLD` — override the default `0.75`.
- `NEXT_PUBLIC_VOICE_WS_URL` — override the frontend WebSocket URL (default `ws://127.0.0.1:3002/ws/voice`).

---

## Project Scope

This build focuses on speech recognition and voice-driven editing. The AI chat panel, focus mode, and accessibility/customisation settings from earlier iterations have been removed.
