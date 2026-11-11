# AmbatuCode

**A voice-controlled AI-powered code editor for developers recovering from hand injuries.** Built so coding does not have to stop while your hands heal: speak what you want, and the editor turns it into file operations, code edits, terminal commands, and commits.

> **Final Project — Speech Recognition.** This repository is the final project for the Speech Recognition course. The speech path is deliberately classical: local MFCC features and a non-deep-learning keyword classifier over Google Speech Commands v2 (35 keywords + `silence` + `unknown`), with no cloud speech APIs.

---

## The Problem

A hand injury — RSI, carpal tunnel surgery, a fracture, tendonitis — takes typing and mouse work off the table for weeks or months. Most editors assume both are available, so recovery means losing momentum on projects you care about.

AmbatuCode is built around that constraint:
- **Typing hurts**: repetitive keystrokes aggravate the injury and slow recovery.
- **Shortcuts and menus demand the exact motions that hurt**: chords, drags, and precise clicks.
- **Time away costs context**: after a break you have to rebuild the mental model of the codebase.
- **Assistive tools are usually separate from the editor**: dictation writes into a box, not into your project.

AmbatuCode closes that gap with on-device voice commands, an AI agent that performs the mechanical work, and comfort settings that reduce the physical effort per action.

---

## Key Features

### 1. Voice-to-Code Commands
Control the editor without touching the keyboard.
- Speech is recognized **locally** by the Go backend (MFCC features plus a lightweight keyword classifier), so short commands like `go`, `stop`, `up`, `down`, `left`, `right`, `yes`, `no`, `undo`, `redo`, and `zero`–`nine` map straight to editor actions.
- No cloud speech API is used and no audio is stored.
- The AI layer can also translate a spoken intent ("bikin fungsi hello world", "add a test for this file") into actual cursor and file modifications.

### 2. True AI Automation Agent (New!)
Unlike typical chat bots, the AmbatuCode AI acts directly on your workspace, so you describe the change instead of performing it:
- **`create_file` & `delete_file`**: Auto-create or remove files in your project.
- **`create_folder` & `delete_folder`**: Instantly generate or remove directories.
- **`insert_code`**: Append code directly to your active text editor.
- **`update_file`**: Perform full code refactoring on your target.
- **`run_command`**: Execute bash commands securely in the integrated terminal (e.g., `npm install`).
- **`git_commit_push`**: Automatically stage changes, generate a conventional commit message, and push to GitHub!

### 3. Accessibility & Comfort Panel
One-click settings that lower the physical effort of each session:
- **Readability Mode**: Bigger line heights, custom spacing, OpenDyslexic-styled fonts.
- **Focus Mode**: Instantly hides all distractions (sidebars, terminal, chat) through `F11`.
- **Comfort Settings**: Disable overly flashy animations, pick comfortable high-contrast themes, and adjust font size without menus.

### 4. Adaptive Memory System
- **Conversation Memory**: The AI remembers context from previous sessions, so returning after a break does not mean starting over.
- **User Profile Memory**: The AI learns your working preferences (e.g., "explain step-by-step") and adjusts its language and tone.
- **Multilingual Native**: Speak/type in English, Indonesian, Spanish, or Japanese, and the AI matches your language.

### 5. Session Sharing & Exporting
- Export your coding conversation into a formatted Markdown/PDF transcript.
- Zip and download your entire project workspace locally.
- Useful for keeping a recovery log, handing work to a teammate, or sharing progress with an occupational therapist.

---

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Monaco Editor, Zustand.
- **Backend (Python)**: FastAPI, Uvicorn, Python-based Agentic Tool Executors.
- **Backend (Go)**: Go Fiber (fast socket routing and microservices), on-device voice pipeline (MFCC + keyword classifier) over WebSocket.
- **AI Core**: Google Gemini 2.5 Flash API (Function Calling & Embedding) for chat and the agent, not for speech recognition.
- **Database**: PostgreSQL / Supabase.
- **Integrations**: GitHub OAuth, JSZip.

---

## Installation & Setup

### Prerequisites
- Node.js 20+
- Python 3.10+
- Go 1.21+
- Google Gemini API Key

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AmbatuCode
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local and add NEXT_PUBLIC_GEMINI_API_KEY
   npm run dev
   ```

3. **Python AI Agent Backend Setup**
   ```bash
   cd backend-python
   python -m venv venv
   source venv/Scripts/activate  # Or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. **Go Microservice Backend Setup**
   ```bash
   cd backend-go
   go mod tidy
   go run main.go
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## Contributing & Community

We warmly welcome contributions. The goal is to keep coding within reach for people whose hands are out of action, whether temporarily or long-term.

If an injury makes part of this editor hard to use, **open an issue**. If you have an idea for a feature that would help you, **open a PR**.

### License
MIT License.

---
_AmbatuCode — Code the way your hands need to work right now._
